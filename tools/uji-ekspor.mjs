/**
 * Uji klasifikasi informasi dan ekspor.
 *
 * Dua janji yang diuji di sini, dan keduanya baru terlihat dilanggar berbulan
 * kemudian bila tidak dijaga sekarang:
 *
 *   1. **Tuduhan yang belum diperiksa berjalan lebih sempit daripada tuduhan
 *      yang sudah terbukti.** Urutan itu mudah terbalik ketika seseorang
 *      berpikir "terverifikasi berarti lebih serius". Berkas yang beredar
 *      berisi dugaan yang kemudian keliru tidak bisa ditarik kembali.
 *   2. **Tingkat sebuah kumpulan adalah yang tertinggi di antara isinya**,
 *      bukan rata-rata dan bukan yang pertama. Satu baris rahasia di dalam
 *      seribu baris internal menjadikan seluruh berkas rahasia, sebab berkas
 *      itu berpindah tangan sebagai satu benda.
 *
 * Selebihnya memeriksa hal-hal yang harus berlaku pada setiap berkas keluaran:
 * kepala keterangannya lengkap, pengutipannya tahan terhadap koma dan tanda
 * kutip di dalam judul berita, dan haknya diperiksa sebelum berkas disusun.
 *
 * Dijalankan tanpa peramban: node tools/uji-ekspor.mjs
 */

import {
  TINGKAT, tingkatDari, tingkatBerita, tingkatKumpulan, bolehMembawa,
  bannerTingkat, labelTingkat,
} from '../web/js/lib/klasifikasi-informasi.js'
import {
  nomorEkspor, namaBerkas, susunKeterangan, keCsv, keCsvPolos, keJson,
  ekspor, unduh, KOLOM_BERITA,
} from '../web/js/lib/ekspor.js'

let lulus = 0
let gagal = 0

function periksa(nama, kondisi, rinci = '') {
  if (kondisi) { lulus += 1; return }
  gagal += 1
  console.error(`  GAGAL  ${nama}${rinci ? ` — ${rinci}` : ''}`)
}

