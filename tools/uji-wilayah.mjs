/**
 * Uji penentu wilayah berita (web/js/lib/wilayah-berita.js) dan perbaikan
 * penanda lembaga lain di mesin pencocok.
 *
 * Data induknya potongan kecil yang ditulis di sini, bukan data/master-upt.csv:
 * yang diuji adalah aturan membacanya, dan uji ini tidak boleh ikut berubah
 * setiap kali data induk diperbarui.
 *
 *   node tools/uji-wilayah.mjs
 */

import { bangunPetaWilayah, wilayahBerita } from '../web/js/lib/wilayah-berita.js'
import { bangunIndeks, cocokkanUpt } from '../web/js/lib/pencocokan-upt.js'

const K = (n) => `Kantor Wilayah Ditjenpas ${n}`
const u = (nama_upt, jenis_upt, provinsi, kanwil, kabupaten_kota, subjenis_upt = 'Umum') =>
  ({ nama_upt, jenis_upt, kelas_upt: 'IIA', subjenis_upt, provinsi, kanwil: K(kanwil), kabupaten_kota, location_hint: kabupaten_kota.toUpperCase() })

const UPT = [
  u('Lapas Kelas IIA Kediri', 'Lapas', 'Jawa Timur', 'Jawa Timur', 'Kediri'),
  u('Lapas Kelas IIB Tulungagung', 'Lapas', 'Jawa Timur', 'Jawa Timur', 'Tulungagung'),
  u('Lapas Kelas IIA Kerobokan', 'Lapas', 'Bali', 'Bali', 'Badung'),
  u('Lapas Kelas IIB Singaraja', 'Lapas', 'Bali', 'Bali', 'Buleleng'),
  u('Lapas Narkotika Kelas IIA Jayapura', 'Lapas', 'Papua', 'Papua', 'Jayapura', 'Narkotika'),
  u('Lapas Perempuan Kelas III Jayapura', 'Lapas', 'Papua', 'Papua', 'Jayapura', 'Perempuan'),
  u('Lapas Kelas I Medan', 'Lapas', 'Sumatera Utara', 'Sumatera Utara', 'Kota Medan'),
  u('Lapas Kelas IIA Ternate', 'Lapas', 'Maluku Utara', 'Maluku Utara', 'Kota Ternate'),
  u('Lapas Kelas IIA Metro', 'Lapas', 'Lampung', 'Lampung', 'Kota Metro'),
  u('Lapas Kelas IIA Martapura', 'Lapas', 'Kalimantan Selatan', 'Kalimantan Selatan', 'Banjar'),
  u('Rutan Kelas IIB Martapura', 'Rutan', 'Sumatera Selatan', 'Sumatera Selatan', 'OKU Timur'),
  u('Lapas Kelas IIA Tarakan', 'Lapas', 'Kalimantan Utara', 'Kalimantan Timur', 'Kota Tarakan'),
  u('Rutan Kelas IIB Muntok', 'Rutan', 'Kepulauan Bangka Belitung', 'Kepulauan Bangka Belitung', 'Bangka Barat'),
  u('Lapas Kelas IIA Palu', 'Lapas', 'Sulawesi Tengah', 'Sulawesi Tengah', 'Kota Palu'),
]

const peta = bangunPetaWilayah(UPT)
const indeks = bangunIndeks(UPT)
let lulus = 0
let gagal = 0

function periksa(nama, benar, rinci = '') {
  if (benar) { lulus += 1; console.log(`  ✓ ${nama}`) } else { gagal += 1; console.log(`  ✗ ${nama}${rinci ? `\n      ${rinci}` : ''}`) }
}

function wilayah(judul, lain = {}) {
  return wilayahBerita({ judul, ringkasan: '', nama_upt: 'Belum Teridentifikasi', ...lain }, peta)
}

function kanwilnya(judul, kanwil, dasar) {
  const w = wilayah(judul)
  periksa(`${judul.slice(0, 64)} → ${kanwil || dasar}`,
    w.kanwil === (kanwil ? K(kanwil) : null) && (!dasar || w.dasar === dasar),
    `didapat ${w.kanwil} (${w.dasar})`)
}

