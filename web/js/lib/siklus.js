/**
 * Kosakata siklus intelijen.
 *
 * Lima halaman — Kasus Intelijen, Verifikasi Lapangan, Evaluasi dan
 * Rekomendasi, Keputusan Pimpinan, dan Tindak Lanjut — menampilkan satu
 * rangkaian pekerjaan yang sama dari lima sudut yang berbeda. Nama status,
 * urutannya, dan warnanya tinggal di berkas ini seorang diri.
 *
 * Alasannya sama dengan lib/hitung.js: begitu dua halaman menuliskan sendiri
 * daftar statusnya, keduanya akan berpisah — dan yang pertama menyadarinya
 * adalah petugas yang melihat satu kasus disebut "Menunggu Keputusan" di satu
 * layar dan "Evaluasi" di layar sebelahnya.
 *
 * Nilai teksnya harus sama persis dengan yang tersimpan di basis data. Kolom
 * statusnya bertipe text tanpa CHECK — basis data menerima apa pun, jadi yang
 * menjaga kosakata tetap satu adalah berkas ini, bukan peladen. Menambah satu
 * status berarti menambahnya di sini, sekali.
 */

/* ------------------------------------------------------------------ tahap */

/**
 * Enam tahap yang dilalui sebuah kasus, berurutan.
 *
 * `halaman` menyebutkan di mana pekerjaan tahap itu dikerjakan, sehingga
 * tombol "lanjutkan di sana" tidak perlu ditulis tangan di lima tempat.
 */
export const TAHAP = [
  { kode: 'deteksi', label: 'Terdeteksi', halaman: 'kasus', ket: 'Berita dikumpulkan menjadi satu kasus.' },
  { kode: 'lapangan', label: 'Verifikasi Lapangan', halaman: 'lapangan', ket: 'Fakta dicek langsung ke unit.' },
  { kode: 'evaluasi', label: 'Evaluasi', halaman: 'evaluasi', ket: 'Narasi media disandingkan dengan fakta lapangan.' },
  { kode: 'keputusan', label: 'Keputusan', halaman: 'keputusan', ket: 'Pimpinan memutuskan rekomendasi.' },
  { kode: 'tindak', label: 'Tindak Lanjut', halaman: 'tindak', ket: 'Butir tindakan dikerjakan dan dipantau.' },
  { kode: 'selesai', label: 'Selesai', halaman: 'kasus', ket: 'Kasus ditutup dan diarsipkan.' },
]

export function tahap(kode) {
  return TAHAP.find((t) => t.kode === kode) || TAHAP[0]
}

export function urutanTahap(kode) {
  const i = TAHAP.findIndex((t) => t.kode === kode)
  return i < 0 ? 0 : i
}

/* ------------------------------------------------------------------ kasus */

export const STATUS_KASUS = [
  {
    nama: 'Terdeteksi',
    tahap: 'deteksi',
    nada: 'sedang',
    ket: 'Kasus baru terbentuk dari pemberitaan. Belum ada yang turun ke lapangan.',
  },
  {
    nama: 'Verifikasi Lapangan',
    tahap: 'lapangan',
    nada: 'tinggi',
    ket: 'Sudah ada surat tugas berjalan. Fakta lapangan sedang dikumpulkan.',
  },
  {
    nama: 'Evaluasi',
    tahap: 'evaluasi',
    nada: 'rendah',
    ket: 'Laporan lapangan sudah masuk dan sedang disandingkan dengan narasi media.',
  },
  {
    nama: 'Menunggu Keputusan',
    tahap: 'keputusan',
    nada: 'kritis',
    ket: 'Rekomendasi sudah tersusun dan menunggu putusan pimpinan.',
  },
  {
    nama: 'Tindak Lanjut',
    tahap: 'tindak',
    nada: 'rendah',
    ket: 'Putusan sudah terbit. Butir tindakannya sedang dikerjakan.',
  },
  {
    nama: 'Selesai',
    tahap: 'selesai',
    nada: 'positif',
    ket: 'Seluruh butir tindakan tuntas.',
  },
  {
    nama: 'Ditutup',
    tahap: 'selesai',
    nada: 'netral',
    ket: 'Ditutup tanpa tindak lanjut — misalnya karena beritanya terbukti tidak benar.',
  },
]

