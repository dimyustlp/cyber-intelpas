/**
 * Penjaga saringan relevansi penjaring.
 *
 * ---------------------------------------------------------------------------
 * KENAPA BERKAS INI ADA
 * ---------------------------------------------------------------------------
 *
 * Uji kering mode umpan, 6 September 2026, jalan pertama. Dari 947 butir, tiga
 * belas dinyatakan relevan — dan ketiga belasnya salah:
 *
 *     One Piece 1192 Luffy Berhasil Tembus Benteng Imu di Elbaf
 *     Hasil Man City Vs Coventry: Gol Haaland Bawa The Citizens Kokoh
 *     Asus TUF Gaming 16 (FX610) Resmi di Indonesia
 *
 * Sebabnya satu kata: **per-TAHANAN**. Saringan waktu itu memakai
 * `teks.includes('tahanan')`, yang cocok di tengah kata "pertahanan", dan
 * "Garudayaksa Siapkan Pertahanan Rapat" masuk ke arsip intelijen
 * pemasyarakatan.
 *
 * Bahayanya bukan kotornya arsip semata. Umpan portal memuat SELURUH berita
 * sebuah portal — ratusan sehari — dan satu jangkar yang bocor mengalirkan
 * semuanya. Pada mode pencarian Google kebocoran itu masih tertutup kuerinya;
 * di mode umpan tidak ada yang menutupinya.
 *
 * Pelajaran yang sama sudah dibayar mesin klasifikasi pada `letakFrasa()`:
 * mencari kata tanpa sadar imbuhan mengembalikan jawaban yang salah secara
 * halus, dan yang di atasnya menyimpulkan hal yang berlawanan.
 *
 * ---------------------------------------------------------------------------
 * CARA MENJALANKAN
 * ---------------------------------------------------------------------------
 *
 *   node tools/uji-jangkar.mjs
 *
 * Berkas ini menyalin aturannya dari `supabase/functions/penjaring/index.ts`
 * dengan membacanya langsung — bukan menuliskannya ulang. Salinan yang ditulis
 * ulang akan berbeda diam-diam pada hari seseorang menyunting salah satunya,
 * dan penjaga yang menguji salinannya sendiri tidak menjaga apa pun.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')
const SUMBER = join(AKAR, 'supabase', 'functions', 'penjaring', 'index.ts')

const berkas = readFileSync(SUMBER, 'utf8')

function ambilRegex(nama) {
  const cocok = berkas.match(new RegExp(`const ${nama} = (/.+/)\\n`))
  if (!cocok) {
    console.error(`GAGAL: ${nama} tidak ditemukan di ${SUMBER}.`)
    console.error('Namanya berubah, atau bentuknya bukan lagi satu baris konstanta regex.')
    process.exit(1)
  }
  // eslint-disable-next-line no-eval
  return eval(cocok[1])
}

const JANGKAR_KATA = ambilRegex('JANGKAR_KATA')
const JANGKAR_FRASA = ambilRegex('JANGKAR_FRASA')

/** Salinan `berjangkar()`, disamakan dengan yang ada di fungsinya. */
function berjangkar(judul, keterangan = '') {
  const teks = `${judul} ${keterangan}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  return JANGKAR_KATA.test(teks) || JANGKAR_FRASA.test(teks)
}

/**
 * [harus lolos?, judul, keterangan]
 *
 * Kolom pertama `false` berarti berita itu HARUS ditolak. Sebagian besar
 * diambil apa adanya dari umpan sungguhan pada 6 September 2026 — bukan
 * karangan. Judul yang dikarang cenderung memakai kata yang sudah ada di
 * daftar; yang membocorkan saringan justru kata yang tidak terpikir.
 */
const KASUS = [
  // ---------------------------------------------------- harus DITOLAK
  [false, 'Garudayaksa Siapkan Pertahanan Rapat untuk Hadapi Java United', ''],
  [false, 'Prabowo Bahas Anggaran Pertahanan dengan DPR', ''],
  [false, 'One Piece 1192 Luffy Berhasil Tembus Benteng Imu di Elbaf', ''],
  [false, 'Hasil Man City Vs Coventry: Gol Haaland Bawa The Citizens Kokoh di Puncak', ''],
  [false, 'Asus TUF Gaming 16 (FX610) Resmi di Indonesia, Ini Harga dan Spesifikasinya', ''],
  [false, 'Harga Kelapa Sawit Naik di Riau Pekan Ini', ''],
  [false, 'Menteri Pertahanan Tinjau Latihan Gabungan di Natuna', ''],
  [false, 'PLN Siap Optimalkan Energi Surya lewat PLTS 100 GWp', ''],
  [false, 'Petahana Unggul Sementara dalam Hitung Cepat Pilkada', ''],

  // ---------------------------------------------------- harus DITERIMA
  [true, 'Lapas Palu perkuat pembinaan warga binaan di sektor pertanian', ''],
  [true, 'Napi Kabur dari Rutan Sukadana Ditangkap di Myanmar', ''],
  [true, 'Ditembak Oknum Petugas Lapas, Pencuri Durian di Lubuklinggau Meninggal', ''],
  [true, 'Seorang Tahanan Rutan I Medan Meninggal Dunia', ''],
  [true, 'Kemenimipas Luncurkan Program Baru', ''],
  [true, 'Ditjenpas Gelar Rapat Koordinasi Nasional', ''],
  [true, 'Kepala Bapas Kelas I Jakarta Barat Beraudiensi dengan Pemkot', ''],
  [true, 'LPKA Kutoarjo Terima Kunjungan Komisi III', ''],
  [true, 'Sipir Diduga Terlibat Peredaran Sabu', ''],
  [true, 'Kegiatan Donor Darah di Lembaga Pemasyarakatan Kelas IIA', ''],
  [true, 'Enam WBP Ikuti Program Asimilasi Kerja Sosial', ''],

  // ------------------------------- jangkar hanya ada di keterangan, bukan judul
  [true, 'Bupati Tinjau Fasilitas Baru di Kota Ende',
    'Kunjungan dilanjutkan ke Lapas Kelas IIB Ende untuk meninjau blok hunian.'],

  // ------------------- tanda baca tidak boleh memutus kata dari batasnya
  [true, 'Kaburnya napi, sekali lagi', ''],
  [true, '(Rutan) Kelas IIB Bangil kembali disorot', ''],
]

let gagal = 0

for (const [harusLolos, judul, keterangan] of KASUS) {
  const hasil = berjangkar(judul, keterangan)
  if (hasil !== harusLolos) {
    gagal++
    console.log(`GAGAL  diharapkan ${harusLolos ? 'DITERIMA' : 'DITOLAK'}, hasilnya ${hasil ? 'DITERIMA' : 'DITOLAK'}`)
    console.log(`       ${judul}`)
    if (keterangan) console.log(`       ${keterangan}`)
  }
}

console.log(`\n${KASUS.length - gagal}/${KASUS.length} pemeriksaan jangkar lulus.`)

if (gagal) {
  console.log('\nSaringan relevansi penjaring berubah artinya.')
  console.log('Jangkar yang bocor mengalirkan seluruh isi umpan portal ke arsip;')
  console.log('jangkar yang terlalu ketat membuang berita yang seharusnya masuk.')
  process.exit(1)
}
