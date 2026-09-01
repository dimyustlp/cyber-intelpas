/**
 * Menyusun data induk UPT dari daftar nasional, lalu menerbitkan dua berkas:
 * `data/master-upt.csv` dan satu migrasi SQL yang menyamakan tabel `upt`.
 *
 * Kenapa alat ini ada, dan kenapa ia bukan sekadar "impor CSV".
 *
 * Sampai 1 September 2026 tabel `upt` berisi 492 unit, sementara Ditjenpas
 * mencatat 627 UPT — 95 di antaranya Bapas dan Rumah Sakit Pengayoman, yang
 * memang di luar lingkup sistem ini. Tiga puluh sembilan unit hilang, dan tiga
 * puluh dua di antaranya seluruh LPKA di Indonesia: tidak ada satu pun LPKA di
 * data induk, padahal mesin pencocokan sudah lama mengenali penanda "lembaga
 * pembinaan khusus anak". Setiap berita tentang anak yang berhadapan dengan
 * hukum karena itu selalu berakhir "Belum Teridentifikasi", dan tidak ada apa
 * pun di layar yang memberi tahu bahwa penyebabnya adalah data induk kosong.
 *
 * Hasilnya 531 unit, bukan 532 seperti yang didapat dari pengurangan angka
 * Ditjenpas. Selisih satu itu nyata dan tidak ditutup-tutupi: daftar nasional
 * memuat "LAPAS KELAS IIA BUKITTINGGI" dua kali, dan setelah baris kembar itu
 * dibuang ia mencatat 337 Lapas, 162 Rutan, dan 32 LPKA. Angka Ditjenpas
 * menyebut 33 LPKA. Satu LPKA memang tidak ada pada daftar sumbernya, dan
 * berkas ini tidak mengarangnya.
 *
 * Yang membuat penyusunan ini tidak sepele adalah 23 unit yang ada di kedua
 * daftar dengan nama berbeda. Sebagian selisih ejaan ("Bireun" dan "Bireuen"),
 * sebagian nama lama yang masih dipakai daftar nasional ("Ujung Pandang" untuk
 * Makassar), sebagian lagi nama tempat yang berbeda untuk unit yang sama
 * ("Tanjung Pati" dan "Payakumbuh"). Pencocokan otomatis akan menganggap
 * semuanya unit baru dan menghasilkan 23 unit kembar. Karena itu seluruh
 * pasangan ditulis tangan di tabel PADANAN di bawah, satu per satu, dengan
 * alasannya — supaya keputusan ini bisa diperiksa orang lain, bukan disimpulkan
 * dari perilaku sebuah fungsi kemiripan.
 *
 * Aturan yang dipegang di seluruh berkas ini: nama unit yang sudah ada TIDAK
 * diubah. Kolom `berita.nama_upt` dan `app_users.assigned_upt` menyimpan nama
 * itu sebagai teks biasa, tanpa kunci asing, sehingga sebuah penggantian nama
 * memutus hubungan berita dengan unitnya tanpa satu pun galat yang terlihat.
 * Nama dari daftar nasional yang berbeda disimpan sebagai alias di
 * lib/pencocokan-upt.js, tempat ia justru berguna: itulah nama yang dipakai
 * wartawan.
 *
 * Satu-satunya pengecualian adalah empat unit yang naik status dari Rutan
 * menjadi Lapas. Di situ jenisnya ikut berubah, dan jenis adalah bagian dari
 * cara mesin memutuskan — sebuah "Rutan" yang sebenarnya Lapas akan menolak
 * berita yang menyebutnya Lapas. Keempatnya diganti nama sekaligus, dan
 * migrasinya ikut memperbarui berita serta penugasan pengguna yang menunjuk
 * nama lama.
 *
 * Dijalankan dengan: node tools/susun-master-upt.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const SUMBER_NASIONAL = join(AKAR, 'data', 'sumber', 'daftar-upt-nasional.csv')

/**
 * Potret tabel `upt` dari repositori lama, sumber seluruh koordinat.
 *
 * Ia potret, bukan cermin. Satu unit sudah diverifikasi koordinatnya di basis
 * data sungguhan setelah potret ini diambil, dan potretnya masih menyebut unit
 * itu "kandidat pusat kota". Selisih itu tidak mengganggu apa pun selama tabel
 * `upt` hanya ditambahi — migrasi yang dihasilkan berkas ini memang tidak
 * pernah menimpa baris lama. Ia baru berbahaya bila suatu hari tabelnya disusun
 * ulang dari data/master-upt.csv: verifikasi tangan itu akan hilang tanpa suara.
 * Bila hari itu tiba, ambil potret baru dari basis data lebih dulu.
 */
const SUMBER_LAMA = join(AKAR, 'data', 'sumber', 'master-upt-lama.csv')
const KELUARAN_CSV = join(AKAR, 'data', 'master-upt.csv')
const KELUARAN_SQL = join(AKAR, 'supabase', 'migrations', '20260901040000_master_upt_nasional.sql')

/**
 * Jenis yang tidak ikut dipantau sistem ini. Bapas membina klien di luar
 * tembok dan Rumah Sakit Pengayoman adalah fasilitas kesehatan; keduanya tidak
 * pernah menjadi subjek berita "kondisi hunian" yang dihitung dasbor. Inilah
 * 81 baris yang membuat 612 unit daftar nasional menjadi 531 unit terpantau.
 */
const JENIS_DILEWATI = new Set(['Bapas', 'RS'])

/**
 * Unit yang ada di kedua daftar dengan nama berbeda.
 *
 * Kunci  : nama pada daftar nasional (huruf besar, apa adanya)
 * Nilai  : nama pada data induk yang sudah berjalan — nama inilah yang menang
 * Alasan : kenapa keduanya dinyatakan unit yang sama
 */
