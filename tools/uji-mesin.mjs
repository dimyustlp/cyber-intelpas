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
import { bersihkanTeks } from '../web/js/lib/teks.js'

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

/**
 * Catatan asal-usul yang ditulis perayap ke dalam raw_analysis setiap baris.
 *
 * Kasus v4.3 di bawah WAJIB memakainya. Tanpa kolom ini keenamnya lulus
 * bahkan pada mesin v4.2 yang cacat — sebab yang membuat mereka gagal di
 * lapangan bukan judulnya, melainkan kalimat yang ditambahkan perayap sendiri
 * di sebelahnya. Menguji judulnya saja berarti menguji berita yang tidak
 * pernah ada di dalam basis data.
 */
const jejakPerayap = (isu) => ({
  raw_analysis: `Ditemukan penjaring-v1.0 (${isu}).`,
  source_type: 'penjaring',
})

const kasus = [
  /*
     Enam kasus berikut lahir dari pemberitahuan Telegram yang SUNGGUH-SUNGGUH
     TERKIRIM ke grup pimpinan pada 7 September 2026 — sehari sesudah v4.2
     digelar untuk memperbaiki kelas kekeliruan yang sama.

     Semuanya berlabel "BERITA NEGATIF MASUK", dan semuanya kegiatan positif:
     peninjauan Dirjenpas, penyaluran bantuan gempa, pemeriksaan APAR,
     sosialisasi kebakaran, aksi berbagi. Satu lagi berita penjara di Gaza.

     Yang membuatnya berharga sebagai kasus uji: kelimanya LULUS bila diuji
     dengan judulnya saja. Sebab kegagalannya ada pada `raw_analysis` — dan
     itulah pelajaran yang paling pantas dijaga oleh berkas ini.
  */
  {
    nama: 'Peninjauan pejabat ke unit terdampak bukan berita bencana',
    judul: 'Dirjenpas Tinjau Kondisi Rutan Ruteng yang Terdampak Gempa Flores',
    berita: jejakPerayap('isu:isu-bencana'),
    harap: { sentimen: 'Positif' },
  },
  {
    nama: 'Bantuan untuk korban gempa bukan berita gempa',
    judul: 'Kemenimipas Salurkan Bantuan Rp1,8 Miliar untuk Korban Gempa NTT',
    berita: jejakPerayap('isu:isu-bencana'),
    harap: { subkategori_kode: '8.3', sentimen: 'Positif' },
  },
  {
    nama: 'Pemeriksaan APAR bukan kebakaran',
    judul: 'Lapas Tembilahan Siaga, Pemeriksaan APAR Secara Berkala sebagai Langkah Antisipasi Bahaya Kebakaran',
    berita: jejakPerayap('unit'),
    harap: { subkategori_kode: '8.5', sentimen: 'Positif' },
  },
  {
    nama: 'Jalur evakuasi adalah sarana, bukan evakuasi — dan bukan Kritis',
    judul: 'Cegah Kebakaran, Rutan Manna Kembali Periksa APAR, CCTV, Listrik dan Jalur Evakuasi',
    berita: jejakPerayap('unit'),
    harap: { sentimen: 'Positif', urgensi: 'Rendah' },
  },
  {
    nama: 'Nama unit bukan peristiwa: Lapas Narkotika berbagi camilan',
    judul: 'Tingkatkan Kepedulian Humanis, Lapas Narkotika Karang Intan Gelar Aksi Berbagi Camilan',
    berita: jejakPerayap('unit'),
    harap: { sentimen: 'Positif' },
  },
  {
    nama: 'Penjara negara lain bukan urusan Ditjen Pemasyarakatan',
    judul: 'Dr Abu Safiya: Sipir Israel Terus Menganiaya dan Mengancam Saya agar Bungkam',
    berita: jejakPerayap('isu:isu-kekerasan'),
    harap: { subkategori_kode: '9.1', dalam_lingkup: false },
  },

  /* Arah sebaliknya untuk tiga kaidah baru di atas. Tanpa ketiganya, cara
     termudah meluluskan keenam kasus di atas adalah mematikan kaidahnya. */
  {
    nama: 'Kebakaran sungguhan tetap kebakaran meski ada kata APAR',
    judul: 'Kebakaran Hebat Melanda Blok Hunian Lapas Kelas IIA Kupang, APAR Tak Berfungsi dan Warga Binaan Dievakuasi',
    berita: jejakPerayap('isu:isu-bencana'),
    harap: { subkategori_kode: '4.3', sentimen: 'Negatif' },
  },
  {
    nama: 'Kerja sama internasional tetap berita kita',
    judul: 'Kemenimipas Terima Kunjungan Delegasi Pemasyarakatan Malaysia di Jakarta',
    harap: { dalam_lingkup: true },
  },
  {
    nama: 'Razia di Lapas Narkotika yang menemukan sabu tetap temuan',
    judul: 'Razia Blok Hunian Lapas Narkotika Kelas IIA Karang Intan, Petugas Sita Sabu dan Empat Ponsel',
    berita: jejakPerayap('unit'),
    harap: { sentimen: 'Negatif' },
  },

  /*
     Lima kasus berikut TIDAK dilaporkan siapa pun. Semuanya ditemukan dengan
     membaca satu contoh dari tiap subkategori pada arsip yang baru saja
     dinilai ulang v4.3 — lima keliru dari dua puluh enam yang diperiksa.

     Itu caranya menemukan kelas kekeliruan yang tidak berisik: bukan menunggu
     ada yang mengeluh, melainkan membaca satu baris dari setiap subkategori
     sesudah tiap penggelaran. Yang mengeluh hanya menemukan yang mengganggu;
     yang paling mahal justru yang diam.
  */
  {
    nama: 'Bangunan rusak karena gempa bukan pengrusakan oleh warga binaan',
    judul: 'Rutan Ruteng Rusak Diguncang Gempa, Pelayanan Warga Binaan Tetap Berjalan Sesuai Standar',
    berita: jejakPerayap('unit'),
    harap: { subkategori_kode: '4.3', sentimen: 'Negatif' },
  },
  {
    nama: 'Makanan yang layak bukan keluhan kelayakan hidup',
    judul: 'Warga Binaan Lapas Cikarang Dapatkan Makan Bergizi, Higienis dan Layak',
    berita: jejakPerayap('unit'),
    harap: { subkategori_kode: '8.3', sentimen: 'Positif' },
  },
  {
    nama: 'Unit yang membantu korban gempa bukan unit yang tertimpa gempa',
    judul: 'Warga Terdampak Gempa di Manggarai Terima Bantuan Imigrasi dan Pemasyarakatan',
    berita: jejakPerayap('isu:isu-bencana'),
    harap: { subkategori_kode: '8.3', sentimen: 'Positif' },
  },
  {
    nama: 'Napiter yang berikrar setia NKRI adalah keberhasilan, bukan penolakan',
    judul: 'Dua Napiter Lapas Pati Ikrar Setia NKRI, Teguhkan Komitmen Kebangsaan di Kabupaten Pati',
    berita: jejakPerayap('isu:isu-teroris'),
    harap: { subkategori_kode: '8.2', sentimen: 'Positif' },
  },
  {
    nama: 'Penolakan ikrar tetap penolakan meski frasa ikrarnya lengkap',
    judul: 'Napiter di Lapas Kelas I Semarang Tolak Ikuti Upacara dan Ikrar Setia NKRI',
    harap: { subkategori_kode: '5.2', sentimen: 'Negatif' },
  },
  {
    nama: '"Berikan" bukan "perikanan"',
    judul: 'Berikan Informasi Hukum, Bapas Saumlaki Layani Masyarakat',
    berita: jejakPerayap('umum:umum-bapas'),
    harap: { subkategori_kode: '8.3', sentimen: 'Positif' },
  },

  /*
     Enam kasus di bawah ini lahir dari pemberitahuan Telegram yang
     SUNGGUH-SUNGGUH TERKIRIM ke grup pimpinan pada 6 September 2026, jam
     pertama perayap baru menyala. Lima pesan berlabel "BERITA NEGATIF MASUK",
     empat di antaranya kegiatan positif — dan satu di antaranya sebuah grup
     band binaan yang menghibur PELARI lomba lari, tercatat 1.1 Pelarian WBP
     dengan urgensi Tinggi.

     Ditaruh paling atas dengan sengaja: inilah kelas kekeliruan yang paling
     mahal pada sistem ini, sebab akibatnya bukan angka yang meleset melainkan
     orang yang dipanggil tengah malam untuk peristiwa yang tidak pernah ada.
  */
  {
    nama: "Kegiatan tentang bencana bukan bencana",
    judul: "Upaya Peningkatan Kesiapsiagaan Mitigasi Bencana Gempa Bumi bagi Warga Binaan di Lapas Kelas IIA Cilegon",
    harap: { sentimen: "Positif" },
  },
  {
    nama: "Simulasi kebakaran bukan kebakaran",
    judul: "Simulasi Pemadaman Kebakaran Digelar di Lapas Narkotika Jakarta",
    harap: { sentimen: "Positif" },
  },
  {
    nama: "Bencana sungguhan tetap bencana meski disusul kegiatan",
    judul: "Gempa Guncang Lapas Ruteng, Napi Dievakuasi dan Kanwil Kirim Bantuan",
    harap: { subkategori_kode: "4.3", sentimen: "Negatif" },
  },
  {
    nama: "Pelari lomba lari bukan pelarian warga binaan",
    judul: "Bernyanyi Bersama, Grub Band Binaan Rutan Tanah Grogot Hibur Pelari Kideco Run 2026",
    harap: { sentimen: "Positif" },
  },
  {
    nama: "Razia yang menemukan barang terlarang bukan kegiatan rutin",
    judul: "Razia di Lapas Kelas IIA Ambon, Ditemukan 20 Ponsel dan Sabu di Blok Hunian",
    harap: { sentimen: "Negatif" },
  },
  {
    nama: "Razia yang tidak menemukan apa-apa tetap kegiatan rutin",
    judul: "Razia Rutin Digelar di Lapas Kelas IIA Ambon, Situasi Kondusif",
    harap: { subkategori_kode: "8.5", sentimen: "Positif" },
  },
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
  {
    /* Pemberitahuan Telegram 9 September 2026: tercatat 2.2 Kejahatan Siber
       dengan kata kunci "gawai", keyakinan 74% — "gawai" adalah potongan
       akar dari "pegawai". Penyematan tanda kehormatan negara. */
    nama: 'Satyalancana untuk pegawai bukan HP ilegal',
    judul: 'Bapas Jogja Sematkan Satyalancana Karya Satya bagi Pegawai Berdedikasi',
    harap: { subkategori_kode: '8.4', sentimen: 'Positif' },
  },
  {
    /* Pemberitahuan Telegram 9 September 2026: tercatat 2.1 Pengendalian
       Narkoba oleh WBP — padahal barangnya dicegat di pintu masuk oleh
       petugas, tidak pernah masuk. Pencegatan modus baru, bukan temuan
       di dalam blok. */
    nama: 'Sabu disembunyikan dalam ikan, dicegat petugas',
    judul: 'Enam Paket Diduga Sabu Disembunyikan dalam Ikan Tongkol, Berhasil Diamankan Petugas Rutan',
    harap: { subkategori_kode: '6.1', sentimen: 'Positif' },
  },
  {
    /* Penjaga arah sebaliknya: temuan sungguhan DI DALAM blok tetap negatif,
       kaidah pencegatan tidak boleh membocorkannya. */
    nama: 'Razia blok temukan sabu tetap negatif',
    judul: 'Razia Blok Hunian Lapas Narkotika Kelas IIA Karang Intan, Petugas Sita Sabu dan Empat Ponsel',
    harap: { sentimen: 'Negatif' },
  },
]

