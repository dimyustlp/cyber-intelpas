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
     Dua peran daerah, dibagi menurut CAKUPAN — bukan menurut jenis pekerjaan.

     Pembagiannya sempat tiga dan sempat menurut pekerjaan (siapa menginput,
     siapa memeriksa). Yang berlaku sekarang lebih sederhana dan lebih mudah
     dijelaskan kepada petugas baru: kantor wilayah memegang seluruh unit di
     bawahnya, penelaah memegang satu unit.

     Nama kuncinya sama persis dengan yang diterima basis data pada migrasi 14.
     Kalau keduanya berbeda, pengguna daerah akan mendapat menu internal karena
     perannya tidak dikenali di sini.
  */
  kanwil_admin: {
    nama: 'Administrator Kantor Wilayah',
    ringkas: 'Admin Kanwil',
    lingkup: 'eksternal',
    tugas: 'Memasukkan berita untuk tiap unit di wilayahnya, menerbitkan akun '
      + 'penelaah unit, menelaah, dan memantau seluruh unit yang dibawahinya. '
      + 'Tidak melihat data pusat.',
  },
  upt_penelaah: {
    nama: 'Penelaah Berita UPT',
    ringkas: 'Penelaah UPT',
    lingkup: 'eksternal',
    tugas: 'Menelaah berita unitnya sendiri — memvalidasi atau merevisi penilaian '
      + 'mesin — menuliskan tanggapan resmi unit, dan memantau dasbor unitnya. '
      + 'Tidak melihat unit lain, dan tidak memasukkan berita.',
  },
}

/*
   Nama peran yang sudah tidak dipakai, dipetakan ke penggantinya.

   Penggelaran tidak pernah serentak: basis data, Edge Function, dan berkas web
   berpindah pada menit yang berbeda. Selama beberapa menit itu masih mungkin
   sebuah profil terbaca dengan peran yang sudah dihapus. Tanpa pemetaan ini,
   pemiliknya masuk dan menemukan menu kosong — dan tidak ada satu kalimat pun
   di layar yang menjelaskan mengapa.

   Ketiganya menunjuk ke peran yang sama, dan itu memang yang terjadi: peran
   penelaah kantor wilayah dan petugas unit lebur menjadi satu penelaah unit.
*/
const PERAN_LAMA = {
  kanwil_penginput: 'upt_penelaah',
  kanwil_penelaah: 'upt_penelaah',
  upt_petugas: 'upt_penelaah',
}

/** Nama peran yang berlaku hari ini untuk sebuah nilai apa pun dari basis data. */
export function peranBaku(peran) {
  return PERAN_LAMA[peran] || peran
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
export const PERAN_EKSTERNAL = new Set(['kanwil_admin', 'upt_penelaah'])

/** Peran yang cakupannya satu unit, bukan satu kantor wilayah. */
export const PERAN_UNIT = new Set(['upt_penelaah'])

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

  /*
     Memasukkan berita tinggal pada satu peran daerah.

     Sejak 1 September 2026 hanya admin kanwil — bukan karena penelaah tidak
     dipercaya, melainkan karena satu pintu masuk berarti satu orang yang bisa
     ditanya ketika sebuah kiriman keliru.

     Ia juga tetap boleh menelaah, sekalipun ia sendiri yang memasukkan berita.
     Itu diketahui dan diterima: penelaah unit memeriksa lebih dulu, dan putusan
     keduanya tercatat lengkap dengan nama penelaahnya masing-masing.
  */
  kanwil_admin: [
    'lihat_dasbor_wilayah', 'buat_berita', 'lihat_berita_wilayah',
    'lihat_kiriman_wilayah', 'lihat_unit_wilayah', 'telaah_wilayah',
    // Menerbitkan akun penelaah unit di wilayahnya sendiri. Batasnya ditegakkan
    // Edge Function, bukan izin ini — izin ini hanya menentukan menunya muncul.
    'kelola_pengguna_wilayah',
  ],

  /*
     Penelaah unit tidak mewarisi satu pun izin wilayah.

     Kalau ia diberi `lihat_berita_wilayah`, halaman berita wilayah akan
     terbuka baginya dan menampilkan — persis — apa yang dikirim peladen, yaitu
     unitnya sendiri. Layarnya benar, tetapi judulnya berbohong: ia akan
     membaca "Berita Wilayah" sambil melihat satu unit, dan menyimpulkan
     wilayahnya hanya punya satu unit yang pernah diberitakan.
  */
  upt_penelaah: [
    'lihat_dasbor_unit', 'lihat_berita_unit', 'telaah_wilayah', 'tanggapi_berita_unit',
  ],
}

