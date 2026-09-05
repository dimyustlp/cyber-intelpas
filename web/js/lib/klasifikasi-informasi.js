/**
 * Klasifikasi informasi — seberapa jauh sebuah keluaran boleh berjalan.
 *
 * Seluruh isi sistem ini internal. Yang belum ada sampai berkas ini ditulis
 * adalah pembedaan di dalam "internal" itu: sebuah rekap kegiatan pembinaan
 * dan sebuah berkas berisi tuduhan yang belum diperiksa diperlakukan sama —
 * keduanya diunduh sebagai CSV tanpa nama, tanpa tanggal, dan tanpa satu
 * kalimat pun yang mengatakan berkas itu tidak boleh diteruskan.
 *
 * ## Yang menentukan tingkatnya
 *
 * Bukan kolom baru di basis data, dan itu disengaja. Tingkat diturunkan dari
 * dua hal yang sudah tercatat pada tiap baris — seberapa merugikan isinya, dan
 * apakah isinya sudah pernah diperiksa manusia:
 *
 *   sudah diperiksa, tidak merugikan   → Internal
 *   sudah diperiksa, merugikan         → Terbatas
 *   belum diperiksa, merugikan         → Rahasia
 *   mendesak (Tinggi/Kritis)           → Rahasia
 *
 * Urutan ketiga dan keempat yang paling mudah dibalik dan paling mahal bila
 * terbalik. **Tuduhan yang belum diperiksa berjalan lebih sempit daripada
 * tuduhan yang sudah terbukti**, bukan lebih lebar. Berkas yang beredar berisi
 * dugaan yang kemudian ternyata keliru tidak bisa ditarik kembali dari
 * percakapan yang sudah membacanya.
 *
 * Bahan siklus intelijen — laporan lapangan, analisis, putusan pimpinan —
 * tidak diturunkan dari sini; halaman yang mengekspornya menyebut tingkatnya
 * sendiri sebagai `sangat_terbatas`, sebab bahan itu memuat nama petugas dan
 * langkah yang belum diambil.
 *
 * ## Yang TIDAK dilakukan berkas ini
 *
 * Ia bukan penilai kredibilitas. Tingkat di sini menjawab "sejauh mana berkas
 * ini boleh berjalan", bukan "seberapa benar isinya". Dua pertanyaan itu
 * memang bertetangga, dan justru karena bertetangga keduanya tidak boleh
 * dijawab satu angka.
 */

import { punyaIzin } from './peran.js'
import { URGENSI_MENDESAK, dikecualikan } from './hitung.js'
import { ember } from './sentimen.js'

/**
 * Lima tingkat, berurut dari yang paling longgar.
 *
 * `izin` menyebut hak yang salah satunya cukup untuk membawa keluar berkas
 * pada tingkat itu. Daftarnya menunjuk ke nama izin di `lib/peran.js`, bukan
 * ke nama peran — supaya penambahan peran baru tidak menuntut penyuntingan
 * berkas ini, dan supaya yang menegakkan tetap satu daftar.
 */
