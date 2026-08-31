/**
 * Uji mesin klasifikasi dan pencocokan UPT terhadap data sungguhan.
 *
 * Dijalankan dengan: node tools/uji-mesin.mjs
 *
 * Sumber data uji:
 *   - Master UPT  : data/master-upt.csv — 531 unit hasil tools/susun-master-upt.mjs
 *   - Berita      : dump Spreadsheet crawler yang menjadi sumber tabel `berita`
 *
 * Keluaran: liputan sebelum dan sesudah, plus contoh hasil untuk diperiksa mata.
 */

import { readFileSync, existsSync } from 'node:fs'
import { klasifikasikan, META_MESIN } from '../web/js/lib/klasifikasi.js'
import { bangunIndeks, cocokkanUpt, META_PENCOCOK } from '../web/js/lib/pencocokan-upt.js'

// Bawaannya menunjuk salinan yang ikut disimpan di dalam repositori, sama
// seperti tools/uji-lintas-jenis.mjs dan tools/uji-peristiwa.mjs. Berkas ini
// sempat tertinggal memakai jalur mutlak mesin lama, dan akibatnya perintah
// `node tools/uji-mesin.mjs` gagal di komputer siapa pun selain mesin itu.
const JALUR_UPT = process.env.JALUR_UPT
  || './data/master-upt.csv'
const JALUR_BERITA = process.env.JALUR_BERITA || './data-uji/berita.json'

// ---------------------------------------------------------------- pembaca CSV

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

function muatUpt() {
  const teks = readFileSync(JALUR_UPT, 'utf8').replace(/^﻿/, '')
  const baris = baraiCsv(teks)
  const kepala = baris[0].map((h) => h.trim())
  return baris.slice(1).map((b) => Object.fromEntries(kepala.map((h, i) => [h, b[i] ?? ''])))
}

/**
 * Dump berita sungguhan tidak ikut disimpan di dalam repositori — isinya data
 * operasional. Ketidakhadirannya tidak boleh menjatuhkan seluruh berkas uji:
 * uji perilaku dan uji pencocokan UPT berdiri sendiri, dan justru bagian itulah
 * yang harus tetap bisa dijalankan siapa pun, kapan pun, tanpa akses ke data.
 */
function muatBerita() {
  if (!existsSync(JALUR_BERITA)) {
    console.warn(`\nCatatan: dump berita tidak ada di ${JALUR_BERITA}.`)
    console.warn('Bagian liputan dilewati; uji perilaku dan pencocokan UPT tetap dijalankan.\n')
    return []
  }
  return JSON.parse(readFileSync(JALUR_BERITA, 'utf8'))
}

// ------------------------------------------------------------------- laporan

function bar(nilai, total, lebar = 34) {
  const n = total ? Math.round((nilai / total) * lebar) : 0
  return '█'.repeat(n) + '·'.repeat(lebar - n)
}

function persen(nilai, total) {
  return total ? `${((nilai / total) * 100).toFixed(1)}%` : '0%'
}

function judul(teks) {
  console.log('\n' + '─'.repeat(78))
  console.log(teks)
  console.log('─'.repeat(78))
}

// ---------------------------------------------------------------------- main

const upt = muatUpt()
const berita = muatBerita()
const indeks = bangunIndeks(upt)

console.log(`Master UPT      : ${upt.length} unit, ${indeks.jumlah} terindeks`)
console.log(`Berita uji      : ${berita.length}`)
console.log(`Mesin klasifikasi: ${META_MESIN.versi} (${META_MESIN.jumlahSubkategori} subkategori, ambang ${META_MESIN.ambang})`)
console.log(`Mesin pencocok  : ${META_PENCOCOK.versi} (ambang otomatis ${META_PENCOCOK.ambangOtomatis})`)

// --- 1. Pencocokan UPT -------------------------------------------------------

let uptOtomatis = 0
let uptSaran = 0
let uptGagal = 0
let uptBersaing = 0
const contohCocok = []
const contohGagal = []

