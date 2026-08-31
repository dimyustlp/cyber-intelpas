/**
 * Peran, izin, dan navigasi.
 *
 * Berkas ini adalah cerminan sisi peramban dari policy RLS di basis data.
 * Yang menegakkan aturan tetap PostgreSQL — kalau seseorang mengakali menu di
 * sini, kuerinya tetap ditolak di server. Guna daftar ini hanya satu: jangan
 * menampilkan tombol yang, kalau ditekan, hanya akan berujung penolakan.
 *
 * Sebutan peran mengikuti nomenklatur Dirpamintel yang dirumuskan pengguna.
 */

export const PERAN = {
  super_admin: {
    nama: 'Administrator Sistem Intelijen',
    ringkas: 'Superadmin',
    lingkup: 'internal',
    tugas: 'Mengelola hak akses, parameter mesin klasifikasi, dan kesehatan sistem.',
  },
  news_data_operator: {
    nama: 'Operator Pengumpulan Data',
    ringkas: 'Puldata',
    lingkup: 'internal',
    tugas: 'Menjaga suplai data masuk, menyaring duplikasi, dan memasukkan isu viral yang belum tertangkap sistem.',
  },
  media_intelligence_analyst: {
    nama: 'Analis Intelijen Media',
    ringkas: 'Analis OSINT',
    lingkup: 'internal',
    tugas: 'Memvalidasi klasifikasi mesin, memetakan pola isu, dan menyusun laporan intelijen berkala.',
  },
  field_verification_officer: {
    nama: 'Petugas Verifikasi Lapangan',
    ringkas: 'Pulbaket',
    lingkup: 'internal',
    tugas: 'Menyandingkan berita media dengan fakta lapangan dan mengunggah bukti temuan.',
  },
  evaluation_recommendation_analyst: {
    nama: 'Analis Evaluasi dan Mitigasi Risiko',
    ringkas: 'Evaluasi',
    lingkup: 'internal',
    tugas: 'Menggabungkan analisis media dengan fakta lapangan menjadi rekomendasi tindakan.',
  },
  executive_decision_maker: {
    nama: 'Pimpinan Pengambil Keputusan',
    ringkas: 'Pimpinan',
    lingkup: 'internal',
    tugas: 'Memantau dasbor eksekutif, mengkaji rekomendasi, dan menerbitkan keputusan.',
  },
  /*
     Dua peran wilayah, bukan satu.

     Pekerjaannya memang dua: yang memasukkan berita, dan yang memeriksa
     kiriman itu sebelum naik ke pusat. Menggabungkannya berarti pemeriksa
     memeriksa pekerjaannya sendiri. Nama kuncinya sama persis dengan yang
     diterima basis data pada migrasi 06 — kalau keduanya berbeda, pengguna
     wilayah akan mendapat menu internal karena perannya tidak dikenali di sini.
  */
  kanwil_admin: {
    nama: 'Administrator Kantor Wilayah',
    ringkas: 'Admin Kanwil',
    lingkup: 'eksternal',
    tugas: 'Memeriksa kiriman berita dari wilayahnya sendiri sebelum naik ke pusat, '
      + 'dan memantau keadaan pemberitaan wilayahnya. Tidak melihat data pusat.',
  },
  kanwil_penginput: {
    nama: 'Penginput Berita Kantor Wilayah',
    ringkas: 'Penginput Kanwil',
    lingkup: 'eksternal',
    tugas: 'Memasukkan berita dari wilayahnya dan melihat riwayat kirimannya sendiri.',
  },
}

/**
 * Peran wilayah dipisahkan sebagai pihak eksternal. Mereka tidak melihat dasbor
 * nasional, tidak melihat kanal pusat, dan tidak melihat satu pun modul
 * internal — hanya ruang wilayahnya sendiri.
 *
 * Daftar ini hanya menentukan menu. Yang benar-benar menahan data adalah policy
 * RLS: `can_access_berita` menolak baris yang bukan wilayahnya, dan penolakan
 * itu berlaku sekalipun seseorang mengetik alamat halaman internal langsung.
 */
export const PERAN_EKSTERNAL = new Set(['kanwil_admin', 'kanwil_penginput'])