export const NAMA_STATUS_KASUS = STATUS_KASUS.map((s) => s.nama)

export function statusKasus(nama) {
  return STATUS_KASUS.find((s) => s.nama === nama) || STATUS_KASUS[0]
}

/** Kasus yang masih menuntut pekerjaan seseorang. */
export function kasusTerbuka(k) {
  return !['Selesai', 'Ditutup'].includes(k?.status) && !k?.closed_at
}

/* ------------------------------------------------------------- prioritas */

/**
 * Prioritas memakai kosakata yang sama persis dengan urgensi berita.
 *
 * Bukan kebetulan: prioritas sebuah kasus hampir selalu diwarisi dari urgensi
 * tertinggi berita di dalamnya. Dua kosakata untuk hal yang sama memaksa
 * pembacanya menerjemahkan sendiri "Tinggi" menjadi "Mendesak", dan
 * terjemahan yang dilakukan sendiri tidak pernah sama antar dua orang.
 */
export const PRIORITAS = ['Rendah', 'Sedang', 'Tinggi', 'Kritis']
export const PERINGKAT_PRIORITAS = { Rendah: 1, Sedang: 2, Tinggi: 3, Kritis: 4 }

export function nadaPrioritas(p) {
  return { Kritis: 'kritis', Tinggi: 'tinggi', Sedang: 'sedang', Rendah: 'rendah' }[p] || 'rendah'
}

/* ----------------------------------------------------------- keaktualan */

/**
 * Apakah isi beritanya benar. Berdiri terpisah dari status kasus.
 *
 * Sebuah kasus bisa saja sudah "Selesai" sementara isinya "Tidak Benar" —
 * yang selesai adalah penanganannya, bukan pembuktiannya. Menggabungkan
 * keduanya menjadi satu kolom membuat kasus hoaks yang sudah diklarifikasi
 * tidak punya tempat untuk dinyatakan hoaks.
 */
export const KEAKTUALAN = [
  { nama: 'Terbukti Benar', nada: 'kritis' },
  { nama: 'Benar Sebagian', nada: 'tinggi' },
  { nama: 'Tidak Benar', nada: 'positif' },
  { nama: 'Tidak Dapat Dipastikan', nada: 'netral' },
]

export const NAMA_KEAKTUALAN = KEAKTUALAN.map((k) => k.nama)

export function nadaKeaktualan(nama) {
  return KEAKTUALAN.find((k) => k.nama === nama)?.nada || 'netral'
}

/* -------------------------------------------------------------- penugasan */

export const STATUS_PENUGASAN = [
  { nama: 'Ditugaskan', nada: 'sedang', ket: 'Surat tugas terbit, belum dibuka petugasnya.' },
  { nama: 'Diterima', nada: 'rendah', ket: 'Petugas sudah menerima dan membaca penugasannya.' },
  { nama: 'Berjalan', nada: 'tinggi', ket: 'Kunjungan lapangan sedang dilakukan.' },
  { nama: 'Selesai', nada: 'positif', ket: 'Laporan lapangan sudah dikirim.' },
  { nama: 'Dibatalkan', nada: 'netral', ket: 'Dibatalkan sebelum kunjungan dilakukan.' },
]

export const NAMA_STATUS_PENUGASAN = STATUS_PENUGASAN.map((s) => s.nama)

export function nadaPenugasan(nama) {
  return STATUS_PENUGASAN.find((s) => s.nama === nama)?.nada || 'rendah'
}

