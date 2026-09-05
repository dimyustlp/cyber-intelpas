/**
 * Uji bahasa kueri.
 *
 * Empat golongan pemeriksaan, dan ketiga yang pertama menjawab pertanyaan
 * yang sama dari sudut berbeda: apakah yang dibaca mesin sama dengan yang
 * dimaksud pengetiknya.
 *
 *   1. Bentuk pohon — terutama urutan pengikatan. `a ATAU b c` yang terbaca
 *      sebagai `(a ATAU b) DAN c` akan mengembalikan daftar yang salah tanpa
 *      satu pun tanda bahwa ia salah, sebab daftar yang salah tetap berisi
 *      baris yang masuk akal.
 *   2. Pencocokan — imbuhan, frasa berurutan, kedekatan, jokar, dan bidang.
 *   3. Kueri yang belum selesai diketik tidak boleh melempar dan tidak boleh
 *      mengosongkan hasil. Kotak pencarian menerima satu huruf pada satu
 *      waktu; separuh keadaan yang dilaluinya memang belum utuh.
 *   4. Keterangan — kalimat yang dikembalikan `jelaskan()` harus benar-benar
 *      menyebut ulang kuerinya, sebab itulah satu-satunya cara penulis kueri
 *      memeriksa anggapannya sendiri.
 *
 * Dijalankan tanpa peramban: node tools/uji-kueri.mjs
 */

import {
  uraiKueri, cocokkan, saringKueri, jelaskan, kataSorot, sebagaiKueri, BIDANG,
} from '../web/js/lib/kueri.js'

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

/** Menyaring dengan teks kueri lalu mengembalikan daftar id yang lolos. */
function id(daftar, teks) {
  return saringKueri(daftar, teks).hasil.map((b) => b.id).join(',')
}

/* --------------------------------------------------------------- data uji */

const ARSIP = [
  {
    id: 'a',
    judul: 'Upaya Penyelundupan Sabu ke Lapas Kelas IIA Cilegon Digagalkan Petugas',
    ringkasan: 'Petugas menggagalkan paket berisi narkotika yang dilempar dari luar tembok.',
    nama_upt: 'Lapas Kelas IIA Cilegon',
    media: 'Banten Pos',
    platform: 'Portal Berita',
    kategori: 'Keamanan dan Ketertiban',
    subkategori: 'Penyelundupan Barang Terlarang',
    sentimen: 'Negatif',
    urgensi: 'Tinggi',
    status_verifikasi: 'Terverifikasi',
    kanwil_asal: 'Kantor Wilayah Ditjenpas Banten',
    provinsi: 'Banten',
    link: 'https://bantenpos.example/sabu-cilegon',
    tanggal_publikasi: '2026-09-01T08:00:00+07:00',
  },
  {
    id: 'b',
    judul: 'Kerusuhan Pecah di Lapas Kelas IIA Cilegon, Puluhan Warga Binaan Dievakuasi',
    ringkasan: 'Situasi terkendali setelah dua jam.',
    nama_upt: 'Lapas Kelas IIA Cilegon',
    media: 'Detik',
    platform: 'Portal Berita',
    kategori: 'Keamanan dan Ketertiban',
    subkategori: 'Kerusuhan dan Gangguan Kamtib',
    sentimen: 'Negatif',
    urgensi: 'Kritis',
    status_verifikasi: 'Belum Ditelaah',
    kanwil_asal: 'Kantor Wilayah Ditjenpas Banten',
    provinsi: 'Banten',
    link: 'https://detik.example/kerusuhan',
    tanggal_publikasi: '2026-09-03T10:30:00+07:00',
  },
  {
    id: 'c',
    judul: 'Warga Binaan Lapas Kelas IIB Ciangir Panen Perdana Program Ketahanan Pangan',
    ringkasan: 'Hasil panen diserahkan kepada dapur unit.',
    nama_upt: 'Lapas Kelas IIB Ciangir',
    media: 'InfoPAS',
    platform: 'Portal Berita',
    kategori: 'Narasi Positif Pemasyarakatan',
    subkategori: 'Ketahanan Pangan dan Pemberdayaan Ekonomi',
    sentimen: 'Positif',
    urgensi: 'Rendah',
    status_verifikasi: 'Terverifikasi',
    kanwil_asal: 'Kantor Wilayah Ditjenpas Jawa Barat',
    provinsi: 'Jawa Barat',
    link: 'https://infopas.example/panen',
    tanggal_publikasi: '2026-08-20T09:00:00+07:00',
  },
  {
    id: 'd',
    judul: 'Oknum Sipir Rutan Kelas I Medan Ditangkap BNN Kedapatan Bawa Sabu',
    ringkasan: 'Barang bukti sabu seberat 1,2 kilogram disita.',
    nama_upt: 'Rutan Kelas I Medan',
    media: 'Waspada Online',
    platform: 'Portal Berita',
    kategori: 'Integritas dan Penyalahgunaan Wewenang',
    subkategori: 'Keterlibatan Petugas dalam Narkotika',
    sentimen: 'Negatif',
    urgensi: 'Kritis',
    status_verifikasi: 'Tidak Valid',
    kanwil_asal: 'Kantor Wilayah Ditjenpas Sumatera Utara',
    provinsi: 'Sumatera Utara',
    link: 'https://waspada.example/arsip/8891-berita',
    tanggal_publikasi: '2026-09-02T14:00:00+07:00',
  },
]

