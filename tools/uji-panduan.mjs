/**
 * Penjaga cakupan panduan.
 *
 * Yang diperiksa bukan apakah kalimatnya bagus — itu pekerjaan mata — melainkan
 * apakah panduan masih menjelaskan sistem yang benar-benar ada hari ini. Ada
 * empat cara panduan berbohong tanpa satu pun galat muncul di layar:
 *
 *   1. Fitur baru ditambahkan ke menu tanpa penjelasannya. Halamannya terbuka,
 *      seluruh fitur lain tetap terbaca, dan yang baru hanya tidak ada —
 *      persis seperti fitur yang memang belum dibuat. Yang mencarinya
 *      menyimpulkan fiturnya tidak ada, bukan panduannya yang tertinggal.
 *
 *   2. Fitur dihapus dari menu tetapi penjelasannya tertinggal. Petugas
 *      membaca keterangan sebuah layar, mencarinya di menu, dan tidak
 *      menemukannya. Yang ia simpulkan adalah haknya kurang.
 *
 *   3. Penjelasan menunjuk halaman yang tidak terdaftar di penunjuk halaman.
 *      Tombol "Buka" di sampingnya mendarat di layar "halaman tidak dikenali".
 *
 *   4. Sebuah butir punya "isi" tanpa "guna", atau sebaliknya. Halaman
 *      menggambar keduanya berdampingan; yang kosong tampil sebagai kolom
 *      kosong, dan kolom kosong terbaca sebagai kesalahan pemuatan.
 *
 * Berkasnya dibaca sebagai modul, bukan sebagai teks — keduanya modul ES murni
 * tanpa satu pun ketergantungan pada peramban, jadi node bisa memuatnya apa
 * adanya dan yang diperiksa benar-benar nilai yang dipakai halaman.
 *
 *   node tools/uji-panduan.mjs
 */

import { MENU, MENU_KANWIL, MENU_UPT } from '../web/js/lib/peran.js'
import { RUANG, TANPA_MENU, MANUAL_KIRIM, JENDELA_LAPORAN } from '../web/js/lib/panduan.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Nama halaman yang dikenali penunjuk halaman di main.js. */
function halamanTerdaftar() {
  const isi = readFileSync(join(AKAR, 'web', 'js', 'main.js'), 'utf8')
  const awal = isi.indexOf('const HALAMAN = {')
  if (awal < 0) throw new Error('Blok `const HALAMAN = {` tidak ditemukan di main.js')
  const blok = isi.slice(awal, isi.indexOf('\n}', awal))
  const nama = new Set()
  for (const c of blok.matchAll(/^\s*'?([a-z][a-z0-9-]*)'?:\s*\(\)\s*=>/gm)) nama.add(c[1])
  if (!nama.size) throw new Error('Penunjuk halaman terbaca kosong')
  return nama
}

const TERDAFTAR = halamanTerdaftar()
const MENU_RUANG = { pusat: MENU, wilayah: MENU_KANWIL, unit: MENU_UPT }

/*
   Butir menu yang memang tidak dijelaskan di dalam daftar fitur.

   `panduan` menjelaskan dirinya sendiri di bagian halaman tanpa menu, bukan
   sebagai salah satu fitur di tiap ruang — ia akan muncul tiga kali, dan
   ketiganya berbunyi sama.
*/
const DIKECUALIKAN = new Set(['panduan'])

const temuan = []

function lapor(pesan) {
  temuan.push(pesan)
}

/* --- 1 & 2: menu dan katalog harus sepadan ---------------------------- */

for (const [nama, menu] of Object.entries(MENU_RUANG)) {
  const diMenu = new Set()
  for (const grup of menu) {
    for (const b of grup.butir) {
      if (DIKECUALIKAN.has(b.id)) continue
      diMenu.add(b.id)
      if (!RUANG[nama].butir[b.id]) {
        lapor(`Ruang ${nama}: butir menu "${b.label}" (${b.id}) belum punya penjelasan `
          + 'di web/js/lib/panduan.js.')
      }
    }
  }
  for (const id of Object.keys(RUANG[nama].butir)) {
    if (!diMenu.has(id)) {
      lapor(`Ruang ${nama}: penjelasan untuk "${id}" tertinggal — butir menunya sudah `
        + 'tidak ada di web/js/lib/peran.js.')
    }
  }
}