/** Pertanyaan verifikasi bawaan pada surat tugas baru. */
export const PERTANYAAN_BAKU = [
  'Apakah peristiwa yang diberitakan benar terjadi di unit ini?',
  'Kapan dan di mana persisnya peristiwa itu terjadi?',
  'Siapa saja yang terlibat, dan apa status kepegawaian atau kebinaannya?',
  'Langkah apa yang sudah diambil unit sejak peristiwa itu?',
  'Adakah bagian pemberitaan yang tidak sesuai fakta lapangan?',
]

/* --------------------------------------------------------- laporan lapangan */

export const KLASIFIKASI_TEMUAN = [
  { nama: 'Terbukti', nada: 'kritis', ket: 'Fakta lapangan sepenuhnya membenarkan pemberitaan.' },
  { nama: 'Terbukti Sebagian', nada: 'tinggi', ket: 'Peristiwanya benar, tetapi ada bagian berita yang tidak sesuai.' },
  { nama: 'Tidak Terbukti', nada: 'positif', ket: 'Fakta lapangan menyangkal pemberitaan.' },
  { nama: 'Belum dapat disimpulkan', nada: 'netral', ket: 'Bukti yang terkumpul belum cukup untuk menyimpulkan.' },
]

export const NAMA_TEMUAN = KLASIFIKASI_TEMUAN.map((k) => k.nama)

export function nadaTemuan(nama) {
  return KLASIFIKASI_TEMUAN.find((k) => k.nama === nama)?.nada || 'netral'
}

export const STATUS_LAPORAN_LAPANGAN = ['Dikirim', 'Diterima', 'Dikembalikan']

export const JENIS_BUKTI = [
  'Foto Lokasi',
  'Dokumen Resmi',
  'Berita Acara',
  'Rekaman Wawancara',
  'Tangkapan Layar',
  'Dokumen Pendukung',
]

/* ---------------------------------------------------------------- evaluasi */

export const VALIDITAS = [
  'Terverifikasi Benar',
  'Terverifikasi Sebagian',
  'Terbantahkan',
  'Belum terverifikasi',
]

export const DAMPAK_REPUTASI = ['Ringan', 'Sedang', 'Berat', 'Sangat Berat']
export const DAMPAK_OPERASIONAL = ['Tidak Ada', 'Terbatas', 'Mengganggu', 'Lumpuh Sebagian']
export const DAMPAK_KEPATUHAN = ['Sesuai Prosedur', 'Perlu pemeriksaan', 'Terdapat Pelanggaran']
export const RISIKO_ESKALASI = ['Mereda', 'Stabil', 'Menanjak', 'Viral']

/**
 * Skor dampak, dipakai hanya untuk mengurutkan antrean.
 *
 * Sengaja tidak ditampilkan sebagai angka di layar. Angka gabungan seperti
 * "7,4" mengundang pembacanya membandingkan dua kasus seolah bedanya terukur,
 * padahal empat penilaian di dalamnya adalah pendapat analis, bukan ukuran.
 */
export function bobotDampak(analisis = {}) {
  const skala = (daftar, nilai) => Math.max(0, daftar.indexOf(nilai))
  return skala(DAMPAK_REPUTASI, analisis.reputation_impact)
    + skala(DAMPAK_OPERASIONAL, analisis.operational_impact)
    + skala(DAMPAK_KEPATUHAN, analisis.compliance_impact)
    + skala(RISIKO_ESKALASI, analisis.media_escalation_risk)
}

export const STATUS_ANALISIS = ['Draf', 'Diajukan', 'Terverifikasi']

export const PENILAIAN_TINDAK = [
  'Belum Dapat Dinilai',
  'Memadai',
  'Belum Memadai',
  'Tidak Dijalankan',
]

/* ------------------------------------------------------------ rekomendasi */

export const JENIS_REKOMENDASI = [
  'Klarifikasi Publik',
  'Pembinaan Internal',
  'Pemeriksaan',
  'Perbaikan Prosedur',
  'Penindakan',
  'Koordinasi Eksternal',
  'Pemantauan Lanjutan',
]