export const IZIN = {
  super_admin: ['*'],

  executive_decision_maker: [
    'lihat_dasbor', 'lihat_briefing', 'lihat_berita', 'lihat_berita_terverifikasi',
    'lihat_peta', 'lihat_tren', 'lihat_kasus', 'lihat_laporan_lapangan',
    'lihat_rekomendasi', 'putuskan_kasus', 'lihat_laporan', 'unduh_laporan',
    'setujui_laporan', 'publikasi_laporan', 'lihat_peringatan', 'lihat_tindak_lanjut',
    'kelola_tindak_lanjut',
  ],

  media_intelligence_analyst: [
    'lihat_dasbor', 'lihat_briefing', 'lihat_berita', 'buat_berita', 'telaah_berita',
    'verifikasi_berita', 'petakan_upt', 'lihat_peta', 'lihat_tren', 'lihat_kasus',
    'kelola_kasus', 'kaitkan_berita_kasus', 'buat_laporan', 'sunting_draf_laporan',
    'lihat_laporan', 'unduh_laporan', 'kirim_telegram', 'lihat_peringatan',
    'lihat_tindak_lanjut', 'unggah_lampiran', 'tugaskan_lapangan', 'lihat_penugasan',
    'lihat_laporan_lapangan', 'lihat_sinkronisasi',
  ],

  news_data_operator: [
    'lihat_dasbor', 'lihat_briefing', 'lihat_berita', 'buat_berita', 'sunting_berita_sendiri',
    'validasi_metadata', 'lihat_sinkronisasi', 'jalankan_sinkronisasi', 'lihat_duplikat',
    'unggah_lampiran',
  ],

  field_verification_officer: [
    'lihat_dasbor', 'lihat_briefing', 'lihat_kasus_ditugaskan', 'lihat_penugasan',
    'kirim_laporan_lapangan', 'unggah_bukti_lapangan', 'perbarui_penugasan',
    'lihat_laporan_lapangan_sendiri', 'lihat_tindak_lanjut', 'perbarui_tindak_lanjut',
  ],

  evaluation_recommendation_analyst: [
    'lihat_dasbor', 'lihat_briefing', 'lihat_berita', 'lihat_kasus', 'lihat_laporan_lapangan',
    'lihat_penugasan', 'lihat_peringatan', 'analisis_kasus', 'kelola_rekomendasi',
    'nilai_tindak_lanjut', 'buat_laporan',
    'sunting_draf_laporan', 'lihat_laporan', 'unduh_laporan', 'lihat_tren',
    'lihat_tindak_lanjut', 'kelola_tindak_lanjut', 'perbarui_tindak_lanjut',
  ],

  kanwil_admin: [
    'lihat_dasbor_wilayah', 'buat_berita', 'lihat_kiriman_wilayah',
    'periksa_kiriman_wilayah',
    // Menerbitkan akun penginput di wilayahnya sendiri. Batasnya ditegakkan
    // Edge Function, bukan izin ini — izin ini hanya menentukan menunya muncul.
    'kelola_pengguna_wilayah',
  ],

  kanwil_penginput: [
    'buat_berita', 'lihat_kiriman_sendiri',
  ],
}

/** Izin yang tidak pernah diberikan kepada peran mana pun selain superadmin. */
export const IZIN_ADMIN = [
  'kelola_pengguna', 'kelola_pengaturan', 'lihat_audit', 'lihat_kesehatan',
  'kelola_integrasi', 'kelola_koordinat', 'kelola_peran',
]

export function punyaIzin(peran, izin) {
  const daftar = IZIN[peran]
  if (!daftar) return false
  if (daftar.includes('*')) return true
  return daftar.includes(izin)
}

export function izinPeran(peran) {
  const daftar = IZIN[peran] || []
  if (daftar.includes('*')) return [...new Set([...Object.values(IZIN).flat().filter((i) => i !== '*'), ...IZIN_ADMIN])]
  return daftar
}

export function labelPeran(peran) {
  return PERAN[peran]?.nama || peran
}

export function adalahEksternal(peran) {
  return PERAN_EKSTERNAL.has(peran)
}

/**
 * Susunan menu. Setiap butir menyebut izin yang dibutuhkan; menu disaring
 * sekali saat sesi dimulai, dan grup yang kosong ikut hilang.
 */
