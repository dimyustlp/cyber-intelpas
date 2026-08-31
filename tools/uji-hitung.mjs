/**
 * Uji ember sentimen dan penghitungan angka.
 *
 * Yang diuji di sini bukan kebenaran mesin klasifikasi, melainkan kebenaran
 * *penjumlahan* — hal yang membuat dasbor dan kanal pernah menyebut dua angka
 * berbeda untuk satu pertanyaan yang sama. Karena itu berkas ini menuntut satu
 * hal di atas segalanya: apa pun isi arsipnya, negatif + netral + positif +
 * belum dinilai harus persis sama dengan totalnya. Selisih satu baris pun
 * berarti ada golongan yang jatuh ke dua tempat, atau ke luar semuanya.
 *
 * Dijalankan tanpa peramban: node tools/uji-hitung.mjs
 */

import { EMBER, BELUM, ember, nilaiSimpan, hitungEmber } from '../web/js/lib/sentimen.js'
import { ringkasan, lencana, menungguTelaah, dasar } from '../web/js/lib/hitung.js'

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

/* ------------------------------------------------------------------ ember */

console.log('Ember sentimen')

sama('Negatif jatuh ke ember negatif', ember({ sentimen: 'Negatif' }), 'negatif')
sama('Positif jatuh ke ember positif', ember({ sentimen: 'Positif' }), 'positif')
sama('Netral jatuh ke ember netral', ember({ sentimen: 'Netral' }), 'netral')
sama('Campuran satu ember dengan Netral', ember({ sentimen: 'Campuran' }), 'netral')
sama('Tidak diketahui berdiri sendiri', ember({ sentimen: 'Tidak diketahui' }), 'belum')
sama('Sentimen kosong berarti belum dinilai', ember({ sentimen: null }), 'belum')
sama('Menerima nilai mentah, bukan hanya berita', ember('Negatif'), 'negatif')
sama('Huruf besar-kecil tidak menentukan', ember('negatif'), 'negatif')

// Inilah aturan yang dulu berbeda di tiap halaman, dan alasan berkas sentimen
// ada sama sekali. Bila baris di bawah ini suatu hari gagal, angka dasbor dan
// angka kanal sedang berpisah lagi.
periksa('Campuran bukan bagian kanal negatif', ember({ sentimen: 'Campuran' }) !== 'negatif')

console.log('Nilai yang disimpan')

sama('Memilih negatif menyimpan Negatif', nilaiSimpan('negatif', 'Positif'), 'Negatif')
sama('Memilih netral pada berita netral tetap Netral', nilaiSimpan('netral', 'Netral'), 'Netral')
sama('Memilih netral pada berita campuran mempertahankan Campuran',
  nilaiSimpan('netral', 'Campuran'), 'Campuran')
sama('Memilih netral pada berita negatif menulis Netral',
  nilaiSimpan('netral', 'Negatif'), 'Netral')
sama('Memilih positif menyimpan Positif', nilaiSimpan('positif', 'Campuran'), 'Positif')

periksa('Ketiga ember punya keterangan',
  EMBER.every((e) => e.keterangan && e.keterangan.length > 40),
  'setiap ember wajib menjelaskan dirinya di layar')
periksa('Ember belum-dinilai juga berketerangan', Boolean(BELUM.keterangan))

/* --------------------------------------------------------------- himpunan */

console.log('Himpunan dasar dan penjumlahan')