const PADANAN = [
  // --- selisih ejaan nama daerah ---
  ['LAPAS KELAS IIB BIREUEN', 'Lapas Kelas IIB Bireun', 'ejaan nama kabupaten'],
  ['LAPAS KELAS IIB LHOK SUKON', 'Lapas Kelas IIB Lhoksukon', 'ejaan rapat/terpisah'],
  ['LAPAS KELAS III RANGKAS BITUNG', 'Lapas Kelas III Rangkasbitung', 'ejaan rapat/terpisah'],
  ['LAPAS KELAS IIB SOROLANGUN', 'Lapas Kelas IIB Sarolangun', 'ejaan nama kabupaten'],
  ['LAPAS KELAS IIB BANJARBARU', 'Lapas Kelas IIB Banjar Baru', 'ejaan rapat/terpisah'],
  ['RUTAN KELAS IIB TANJUNG REDEP', 'Rutan Kelas IIB Tanjung Redeb', 'ejaan nama kota'],
  ['LAPAS PEREMPUAN KELAS III PANGKAL PINANG', 'Lapas Perempuan Kelas III Pangkalpinang', 'ejaan rapat/terpisah'],
  ['LAPAS KELAS IIB FAK-FAK', 'Lapas Kelas IIB Fakfak', 'tanda hubung'],
  ['LAPAS KELAS IIB SELATPANJANG', 'Lapas Kelas IIB Selat Panjang', 'ejaan rapat/terpisah'],
  ['RUTAN KELAS IIB PASANG KAYU', 'Rutan Kelas IIB Pasangkayu', 'ejaan rapat/terpisah'],
  ['LAPAS KELAS IIA BAU-BAU', 'Lapas Kelas IIA Baubau', 'tanda hubung'],
  ['LAPAS KELAS III LABUAN BILIK', 'Lapas Kelas III Labuhan Bilik', 'ejaan nama kecamatan'],

  // --- nama lama yang masih dipakai daftar nasional ---
  ['LAPAS KELAS I UJUNG PANDANG', 'Lapas Kelas I Makassar', 'Ujung Pandang nama lama Makassar'],
  ['RUTAN KELAS I UJUNG PANDANG', 'Rutan Kelas I Makassar', 'Ujung Pandang nama lama Makassar'],

  // --- nama tempat berbeda untuk unit yang sama ---
  ['LAPAS PEREMPUAN KELAS IIA KEROBOKAN', 'Lapas Perempuan Kelas IIA Denpasar', 'Kerobokan adalah lokasi Lapas Perempuan Denpasar'],
  ['LAPAS PEREMPUAN KELAS IIA TENGGARONG', 'Lapas Perempuan Kelas IIA Samarinda', 'satu-satunya lapas perempuan Kalimantan Timur'],
  ['LAPAS KELAS IIA LOMBOK BARAT', 'Lapas Kelas IIA Mataram', 'gedungnya di Kabupaten Lombok Barat'],
  ['LAPAS KELAS IIB TANJUNG PATI', 'Lapas Kelas IIB Payakumbuh', 'Tanjung Pati adalah lokasi Lapas Payakumbuh'],
  ['LAPAS KELAS I BATU NUSAKAMBANGAN', 'Lapas Kelas I Batu High Risk Narkotika Nusakambangan', 'data induk memakai nama lengkap'],

  // --- naik status Rutan menjadi Lapas: nama induk IKUT diganti ---
  ['LAPAS KELAS IIB BATANG', 'Rutan Kelas IIB Batang', 'naik status', { gantiNama: true }],
  ['LAPAS KELAS IIB PURWODADI', 'Rutan Kelas IIB Purwodadi', 'naik status', { gantiNama: true }],
  ['LAPAS KELAS IIB WONOGIRI', 'Rutan Kelas IIB Wonogiri', 'naik status', { gantiNama: true }],
  ['LAPAS KELAS IIB WONOSARI', 'Rutan Kelas IIB Wonosari', 'naik status', { gantiNama: true }],
]

/**
 * Kabupaten/kota unit baru, ditulis tangan.
 *
 * Daftar nasional hanya memuat kanwil, sedangkan mesin pencocokan memakai
 * kabupaten/kota untuk lapisan terakhirnya — "napi kabur dari Rutan Lampung
 * Timur" hanya bisa dipetakan lewat kolom ini. Menebaknya dari nama unit
 * memang benar untuk sebagian besar unit, tetapi salah persis pada unit yang
 * paling sering diberitakan: empat lapas Nusakambangan ada di Cilacap, LPKA
 * Kutoarjo ada di Purworejo, LPKA Sungai Raya ada di Kubu Raya. Karena itu
 * kolom ini tidak ditebak.
 */