/* --- 3: tiap penjelasan menunjuk halaman yang benar-benar terdaftar --- */

const semuaId = [
  ...Object.values(RUANG).flatMap((r) => Object.keys(r.butir)),
  ...Object.keys(TANPA_MENU),
]
for (const id of new Set(semuaId)) {
  if (!TERDAFTAR.has(id)) {
    lapor(`Penjelasan menunjuk halaman "${id}" yang tidak ada di penunjuk halaman main.js.`)
  }
}

/* --- 4: tiap butir lengkap ------------------------------------------- */

const butirSemua = [
  ...Object.entries(RUANG).flatMap(([r, d]) => Object.entries(d.butir).map(([id, b]) => [`${r}:${id}`, b])),
  ...Object.entries(TANPA_MENU).map(([id, b]) => [`tanpa-menu:${id}`, b]),
]
for (const [kunci, b] of butirSemua) {
  for (const bidang of ['isi', 'guna']) {
    if (!b[bidang] || String(b[bidang]).trim().length < 40) {
      lapor(`Butir ${kunci}: bidang "${bidang}" kosong atau terlalu pendek untuk dibaca.`)
    }
  }
  /* Tanda HTML di dalam katalog tidak akan tampil sebagai tanda — halaman
     melewatkannya ke amankan(). Yang menuliskannya akan melihat kurung sudut
     tercetak di layar, dan menyangka halamannya yang rusak. */
  for (const bidang of ['isi', 'guna', 'catatan']) {
    if (b[bidang] && /<[a-z/]/i.test(b[bidang])) {
      lapor(`Butir ${kunci}: bidang "${bidang}" memuat tanda HTML; katalog ini teks polos.`)
    }
  }
}

/* --- 5: manual dan jendela pelaporan --------------------------------- */

if (MANUAL_KIRIM.length < 8) {
  lapor(`Manual kirim berita hanya ${MANUAL_KIRIM.length} langkah; borangnya punya lebih `
    + 'banyak kolom daripada itu.')
}
for (const [i, l] of MANUAL_KIRIM.entries()) {
  if (!l.judul || !l.isi) lapor(`Manual langkah ${i + 1}: judul atau isinya kosong.`)
}

for (const bidang of ['mulai', 'selesai', 'kirim', 'contoh']) {
  if (!JENDELA_LAPORAN[bidang]) lapor(`Jendela laporan: bidang "${bidang}" kosong.`)
}
/*
   Jam yang tertulis di panduan harus sama dengan jam yang benar-benar
   dijadwalkan. Penjadwalnya hidup di basis data sebagai waktu UTC; yang bisa
   diperiksa dari sini adalah migrasinya. `30 22` UTC = 05.30 WIB.
*/
const migrasi = readFileSync(
  join(AKAR, 'supabase', 'migrations', '20260912010000_jendela_hari_wib.sql'), 'utf8',
)
if (!migrasi.includes("'30 22 * * *'")) {
  lapor('Penjadwal harian di migrasi bukan `30 22 * * *` (05.30 WIB); panduan menyebut '
    + `${JENDELA_LAPORAN.kirim} dan keduanya harus sama.`)
}
if (!JENDELA_LAPORAN.kirim.startsWith('05.30')) {
  lapor(`Panduan menyebut jam kirim ${JENDELA_LAPORAN.kirim}, sedangkan penjadwalnya 05.30 WIB.`)
}

/* ------------------------------------------------------------- keluaran */

const jumlahFitur = Object.values(RUANG).reduce((n, r) => n + Object.keys(r.butir).length, 0)

if (temuan.length) {
  console.log(`\n${temuan.length} temuan:\n`)
  for (const t of temuan) console.log(`  • ${t}`)
  console.log('')
  process.exit(1)
}

console.log(`Panduan lengkap: ${jumlahFitur} fitur di ${Object.keys(RUANG).length} ruang, `
  + `${Object.keys(TANPA_MENU).length} layar tanpa menu, ${MANUAL_KIRIM.length} langkah manual.`)
