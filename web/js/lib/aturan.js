/**
 * Mesin aturan peringatan — IF … THEN, disusun petugas, bukan ditanam di kode.
 *
 * `lib/peringatan-laju.js` sudah menjalankan empat aturan pola, dan keempatnya
 * tetap di sana: keempatnya menjawab pertanyaan yang sama bagi seluruh
 * Indonesia dan tidak pantas dimatikan seseorang. Yang belum ada sampai berkas
 * ini ditulis adalah aturan yang menjawab pertanyaan SATU kantor:
 *
 *   Bila sebuah peristiwa di wilayah saya berskor di atas 65 dan diangkat
 *   tiga media, kabari saya — sekalipun urgensinya baru "Sedang".
 *
 * Aturan seperti itu tidak bisa ditulis di dalam kode, sebab ambangnya berbeda
 * di tiap kantor dan berubah tiap triwulan. Ia harus bisa disusun, dibaca
 * ulang, dan dimatikan oleh orang yang memakainya.
 *
 * ## Kosakata tingkatnya bukan kosakata baru
 *
 * Tingkat peringatan memakai empat nama yang sudah dikenal petugas — Rendah,
 * Sedang, Tinggi, Kritis — yang sama persis dengan tingkat urgensi dan tingkat
 * risiko. Daftar periksa menyebut lima nama lain (Informational, Low, Medium,
 * High, Critical). Kelimanya tidak dipakai, dan alasannya sama dengan alasan
 * `TEMA_LAPORAN` bukan taksonomi kedua: satu layar yang menampilkan lencana
 * "High" di sebelah lencana "Tinggi" memaksa pembacanya menebak apakah
 * keduanya hal yang sama.
 *
 * ## Tidak ada eskalasi otomatis
 *
 * Aturan di sini MENEMUKAN dan MENYUSUN, tidak mengirim. Bidang `eskalasi`
 * menyebut kepada siapa temuan itu pantas dinaikkan, dan bidang `saluran`
 * menyebut lewat apa — keduanya keterangan bagi manusia yang menekan tombol
 * kirim di halaman Distribusi, bukan perintah kepada mesin. Sistem intelijen
 * yang mengirim sendiri ke grup pimpinan atas dasar ambang angka akan salah
 * kirim pada hari pertama ambangnya keliru, dan pesan yang sudah terkirim
 * tidak bisa ditarik.
 */

import { dasar } from './hitung.js'
import { ember, labelEmber } from './sentimen.js'
import { kelompokkanPeristiwa } from './peristiwa.js'
import { skorRisiko, TINGKAT_RISIKO } from './risiko.js'
import { belumTerpetakan } from './unit-terpetakan.js'

const KUNCI = 'transsiberpas.aturan'
const JAM = 3_600_000

/** Batas jumlah aturan buatan sendiri. */
export const BATAS = 40

/* ------------------------------------------------------------------ sinyal */

/**
 * Sinyal yang boleh disebut sebuah syarat.
 *
 * Daftar tertutup, dan itu disengaja. Kotak isian bebas akan menghasilkan
 * aturan yang menyebut nama kolom yang salah ketik — aturan yang tersimpan,
 * tampil di daftar, tidak pernah menyala, dan tidak pernah mengeluh.
 *
 * `ambil` menerima satu peristiwa beserta dasar penilaiannya yang sudah
 * dihitung sekali, sehingga seratus aturan atas seribu peristiwa tidak
 * menghitung ulang skor risiko seratus ribu kali.
 */
