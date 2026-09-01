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

/**
 * Putusan telaah wilayah dan unit.
 *
 * Berdiri sendiri dari `status_verifikasi`, dan sengaja demikian. Yang
 * menentukan sebuah berita ikut dihitung tetap analis pusat; yang dinyatakan
 * kantor wilayah atau unit adalah apakah kabar itu benar menyangkut mereka dan
 * apakah penilaian mesin sudah tepat. Menyatukan keduanya berarti sebuah unit
 * dapat menghapus berita tentang dirinya sendiri dari angka nasional.
 */
export const TELAAH_WILAYAH = [
  { kode: 'Sesuai', nada: 'positif', ket: 'Penilaian mesin sudah tepat menurut unit yang bersangkutan.' },
  { kode: 'Direvisi', nada: 'sedang', ket: 'Penilaian mesin diperbaiki. Alasannya wajib ditulis.' },
  { kode: 'Bukan Unit Kami', nada: 'rendah', ket: 'Kabar ini tidak menyangkut unit atau wilayah ini.' },
  { kode: 'Perlu Perhatian', nada: 'kritis', ket: 'Benar, dan menuntut tindakan di luar telaah.' },
]

/** Sikap resmi unit atas berita yang menyangkutnya. */
export const SIKAP_TANGGAPAN = [
  { kode: 'Dibenarkan', nada: 'sedang', ket: 'Isi berita sesuai dengan keadaan di unit.' },
  { kode: 'Sebagian Benar', nada: 'sedang', ket: 'Ada bagian yang benar dan ada yang keliru; sebutkan yang mana.' },
  { kode: 'Tidak Benar', nada: 'kritis', ket: 'Isi berita tidak sesuai keadaan di unit.' },
  { kode: 'Sudah Ditangani', nada: 'positif', ket: 'Benar, dan tindakannya sudah diambil unit.' },
]

/**
 * Menunggu telaah wilayah atau unit.
 *
 * Berita di luar lingkup tetap dikeluarkan — tidak ada gunanya meminta sebuah
 * lapas menelaah unggahan berbahasa asing yang kebetulan memuat kata "lapas".
 * Yang TIDAK dikeluarkan adalah berita yang sudah diverifikasi pusat: putusan
 * pusat menentukan angka, bukan menutup mulut daerah.
 */
export function menungguTelaahWilayah(b) {
  if (!b || diLuarLingkup(b) || dikecualikan(b)) return false
  const s = b.telaah_wilayah_status
  return !s || s === 'Belum Ditelaah'
}

/** Berita yang sudah dinyatakan sikapnya oleh unit yang bersangkutan. */
export function sudahDitanggapi(b) {
  return Boolean(b?.tanggapan_sikap || String(b?.tanggapan_upt || '').trim())
}

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

/**
 * Tingkat kerawanan sebuah unit — lima derajat, berurut.
 *
 * Peta Sebaran mewarnai 531 titik menurut daftar ini, dan warna pada peta
 * adalah pernyataan: siapa pun yang melihat titik merah akan menyimpulkan ada
 * sesuatu yang gawat di sana. Maka aturannya dinyatakan sekali di sini, bukan
 * di dalam halaman petanya, dan ditulis dengan angka yang bisa diperiksa —
 * bukan "banyak" atau "sedikit".
 *
 * Urutannya dari yang paling gawat, supaya legenda dan pencarian derajat
 * pertama yang cocok memakai daftar yang sama.
 */
export const KERAWANAN = [
  {
    kode: 'kritis',
    label: 'Kritis',
    nada: 'kritis',
    ket: 'Ada berita berurgensi kritis, atau enam berita negatif atau lebih.',
  },
  {
    kode: 'rawan',
    label: 'Rawan',
    nada: 'sedang',
    ket: 'Ada berita berurgensi tinggi, atau tiga berita negatif atau lebih.',
  },
  {
    kode: 'waspada',
    label: 'Waspada',
    nada: 'rendah',
    ket: 'Ada berita negatif, tetapi belum ada yang mendesak.',
  },
  {
    kode: 'aman',
    label: 'Terkendali',
    nada: 'positif',
    ket: 'Ada pemberitaan, dan tidak satu pun bersentimen negatif.',
  },
  {
    kode: 'sepi',
    label: 'Tanpa pemberitaan',
    nada: 'netral',
    ket: 'Belum ada satu pun berita yang terpetakan ke unit ini.',
  },
]

/**
 * Menilai kerawanan satu unit dari berita yang terpetakan kepadanya.
 *
 * Yang dihitung hanya himpunan dasar: berita di luar lingkup dan yang sudah
 * dinyatakan tidak valid tidak boleh mewarnai satu titik pun menjadi merah.
 * Sebuah unit yang berita tentangnya sudah ditolak analis tetapi tetap
 * berwarna merah di peta adalah cara termahal membuat pimpinan tidak lagi
 * mempercayai petanya.
 */
export function tingkatKerawanan(daftar = []) {
  const inti = dasar(daftar)
  if (!inti.length) return KERAWANAN.find((k) => k.kode === 'sepi')

  const negatif = inti.filter((b) => ember(b) === 'negatif').length
  const kritis = inti.some((b) => b.urgensi === 'Kritis')
  const tinggi = inti.some((b) => b.urgensi === 'Tinggi')

  const kode = (kritis || negatif >= 6) ? 'kritis'
    : (tinggi || negatif >= 3) ? 'rawan'
      : negatif >= 1 ? 'waspada'
        : 'aman'

  return KERAWANAN.find((k) => k.kode === kode)
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

    /* Antrean ruang wilayah dan ruang unit. Dihitung dari himpunan dasar yang
       sama seperti antrean pusat, supaya kedua angka selalu bisa dibandingkan
       tanpa seorang pun perlu menerka definisinya. */
    antreanWilayah: inti.filter(menungguTelaahWilayah),
    ditanggapi: inti.filter(sudahDitanggapi),

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
    telaahWilayah: r.antreanWilayah.length,
  }
}
