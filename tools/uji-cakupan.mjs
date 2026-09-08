/**
 * Mengukur CAKUPAN mesin klasifikasi terhadap judul yang sungguhan.
 *
 * KENAPA ADA DI SAMPING uji-mesin.mjs, BUKAN DI DALAMNYA
 *
 * `uji-mesin.mjs` menjawab "apakah kaidahnya berperilaku benar" — kasus yang
 * jawabannya sudah diketahui, dan yang harus tetap benar selamanya. Berkas ini
 * menjawab pertanyaan yang berbeda dan lebih tumpul: **berapa banyak berita
 * yang lewat begitu saja tanpa dikenali sama sekali.**
 *
 * Keduanya perlu, dan yang kedua yang selama ini tidak ada. Sebuah mesin
 * klasifikasi bisa lulus seluruh uji perilakunya dan tetap membiarkan seperlima
 * arsip berakhir sebagai "Belum Dikelompokkan" — sebab uji perilaku hanya
 * menanyakan kasus yang sudah terpikirkan oleh penulisnya, dan yang tidak
 * terpikirkan justru yang menumpuk di lapangan.
 *
 * Judul di bawah bukan karangan. Seluruhnya diambil dari arsip produksi pada
 * 8 September 2026 — dari 220 baris yang tersangkut di "Belum Dikelompokkan" —
 * dan dikelompokkan tangan menurut pola yang berulang. Angka yang dilaporkan
 * alat ini karena itu bisa dibandingkan langsung dengan keadaan sungguhan.
 *
 * Jalankan:
 *   node tools/uji-cakupan.mjs          ringkasan
 *   node tools/uji-cakupan.mjs --rinci  beserta judul yang masih lolos
 */

import { klasifikasikan } from '../web/js/lib/klasifikasi.js'

const rinci = process.argv.includes('--rinci')

/**
 * Pola yang berulang di arsip, beserta kode yang SEHARUSNYA dikenali.
 *
 * `kode` di sini bukan jawaban tunggal yang wajib — beberapa judul memang bisa
 * masuk ke lebih dari satu subkategori yang sama-sama masuk akal. Yang diperiksa
 * alat ini terutama: apakah mesinnya mengenali SESUATU, dan apakah yang
 * dikenalinya masih berada di kelompok yang benar.
 */