export const MENU = [
  {
    grup: 'Ruang Pimpinan',
    butir: [
      { id: 'dasbor', label: 'Dasbor Eksekutif', ikon: 'dasbor', izin: 'lihat_dasbor' },
      // Kanal negatif berdiri sendiri di menu. Isu yang merugikan institusi
      // tidak boleh dicari dulu di dalam daftar gabungan sebelum bisa dibaca.
      { id: 'negatif', label: 'Kanal Negatif', ikon: 'peringatan', izin: 'lihat_dasbor', lencana: 'negatif' },
      { id: 'positif', label: 'Kanal Positif', ikon: 'centang', izin: 'lihat_dasbor' },
      { id: 'peringatan', label: 'Peringatan Dini', ikon: 'peringatan', izin: 'lihat_peringatan', lencana: 'peringatan' },
      { id: 'peta', label: 'Peta Sebaran', ikon: 'peta', izin: 'lihat_peta' },
      { id: 'tren', label: 'Tren Pemberitaan', ikon: 'tren', izin: 'lihat_tren' },
    ],
  },
  {
    grup: 'Pengelolaan Berita',
    butir: [
      { id: 'berita', label: 'Pusat Data Berita', ikon: 'berita', izin: 'lihat_berita' },
      // Input manual berdiri sendiri di menu, bukan tombol di dalam Pusat Data
      // Berita. Isu viral yang belum tertangkap perayap adalah pekerjaan harian
      // Operator Puldata, dan pekerjaan harian tidak pantas disembunyikan di
      // dalam halaman lain.
      { id: 'input', label: 'Input Berita', ikon: 'tambah', izin: 'buat_berita' },
      { id: 'telaah', label: 'Antrean Telaah', ikon: 'centang', izin: 'telaah_berita', lencana: 'telaah' },
      { id: 'pemetaan', label: 'Pemetaan UPT', ikon: 'peta', izin: 'petakan_upt', lencana: 'pemetaan' },
      { id: 'sinkronisasi', label: 'Sinkronisasi Sumber', ikon: 'sinkron', izin: 'lihat_sinkronisasi' },
    ],
  },
  {
    grup: 'Siklus Intelijen',
    butir: [
      { id: 'kasus', label: 'Kasus Intelijen', ikon: 'kasus', izin: 'lihat_kasus' },
      { id: 'lapangan', label: 'Verifikasi Lapangan', ikon: 'lapangan', izin: 'lihat_penugasan' },
      { id: 'evaluasi', label: 'Evaluasi dan Rekomendasi', ikon: 'tindak', izin: 'analisis_kasus' },
      { id: 'keputusan', label: 'Keputusan Pimpinan', ikon: 'keputusan', izin: 'putuskan_kasus' },
      { id: 'tindak', label: 'Tindak Lanjut', ikon: 'tindak', izin: 'lihat_tindak_lanjut' },
    ],
  },
  {
    grup: 'Pelaporan',
    butir: [
      { id: 'laporan', label: 'Laporan Berkala', ikon: 'laporan', izin: 'lihat_laporan' },
      { id: 'distribusi', label: 'Distribusi Telegram', ikon: 'kirim', izin: 'kirim_telegram' },
    ],
  },
  {
    grup: 'Administrasi',
    butir: [
      { id: 'pengguna', label: 'Manajemen Pengguna', ikon: 'pengguna', izin: 'kelola_pengguna' },
      { id: 'koordinat', label: 'Koordinat UPT', ikon: 'peta', izin: 'kelola_koordinat' },
      { id: 'integrasi', label: 'Integrasi dan Kunci', ikon: 'gembok', izin: 'kelola_integrasi' },
      { id: 'audit', label: 'Jejak Audit', ikon: 'audit', izin: 'lihat_audit' },
      { id: 'kesehatan', label: 'Kesehatan Sistem', ikon: 'kesehatan', izin: 'lihat_kesehatan' },
    ],
  },
]

/**
 * Menu ruang wilayah — berdiri sendiri, bukan hasil saringan atas menu internal.
 *
 * Disusun sebagai daftar terpisah, bukan sebagai menu internal yang dipangkas,
 * supaya butir internal baru tidak pernah bisa bocor ke ruang wilayah hanya
 * karena seseorang lupa memberinya syarat izin.
 *
 * Formulir masukannya sengaja memakai halaman `input` yang sama dengan yang
 * dipakai Operator Puldata. Satu borang, satu mesin klasifikasi, satu perilaku
 * — dua salinan borang yang sama pasti berpisah cepat atau lambat.
 */
export const MENU_KANWIL = [
  {
    grup: 'Ruang Wilayah',
    butir: [
      { id: 'kanwil-dasbor', label: 'Ringkasan Wilayah', ikon: 'dasbor', izin: 'lihat_dasbor_wilayah' },
      { id: 'input', label: 'Kirim Berita', ikon: 'tambah', izin: 'buat_berita' },
      { id: 'kanwil-riwayat', label: 'Riwayat Kiriman', ikon: 'arsip', izin: 'buat_berita' },
      { id: 'pengguna', label: 'Pengguna Wilayah', ikon: 'pengguna', izin: 'kelola_pengguna_wilayah' },
    ],
  },
]

export function menuUntuk(peran) {
  const sumber = adalahEksternal(peran) ? MENU_KANWIL : MENU
  return sumber
    .map((g) => ({ ...g, butir: g.butir.filter((b) => punyaIzin(peran, b.izin)) }))
    .filter((g) => g.butir.length)
}

/**
 * Halaman pertama yang dibuka tiap peran setelah masuk.
 *
 * Diambil dari butir menu pertama yang benar-benar berhak dibuka, bukan dari
 * nama halaman yang ditulis tangan. Nama yang ditulis tangan pernah ada di
 * sini, dan ketika halamannya berganti nama, peran itu mendarat di layar
 * "halaman tidak dikenali" tepat setelah berhasil masuk.
 */
export function halamanAwal(peran) {
  const menu = menuUntuk(peran)
  return menu[0]?.butir[0]?.id || (adalahEksternal(peran) ? 'input' : 'dasbor')
}