const t0 = Date.now()
for (const b of berita) {
  const teks = [b.judul, b.ringkasan, b.raw_analysis, b.media].filter(Boolean).join(' . ')
  const hasil = cocokkanUpt(teks, indeks)

  if (hasil.otomatis) {
    uptOtomatis++
    if (contohCocok.length < 8) contohCocok.push({ judul: b.judul, hasil })
  } else if (hasil.saran.length) {
    uptSaran++
    if (hasil.bersaing) uptBersaing++
  } else {
    uptGagal++
    if (contohGagal.length < 6) contohGagal.push({ judul: b.judul, alasan: hasil.alasan })
  }
}
const durasiUpt = Date.now() - t0

judul('1. PENCOCOKAN UPT')
console.log(`Terpetakan otomatis   ${bar(uptOtomatis, berita.length)} ${uptOtomatis.toString().padStart(4)}  ${persen(uptOtomatis, berita.length)}`)
console.log(`Perlu putusan analis  ${bar(uptSaran, berita.length)} ${uptSaran.toString().padStart(4)}  ${persen(uptSaran, berita.length)}   (${uptBersaing} karena nama bersaing)`)
console.log(`Tidak menyebut UPT    ${bar(uptGagal, berita.length)} ${uptGagal.toString().padStart(4)}  ${persen(uptGagal, berita.length)}`)
console.log(`\nWaktu: ${durasiUpt} ms untuk ${berita.length} berita (${(durasiUpt / berita.length).toFixed(2)} ms per berita)`)
console.log(`\nPembanding — sistem lama: 410 dari 646 berita tidak terpetakan (63,5%).`)

console.log('\nContoh yang berhasil dipetakan:')
for (const c of contohCocok) {
  console.log(`  · ${c.hasil.nama}  [${(c.hasil.skor * 100).toFixed(0)}%, ${c.hasil.metode}]`)
  console.log(`    ${String(c.judul).slice(0, 96)}`)
}

console.log('\nContoh yang memang tidak menyebut UPT mana pun:')
for (const c of contohGagal) {
  console.log(`  · ${String(c.judul).slice(0, 90)}`)
  console.log(`    → ${c.alasan}`)
}

// --- 2. Klasifikasi ----------------------------------------------------------

const perKategori = new Map()
const perUrgensi = new Map()
const perSentimen = new Map()
let terklasifikasi = 0
let keyakinanTotal = 0
const contohKlas = []

const t1 = Date.now()
for (const b of berita) {
  const h = klasifikasikan(b)
  perKategori.set(h.kategori, (perKategori.get(h.kategori) || 0) + 1)
  perUrgensi.set(h.urgensi, (perUrgensi.get(h.urgensi) || 0) + 1)
  perSentimen.set(h.sentimen, (perSentimen.get(h.sentimen) || 0) + 1)
  if (h.kategori_kode !== '0') {
    terklasifikasi++
    keyakinanTotal += h.ai_confidence
    if (contohKlas.length < 10 && h.ai_confidence > 0.6) contohKlas.push({ judul: b.judul, h })
  }
}
const durasiKlas = Date.now() - t1

judul('2. KLASIFIKASI')
console.log(`Berhasil dikategorikan ${bar(terklasifikasi, berita.length)} ${terklasifikasi.toString().padStart(4)}  ${persen(terklasifikasi, berita.length)}`)
console.log(`Rata-rata keyakinan   : ${(keyakinanTotal / Math.max(terklasifikasi, 1)).toFixed(3)}`)
console.log(`Waktu                 : ${durasiKlas} ms (${(durasiKlas / berita.length).toFixed(2)} ms per berita)`)
console.log(`\nPembanding — sistem lama: 635 dari 646 berkategori "Lainnya" (98,3%).`)

console.log('\nSebaran kategori:')
for (const [k, v] of [...perKategori.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${persen(v, berita.length).padStart(6)}  ${k}`)
}

console.log('\nSebaran urgensi:')
for (const [k, v] of [...perUrgensi.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${persen(v, berita.length).padStart(6)}  ${k}`)
}