const KABKOTA_BARU = {
  'LPKA Kelas II Banda Aceh': 'Kota Banda Aceh',
  'LPKA Kelas II Karangasem': 'Karangasem',
  'LPKA Kelas I Tangerang': 'Kota Tangerang',
  'LPKA Kelas II Bengkulu': 'Kota Bengkulu',
  'LPKA Kelas II Yogyakarta': 'Kota Yogyakarta',
  'LPKA Kelas II Jakarta': 'Kota Jakarta Timur',
  'LPKA Kelas II Gorontalo': 'Kota Gorontalo',
  'LPKA Kelas II Muara Bulia': 'Batanghari',
  'LPKA Kelas II Bandung': 'Kota Bandung',
  'LPKA Kelas I Kutoarjo': 'Purworejo',
  'LPKA Kelas I Blitar': 'Kota Blitar',
  'LPKA Kelas II Sungai Raya': 'Kubu Raya',
  'LPKA Kelas I Martapura': 'Banjar',
  'LPKA Kelas II Palangkaraya': 'Kota Palangka Raya',
  'LPKA Kelas II Tenggarong': 'Kutai Kartanegara',
  'LPKA Kelas II Pangkal Pinang': 'Kota Pangkalpinang',
  'LPKA Kelas II Batam': 'Kota Batam',
  'LPKA Kelas II Bandar Lampung': 'Kota Bandar Lampung',
  'LPKA Kelas II Ambon': 'Kota Ambon',
  'LPKA Kelas II Ternate': 'Kota Ternate',
  'LPKA Kelas II Lombok Tengah': 'Lombok Tengah',
  'LPKA Kelas I Kupang': 'Kota Kupang',
  'LPKA Kelas II Jayapura': 'Kota Jayapura',
  'LPKA Kelas II Pekanbaru': 'Kota Pekanbaru',
  'LPKA Kelas II Mamuju': 'Mamuju',
  'LPKA Kelas II Maros': 'Maros',
  'LPKA Kelas II Palu': 'Kota Palu',
  'LPKA Kelas II Kendari': 'Kota Kendari',
  'LPKA Kelas II Tomohon': 'Kota Tomohon',
  'LPKA Kelas II Payakumbuh': 'Lima Puluh Kota',
  'LPKA Kelas I Palembang': 'Kota Palembang',
  'LPKA Kelas I Medan': 'Deli Serdang',

  'Lapas Kelas IIA Gladakan Nusakambangan': 'Cilacap',
  'Lapas Kelas IIA Kumbang Nusakambangan': 'Cilacap',
  'Lapas Kelas IIA Ngaseman Nusakambangan': 'Cilacap',
  'Lapas Kelas IIB Nirbaya Nusakambangan': 'Cilacap',
  'Rutan Kelas I Semarang': 'Kota Semarang',
  'Lapas Kelas III Batulicin': 'Tanah Bumbu',
  'Lapas Kelas IIB Maros': 'Maros',
  'Lapas Kelas IIA Bukittinggi': 'Kota Bukittinggi',
}

/**
 * Kabupaten/kota unit lama yang kolomnya kosong sejak awal.
 *
 * Tujuh belas unit masuk ke data induk tanpa kabupaten/kota jauh sebelum
 * penyusunan ini — seluruh unit Palangkaraya, Pangkal Pinang, dan Tanjung
 * Pinang di antaranya. Lubangnya tidak kelihatan di layar, tetapi mesin
 * pencocokan memakai kolom itu pada lapisan terakhirnya: "napi kabur dari
 * Rutan Lampung Timur" hanya bisa dipetakan lewat kabupaten, bukan nama unit.
 * Selama kolomnya kosong, tujuh belas unit itu kehilangan lapisan tersebut,
 * dan penyaringan per kabupaten di layar juga tidak pernah menemukan mereka.
 *
 * Diisi tangan karena `location_hint` mereka pun kosong — tidak ada apa pun di
 * data yang bisa diturunkan. Yang dipakai adalah kabupaten/kota tempat gedung
 * itu berdiri menurut penamaan wilayah resmi.
 */
const KABKOTA_TAMBALAN = {
  'Lapas Kelas IIB Pahuwato': 'Pohuwato',
  'Lapas Perempuan Kelas IIA Martapura': 'Banjar',
  'Lapas Kelas IIA Palangkaraya': 'Kota Palangka Raya',
  'Lapas Perempuan Kelas IIA Palangkaraya': 'Kota Palangka Raya',
  'Rutan Kelas IIA Palangkaraya': 'Kota Palangka Raya',
  'Lapas Kelas IIA Pangkal Pinang': 'Kota Pangkalpinang',
  'Lapas Narkotika Kelas IIA Pangkal Pinang': 'Kota Pangkalpinang',
  'Lapas Perempuan Kelas III Pangkalpinang': 'Kota Pangkalpinang',
  'Lapas Kelas IIA Tanjung Pinang': 'Kota Tanjungpinang',
  'Lapas Narkotika Kelas IIA Tanjung Pinang': 'Kota Tanjungpinang',
  'Rutan Kelas I Tanjung Pinang': 'Kota Tanjungpinang',
  'Lapas Kelas IIB Fakfak': 'Fakfak',
  'Lapas Kelas IIA Pare-Pare': 'Kota Parepare',
  'Lapas Kelas IIB Ulu Siau': 'Kepulauan Siau Tagulandang Biaro',
  'Lapas Kelas III Tagulandang': 'Kepulauan Siau Tagulandang Biaro',
  'Lapas Kelas III Labuhan Bilik': 'Labuhanbatu',
  'Rutan Kelas I Labuhan Deli': 'Kota Medan',
}

/**
 * Unit yang titik sementaranya dipinjam dari unit tertentu, ditulis tangan.
 *
 * Pewarisan otomatis mencari unit lain yang nama tempatnya sama. Ia bekerja
 * untuk 26 dari 39 unit baru; tiga belas sisanya tidak punya unit senama —
 * "Gladakan" dan "Nirbaya" adalah nama blok di Pulau Nusakambangan, "Kutoarjo"
 * sebuah kecamatan di Purworejo, dan Maros belum pernah punya UPT sama sekali.
 * Untuk mereka, unit sumbernya dipilih tangan, dengan alasannya. Sebagian
 * berada di kota yang sama, sebagian di kabupaten sebelah — keduanya sama-sama
 * bukan alamat gedungnya, dan keduanya sama-sama ditandai wajib diperiksa.
 */