const CONTOH = [
  // ---------------------------------------------------- arahan pimpinan pusat
  { kode: '8.4', judul: 'Lapas Narkotika Jakarta Ikuti Pengarahan Direktur Jenderal Pemasyarakatan Secara Virtual' },
  { kode: '8.4', judul: 'Lapas Narkotika Purwokerto Ikuti Pengarahan Dirjenpas' },
  { kode: '8.4', judul: 'Jajaran Lapas Batang Ikuti Pengarahan Virtual Dirjen Pemasyarakatan' },
  { kode: '8.4', judul: 'Tingkatkan Integritas, Lapas Saparua Ikuti Zoom Dirjenpas' },
  { kode: '8.4', judul: 'Bahas Mitigasi Bencana Hingga Senpi, Lapas Ternate Simak Arahan Ditjenpas' },
  { kode: '8.4', judul: 'Lapas Waikabubak Siap Tindaklanjuti Arahan Strategis Dirjenpas Pemasyarakatan' },
  { kode: '8.4', judul: 'Kanwil Ditjenpas DIY Ikuti Apel Virtual dan Penguatan Bersama Ditjenpas' },

  // ------------------------------------------------------------- kepegawaian
  { kode: '8.4', judul: 'Resmi Berstatus PNS, Delapan Pegawai Lapas Narkotika Karang Intan Diambil Sumpah Jabatan' },
  { kode: '8.4', judul: 'Sumpah Jabatan PNS, Enam Pegawai Lapas Amuntai Resmi Masuki Babak Baru' },
  { kode: '8.4', judul: 'Resmi Jadi ASN, Sepuluh Pegawai Lapas Batulicin Siap Emban Amanah Baru' },
  { kode: '8.4', judul: 'Lapas Martapura Gelar Rapat Dinas Kepegawaian' },
  { kode: '8.4', judul: 'Rutan Kudus Hadiri Supervisi RKA-K/L 2027' },
  { kode: '8.4', judul: 'Karutan Kudus Berikan Arahan Pembinaan kepada PNS Baru Tahun 2025' },

  // ------------------------------------------- arahan integritas ke jajaran
  { kode: '8.4', judul: 'Kalapas Semarang Ingatkan Pentingnya Integritas, Tegaskan SOP dan Disiplin' },
  { kode: '8.4', judul: 'Kalapas Indramayu Tekankan Pentingnya Integritas dalam Bertugas' },
  { kode: '8.4', judul: 'Kalapas Dabo Singkep Tegaskan Integritas dan Disiplin Jajaran' },
  { kode: '8.4', judul: 'Kalapas Tegaskan Seluruh Pegawai Jauhi Korupsi' },

  // ------------------------------------------------------------- kesehatan
  { kode: '8.7', judul: 'Jaga Kesehatan dan Kebugaran, Lapas Singkawang Bagikan Masker dan Multivitamin kepada Seluruh Petugas' },
  { kode: '8.7', judul: 'Lapas Kelas IIA Serang Melaksanakan Pengecekan Lingkungan Dan Pembagian Masker Kepada Seluruh Wbp' },
  { kode: '8.7', judul: 'Lapas Sekayu Bagikan Peralatan Mandi untuk Jaga Kebersihan Warga Binaan' },
  { kode: '8.7', judul: 'Lapas Kelas I Tangerang Tuntaskan Cek Kesehatan' },
  { kode: '8.7', judul: 'Gelar Penyuluhan Perilaku Hidup Bersih dan Sehat (PHBS) Rutan Kudus' },

  // ---------------------------------------------- pendidikan dan keagamaan
  { kode: '8.2', judul: 'Rutan Pandeglang Dukung Pembelajaran Mahasiswa melalui PPL' },
  { kode: '8.2', judul: 'Mahasiswa Kesejahteraan Sosial UMM Tuntaskan Praktikum di LPKA Blitar' },
  { kode: '8.2', judul: '13 Napi Lapas Narkotika Jakarta Dapat Kesempatan Kuliah S1 Ilmu Teologi' },
  { kode: '8.2', judul: 'Pendidikan Nonformal bagi Warga Binaan: Lapas Ambon Gandeng SKB Kota Ambon' },
  { kode: '8.2', judul: 'Mahasiswa Kampus Mengajar Bantu Pembelajaran di SMP Istimewa Lapas Anak Tangerang' },
  { kode: '8.2', judul: 'FSDS MUI dan Lapas Narkotika Bandar Lampung Resmikan Sekolah Dai, Imam, dan Khatib bagi Warga Binaan' },
  { kode: '8.2', judul: 'Penyuluh KUA Medan Sunggal Sampaikan Pesan Bimroh tentang Cara Meredam Murka Allah di Lapas Tanjung Gusta' },
  { kode: '8.2', judul: 'Jeruji Tak Halangi Warga Binaan Lapas Dobo untuk Belajar' },
  { kode: '8.2', judul: 'Penuhi Hak Pendidikan Warga Binaan, Rutan Banjarnegara Laksanakan Program Kejar Paket' },

  // --------------------------------------------- kemandirian dan ekonomi
  { kode: '8.6', judul: '60 Warga Binaan Lapas Mojokerto Belajar Membuat Minuman Kafe dan Keripik, Jadi Bekal Usaha Setelah Bebas' },
  { kode: '8.6', judul: 'Lapas Luwuk Salurkan Rp3,7 Juta Premi Hasil Kerja Warga Binaan' },
  { kode: '8.6', judul: 'Produktif dalam Pembinaan, Warga Binaan Lapas Saumlaki Hasilkan Kerajinan' },
  { kode: '8.6', judul: 'Dari Balik Lapas Wonogiri, WBP Belajar Bikin Bros hingga Disiapkan Punya Penghasilan Setelah Bebas' },
  { kode: '8.6', judul: 'Produktif di Balik Lapas, Tata Boga Lapas Pemuda Madiun Hasilkan Terang Bulan dan Pukis' },
  { kode: '8.6', judul: 'Hasil Pembinaan Lapas Cibinong Dilirik Restoran Bumi Aki, Buka Peluang Pasar Lebih Luas' },

  // -------------------------------------------------- kunjungan keluarga
  { kode: '8.3', judul: 'Kunjungan Khusus Anak di Rutan Cipinang Pada Akhir Pekan Diminati Masyarakat' },
  { kode: '8.3', judul: 'Penuh Haru di Rutan Jakarta Pusat, Anak-anak Temui Orang Tua di Balik Jeruji' },
  { kode: '8.3', judul: 'Rutan Cipinang Hadirkan Ruang Hangat bagi Warga Binaan dan Buah Hati' },

  // ------------------------------------------------------- hak integrasi
  { kode: '8.1', judul: 'Peroleh Hak Integrasi, 18 Warga Binaan Lapas Cibinong Siap Kembali Berkontribusi di Tengah Masyarakat' },

  // ------------------------------------------------------------ olahraga
  { kode: '8.4', judul: 'Kalapas Cup Vol. II Resmi Dibuka, Petugas dan Warga Binaan Bertanding' },
  { kode: '8.4', judul: 'Tingkatkan Kebugaran, Rutan Kudus Gelar Senam bagi Tahanan Mapenaling' },
  { kode: '8.4', judul: 'Sabtu Sehat, Warga Binaan dan Petugas Lapas Kotabaru Lakukan Olahraga Volly Happy' },

  /*
     Kematian warga binaan. PALING PENTING DI BERKAS INI.

     Ketiga judul di bawah tersangkut di "Belum Dikelompokkan" dengan urgensi
     "Sedang" — padahal kematian orang di dalam tahanan adalah peristiwa yang
     menuntut perhatian tercepat yang bisa diberikan sistem ini. Subkategori
     4.1 sudah ada sejak awal; yang tidak ada adalah kaidah yang menyalakannya
     untuk kalimat yang tidak memakai kata "tewas" atau "meninggal dunia".
  */
  { kode: '4.1', judul: 'Sempat Mengeluh Sakit Kepala Hebat, Napi Kasus Pembunuhan di Lapas Karangasem Meninggal' },
  { kode: '4.1', judul: 'Diduga Sakit Abses Otak, Narapidana Lapas Karangasem Meninggal' },
  { kode: '4.1', judul: 'Napi Kasus Pembunuhan di Lapas Karangasem Meninggal' },
]