/** Izin yang tidak pernah diberikan kepada peran mana pun selain superadmin. */
export const IZIN_ADMIN = [
  'kelola_pengguna', 'kelola_pengaturan', 'lihat_audit', 'lihat_kesehatan',
  'kelola_integrasi', 'kelola_koordinat', 'kelola_peran',
]

/*
   Seluruh fungsi di bawah menerjemahkan nama peran lebih dulu lewat
   `peranBaku`. Diletakkan di satu tempat, bukan di tiap pemanggil, supaya
   penambahan nama lama berikutnya tidak menuntut penyuntingan sepuluh berkas.
*/

export function punyaIzin(peran, izin) {
  const daftar = IZIN[peranBaku(peran)]
  if (!daftar) return false
  if (daftar.includes('*')) return true
  return daftar.includes(izin)
}

export function izinPeran(peran) {
  const daftar = IZIN[peranBaku(peran)] || []
  if (daftar.includes('*')) return [...new Set([...Object.values(IZIN).flat().filter((i) => i !== '*'), ...IZIN_ADMIN])]
  return daftar
}

export function labelPeran(peran) {
  return PERAN[peranBaku(peran)]?.nama || peran
}

export function adalahEksternal(peran) {
  return PERAN_EKSTERNAL.has(peranBaku(peran))
}

/** Benar bila cakupan peran ini satu unit, bukan satu kantor wilayah. */
export function adalahUnit(peran) {
  return PERAN_UNIT.has(peranBaku(peran))
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
      /*
         Izin `lihat_briefing` sudah diberikan kepada lima peran sejak lama,
         dan sampai 3 September 2026 tidak ada satu pun butir menu maupun
         halaman yang memakainya — izin yang menganga tanpa pintu. Siapa pun
         yang membaca daftar izin di atas berhak menyimpulkan halamannya ada.
         Sekarang ia ada.
      */
      { id: 'briefing', label: 'Executive Brief', ikon: 'laporan', izin: 'lihat_briefing' },
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
      { id: 'wilayah-telaah', label: 'Telaah Wilayah', ikon: 'centang', izin: 'telaah_wilayah', lencana: 'telaahWilayah' },
      { id: 'wilayah-berita', label: 'Berita Wilayah', ikon: 'berita', izin: 'lihat_berita_wilayah' },
      // Seluruh unit yang dibawahi wilayah ini, bukan sepuluh teratas seperti
      // di dasbor. Kantor wilayah bertanggung jawab atas setiap unitnya —
      // termasuk yang tidak pernah muncul di daftar mana pun.
      { id: 'wilayah-unit', label: 'Unit di Wilayah', ikon: 'peta', izin: 'lihat_unit_wilayah' },
      { id: 'pengguna', label: 'Pengguna Wilayah', ikon: 'pengguna', izin: 'kelola_pengguna_wilayah' },
    ],
  },
]

/**
 * Menu ruang unit — berdiri sendiri, dengan alasan yang sama seperti menu
 * wilayah: butir baru di ruang lain tidak boleh bisa bocor ke sini hanya karena
 * seseorang lupa memberinya syarat izin.
 *
 * Halaman telaahnya persis halaman yang dipakai kantor wilayah. Yang berbeda
 * hanya cakupan datanya, dan cakupan itu ditentukan peladen — bukan halaman.
 */
export const MENU_UPT = [
  {
    grup: 'Ruang Unit',
    butir: [
      { id: 'upt-dasbor', label: 'Ringkasan Unit', ikon: 'dasbor', izin: 'lihat_dasbor_unit' },
      { id: 'wilayah-telaah', label: 'Telaah & Tanggapan', ikon: 'centang', izin: 'telaah_wilayah', lencana: 'telaahWilayah' },
      { id: 'wilayah-berita', label: 'Berita Unit', ikon: 'berita', izin: 'lihat_berita_unit' },
    ],
  },
]