const KOORDINAT_PINJAM = {
  'LPKA Kelas II Sungai Raya': ['Lapas Kelas IIA Pontianak', 'Kubu Raya berbatasan dengan Kota Pontianak'],
  // Ada dua Martapura di Indonesia. Pewarisan otomatis memilih "Lapas Kelas IIB
  // Martapura" di Ogan Komering Ulu Timur, Sumatera Selatan — dan menaruh LPKA
  // Kalimantan Selatan di seberang Laut Jawa. Pemeriksaan provinsi-lawan-kanwil
  // di bawah ada karena kekeliruan ini.
  'LPKA Kelas I Martapura': ['Lapas Perempuan Kelas IIA Martapura', 'Martapura di Kabupaten Banjar, Kalimantan Selatan'],
  'LPKA Kelas II Jakarta': ['Lapas Kelas I Cipinang', 'satu kompleks di Cipinang, Jakarta Timur'],
  'LPKA Kelas II Muara Bulia': ['Lapas Kelas IIB Muara Bulian', 'kota yang sama; daftar nasional menulis "Bulia"'],
  'Lapas Kelas IIA Gladakan Nusakambangan': ['Lapas Kelas IIA Besi Nusakambangan', 'satu pulau'],
  'Lapas Kelas IIA Kumbang Nusakambangan': ['Lapas Kelas IIA Besi Nusakambangan', 'satu pulau'],
  'Lapas Kelas IIA Ngaseman Nusakambangan': ['Lapas Kelas IIA Besi Nusakambangan', 'satu pulau'],
  'Lapas Kelas IIB Nirbaya Nusakambangan': ['Lapas Kelas IIA Besi Nusakambangan', 'satu pulau'],
  'LPKA Kelas I Kutoarjo': ['Rutan Kelas IIB Purworejo', 'Kutoarjo sebuah kecamatan di Purworejo'],
  'Lapas Kelas III Batulicin': ['Lapas Kelas IIA Kotabaru', 'Tanah Bumbu berbatasan dengan Kotabaru'],
  'LPKA Kelas II Lombok Tengah': ['Rutan Kelas IIB Praya', 'Praya ibu kota Lombok Tengah'],
  'LPKA Kelas II Jayapura': ['Lapas Kelas IIA Abepura', 'Abepura bagian dari Kota Jayapura'],
  'Lapas Kelas IIB Maros': ['Lapas Kelas I Makassar', 'Maros berbatasan dengan Kota Makassar'],
  'LPKA Kelas II Maros': ['Lapas Kelas I Makassar', 'Maros berbatasan dengan Kota Makassar'],
  'LPKA Kelas II Tomohon': ['Lapas Kelas IIB Tondano', 'Tomohon berbatasan dengan Tondano'],
}

// --------------------------------------------------------------------- CSV

