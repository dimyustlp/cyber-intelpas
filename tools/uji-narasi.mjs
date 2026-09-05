/**
 * Uji narasi.
 *
 * Tiga hal yang dijaga, dan ketiganya adalah janji yang dibuat halaman kepada
 * pembacanya:
 *
 *   1. **Bentuk narasi ditentukan deret harinya, bukan jumlahnya.** Sepuluh
 *      publikasi dalam satu hari dan sepuluh publikasi dalam tiga pekan adalah
 *      dua cerita yang berbeda sama sekali, dan angka totalnya sama.
 *   2. **Berulang menang atas menanjak.** Dua letupan berjarak sepekan sunyi
 *      adalah bentuk yang paling sulit dilihat manusia; bila ia kalah oleh
 *      pemeriksaan menanjak, cerita yang belum padam akan dilaporkan sebagai
 *      cerita yang baru mulai.
 *   3. **Narasi unit dan narasi nasional tidak dilebur.** Yang menjawab
 *      keduanya orang yang berbeda.
 *
 * Dijalankan tanpa peramban: node tools/uji-narasi.mjs
 */

import {
  ATUR, BENTUK, bentukNarasi, bentukDari, susunNarasi, rekapNarasi,
} from '../web/js/lib/narasi.js'

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

/* --------------------------------------------------------- 1. bentuk saja */

console.log('\n1. Bentuk dari deret hari')

sama('deret kosong', bentukNarasi([]), 'sekali')
sama('satu hari saja', bentukNarasi([100]), 'sekali')
sama('dua publikasi berdempetan', bentukNarasi([100, 101]), 'sekali')

sama('mengalir sepekan tanpa jeda',
  bentukNarasi([100, 101, 102, 103, 104, 105, 106, 107]), 'bertahan')

sama('separuh terakhir jauh lebih ramai',
  bentukNarasi([100, 103, 106, 107, 108, 109]), 'menanjak')
sama('separuh awal jauh lebih ramai',
  bentukNarasi([100, 101, 102, 103, 106, 109]), 'mereda')

sama('dua letupan berjarak jeda sunyi',
  bentukNarasi([100, 101, 110, 111]), 'berulang')

{
  // Janji nomor dua: deret ini menanjak DAN berulang sekaligus. Yang harus
  // dilaporkan adalah berulang.
  const deret = [100, 112, 113, 114, 115]
  sama('berulang menang atas menanjak', bentukNarasi(deret), 'berulang')
  const tanpaJeda = [100, 101, 102, 103, 104]
  periksa('deret yang sama tanpa jeda tidak disebut berulang',
    bentukNarasi(tanpaJeda) !== 'berulang')
}

sama('jeda tepat sebesar ambang belum memecah',
  bentukNarasi([100, 100 + ATUR.jedaSunyi, 106, 107, 108]), 'menanjak')
periksa('jeda satu hari di atas ambang memecah',
  bentukNarasi([100, 100 + ATUR.jedaSunyi + 1, 108, 109]) === 'berulang')

periksa('setiap bentuk punya nada dan keterangan',
  BENTUK.every((b) => b.nada && b.keterangan.length > 30))
sama('bentuk tak dikenal jatuh ke sekali', bentukDari('entahapa').kode, 'sekali')

/* --------------------------------------------------------- 2. data uji */

console.log('2. Penyusunan dari arsip')

const SEKARANG = new Date('2026-09-05T09:00:00+07:00')
const hariLalu = (n) => new Date(SEKARANG.getTime() - n * 86_400_000).toISOString()

function berita(x) {
  return {
    id: x.id,
    judul: x.judul,
    nama_upt: x.upt,
    provinsi: x.provinsi || 'Banten',
    kanwil_asal: x.kanwil || 'Kantor Wilayah Ditjenpas Banten',
    media: x.media,
    platform: x.platform || 'Portal Berita',
    kategori: x.kategori || 'Keamanan dan Ketertiban',
    subkategori: x.sub || 'Penyelundupan Barang Terlarang',
    subkategori_kode: x.kode || '1.1',
    sentimen: x.sentimen || 'Negatif',
    urgensi: x.urgensi || 'Sedang',
    status_verifikasi: x.status || 'Terverifikasi',
    tanggapan_sikap: x.sikap || null,
    tanggal_publikasi: hariLalu(x.hari),
    created_at: hariLalu(x.hari),
  }
}

const CILEGON = 'Lapas Kelas IIA Cilegon'
const MEDAN = 'Rutan Kelas I Medan'
const SURABAYA = 'Lapas Kelas I Surabaya'