export const STATUS_REKOMENDASI = [
  { nama: 'Diusulkan', nada: 'sedang', ket: 'Menunggu putusan pimpinan.' },
  { nama: 'Disetujui', nada: 'positif', ket: 'Disetujui dan menjadi butir tindak lanjut.' },
  { nama: 'Dikembalikan', nada: 'tinggi', ket: 'Dikembalikan untuk diperbaiki analis.' },
  { nama: 'Ditolak', nada: 'netral', ket: 'Tidak dijalankan, dengan alasan tercatat.' },
  { nama: 'Selesai', nada: 'positif', ket: 'Seluruh butir tindakannya tuntas.' },
]

export function nadaRekomendasi(nama) {
  return STATUS_REKOMENDASI.find((s) => s.nama === nama)?.nada || 'rendah'
}

/* -------------------------------------------------------------- keputusan */

/**
 * Putusan pimpinan. Lima, dan tidak lebih.
 *
 * "Disetujui dengan Catatan" berdiri sendiri, bukan digabung ke "Disetujui"
 * dengan kolom catatan opsional: keduanya berbeda artinya bagi yang
 * mengerjakan. Yang pertama boleh langsung jalan; yang kedua harus dibaca
 * catatannya lebih dulu.
 */
export const PUTUSAN = [
  { nama: 'Disetujui', nada: 'positif', ket: 'Seluruh rekomendasi terpilih dijalankan apa adanya.' },
  { nama: 'Disetujui dengan Catatan', nada: 'rendah', ket: 'Dijalankan dengan penyesuaian yang disebutkan pimpinan.' },
  { nama: 'Dikembalikan', nada: 'tinggi', ket: 'Analisis atau rekomendasinya perlu diperbaiki lebih dulu.' },
  { nama: 'Ditolak', nada: 'kritis', ket: 'Tidak dijalankan.' },
  { nama: 'Ditutup Tanpa Tindakan', nada: 'netral', ket: 'Kasus selesai tanpa butir tindakan.' },
]

export const NAMA_PUTUSAN = PUTUSAN.map((p) => p.nama)

export function nadaPutusan(nama) {
  return PUTUSAN.find((p) => p.nama === nama)?.nada || 'netral'
}

/** Putusan yang membuat rekomendasinya berjalan. */
export function putusanMenyetujui(nama) {
  return nama === 'Disetujui' || nama === 'Disetujui dengan Catatan'
}

/** Status kasus yang mengikuti sebuah putusan. */
export function statusSesudahPutusan(nama) {
  if (putusanMenyetujui(nama)) return 'Tindak Lanjut'
  if (nama === 'Dikembalikan') return 'Evaluasi'
  return 'Ditutup'
}

/* ------------------------------------------------------------ tindak lanjut */

export const STATUS_TINDAK = [
  { nama: 'Belum Dimulai', nada: 'sedang', ket: 'Sudah ditugaskan, belum dikerjakan.' },
  { nama: 'Berjalan', nada: 'rendah', ket: 'Sedang dikerjakan.' },
  { nama: 'Tertunda', nada: 'tinggi', ket: 'Terhenti karena sesuatu di luar kendali pelaksana.' },
  { nama: 'Selesai', nada: 'positif', ket: 'Tuntas dan sudah dinilai.' },
  { nama: 'Dibatalkan', nada: 'netral', ket: 'Tidak jadi dikerjakan.' },
]

export const NAMA_STATUS_TINDAK = STATUS_TINDAK.map((s) => s.nama)

export function nadaTindak(nama) {
  return STATUS_TINDAK.find((s) => s.nama === nama)?.nada || 'rendah'
}

export function tindakSelesai(t) {
  return t?.status === 'Selesai' || t?.status === 'Dibatalkan'
}

/**
 * Butir yang lewat tenggat dan belum selesai.
 *
 * Tenggat yang lewat pada butir yang sudah selesai bukan keterlambatan — ia
 * riwayat. Menandai keduanya merah membuat daftar tindak lanjut yang sehat
 * terbaca seperti daftar yang gagal.
 */
