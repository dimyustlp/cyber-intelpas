/**
 * Uji jendela hari: 00.00 sampai 23.59 WIB, dan hanya itu.
 *
 * ## Kelas cacat yang dijaga di sini
 *
 * `new Date().toISOString().slice(0, 10)` memberikan hari menurut UTC. Di
 * Indonesia bagian barat itu tujuh jam di belakang, sehingga setiap halaman
 * yang memakainya menganggap "hari ini" adalah kemarin selama tujuh jam
 * pertama setiap hari — pukul 00.00 sampai 07.00 WIB.
 *
 * Yang membuatnya mahal: laporan harian disusun pukul 05.30 WIB, tepat di
 * dalam jam-jam itu. Dan yang membuatnya sulit ketahuan: tidak ada yang rusak.
 * Tidak ada galat, tidak ada kolom kosong, tidak ada angka nol. Yang terjadi
 * hanyalah laporan memuat hari yang salah, dan hari yang salah itu tetap
 * berisi ratusan berita yang tampak masuk akal.
 *
 * Empat hal yang diperiksa:
 *
 *   1. `hariWib()` benar-benar memotong hari di Jakarta, termasuk pada instan
 *      yang jatuh di seberang batas UTC.
 *   2. Tidak ada lagi berkas yang memilih rentang tanggal dengan bentuk UTC.
 *   3. Rekap per hari pada laporan berjumlah sama dengan publikasinya sendiri,
 *      dan jumlah harinya sama dengan panjang periodenya.
 *   4. Fungsi basis data memotong hari dengan zona Jakarta, bukan dengan
 *      `::date` telanjang.
 *
 *   node tools/uji-jendela.mjs
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tanggalIso, hariWib } from '../web/js/lib/format.js'
import { buatBerita, snapshotDemo } from '../web/js/lib/demo.js'
import { olahLaporan } from '../web/js/lib/laporan.js'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')

let lulus = 0
const gagal = []

function periksa(nama, syarat, ket = '') {
  if (syarat) { lulus += 1; return }
  gagal.push(`${nama}${ket ? ` — ${ket}` : ''}`)
}

/* --- 1: pemotong hari ------------------------------------------------- */

/*
   Empat instan yang dipilih justru karena jawabannya berbeda antara UTC dan
   WIB. Instan yang jawabannya kebetulan sama tidak menguji apa pun.
*/
const KASUS = [
  ['2026-09-11T17:00:00Z', '2026-09-12', 'tepat pukul 00.00 WIB, hari sudah berganti'],
  ['2026-09-11T19:00:00Z', '2026-09-12', 'pukul 02.00 WIB'],
  ['2026-09-11T22:30:00Z', '2026-09-12', 'pukul 05.30 WIB, saat laporan disusun'],
  ['2026-09-11T16:59:59Z', '2026-09-11', 'sedetik sebelum tengah malam WIB'],
]
for (const [instan, harusnya, ket] of KASUS) {
  const dapat = tanggalIso(new Date(instan))
  periksa(`hari WIB untuk ${instan}`, dapat === harusnya, `${ket}; dapat ${dapat}, harusnya ${harusnya}`)
}

