/**
 * Uji skor risiko.
 *
 * Yang diuji di sini bukan "apakah angkanya benar" — tidak ada kebenaran
 * mutlak untuk sebuah angka gabungan, dan berpura-pura ada justru berbahaya.
 * Yang diuji adalah hal-hal yang HARUS berlaku apa pun bobotnya:
 *
 *   1. Skor tidak pernah keluar dari 0..100.
 *   2. Jumlah poin seluruh faktor sama dengan TEKANAN-nya, dan tekanan
 *      dikalikan gerbang sentimen sama dengan skornya. Kalau salah satu tidak
 *      berlaku, ada penyumbang yang tidak muncul di rincian, dan pembacanya
 *      sedang melihat angka yang tidak bisa dijumlahkan kembali.
 *   3. Bobot berjumlah 100, dan setiap faktor menjelaskan dirinya.
 *   4. Urutan yang masuk akal tetap terjaga: kritis di banyak media mengalahkan
 *      rendah di satu media; peristiwa yang masih berlangsung mengalahkan
 *      peristiwa serupa yang berhenti sebulan lalu; peristiwa yang sudah
 *      ditanggapi berskor lebih rendah daripada kembarannya yang didiamkan.
 *
 * Dijalankan tanpa peramban: node tools/uji-risiko.mjs
 */

import {
  BOBOT, TOTAL_BOBOT, TINGKAT_RISIKO, tingkatRisiko,
  skorRisiko, skorRisikoBerita, peringkatRisiko,
} from '../web/js/lib/risiko.js'

let lulus = 0
let gagal = 0

function periksa(nama, kondisi, rinci = '') {
  if (kondisi) { lulus += 1; return }
  gagal += 1
  console.error(`  GAGAL  ${nama}${rinci ? ` — ${rinci}` : ''}`)
}

