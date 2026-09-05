/**
 * Pantauan — pencarian tersimpan dan daftar pantau, satu mekanisme.
 *
 * Daftar periksa memisahkan keduanya menjadi dua fitur: "saved search" dan
 * "watchlist". Di sini keduanya satu benda, dan penyatuan itu disengaja.
 *
 * Sebuah daftar pantau unit adalah pencarian tersimpan yang kuerinya
 * `upt:"Lapas Kelas IIA Cilegon"`. Daftar pantau kata kunci adalah pencarian
 * tersimpan yang kuerinya sebuah kata. Kalau keduanya dibangun sebagai dua
 * mekanisme, keduanya akan menyaring dengan aturan yang perlahan berbeda —
 * dan seorang petugas yang memantau Cilegon lewat daftar pantau akan melihat
 * angka yang berbeda dari petugas yang memantau Cilegon lewat pencarian
 * tersimpan, tanpa satu pun cara menjelaskan selisihnya.
 *
 * Yang membedakan keduanya di layar tinggal satu bidang: `jenis`. Ia hanya
 * menentukan ikon dan pengelompokan.
 *
 * ## Tempat tinggalnya
 *
 * Peramban, bukan basis data. Itu batas yang harus disebutkan di layar, bukan
 * disembunyikan: pantauan tidak berpindah ke komputer lain, tidak dibagi ke
 * rekan setim, dan hilang bila data situs dibersihkan. Alasannya sama dengan
 * alasan Peringatan Dini tidak punya ingatan — tabelnya belum ada. Ketika
 * tabel `pantauan` kelak dibuat, satu-satunya yang perlu berubah adalah kedua
 * fungsi `baca()` dan `tulis()` di bawah.
 *
 * ## Ambang
 *
 * Sebuah pantauan boleh diberi ambang: berapa banyak publikasi baru, dan
 * seberapa mendesak, sebelum ia dianggap **menyala**. Ambang itu yang membuat
 * daftar pantauan berbeda dari daftar tautan — 40 pantauan yang semuanya
 * tampil sama rata adalah 40 hal yang harus dibaca satu per satu setiap pagi.
 */

import { dasar, URGENSI_MENDESAK } from './hitung.js'
import { saringKueri, sebagaiKueri } from './kueri.js'
import { ember } from './sentimen.js'

const KUNCI = 'transsiberpas.pantauan'
const VERSI = 1

/** Batas jumlah pantauan. Di atas ini, daftar pantauan berhenti menjadi daftar. */
export const BATAS = 60

/**
 * Jenis pantauan.
 *
 * `bidang` menyebut nama bidang kueri yang dipakai saat pantauan dibuat dari
 * sebuah tombol "pantau" di halaman lain. Yang `null` disusun sendiri oleh
 * penggunanya di halaman pencarian.
 */
export const JENIS = [
  { kode: 'unit', label: 'Unit', ikon: 'peta', bidang: 'upt' },
  { kode: 'wilayah', label: 'Wilayah', ikon: 'peta', bidang: 'wilayah' },
  { kode: 'kategori', label: 'Kategori isu', ikon: 'kasus', bidang: 'kategori' },
  { kode: 'media', label: 'Media', ikon: 'berita', bidang: 'media' },
  { kode: 'kata', label: 'Kata kunci', ikon: 'cari', bidang: null },
  { kode: 'pencarian', label: 'Pencarian tersimpan', ikon: 'cari', bidang: null },
]

export function jenisPantauan(kode) {
  return JENIS.find((j) => j.kode === kode) || JENIS[JENIS.length - 1]
}

/* ------------------------------------------------------------- penyimpanan */

/**
 * Salinan dalam memori.
 *
 * Bukan singgahan untuk kecepatan, melainkan jaring pengaman: di jendela
 * penyamaran dan pada peramban yang menolak penyimpanan situs, `localStorage`
 * melempar pada setiap sentuhan. Tanpa salinan ini, halaman pantauan akan
 * tampak menerima setiap penambahan lalu melupakan seluruhnya pada penggambaran
 * berikutnya — rusak dengan cara yang tidak terlihat rusak.
 */
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
    localStorage.setItem(KUNCI, JSON.stringify({ versi: VERSI, daftar }))
    return true
  } catch {
    // Tersimpan di memori saja. Halaman menyebutkan ini kepada pembacanya.
    return false
  }
}