/* ------------------------------------------------------- 1. bentuk pohon */

console.log('\n1. Bentuk pohon dan urutan pengikatan')

sama('kueri kosong tidak menghasilkan pohon', uraiKueri('').pohon, null)
sama('spasi saja tidak menghasilkan pohon', uraiKueri('   ').pohon, null)

{
  // ATAU mengikat paling longgar, jadi `a ATAU b c` harus terbaca
  // `a ATAU (b DAN c)`.
  const { pohon } = uraiKueri('a ATAU b c')
  sama('ATAU berada di puncak', pohon.jenis, 'atau')
  sama('sisi kanan ATAU adalah DAN', pohon.kanan.jenis, 'dan')
  sama('sisi kiri ATAU adalah kata tunggal', pohon.kiri.jenis, 'kata')
}

{
  const { pohon } = uraiKueri('a b ATAU c')
  sama('DAN di kiri ATAU', pohon.jenis, 'atau')
  sama('kiri berisi DAN', pohon.kiri.jenis, 'dan')
}

{
  const { pohon } = uraiKueri('(a ATAU b) c')
  sama('kurung membalik pengikatan', pohon.jenis, 'dan')
  sama('kurung menyimpan ATAU di dalamnya', pohon.kiri.jenis, 'atau')
}

sama('dua istilah berdampingan berarti DAN', uraiKueri('sabu cilegon').pohon.jenis, 'dan')
sama('AND berlaku sama dengan DAN', uraiKueri('sabu AND cilegon').pohon.jenis, 'dan')
sama('& berlaku sama dengan DAN', uraiKueri('sabu & cilegon').pohon.jenis, 'dan')
sama('OR berlaku sama dengan ATAU', uraiKueri('sabu OR cilegon').pohon.jenis, 'atau')
sama('| berlaku sama dengan ATAU', uraiKueri('sabu | cilegon').pohon.jenis, 'atau')
sama('TIDAK menghasilkan simpul tidak', uraiKueri('TIDAK sabu').pohon.jenis, 'tidak')
sama('tanda minus menghasilkan simpul tidak', uraiKueri('-sabu').pohon.jenis, 'tidak')
sama('NOT menghasilkan simpul tidak', uraiKueri('NOT sabu').pohon.jenis, 'tidak')

sama('bidang terbaca dari awalan', uraiKueri('upt:cilegon').pohon.bidang, 'upt')
sama('nama bidang tak dikenal tetap menjadi kata biasa',
  uraiKueri('warna:merah').pohon.bidang, null)
sama('nama bidang tak dikenal tidak dipenggal',
  uraiKueri('warna:merah').pohon.nilai, 'warna:merah')

{
  // Nama bidang yang diikuti frasa berkutip harus menyatu menjadi satu simpul.
  const { pohon } = uraiKueri('upt:"Lapas Kelas IIA Cilegon"')
  sama('bidang menyatu dengan frasa yang menyusul', pohon.jenis, 'frasa')
  sama('bidangnya ikut terbawa', pohon.bidang, 'upt')
  sama('nilai frasanya utuh', pohon.nilai, 'Lapas Kelas IIA Cilegon')
}

{
  const { pohon } = uraiKueri('"sipir sabu"~4')
  sama('jarak kedekatan terbaca', pohon.jarak, 4)
}

/* --------------------------------------------------------- 2. pencocokan */

console.log('2. Pencocokan')

sama('kueri kosong meloloskan seluruh baris', id(ARSIP, ''), 'a,b,c,d')
sama('kata tunggal', id(ARSIP, 'kerusuhan'), 'b')
sama('kata tunggal lintas kolom ringkasan', id(ARSIP, 'kilogram'), 'd')

// Bentuk berimbuhan. Ini yang membedakan pencarian ini dari pencocokan teks
// biasa: bentuk yang diketik hampir tidak pernah bentuk yang dicetak media.
sama('akar menemukan bentuk berimbuhan', id(ARSIP, 'selundup'), 'a')
sama('bentuk berimbuhan menemukan akar', id(ARSIP, 'penyelundupan'), 'a')
sama('gagal menemukan digagalkan', id(ARSIP, 'gagal'), 'a')