export const TINGKAT = [
  {
    kode: 'publik',
    label: 'Publik',
    nada: 'positif',
    urutan: 1,
    ringkas: 'Sudah terbit di ruang publik',
    keterangan: 'Isi yang sudah diterbitkan institusi sendiri. Boleh dikutip apa adanya.',
    izin: ['lihat_berita', 'lihat_berita_wilayah', 'lihat_berita_unit', 'lihat_laporan'],
  },
  {
    kode: 'internal',
    label: 'Internal',
    nada: 'netral',
    urutan: 2,
    ringkas: 'Untuk lingkungan Pemasyarakatan',
    keterangan: 'Rekap dan pemantauan rutin. Beredar di lingkungan kedinasan, '
      + 'tidak untuk diteruskan ke luar.',
    izin: ['lihat_berita', 'lihat_berita_wilayah', 'lihat_berita_unit', 'lihat_laporan'],
  },
  {
    kode: 'terbatas',
    label: 'Terbatas',
    nada: 'sedang',
    urutan: 3,
    ringkas: 'Isu merugikan yang sudah diperiksa',
    keterangan: 'Pemberitaan yang merugikan institusi dan sudah ditelaah analis. '
      + 'Beredar pada petugas yang menanganinya.',
    izin: ['lihat_berita', 'telaah_berita', 'telaah_wilayah', 'lihat_laporan', 'lihat_kasus'],
  },
  {
    kode: 'rahasia',
    label: 'Rahasia',
    nada: 'tinggi',
    urutan: 4,
    ringkas: 'Mendesak, atau belum diperiksa',
    keterangan: 'Isu mendesak, dan tuduhan yang belum diverifikasi. Dibawa hanya '
      + 'oleh petugas yang menelaah atau menangani kasusnya.',
    izin: ['telaah_berita', 'lihat_kasus', 'analisis_kasus', 'putuskan_kasus', 'lihat_audit'],
  },
  {
    kode: 'sangat_terbatas',
    label: 'Sangat Terbatas',
    nada: 'kritis',
    urutan: 5,
    ringkas: 'Bahan siklus intelijen',
    keterangan: 'Laporan lapangan, analisis, dan putusan pimpinan. Memuat nama '
      + 'petugas dan langkah yang belum diambil.',
    izin: ['putuskan_kasus', 'analisis_kasus', 'lihat_audit'],
  },
]

const PETA = new Map(TINGKAT.map((t) => [t.kode, t]))

export function tingkatDari(kode) {
  return PETA.get(kode) || PETA.get('internal')
}

export function labelTingkat(kode) { return tingkatDari(kode).label }
export function nadaTingkat(kode) { return tingkatDari(kode).nada }

/**
 * Tingkat sebuah baris berita.
 *
 * Baris yang sudah dinyatakan tidak valid atau diarsipkan tetap dinilai, bukan
 * dilewati: berkas yang memuatnya justru lebih perlu diberi label, sebab isinya
 * tuduhan yang sudah dinyatakan tidak berdasar dan tetap berbahaya bila
 * beredar tanpa keterangan itu.
 */
export function tingkatBerita(b) {
  if (!b) return 'internal'

  const merugikan = ember(b) === 'negatif'
  const mendesak = URGENSI_MENDESAK.includes(b.urgensi)
  const sudahDiperiksa = b.status_verifikasi === 'Terverifikasi' || dikecualikan(b)

  if (mendesak) return 'rahasia'
  if (merugikan) return sudahDiperiksa ? 'terbatas' : 'rahasia'
  return 'internal'
}

/**
 * Tingkat sebuah kumpulan — yang tertinggi di antara isinya.
 *
 * Selalu yang tertinggi, tidak pernah rata-rata. Satu baris rahasia di dalam
 * berkas berisi seribu baris internal menjadikan seluruh berkas rahasia,
 * sebab berkas itu berpindah tangan sebagai satu benda.
 */
export function tingkatKumpulan(daftar = [], dasar = 'internal') {
  let tertinggi = tingkatDari(dasar)
  for (const b of daftar) {
    const t = tingkatDari(tingkatBerita(b))
    if (t.urutan > tertinggi.urutan) tertinggi = t
  }
  return tertinggi.kode
}

/** Benar bila peran ini boleh membawa keluar berkas pada tingkat itu. */
export function bolehMembawa(peran, kode) {
  const t = tingkatDari(kode)
  return t.izin.some((izin) => punyaIzin(peran, izin))
}

/**
 * Kalimat yang dicetak pada tiap berkas keluaran.
 *
 * Satu kalimat, bukan satu kata, karena label satu kata hanya berarti bagi
 * yang sudah tahu artinya — dan berkas yang diteruskan keluar hampir selalu
 * sampai ke tangan yang belum tahu.
 */
export function bannerTingkat(kode) {
  const t = tingkatDari(kode)
  return `${t.label.toUpperCase()} — ${t.keterangan}`
}

export const META_KLASIFIKASI = { versi: 'klasifikasi-informasi-v1.0', tingkat: TINGKAT.length }