/** Benar bila pantauan benar-benar bertahan setelah tab ditutup. */
export function penyimpananAwet() {
  try {
    localStorage.setItem(`${KUNCI}.uji`, '1')
    localStorage.removeItem(`${KUNCI}.uji`)
    return true
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ bentuk */

function idBaru() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Membakukan sebuah pantauan.
 *
 * Dilewati SETIAP pantauan yang masuk, termasuk yang dibaca dari penyimpanan
 * lama, sehingga bidang yang kelak ditambahkan tidak pernah muncul sebagai
 * `undefined` di tengah halaman.
 */
export function bakukan(masuk = {}) {
  const jenis = JENIS.some((j) => j.kode === masuk.jenis) ? masuk.jenis : 'pencarian'
  return {
    id: masuk.id || idBaru(),
    jenis,
    nama: String(masuk.nama || masuk.kueri || 'Tanpa nama').slice(0, 120),
    kueri: String(masuk.kueri || '').slice(0, 400),
    ambang: {
      minimum: Math.max(0, Number(masuk.ambang?.minimum) || 0),
      hanyaMendesak: Boolean(masuk.ambang?.hanyaMendesak),
      hanyaNegatif: Boolean(masuk.ambang?.hanyaNegatif),
    },
    dibuat: masuk.dibuat || new Date().toISOString(),
    dilihat: masuk.dilihat || null,
  }
}

/**
 * Pantauan baku untuk sebuah nilai — dipakai tombol "Pantau" di halaman mana
 * pun.
 *
 * Satu penyusun, bukan satu per halaman: dua halaman yang menyusun kuerinya
 * sendiri akan menghasilkan dua pantauan yang tampak sama dan menyaring
 * berbeda, dan yang membuat keduanya tidak akan pernah tahu.
 */
export function pantauanUntuk(jenis, nama, tambahan = {}) {
  const j = jenisPantauan(jenis)
  const kueri = j.bidang ? sebagaiKueri(j.bidang, nama) : String(nama || '').trim()
  return bakukan({ ...tambahan, jenis: j.kode, nama, kueri })
}

/* --------------------------------------------------------------- perubahan */

export function daftarPantauan() {
  return baca().map(bakukan)
}

/** Benar bila sebuah nilai sudah dipantau, apa pun namanya di layar. */
export function sudahDipantau(jenis, nama) {
  const kueri = pantauanUntuk(jenis, nama).kueri
  return baca().some((p) => p.kueri === kueri)
}

/**
 * Menyimpan sebuah pantauan. Yang ber-`id` sama diperbarui, bukan digandakan.
 *
 * Mengembalikan keterangan, bukan hanya daftar barunya, sebab pemanggilnya
 * perlu tahu dua hal yang tidak bisa disimpulkan dari daftar: apakah ini
 * penambahan atau perubahan, dan apakah penyimpanannya benar-benar awet.
 */
export function simpanPantauan(masuk) {
  const p = bakukan(masuk)
  const daftar = [...baca()]
  const posisi = daftar.findIndex((x) => x.id === p.id)

  if (posisi >= 0) {
    daftar[posisi] = p
    return { daftar, awet: tulis(daftar), baru: false, pantauan: p, penuh: false }
  }

  // Kueri yang sama persis tidak disimpan dua kali. Dua baris yang menyaring
  // hal yang sama hanya menambah pekerjaan membaca, tidak menambah kabar.
  const kembar = daftar.find((x) => x.kueri === p.kueri)
  if (kembar) return { daftar, awet: true, baru: false, pantauan: bakukan(kembar), penuh: false }

  if (daftar.length >= BATAS) return { daftar, awet: true, baru: false, pantauan: p, penuh: true }

  daftar.push(p)
  return { daftar, awet: tulis(daftar), baru: true, pantauan: p, penuh: false }
}

export function hapusPantauan(id) {
  const daftar = baca().filter((p) => p.id !== id)
  tulis(daftar)
  return daftar
}

/** Menghapus pantauan menurut nilainya, untuk tombol pantau yang berperilaku dua arah. */
export function lepasPantauan(jenis, nama) {
  const kueri = pantauanUntuk(jenis, nama).kueri
  const daftar = baca().filter((p) => p.kueri !== kueri)
  tulis(daftar)
  return daftar
}

/**
 * Menandai sebuah pantauan sudah dibaca sampai saat ini.
 *
 * Inilah yang membuat kolom "baru" bermakna. Tanpa penandaan, "baru" hanya
 * bisa berarti "dalam 24 jam terakhir" — dan bagi petugas yang libur tiga
 * hari, seluruh yang penting justru sudah berhenti disebut baru.
 */
export function tandaiDilihat(id, waktu = new Date()) {
  const daftar = baca().map((p) => (p.id === id ? { ...p, dilihat: waktu.toISOString() } : p))
  tulis(daftar)
  return daftar
}

export function kosongkanPantauan() {
  tulis([])
  return []
}

/* -------------------------------------------------------------- penilaian */

/**
 * Menilai satu pantauan terhadap arsip yang termuat.
 *
 * Himpunan yang dinilai adalah himpunan dasar `lib/hitung.js` — bukan seluruh
 * baris. Kalau pantauan menghitung baris yang sudah dinyatakan tidak valid,
 * angkanya tidak akan pernah cocok dengan angka mana pun di layar lain, dan
 * yang membacanya akan menyimpulkan salah satu dari keduanya rusak.
 */
export function nilaiPantauan(pantauan, berita = [], sekarang = new Date()) {
  const p = bakukan(pantauan)
  const { hasil, catatan } = saringKueri(dasar(berita), p.kueri)

  const batas = p.dilihat ? new Date(p.dilihat).getTime() : 0
  const baru = batas
    ? hasil.filter((b) => new Date(b.created_at || b.tanggal_publikasi || 0).getTime() > batas)
    : hasil.filter((b) => sekarang - new Date(b.created_at || b.tanggal_publikasi || 0) < 86_400_000)

  const mendesak = hasil.filter((b) => URGENSI_MENDESAK.includes(b.urgensi))
  const negatif = hasil.filter((b) => ember(b) === 'negatif')

  /*
     Yang dihitung terhadap ambang adalah yang BARU, bukan seluruhnya.

     Pantauan yang menyala karena arsip lamanya besar akan menyala selamanya,
     dan pantauan yang menyala selamanya sama tidak berartinya dengan pantauan
     yang tidak pernah menyala.
  */
  let terhitung = baru
  if (p.ambang.hanyaMendesak) terhitung = terhitung.filter((b) => URGENSI_MENDESAK.includes(b.urgensi))
  if (p.ambang.hanyaNegatif) terhitung = terhitung.filter((b) => ember(b) === 'negatif')

  const minimum = p.ambang.minimum || 1
  const menyala = p.ambang.minimum > 0 && terhitung.length >= minimum

  return {
    pantauan: p,
    hasil,
    jumlah: hasil.length,
    baru: baru.length,
    terhitung: terhitung.length,
    mendesak: mendesak.length,
    negatif: negatif.length,
    menyala,
    catatan,
    /* Baris terbaru, untuk ditampilkan sebagai bukti tanpa membuka halaman lain. */
    contoh: hasil
      .slice()
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, 3),
  }
}

/**
 * Menilai seluruh pantauan sekaligus, terurut dari yang paling menuntut
 * perhatian: yang menyala lebih dulu, lalu yang paling banyak barunya.
 */
export function nilaiSemua(berita = [], sekarang = new Date()) {
  return daftarPantauan()
    .map((p) => nilaiPantauan(p, berita, sekarang))
    .sort((a, b) => (
      Number(b.menyala) - Number(a.menyala)
      || b.mendesak - a.mendesak
      || b.baru - a.baru
      || a.pantauan.nama.localeCompare(b.pantauan.nama)
    ))
}

/** Ringkasan satu baris untuk lencana menu dan kepala halaman. */
export function rekapPantauan(penilaian = []) {
  return {
    jumlah: penilaian.length,
    menyala: penilaian.filter((p) => p.menyala).length,
    baru: penilaian.reduce((n, p) => n + p.baru, 0),
    mendesak: penilaian.reduce((n, p) => n + p.mendesak, 0),
  }
}

export const META_PANTAUAN = { versi: 'pantauan-v1.0', kunci: KUNCI, batas: BATAS }