function sama(nama, dapat, harap) {
  periksa(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, seharusnya ${JSON.stringify(harap)}`)
}

const WAKTU = new Date('2026-09-05T09:41:00+07:00')

function berita(x = {}) {
  return {
    id: x.id || 'uji',
    judul: x.judul || 'Judul uji',
    nama_upt: 'Lapas Kelas IIA Cilegon',
    kanwil_asal: 'Kantor Wilayah Ditjenpas Banten',
    provinsi: 'Banten',
    media: 'Banten Pos',
    platform: 'Portal Berita',
    kategori: x.kategori || 'Keamanan dan Ketertiban',
    subkategori: 'Penyelundupan Barang Terlarang',
    sentimen: x.sentimen || 'Negatif',
    urgensi: x.urgensi || 'Sedang',
    status_verifikasi: x.status || 'Belum Ditelaah',
    tanggal_publikasi: WAKTU.toISOString(),
    created_at: WAKTU.toISOString(),
    link: 'https://contoh.id/berita/1',
  }
}

/* ------------------------------------------------------ 1. daftar tingkat */

console.log('\n1. Daftar tingkat')

sama('ada lima tingkat', TINGKAT.length, 5)
periksa('urutannya menanjak tanpa lompatan',
  TINGKAT.every((t, i) => t.urutan === i + 1))
periksa('setiap tingkat punya nada warna',
  TINGKAT.every((t) => ['positif', 'netral', 'sedang', 'tinggi', 'kritis'].includes(t.nada)))
periksa('setiap tingkat menjelaskan perlakuannya',
  TINGKAT.every((t) => t.keterangan.length > 30))
periksa('setiap tingkat menyebut izin yang membukanya',
  TINGKAT.every((t) => Array.isArray(t.izin) && t.izin.length))
periksa('tingkat makin tinggi tidak makin longgar izinnya',
  TINGKAT[4].izin.length <= TINGKAT[1].izin.length)

sama('kode tak dikenal jatuh ke internal', tingkatDari('entahapa').kode, 'internal')
sama('label terbaca', labelTingkat('rahasia'), 'Rahasia')
periksa('banner memuat label dalam huruf besar', bannerTingkat('rahasia').startsWith('RAHASIA —'))
periksa('banner memuat kalimat perlakuannya', bannerTingkat('rahasia').length > 40)

/* --------------------------------------------------- 2. penurunan tingkat */

console.log('2. Penurunan tingkat dari sebuah baris')

sama('positif terverifikasi adalah internal',
  tingkatBerita(berita({ sentimen: 'Positif', urgensi: 'Rendah', status: 'Terverifikasi' })), 'internal')
sama('netral belum ditelaah tetap internal',
  tingkatBerita(berita({ sentimen: 'Netral', urgensi: 'Rendah', status: 'Belum Ditelaah' })), 'internal')
sama('negatif terverifikasi adalah terbatas',
  tingkatBerita(berita({ sentimen: 'Negatif', urgensi: 'Sedang', status: 'Terverifikasi' })), 'terbatas')

// Janji nomor satu.
sama('negatif yang belum diperiksa adalah rahasia',
  tingkatBerita(berita({ sentimen: 'Negatif', urgensi: 'Sedang', status: 'Belum Ditelaah' })), 'rahasia')
{
  const belum = tingkatDari(tingkatBerita(
    berita({ sentimen: 'Negatif', urgensi: 'Sedang', status: 'Belum Ditelaah' })))
  const sudah = tingkatDari(tingkatBerita(
    berita({ sentimen: 'Negatif', urgensi: 'Sedang', status: 'Terverifikasi' })))
  periksa('yang belum diperiksa berjalan lebih sempit daripada yang sudah',
    belum.urutan > sudah.urutan, `${belum.kode} vs ${sudah.kode}`)
}

sama('mendesak selalu rahasia meski positif',
  tingkatBerita(berita({ sentimen: 'Positif', urgensi: 'Kritis', status: 'Terverifikasi' })), 'rahasia')
sama('urgensi tinggi juga rahasia',
  tingkatBerita(berita({ urgensi: 'Tinggi', status: 'Terverifikasi' })), 'rahasia')

// Baris yang sudah dinyatakan tidak valid tetap dinilai — justru berkas yang
// memuatnya lebih perlu diberi label.
sama('baris tidak valid dinilai sebagai sudah diperiksa',
  tingkatBerita(berita({ sentimen: 'Negatif', urgensi: 'Sedang', status: 'Tidak Valid' })), 'terbatas')
sama('baris tanpa isi tidak meledak', tingkatBerita(null), 'internal')

/* ------------------------------------------------------- 3. kumpulan */

console.log('3. Tingkat sebuah kumpulan')

{
  const kumpulan = [
    berita({ id: '1', sentimen: 'Positif', urgensi: 'Rendah', status: 'Terverifikasi' }),
    berita({ id: '2', sentimen: 'Netral', urgensi: 'Rendah', status: 'Terverifikasi' }),
    berita({ id: '3', sentimen: 'Negatif', urgensi: 'Kritis', status: 'Belum Ditelaah' }),
  ]
  sama('satu baris rahasia menaikkan seluruhnya', tingkatKumpulan(kumpulan), 'rahasia')
  sama('urutan baris tidak berpengaruh', tingkatKumpulan([...kumpulan].reverse()), 'rahasia')
}
sama('kumpulan kosong memakai dasarnya', tingkatKumpulan([]), 'internal')
sama('dasar boleh dinaikkan pemanggil',
  tingkatKumpulan([], 'sangat_terbatas'), 'sangat_terbatas')
sama('dasar yang tinggi tidak diturunkan isinya',
  tingkatKumpulan([berita({ sentimen: 'Positif', status: 'Terverifikasi' })], 'sangat_terbatas'),
  'sangat_terbatas')

/* -------------------------------------------------------------- 4. hak */

console.log('4. Hak membawa keluar')

periksa('superadmin boleh membawa apa pun',
  TINGKAT.every((t) => bolehMembawa('super_admin', t.kode)))
periksa('analis media boleh membawa yang rahasia',
  bolehMembawa('media_intelligence_analyst', 'rahasia'))
periksa('operator puldata tidak boleh membawa yang rahasia',
  !bolehMembawa('news_data_operator', 'rahasia'))
periksa('operator puldata tetap boleh membawa yang internal',
  bolehMembawa('news_data_operator', 'internal'))
periksa('penelaah unit tidak boleh membawa yang sangat terbatas',
  !bolehMembawa('upt_penelaah', 'sangat_terbatas'))
periksa('penelaah unit boleh membawa yang terbatas dari unitnya',
  bolehMembawa('upt_penelaah', 'terbatas'))
periksa('pimpinan boleh membawa yang sangat terbatas',
  bolehMembawa('executive_decision_maker', 'sangat_terbatas'))
periksa('peran yang tidak dikenal tidak boleh membawa apa pun',
  TINGKAT.every((t) => !bolehMembawa('entahsiapa', t.kode)))

/* ------------------------------------------------------- 5. bentuk berkas */

console.log('5. Bentuk berkas')

periksa('nomor berkas berpola', /^TSP-\d{8}-[A-Z0-9]{4}$/.test(nomorEkspor(WAKTU)))
periksa('dua nomor berturut-turut berbeda', nomorEkspor(WAKTU) !== nomorEkspor(WAKTU))
sama('nama berkas dibersihkan',
  namaBerkas('Hasil Pencarian: "Sabu" & Cilegon', 'csv', WAKTU),
  'trans-siber-pas-hasil-pencarian-sabu-cilegon-2026-09-05.csv')
sama('nama berkas tanpa judul tetap sah',
  namaBerkas('', 'json', WAKTU), 'trans-siber-pas-keluaran-2026-09-05.json')

const CONTOH = [
  berita({ id: '1', judul: 'Judul berisi, koma dan "tanda kutip"' }),
  berita({ id: '2', sentimen: 'Positif', urgensi: 'Rendah', status: 'Terverifikasi' }),
]

const keterangan = susunKeterangan({
  judul: 'Hasil pencarian',
  tingkat: tingkatKumpulan(CONTOH),
  profil: { full_name: 'Dimas Pratama', username: 'dimas.pratama', role: 'media_intelligence_analyst' },
  kueri: 'upt:"Lapas Kelas IIA Cilegon" sabu',
  jumlah: CONTOH.length,
  waktu: WAKTU,
})

sama('keterangan mengambil tingkat kumpulan', keterangan.tingkat, 'rahasia')
sama('keterangan menyebut nama pengunduh', keterangan.oleh, 'Dimas Pratama')
sama('keterangan menerjemahkan peran', keterangan.peran, 'Analis Intelijen Media')
sama('keterangan menyimpan kuerinya', keterangan.kueri, 'upt:"Lapas Kelas IIA Cilegon" sabu')
sama('keterangan tanpa kueri berbunyi seluruh baris',
  susunKeterangan({ judul: 'x', waktu: WAKTU }).kueri, 'seluruh baris')

{
  const csv = keCsv({ kolom: KOLOM_BERITA, baris: CONTOH, keterangan })
  const baris = csv.split('\r\n')

  periksa('kepala diawali klasifikasi', baris[0].startsWith('"# Klasifikasi","RAHASIA"'))
  periksa('kepala menyebut nomor berkas', csv.includes('"# Nomor berkas"'))
  periksa('kepala menyebut pengunduh beserta perannya',
    csv.includes('"Dimas Pratama (Analis Intelijen Media)"'))
  periksa('kepala menyebut saringannya', csv.includes('upt:""Lapas Kelas IIA Cilegon"" sabu'))
  periksa('kepala menyebut jumlah baris', csv.includes('"# Jumlah baris","2"'))

  const kosong = baris.indexOf('')
  periksa('ada satu baris kosong pemisah', kosong > 0)
  sama('baris sesudah pemisah adalah judul kolom',
    baris[kosong + 1].startsWith('"Judul","UPT"'), true)
  sama('jumlah baris isi sama dengan jumlah datanya',
    baris.length - kosong - 2, CONTOH.length)

  // Pengutipan. Judul contoh memuat koma dan tanda kutip sekaligus.
  periksa('tanda kutip di dalam nilai digandakan',
    csv.includes('"Judul berisi, koma dan ""tanda kutip"""'))
}

{
  const polos = keCsvPolos({ kolom: KOLOM_BERITA, baris: CONTOH })
  periksa('bentuk polos langsung dimulai judul kolom', polos.startsWith('"Judul","UPT"'))
  periksa('bentuk polos tidak memuat kepala keterangan', !polos.includes('# Klasifikasi'))
  sama('bentuk polos berisi judul kolom ditambah barisnya',
    polos.split('\r\n').length, CONTOH.length + 1)
}

{
  const isi = JSON.parse(keJson({ kolom: KOLOM_BERITA, baris: CONTOH, keterangan }))
  sama('JSON menyimpan keterangan terpisah', isi.keterangan.tingkat, 'rahasia')
  sama('JSON menyebut daftar kolomnya', isi.kolom.length, KOLOM_BERITA.length)
  sama('JSON berisi seluruh baris', isi.baris.length, CONTOH.length)
  sama('nilai baris memakai kunci kolom', isi.baris[0].nama_upt, 'Lapas Kelas IIA Cilegon')
  periksa('nilai tanggal sudah diformat, bukan ISO mentah',
    !String(isi.baris[0].created_at).includes('T'))
}

/* --------------------------------------------------------- 6. penjagaan */

console.log('6. Penjagaan sebelum berkas disusun')

{
  const hasil = ekspor({ judul: 'Kosong', kolom: KOLOM_BERITA, baris: [], profil: null })
  periksa('daftar kosong ditolak', !hasil.berhasil)
  periksa('dan alasannya disebutkan', hasil.alasan.includes('Tidak ada baris'))
}
{
  const hasil = ekspor({
    judul: 'Rahasia', kolom: KOLOM_BERITA, baris: CONTOH, tingkat: 'rahasia',
    profil: { username: 'operator', role: 'news_data_operator' },
  })
  periksa('peran tanpa hak ditolak', !hasil.berhasil)
  periksa('penolakan menyebut tingkat berkasnya', hasil.alasan.includes('Rahasia'))
}
{
  // Di Node tidak ada URL.createObjectURL, jadi jalur ini yang tercapai —
  // dan yang diuji memang itu: kegagalan pengunduhan dilaporkan, bukan didiamkan.
  const hasil = unduh({ nama: 'x.csv', isi: 'a,b' })
  periksa('ketiadaan dukungan peramban dilaporkan', !hasil.berhasil)
  periksa('dengan kalimat yang bisa dibaca petugas', hasil.alasan.length > 20)
}
{
  const hasil = ekspor({
    judul: 'Boleh', kolom: KOLOM_BERITA, baris: CONTOH, tingkat: 'rahasia',
    profil: { username: 'analis', role: 'media_intelligence_analyst' },
  })
  periksa('peran berhak lolos pemeriksaan hak dan sampai ke pengunduh',
    !hasil.berhasil && !hasil.alasan.includes('tidak berhak'))
  periksa('keterangan tetap tersusun meski unduhannya gagal', Boolean(hasil.keterangan?.nomor))
}

/* ------------------------------------------------------------ 7. kolom */

console.log('7. Kolom baku berita')

periksa('setiap kolom punya kunci, label, dan pengambil',
  KOLOM_BERITA.every((k) => k.kunci && k.label && typeof k.ambil === 'function'))
periksa('tidak ada kunci kembar',
  new Set(KOLOM_BERITA.map((k) => k.kunci)).size === KOLOM_BERITA.length)
periksa('pengambil tahan terhadap baris kosong',
  KOLOM_BERITA.every((k) => { try { k.ambil({}); return true } catch { return false } }))

/* ----------------------------------------------------------------- akhir */

console.log(`\n  ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