console.log('\nSebaran sentimen:')
for (const [k, v] of [...perSentimen.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${persen(v, berita.length).padStart(6)}  ${k}`)
}

console.log('\nContoh hasil klasifikasi:')
for (const c of contohKlas) {
  console.log(`\n  ${String(c.judul).slice(0, 100)}`)
  console.log(`    → ${c.h.subkategori_kode} ${c.h.subkategori}  |  ${c.h.urgensi}  |  ${c.h.sentimen}  |  yakin ${(c.h.ai_confidence * 100).toFixed(0)}%`)
  console.log(`    ${c.h.alasan}`)
}

// --- 3. Uji perilaku wajib ---------------------------------------------------

judul('3. UJI PERILAKU WAJIB (matriks panduan Dirpamintel)')

const kasus = [
  {
    nama: 'Narkoba dikendalikan WBP, bukan petugas',
    judul: 'Sindikat Narkoba Internasional Dikendalikan dari Balik Jeruji Besi Lapas Kelas I Cipinang',
    harap: { subkategori_kode: '2.1' },
  },
  {
    nama: 'Oknum sipir bawa sabu masuk kategori integritas',
    judul: 'Oknum Sipir Rutan Kelas IIB Blora Ditangkap BNN Bawa Sabu 2 Kg',
    harap: { subkategori_kode: '3.2', urgensi: 'Tinggi' },
  },
  {
    nama: 'Napi main HP untuk menipu',
    judul: 'Viral! Napi Bebas Main HP dan Lakukan Penipuan Online Berkedok Pejabat',
    harap: { subkategori_kode: '2.2' },
  },
  {
    nama: 'Keluarga dimintai uang oleh petugas',
    judul: 'Keluarga Napi Mengeluh Dimintai Uang Rp 5 Juta oleh Oknum Petugas untuk Pindah Kamar',
    harap: { subkategori_kode: '3.1' },
  },
  {
    nama: 'Tahanan gergaji teralis dan kabur',
    judul: 'Geger, 3 Tahanan Kasus Curanmor Gergaji Teralis dan Kabur Dini Hari dari Rutan Kelas IIB Pacitan',
    harap: { subkategori_kode: '1.1' },
  },
  {
    nama: 'Napi tewas penuh lebam',
    judul: 'Napi Tewas Penuh Lebam di Lapas, Keluarga Tuntut Keadilan',
    harap: { subkategori_kode: '4.1', urgensi: 'Tinggi' },
  },
  {
    nama: 'Napiter tolak hormat bendera',
    judul: 'Tolak Hormat Bendera, 5 Napiter di Lapas Kelas I Semarang Kurung Diri di Sel',
    harap: { subkategori_kode: '5.2' },
  },
  {
    nama: 'Petugas menggagalkan, bukan melanggar',
    judul: 'Sipir Lapas Kelas IIA Palopo Gagalkan Penyelundupan Sabu yang Dilempar dari Luar Tembok',
    harap: { subkategori_kode: '6.1' },
  },
  {
    nama: 'Residivis setelah asimilasi',
    judul: 'Baru Bebas Asimilasi Seminggu, Begal Sadis Kembali Ditangkap Polisi',
    harap: { subkategori_kode: '7.2' },
  },
  {
    nama: 'Keluhan makanan bernilai urgensi rendah',
    judul: 'Keluarga Napi Keluhkan Lauk Makan Siang di Lapas Hanya Nasi dan Tempe',
    harap: { subkategori_kode: '4.2', urgensi: 'Rendah' },
  },
  {
    nama: 'Remisi adalah narasi positif',
    judul: 'Sebanyak 20.500 Warga Binaan di Jawa Barat Terima Remisi HUT ke-81 RI, 346 Langsung Bebas',
    harap: { subkategori_kode: '8.1', sentimen: 'Positif' },
  },
  {
    nama: 'Kerusuhan massal naik ke tingkat Kritis',
    judul: 'Kerusuhan Pecah di Lapas Kelas I Cipinang, Ratusan Warga Binaan Dievakuasi dan Fasilitas Dibakar',
    harap: { subkategori_kode: '1.2', urgensi: 'Kritis' },
  },
  {
    nama: 'Pungli tetap Sedang, tidak diobral ke Kritis',
    judul: 'Viral Pungli Layanan Kunjungan Rp 50 Ribu oleh Oknum Petugas Lapas',
    harap: { subkategori_kode: '3.1', urgensi: 'Sedang' },
  },
  {
    nama: 'Klarifikasi video lama adalah disinformasi',
    judul: 'Lapas Kelas IIA Waingapu Klarifikasi Video Viral, Tegaskan Kejadian Lama November 2024',
    harap: { subkategori_kode: '7.1' },
  },
]

let lulus = 0
for (const k of kasus) {
  const h = klasifikasikan({ judul: k.judul })
  const gagal = Object.entries(k.harap).filter(([bidang, nilai]) => h[bidang] !== nilai)
  if (!gagal.length) {
    lulus++
    console.log(`  LULUS   ${k.nama}`)
    console.log(`          → ${h.subkategori_kode} ${h.subkategori} | ${h.urgensi} | ${h.sentimen} | ${(h.ai_confidence * 100).toFixed(0)}%`)
  } else {
    console.log(`  GAGAL   ${k.nama}`)
    for (const [bidang, nilai] of gagal) console.log(`          ${bidang}: diharapkan "${nilai}", didapat "${h[bidang]}"`)
    console.log(`          pesaing: ${h.pesaing.map((p) => `${p.kode}=${p.skor}`).join(', ')}`)
  }
}

console.log(`\n  Hasil: ${lulus} dari ${kasus.length} kasus uji lulus.`)

// --- 4. Uji pencocokan UPT yang harus benar ----------------------------------

judul('4. UJI PENCOCOKAN UPT YANG HARUS BENAR')

const kasusUpt = [
  { teks: 'Kerusuhan pecah di Lapas Kelas I Cipinang pada Selasa malam', harap: 'Lapas Kelas I Cipinang' },
  { teks: 'Lapas Kelas IIA Waingapu memberikan klarifikasi terkait video viral', harap: 'Lapas Kelas IIA Waingapu' },
  { teks: 'Rutan Kelas IIB Blora kedatangan tim pengawas', harap: 'Rutan Kelas IIB Blora' },
  { teks: 'Warga Semarang menggelar pasar murah di alun-alun kota', harap: null },
  { teks: 'Harga sabu di pasar gelap Jakarta naik drastis', harap: null },
  { teks: 'Pemindahan warga binaan dari Lembaga Pemasyarakatan Kelas IIA Lhok Seumawe berjalan lancar', harap: 'Lapas Kelas IIA Lhok Seumawe' },
  { teks: 'Sepekan di Rutan KPK, Kejagung Terus Dalami Kasus Febrie Adriansyah', harap: null },
  { teks: 'Bawa Anak, Wanita Coba Selundupkan Sabu ke Rutan Salemba', harap: 'Rutan Kelas I Jakarta Pusat' },
  { teks: 'Kunjungan kerja ke Lembaga Pemasyarakatan Perempuan Kelas IIA Jakarta berjalan lancar', harap: 'Lapas Perempuan Kelas IIA Jakarta' },
]

let lulusUpt = 0
for (const k of kasusUpt) {
  const h = cocokkanUpt(k.teks, indeks)
  const cocok = h.nama === k.harap
  if (cocok) lulusUpt++
  console.log(`  ${cocok ? 'LULUS  ' : 'GAGAL  '} ${k.teks.slice(0, 66)}`)
  console.log(`          diharapkan ${k.harap ?? '(tidak ada)'} · didapat ${h.nama ?? '(tidak ada)'} [${(h.skor * 100).toFixed(0)}%]`)
  if (!cocok) console.log(`          ${h.alasan}`)
}

console.log(`\n  Hasil: ${lulusUpt} dari ${kasusUpt.length} kasus uji lulus.`)

const semuaLulus = lulus === kasus.length && lulusUpt === kasusUpt.length
console.log('\n' + '─'.repeat(78))
console.log(semuaLulus ? 'SELURUH UJI PERILAKU LULUS.' : 'ADA UJI YANG BELUM LULUS — periksa keluaran di atas.')
console.log('─'.repeat(78))
process.exit(semuaLulus ? 0 : 1)