function baraiCsv(teks) {
  const baris = []
  let sel = []
  let nilai = ''
  let kutip = false

  for (let i = 0; i < teks.length; i += 1) {
    const c = teks[i]
    if (kutip) {
      if (c === '"') {
        if (teks[i + 1] === '"') { nilai += '"'; i += 1 } else kutip = false
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

function bacaCsv(jalur) {
  const baris = baraiCsv(readFileSync(jalur, 'utf8').replace(/^﻿/, ''))
  const kepala = baris[0].map((h) => h.trim())
  return baris.slice(1).map((b) => Object.fromEntries(kepala.map((h, i) => [h, (b[i] ?? '').trim()])))
}

function selCsv(nilai) {
  const teks = String(nilai ?? '')
  return /[",\n]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks
}

function tulisCsv(jalur, kepala, baris) {
  const isi = [kepala.join(',')]
  for (const b of baris) isi.push(kepala.map((k) => selCsv(b[k])).join(','))
  mkdirSync(dirname(jalur), { recursive: true })
  writeFileSync(jalur, `${isi.join('\n')}\n`)
}

// ------------------------------------------------------------- penamaan

/**
 * Kelas yang ditulis "II A" pada daftar nasional dirapatkan menjadi "IIA".
 *
 * Spasi sebelum huruf kelas hanya ikut ditelan ketika huruf itu memang ada.
 * Bentuk `\s*([AB])?` yang terlihat lebih rapi justru menelan spasi pemisah
 * pada "Kelas I Tangerang" dan menghasilkan "Kelas Itangerang" — 80 unit
 * sempat tercatat sebagai unit baru karena itu.
 */
const KELAS = /\bKELAS\s+(I{1,3})(\s*[AB])?(?![A-Za-z])/i

const KATA_TETAP = new Set(['LPKA'])

/** Huruf besar hanya pada awal kata, kecuali angka Romawi dan singkatan. */
function judulkan(teks) {
  return teks
    .split(' ')
    .map((k) => {
      if (KATA_TETAP.has(k)) return k
      if (/^(I{1,3})([AB])?$/.test(k)) return k.toUpperCase()
      if (/^[A-Z]+-[A-Z]+$/.test(k)) return k.split('-').map(judulkan).join('-')
      return k.charAt(0) + k.slice(1).toLowerCase()
    })
    .join(' ')
}

/**
 * Mengubah satu baris daftar nasional menjadi bentuk yang dipakai data induk.
 * Bentuknya sengaja diuji ulang terhadap 492 unit yang sudah ada: bila fungsi
 * ini benar, ia menghasilkan persis nama yang sudah tersimpan untuk mereka.
 */
function bakukanNama(mentah) {
  let n = mentah.toUpperCase().replace(/\s+/g, ' ').trim()
  n = n.replace(/^LEMBAGA PEMBINAAN KHUSUS ANAK\b/, 'LPKA')
  n = n.replace(/^LEMBAGA PEMASYARAKATAN\b/, 'LAPAS')
  n = n.replace(/^RUMAH TAHANAN NEGARA\b/, 'RUTAN')
  n = n.replace(KELAS, (_, romawi, huruf) => `KELAS ${romawi}${(huruf || '').trim()}`)
  return judulkan(n)
}

function jenisDari(nama) {
  const n = nama.toUpperCase()
  if (n.startsWith('LPKA') || n.includes('PEMBINAAN KHUSUS ANAK')) return 'LPKA'
  if (n.startsWith('BAPAS') || n.startsWith('BALAI PEMASYARAKATAN')) return 'Bapas'
  if (n.startsWith('RUMAH SAKIT')) return 'RS'
  if (n.startsWith('RUTAN') || n.startsWith('RUMAH TAHANAN')) return 'Rutan'
  return 'Lapas'
}

function kelasDari(nama) {
  const m = KELAS.exec(nama)
  return m ? `${m[1].toUpperCase()}${(m[2] || '').trim().toUpperCase()}` : ''
}

/**
 * Subjenis unit baru selalu "Umum", termasuk untuk LPKA.
 *
 * Godaannya adalah menulis "Anak" di sana, dan itu keliru. Mesin pencocokan
 * memberi tambahan skor ketika kata subjenis muncul di teks, dan kata "anak"
 * muncul pada hampir setiap berita LPKA — tambahan yang diberikan kepada semua
 * kandidat sekaligus tidak membedakan apa pun, tetapi cukup untuk mendorong
 * cocok-sebagian yang lemah melewati ambang penerimaan otomatis. Jenis LPKA
 * sendiri sudah menyimpan keterangan itu.
 */
function subjenisDari(nama) {
  const n = nama.toUpperCase()
  if (n.startsWith('LPKA')) return 'Umum'
  if (n.includes('NARKOTIKA')) return 'Narkotika'
  if (n.includes('PEREMPUAN') || n.includes('WANITA')) return 'Perempuan'
  if (n.includes('PEMUDA')) return 'Pemuda'
  if (n.includes('TERBUKA')) return 'Terbuka'
  if (n.includes('KHUSUS')) return 'Khusus'
  return 'Umum'
}

const KATA_UMUM = new Set([
  'lapas', 'rutan', 'lpka', 'lpp', 'bapas', 'lembaga', 'pemasyarakatan', 'rumah',
  'tahanan', 'negara', 'balai', 'pembinaan', 'khusus', 'kelas', 'i', 'ii', 'iia',
  'iib', 'iii', 'ia', 'ib', 'umum', 'cabang', 'cab', 'kota', 'kabupaten', 'kab',
  'penempatan', 'sementara', 'daerah', 'wilayah', 'kantor', 'ditjenpas', 'pas',
])

function normal(nilai) {
  return String(nilai ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function token(nama) {
  return normal(nama).split(' ').filter((t) => t.length > 1 && !KATA_UMUM.has(t))
}

const kunci = (jenis, nama) => `${jenis}::${[...token(nama)].sort().join(' ')}`

/**
 * Bentuk petunjuk wilayah seperti yang dipakai data induk: nama kabupaten atau
 * kota dengan huruf besar, tanpa awalan "Kota" maupun "Kabupaten".
 */
function petunjukDari(kabkota) {
  return String(kabkota || '').replace(/^(Kota|Kabupaten)\s+/i, '').trim().toUpperCase()
}

// ------------------------------------------------------------------ susun

const nasional = bacaCsv(SUMBER_NASIONAL)
const lama = bacaCsv(SUMBER_LAMA)

/**
 * Baris kembar pada daftar nasional dibuang, dan dilaporkan.
 *
 * Daftar itu memuat 613 baris untuk 612 unit: "LAPAS KELAS IIA BUKITTINGGI"
 * tertulis dua kali. Selisih satu baris ini bukan hal sepele — tanpa dibuang,
 * data induk berisi satu unit kembar, dan setiap angka "jumlah UPT" di layar
 * ikut salah satu. Ia dilaporkan, bukan dibuang diam-diam, karena selisih
 * antara 531 unit hasil daftar ini dan 532 unit hasil pengurangan angka
 * Ditjenpas justru berasal dari sini.
 */
const kembar = []
const terlihat = new Set()
const nasionalUnik = nasional.filter((r) => {
  const k = `${r.kanwil}::${r.nama_upt}`.toUpperCase()
  if (terlihat.has(k)) { kembar.push(r.nama_upt); return false }
  terlihat.add(k)
  return true
})

const terpantau = nasionalUnik
  .map((r) => ({ kanwilSumber: r.kanwil, mentah: r.nama_upt }))
  .filter((r) => !JENIS_DILEWATI.has(jenisDari(r.mentah)))

const petaPadanan = new Map(PADANAN.map(([dari, ke, alasan, opsi]) => [dari.toUpperCase(), { ke, alasan, ...opsi }]))
const petaLama = new Map(lama.map((l) => [l.nama_upt, l]))

/** Nama provinsi menurut kanwilnya, dibaca dari data induk, tidak ditulis tangan. */
const PROVINSI_KANWIL = Object.fromEntries(lama.map((l) => [l.kanwil, l.provinsi]))

const petaLamaKunci = new Map()
for (const l of lama) {
  const k = kunci(l.jenis_upt, l.nama_upt)
  if (!petaLamaKunci.has(k)) petaLamaKunci.set(k, [])
  petaLamaKunci.get(k).push(l)
}

const masalah = []
const hasil = []
const dipakaiLama = new Set()
const gantiNama = []

for (const r of terpantau) {
  const jenis = jenisDari(r.mentah)
  const baku = bakukanNama(r.mentah)
  const padanan = petaPadanan.get(r.mentah.toUpperCase())

  let induk = null
  if (padanan) {
    induk = petaLama.get(padanan.ke) || null
    if (!induk) masalah.push(`PADANAN menunjuk "${padanan.ke}" yang tidak ada di data induk.`)
  } else {
    const kandidat = (petaLamaKunci.get(kunci(jenis, baku)) || []).filter((l) => !dipakaiLama.has(l.nama_upt))
    induk = kandidat[0] || null
  }

  if (induk) dipakaiLama.add(induk.nama_upt)

  // Nama induk yang sudah berjalan selalu menang, kecuali pada unit yang naik
  // status — di situ jenisnya berubah, dan namanya harus ikut.
  const namaAkhir = induk && !padanan?.gantiNama ? induk.nama_upt : baku
  if (induk && padanan?.gantiNama && induk.nama_upt !== baku) {
    gantiNama.push({ dari: induk.nama_upt, ke: baku })
  }

  hasil.push({
    nama_upt: namaAkhir,
    jenis_upt: jenis,
    kelas_upt: kelasDari(baku) || induk?.kelas_upt || '',
    subjenis_upt: induk && !padanan?.gantiNama ? (induk.subjenis_upt || 'Umum') : subjenisDari(baku),
    provinsi: induk?.provinsi || '',
    kanwil: induk?.kanwil || `Kantor Wilayah Ditjenpas ${r.kanwilSumber.replace(/^D\. I\. /, 'D.I. ')}`,
    kabupaten_kota: induk?.kabupaten_kota || KABKOTA_TAMBALAN[namaAkhir] || KABKOTA_BARU[namaAkhir] || '',
    alamat: induk?.alamat || '',
    latitude: induk?.latitude || '',
    longitude: induk?.longitude || '',
    coordinate_quality: induk?.coordinate_quality || '',
    coordinate_source: induk?.coordinate_source || '',
    coordinate_score: induk?.coordinate_score || '',
    location_hint: induk?.location_hint || '',
    aktif: 'True',
    catatan_verifikasi: induk?.catatan_verifikasi || '',
    baru: induk ? '' : 'baru',
    namaNasional: baku,
  })
}

// --------------------------------------------- koordinat untuk unit baru

/**
 * Unit baru mewarisi titik dari unit lain di tempat yang sama.
 *
 * Ini bukan koordinat gedungnya, dan berkas ini tidak berpura-pura sebaliknya:
 * 491 dari 492 unit lama pun masih memakai titik pusat kota, dan seluruhnya
 * bertanda "wajib diperiksa Super Admin". Yang dihindari adalah menaruh unit
 * baru pada koordinat kosong, sebab peta akan diam-diam menampilkan 531 unit
 * sebagai 492 penanda — persis jenis kesalahan diam yang ingin dihentikan
 * sistem ini.
 *
 * Pewarisan memakai nama tempat pada nama unit, bukan kolom kabupaten/kota.
 * Kolom itu pada data lama tidak bisa dipercaya untuk keperluan ini: enam unit
 * di Kota Tangerang tercatat di "Kota Tangerang Selatan", seluruh unit Kota
 * Bandung tercatat di "Bandung Barat", dan tiga unit Palangkaraya tidak punya
 * isi sama sekali. Nama unitnya sendiri jauh lebih jujur — "LPKA Kelas I
 * Tangerang" memang bertetangga dengan "Lapas Kelas I Tangerang".
 */
const perTempat = new Map()
for (const l of lama) {
  if (!l.latitude) continue
  const t = token(l.nama_upt).join('')
  if (t && !perTempat.has(t)) perTempat.set(t, l)
}

/** Cadangan terakhir: satu unit mana pun di provinsi yang sama. */
const perProvinsi = new Map()
for (const l of lama) {
  if (!l.latitude || !l.provinsi) continue
  if (!perProvinsi.has(l.provinsi)) perProvinsi.set(l.provinsi, l)
}

let diwarisiTempat = 0
let diwarisiProvinsi = 0

for (const h of hasil) {
  if (h.latitude || !h.baru) continue

  const provinsi = h.provinsi || PROVINSI_KANWIL[h.kanwil] || ''
  const [namaPinjam, alasanPinjam] = KOORDINAT_PINJAM[h.nama_upt] || []
  const sekota = namaPinjam ? petaLama.get(namaPinjam) : perTempat.get(token(h.nama_upt).join(''))

  if (namaPinjam && !sekota) {
    masalah.push(`KOORDINAT_PINJAM menunjuk "${namaPinjam}" yang tidak ada di data induk.`)
  }

  if (sekota) {
    h.provinsi = h.provinsi || sekota.provinsi
    h.latitude = sekota.latitude
    h.longitude = sekota.longitude
    h.coordinate_quality = 'Titik wilayah—warisan unit terdekat'
    h.coordinate_source = alasanPinjam
      ? `Diwarisi dari ${sekota.nama_upt}: ${alasanPinjam}`
      : `Diwarisi dari ${sekota.nama_upt}, nama tempat yang sama`
    h.coordinate_score = '0.50'
    // Petunjuk wilayah diambil dari kabupaten/kota unit itu sendiri, BUKAN dari
    // unit yang dipinjam titiknya. Keduanya kerap berbeda kabupaten: LPKA
    // Tomohon meminjam titik Lapas Tondano di Minahasa, LPKA Sungai Raya
    // meminjam titik Lapas Pontianak. Mesin memakai kolom ini untuk menambah
    // skor ketika nama wilayahnya ikut disebut berita, sehingga petunjuk milik
    // kabupaten tetangga menambah skor pada berita yang salah.
    h.location_hint = petunjukDari(h.kabupaten_kota) || sekota.location_hint || ''
    h.catatan_verifikasi = 'Unit baru pada data induk. Titik masih titik wilayah, BUKAN lokasi gedung; wajib diperiksa Super Admin.'
    diwarisiTempat += 1
    continue
  }

  // Tidak ada satu pun unit yang bisa dipinjam titiknya. Titiknya diturunkan ke
  // titik provinsi, dan diberi tanda yang mengatakan persis itu. Penanda peta
  // yang meleset sejauh satu provinsi masih lebih baik daripada unit yang
  // tidak pernah muncul di peta sama sekali — asalkan tidak ada yang mengira
  // titik itu alamat gedungnya.
  const seprovinsi = provinsi ? perProvinsi.get(provinsi) : null
  if (!seprovinsi) {
    masalah.push(`Tidak ada titik yang bisa diwarisi unit baru "${h.nama_upt}" (${provinsi || 'provinsi tidak diketahui'}).`)
    continue
  }

  h.provinsi = provinsi
  h.latitude = seprovinsi.latitude
  h.longitude = seprovinsi.longitude
  h.coordinate_quality = 'Titik provinsi—belum ditentukan'
  h.coordinate_source = `Titik sementara provinsi ${provinsi}; belum ada unit lain di ${h.kabupaten_kota || 'kota ini'}`
  h.coordinate_score = '0.20'
  h.location_hint = ''
  h.catatan_verifikasi = 'Unit baru tanpa unit tetangga. Titiknya masih titik provinsi, BUKAN lokasi gedung; wajib ditentukan Super Admin.'
  diwarisiProvinsi += 1
}

// ------------------------------------------------------------- pemeriksaan

const yatim = lama.filter((l) => !dipakaiLama.has(l.nama_upt))
for (const y of yatim) masalah.push(`Unit lama "${y.nama_upt}" tidak ada padanannya di daftar nasional.`)

const namaGanda = new Map()
for (const h of hasil) namaGanda.set(h.nama_upt, (namaGanda.get(h.nama_upt) || 0) + 1)
for (const [nama, n] of namaGanda) if (n > 1) masalah.push(`Nama kembar pada hasil: "${nama}" muncul ${n} kali.`)

/**
 * Koordinat kosong menjatuhkan alat ini; kabupaten/kota kosong tidak.
 *
 * Tujuh belas unit sudah masuk ke data induk tanpa kabupaten/kota jauh sebelum
 * penyusunan ini — Palangkaraya, Pangkal Pinang, Tanjung Pinang, dan beberapa
 * lainnya. Lubang itu nyata dan pantas diperbaiki, tetapi ia bukan akibat
 * penyusunan ini, dan menjadikannya kegagalan berarti alat ini tidak pernah
 * bisa berhasil sampai seseorang membereskan pekerjaan yang lain. Ia dicatat
 * sebagai catatan, dan dihitung, supaya tidak terlupakan.
 */
const catatan = []
for (const h of hasil) {
  if (!h.latitude || !h.longitude) masalah.push(`Tanpa koordinat: ${h.nama_upt}`)
  if (!h.provinsi) masalah.push(`Tanpa provinsi: ${h.nama_upt}`)
  if (!h.kabupaten_kota) catatan.push(`Tanpa kabupaten/kota: ${h.nama_upt}${h.baru ? ' (UNIT BARU)' : ''}`)

  // Provinsi harus sejalan dengan kanwilnya.
  //
  // Pemeriksaan ini menangkap satu kekeliruan yang tidak akan terlihat dengan
  // cara lain: nama kota yang dipakai dua daerah sekaligus. LPKA Martapura di
  // Kalimantan Selatan sempat mewarisi titik Lapas Martapura di Sumatera
  // Selatan — koordinatnya terisi, kabupatennya terisi, dan penandanya muncul
  // 1.500 kilometer dari tempat seharusnya tanpa satu pun tanda peringatan.
  const seharusnya = PROVINSI_KANWIL[h.kanwil]
  if (seharusnya && h.provinsi && h.provinsi !== seharusnya) {
    masalah.push(`Provinsi tidak sejalan dengan kanwil: ${h.nama_upt} — provinsi "${h.provinsi}", kanwil "${h.kanwil}".`)
  }
}

// ------------------------------------------------------------------ tulis

const KEPALA = [
  'nama_upt', 'jenis_upt', 'kelas_upt', 'subjenis_upt', 'provinsi', 'kanwil',
  'kabupaten_kota', 'alamat', 'latitude', 'longitude', 'coordinate_quality',
  'coordinate_source', 'coordinate_score', 'location_hint', 'aktif', 'catatan_verifikasi',
]

hasil.sort((a, b) => a.kanwil.localeCompare(b.kanwil, 'id') || a.nama_upt.localeCompare(b.nama_upt, 'id'))
tulisCsv(KELUARAN_CSV, KEPALA, hasil)

// ------------------------------------------------------------------- SQL

const sql = (nilai) => (nilai === '' || nilai == null ? 'null' : `'${String(nilai).replace(/'/g, "''")}'`)
const angka = (nilai) => (nilai === '' || nilai == null ? 'null' : String(Number(nilai)))

/**
 * Migrasi memuat SELISIHNYA saja, bukan seluruh 531 unit.
 *
 * Data 492 unit yang sudah ada memang berasal dari tabel itu sendiri; menulis
 * ulang seluruhnya berarti mengirim 198 kilobita SQL untuk mengubah nol baris,
 * dan setiap kolom koordinat yang pernah diperbaiki Super Admin melewati sekali
 * lagi jalur tulis yang tidak perlu ia lewati. Yang ditulis di sini hanya empat
 * penggantian nama dan unit yang benar-benar baru.
 *
 * Potret lengkap 531 unit tetap ada, sebagai data/master-upt.csv. Itulah berkas
 * yang dibaca seluruh alat uji, dan itulah yang dibandingkan bila suatu saat
 * tabelnya perlu disusun ulang dari nol.
 */
const unitBaru = hasil.filter((h) => h.baru)

const baris = unitBaru.map((h) => `  (${[
  sql(h.nama_upt), sql(h.jenis_upt), sql(h.kelas_upt), sql(h.subjenis_upt), sql(h.provinsi),
  sql(h.kanwil), sql(h.kabupaten_kota), angka(h.latitude), angka(h.longitude),
  sql(h.coordinate_quality), sql(h.coordinate_source), angka(h.coordinate_score),
  sql(h.location_hint), sql(h.catatan_verifikasi), 'true',
].join(', ')})`).join(',\n')

const gantiSql = gantiNama.map(({ dari, ke }) => `
update public.upt       set nama_upt     = ${sql(ke)}, jenis_upt = 'Lapas', updated_at = now()
                        where nama_upt   = ${sql(dari)};
update public.berita    set nama_upt     = ${sql(ke)} where nama_upt     = ${sql(dari)};
update public.app_users set assigned_upt = ${sql(ke)} where assigned_upt = ${sql(dari)};`).join('')

writeFileSync(KELUARAN_SQL, `-- Data induk UPT: 492 menjadi ${hasil.length} unit.
--
-- Dihasilkan oleh tools/susun-master-upt.mjs dari data/sumber/daftar-upt-nasional.csv
-- (${nasional.length} baris, ${kembar.length} di antaranya kembar) dikurangi Bapas dan Rumah Sakit
-- Pengayoman. Potret lengkapnya ada di data/master-upt.csv.
--
-- ${unitBaru.length} unit ditambahkan, ${unitBaru.filter((h) => h.jenis_upt === 'LPKA').length} di antaranya seluruh LPKA di Indonesia —
-- sampai migrasi ini tidak ada satu pun LPKA di data induk, sehingga setiap
-- berita tentang anak yang berhadapan dengan hukum selalu berakhir
-- "Belum Teridentifikasi".
--
-- Tidak ada baris yang dihapus. Empat unit yang naik status dari Rutan menjadi
-- Lapas diganti namanya, dan berita serta penugasan pengguna yang menunjuk nama
-- lama ikut diperbarui pada transaksi yang sama.
--
-- Koordinat ${unitBaru.length} unit baru diwarisi dari unit terdekat dan ditandai demikian.
-- Tidak satu pun di antaranya alamat gedung; seluruhnya menunggu verifikasi
-- Super Admin, sama seperti 491 unit lama.

begin;

-- 1. Unit yang naik status dari Rutan menjadi Lapas. Dijalankan lebih dulu
--    supaya penyisipan di bawah mengenali mereka lewat nama barunya, bukan
--    menyisipkan unit kembar.
${gantiSql}

-- 2. Unit yang belum ada di data induk. Klausa "on conflict do nothing" membuat
--    migrasi ini aman dijalankan dua kali, dan membuatnya tidak pernah menimpa
--    koordinat yang sudah diperbaiki tangan.
insert into public.upt (
  nama_upt, jenis_upt, kelas_upt, subjenis_upt, provinsi, kanwil, kabupaten_kota,
  latitude, longitude, coordinate_quality, coordinate_source, coordinate_score,
  location_hint, catatan_verifikasi, aktif
)
values
${baris}
on conflict (nama_upt) do nothing;

commit;
`)

// ---------------------------------------------------------------- laporan

const perJenis = {}
for (const h of hasil) perJenis[h.jenis_upt] = (perJenis[h.jenis_upt] || 0) + 1

console.log('')
console.log('  Daftar nasional      :', nasional.length, 'baris')
console.log('  Baris kembar dibuang :', kembar.length, kembar.length ? `(${kembar.join(', ')})` : '')
console.log('  Bapas & RS dilewati  :', nasionalUnik.length - terpantau.length)
console.log('  Unit terpantau       :', hasil.length)
console.log('  Menurut jenis        :', JSON.stringify(perJenis))
console.log('  Sudah ada di induk   :', hasil.length - hasil.filter((h) => h.baru).length)
console.log('  Unit baru            :', hasil.filter((h) => h.baru).length,
  `(${diwarisiTempat} mewarisi titik unit setempat, ${diwarisiProvinsi} masih titik provinsi)`)
console.log('  Ganti nama           :', gantiNama.length)
for (const g of gantiNama) console.log('     ', g.dari, '→', g.ke)
console.log('')
console.log('  Ditulis:', KELUARAN_CSV.replace(AKAR, '.'))
console.log('  Ditulis:', KELUARAN_SQL.replace(AKAR, '.'))

if (catatan.length) {
  console.log('')
  console.log(`  CATATAN — ${catatan.length} unit tanpa kabupaten/kota (warisan data lama):`)
  for (const c of catatan) console.log('   -', c)
}

if (masalah.length) {
  console.log('')
  console.log('  MASALAH:')
  for (const m of masalah) console.log('   -', m)
  process.exitCode = 1
} else {
  console.log('')
  console.log('  Tidak ada unit yatim, tidak ada nama kembar, seluruh unit berkoordinat.')
}
console.log('')