function sama(nama, dapat, harap) {
  periksa(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, seharusnya ${JSON.stringify(harap)}`)
}

/** Acuan waktu tetap, supaya hasilnya tidak berubah menurut hari menjalankannya. */
const SEKARANG = new Date('2026-09-03T09:00:00+07:00')
const opsi = { sekarang: SEKARANG }

function hariLalu(n) {
  return new Date(SEKARANG.getTime() - n * 86_400_000).toISOString()
}

/**
 * Penyusun peristiwa uji. Sengaja memakai bentuk yang sama persis dengan
 * keluaran `kelompokkanPeristiwa()`, supaya uji ini ikut menangkap perubahan
 * bentuk di sana.
 */
function peristiwa({
  urgensi = 'Sedang', sentimen = 'Negatif', media = 1, publikasi = 1,
  rentang = 1, usia = 0, kembar = 0, penerbit = 'Kompas', sikap = null,
} = {}) {
  const terbitan = Array.from({ length: publikasi }, (_, i) => ({
    id: `uji-${i}`,
    judul: 'Judul uji yang cukup panjang untuk dinilai',
    media: penerbit,
    urgensi,
    sentimen,
    nama_upt: 'Lapas Uji',
    tanggal_publikasi: hariLalu(usia + Math.max(0, rentang - 1 - i)),
    tanggapan_sikap: i === 0 ? sikap : null,
  }))

  return {
    urgensi,
    sentimen,
    nama_upt: 'Lapas Uji',
    publikasi: terbitan,
    jumlah_publikasi: publikasi,
    jumlah_media: media,
    daftar_media: Array.from({ length: media }, (_, i) => `${penerbit} ${i}`),
    rentang_hari: rentang,
    kembar,
    tanggal_pertama: hariLalu(usia + rentang - 1),
    tanggal_terakhir: hariLalu(usia),
  }
}

/* ------------------------------------------------------------------ bobot */

console.log('Bobot dan bentuk')

sama('Bobot berjumlah 100', TOTAL_BOBOT, 100)
sama('Ada enam faktor', BOBOT.length, 6)

periksa('Setiap faktor punya keterangan yang bisa dibaca di layar',
  BOBOT.every((f) => f.ket && f.ket.length > 25),
  'faktor tanpa keterangan akan tampil sebagai angka tanpa arti')

periksa('Setiap tingkat risiko punya keterangan',
  TINGKAT_RISIKO.every((t) => t.ket && t.nada))

sama('Skor 87 berarti Kritis', tingkatRisiko(87).kode, 'Kritis')
sama('Skor 75 tepat di ambang Kritis', tingkatRisiko(75).kode, 'Kritis')
sama('Skor 74 masih Tinggi', tingkatRisiko(74).kode, 'Tinggi')
sama('Skor 50 tepat di ambang Tinggi', tingkatRisiko(50).kode, 'Tinggi')
sama('Skor 24 masih Sedang', tingkatRisiko(24).kode, 'Rendah')
sama('Skor 25 sudah Sedang', tingkatRisiko(25).kode, 'Sedang')
sama('Skor 0 berarti Rendah', tingkatRisiko(0).kode, 'Rendah')

/* ------------------------------------------------------------- ketertutupan */

console.log('Skor selalu bisa dijumlahkan kembali')

const contoh = [
  peristiwa(),
  peristiwa({ urgensi: 'Kritis', media: 11, publikasi: 23, rentang: 3 }),
  peristiwa({ urgensi: 'Rendah', sentimen: 'Positif', penerbit: 'Humas Lapas Uji' }),
  peristiwa({ urgensi: 'Tinggi', media: 4, publikasi: 9, rentang: 6, usia: 40 }),
  peristiwa({ urgensi: 'Tinggi', publikasi: 3, sikap: 'Sudah Ditangani' }),
]

for (const [i, p] of contoh.entries()) {
  const h = skorRisiko(p, opsi)
  periksa(`Contoh ${i + 1}: skor di dalam 0..100`,
    h.skor >= 0 && h.skor <= 100, `dapat ${h.skor}`)

  const jumlah = h.faktor.reduce((n, f) => n + f.poin, 0)
  periksa(`Contoh ${i + 1}: jumlah poin faktor sama dengan tekanannya`,
    Math.abs(jumlah - h.tekanan) <= 0.5,
    `jumlah poin ${jumlah.toFixed(1)}, tekanan ${h.tekanan}`)

  periksa(`Contoh ${i + 1}: tekanan dikali gerbang sama dengan skornya`,
    h.skor === Math.round(h.tekanan * h.gerbang.pengali),
    `tekanan ${h.tekanan} × ${h.gerbang.pengali} ≠ ${h.skor}`)

  periksa(`Contoh ${i + 1}: gerbang sentimen menjelaskan dirinya di layar`,
    Boolean(h.gerbang.ket && h.gerbang.ket.length > 25))

  periksa(`Contoh ${i + 1}: keenam faktor ikut dikembalikan`,
    h.faktor.length === 6,
    'skor yang tampil tanpa satu pun faktornya melanggar syarat pertama berkas risiko.js')

  periksa(`Contoh ${i + 1}: tiap faktor menyebutkan dasarnya`,
    h.faktor.every((f) => f.dasar && f.dasar.length > 10),
    'faktor tanpa kalimat dasar tidak bisa diperiksa analis')

  periksa(`Contoh ${i + 1}: poin tiap faktor tidak melebihi bobotnya`,
    h.faktor.every((f) => f.poin <= f.bobot + 0.05),
    'satu faktor melebihi bobotnya sendiri; nilainya tidak terjepit ke 0..1')
}

/* ------------------------------------------------------------------ urutan */

console.log('Urutan yang harus tetap masuk akal')

const kritisRamai = skorRisiko(
  peristiwa({ urgensi: 'Kritis', media: 11, publikasi: 23, rentang: 3 }), opsi)
const rendahSepi = skorRisiko(peristiwa({ urgensi: 'Rendah' }), opsi)

periksa('Kejadian kritis di banyak media mengalahkan kejadian rendah di satu media',
  kritisRamai.skor > rendahSepi.skor, `${kritisRamai.skor} vs ${rendahSepi.skor}`)

periksa('Kejadian kritis yang ramai masuk tingkat Kritis',
  kritisRamai.tingkat.kode === 'Kritis', `dapat ${kritisRamai.tingkat.kode} (${kritisRamai.skor})`)

const masihJalan = skorRisiko(
  peristiwa({ urgensi: 'Tinggi', media: 4, publikasi: 9, rentang: 4, usia: 0 }), opsi)
const sudahReda = skorRisiko(
  peristiwa({ urgensi: 'Tinggi', media: 4, publikasi: 9, rentang: 4, usia: 45 }), opsi)

periksa('Isu yang masih berlangsung mengalahkan isu serupa yang sudah reda',
  masihJalan.skor > sudahReda.skor, `${masihJalan.skor} vs ${sudahReda.skor}`)

const didiamkan = skorRisiko(peristiwa({ urgensi: 'Tinggi', publikasi: 3 }), opsi)
const ditangani = skorRisiko(
  peristiwa({ urgensi: 'Tinggi', publikasi: 3, sikap: 'Sudah Ditangani' }), opsi)

periksa('Peristiwa yang sudah ditanggapi berskor lebih rendah daripada yang didiamkan',
  ditangani.skor < didiamkan.skor, `${ditangani.skor} vs ${didiamkan.skor}`)

periksa('Selisih tanggapan tidak lebih dari bobotnya, yaitu 10 poin',
  didiamkan.skor - ditangani.skor <= 10,
  'faktor tanggapan menggeser lebih banyak daripada bobot yang tertulis')

const banyakMedia = skorRisiko(peristiwa({ media: 8, publikasi: 8, rentang: 2 }), opsi)
const satuMediaBerulang = skorRisiko(peristiwa({ media: 1, publikasi: 8, rentang: 2 }), opsi)

periksa('Delapan media berbeda mengalahkan satu media yang mengulang delapan kali',
  banyakMedia.skor > satuMediaBerulang.skor,
  `${banyakMedia.skor} vs ${satuMediaBerulang.skor}`)

/* ------------------------------------------------- sentimen bukan risiko */

console.log('Sentimen bukan risiko')

const positifRamai = skorRisiko(
  peristiwa({ urgensi: 'Sedang', sentimen: 'Positif', media: 9, publikasi: 14, rentang: 2 }), opsi)
const negatifSepi = skorRisiko(
  peristiwa({ urgensi: 'Sedang', sentimen: 'Negatif', media: 1, publikasi: 1 }), opsi)

periksa('Kegiatan positif yang ramai tidak pernah menjadi tingkat Tinggi',
  positifRamai.tingkat.kode === 'Rendah' || positifRamai.tingkat.kode === 'Sedang',
  `dapat ${positifRamai.tingkat.kode} (${positifRamai.skor})`)

/* Inilah kekeliruan yang tertangkap uji ini pada versi pertama risiko.js:
   tekanan pemberitaannya memang besar — sembilan media, empat belas terbitan —
   dan itu benar. Yang keliru adalah membaca tekanan itu sebagai risiko. Kedua
   angka harus tetap terpisah dan tetap terbaca. */
periksa('Tekanan pemberitaan peristiwa positif tetap dihitung besar',
  positifRamai.tekanan > 50, `tekanan ${positifRamai.tekanan}`)
periksa('Tetapi skor risikonya kecil',
  positifRamai.skor < 15, `skor ${positifRamai.skor}`)

periksa('Peristiwa positif menyertakan catatan supaya skornya tidak disalahpakai',
  positifRamai.catatan.some((c) => c.includes('positif')))

const belumDinilai = skorRisiko(
  peristiwa({ urgensi: 'Tinggi', sentimen: null, media: 4, publikasi: 6, rentang: 2 }), opsi)

periksa('Berita yang belum dinilai sentimennya tidak ikut ditekan sampai hilang',
  belumDinilai.skor > positifRamai.skor,
  `belum dinilai ${belumDinilai.skor} vs positif ${positifRamai.skor}`)
periksa('Berita yang belum dinilai menyertakan catatan bahwa skornya masih perkiraan',
  belumDinilai.catatan.some((c) => c.includes('belum dinilai')))

periksa('Satu berita negatif yang sendirian menyertakan catatan keterbatasannya',
  negatifSepi.catatan.some((c) => c.includes('satu terbitan')))

/* --------------------------------------------------------- berita tunggal */

console.log('Berita tunggal dan peringkat')

const sendirian = skorRisikoBerita({
  judul: 'Judul uji yang cukup panjang untuk dinilai',
  media: 'Kompas',
  urgensi: 'Tinggi',
  sentimen: 'Negatif',
  nama_upt: 'Lapas Uji',
  tanggal_publikasi: hariLalu(0),
}, null, opsi)

periksa('Berita tunggal tetap menghasilkan enam faktor', sendirian.faktor.length === 6)
periksa('Berita tunggal berskor lebih rendah daripada peristiwa besar yang sama urgensinya',
  sendirian.skor < masihJalan.skor, `${sendirian.skor} vs ${masihJalan.skor}`)

const peringkat = peringkatRisiko([
  peristiwa({ urgensi: 'Rendah' }),
  peristiwa({ urgensi: 'Kritis', media: 11, publikasi: 23, rentang: 3 }),
  peristiwa({ urgensi: 'Sedang', sentimen: 'Positif', media: 9, publikasi: 14 }),
], opsi)

sama('Peristiwa positif dibuang dari peringkat perhatian', peringkat.length, 2)
periksa('Peringkat berurut menurun', peringkat[0].skor >= peringkat[1].skor)

/* ------------------------------------------------------------------ tutup */

console.log()
console.log(`${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
