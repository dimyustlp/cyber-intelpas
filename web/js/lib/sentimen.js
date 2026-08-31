/**
 * Sentimen — satu-satunya tempat yang boleh menentukan arti tiap nilai.
 *
 * Sebelum berkas ini ada, empat halaman mengelompokkan sentimen dengan aturan
 * masing-masing: dasbor menghitung "Negatif" saja, Kanal Negatif menghitung
 * "Negatif" beserta "Campuran", laporan berkala mengikuti kanal, dan sisanya
 * dilabeli "Netral" lewat pengurangan. Keempatnya berjalan persis seperti yang
 * ditulis, dan justru karena itu pimpinan membaca tiga angka berbeda untuk satu
 * pertanyaan yang sama. Yang diperbaiki bukan salah satu halaman, melainkan
 * ketiadaan tempat yang menyatakan aturannya sekali untuk semua.
 *
 * Analis memutuskan dalam tiga ember; basis data tetap menyimpan empat nilai.
 * Pemisahan itu disengaja. Tiga ember cukup untuk keputusan — merugikan,
 * menguatkan, atau tidak keduanya — sedangkan nilai "Campuran" yang pernah
 * diberikan mesin adalah keterangan yang tidak perlu dihapus hanya karena
 * layar keputusannya lebih ringkas.
 *
 * Keterangan tiap ember ikut tinggal di sini, bukan di dalam halaman telaah,
 * sebab definisi yang hanya hidup di satu layar akan berbeda di layar
 * berikutnya — persis kejadian yang berkas ini tutup.
 */

/**
 * Ketiga ember, berurut dari yang merugikan ke yang menguatkan. Urutan ini
 * dipakai apa adanya oleh bagan dan legenda, supaya pembaca tidak perlu
 * menghafal susunan yang berbeda di tiap halaman.
 */
export const EMBER = [
  {
    kode: 'negatif',
    label: 'Negatif',
    simpan: 'Negatif',
    nada: 'kritis',
    /** Nilai basis data yang jatuh ke ember ini. */
    nilai: ['Negatif'],
    ringkas: 'Merugikan institusi',
    keterangan: 'Pemberitaan yang menurunkan kepercayaan publik atau menyudutkan '
      + 'institusi dan petugas: insiden di dalam lapas, dugaan pelanggaran, keluhan '
      + 'keluarga warga binaan, dan kritik kebijakan.',
    petunjuk: 'Termasuk berita yang bahasanya datar tetapi akibatnya merugikan bila menyebar.',
  },
  {
    kode: 'netral',
    label: 'Netral / Campuran',
    simpan: 'Netral',
    nada: 'netral',
    nilai: ['Netral', 'Campuran'],
    ringkas: 'Tidak condong ke salah satu sisi',
    keterangan: 'Kabar faktual tanpa arah untung-rugi yang jelas — agenda, kunjungan, '
      + 'angka statistik — atau yang memuat kedua sisi sekaligus, misalnya insiden yang '
      + 'langsung diikuti penindakan tegas.',
    petunjuk: 'Bila ragu antara ember ini dan Negatif, pilih Negatif. '
      + 'Melewatkan isu negatif lebih mahal daripada menelaah ulang satu berita netral.',
  },
  {
    kode: 'positif',
    label: 'Positif',
    simpan: 'Positif',
    nada: 'positif',
    nilai: ['Positif'],
    ringkas: 'Menguatkan institusi',
    keterangan: 'Capaian, layanan, program pembinaan, dan apresiasi dari pihak luar. '
      + 'Inilah bahan penyeimbang yang dipakai laporan berkala ketika isu negatif '
      + 'sedang ramai.',
    petunjuk: 'Publikasi humas UPT hampir selalu masuk ke sini.',
  },
]

/**
 * Ember keempat yang tidak pernah dipilih manusia: berita yang belum dinilai
 * siapa pun. Ia berdiri sendiri supaya tidak diam-diam menumpang di "Netral"
 * dan membuat arsip tampak lebih tenang daripada keadaannya.
 */
export const BELUM = {
  kode: 'belum',
  label: 'Belum dinilai',
  simpan: 'Tidak diketahui',
  nada: 'rendah',
  nilai: ['Tidak diketahui'],
  ringkas: 'Menunggu mesin atau analis',
  keterangan: 'Berita baru masuk dan belum pernah dinilai mesin klasifikasi maupun analis.',
  petunjuk: '',
}

/** Seluruh nilai yang sah tersimpan di kolom `sentimen`. */
export const NILAI_TERSIMPAN = ['Positif', 'Netral', 'Campuran', 'Negatif', 'Tidak diketahui']

const PETA_NILAI = new Map()
for (const e of EMBER) for (const n of e.nilai) PETA_NILAI.set(n.toLowerCase(), e.kode)
for (const n of BELUM.nilai) PETA_NILAI.set(n.toLowerCase(), BELUM.kode)

/**
 * Ember sebuah berita, atau sebuah nilai sentimen mentah.
 *
 * Menerima keduanya karena pemanggilnya berbeda-beda: penyaring bekerja pada
 * berita utuh, sedangkan bagan bekerja pada nilai yang sudah dikelompokkan.
 */
export function ember(sumber) {
  const nilai = typeof sumber === 'string' ? sumber : sumber?.sentimen
  if (!nilai) return BELUM.kode
  return PETA_NILAI.get(String(nilai).trim().toLowerCase()) || BELUM.kode
}

export function emberDari(kode) {
  return EMBER.find((e) => e.kode === kode) || BELUM
}

export function labelEmber(kode) { return emberDari(kode).label }
export function nadaEmber(kode) { return emberDari(kode).nada }

/** Benar bila berita jatuh ke ember tertentu. Dipakai penyaring di banyak halaman. */
export function beremberkan(berita, kode) {
  return ember(berita) === kode
}

/**
 * Nilai yang ditulis ke basis data ketika analis memilih sebuah ember.
 *
 * Memilih "Netral / Campuran" pada berita yang sudah dinilai mesin sebagai
 * "Campuran" tidak mengubah apa pun — nuansa itu dipertahankan. Yang berpindah
 * ember tetap ditulis dengan nilai baku embernya, sebab analis memang sedang
 * menyatakan penilaian mesin keliru.
 */
export function nilaiSimpan(kode, nilaiSekarang) {
  const e = emberDari(kode)
  if (nilaiSekarang && ember(nilaiSekarang) === kode && e.nilai.includes(nilaiSekarang)) {
    return nilaiSekarang
  }
  return e.simpan
}

/**
 * Menghitung isi tiap ember dari sekumpulan berita.
 * Selalu mengembalikan keempat kunci, termasuk yang bernilai nol, supaya
 * pemanggilnya tidak perlu menjaga-jaga terhadap kunci yang hilang.
 */
export function hitungEmber(daftar = []) {
  const hasil = { negatif: 0, netral: 0, positif: 0, belum: 0, total: 0 }
  for (const b of daftar) {
    hasil[ember(b)] += 1
    hasil.total += 1
  }
  return hasil
}
