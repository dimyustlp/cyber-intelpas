/**
 * Menyusun garis pantai Indonesia menjadi satu modul JavaScript.
 *
 * Peta Sebaran menggambar 531 titik unit, dan titik saja tidak cukup: sebaran
 * yang mengambang tanpa daratan menuntut pembacanya menghafal bentuk kepulauan
 * lebih dulu. Yang dibutuhkan hanyalah garis pantainya — bukan jalan, bukan
 * nama tempat, bukan citra satelit.
 *
 * Karena itu petanya tidak ditarik dari peladen ubin mana pun. Aturan proyek
 * ini melarang kode dan aset pihak ketiga diambil saat halaman dibuka, dan
 * larangan itu bukan formalitas: peta yang bergantung pada peladen luar akan
 * kosong di jaringan kantor yang memblokirnya, dan kosongnya persis pada saat
 * seseorang sedang mencari sebuah unit.
 *
 * Sumbernya Natural Earth (skala 1:50 juta), berkas
 * `ne_50m_admin_0_countries.geojson`. Natural Earth berada dalam domain publik
 * dan boleh dipakai tanpa syarat — termasuk tanpa atribusi, meskipun modul
 * hasilnya tetap menyebutkannya.
 *
 * Jalankan:
 *   node tools/susun-peta.mjs <jalur-geojson> [toleransi]
 *
 * Toleransi dalam derajat. Bawaannya 0,03° (≈3,3 km) — cukup untuk peta
 * senegara, dan memangkas 3.717 titik menjadi sekitar seperempatnya.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const AKAR = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const jalur = process.argv[2]
const TOLERANSI = Number(process.argv[3] || 0.03)

if (!jalur) {
  console.error('Sebutkan jalur berkas GeoJSON Natural Earth sebagai argumen pertama.')
  process.exit(1)
}

/** Negara tetangga yang ikut digambar samar. */
const TETANGGA = ['MYS', 'BRN', 'PNG', 'TLS', 'SGP']

/*
   Pulau yang lebih kecil daripada ambang ini dibuang.

   Indonesia punya belasan ribu pulau, dan sebagian besar di antaranya lebih
   kecil daripada satu piksel pada peta senegara. Menggambarnya menambah puluhan
   kilobita untuk sesuatu yang tidak pernah terlihat — dan yang terlihat justru
   berupa noda abu-abu di tengah laut.

   Ambangnya luas kotak pembatas dalam derajat persegi: 0,02 ≈ pulau berukuran
   15 × 15 km.
*/
const AMBANG_PULAU = 0.02

/** Jarak tegak lurus sebuah titik dari garis penghubung dua titik lain. */
function jarakKeGaris([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const panjang = dx * dx + dy * dy
  if (!panjang) return Math.hypot(x - x1, y - y1)
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / panjang))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

/**
 * Penyederhanaan Douglas–Peucker.
 *
 * Dipilih daripada sekadar membuang tiap titik kedua karena ia mempertahankan
 * bentuk: tanjung dan teluk yang menentukan pengenalan sebuah pulau tetap ada,
 * sedangkan puluhan titik pada garis pantai yang nyaris lurus hilang.
 */
function sederhanakan(titik, toleransi) {
  if (titik.length < 3) return titik

  let terjauh = 0
  let indeks = 0
  for (let i = 1; i < titik.length - 1; i++) {
    const d = jarakKeGaris(titik[i], titik[0], titik[titik.length - 1])
    if (d > terjauh) { terjauh = d; indeks = i }
  }

  if (terjauh <= toleransi) return [titik[0], titik[titik.length - 1]]

  return [
    ...sederhanakan(titik.slice(0, indeks + 1), toleransi).slice(0, -1),
    ...sederhanakan(titik.slice(indeks), toleransi),
  ]
}

function cincinDari(geometri) {
  if (geometri.type === 'Polygon') return [geometri.coordinates[0]]
  if (geometri.type === 'MultiPolygon') return geometri.coordinates.map((p) => p[0])
  return []
}

function kotak(cincin) {
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity
  for (const [x, y] of cincin) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, maxX, minY, maxY, luas: (maxX - minX) * (maxY - minY) }
}

