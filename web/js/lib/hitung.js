/**
 * Penghitungan angka — satu himpunan dasar untuk seluruh layar.
 *
 * Keluhan yang melahirkan berkas ini: jumlah berita di kepala dasbor tidak
 * cocok dengan jumlah di kanal negatif dan positif di bawahnya. Setelah
 * ditelusuri, tidak ada satu pun angka yang salah hitung — yang berbeda adalah
 * pertanyaannya. Dasbor menghitung seluruh arsip termasuk berita yang sudah
 * dinyatakan tidak valid, lencana menu membuangnya, kanal memakai definisi
 * negatif yang lain lagi, dan semuanya bekerja pada 400 baris terbaru sementara
 * basis data menyimpan jauh lebih banyak.
 *
 * Maka aturannya dinyatakan sekali di sini:
 *
 *   1. Berita di luar lingkup Pemasyarakatan tidak pernah menjadi angka.
 *      Perkara Rutan KPK bukan beban unit mana pun.
 *   2. Berita yang sudah dinyatakan "Tidak Valid" atau "Diarsipkan" oleh analis
 *      tidak menaikkan angka apa pun. Kalau ia tetap dihitung, telaah yang
 *      menyatakannya tidak valid menjadi pekerjaan tanpa akibat.
 *   3. Yang tersisa itulah himpunan dasar. Seluruh angka di layar adalah
 *      pecahan darinya, dan karena itu selalu bisa dijumlahkan kembali.
 *
 * Aturan ketiga yang membuat kekeliruan berikutnya terlihat sendiri: dasbor
 * menampilkan penjumlahannya di layar, sehingga selisih apa pun terbaca oleh
 * pembacanya, bukan ditemukan berbulan-bulan kemudian.
 */

import { ember, hitungEmber } from './sentimen.js'
import { tanggalIso } from './format.js'
import { belumTerpetakan } from './pencocokan-upt.js'

/** Status yang menyatakan sebuah berita sudah tidak dipakai sebagai angka. */
export const STATUS_DIKECUALIKAN = ['Tidak Valid', 'Diarsipkan']

/** Status yang masih menunggu keputusan analis di Antrean Telaah. */
export const STATUS_ANTREAN = ['Belum Ditelaah', 'Perlu Koreksi']

export const URGENSI_MENDESAK = ['Tinggi', 'Kritis']

export function diLuarLingkup(b) {
  return b?.kategori === 'Di Luar Lingkup'
}

export function dikecualikan(b) {
  return STATUS_DIKECUALIKAN.includes(b?.status_verifikasi)
}

/**
 * Menunggu telaah.
 *
 * Status kosong ikut dihitung karena baris lama dari Streamlit tidak selalu
 * mengisinya, dan berita tanpa status tetap berita yang belum pernah dibaca
 * manusia. Lencana menu dan isi antrean memakai fungsi yang sama persis,
 * supaya angka pada lencana tidak pernah lagi berbeda dari panjang daftarnya.
 */
export function menungguTelaah(b) {
  if (!b || diLuarLingkup(b) || dikecualikan(b)) return false
  const s = b.status_verifikasi
  return !s || STATUS_ANTREAN.includes(s)
}

/** Himpunan dasar: dalam lingkup, belum dikecualikan. */
export function dasar(daftar = []) {
  return daftar.filter((b) => !diLuarLingkup(b) && !dikecualikan(b))
}

/**
 * Seluruh angka dasbor sekaligus, dihitung dari satu himpunan dasar.
 *
 * Dikembalikan sebagai satu objek — bukan tujuh fungsi terpisah — supaya
 * mustahil ada halaman yang memakai lima di antaranya lalu menghitung sendiri
 * yang keenam.
 */
export function ringkasan(daftar = [], sekarang = new Date()) {
  const semua = daftar || []
  const inti = dasar(semua)

  const hariIniIso = tanggalIso(sekarang)
  const kemarinIso = tanggalIso(new Date(sekarang.getTime() - 86_400_000))

  const perEmber = hitungEmber(inti)
  const daftarMendesak = inti.filter((b) => URGENSI_MENDESAK.includes(b.urgensi))

  return {
    /** Himpunan yang dipakai seluruh angka di bawah. */
    inti,

    total: inti.length,
    negatif: inti.filter((b) => ember(b) === 'negatif'),
    netral: inti.filter((b) => ember(b) === 'netral'),
    positif: inti.filter((b) => ember(b) === 'positif'),
    belumDinilai: inti.filter((b) => ember(b) === 'belum'),
    perEmber,

    mendesak: daftarMendesak,
    kritis: daftarMendesak.filter((b) => b.urgensi === 'Kritis'),

    antrean: inti.filter(menungguTelaah),
    takTerpetakan: inti.filter((b) => belumTerpetakan(b.nama_upt)),

    hariIni: inti.filter((b) => tanggalIso(b.created_at) === hariIniIso),
    kemarin: inti.filter((b) => tanggalIso(b.created_at) === kemarinIso),

    /** Yang sengaja tidak dihitung — ditampilkan supaya selisihnya bisa dijelaskan. */
    luarLingkup: semua.filter(diLuarLingkup).length,
    dikecualikan: semua.filter((b) => !diLuarLingkup(b) && dikecualikan(b)).length,
    seluruhBaris: semua.length,
  }
}

/**
 * Angka untuk lencana menu samping.
 *
 * Dipisahkan dari `ringkasan` hanya karena ia dipanggil di tempat lain
 * (kerangka layar, bukan halaman), tetapi aturannya dipinjam utuh dari sana —
 * tidak ada satu pun penyaring yang ditulis ulang di berkas main.js.
 */
export function lencana(daftar = []) {
  const r = ringkasan(daftar)
  return {
    peringatan: r.mendesak.length,
    telaah: r.antrean.length,
    negatif: r.negatif.length,
    pemetaan: r.takTerpetakan.length,
  }
}