export function terlambat(t, sekarang = new Date()) {
  if (!t?.due_at || tindakSelesai(t)) return false
  return new Date(t.due_at) < sekarang
}

/** Sisa hari menuju tenggat; negatif berarti sudah lewat. */
export function sisaHari(tenggat, sekarang = new Date()) {
  if (!tenggat) return null
  const satuHari = 86_400_000
  const t = new Date(tenggat)
  if (Number.isNaN(t.getTime())) return null
  return Math.round((t.setHours(0, 0, 0, 0) - new Date(sekarang).setHours(0, 0, 0, 0)) / satuHari)
}

/** Kalimat tenggat yang sudah memuat penilaiannya, bukan sekadar tanggal. */
export function kalimatTenggat(tenggat, selesai = false) {
  const sisa = sisaHari(tenggat)
  if (sisa === null) return { teks: 'Tanpa tenggat', nada: 'netral' }
  if (selesai) return { teks: 'Tenggat terlewati', nada: 'netral' }
  if (sisa < 0) return { teks: `Terlambat ${Math.abs(sisa)} hari`, nada: 'kritis' }
  if (sisa === 0) return { teks: 'Jatuh tempo hari ini', nada: 'tinggi' }
  if (sisa <= 3) return { teks: `${sisa} hari lagi`, nada: 'sedang' }
  return { teks: `${sisa} hari lagi`, nada: 'rendah' }
}

/* ------------------------------------------------------------- kemajuan */

/**
 * Kemajuan satu kasus sebagai satu angka, dari lima tabel yang berbeda.
 *
 * Yang dihitung adalah tahap yang sudah dilewati, bukan persentase pekerjaan.
 * Persentase pekerjaan tidak pernah bisa dihitung jujur, dan angka yang tidak
 * jujur di layar pimpinan lebih buruk daripada tidak ada angka sama sekali.
 *
 * Statusnya sendiri ikut dihitung, bukan diabaikan: sebuah kasus yang
 * statusnya sudah dinaikkan analis tetapi berkas tahapnya belum masuk tetap
 * ditampilkan pada tahap yang dinyatakan analis. Yang tahu keadaan sebenarnya
 * adalah orangnya, bukan penghitung baris.
 */
export function kemajuanKasus(kasus, isi = {}) {
  const sudah = []
  if ((isi.berita || 0) > 0) sudah.push('deteksi')
  if ((isi.laporanLapangan || 0) > 0) sudah.push('lapangan')
  if ((isi.analisis || 0) > 0) sudah.push('evaluasi')
  if ((isi.putusan || 0) > 0) sudah.push('keputusan')
  if ((isi.tindak || 0) > 0 && isi.tindakSelesai === isi.tindak) sudah.push('tindak')

  const dariBerkas = sudah.length - 1
  const dariStatus = urutanTahap(statusKasus(kasus?.status).tahap)
  const tercapai = Math.max(dariBerkas, dariStatus, 0)
  const langkah = Math.min(tercapai + 1, TAHAP.length)

  return {
    tahap: TAHAP[Math.min(tercapai, TAHAP.length - 1)],
    langkah,
    dari: TAHAP.length,
    persen: Math.round((langkah / TAHAP.length) * 100),
  }
}

/**
 * Tahap berikutnya yang menuntut pekerjaan, beserta halaman tempat
 * mengerjakannya. Dipakai tombol "Lanjutkan" pada daftar kasus.
 */
export function langkahBerikut(kasus) {
  const sekarang = statusKasus(kasus?.status)
  if (sekarang.tahap === 'selesai') return TAHAP[TAHAP.length - 1]
  return TAHAP[Math.min(urutanTahap(sekarang.tahap) + 1, TAHAP.length - 1)]
}

export const META_SIKLUS = { versi: 'siklus-v1.0' }