/** Satu cincin menjadi satu jalur SVG dalam satuan derajat, dibulatkan 2 angka. */
function jalurSvg(cincin) {
  const bulat = (n) => Number(n.toFixed(2))
  const bagian = cincin.map(([x, y], i) => `${i ? 'L' : 'M'}${bulat(x)} ${bulat(y)}`)
  return `${bagian.join('')}Z`
}

function olah(fitur, toleransi) {
  const hasil = []
  for (const cincin of cincinDari(fitur.geometry)) {
    const k = kotak(cincin)
    if (k.luas < AMBANG_PULAU) continue
    const ringkas = sederhanakan(cincin, toleransi)
    // Sebuah cincin yang tersisa dua titik bukan pulau lagi, melainkan garis.
    if (ringkas.length < 4) continue
    hasil.push(jalurSvg(ringkas))
  }
  return hasil
}

/* ------------------------------------------------------------------ jalan */

const geo = JSON.parse(readFileSync(jalur, 'utf8'))
const kode = (f) => f.properties.ADM0_A3 || f.properties.ISO_A3 || f.properties.iso_a3

const indonesia = geo.features.find((f) => kode(f) === 'IDN')
if (!indonesia) {
  console.error('Fitur Indonesia (IDN) tidak ditemukan di dalam berkas itu.')
  process.exit(1)
}

const jalurIndonesia = olah(indonesia, TOLERANSI)

// Tetangga disederhanakan lebih kasar. Mereka hanya perlu menjelaskan mengapa
// Kalimantan dan Papua terpotong di tepi, bukan untuk dibaca bentuknya.
const jalurTetangga = geo.features
  .filter((f) => TETANGGA.includes(kode(f)))
  .flatMap((f) => olah(f, TOLERANSI * 2.5))

const semuaTitik = jalurIndonesia.join('').match(/-?\d+\.?\d*/g).map(Number)
const lon = semuaTitik.filter((_, i) => i % 2 === 0)
const lat = semuaTitik.filter((_, i) => i % 2 === 1)

const batas = {
  minLon: Math.floor(Math.min(...lon) * 10) / 10,
  maxLon: Math.ceil(Math.max(...lon) * 10) / 10,
  minLat: Math.floor(Math.min(...lat) * 10) / 10,
  maxLat: Math.ceil(Math.max(...lat) * 10) / 10,
}

const isi = `/**
 * Garis pantai Indonesia, sebagai jalur SVG dalam satuan derajat.
 *
 * DIHASILKAN OLEH tools/susun-peta.mjs — jangan disunting tangan. Menyunting
 * berkas ini berarti perubahannya hilang pada penyusunan berikutnya, dan tidak
 * ada satu pun yang memberi tahu bahwa itu terjadi.
 *
 * Sumber: Natural Earth 1:50 juta (ne_50m_admin_0_countries), domain publik.
 * Toleransi penyederhanaan ${TOLERANSI}° (≈${(TOLERANSI * 111).toFixed(1)} km);
 * pulau yang kotak pembatasnya lebih kecil dari ${AMBANG_PULAU}° persegi dibuang.
 *
 * Koordinatnya bujur dan lintang apa adanya, bukan piksel. Yang memproyeksikan
 * adalah halaman petanya, dengan proyeksi silindris sederhana: bujur menjadi X,
 * lintang menjadi Y yang dibalik arahnya. Untuk kepulauan yang membentang di
 * khatulistiwa, kesalahan proyeksi itu di bawah setengah persen — jauh lebih
 * kecil daripada ketidakpastian koordinat unitnya sendiri, yang sebagian besar
 * masih berupa titik pusat kota.
 */

/** Kotak pembatas daratan Indonesia, dalam derajat. */
export const BATAS = ${JSON.stringify(batas)}

/** ${jalurIndonesia.length} pulau Indonesia yang cukup besar untuk terlihat. */
export const DARATAN = [
${jalurIndonesia.map((d) => `  '${d}',`).join('\n')}
]

/**
 * Daratan negara tetangga, digambar samar.
 *
 * Tanpa mereka, Kalimantan dan Papua terpotong lurus di perbatasan darat dan
 * terbaca sebagai kesalahan gambar, bukan sebagai batas negara.
 */
export const TETANGGA = [
${jalurTetangga.map((d) => `  '${d}',`).join('\n')}
]
`

