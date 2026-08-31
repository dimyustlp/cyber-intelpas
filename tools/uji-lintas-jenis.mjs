/**
 * Uji pencocokan lintas jenis dan penyebutan lewat wilayah.
 *
 * Dijalankan dengan: node tools/uji-lintas-jenis.mjs
 *
 * Seluruh kasus di bawah diambil dari judul yang benar-benar masuk ke tabel
 * `berita` dan gagal dipetakan — bukan kalimat karangan. Setengahnya adalah
 * kasus yang HARUS tetap ditolak; tanpa bagian itu, berkas ini hanya akan
 * membuktikan bahwa mesinnya menjadi lebih longgar, bukan lebih benar.
 */

import { readFileSync } from 'node:fs'
import { bangunIndeks, cocokkanUpt } from '../web/js/lib/pencocokan-upt.js'

const JALUR_UPT = process.env.JALUR_UPT
  || './data/master-upt.csv'

function baraiCsv(teks) {
  const baris = []
  let sel = []
  let nilai = ''
  let kutip = false
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i]
    if (kutip) {
      if (c === '"') {
        if (teks[i + 1] === '"') { nilai += '"'; i++ } else kutip = false
      } else nilai += c
      continue
    }
    if (c === '"') kutip = true
    else if (c === ',') { sel.push(nilai); nilai = '' }
    else if (c === '\n') { sel.push(nilai.replace(/\r$/, '')); baris.push(sel); sel = []; nilai = '' }
    else nilai += c
  }
  if (nilai || sel.length) { sel.push(nilai.replace(/\r$/, '')); baris.push(sel) }
  return baris.filter((b) => b.some((v) => String(v).trim() !== ''))
}

const teks = readFileSync(JALUR_UPT, 'utf8').replace(/^﻿/, '')
const baris = baraiCsv(teks)
const kepala = baris[0].map((h) => h.trim())
const daftar = baris.slice(1).map((b) => Object.fromEntries(kepala.map((h, i) => [h, b[i] ?? ''])))
const indeks = bangunIndeks(daftar)

/** [judul, nama UPT yang diharapkan atau null, keterangan] */
const KASUS = [
  // --- Harus dikenali lewat jalur baru -------------------------------------
  ['Kabur dari Lapas Sukadana Lampung, Bayu Wicaksono, Buronan Narkoba Ditangkap di Myanmar',
    'Rutan Kelas IIB Sukadana', 'Lapas disebut untuk sebuah Rutan, nama tempatnya tunggal'],
  ['Napi Kasus Narkoba yang Kabur dari Rutan Lampung Timur Sejak 2024 Ditangkap di Myanmar',
    'Rutan Kelas IIB Sukadana', 'Disebut lewat nama kabupaten, bukan nama unit'],
  ['Dikendalikan Napi Lapas Bengkayang, BNNP Kaltim Tangkap Dua Kurir 1 Kg Sabu Asal Malaysia',
    'Rutan Kelas IIB Bengkayang', 'Lapas disebut untuk sebuah Rutan, nama tempatnya tunggal'],

  // --- Harus TETAP ditolak --------------------------------------------------
  ['Semarak HUT Ke-81 RI, Lapas-Rutan Kotaagung Gelar Donor Darah',
    null, 'Kota Agung punya Lapas dan Rutan sekaligus — harus diserahkan ke analis'],
  ['Tingkatkan Kepedulian dan Kesehatan, Bapas Palembang Ikuti Kegiatan Donor Darah',
    null, 'Bapas bukan Lapas; tidak boleh dipetakan ke unit lain yang sekota'],
  ['Bapas Kelas I Balikpapan mengunjungi Kantor Kecamatan Balikpapan Selatan',
    null, 'Bapas bukan Lapas; tidak boleh dipetakan ke unit lain yang sekota'],
  ['Sepekan di Rutan KPK, Kejagung Terus Dalami Kasus Febrie Adriansyah',
    null, 'Rutan milik lembaga lain'],
  ['Kabur dari Lapas Lampung, Buron Narkoba Ditangkap Bareskrim di Myanmar',
    null, 'Hanya nama provinsi — terlalu kasar untuk menunjuk satu unit'],
  ['Kerusuhan di Lapas Ekuador, Petugas Keamanan Dipukul Mundur Narapidana',
    null, 'Lapas di luar negeri'],
  ['Warga Semarang menggelar pasar murah di alun-alun kota',
    null, 'Tidak ada penyebutan unit sama sekali'],
]

let lulus = 0
const gagal = []

console.log('\n' + '─'.repeat(78))
console.log('UJI PENCOCOKAN LINTAS JENIS DAN WILAYAH')
console.log('─'.repeat(78))
console.log(`Data induk: ${indeks.jumlah} unit\n`)

for (const [judul, diharapkan, keterangan] of KASUS) {
  const hasil = cocokkanUpt(judul, indeks)
  const didapat = hasil.nama
  const cocok = didapat === diharapkan
  if (cocok) lulus += 1
  else gagal.push({ judul, diharapkan, didapat })

  console.log(`  ${cocok ? 'LULUS  ' : 'GAGAL  '} ${judul.slice(0, 66)}`)
  console.log(`          ${keterangan}`)
  console.log(`          diharapkan ${diharapkan ?? '(tidak ada)'} · didapat ${didapat ?? '(tidak ada)'}`
    + `${didapat ? ` [${Math.round(hasil.skor * 100)}%, ${hasil.metode}]` : ''}`)
}

console.log(`\n  Hasil: ${lulus} dari ${KASUS.length} kasus uji lulus.\n`)
if (gagal.length) {
  console.log('─'.repeat(78))
  console.log('ADA KASUS YANG GAGAL.')
  console.log('─'.repeat(78))
  process.exit(1)
}
console.log('─'.repeat(78))
console.log('SELURUH KASUS LULUS.')
console.log('─'.repeat(78))