periksa('hariWib(0) berbentuk YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(hariWib(0)))
periksa('hariWib(-6) enam hari sebelum hariWib(0)',
  (Date.parse(`${hariWib(0)}T00:00:00Z`) - Date.parse(`${hariWib(-6)}T00:00:00Z`)) === 6 * 86_400_000)

/* --- 2: tidak ada lagi pemilih rentang berbentuk UTC ------------------- */

/*
   Yang dicari bentuk `new Date()` yang langsung dipotong menjadi hari.
   Pemotongan atas sebuah nilai yang datang dari luar — `new Date(nilai)` —
   sengaja tidak dijaring: sebagiannya memang sudah membawa pergeseran WIB
   sendiri, dan menjaringnya akan menghasilkan temuan palsu yang membuat uji
   ini berhenti dipercaya.
*/
const POLA_UTC = /new Date\(\)\s*\.?[\s\S]{0,80}?toISOString\(\)\.slice\(0,\s*10\)/

/**
 * Membuang komentar sebelum mencari pola.
 *
 * Tanpa ini, uji ini gagal pada berkas yang menjelaskan bentuk yang dilarang —
 * termasuk lib/format.js, tempat larangannya ditulis. Uji yang merahkan
 * dokumentasi tentang dirinya sendiri berhenti dipercaya pada minggu pertama.
 */
function tanpaKomentar(isi) {
  return isi.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

function berkasJs(dir, hasil = []) {
  for (const n of readdirSync(dir, { withFileTypes: true })) {
    const jalur = join(dir, n.name)
    if (n.isDirectory()) berkasJs(jalur, hasil)
    else if (n.name.endsWith('.js')) hasil.push(jalur)
  }
  return hasil
}

/*
   Dua pemakaian yang memang UTC dan memang benar begitu: nama berkas unduhan.
   Nama berkas bukan batas periode; ia penanda kapan berkasnya dibuat, dan
   tidak ada satu pun angka yang bergantung padanya.
*/
const DIKECUALIKAN = new Set(['pages/audit.js', 'pages/berita.js'])

for (const jalur of berkasJs(join(AKAR, 'web', 'js'))) {
  const nama = relative(join(AKAR, 'web', 'js'), jalur).replace(/\\/g, '/')
  if (DIKECUALIKAN.has(nama)) continue
  const isi = tanpaKomentar(readFileSync(jalur, 'utf8'))
  periksa(`${nama} tidak memilih hari menurut UTC`, !POLA_UTC.test(isi),
    'pakai hariWib() dari lib/format.js')
}

/* --- 3: rekap harian berjumlah sama dengan publikasinya ---------------- */

{
  const berita = buatBerita(300, new Date('2026-09-12T16:00:00Z'))
  const periode = { mulai: '2026-09-06', selesai: '2026-09-12' }
  const olah = olahLaporan(snapshotDemo(berita, periode))
  const jumlahHarian = olah.perHari.reduce((n, h) => n + h.publikasi, 0)

  periksa('rekap harian berjumlah sama dengan publikasi laporan',
    jumlahHarian === olah.publikasi.length,
    `rekap ${jumlahHarian}, publikasi ${olah.publikasi.length}`)
  periksa('rekap memuat tiap hari dalam periode, termasuk yang kosong',
    olah.perHari.length === 7, `dapat ${olah.perHari.length} hari`)
  periksa('hari pertama dan terakhir rekap sama dengan periodenya',
    olah.perHari[0]?.tanggal === periode.mulai
      && olah.perHari.at(-1)?.tanggal === periode.selesai)
}

/* --- 4: fungsi basis data memotong hari di Jakarta --------------------- */

{
  const migrasi = readFileSync(
    join(AKAR, 'supabase', 'migrations', '20260912010000_jendela_hari_wib.sql'), 'utf8',
  )
  periksa('snapshot_negatif memotong hari dengan zona Jakarta',
    migrasi.includes("(b.created_at at time zone 'Asia/Jakarta')::date"))
  periksa('snapshot_negatif tidak lagi memotong dengan ::date telanjang',
    !migrasi.includes('coalesce(b.tanggal_publikasi, b.created_at)::date'))
  periksa('tiap baris publikasi membawa hari tangkapnya',
    migrasi.includes("'hari', (n.created_at at time zone 'Asia/Jakarta')::date"))
  periksa('penjadwal harian 05.30 WIB', migrasi.includes("'30 22 * * *'"))
  periksa('penjadwal mingguan 05.30 WIB hari Minggu', migrasi.includes("'30 22 * * 0'"))
}

/* ------------------------------------------------------------- keluaran */

if (gagal.length) {
  console.log(`\n${lulus} lulus, ${gagal.length} gagal:\n`)
  for (const g of gagal) console.log(`  • ${g}`)
  console.log('')
  process.exit(1)
}

console.log(`${lulus} lulus, 0 gagal — jendela hari tetap 00.00–23.59 WIB.`)
