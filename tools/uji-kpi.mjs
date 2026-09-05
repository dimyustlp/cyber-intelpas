/**
 * Uji KPI.
 *
 * Tiga hal yang dijaga, dan ketiganya adalah cara sebuah papan KPI berbohong
 * tanpa satu pun angka yang salah hitung:
 *
 *   1. **Median, bukan rata-rata.** Satu berita lama yang baru masuk hari ini
 *      menghasilkan selisih empat puluh hari. Pada rata-rata, satu baris itu
 *      menggeser seluruh papan; pada median, ia satu baris.
 *   2. **Belum terukur bukan nol.** Ukuran tanpa satu pun data harus berkata
 *      "belum terukur". Nol berarti diukur dan hasilnya nol — dan nol pada
 *      ukuran waktu berarti sempurna.
 *   3. **Selisih waktu yang mustahil dibuang, bukan dijepit ke nol.** Tanggal
 *      terbit yang lebih baru daripada waktu masuk berarti salah satunya
 *      keliru; menjepitnya ke nol melaporkan sistem menangkap berita pada
 *      detik ia terbit, dan angka yang terlalu bagus tidak pernah
 *      dipertanyakan.
 *
 * Dijalankan tanpa peramban: node tools/uji-kpi.mjs
 */

import {
  sebaran, hitungKpi, rekapKpi, nilaiTampil, SASARAN,
} from '../web/js/lib/kpi.js'

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

const SEKARANG = new Date('2026-09-05T09:00:00+07:00')
const jamLalu = (n) => new Date(SEKARANG.getTime() - n * 3_600_000).toISOString()

function ambil(daftar, kode) { return daftar.find((k) => k.kode === kode) }

/* --------------------------------------------------------------- 1. sebaran */

console.log('\n1. Sebaran')

sama('sebaran kosong tidak mengarang angka', sebaran([]).median, null)
sama('sebaran kosong menyebut nol pengamatan', sebaran([]).n, 0)
sama('median ganjil', sebaran([1, 5, 9]).median, 5)
sama('median genap dirata-ratakan dua tengahnya', sebaran([1, 3, 5, 9]).median, 4)

{
  // Janji nomor satu, diuji langsung: satu pencilan besar tidak menggeser median.
  const biasa = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]
  const denganPencilan = [...biasa, 960]
  const rataBiasa = biasa.reduce((a, b) => a + b, 0) / biasa.length
  const rataPencilan = denganPencilan.reduce((a, b) => a + b, 0) / denganPencilan.length
  periksa('rata-rata bergeser jauh oleh satu pencilan', rataPencilan > rataBiasa * 8)
  periksa('median hampir tidak bergeser',
    Math.abs(sebaran(denganPencilan).median - sebaran(biasa).median) <= 1)
  periksa('ekor tetap menyebut pencilan itu', sebaran(denganPencilan).maks === 960)
}

