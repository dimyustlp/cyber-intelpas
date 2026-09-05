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
import { dasar } from './hitung.js'
import { ember } from './sentimen.js'
import { belumTerpetakan } from './unit-terpetakan.js'

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

    /*
       Waktu masuk sengaja tertinggal beberapa saat dari waktu terbit.

       Sampai 5 September 2026 keduanya diisi nilai yang sama persis, dan itu
       menjadikan mode peragaan berbohong pada satu angka: ukuran "waktu
       deteksi" di halaman Kesehatan Sistem — selisih antara terbit dan masuk —
       selalu tepat nol menit. Nol menit berarti sistem menangkap setiap berita
       pada detik ia terbit, dan angka sesempurna itu tidak pernah
       dipertanyakan siapa pun; ia hanya membuat ukurannya tampak rusak ketika
       data sungguhan menyebut enam jam.

       Jedanya dijepit ke waktu acuan, supaya tidak ada baris peragaan yang
       tercatat masuk di masa depan.
    */
    const jedaMasuk = Math.floor(acak() * 7 * 3_600_000) + 6 * 60_000
    const masuk = new Date(Math.min(waktu.getTime() + jedaMasuk, acuan.getTime()))
    const hasil = klasifikasikan({ judul })

    daftar.push({
      id: `demo-${String(i + 1).padStart(4, '0')}`,
      judul: i >= JUDUL_CONTOH.length ? `${judul} (perkembangan ${Math.floor(i / JUDUL_CONTOH.length) + 1})` : judul,
      nama_upt: upt,
      media,
      platform: PLATFORM[Math.floor(acak() * PLATFORM.length)],
      link: `https://contoh.id/berita/${i + 1}`,
      created_at: masuk.toISOString(),
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

/*
   `deretHarian` pernah ada di sini dan dipakai dasbor pusat maupun dasbor
   wilayah. Ia dibuang 2 September 2026, bukan sekadar tidak dipakai lagi:
   fungsi peragaan yang dipakai halaman sungguhan adalah undangan agar aturan
   hitungnya menyimpang diam-diam, dan itu memang yang terjadi — ia menghitung
   hari dari waktu penarikan sementara laporan berkala memakai tanggal terbit,
   dan 42 persen baris arsip terbit pada hari yang berbeda dari penarikannya.

   Penggantinya `deretEmpatBelasHari` di lib/hitung.js, tempat seluruh aturan
   angka memang tinggal.
*/

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

/**
 * Bahan mentah Laporan Berkala untuk mode peragaan.
 *
 * Sampai 3 September 2026 halaman Laporan Berkala adalah satu-satunya halaman
 * yang tidak bisa menunjukkan hasilnya di mode peragaan: ia memanggil fungsi
 * `snapshot_negatif` di basis data, dan di mode peragaan tidak ada basis data.
 * Yang muncul selalu "Tidak dapat menghubungi peladen" — sehingga bentuk
 * laporannya, bagian yang paling layak diperiksa mata sebelum dikirim ke
 * pimpinan, tidak pernah bisa dilihat siapa pun tanpa akun sungguhan.
 *
 * Bentuk yang dikembalikan menyalin `snapshot_negatif` kunci demi kunci. Yang
 * membuatnya boleh ada di sini hanyalah itu: `susunLaporan()` tidak diberi
 * jalur peragaan sama sekali, dan tetap menerima satu bentuk masukan. Kalau
 * fungsi basis datanya berubah, yang perlu diperbarui satu tempat ini.
 *
 * @param {object[]} berita  arsip peragaan yang sudah ada di layar
 * @param {{mulai: string, selesai: string}} periode  batas tanggal, format ISO
 */
export function snapshotDemo(berita = [], { mulai, selesai }) {
  const hari = (b) => String(b.tanggal_publikasi || b.created_at || '').slice(0, 10)

  /*
     Himpunan dasarnya diambil `dasar()`, bukan disaring di sini. Fungsi basis
     data menuliskan aturan yang sama dalam SQL; menuliskannya untuk ketiga
     kalinya dalam JavaScript adalah cara paling murah membuat laporan peragaan
     dan laporan sungguhan menghitung dua himpunan yang berbeda.
  */
  const inti = dasar(berita)
  const dalam = inti.filter((b) => hari(b) >= mulai && hari(b) <= selesai)

  // Periode pembanding: sepanjang periode ini, tepat sebelumnya.
  const panjang = Math.round((Date.parse(selesai) - Date.parse(mulai)) / 86_400_000) + 1
  const geser = (iso, n) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10)
  const lalu = { mulai: geser(mulai, -panjang), selesai: geser(mulai, -1) }
  const sebelum = inti.filter((b) => hari(b) >= lalu.mulai && hari(b) <= lalu.selesai)

  const negatif = (daftar) => daftar.filter((b) => ember(b) === 'negatif')

  const unitLalu = {}
  for (const b of negatif(sebelum)) {
    if (belumTerpetakan(b.nama_upt)) continue
    unitLalu[b.nama_upt] = (unitLalu[b.nama_upt] || 0) + 1
  }

  return {
    periode: {
      mulai,
      selesai,
      hari: panjang,
      pembanding_mulai: lalu.mulai,
      pembanding_selesai: lalu.selesai,
    },
    konteks: {
      total: dalam.length,
      negatif: negatif(dalam).length,
      positif: dalam.filter((b) => ember(b) === 'positif').length,
      netral: dalam.filter((b) => ember(b) === 'netral').length,
      lalu_total: sebelum.length,
      lalu_negatif: negatif(sebelum).length,
    },
    unit_lalu: unitLalu,
    publikasi: negatif(dalam)
      .map((b) => ({
        id: b.id,
        judul: b.judul,
        media: b.media || 'Tidak tercatat',
        platform: b.platform || 'Lainnya',
        link: b.link,
        tanggal: b.tanggal_publikasi || b.created_at,
        kategori: b.kategori || 'Lainnya',
        subkategori: b.subkategori || 'Belum Dikelompokkan',
        subkategori_kode: b.subkategori_kode || '0.1',
        urgensi: b.urgensi || 'Rendah',
        sentimen: b.sentimen || 'Netral',
        nama_upt: b.nama_upt || 'Belum Teridentifikasi',
        status_verifikasi: b.status_verifikasi || 'Belum Ditelaah',
        ai_confidence: b.ai_confidence ?? null,
        // Data induk UPT tidak ikut dimuat di mode peragaan. Laporan sungguhan
        // mengambil keduanya dari tabel `upt`; di sini kolomnya sengaja
        // kosong, dan olahLaporan() sudah menggantinya dengan tanda pisah.
        provinsi: b.provinsi || null,
        kanwil: b.kanwil_asal || null,
      }))
      .sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal))),
    dibuat_pada: new Date().toISOString(),
  }
}