const arsip = [
  { id: 1, kategori: 'Keamanan', sentimen: 'Negatif', urgensi: 'Kritis', status_verifikasi: 'Belum Ditelaah', nama_upt: 'Lapas A', created_at: hariIni() },
  { id: 2, kategori: 'Keamanan', sentimen: 'Campuran', urgensi: 'Tinggi', status_verifikasi: 'Terverifikasi', nama_upt: 'Lapas A', created_at: hariIni() },
  { id: 3, kategori: 'Pembinaan', sentimen: 'Positif', urgensi: 'Rendah', status_verifikasi: 'Terverifikasi', nama_upt: 'Lapas B', created_at: kemarin() },
  { id: 4, kategori: 'Pembinaan', sentimen: 'Netral', urgensi: 'Sedang', status_verifikasi: 'Perlu Koreksi', nama_upt: 'Belum Teridentifikasi', created_at: kemarin() },
  { id: 5, kategori: 'Pembinaan', sentimen: 'Tidak diketahui', urgensi: 'Rendah', status_verifikasi: null, nama_upt: '', created_at: hariIni() },
  // Dua baris berikut sengaja tidak boleh menjadi angka apa pun.
  { id: 6, kategori: 'Di Luar Lingkup', sentimen: 'Negatif', urgensi: 'Kritis', status_verifikasi: 'Belum Ditelaah', nama_upt: 'Lapas C', created_at: hariIni() },
  { id: 7, kategori: 'Keamanan', sentimen: 'Negatif', urgensi: 'Kritis', status_verifikasi: 'Tidak Valid', nama_upt: 'Lapas C', created_at: hariIni() },
  { id: 8, kategori: 'Keamanan', sentimen: 'Negatif', urgensi: 'Tinggi', status_verifikasi: 'Diarsipkan', nama_upt: 'Lapas C', created_at: hariIni() },
]

function hariIni() { return new Date().toISOString() }
function kemarin() { return new Date(Date.now() - 86_400_000).toISOString() }

const r = ringkasan(arsip)

sama('Himpunan dasar membuang luar lingkup dan yang dikecualikan', r.total, 5)
sama('Luar lingkup dihitung terpisah', r.luarLingkup, 1)
sama('Tidak valid dan diarsipkan dihitung terpisah', r.dikecualikan, 2)
sama('Seluruh baris tetap dilaporkan apa adanya', r.seluruhBaris, 8)

sama('Negatif', r.negatif.length, 1)
sama('Netral beserta campuran', r.netral.length, 2)
sama('Positif', r.positif.length, 1)
sama('Belum dinilai', r.belumDinilai.length, 1)

// Tuntutan utama berkas ini.
sama('Penjumlahan ember sama dengan total',
  r.negatif.length + r.netral.length + r.positif.length + r.belumDinilai.length, r.total)

sama('Mendesak tidak memuat berita tidak valid', r.mendesak.length, 2)
sama('Kritis', r.kritis.length, 1)
sama('Antrean telaah memuat status kosong dan perlu koreksi', r.antrean.length, 3)
sama('Belum terpetakan', r.takTerpetakan.length, 2)
sama('Masuk hari ini', r.hariIni.length, 3)
sama('Masuk kemarin', r.kemarin.length, 2)

/* ----------------------------------------------------------------- lencana */

console.log('Lencana menu')

const l = lencana(arsip)
sama('Lencana peringatan sama dengan jumlah mendesak', l.peringatan, r.mendesak.length)
sama('Lencana telaah sama dengan panjang antrean', l.telaah, r.antrean.length)
sama('Lencana negatif sama dengan ember negatif', l.negatif, r.negatif.length)
sama('Lencana pemetaan sama dengan yang belum terpetakan', l.pemetaan, r.takTerpetakan.length)

// Kekeliruan yang dulu ada: lencana menghitung satu status, antreannya menerima
// tiga. Angka pada lencana karena itu tidak pernah cocok dengan isi halamannya.
sama('Lencana telaah dihitung dengan aturan yang sama',
  l.telaah, dasar(arsip).filter(menungguTelaah).length)

/* ------------------------------------------------------------------ akhir */

console.log('Hitungan ember pada daftar kosong')
const nol = hitungEmber([])
sama('Daftar kosong tetap mengembalikan keempat kunci',
  Object.keys(nol).sort().join(','), 'belum,negatif,netral,positif,total')

console.log('')
console.log(`${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