sama('nilai negatif dibuang dari sebaran', sebaran([-5, 1, 3]).n, 2)
sama('nilai bukan angka dibuang', sebaran([Number.NaN, 2, 4]).n, 2)
periksa('persentil 90 adalah salah satu nilai yang benar-benar ada',
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(sebaran([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).p90))

/* --------------------------------------------------------------- data uji */

function berita(x) {
  return {
    id: x.id,
    judul: x.judul || 'Judul uji',
    nama_upt: x.upt === null ? 'Belum Teridentifikasi' : (x.upt || 'Lapas Kelas IIA Cilegon'),
    media: 'Banten Pos',
    platform: 'Portal Berita',
    kategori: x.kategori || 'Keamanan dan Ketertiban',
    subkategori: 'Kerusuhan dan Gangguan Kamtib',
    sentimen: x.sentimen || 'Negatif',
    urgensi: x.urgensi || 'Sedang',
    status_verifikasi: x.status || 'Belum Ditelaah',
    tanggal_publikasi: jamLalu(x.terbit),
    created_at: jamLalu(x.masuk),
    verified_at: x.telaah === undefined ? null : jamLalu(x.telaah),
    telaah_wilayah_pada: x.daerah === undefined ? null : jamLalu(x.daerah),
    tanggapan_pada: x.sikap === undefined ? null : jamLalu(x.sikap),
  }
}

const ARSIP = [
  // Terbit 10 jam lalu, masuk 8 jam lalu → deteksi 2 jam. Ditelaah 4 jam lalu → 4 jam.
  berita({ id: 'a', terbit: 10, masuk: 8, telaah: 4, status: 'Terverifikasi' }),
  berita({ id: 'b', terbit: 14, masuk: 10, telaah: 6, status: 'Terverifikasi' }),
  berita({ id: 'c', terbit: 30, masuk: 24, telaah: 2, status: 'Tidak Valid' }),
  // Masih menunggu telaah, sudah 96 jam sejak masuk.
  berita({ id: 'd', terbit: 100, masuk: 96 }),
  berita({ id: 'e', terbit: 30, masuk: 28, upt: 'Rutan Kelas I Medan', daerah: 20, sikap: 12 }),
  // Unitnya belum terpetakan.
  berita({ id: 'f', terbit: 6, masuk: 5, upt: null }),
  // Di luar lingkup — tidak boleh ikut ke ukuran mana pun yang menyaring lingkup.
  berita({ id: 'g', terbit: 200, masuk: 4, kategori: 'Di Luar Lingkup' }),
]

const KPI = hitungKpi(ARSIP, { sekarang: SEKARANG, indukUnit: 531 })

/* --------------------------------------------------------------- 2. bentuk */

console.log('2. Bentuk keluaran')

periksa('setiap KPI punya label dan ringkasan',
  KPI.every((k) => k.label && k.ringkas))
periksa('setiap KPI menjelaskan dirinya panjang lebar',
  KPI.every((k) => k.ket && k.ket.length > 60))
periksa('setiap KPI menyebut arah baiknya',
  KPI.every((k) => ['kecil lebih baik', 'besar lebih baik'].includes(k.arah)))
periksa('setiap KPI menyebut berapa pengamatan yang mendasarinya',
  KPI.every((k) => typeof k.dasar === 'number'))
periksa('setiap KPI punya nada warna',
  KPI.every((k) => ['positif', 'sedang', 'kritis', 'rendah'].includes(k.nada)))
periksa('tidak ada kode kembar',
  new Set(KPI.map((k) => k.kode)).size === KPI.length)

/* ------------------------------------------------------------- 3. deteksi */

console.log('3. Ukuran waktu')

{
  const d = ambil(KPI, 'deteksi')
  // Selisih terbit→masuk: a=2, b=4, c=6, d=4, e=2, f=1. Yang di luar lingkup
  // (g, selisih 196) tidak ikut.
  sama('deteksi menghitung enam baris dalam lingkup', d.dasar, 6)
  sama('median deteksi', d.median === undefined ? d.nilai : d.nilai, 3)
  periksa('baris di luar lingkup tidak menaikkan ekornya', d.ekor <= 6, `dapat ${d.ekor}`)
}
{
  const t = ambil(KPI, 'telaah')
  // a=4, b=4, c=22.
  sama('telaah hanya menghitung yang sudah pernah ditelaah', t.dasar, 3)
  sama('median telaah', t.nilai, 4)
}
{
  const a = ambil(KPI, 'antrean')
  // Tiga baris masih menunggu: d (96 jam), e (28 jam), f (5 jam).
  sama('antrean berisi seluruh baris yang masih menunggu', a.dasar, 3)
  sama('ekornya adalah baris tertua', a.ekor, 96)
  sama('nilainya median, jauh di bawah ekornya', a.nilai, 28)

  /*
     Nada mengikuti baris TERTUA, bukan mediannya, dan di sinilah bedanya
     terlihat: mediannya 28 jam — jauh di bawah sasaran 72 — sehingga antrean
     ini akan tampil hijau bila nadanya mengikuti median, padahal ada satu
     baris yang sudah menunggu empat hari di dalamnya.
  */
  periksa('mediannya sendiri masih memenuhi sasaran', a.nilai <= SASARAN.antreanTertua)
  periksa('tetapi baris tertuanya sudah melewatinya', a.ekor > SASARAN.antreanTertua)
  sama('dan nadanya mengikuti yang tertua', a.nada, 'sedang')
}
{
  const d = ambil(KPI, 'telaah_daerah')
  sama('telaah daerah dihitung terpisah', d.dasar, 1)
  sama('nilainya selisih masuk ke putusan daerah', d.nilai, 8)
}
{
  const s = ambil(KPI, 'tanggapan')
  sama('sikap resmi dihitung terpisah', s.dasar, 1)
  sama('nilainya selisih masuk ke sikap', s.nilai, 16)
}
{
  const k = ambil(KPI, 'kesegaran')
  sama('kesegaran memakai baris paling baru', k.nilai, 4)
  sama('dan nadanya memenuhi sasaran', k.nada, 'positif')
}

/* --------------------------------------------------------- 4. ukuran bagian */

console.log('4. Ukuran bagian')

{
  const l = ambil(KPI, 'liputan_unit')
  sama('dua unit tersentuh', l.dasar, 2)
  sama('pembaginya jumlah unit nasional', l.pembagi, 531)
  periksa('nilainya bagian, bukan jumlah', l.nilai > 0 && l.nilai < 0.01)
}
{
  const b = ambil(KPI, 'belum_dipetakan')
  sama('satu baris belum terpetakan', b.dasar, 1)
  // Himpunan dasar berisi lima: c dikecualikan karena Tidak Valid, g karena
  // di luar lingkup. Deteksi memakai enam karena ia hanya menyaring lingkup —
  // dan perbedaan pembagi itu memang disengaja, bukan kelalaian.
  sama('pembaginya himpunan dasar, bukan seluruh baris dalam lingkup', b.pembagi, 5)
}
{
  const v = ambil(KPI, 'tidak_valid')
  // Yang sudah ditelaah: a, b (Terverifikasi) dan c (Tidak Valid).
  sama('pembaginya seluruh yang sudah ditelaah', v.pembagi, 3)
  sama('pembilangnya yang tidak valid', v.dasar, 1)
  periksa('keterangannya menyangkal dirinya sebagai ukuran ketepatan',
    v.ket.includes('BUKAN ukuran ketepatan'))
}

/* ------------------------------------------------ 5. belum terukur dan pencilan */

console.log('5. Belum terukur, dan selisih yang mustahil')

{
  // Janji nomor dua.
  const kosong = hitungKpi([], { sekarang: SEKARANG })
  sama('deteksi belum terukur', ambil(kosong, 'deteksi').nilai, null)
  sama('telaah belum terukur', ambil(kosong, 'telaah').nilai, null)
  sama('kesegaran belum terukur', ambil(kosong, 'kesegaran').nilai, null)
  periksa('tidak satu pun ukuran waktu bernilai nol',
    kosong.filter((k) => k.satuan === 'jam').every((k) => k.nilai !== 0))
  sama('nilai tampil mengatakannya', nilaiTampil(ambil(kosong, 'deteksi')), 'belum terukur')

  const rekap = rekapKpi(kosong)
  sama('rekap menyebutnya belum terukur, bukan meleset', rekap.meleset, 0)
  periksa('dan menghitungnya', rekap.belumTerukur > 0)
}

{
  // Janji nomor tiga: terbit SESUDAH masuk adalah data yang keliru.
  const mustahil = [berita({ id: 'z', terbit: 2, masuk: 10 })]
  const k = hitungKpi(mustahil, { sekarang: SEKARANG })
  sama('selisih mustahil tidak ikut terhitung', ambil(k, 'deteksi').dasar, 0)
  sama('dan tidak dilaporkan sebagai nol jam', ambil(k, 'deteksi').nilai, null)
}

/* -------------------------------------------------------------- 6. tampilan */

console.log('6. Nilai tampil')

sama('menit untuk yang di bawah satu jam',
  nilaiTampil({ satuan: 'jam', nilai: 0.5 }), '30 menit')
sama('jam untuk yang sedang', nilaiTampil({ satuan: 'jam', nilai: 4.25 }), '4,3 jam')
sama('hari untuk yang panjang', nilaiTampil({ satuan: 'jam', nilai: 96 }), '4,0 hari')
sama('persen untuk ukuran bagian',
  nilaiTampil({ satuan: 'bagian', nilai: 0.1234 }), '12,3%')
sama('koma Indonesia dipakai', nilaiTampil({ satuan: 'jam', nilai: 2.5 }).includes(','), true)

/* --------------------------------------------------------------- 7. rekap */

console.log('7. Rekap dan sasaran')

{
  const rekap = rekapKpi(KPI)
  sama('rekap menghitung seluruhnya', rekap.jumlah, KPI.length)
  periksa('yang terukur tidak melebihi seluruhnya', rekap.terukur <= rekap.jumlah)
  sama('terukur ditambah belum terukur sama dengan seluruhnya',
    rekap.terukur + rekap.belumTerukur, rekap.jumlah)
}
periksa('setiap sasaran waktu bilangan positif',
  Object.entries(SASARAN).every(([, v]) => Number.isFinite(v) && v > 0))
periksa('setiap KPI menyebut sasarannya',
  KPI.every((k) => Number.isFinite(k.sasaran)))

/* ----------------------------------------------------------------- akhir */

console.log(`\n  ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