sama('dua kata berarti keduanya harus ada', id(ARSIP, 'sabu cilegon'), 'a')
sama('ATAU meloloskan salah satu', id(ARSIP, 'kerusuhan ATAU panen'), 'b,c')
sama('TIDAK menyingkirkan', id(ARSIP, 'lapas -kerusuhan'), 'a,c')
sama('TIDAK atas bidang', id(ARSIP, 'sabu -status:"Tidak Valid"'), 'a')

sama('frasa berurutan cocok', id(ARSIP, '"warga binaan"'), 'b,c')
sama('frasa yang urutannya terbalik tidak cocok', id(ARSIP, '"binaan warga"'), '')
sama('kedekatan mengabaikan urutan', id(ARSIP, '"binaan warga"~3'), 'b,c')
sama('kedekatan berbatas', id(ARSIP, '"sipir kilogram"~2'), '')

sama('jokar di ujung', id(ARSIP, 'penyelundup*'), 'a')
sama('jokar di tengah', id(ARSIP, 'ker*han'), 'b')

sama('bidang label mencocokkan potongan', id(ARSIP, 'upt:cilegon'), 'a,b')
sama('bidang label dengan frasa', id(ARSIP, 'upt:"Rutan Kelas I Medan"'), 'd')
sama('bidang media', id(ARSIP, 'media:detik'), 'b')
sama('bidang sentimen', id(ARSIP, 'sentimen:Positif'), 'c')
sama('bidang urgensi', id(ARSIP, 'urgensi:Kritis'), 'b,d')
sama('bidang status berfrasa', id(ARSIP, 'status:"Belum Ditelaah"'), 'b')
sama('bidang provinsi', id(ARSIP, 'provinsi:Banten'), 'a,b')
sama('bidang wilayah', id(ARSIP, 'wilayah:"Jawa Barat"'), 'c')
sama('bidang judul tidak membaca ringkasan', id(ARSIP, 'judul:kilogram'), '')
sama('bidang isi membaca ringkasan', id(ARSIP, 'isi:kilogram'), 'd')

// Istilah tanpa bidang sengaja tidak membaca kolom tautan. Alamat memuat
// potongan kata yang tidak pernah dimaksudkan sebagai kata.
sama('istilah umum tidak membaca tautan', id(ARSIP, '8891'), '')
sama('bidang tautan membacanya', id(ARSIP, 'tautan:8891'), 'd')

sama('rentang sejak', id(ARSIP, 'sejak:2026-09-01'), 'a,b,d')
sama('rentang sampai', id(ARSIP, 'sampai:2026-08-31'), 'c')
sama('rentang dua sisi', id(ARSIP, 'sejak:2026-09-01 sampai:2026-09-02'), 'a,d')
sama('tanggal bentuk Indonesia', id(ARSIP, 'sejak:1/9/2026'), 'a,b,d')

sama('kueri berlapis', id(ARSIP, '(sabu ATAU kerusuhan) upt:cilegon'), 'a,b')
sama('kueri berlapis dengan pengecualian',
  id(ARSIP, '(sabu ATAU kerusuhan) -status:"Belum Ditelaah"'), 'a,d')

// Pencocokan tidak boleh peka huruf besar-kecil, sebab yang mengetik sedang
// menyalin tulisan di layar, bukan sedang mengeja ulang.
sama('huruf besar pada kata', id(ARSIP, 'KERUSUHAN'), 'b')
sama('huruf besar pada bidang', id(ARSIP, 'UPT:Cilegon'), 'a,b')
sama('huruf besar pada nilai bidang', id(ARSIP, 'sentimen:POSITIF'), 'c')

/* ------------------------------------------- 3. kueri yang belum selesai */

console.log('3. Kueri yang belum selesai diketik')

for (const separuh of ['(', '(sabu', '"', '"sabu', 'upt:', 'sabu ATAU', '-', 'sabu DAN', ')']) {
  let meledak = false
  try { saringKueri(ARSIP, separuh) } catch { meledak = true }
  periksa(`"${separuh}" tidak melempar`, !meledak)
}

sama('kurung yang belum ditutup tetap menyaring', id(ARSIP, '(sabu'), 'a,d')
sama('kutip yang belum ditutup tetap menyaring', id(ARSIP, '"warga binaan'), 'b,c')
sama('bidang tanpa nilai meloloskan seluruhnya', id(ARSIP, 'upt:'), 'a,b,c,d')
sama('bidang tanpa nilai diikuti kata tetap menyaring', id(ARSIP, 'upt: kerusuhan'), 'b')

periksa('kurung yang belum ditutup meninggalkan catatan',
  uraiKueri('(sabu').catatan.length > 0)
periksa('kutip yang belum ditutup meninggalkan catatan',
  uraiKueri('"sabu').catatan.length > 0)
periksa('tanggal yang tidak terbaca meninggalkan catatan',
  uraiKueri('sejak:kemarin').catatan.length > 0)