export function menuUntuk(peran) {
  const sumber = adalahUnit(peran) ? MENU_UPT
    : adalahEksternal(peran) ? MENU_KANWIL
      : MENU
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
  if (menu[0]?.butir[0]?.id) return menu[0].butir[0].id
  if (adalahUnit(peran)) return 'upt-dasbor'
  return adalahEksternal(peran) ? 'kanwil-dasbor' : 'dasbor'
}

/* ------------------------------------------------- hak membuka halaman */

/**
 * Halaman mana menuntut izin apa — diturunkan dari ketiga susunan menu di
 * atas, bukan ditulis ulang di sini.
 *
 * Alasannya sama dengan alasan `halamanAwal` mengambil tujuannya dari menu:
 * daftar yang ditulis tangan akan benar pada hari ia ditulis dan salah pada
 * hari sebuah halaman berganti syarat izinnya, tanpa satu pun tanda bahwa ia
 * sudah salah.
 *
 * Satu halaman bisa punya lebih dari satu syarat, dan itu bukan kelonggaran
 * yang tidak disengaja: `input` dituntut `buat_berita` di ruang pusat maupun
 * di ruang wilayah, sedangkan `pengguna` dituntut `kelola_pengguna` di pusat
 * tetapi `kelola_pengguna_wilayah` di wilayah. Memenuhi salah satunya cukup —
 * yang menahan datanya tetap RLS, bukan daftar ini.
 */
const SYARAT_HALAMAN = (() => {
  const peta = new Map()
  for (const menu of [MENU, MENU_KANWIL, MENU_UPT]) {
    for (const grup of menu) {
      for (const b of grup.butir) {
        if (!peta.has(b.id)) peta.set(b.id, new Set())
        peta.get(b.id).add(b.izin)
      }
    }
  }
  return peta
})()

/**
 * Halaman yang tidak punya butir menu, tetapi tetap sah dibuka.
 *
 * Ketiadaan butir menu bukan ketiadaan hak. Detail berita dibuka dari Pusat
 * Data Berita dan dari palet perintah; halaman profil milik siapa pun yang
 * punya sesi, termasuk petugas daerah — karena itu syaratnya `null`, bukan
 * sebuah nama izin.
 *
 * `berita-detail` sengaja hanya menuntut izin berita PUSAT. Peran daerah tidak
 * diberi jalan ke sini, dan itu keputusan yang sudah diambil: halaman ini
 * menampilkan `review_note` serta `verified_by` dari pusat, dan membukanya
 * bagi daerah berarti melepas catatan analis pusat ke wilayah tanpa seorang
 * pun memutuskannya.
 */
const SYARAT_TAMBAHAN = {
  'berita-detail': 'lihat_berita',
  profil: null,
  /* Nama lama halaman berita daerah, dipertahankan untuk tautan tersimpan. */
  'kanwil-riwayat': 'lihat_berita_wilayah',
}

/**
 * Benar bila peran ini berhak membuka halaman itu.
 *
 * Dipakai di tiga tempat, dan ketiganya perlu: penjaga rute di main.js (untuk
 * alamat yang diketik atau disalin), penyaring tombol sesudah halaman
 * digambar (untuk tombol yang menjanjikan halaman yang tidak akan terbuka),
 * dan halaman yang ingin menyembunyikan tombolnya sendiri lebih awal.
 *
 * Halaman yang tidak dikenali menghasilkan `true`, bukan `false`. Yang berhak
 * menolaknya adalah penunjuk halaman dengan layar "halaman tidak dikenali"
 * miliknya sendiri — kalau ditolak di sini, alamat yang salah ketik akan
 * terbaca sebagai penolakan hak, dan yang membacanya akan mengira ia kurang
 * izin padahal ia hanya salah mengetik.
 */
export function bolehBuka(peran, halaman) {
  if (Object.prototype.hasOwnProperty.call(SYARAT_TAMBAHAN, halaman)) {
    const syarat = SYARAT_TAMBAHAN[halaman]
    return syarat === null || punyaIzin(peran, syarat)
  }
  const syarat = SYARAT_HALAMAN.get(halaman)
  if (!syarat) return true
  return [...syarat].some((izin) => punyaIzin(peran, izin))
}
