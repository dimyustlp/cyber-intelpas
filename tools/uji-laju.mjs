/**
 * Uji aturan peringatan berbasis laju.
 *
 * Yang diuji: keempat aturan menyala ketika seharusnya menyala, dan — yang
 * jauh lebih penting — DIAM ketika seharusnya diam. Peringatan yang menyala
 * terlalu sering berhenti dibaca pada minggu kedua, dan sejak saat itu ia
 * lebih buruk daripada tidak ada sama sekali.
 *
 * Dijalankan tanpa peramban: node tools/uji-laju.mjs
 */

import { periksaLaju, rekapLaju, ATUR, ATURAN } from '../web/js/lib/peringatan-laju.js'

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

const SEKARANG = new Date('2026-09-03T12:00:00+07:00')
const opsi = { sekarang: SEKARANG }
const JAM = 3_600_000

function jamLalu(n) {
  return new Date(SEKARANG.getTime() - n * JAM).toISOString()
}

let nomor = 0

/** Satu baris berita uji. */
function berita({
  judul = 'Kejadian di unit uji yang judulnya cukup panjang',
  upt = 'Lapas Uji', sub = '1.1', kategori = 'Gangguan Keamanan dan Ketertiban',
  sentimen = 'Negatif', urgensi = 'Sedang', media = 'Kompas', jam = 1, sikap = null,
} = {}) {
  nomor += 1
  return {
    id: `uji-${nomor}`,
    judul,
    nama_upt: upt,
    subkategori_kode: sub,
    subkategori: `Sub ${sub}`,
    kategori,
    sentimen,
    urgensi,
    media,
    created_at: jamLalu(jam),
    tanggal_publikasi: jamLalu(jam),
    status_verifikasi: 'Terverifikasi',
    tanggapan_sikap: sikap,
  }
}

/* ------------------------------------------------------------------ bentuk */

console.log('Bentuk dan penyetel')

periksa('Setiap aturan punya nama dan keterangan yang bisa dibaca di layar',
  Object.values(ATURAN).every((a) => a.nama && a.ket && a.ket.length > 30),
  'peringatan yang tidak menjelaskan dirinya akan diabaikan pada minggu kedua')

sama('Kelipatan lonjakan berarti naik lebih dari 100%', ATUR.lonjakanKelipatan, 2)
sama('Arsip kosong tidak menghasilkan peringatan', periksaLaju([], opsi).length, 0)

/* ---------------------------------------------------------------- lonjakan */

console.log('Aturan 1 — lonjakan')

/* Empat terbitan negatif dalam 24 jam, satu pada 24 jam sebelumnya.
   Judulnya sengaja berbeda-beda supaya keempatnya TIDAK menyatu menjadi satu
   peristiwa — yang diuji di sini laju terbitan per unit, bukan peristiwa. */
const melonjak = [
  berita({ judul: 'Pelarian warga binaan dari blok timur unit uji', jam: 2 }),
  berita({ judul: 'Penemuan telepon genggam di kamar hunian unit uji', sub: '2.1', jam: 5 }),
  berita({ judul: 'Perkelahian antarwarga binaan di lapangan unit uji', sub: '1.3', jam: 9 }),
  berita({ judul: 'Keluhan mutu makanan warga binaan di unit uji', sub: '4.2', jam: 20 }),
  berita({ judul: 'Kunjungan keluarga tertunda akibat sistem antrean unit uji', sub: '4.1', jam: 30 }),
]

const hasilLonjak = periksaLaju(melonjak, opsi).filter((a) => a.kode === 'lonjakan')
sama('Lonjakan terdeteksi', hasilLonjak.length, 1)
periksa('Lonjakan menyebut angka pemicunya',
  hasilLonjak[0] && /\d+%/.test(hasilLonjak[0].sebab), hasilLonjak[0]?.sebab)
sama('Empat terbitan masih tingkat Tinggi', hasilLonjak[0]?.tingkat, 'Tinggi')

/* Kenaikan dari nol tidak bisa dinyatakan sebagai persentase, dan kalimatnya
   harus mengatakannya alih-alih menulis "Infinity%" atau "NaN%". */
