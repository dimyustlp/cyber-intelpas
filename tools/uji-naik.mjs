/**
 * Uji bagan "UPT naik ke permukaan".
 *
 * Yang dijaga berkas ini: satu hitungan, tiga pemakai. Angka yang muncul pada
 * bagan di halaman Laporan Berkala, pada bagan di dalam berkas laporannya, dan
 * pada diagram batang teks di pesan Telegram harus berasal dari perhitungan
 * yang sama — sebab ketiganya dibaca orang yang sama, sering kali dalam lima
 * menit yang sama.
 *
 * Dijalankan: node tools/uji-naik.mjs
 */

import { olahLaporan, susunLaporan } from '../web/js/lib/laporan.js'
import { pesanLaporan } from '../web/js/lib/pesan-telegram.js'

const hari = (g) => new Date(Date.now() + g * 86400000).toISOString()

const snapshot = {
  periode: { mulai: '2026-08-27', selesai: '2026-09-02', hari: 7,
             pembanding_mulai: '2026-08-20', pembanding_selesai: '2026-08-26' },
  konteks: { total: 60, negatif: 9, positif: 30, netral: 21, lalu_total: 40, lalu_negatif: 5 },
  unit_lalu: { 'Lapas Kelas IIA Cilegon': 4, 'Rutan Kelas I Medan': 1 },
  publikasi: [
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `a${i}`, judul: `Kerusuhan pecah di Lapas Kelas IIA Cilegon, ${i + 1} warga binaan dievakuasi`,
      media: `Media ${i}`, platform: 'Portal Berita', link: `https://contoh/${i}`,
      tanggal: hari(-i), kategori: 'Gangguan Keamanan dan Ketertiban',
      subkategori: 'Kerusuhan dan Pemberontakan', subkategori_kode: '1.2',
      urgensi: 'Tinggi', sentimen: 'Negatif', nama_upt: 'Lapas Kelas IIA Cilegon',
      status_verifikasi: 'Terverifikasi', provinsi: 'Banten', kanwil: 'Kanwil Banten',
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      id: `b${i}`, judul: `Oknum sipir Rutan Kelas I Medan ditangkap BNN bawa sabu ${i + 1} kilogram`,
      media: `Harian ${i}`, platform: 'Portal Berita', link: `https://contoh/b${i}`,
      tanggal: hari(-i - 1), kategori: 'Peredaran Barang Terlarang',
      subkategori: 'Narkotika', subkategori_kode: '2.1',
      urgensi: 'Kritis', sentimen: 'Negatif', nama_upt: 'Rutan Kelas I Medan',
      status_verifikasi: 'Terverifikasi', provinsi: 'Sumatera Utara', kanwil: 'Kanwil Sumut',
    })),
    { id: 'c0', judul: 'Keluhan kualitas makanan di Lapas Kelas IIB Sorong yang overkapasitas',
      media: 'Papua Pos', platform: 'Portal Berita', link: 'https://contoh/c',
      tanggal: hari(-2), kategori: 'Pelayanan dan Hak Warga Binaan',
      subkategori: 'Pelayanan Dasar', subkategori_kode: '3.1',
      urgensi: 'Sedang', sentimen: 'Negatif', nama_upt: 'Lapas Kelas IIB Sorong',
      status_verifikasi: 'Belum Ditelaah', provinsi: 'Papua Barat Daya', kanwil: 'Kanwil Papua Barat' },
  ],
  dibuat_pada: new Date().toISOString(),
}

const olahan = olahLaporan(snapshot)

console.log('--- uptNaik ---')
for (const u of olahan.uptNaik) {
  console.log(` ${u.nama.padEnd(30)} kini=${u.publikasi} lalu=${u.sebelum} delta=${u.delta}`)
}

const html = susunLaporan(snapshot, { jenis: 'mingguan', urutan: 1, nomor: 'UJI/1' })
const adaBagan = html.includes('class="naik"')
const adaGaya = html.includes('.naik-lacak')
const adaLalu = html.includes('naik-lalu')
console.log('\n--- berkas laporan ---')
console.log(' bagan ada :', adaBagan)
console.log(' gaya ada  :', adaGaya)
console.log(' bayangan  :', adaLalu)
console.log(' panjang   :', html.length)

console.log('\n--- pesan Telegram ---')
console.log(pesanLaporan(olahan, { jenis: 'mingguan', nomor: 'UJI/1' }))

if (!adaBagan || !adaGaya || !adaLalu) { console.error('\nGAGAL: bagan tidak lengkap'); process.exit(1) }