export const SINYAL = [
  {
    kode: 'skor', label: 'Skor risiko', jenis: 'angka', satuan: '0–100',
    ket: 'Skor gabungan enam faktor di lib/risiko.js.',
    ambil: (p, k) => k.risiko.skor,
  },
  {
    kode: 'tekanan', label: 'Tekanan pemberitaan', jenis: 'angka', satuan: '0–100',
    ket: 'Skor sebelum dikalikan gerbang sentimen — besar untuk kegiatan positif yang ramai.',
    ambil: (p, k) => k.risiko.tekanan,
  },
  {
    kode: 'publikasi', label: 'Jumlah publikasi', jenis: 'angka', satuan: 'terbitan',
    ket: 'Berapa kali peristiwa ini diberitakan.',
    ambil: (p) => p.jumlah_publikasi,
  },
  {
    kode: 'media', label: 'Jumlah media', jenis: 'angka', satuan: 'media',
    ket: 'Berapa penerbit berbeda mengangkatnya. Lebih berarti daripada jumlah publikasi.',
    ambil: (p) => p.jumlah_media,
  },
  {
    kode: 'platform', label: 'Jumlah platform', jenis: 'angka', satuan: 'platform',
    ket: 'Berapa kanal berbeda — penyeberangan antarplatform sulit dihentikan.',
    ambil: (p, k) => k.platform,
  },
  {
    kode: 'usia_jam', label: 'Usia peristiwa', jenis: 'angka', satuan: 'jam',
    ket: 'Berapa jam sejak terbitan pertamanya.',
    ambil: (p, k) => k.usiaJam,
  },
  {
    kode: 'diam_jam', label: 'Sunyi sejak terbitan terakhir', jenis: 'angka', satuan: 'jam',
    ket: 'Berapa jam sejak terbitan terakhir. Kecil berarti masih berlangsung.',
    ambil: (p, k) => k.diamJam,
  },
  {
    kode: 'urgensi', label: 'Urgensi', jenis: 'urutan', pilihan: ['Rendah', 'Sedang', 'Tinggi', 'Kritis'],
    ket: 'Urgensi tertinggi di antara publikasinya.',
    ambil: (p) => p.urgensi,
  },
  {
    kode: 'sentimen', label: 'Sentimen', jenis: 'pilihan', pilihan: ['Negatif', 'Netral / Campuran', 'Positif', 'Belum dinilai'],
    ket: 'Ember sentimen menurut lib/sentimen.js.',
    ambil: (p, k) => k.sentimen,
  },
  {
    kode: 'kategori', label: 'Kategori', jenis: 'teks',
    ket: 'Nama kategori isu.',
    ambil: (p) => p.kategori || '',
  },
  {
    kode: 'subkategori', label: 'Subkategori', jenis: 'teks',
    ket: 'Nama subkategori isu.',
    ambil: (p) => p.subkategori || '',
  },
  {
    kode: 'unit', label: 'Unit', jenis: 'teks',
    ket: 'Nama UPT. Kosong bila unitnya belum teridentifikasi.',
    ambil: (p) => (belumTerpetakan(p.nama_upt) ? '' : p.nama_upt || ''),
  },
  {
    kode: 'wilayah', label: 'Wilayah', jenis: 'teks',
    ket: 'Kantor wilayah atau provinsi asal.',
    ambil: (p, k) => k.wilayah,
  },
  {
    kode: 'ditanggapi', label: 'Sudah ada sikap resmi', jenis: 'boolean',
    ket: 'Benar bila salah satu publikasinya sudah mendapat sikap resmi unit.',
    ambil: (p, k) => k.ditanggapi,
  },
  {
    kode: 'tertelaah', label: 'Sudah ditelaah analis', jenis: 'boolean',
    ket: 'Benar bila seluruh publikasinya sudah berstatus Terverifikasi.',
    ambil: (p, k) => k.tertelaah,
  },
]

const PETA_SINYAL = new Map(SINYAL.map((s) => [s.kode, s]))
export function sinyalDari(kode) { return PETA_SINYAL.get(kode) || null }

/* -------------------------------------------------------------- pembanding */

/**
 * Pembanding, beserta jenis sinyal yang boleh memakainya.
 *
 * `urutan` diperlakukan sebagai angka lewat kedudukannya di daftar pilihan,
 * sehingga "urgensi ≥ Tinggi" berarti Tinggi atau Kritis — bukan pembandingan
 * abjad, yang akan menjadikan "Kritis" lebih kecil daripada "Sedang".
 */