const dariNol = periksaLaju([
  berita({ judul: 'Pelarian warga binaan dari blok timur unit uji', jam: 2 }),
  berita({ judul: 'Penemuan telepon genggam di kamar hunian unit uji', sub: '2.1', jam: 4 }),
  berita({ judul: 'Perkelahian antarwarga binaan di lapangan unit uji', sub: '1.3', jam: 6 }),
], opsi).filter((a) => a.kode === 'lonjakan')

sama('Lonjakan dari nol tetap terdeteksi', dariNol.length, 1)
periksa('Lonjakan dari nol tidak menuliskan angka persen yang tak terhingga',
  dariNol[0] && !/(Infinity|NaN)/.test(dariNol[0].sebab), dariNol[0]?.sebab)

/* Dua terbitan tidak cukup. Ambang ini yang menjaga daftar tetap layak dibaca. */
sama('Dua terbitan negatif belum disebut lonjakan',
  periksaLaju([
    berita({ judul: 'Pelarian warga binaan dari blok timur unit uji', jam: 2 }),
    berita({ judul: 'Penemuan telepon genggam di kamar hunian unit uji', sub: '2.1', jam: 4 }),
  ], opsi).filter((a) => a.kode === 'lonjakan').length, 0)

/* Unit yang belum terpetakan dilewati: peringatan yang tidak bisa ditunjuk
   unitnya tidak bisa ditindaklanjuti kepada siapa pun. */
sama('Berita tanpa unit terpetakan tidak memicu lonjakan',
  periksaLaju([
    berita({ judul: 'Pelarian warga binaan dari sebuah lapas', upt: 'Belum Teridentifikasi', jam: 2 }),
    berita({ judul: 'Penemuan telepon genggam di sebuah rutan', upt: 'Belum Teridentifikasi', sub: '2.1', jam: 4 }),
    berita({ judul: 'Perkelahian antarwarga binaan di sebuah lapas', upt: 'Belum Teridentifikasi', sub: '1.3', jam: 6 }),
  ], opsi).filter((a) => a.kode === 'lonjakan').length, 0)

/* Pemberitaan positif tidak pernah menjadi peringatan, betapa pun ramainya. */
sama('Empat terbitan positif tidak memicu peringatan apa pun',
  periksaLaju([
    berita({ judul: 'Panen perdana program ketahanan pangan unit uji', sentimen: 'Positif', sub: '8.2', jam: 2 }),
    berita({ judul: 'Warga binaan unit uji ikuti pendidikan kesetaraan', sentimen: 'Positif', sub: '8.2', jam: 4 }),
    berita({ judul: 'Unit uji raih predikat wilayah bebas dari korupsi', sentimen: 'Positif', sub: '8.3', jam: 6 }),
    berita({ judul: 'Apel kesiapsiagaan menjelang hari pengayoman di unit uji', sentimen: 'Positif', sub: '8.1', jam: 8 }),
  ], opsi).length, 0)

/* ------------------------------------------------------------------ sumber */

console.log('Aturan 2 — menyebar ke banyak sumber')

/* Satu peristiwa, empat media berbeda. Judulnya nyaris sama supaya keempatnya
   menyatu menjadi satu peristiwa — itulah yang diuji di sini. */
const menyebar = ['Kompas', 'Tempo', 'Detik', 'Antara'].map((m, i) =>
  berita({
    judul: 'Kerusuhan pecah di unit uji, puluhan warga binaan dievakuasi',
    sub: '1.2', urgensi: 'Kritis', media: m, jam: 3 + i,
  }))

const hasilSumber = periksaLaju(menyebar, opsi).filter((a) => a.kode === 'sumber')
sama('Peristiwa yang diangkat empat media terdeteksi', hasilSumber.length, 1)
periksa('Peringatan sumber menyebut jumlah medianya',
  hasilSumber[0] && hasilSumber[0].sebab.includes('4 media'), hasilSumber[0]?.sebab)
periksa('Peringatan sumber membawa skor risikonya',
  hasilSumber[0]?.risiko?.faktor?.length === 6)

/* Satu media yang mengulang empat kali BUKAN penyebaran. Inilah pembedaan
   yang tidak bisa dilakukan penyaringan urgensi. */
const mengulang = [0, 1, 2, 3].map((i) =>
  berita({
    judul: 'Kerusuhan pecah di unit uji, puluhan warga binaan dievakuasi',
    sub: '1.2', urgensi: 'Kritis', media: 'Kompas', jam: 3 + i,
  }))