sama('tanggal yang tidak terbaca tidak mengosongkan hasil',
  id(ARSIP, 'sejak:kemarin'), 'a,b,c,d')
sama('kueri utuh tidak meninggalkan catatan', uraiKueri('(sabu ATAU kerusuhan)').catatan.length, 0)

/* -------------------------------------------------------- 4. keterangan */

console.log('4. Keterangan dan sorotan')

sama('keterangan kueri kosong', jelaskan(uraiKueri('').pohon), 'seluruh baris')
sama('keterangan kata', jelaskan(uraiKueri('sabu').pohon), 'memuat "sabu"')
sama('keterangan bidang', jelaskan(uraiKueri('upt:cilegon').pohon), 'UPT memuat "cilegon"')
sama('keterangan pengecualian', jelaskan(uraiKueri('-sabu').pohon), 'bukan memuat "sabu"')
sama('keterangan ATAU berkurung',
  jelaskan(uraiKueri('sabu ATAU kerusuhan').pohon),
  '(memuat "sabu" atau memuat "kerusuhan")')
sama('keterangan DAN',
  jelaskan(uraiKueri('sabu kerusuhan').pohon),
  'memuat "sabu" dan memuat "kerusuhan"')
sama('keterangan frasa', jelaskan(uraiKueri('"warga binaan"').pohon), 'memuat frasa "warga binaan"')
sama('keterangan kedekatan',
  jelaskan(uraiKueri('"warga binaan"~5').pohon),
  'memuat "warga binaan" dalam jarak 5 kata')
sama('keterangan tanggal', jelaskan(uraiKueri('sejak:2026-09-01').pohon), 'terbit sejak 2026-09-01')

{
  const sorot = kataSorot(uraiKueri('sabu -kerusuhan').pohon).sort()
  sama('sorotan hanya istilah positif', sorot.join(','), 'sabu')
}
{
  const sorot = kataSorot(uraiKueri('sabu ATAU "warga binaan"').pohon).sort()
  sama('sorotan memecah frasa menjadi kata', sorot.join(','), 'binaan,sabu,warga')
}
{
  // Pengecualian berlapis dua kembali menjadi positif, dan sorotannya ikut.
  const sorot = kataSorot(uraiKueri('-(-sabu)').pohon).sort()
  sama('pengecualian ganda kembali disorot', sorot.join(','), 'sabu')
}

sama('sebagaiKueri tanpa spasi', sebagaiKueri('upt', 'Cilegon'), 'upt:Cilegon')
sama('sebagaiKueri berspasi diberi kutip',
  sebagaiKueri('status', 'Belum Ditelaah'), 'status:"Belum Ditelaah"')
sama('sebagaiKueri nilai kosong', sebagaiKueri('upt', ''), '')

// Kueri yang disusun sendiri harus bisa dibaca kembali oleh penyaringnya.
sama('kueri susunan sendiri terbaca kembali',
  id(ARSIP, sebagaiKueri('upt', 'Lapas Kelas IIA Cilegon')), 'a,b')

/* ------------------------------------------------------------- 5. bidang */

console.log('5. Daftar bidang')

periksa('setiap bidang menyebut jenisnya',
  Object.values(BIDANG).every((b) => ['teks', 'label', 'tanggal'].includes(b.jenis)))
periksa('setiap bidang punya label yang bisa dibaca',
  Object.values(BIDANG).every((b) => typeof b.label === 'string' && b.label.length > 1))
periksa('bidang teks dan label menyebut kolomnya',
  Object.values(BIDANG).filter((b) => b.jenis !== 'tanggal').every((b) => Boolean(b.kolom)))

// Satu baris tanpa satu pun kolom terisi tidak boleh membuat penyaring
// tersandung. Baris seperti itu ada di arsip nyata — kiriman manual yang
// hanya berisi judul.
{
  const kosong = [{ id: 'kosong' }]
  let meledak = false
  try { saringKueri(kosong, 'sabu') } catch { meledak = true }
  periksa('baris tanpa kolom tidak melempar', !meledak)
  sama('baris tanpa kolom tidak cocok dengan apa pun', id(kosong, 'sabu'), '')
  sama('baris tanpa kolom tetap lolos kueri kosong', id(kosong, ''), 'kosong')
}

// Pemanggilan kedua harus memakai bentuk siap-cari yang sudah disimpan, dan
// hasilnya harus tetap sama. Kalau penyimpanan bocor antarbaris, yang kedua
// akan berbeda.
sama('hasil tetap sama pada pemanggilan kedua', id(ARSIP, 'sabu cilegon'), 'a')

periksa('cocokkan dengan pohon kosong meloloskan', cocokkan(null, ARSIP[0]))

/* ----------------------------------------------------------------- akhir */

console.log(`\n  ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