export const BANDING = [
  { kode: 'ge', tanda: '≥', label: 'sekurangnya', jenis: ['angka', 'urutan'] },
  { kode: 'gt', tanda: '>', label: 'lebih dari', jenis: ['angka', 'urutan'] },
  { kode: 'le', tanda: '≤', label: 'paling banyak', jenis: ['angka', 'urutan'] },
  { kode: 'lt', tanda: '<', label: 'kurang dari', jenis: ['angka', 'urutan'] },
  { kode: 'eq', tanda: '=', label: 'sama dengan', jenis: ['angka', 'urutan', 'pilihan', 'teks', 'boolean'] },
  { kode: 'ne', tanda: '≠', label: 'bukan', jenis: ['angka', 'urutan', 'pilihan', 'teks', 'boolean'] },
  { kode: 'memuat', tanda: '⊃', label: 'memuat', jenis: ['teks'] },
  { kode: 'kosong', tanda: '∅', label: 'kosong', jenis: ['teks'] },
]

const PETA_BANDING = new Map(BANDING.map((b) => [b.kode, b]))

/** Pembanding yang sah untuk sebuah sinyal. Dipakai penyusun aturan di layar. */
export function bandingUntuk(kodeSinyal) {
  const s = sinyalDari(kodeSinyal)
  if (!s) return []
  return BANDING.filter((b) => b.jenis.includes(s.jenis))
}

/* ------------------------------------------------------- eskalasi & saluran */

/**
 * Kepada siapa sebuah temuan pantas dinaikkan.
 *
 * Urutannya mengikuti jalur yang benar-benar berlaku, dan setiap tingkat
 * menyebut peran yang menerimanya di sistem ini — supaya "naikkan ke
 * direktorat" tidak menjadi kalimat tanpa alamat.
 */
export const ESKALASI = [
  { kode: 'analis', label: 'Analis intelijen media', urutan: 1, peran: 'media_intelligence_analyst' },
  { kode: 'evaluasi', label: 'Analis evaluasi dan mitigasi', urutan: 2, peran: 'evaluation_recommendation_analyst' },
  { kode: 'direktorat', label: 'Direktorat', urutan: 3, peran: 'super_admin' },
  { kode: 'pimpinan', label: 'Pimpinan', urutan: 4, peran: 'executive_decision_maker' },
]

export function eskalasiDari(kode) {
  return ESKALASI.find((e) => e.kode === kode) || ESKALASI[0]
}

export const SALURAN = [
  { kode: 'aplikasi', label: 'Dalam aplikasi', ket: 'Muncul di Peringatan Dini dan Ruang Analis.' },
  { kode: 'telegram', label: 'Telegram', ket: 'Disiapkan sebagai draf di halaman Distribusi. Tetap dikirim manusia.' },
]

/* ------------------------------------------------------------ aturan bawaan */

/**
 * Aturan bawaan.
 *
 * Ada dua alasan aturan bawaan dikirim bersama sistem, dan keduanya bukan
 * kemalasan. Pertama, halaman aturan yang kosong pada hari pertama tidak
 * mengajarkan apa pun tentang bahasa aturannya. Kedua, keempatnya adalah
 * pertanyaan yang memang selalu ditanyakan, dan menuntut tiap kantor
 * menyusunnya sendiri berarti menuntut empat puluh kantor menuliskan hal yang
 * sama dengan ambang yang berbeda-beda.
 *
 * Bawaan boleh dimatikan dan boleh disunting ambangnya. Yang tidak bisa adalah
 * menghapusnya — aturan yang hilang tidak meninggalkan jejak bahwa ia pernah
 * ada, dan kantor yang berganti petugas akan menyimpulkan sistemnya memang
 * tidak pernah memeriksa hal itu.
 */