sama('Satu media yang mengulang empat kali tidak disebut menyebar',
  periksaLaju(mengulang, opsi).filter((a) => a.kode === 'sumber').length, 0)

/* -------------------------------------------------------------------- diam */

console.log('Aturan 3 — membesar tanpa tanggapan')

const hasilDiam = periksaLaju(menyebar, opsi).filter((a) => a.kode === 'diam')
periksa('Peristiwa berat tanpa tanggapan terdeteksi', hasilDiam.length === 1,
  `dapat ${hasilDiam.length}`)

/* Peristiwa yang sama, tetapi unitnya sudah bersikap. */
const sudahBersikap = menyebar.map((b, i) =>
  ({ ...b, id: `sikap-${i}`, tanggapan_sikap: i === 0 ? 'Sudah Ditangani' : null }))

sama('Peristiwa yang sudah ditanggapi tidak lagi memicu peringatan diam',
  periksaLaju(sudahBersikap, opsi).filter((a) => a.kode === 'diam').length, 0)

/* --------------------------------------------------------------- menumpuk */

console.log('Aturan 4 — penumpukan pelan')

/* Enam peristiwa berbeda di satu unit, semuanya berurgensi Sedang. Tidak satu
   pun cukup berat untuk berdiri sendiri — dan itulah intinya. */
const menumpuk = [
  ['Keluhan mutu makanan warga binaan di unit uji', '4.2'],
  ['Antrean kunjungan keluarga memanjang di unit uji', '4.1'],
  ['Dugaan pungutan pada pengurusan berkas di unit uji', '3.1'],
  ['Kamar hunian unit uji disebut melebihi kapasitas', '4.3'],
  ['Sarana air bersih di unit uji dikeluhkan warga binaan', '4.4'],
  ['Layanan kesehatan unit uji dinilai lambat oleh keluarga', '4.5'],
].map(([judul, sub], i) => berita({ judul, sub, urgensi: 'Sedang', jam: 24 * (i + 1) }))

const hasilTumpuk = periksaLaju(menumpuk, opsi).filter((a) => a.kode === 'menumpuk')
sama('Penumpukan pelan terdeteksi', hasilTumpuk.length, 1)
sama('Penumpukan pelan bertingkat Sedang, bukan Tinggi', hasilTumpuk[0]?.tingkat, 'Sedang')
periksa('Penumpukan menyebut jumlah peristiwanya',
  hasilTumpuk[0] && /\d+ peristiwa/.test(hasilTumpuk[0].judul), hasilTumpuk[0]?.judul)

/* Unit yang sudah punya peristiwa mendesak tidak dimunculkan dua kali. */
const adaMendesak = [...menumpuk,
  berita({ judul: 'Pelarian tiga warga binaan dari unit uji saat asimilasi', sub: '1.1', urgensi: 'Tinggi', jam: 5 })]

sama('Unit yang sudah punya peristiwa mendesak tidak ikut daftar penumpukan',
  periksaLaju(adaMendesak, opsi).filter((a) => a.kode === 'menumpuk').length, 0)

/* Empat peristiwa belum cukup. */
sama('Empat peristiwa belum disebut penumpukan',
  periksaLaju(menumpuk.slice(0, 4), opsi).filter((a) => a.kode === 'menumpuk').length, 0)

/* ------------------------------------------------------------------ urutan */

console.log('Urutan dan rekap')

const campur = periksaLaju([...menyebar, ...menumpuk], opsi)
periksa('Yang paling gawat berada di puncak daftar',
  campur.length > 1 && campur[0].tingkat !== 'Sedang',
  campur.map((a) => `${a.tingkat}/${a.kode}`).join(', '))

const rekap = rekapLaju(campur)
sama('Rekap menjumlahkan seluruh peringatan',
  rekap.kritis + rekap.tinggi + rekap.sedang, rekap.total)

periksa('Setiap peringatan membawa berita pendukungnya',
  campur.every((a) => Array.isArray(a.berita) && a.berita.length > 0),
  'peringatan tanpa berita pendukung tidak bisa ditelusuri')

periksa('Setiap peringatan menjelaskan sebabnya',
  campur.every((a) => a.sebab && a.sebab.length > 30))

/* ------------------------------------------------------------------ tutup */

console.log()
console.log(`${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