/**
 * Judul yang HARUS ditolak — bukan urusan Pemasyarakatan.
 *
 * Rutan Polres dan ruang tahanan Polsek bukan UPT Pemasyarakatan. Sampai
 * 8 September 2026 ketiganya masuk arsip, dan dua di antaranya bahkan
 * dipetakan ke UPT sungguhan yang kebetulan sekota — sehingga pemeriksaan
 * tahanan oleh Propam Polri tercatat sebagai kegiatan Rutan Pemasyarakatan.
 */
const HARUS_DITOLAK = [
  'Jaga Keamanan Tahanan, Pamapta I SPKT Periksa Rutan Mapolresta Palangka Raya',
  'Demi Keamanan Rutan, Pamapta II SPKT Lakukan Pengecekan Tahanan',
  'Sipropam Pastikan Keamanan Tahanan dan Ruang Rutan',
]

/* ------------------------------------------------------------------ jalan */

let dikenali = 0
const lolos = []
const salahKelompok = []

for (const contoh of CONTOH) {
  const hasil = klasifikasikan({ judul: contoh.judul, ringkasan: contoh.judul })
  const kode = hasil.subkategori_kode || ''
  if (!kode || kode === '0.1') { lolos.push(contoh); continue }
  dikenali += 1
  // Kelompok besar sudah benar bila angka di depan titiknya sama.
  if (kode.split('.')[0] !== contoh.kode.split('.')[0]) {
    salahKelompok.push({ ...contoh, didapat: kode, nama: hasil.subkategori })
  }
}

let ditolak = 0
const lolosLingkup = []
for (const judul of HARUS_DITOLAK) {
  const hasil = klasifikasikan({ judul, ringkasan: judul })
  if (hasil.kategori === 'Di Luar Lingkup') ditolak += 1
  else lolosLingkup.push({ judul, kategori: hasil.kategori, kode: hasil.subkategori_kode })
}

const persen = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '0.0')

console.log('\n' + '─'.repeat(72))
console.log('CAKUPAN MESIN KLASIFIKASI — judul sungguhan dari arsip produksi')
console.log('─'.repeat(72))
console.log(`  Dikenali          : ${dikenali}/${CONTOH.length}  (${persen(dikenali, CONTOH.length)}%)`)
console.log(`  Masih lolos       : ${lolos.length}`)
console.log(`  Salah kelompok    : ${salahKelompok.length}`)
console.log(`  Di luar lingkup   : ${ditolak}/${HARUS_DITOLAK.length} ditolak benar`)

if (rinci && lolos.length) {
  console.log('\n  MASIH LOLOS:')
  for (const c of lolos) console.log(`    [${c.kode}] ${c.judul.slice(0, 88)}`)
}
if (rinci && salahKelompok.length) {
  console.log('\n  SALAH KELOMPOK:')
  for (const c of salahKelompok) {
    console.log(`    diharapkan ${c.kode} · didapat ${c.didapat} (${c.nama})`)
    console.log(`      ${c.judul.slice(0, 84)}`)
  }
}
if (rinci && lolosLingkup.length) {
  console.log('\n  SEHARUSNYA DI LUAR LINGKUP:')
  for (const c of lolosLingkup) console.log(`    ${c.kategori} / ${c.kode} — ${c.judul.slice(0, 76)}`)
}

console.log('')

/*
   Ambang, bukan kesempurnaan.

   Angkanya sengaja tidak 100%: sebagian judul memang tidak menyebutkan apa pun
   yang bisa dikenali mesin aturan, dan memaksanya lulus akan menuntut kaidah
   yang menebak. Yang dijaga di sini adalah agar cakupannya tidak MUNDUR ketika
   ada yang menyetel kaidah lain.
*/
const AMBANG = 0.85
const nisbah = dikenali / CONTOH.length
if (nisbah < AMBANG || ditolak < HARUS_DITOLAK.length) {
  console.log(`GAGAL — cakupan ${persen(dikenali, CONTOH.length)}% di bawah ambang ${AMBANG * 100}%`
    + `, atau ada judul di luar lingkup yang lolos. Jalankan dengan --rinci.`)
  process.exit(1)
}
console.log('LULUS — cakupan di atas ambang, dan seluruh judul di luar lingkup ditolak.\n')