const ARSIP = [
  // Cilegon, tema yang sama, dua letupan berjarak 22 hari — dua peristiwa,
  // satu narasi unit yang berulang.
  berita({ id: 'c1', hari: 25, upt: CILEGON, media: 'Banten Pos', judul: 'Penyelundupan sabu lewat tembok belakang digagalkan petugas' }),
  berita({ id: 'c2', hari: 25, upt: CILEGON, media: 'Radar Banten', judul: 'Paket narkotika dilempar ke area lapas, petugas menyita barang bukti' }),
  berita({ id: 'c3', hari: 3, upt: CILEGON, media: 'Detik', judul: 'Upaya penyelundupan telepon genggam lewat kiriman makanan terungkap' }),
  berita({ id: 'c4', hari: 2, upt: CILEGON, media: 'Kompas', judul: 'Petugas menggagalkan kiriman berisi ponsel untuk warga binaan' }),

  // Dua unit berbeda, tema yang sama, masing-masing satu peristiwa — satu
  // narasi nasional.
  berita({ id: 'm1', hari: 2, upt: MEDAN, kanwil: 'Kantor Wilayah Ditjenpas Sumatera Utara', provinsi: 'Sumatera Utara', media: 'Waspada Online', kode: '2.1', sub: 'Keterlibatan Petugas dalam Narkotika', kategori: 'Integritas dan Penyalahgunaan Wewenang', judul: 'Oknum sipir ditangkap membawa sabu di pos penjagaan', urgensi: 'Kritis' }),
  berita({ id: 's1', hari: 1, upt: SURABAYA, kanwil: 'Kantor Wilayah Ditjenpas Jawa Timur', provinsi: 'Jawa Timur', media: 'Jawa Pos', platform: 'Instagram', kode: '2.1', sub: 'Keterlibatan Petugas dalam Narkotika', kategori: 'Integritas dan Penyalahgunaan Wewenang', judul: 'Petugas jaga malam diperiksa terkait peredaran narkotika di blok C' }),

  // Yang tidak boleh ikut terhitung sama sekali.
  berita({ id: 'x1', hari: 40, upt: CILEGON, media: 'Banten Pos', judul: 'Penyelundupan sabu tahun lalu di lapas yang sama' }),
  berita({ id: 'x2', hari: 2, upt: CILEGON, media: 'Kabar Hoaks', status: 'Tidak Valid', judul: 'Kabar penyelundupan besar yang ternyata keliru' }),
  berita({ id: 'x3', hari: 2, upt: CILEGON, media: 'Antara', kategori: 'Di Luar Lingkup', kode: '0.9', sub: 'Di Luar Lingkup', judul: 'Berita imigrasi yang bukan urusan pemasyarakatan' }),
]

const narasi = susunNarasi(ARSIP, { sekarang: SEKARANG })

periksa('menghasilkan sekurangnya dua narasi', narasi.length >= 2, `dapat ${narasi.length}`)

const semuaId = narasi.flatMap((n) => n.publikasi.map((b) => b.id))
periksa('publikasi di luar jendela tidak ikut', !semuaId.includes('x1'))
periksa('publikasi tidak valid tidak ikut', !semuaId.includes('x2'))
periksa('publikasi di luar lingkup tidak ikut', !semuaId.includes('x3'))
sama('seluruh publikasi yang sah terhitung sekali', semuaId.length, 6)
sama('tidak ada publikasi terhitung dua kali', new Set(semuaId).size, semuaId.length)

const cilegon = narasi.find((n) => n.publikasi.some((b) => b.id === 'c1'))
periksa('narasi Cilegon ditemukan', Boolean(cilegon))
sama('lingkupnya unit', cilegon.lingkup, 'unit')
sama('unitnya disebut', cilegon.nama_upt, CILEGON)
sama('berisi dua peristiwa', cilegon.jumlah_peristiwa, 2)
sama('berisi empat publikasi', cilegon.jumlah_publikasi, 4)
sama('bentuknya berulang', cilegon.bentuk, 'berulang')
sama('empat media berbeda', cilegon.jumlah_media, 4)
periksa('pemantiknya publikasi paling awal', cilegon.pemantik?.media?.length > 0)
periksa('rentangnya melebihi tiga pekan', cilegon.rentang_hari >= 22, `dapat ${cilegon.rentang_hari}`)

const nasional = narasi.find((n) => n.publikasi.some((b) => b.id === 'm1'))
periksa('narasi nasional ditemukan', Boolean(nasional))
sama('lingkupnya nasional', nasional.lingkup, 'nasional')
sama('unitnya tidak dipilih salah satu', nasional.nama_upt, null)
sama('menyebut dua unit', nasional.unit.length, 2)
sama('menyebut dua provinsi', nasional.provinsi.length, 2)
periksa('lintas platform terdeteksi', nasional.lintas_platform)