const keluaran = join(AKAR, 'web', 'js', 'lib', 'peta-indonesia.js')
writeFileSync(keluaran, isi)

console.log(`Indonesia : ${jalurIndonesia.length} pulau`)
console.log(`Tetangga  : ${jalurTetangga.length} daratan`)
console.log(`Batas     : ${batas.minLon}–${batas.maxLon}° BT, ${batas.minLat}–${batas.maxLat}° LU`)
console.log(`Ukuran    : ${(isi.length / 1024).toFixed(1)} KiB → web/js/lib/peta-indonesia.js`)

/* ---------------------------------------------------- titik unit peragaan */

/*
   Potret koordinat unit untuk mode peragaan saja.

   Mode peragaan tidak punya peladen, jadi ia tidak bisa menanyakan tabel `upt`
   — dan peta tanpa satu titik pun tidak bisa diperiksa bentuknya oleh siapa
   pun. Yang berlaku sebagai kebenaran tetap tabel di basis data; berkas ini
   potret, sama seperti data/master-upt.csv yang menjadi sumbernya, dan halaman
   petanya hanya memuatnya ketika mode peragaan aktif — pada penggelaran
   sungguhan berkas ini tidak pernah diminta peramban.
*/

function baris(teks) {
  // Pemisah sederhana yang menghormati tanda kutip ganda. Alamat unit memuat
  // koma, dan pemisah yang tidak menghormatinya menggeser seluruh kolom.
  const hasil = []
  let sel = ''
  let dalamKutip = false
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i]
    if (c === '"') {
      if (dalamKutip && teks[i + 1] === '"') { sel += '"'; i++ } else dalamKutip = !dalamKutip
    } else if (c === ',' && !dalamKutip) { hasil.push(sel); sel = '' } else sel += c
  }
  hasil.push(sel)
  return hasil
}

const csv = readFileSync(join(AKAR, 'data', 'master-upt.csv'), 'utf8').replace(/^﻿/, '')
const garis = csv.split(/\r?\n/).filter(Boolean)
const kepala = baris(garis[0])
const kolom = (nama) => kepala.indexOf(nama)

const iNama = kolom('nama_upt')
const iJenis = kolom('jenis_upt')
const iKanwil = kolom('kanwil')
const iProv = kolom('provinsi')
const iLat = kolom('latitude')
const iLon = kolom('longitude')

const unit = garis.slice(1)
  .map(baris)
  .filter((b) => b[iLat] && b[iLon])
  .map((b) => [
    b[iNama],
    b[iJenis],
    b[iKanwil],
    b[iProv],
    Number(Number(b[iLat]).toFixed(4)),
    Number(Number(b[iLon]).toFixed(4)),
  ])

const isiUnit = `/**
 * Potret koordinat unit untuk MODE PERAGAAN SAJA.
 *
 * DIHASILKAN OLEH tools/susun-peta.mjs dari data/master-upt.csv — jangan
 * disunting tangan.
 *
 * Yang berlaku sebagai kebenaran adalah tabel \`upt\` di basis data; Peta
 * Sebaran menanyakannya ke sana pada penggelaran sungguhan, dan hanya memuat
 * berkas ini ketika mode peragaan aktif. Karena pemuatannya dinamis, peramban
 * petugas tidak pernah mengunduhnya.
 *
 * Bentuk tiap baris: [nama, jenis, kanwil, provinsi, lintang, bujur].
 * Bukan objek, karena ${unit.length} objek dengan enam nama kunci yang diulang
 * memperbesar berkas ini lebih dari dua kali lipat tanpa menambah satu pun
 * keterangan.
 */

export const UNIT_CONTOH = [
${unit.map((u) => `  ${JSON.stringify(u)},`).join('\n')}
]
`

const keluaranUnit = join(AKAR, 'web', 'js', 'lib', 'peta-upt-contoh.js')
writeFileSync(keluaranUnit, isiUnit)

console.log(`Titik unit: ${unit.length} unit berkoordinat`)
console.log(`Ukuran    : ${(isiUnit.length / 1024).toFixed(1)} KiB → web/js/lib/peta-upt-contoh.js`)
