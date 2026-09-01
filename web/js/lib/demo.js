/**
 * Data contoh untuk mode demo.
 *
 * Dipakai saat aplikasi dibuka dengan ?mode=demo — untuk memeriksa tampilan,
 * melatih petugas baru, dan memotret layar tanpa menyentuh data sungguhan.
 * Isinya menyerupai data nyata: judul berita bergaya media Indonesia, nama UPT
 * yang benar-benar ada, dan sebaran kategori yang mendekati kondisi lapangan.
 *
 * Tidak ada satu pun nama orang sungguhan di berkas ini.
 */

import { klasifikasikan } from './klasifikasi.js'

const JUDUL_CONTOH = [
  ['Tiga Narapidana Kabur dari Lapas Kelas IIB Warungkiara Saat Program Asimilasi', 'Lapas Kelas IIB Warungkiara', 'Radar Sukabumi'],
  ['Oknum Sipir Rutan Kelas I Medan Ditangkap BNN Kedapatan Bawa Sabu 1,2 Kilogram', 'Rutan Kelas I Medan', 'Waspada Online'],
  ['Kerusuhan Pecah di Lapas Kelas IIA Cilegon, Puluhan Warga Binaan Dievakuasi', 'Lapas Kelas IIA Cilegon', 'Banten Pos'],
  ['Napi Kendalikan Penipuan Daring dari Balik Jeruji Lapas Kelas I Tangerang', 'Lapas Kelas I Tangerang', 'Detik'],
  ['Keluarga Warga Binaan Mengeluh Dimintai Uang Rp 3 Juta oleh Oknum Petugas untuk Pindah Kamar', 'Rutan Kelas I Medan', 'Tribun Medan'],
  ['Sebanyak 20.500 Warga Binaan di Jawa Barat Terima Remisi HUT ke-81 RI', 'Lapas Kelas I Bandung', 'Antara'],
  ['Petugas Lapas Kelas IIA Banyuwangi Gagalkan Penyelundupan Sabu yang Dilempar dari Luar Tembok', 'Lapas Kelas IIA Banyuwangi', 'Jawa Pos'],
  ['Kebakaran Aula Lapas Kelas IIB Ngawi, 305 Warga Binaan Dievakuasi Tanpa Korban Jiwa', 'Lapas Kelas IIB Ngawi', 'Kompas'],
  ['Lapas Kelas IIA Waingapu Klarifikasi Video Viral, Tegaskan Rekaman Lama Tahun 2024', 'Lapas Kelas IIA Waingapu', 'Pos Kupang'],
  ['Baru Bebas Asimilasi Sepekan, Residivis Curanmor Kembali Ditangkap Polisi', 'Lapas Kelas IIB Sleman', 'Tribun Jogja'],
  ['Warga Binaan Lapas Kelas IIB Ciangir Panen Perdana Program Ketahanan Pangan', 'Lapas Kelas IIB Ciangir', 'InfoPAS'],
  ['Video Sel Diduga Mewah di Lapas Kelas IIA Cilegon Viral di Media Sosial', 'Lapas Kelas IIA Cilegon', 'Kumparan'],
  ['Keluhan Kualitas Makanan di Lapas Kelas IIB Sorong yang Sudah Overkapasitas Parah', 'Lapas Kelas IIB Sorong', 'Papua Pos'],
  ['Tiga Warga Binaan Lapas Kelas I Cipinang Kedapatan Miliki Ponsel Ilegal', 'Lapas Kelas I Cipinang', 'CNN Indonesia'],
  ['Rutan Kelas IIB Gresik Raih Predikat Wilayah Bebas dari Korupsi', 'Rutan Kelas IIB Gresik', 'Surya'],
  ['Petugas Lapas Kelas I Blitar Diperiksa Terkait Dugaan Pungutan Liar terhadap Warga Binaan', 'Lapas Kelas I Blitar', 'Detik Jatim'],
  ['Napiter di Lapas Kelas I Semarang Tolak Ikuti Upacara dan Ikrar Setia NKRI', 'Lapas Kelas I Semarang', 'Suara Merdeka'],
  ['Pemindahan 460 Warga Binaan ke Gedung Lapas Baru Lhokseumawe Berjalan dengan Pengamanan Berlapis', 'Lapas Kelas IIA Lhok Seumawe', 'Serambi'],
  ['Razia Gabungan di Rutan Kelas I Pondok Bambu Temukan Belasan Ponsel', 'Rutan Kelas I Pondok Bambu', 'Warta Kota'],
  ['Warga Binaan Lapas Kelas IIA Yogyakarta Ikuti Pendidikan Kesetaraan Paket C', 'Lapas Kelas IIA Yogyakarta', 'InfoPAS'],
  ['Ditemukan Tak Bernyawa di Sel, Keluarga Tuntut Autopsi Ulang Warga Binaan Rutan Kelas IIB Blora', 'Rutan Kelas IIB Blora', 'Radar Kudus'],
  ['Lapas Kelas IIA Palopo Gelar Apel Kesiapsiagaan Jelang Hari Pengayoman', 'Lapas Kelas IIA Palopo', 'InfoPAS'],
  ['Upaya Penyelundupan Narkoba dengan Drone ke Lapas Kelas I Surabaya Digagalkan', 'Lapas Kelas I Surabaya', 'Radar Surabaya'],
  ['Kanwil Ditjenpas DKI Jakarta Membantah Dugaan Intimidasi terhadap Tahanan Perempuan', 'Rutan Kelas I Pondok Bambu', 'Tempo'],
]