export const ATURAN_BAWAAN = [
  {
    id: 'bawaan-kritis-cepat',
    nama: 'Kritis dan masih berjalan',
    ket: 'Peristiwa berskor kritis yang terbitan terakhirnya belum lewat sehari.',
    gabung: 'semua',
    syarat: [
      { sinyal: 'skor', banding: 'ge', nilai: 75 },
      { sinyal: 'diam_jam', banding: 'le', nilai: 24 },
    ],
    tingkat: 'Kritis',
    eskalasi: 'pimpinan',
    saluran: ['aplikasi', 'telegram'],
  },
  {
    id: 'bawaan-menyeberang',
    nama: 'Menyeberang ke banyak media',
    ket: 'Diangkat tiga media atau lebih dengan skor di atas menengah.',
    gabung: 'semua',
    syarat: [
      { sinyal: 'media', banding: 'ge', nilai: 3 },
      { sinyal: 'skor', banding: 'ge', nilai: 50 },
    ],
    tingkat: 'Tinggi',
    eskalasi: 'evaluasi',
    saluran: ['aplikasi'],
  },
  {
    id: 'bawaan-didiamkan',
    nama: 'Membesar tanpa sikap resmi',
    ket: 'Skor tinggi, masih berjalan, dan belum ada satu pun sikap resmi unit.',
    gabung: 'semua',
    syarat: [
      { sinyal: 'skor', banding: 'ge', nilai: 60 },
      { sinyal: 'ditanggapi', banding: 'eq', nilai: false },
      { sinyal: 'diam_jam', banding: 'le', nilai: 72 },
    ],
    tingkat: 'Tinggi',
    eskalasi: 'analis',
    saluran: ['aplikasi'],
  },
  {
    id: 'bawaan-lintas-platform',
    nama: 'Menyeberang antarplatform',
    ket: 'Muncul di dua platform berbeda atau lebih — pola yang paling sulit dihentikan.',
    gabung: 'semua',
    syarat: [
      { sinyal: 'platform', banding: 'ge', nilai: 2 },
      { sinyal: 'sentimen', banding: 'eq', nilai: 'Negatif' },
    ],
    tingkat: 'Sedang',
    eskalasi: 'analis',
    saluran: ['aplikasi'],
  },
  {
    id: 'bawaan-belum-ditelaah',
    nama: 'Berat tetapi belum ditelaah',
    ket: 'Urgensi tinggi ke atas dan belum seluruhnya melewati Antrean Telaah.',
    gabung: 'semua',
    syarat: [
      { sinyal: 'urgensi', banding: 'ge', nilai: 'Tinggi' },
      { sinyal: 'tertelaah', banding: 'eq', nilai: false },
    ],
    tingkat: 'Sedang',
    eskalasi: 'analis',
    saluran: ['aplikasi'],
  },
]

/* ------------------------------------------------------------- penyimpanan */

let memori = null

function baca() {
  if (memori) return memori
  try {
    const mentah = localStorage.getItem(KUNCI)
    const isi = mentah ? JSON.parse(mentah) : null
    memori = Array.isArray(isi?.daftar) ? isi.daftar : []
  } catch {
    memori = []
  }
  return memori
}