let lulus = 0
for (const k of kasus) {
  const h = klasifikasikan({ judul: k.judul, ...(k.berita || {}) })
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

  // --- Kasus di bawah ini diambil dari berita yang benar-benar gagal ---
  // Seluruhnya berakhir "Belum Teridentifikasi" pada arsip 1 September 2026,
  // dan masing-masing mewakili satu cacat yang berbeda. Kalau salah satu dari
  // mereka kembali gagal, cacatnya kembali.

  // Nama induk rapat, berita berspasi. Kebalikan dari Tanjungpinang, dan
  // arah yang tidak pernah ditangani sampai empat berita Palangkaraya
  // diperiksa satu per satu — termasuk siaran resmi Ombudsman RI.
  { teks: 'Anggota Ombudsman RI melakukan kunjungan kerja ke Lapas Perempuan Kelas IIA Palangka Raya, Kalimantan Tengah', harap: 'Lapas Perempuan Kelas IIA Palangkaraya' },
  { teks: 'Pamapta I SPKT Polresta Palangka Raya Cek Rutin Tahanan di Rutan Palangka Raya', harap: 'Rutan Kelas IIA Palangkaraya' },

  // Seluruh nama unitnya kata umum. "Negara" adalah ibu kota Jembrana, dan
  // sekaligus penutup frasa "rumah tahanan negara" — sah hanya bila ia berdiri
  // di luar penanda jenis.
  { teks: 'Kapasitas 71 Orang, Rutan Negara Kini Dihuni 213 Warga Binaan', harap: 'Rutan Kelas IIB Negara' },
  { teks: 'Petugas Rumah Tahanan Negara menggelar razia blok hunian', harap: null },
  // Nama panjang sebuah rutan mana pun tidak boleh menarik unit di Jembrana,
  // dan toleransi ejaan tidak boleh mengubah "tahanan" menjadi "Tabanan".
  { teks: 'Rumah Tahanan Negara Kelas IIA Surakarta menggelar razia blok hunian', harap: 'Rutan Kelas I Surakarta' },

  // Nama induk lebih panjang daripada yang ditulis media. Setengah token
  // cocok, tetapi token yang cocok itu hanya dimiliki satu unit di Indonesia.
  { teks: 'Lapas Kelas IIA Ngaseman menggelar Lomba Catur yang diikuti oleh pegawai dan PPNPN', harap: 'Lapas Kelas IIA Ngaseman Nusakambangan' },

  // Nama provinsi tidak pernah menjadi penunjuk. Tanpa penjagaan ini, berita
  // ini dipetakan ke Rutan Bandar Lampung dengan keyakinan 72 persen —
  // melewati ambang, dan menutup lapisan kabupaten/kota yang benar.
  { teks: 'Napi Kasus Narkoba yang Kabur dari Rutan Lampung Timur Sejak 2024 Ditangkap di Myanmar', harap: 'Rutan Kelas IIB Sukadana' },

  // Unit baru dari daftar nasional, dan unit yang naik status menjadi Lapas.
  { teks: 'Program Belajar Paket C Perkuat Pembinaan Pendidikan di Lapas Batulicin', harap: 'Lapas Kelas III Batulicin' },
  { teks: 'Selamat bergabung kepada Peserta MagangHub Angkatan 1 Batch 2 di Lapas Kelas IIB Purwodadi', harap: 'Lapas Kelas IIB Purwodadi' },

  // LPKA dengan nama lama yang dipakai hampir seluruh media.
  { teks: 'Anak binaan Lapas Anak Kutoarjo mengikuti ujian paket B', harap: 'LPKA Kelas I Kutoarjo' },

  // Berita yang memang tidak boleh dipetakan ke unit mana pun.
  { teks: 'Kerusuhan di Lapas Ekuador, Petugas Keamanan Dipukul Mundur Narapidana', harap: null },
  { teks: 'Sebanyak 91 persen Lapas dan Rutan di Jawa Timur mengalami overkapasitas', harap: null },
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

// --- 5. Pembersihan templat crawler ------------------------------------------

judul('5. PEMBERSIHAN TEMPLAT CRAWLER')

/**
 * Lima bentuk pertama diambil apa adanya dari arsip, tempat mereka menutupi 447
 * dari 779 baris. Teks itu ikut ditimbang mesin klasifikasi — kata "institusi",
 * "masalah", dan "ancaman" di dalamnya berasal dari templat, bukan dari
 * beritanya — dan ikut tercetak pada lampiran laporan harian di bawah setiap
 * butir, kalimat yang sama berulang-ulang.
 *
 * Dua kasus terakhir yang paling penting: templat harus lenyap tanpa memakan
 * kalimat di depannya, dan kalimat manusia yang kebetulan memuat kata "topik:"
 * serta "rekomendasi:" harus tetap utuh.
 */
const kasusBersih = [
  ['templat frekuensi',
    'TOPIK: Umum FREKUENSI ISU: 3 Berita POTENSI VIRAL: RENDAH (1.2/5) SKOR ANCAMAN: 2/5 (RENDAH) '
    + 'SENTIMEN: Fallback LOKASI/SATKER: Umum RINGKASAN: Terdeteksi kata kunci. REKOMENDASI: Verifikasi data awal.', ''],
  ['templat rule-based',
    'TOPIK: Isu Potensial (Rule-Based) SKOR ANCAMAN: 2/5 (SEDANG) RINGKASAN: Terdeteksi kata kunci '
    + 'institusi & masalah pada konten. REKOMENDASI: Verifikasi lapangan.', ''],
  ['templat pemasyarakatan',
    'TOPIK: Pemasyarakatan SKOR ANCAMAN: 1/5 (RENDAH) SENTIMEN: Faktual Netral / Positif '
    + 'RINGKASAN: Informasi publik terdeteksi. REKOMENDASI: Catat dan arsipkan.', ''],
  ['templat tanpa TOPIK',
    'SKOR ANCAMAN: 1/5 (RENDAH) SENTIMEN: Deteksi Otomatis (Fallback) LOKASI/SATKER: Umum '
    + 'RINGKASAN: Terdeteksi kata kunci ancaman. REKOMENDASI: Lakukan verifikasi data awal.', ''],
  ['isi berita lalu templat',
    'Napi kabur dari Lapas Kelas IIB Sukadana ditangkap di Myanmar. TOPIK: Isu Potensial (Rule-Based) '
    + 'SKOR ANCAMAN: 2/5 (SEDANG) RINGKASAN: Terdeteksi kata kunci institusi. REKOMENDASI: Verifikasi lapangan.',
    'Napi kabur dari Lapas Kelas IIB Sukadana ditangkap di Myanmar.'],
  ['kalimat manusia, jangan disentuh',
    'Kepala Lapas memberi arahan tentang topik: integritas petugas dan rekomendasi: perbaikan layanan kunjungan.',
    'Kepala Lapas memberi arahan tentang topik: integritas petugas dan rekomendasi: perbaikan layanan kunjungan.'],

  /*
     Catatan asal-usul perayap. Bentuk lama menutupi seluruh 718 baris hasil
     perayap dan merusak klasifikasi lewat dua jalan sekaligus; bentuk baru
     memakai penanda "[sistem]" yang disepakati untuk semua mesin berikutnya.
  */
  ['jejak perayap lama', 'Ditemukan penjaring-v1.0 (isu:isu-bencana).', ''],
  ['jejak perayap bertanda sistem', '[sistem] Ditemukan penjaring-v1.1 (unit).', ''],
  ['jejak perayap sesudah kalimat berita',
    'Napi kabur dari Lapas Kelas IIB Sukadana. [sistem] Ditemukan penjaring-v1.1 (isu:isu-pelarian).',
    'Napi kabur dari Lapas Kelas IIB Sukadana.'],
  ['catatan patroli siber', 'Konten terdeteksi otomatis oleh sistem patroli siber.', ''],
]

let lulusBersih = 0
for (const [nama, masuk, harap] of kasusBersih) {
  const dapat = bersihkanTeks(masuk)
  const cocok = dapat === harap
  if (cocok) lulusBersih++
  console.log(`  ${cocok ? 'LULUS  ' : 'GAGAL  '} ${nama}`)
  if (!cocok) {
    console.log(`          diharapkan "${harap.slice(0, 70)}"`)
    console.log(`          didapat    "${dapat.slice(0, 70)}"`)
  }
}

console.log(`\n  Hasil: ${lulusBersih} dari ${kasusBersih.length} kasus uji lulus.`)

const semuaLulus = lulus === kasus.length
  && lulusUpt === kasusUpt.length
  && lulusBersih === kasusBersih.length
console.log('\n' + '─'.repeat(78))
console.log(semuaLulus ? 'SELURUH UJI PERILAKU LULUS.' : 'ADA UJI YANG BELUM LULUS — periksa keluaran di atas.')
console.log('─'.repeat(78))
process.exit(semuaLulus ? 0 : 1)