/* ----------------------------------------------------- 3. narasi tandingan */

console.log('3. Narasi tandingan')

periksa('narasi nasional ini berjalan sendirian', nasional.tandingan.sendirian)
sama('tidak ada publikasi penyeimbang', nasional.tandingan.publikasi, 0)
sama('tidak ada sikap resmi', nasional.tandingan.tanggapan, 0)

{
  const denganTanggapan = susunNarasi(
    ARSIP.map((b) => (b.id === 'm1' ? { ...b, tanggapan_sikap: 'Klarifikasi' } : b)),
    { sekarang: SEKARANG },
  )
  const n = denganTanggapan.find((x) => x.publikasi.some((b) => b.id === 'm1'))
  periksa('sikap resmi membatalkan sendirian', !n.tandingan.sendirian)
  sama('sikap resmi terhitung', n.tandingan.tanggapan, 1)
  periksa('dan tandingan dinyatakan ada', n.tandingan.ada)
}

{
  const denganPositif = susunNarasi(
    [...ARSIP, berita({
      id: 'p1', hari: 1, upt: MEDAN, kanwil: 'Kantor Wilayah Ditjenpas Sumatera Utara',
      provinsi: 'Sumatera Utara', media: 'InfoPAS', kode: '2.1',
      sub: 'Keterlibatan Petugas dalam Narkotika',
      kategori: 'Integritas dan Penyalahgunaan Wewenang',
      sentimen: 'Positif', urgensi: 'Rendah',
      judul: 'Kanwil menegaskan penindakan tegas dan pemeriksaan menyeluruh',
    })],
    { sekarang: SEKARANG },
  )
  const n = denganPositif.find((x) => x.publikasi.some((b) => b.id === 'm1'))
  periksa('publikasi positif membatalkan sendirian', !n.tandingan.sendirian)
  periksa('dan terhitung sebagai penyeimbang', n.tandingan.publikasi >= 1)
}

/* ---------------------------------------------------------- 4. deret & rekap */

console.log('4. Deret dan rekap')

periksa('deret tidak berlubang',
  cilegon.deret.every((d, i) => i === 0 || d.hari === cilegon.deret[i - 1].hari + 1))
sama('panjang deret sama dengan rentangnya', cilegon.deret.length, cilegon.rentang_hari)
sama('jumlah pada deret sama dengan jumlah publikasinya',
  cilegon.deret.reduce((n, d) => n + d.jumlah, 0), cilegon.jumlah_publikasi)
periksa('puncak menyebut hari dengan jumlah terbesar',
  cilegon.puncak.jumlah === Math.max(...cilegon.deret.map((d) => d.jumlah)))

periksa('pangsa seluruh narasi berjumlah satu',
  Math.abs(narasi.reduce((n, x) => n + x.pangsa, 0) - 1) < 1e-9,
  String(narasi.reduce((n, x) => n + x.pangsa, 0)))

{
  const rekap = rekapNarasi(narasi)
  sama('rekap menghitung seluruhnya', rekap.jumlah, narasi.length)
  sama('rekap membagi menurut lingkup', rekap.unit + rekap.nasional <= narasi.length, true)
  sama('rekap menghitung yang berjalan sendirian', rekap.sendirian >= 1, true)
  periksa('jumlah per bentuk sama dengan jumlah narasi',
    Object.values(rekap.perBentuk).reduce((a, b) => a + b, 0) === narasi.length)
  periksa('dominan hanya disebut bila pangsanya melewati seperlima',
    !rekap.dominan || rekap.dominan.pangsa >= 0.2)
}
sama('rekap daftar kosong tidak meledak', rekapNarasi([]).jumlah, 0)
sama('rekap daftar kosong tidak mengarang dominan', rekapNarasi([]).dominan, null)

/* ---------------------------------------------------------- 5. urutan */

console.log('5. Urutan')

periksa('terurut menurun menurut bobot',
  narasi.every((n, i) => i === 0 || narasi[i - 1].bobot >= n.bobot))
periksa('arsip kosong menghasilkan daftar kosong',
  susunNarasi([], { sekarang: SEKARANG }).length === 0)
{
  let meledak = false
  try { susunNarasi([{ id: 'a' }], { sekarang: SEKARANG }) } catch { meledak = true }
  periksa('baris tanpa tanggal tidak meledak', !meledak)
}

/* ----------------------------------------------------------------- akhir */

console.log(`\n  ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