function tulis(daftar) {
  memori = daftar
  try {
    localStorage.setItem(KUNCI, JSON.stringify({ versi: 1, daftar }))
    return true
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ bentuk */

function idBaru() {
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function bakukanAturan(masuk = {}) {
  const tingkat = TINGKAT_RISIKO.some((t) => t.kode === masuk.tingkat) ? masuk.tingkat : 'Sedang'
  const syarat = (Array.isArray(masuk.syarat) ? masuk.syarat : [])
    .filter((s) => PETA_SINYAL.has(s?.sinyal) && PETA_BANDING.has(s?.banding))
    .slice(0, 8)
    .map((s) => ({ sinyal: s.sinyal, banding: s.banding, nilai: s.nilai }))

  return {
    id: masuk.id || idBaru(),
    nama: String(masuk.nama || 'Aturan tanpa nama').slice(0, 100),
    ket: String(masuk.ket || '').slice(0, 240),
    aktif: masuk.aktif !== false,
    gabung: masuk.gabung === 'salah_satu' ? 'salah_satu' : 'semua',
    syarat,
    tingkat,
    eskalasi: ESKALASI.some((e) => e.kode === masuk.eskalasi) ? masuk.eskalasi : 'analis',
    saluran: (Array.isArray(masuk.saluran) ? masuk.saluran : ['aplikasi'])
      .filter((s) => SALURAN.some((x) => x.kode === s)),
    bawaan: Boolean(masuk.bawaan),
    dibuat: masuk.dibuat || new Date().toISOString(),
  }
}

/**
 * Seluruh aturan yang berlaku: bawaan lebih dulu, lalu buatan sendiri.
 *
 * Bawaan yang pernah disunting disimpan dengan id yang sama, dan salinan
 * tersimpan itulah yang dipakai — sehingga ambang yang sudah disesuaikan
 * sebuah kantor tidak dikembalikan diam-diam ke angka bawaan pada penggelaran
 * berikutnya.
 */
export function daftarAturan() {
  const tersimpan = baca().map(bakukanAturan)
  const petaTersimpan = new Map(tersimpan.map((a) => [a.id, a]))

  const bawaan = ATURAN_BAWAAN.map((a) => {
    const disunting = petaTersimpan.get(a.id)
    return bakukanAturan({ ...a, ...(disunting || {}), bawaan: true })
  })

  const sendiri = tersimpan.filter((a) => !ATURAN_BAWAAN.some((b) => b.id === a.id))
  return [...bawaan, ...sendiri]
}

export function simpanAturan(masuk) {
  const a = bakukanAturan(masuk)
  const daftar = [...baca()]
  const posisi = daftar.findIndex((x) => x.id === a.id)

  if (posisi >= 0) {
    daftar[posisi] = a
    return { awet: tulis(daftar), baru: false, aturan: a, penuh: false }
  }

  const sendiri = daftar.filter((x) => !ATURAN_BAWAAN.some((b) => b.id === x.id))
  if (!a.bawaan && sendiri.length >= BATAS) {
    return { awet: true, baru: false, aturan: a, penuh: true }
  }

  daftar.push(a)
  return { awet: tulis(daftar), baru: true, aturan: a, penuh: false }
}

/**
 * Menghapus sebuah aturan.
 *
 * Aturan bawaan tidak bisa dihapus — yang terjadi adalah pemulihan ke
 * bentuk aslinya. Perbedaannya disebutkan kepada pemanggil lewat `dipulihkan`,
 * supaya layar bisa mengatakannya alih-alih membiarkan tombol "Hapus"
 * berperilaku diam-diam berbeda pada baris yang berbeda.
 */
export function hapusAturan(id) {
  const bawaan = ATURAN_BAWAAN.some((b) => b.id === id)
  tulis(baca().filter((a) => a.id !== id))
  return { dipulihkan: bawaan, dihapus: !bawaan }
}

export function setelAktif(id, aktif) {
  const ada = daftarAturan().find((a) => a.id === id)
  if (!ada) return null
  simpanAturan({ ...ada, aktif })
  return { ...ada, aktif }
}

export function kosongkanAturan() {
  tulis([])
  return daftarAturan()
}

/* ---------------------------------------------------------------- penilaian */

const URUTAN_URGENSI = ['Rendah', 'Sedang', 'Tinggi', 'Kritis']

/** Menyiapkan dasar penilaian sebuah peristiwa, sekali, untuk seluruh aturan. */
function siapkanKonteks(p, sekarang) {
  const risiko = skorRisiko(p, { sekarang })
  const pub = p.publikasi || []
  const akhir = new Date(p.tanggal_terakhir || 0).getTime()
  const awal = new Date(p.tanggal_pertama || 0).getTime()

  return {
    risiko,
    platform: new Set(pub.map((b) => b.platform).filter(Boolean)).size,
    wilayah: pub.find((b) => b.kanwil_asal)?.kanwil_asal || p.provinsi || '',
    sentimen: labelEmber(ember({ sentimen: p.sentimen })),
    ditanggapi: pub.some((b) => Boolean(b.tanggapan_sikap)),
    tertelaah: pub.length > 0 && pub.every((b) => b.status_verifikasi === 'Terverifikasi'),
    usiaJam: Number.isFinite(awal) && awal > 0 ? Math.max(0, (sekarang.getTime() - awal) / JAM) : 0,
    diamJam: Number.isFinite(akhir) && akhir > 0 ? Math.max(0, (sekarang.getTime() - akhir) / JAM) : 0,
  }
}

function bandingkan(banding, kiri, kanan) {
  switch (banding) {
    case 'ge': return kiri >= kanan
    case 'gt': return kiri > kanan
    case 'le': return kiri <= kanan
    case 'lt': return kiri < kanan
    case 'eq': return kiri === kanan
    case 'ne': return kiri !== kanan
    default: return false
  }
}

/**
 * Menilai satu syarat.
 *
 * Selalu mengembalikan kalimat dasarnya, bukan hanya benar/salah. Kalimat itu
 * yang muncul pada temuan di layar — sebuah peringatan yang tidak bisa
 * menjelaskan mengapa ia menyala akan diabaikan pada minggu kedua.
 */
export function nilaiSyarat(syarat, p, konteks) {
  const s = sinyalDari(syarat?.sinyal)
  const b = PETA_BANDING.get(syarat?.banding)
  if (!s || !b) return { lolos: false, dasar: 'Syarat tidak dikenali.' }

  const nilai = s.ambil(p, konteks)

  if (s.jenis === 'urutan') {
    const kiri = URUTAN_URGENSI.indexOf(String(nilai))
    const kanan = URUTAN_URGENSI.indexOf(String(syarat.nilai))
    const lolos = kiri >= 0 && kanan >= 0 && bandingkan(b.kode, kiri, kanan)
    return { lolos, dasar: `${s.label} ${nilai} ${b.tanda} ${syarat.nilai}` }
  }

  if (s.jenis === 'angka') {
    const kiri = Number(nilai) || 0
    const kanan = Number(syarat.nilai) || 0
    return {
      lolos: bandingkan(b.kode, kiri, kanan),
      dasar: `${s.label} ${Math.round(kiri)}${s.satuan && s.satuan !== '0–100' ? ` ${s.satuan}` : ''} ${b.tanda} ${kanan}`,
    }
  }

  if (s.jenis === 'boolean') {
    const kiri = Boolean(nilai)
    const kanan = syarat.nilai === true || syarat.nilai === 'true'
    return {
      lolos: b.kode === 'ne' ? kiri !== kanan : kiri === kanan,
      dasar: `${s.label}: ${kiri ? 'ya' : 'tidak'}`,
    }
  }

  // teks dan pilihan
  const kiri = String(nilai ?? '')
  const kanan = String(syarat.nilai ?? '')
  if (b.kode === 'kosong') {
    return { lolos: !kiri.trim(), dasar: `${s.label} kosong` }
  }
  if (b.kode === 'memuat') {
    return {
      lolos: Boolean(kanan) && kiri.toLowerCase().includes(kanan.toLowerCase()),
      dasar: `${s.label} memuat "${kanan}"`,
    }
  }
  return {
    lolos: bandingkan(b.kode, kiri, kanan),
    dasar: `${s.label} ${b.tanda} "${kanan}"`,
  }
}

/**
 * Menjalankan seluruh aturan yang aktif atas arsip yang termuat.
 *
 * Bekerja pada PERISTIWA, bukan pada publikasi. Aturan yang menyala per
 * publikasi akan menyala sebelas kali untuk satu pelarian yang diberitakan
 * sebelas media — dan sebelas peringatan tentang satu kejadian adalah cara
 * tercepat membuat orang berhenti membaca peringatan.
 */
export function jalankanAturan(berita = [], { sekarang = new Date(), aturan = null } = {}) {
  const daftar = (aturan || daftarAturan()).filter((a) => a.aktif && a.syarat.length)
  const peristiwa = kelompokkanPeristiwa(dasar(berita))

  const temuan = []
  const perAturan = new Map(daftar.map((a) => [a.id, 0]))

  for (const p of peristiwa) {
    const konteks = siapkanKonteks(p, sekarang)

    for (const a of daftar) {
      const hasil = a.syarat.map((s) => nilaiSyarat(s, p, konteks))
      const lolos = a.gabung === 'salah_satu'
        ? hasil.some((h) => h.lolos)
        : hasil.every((h) => h.lolos)
      if (!lolos) continue

      perAturan.set(a.id, perAturan.get(a.id) + 1)
      temuan.push({
        aturan: a,
        peristiwa: p,
        tingkat: a.tingkat,
        nada: TINGKAT_RISIKO.find((t) => t.kode === a.tingkat)?.nada || 'rendah',
        skor: konteks.risiko.skor,
        risiko: konteks.risiko,
        eskalasi: eskalasiDari(a.eskalasi),
        saluran: a.saluran,
        /* Hanya syarat yang benar-benar terpenuhi yang ditampilkan sebagai
           dasar. Pada aturan "salah satu", menampilkan seluruhnya berarti
           menampilkan alasan yang justru tidak berlaku. */
        dasar: hasil.filter((h) => h.lolos).map((h) => h.dasar),
      })
    }
  }

  const peringkat = { Kritis: 4, Tinggi: 3, Sedang: 2, Rendah: 1 }
  temuan.sort((a, b) => (peringkat[b.tingkat] - peringkat[a.tingkat]) || (b.skor - a.skor))

  return {
    temuan,
    perAturan: Object.fromEntries(perAturan),
    jumlahPeristiwa: peristiwa.length,
    aturanAktif: daftar.length,
  }
}

/**
 * Menerjemahkan sebuah aturan menjadi kalimat.
 *
 * Alasannya sama dengan `jelaskan()` di lib/kueri.js: aturan berisi empat
 * syarat tidak pernah salah menurut mesin, dan satu-satunya cara menemukan
 * anggapan yang keliru di kepala penyusunnya adalah membacanya kembali sebagai
 * kalimat biasa.
 */
export function ringkasAturan(a) {
  const bagian = a.syarat.map((s) => {
    const sinyal = sinyalDari(s.sinyal)
    const banding = PETA_BANDING.get(s.banding)
    if (!sinyal || !banding) return 'syarat tidak dikenali'
    if (banding.kode === 'kosong') return `${sinyal.label} kosong`
    if (sinyal.jenis === 'boolean') {
      const ya = s.nilai === true || s.nilai === 'true'
      return banding.kode === 'ne' ? `${sinyal.label} ${ya ? 'tidak' : 'ya'}` : `${sinyal.label} ${ya ? 'ya' : 'tidak'}`
    }
    return `${sinyal.label} ${banding.tanda} ${s.nilai}`
  })

  if (!bagian.length) return 'Aturan ini belum punya syarat, jadi tidak pernah menyala.'

  const hubung = a.gabung === 'salah_satu' ? ' atau ' : ' dan '
  return `Bila ${bagian.join(hubung)}, tandai ${a.tingkat} dan naikkan ke ${eskalasiDari(a.eskalasi).label}.`
}

export const META_ATURAN = {
  versi: 'aturan-v1.0',
  sinyal: SINYAL.length,
  banding: BANDING.length,
  bawaan: ATURAN_BAWAAN.length,
  kunci: KUNCI,
}