console.log('\nMesin pencocok: sebutan lembaga lain sesudah nama tempat')
for (const [teks, unit] of [
  ['Dugaan Bisnis Sabu dari Balik Lapas Kediri Dibongkar Polres Tulungagung', 'Lapas Kelas IIA Kediri'],
  ['Sabu-Ekstasi Lolos Masuk Lapas Kerobokan, Polda Bali Buru Pemasok', 'Lapas Kelas IIA Kerobokan'],
  ['Razia Gabungan Rutan Mentok Temukan Sejumlah Barang Terlarang', 'Rutan Kelas IIB Muntok'],
]) {
  const r = cocokkanUpt(teks, indeks)
  periksa(`${teks.slice(0, 60)} → ${unit}`, r.otomatis && r.nama === unit, `didapat ${r.nama} — ${r.alasan}`)
}
for (const teks of ['Tersangka Ditahan di Rutan Polda Bali', 'KPK Tahan Bupati di Rutan Gedung Merah Putih KPK', 'Rutan Polres Tulungagung Penuh']) {
  const r = cocokkanUpt(teks, indeks)
  periksa(`${teks} → tetap ditolak`, !r.otomatis && !r.saran.length, `didapat ${r.nama} — ${r.alasan}`)
}

console.log('\nUrutan bukti')
{
  const w = wilayahBerita({ judul: 'Napi kabur dari Lapas Kediri', kanwil_asal: K('Bali'), nama_upt: '' }, peta)
  periksa('kanwil asal lembar menang atas teks', w.kanwil === K('Bali') && w.pasti && w.dasar === 'lembar')
  const v = wilayahBerita({ judul: 'Napi kabur', nama_upt: 'Lapas Kelas I Medan' }, peta)
  periksa('UPT di data induk → pasti', v.kanwil === K('Sumatera Utara') && v.pasti && v.dasar === 'upt')
}
kanwilnya('Polres Tulungagung Ungkap Sabu Dikendalikan dari Lapas Kediri', 'Jawa Timur', 'upt-terduga')
kanwilnya('7 Napi Kabur dari Lapas Jayapura Diburu', 'Papua', 'kandidat-upt')
kanwilnya('Kanwil Ditjenpas Malut Ikuti Rakor Pengadaan BAMA', 'Maluku Utara', 'sebut-kanwil')
kanwilnya('Narkoba Diduga Beredar dari Dalam Lapas, Polres Buleleng Ungkap Kronologinya', 'Bali', 'nama-tempat')
kanwilnya('Satresnarkoba Polrestabes Medan Ringkus Pegawai Lapas', 'Sumatera Utara', 'nama-tempat')
kanwilnya('Meninggal karena Kanker, Napi Korupsi Tarakan Sempat Kemoterapi', 'Kalimantan Timur', 'nama-tempat')
kanwilnya('Napi Tewas di Lapas, Polres OKU Selidiki Penyebabnya', 'Sumatera Selatan', 'nama-tempat')

console.log('\nYang tidak boleh ditebak')
kanwilnya('Menteri Imipas Beri Sanksi Pegawai Terlibat Jual Beli Remisi', null, 'tanpa-lokasi')
kanwilnya('Eks Napi Kembali Ditangkap di Martapura', null, 'tanpa-lokasi')
kanwilnya('Hakim Mengetuk Palu, Terdakwa Dikirim ke Lapas', null, 'tanpa-lokasi')
kanwilnya('Polres Metro Depok Tangkap Oknum Pegawai Rutan', null, 'tanpa-lokasi')
kanwilnya('Pidato Hari Bhakti: Lapas dari Sabang sampai Merauke Wajib Bersih Narkoba', null, 'tanpa-lokasi')
kanwilnya('Pungli di Lapas Terungkap, Ombudsman Soroti Bayaran Rp250 Juta - Radar Kediri', null, 'tanpa-lokasi')
{
  const w = wilayah('Overkapasitas', { ringkasan: 'JAKARTA, KOMPAS.com - Menteri menyebut overkapasitas lapas nasional.' })
  periksa('kepala berita "JAKARTA, KOMPAS.com -" bukan letak peristiwa', w.kanwil === null && w.dasar === 'tanpa-lokasi', `didapat ${w.kanwil} (${w.dasar})`)
  const x = wilayah('Kota Palu Gelar Razia Lapas')
  periksa('"Kota Palu" tetap dikenali walau "palu" terlarang', x.kanwil === K('Sulawesi Tengah'), `didapat ${x.kanwil} (${x.dasar})`)
  const y = wilayah('Overkapasitas Penjara di Medan dan Ternate Kian Parah')
  periksa('beberapa kanwil berbeda → lintas', y.kanwil === null && y.dasar === 'lintas' && y.kandidat.length === 2, `didapat ${y.kanwil} (${y.dasar})`)
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