const PLATFORM = ['Google News', 'Portal Berita', 'YouTube', 'Instagram', 'Facebook', 'TikTok']
const STATUS = ['Belum Ditelaah', 'Belum Ditelaah', 'Belum Ditelaah', 'Terverifikasi', 'Perlu Koreksi']

/** Deret acak yang sama setiap kali dimuat, supaya tangkapan layar konsisten. */
function acakStabil(benih) {
  let x = benih
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296
    return x / 4294967296
  }
}

/*
   Acuan waktunya hari ini, bukan tanggal tetap.

   Sebelumnya berkas ini menaruh seluruh berita peragaan di sekitar 22 Agustus
   2026. Selama beberapa hari itu tidak terasa; sesudah beberapa pekan, setiap
   bagan "empat belas hari terakhir" pada mode peragaan menjadi kosong melompong
   — dan yang membukanya menyimpulkan bagannya rusak, bukan datanya yang tua.

   Sebaran jam antarberita tetap dihasilkan deret acak berbenih tetap, jadi
   bentuk datanya tetap sama persis dari satu pemuatan ke pemuatan berikutnya.
   Yang bergerak hanya titik nolnya.
*/
export function buatBerita(jumlah = 96, acuan = new Date()) {
  const acak = acakStabil(20260822)
  const daftar = []

  for (let i = 0; i < jumlah; i++) {
    const [judul, upt, media] = JUDUL_CONTOH[i % JUDUL_CONTOH.length]
    const geser = Math.floor(acak() * 14 * 24 * 60) * 60_000
    const waktu = new Date(acuan.getTime() - geser)
    const hasil = klasifikasikan({ judul })

    daftar.push({
      id: `demo-${String(i + 1).padStart(4, '0')}`,
      judul: i >= JUDUL_CONTOH.length ? `${judul} (perkembangan ${Math.floor(i / JUDUL_CONTOH.length) + 1})` : judul,
      nama_upt: upt,
      media,
      platform: PLATFORM[Math.floor(acak() * PLATFORM.length)],
      link: `https://contoh.id/berita/${i + 1}`,
      created_at: waktu.toISOString(),
      tanggal_publikasi: waktu.toISOString(),
      status_verifikasi: STATUS[Math.floor(acak() * STATUS.length)],
      source_type: acak() > 0.25 ? 'google_sheet' : 'manual',
      ringkasan: hasil.alasan,
      rekomendasi: 'Pantau perkembangan dan pastikan SOP di unit terkait berjalan sesuai aturan.',
      ...hasil,
    })
  }

  return daftar.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/**
 * Contoh daftar pengguna untuk mode peragaan.
 *
 * Ada supaya layar Manajemen Pengguna bisa diperiksa bentuknya tanpa peladen —
 * termasuk dua keadaan yang paling sering ditanyakan dan paling sulit dibuat
 * sengaja pada data sungguhan: profil yang belum punya akun masuk, dan akun
 * wilayah yang wilayahnya belum ditetapkan.
 */
export function penggunaDemo() {
  return [
    {
      id: 'demo-1', username: 'dimas.pratama', full_name: 'Dimas Pratama',
      role: 'super_admin', jabatan: 'Administrator Sistem',
      assigned_kanwil: null, assigned_upt: null, aktif: true,
      auth_user_id: 'auth-1', last_login: new Date(Date.now() - 3 * 3600e3).toISOString(),
    },
    {
      id: 'demo-2', username: 'rina.analis', full_name: 'Rina Kusumaningrum',
      role: 'media_intelligence_analyst', jabatan: 'Analis Intelijen Media',
      assigned_kanwil: null, assigned_upt: null, aktif: true,
      auth_user_id: 'auth-2', last_login: new Date(Date.now() - 26 * 3600e3).toISOString(),
    },
    {
      id: 'demo-3', username: 'budi.puldata', full_name: 'Budi Santoso',
      role: 'news_data_operator', jabatan: 'Operator Pengumpulan Data',
      assigned_kanwil: null, assigned_upt: null, aktif: true,
      auth_user_id: null, last_login: null,
    },
    {
      id: 'demo-4', username: 'kanwil.jatim', full_name: 'Petugas Kanwil Jawa Timur',
      role: 'kanwil_admin', jabatan: 'Administrator Kantor Wilayah',
      assigned_kanwil: KANWIL_DEMO, assigned_upt: null, aktif: true,
      auth_user_id: 'auth-4', last_login: new Date(Date.now() - 50 * 3600e3).toISOString(),
    },
    {
      id: 'demo-5', username: 'lapas.kediri', full_name: 'Penelaah Lapas Kediri',
      role: 'upt_penelaah', jabatan: 'Kasubsi Pengamanan',
      assigned_kanwil: KANWIL_DEMO, assigned_upt: UPT_DEMO, aktif: true,
      auth_user_id: 'auth-5', last_login: new Date(Date.now() - 5 * 3600e3).toISOString(),
    },
    {
      /* Akun penelaah yang unitnya belum ditetapkan. Keadaan ini sengaja ada di
         data peragaan: ia yang paling sering ditanyakan dan paling sulit dibuat
         dengan sengaja pada data sungguhan — layarnya kosong, dan yang membuka
         Manajemen Pengguna harus bisa melihat sebabnya dari daftarnya. */
      id: 'demo-7', username: 'upt.baru', full_name: 'Penelaah Unit Baru',
      role: 'upt_penelaah', jabatan: 'Penelaah Berita',
      assigned_kanwil: KANWIL_DEMO, assigned_upt: null, aktif: true,
      auth_user_id: 'auth-7', last_login: null, must_change_password: true,
    },
    {
      id: 'demo-6', username: 'agus.lama', full_name: 'Agus Wijaya',
      role: 'field_verification_officer', jabatan: 'Petugas Verifikasi Lapangan',
      assigned_kanwil: null, assigned_upt: null, aktif: false,
      auth_user_id: 'auth-6', last_login: new Date(Date.now() - 40 * 86400e3).toISOString(),
    },
  ]
}

/*
   Wilayah dan unit peragaan.

   Keduanya ditulis PERSIS seperti pada data induk UPT, bukan disingkat menjadi
   "Kanwil Jawa Barat" seperti sebelumnya. Penyaringan wilayah di seluruh sistem
   ini mencocokkan huruf demi huruf; nama singkat membuat halaman yang menyaring
   unit menurut kanwil-nya menemukan nol unit, dan layar kosong itu terbaca
   sebagai halaman yang rusak, bukan sebagai konstanta peragaan yang keliru.

   Unitnya sengaja Lapas Kediri: itu contoh yang dipakai pengguna sistem ini
   sendiri ketika menjelaskan apa yang boleh dilihat sebuah unit.
*/
export const KANWIL_DEMO = 'Kantor Wilayah Ditjenpas Jawa Timur'

export const UPT_DEMO = 'Lapas Kelas IIA Kediri'

export function profilDemo(peran = 'media_intelligence_analyst') {
  const unit = peran === 'upt_penelaah'
  const daerah = unit || peran === 'kanwil_admin'

  return {
    id: 'demo-pengguna',
    username: unit ? 'demo.upt' : daerah ? 'demo.kanwil' : 'demo',
    full_name: unit ? 'Penelaah Unit Peragaan'
      : daerah ? 'Petugas Kanwil Peragaan' : 'Pengguna Peragaan',
    role: peran,
    jabatan: 'Mode Peragaan',
    // Peran daerah tanpa cakupan akan melihat layar yang seluruhnya berisi
    // peringatan. Untuk peragaan, cakupannya diisi supaya bentuk halamannya
    // yang terlihat — bukan pesan galatnya.
    assigned_kanwil: daerah ? KANWIL_DEMO : null,
    assigned_upt: unit ? UPT_DEMO : null,
    aktif: true,
  }
}

/**
 * Deret 14 hari untuk bagan tren.
 *
 * Acuannya hari ini. Deret "empat belas hari terakhir" yang ditambatkan ke
 * sebuah tanggal tetap berhenti bergerak tanpa memberi tahu siapa pun, dan
 * pembacanya menyimpulkan pemberitaan yang berhenti — bukan bagannya.
 */
export function deretHarian(berita, hari = 14, acuan = new Date()) {
  const ember = new Map()
  for (let i = hari - 1; i >= 0; i--) {
    const d = new Date(acuan.getTime() - i * 86_400_000)
    ember.set(d.toISOString().slice(0, 10), { tanggal: d.toISOString().slice(0, 10), total: 0, negatif: 0 })
  }
  for (const b of berita) {
    const k = b.created_at.slice(0, 10)
    const e = ember.get(k)
    if (!e) continue
    e.total += 1
    if (b.sentimen === 'Negatif') e.negatif += 1
  }
  return [...ember.values()]
}

export function sebaran(berita, bidang) {
  const peta = new Map()
  for (const b of berita) {
    const k = b[bidang] || 'Tidak diketahui'
    peta.set(k, (peta.get(k) || 0) + 1)
  }
  return [...peta.entries()]
    .map(([label, jumlah]) => ({ label, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah)
}
