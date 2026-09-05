/**
 * Uji pantauan — pencarian tersimpan dan daftar pantau.
 *
 * Yang diuji di sini sebagian besar bukan penyimpanannya, melainkan janji yang
 * dibuat modul ini kepada layar:
 *
 *   1. Satu mekanisme. Daftar pantau unit dan pencarian tersimpan harus
 *      menghasilkan angka yang sama untuk pertanyaan yang sama. Kalau tidak,
 *      penyatuan keduanya sia-sia.
 *   2. Angkanya himpunan dasar. Baris yang sudah dinyatakan tidak valid tidak
 *      boleh ikut terhitung, sebab tidak ada satu pun layar lain yang
 *      menghitungnya.
 *   3. "Baru" berarti sejak terakhir dibaca, bukan sejak kemarin.
 *   4. Ambang menilai yang BARU. Pantauan yang menyala karena arsip lamanya
 *      besar akan menyala selamanya, dan itu sama tidak berartinya dengan
 *      pantauan yang tidak pernah menyala.
 *   5. Penyimpanan yang menolak menyimpan tidak boleh membuat modul ini
 *      berpura-pura berhasil, dan tidak boleh membuatnya berhenti bekerja.
 *
 * Dijalankan tanpa peramban: node tools/uji-pantauan.mjs
 */

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

/* ------------------------------------------------- penyimpanan tiruan */

function pasangPenyimpanan({ menolak = false } = {}) {
  const isi = new Map()
  globalThis.localStorage = {
    getItem: (k) => (isi.has(k) ? isi.get(k) : null),
    setItem: (k, v) => {
      if (menolak) throw new Error('penyimpanan situs ditolak')
      isi.set(k, String(v))
    },
    removeItem: (k) => { isi.delete(k) },
  }
  return isi
}

pasangPenyimpanan()

const P = await import('../web/js/lib/pantauan.js')

/* ------------------------------------------------------------ data uji */

const SEKARANG = new Date('2026-09-05T09:00:00+07:00')
const jamLalu = (n) => new Date(SEKARANG.getTime() - n * 3_600_000).toISOString()

function berita(x) {
  return {
    id: x.id,
    judul: x.judul || 'Judul uji yang cukup panjang untuk dinilai',
    nama_upt: x.upt || 'Lapas Kelas IIA Cilegon',
    media: x.media || 'Banten Pos',
    kategori: x.kategori || 'Keamanan dan Ketertiban',
    subkategori: 'Penyelundupan Barang Terlarang',
    platform: 'Portal Berita',
    provinsi: 'Banten',
    kanwil_asal: 'Kantor Wilayah Ditjenpas Banten',
    sentimen: x.sentimen || 'Negatif',
    urgensi: x.urgensi || 'Sedang',
    status_verifikasi: x.status || 'Belum Ditelaah',
    created_at: x.created || jamLalu(2),
    tanggal_publikasi: x.created || jamLalu(2),
  }
}

const ARSIP = [
  berita({ id: 'a', created: jamLalu(1), urgensi: 'Kritis' }),
  berita({ id: 'b', created: jamLalu(3) }),
  berita({ id: 'c', created: jamLalu(50), judul: 'Kerusuhan pecah di blok tengah' }),
  berita({ id: 'd', created: jamLalu(2), upt: 'Rutan Kelas I Medan', media: 'Waspada Online' }),
  // Dinyatakan tidak valid. Tidak boleh ikut terhitung di mana pun.
  berita({ id: 'e', created: jamLalu(1), status: 'Tidak Valid' }),
  // Di luar lingkup Pemasyarakatan, dengan alasan yang sama.
  berita({ id: 'f', created: jamLalu(1), kategori: 'Di Luar Lingkup' }),
  berita({ id: 'g', created: jamLalu(4), sentimen: 'Positif', urgensi: 'Rendah' }),
]

/* --------------------------------------------------------- 1. penyusunan */

console.log('\n1. Penyusunan pantauan')

sama('daftar mula-mula kosong', P.daftarPantauan().length, 0)

{
  const p = P.pantauanUntuk('unit', 'Lapas Kelas IIA Cilegon')
  sama('pantauan unit menjadi kueri bidang', p.kueri, 'upt:"Lapas Kelas IIA Cilegon"')
  sama('namanya apa adanya', p.nama, 'Lapas Kelas IIA Cilegon')
  sama('jenisnya terbawa', p.jenis, 'unit')
}
sama('pantauan wilayah memakai bidang wilayah',
  P.pantauanUntuk('wilayah', 'Banten').kueri, 'wilayah:Banten')
sama('pantauan media memakai bidang media',
  P.pantauanUntuk('media', 'Waspada Online').kueri, 'media:"Waspada Online"')
sama('pantauan kata kunci memakai kata itu apa adanya',
  P.pantauanUntuk('kata', 'kerusuhan').kueri, 'kerusuhan')
sama('jenis tak dikenal jatuh ke pencarian',
  P.pantauanUntuk('entahapa', 'x').jenis, 'pencarian')

{
  const p = P.bakukan({})
  periksa('bakukan selalu memberi id', Boolean(p.id))
  periksa('bakukan selalu memberi ambang', typeof p.ambang.minimum === 'number')
  sama('ambang bawaan tidak menyala', p.ambang.minimum, 0)
  periksa('bakukan selalu memberi tanggal dibuat', Boolean(p.dibuat))
}
sama('ambang negatif dijepit ke nol', P.bakukan({ ambang: { minimum: -5 } }).ambang.minimum, 0)

/* ----------------------------------------------------------- 2. simpanan */

console.log('2. Menyimpan, memperbarui, melepas')

const unitCilegon = P.pantauanUntuk('unit', 'Lapas Kelas IIA Cilegon')
{
  const hasil = P.simpanPantauan(unitCilegon)
  periksa('penambahan pertama dinyatakan baru', hasil.baru)
  periksa('penyimpanan awet pada peramban yang menerima', hasil.awet)
  sama('daftar berisi satu', P.daftarPantauan().length, 1)
}
{
  const hasil = P.simpanPantauan(P.pantauanUntuk('unit', 'Lapas Kelas IIA Cilegon'))
  periksa('kueri kembar tidak digandakan', !hasil.baru)
  sama('daftar tetap satu', P.daftarPantauan().length, 1)
}
{
  const ubah = { ...unitCilegon, nama: 'Cilegon (pantauan piket)' }
  P.simpanPantauan(ubah)
  sama('perubahan menurut id tidak menambah baris', P.daftarPantauan().length, 1)
  sama('namanya ikut berubah', P.daftarPantauan()[0].nama, 'Cilegon (pantauan piket)')
}

periksa('sudahDipantau mengenali nilainya', P.sudahDipantau('unit', 'Lapas Kelas IIA Cilegon'))
periksa('sudahDipantau menolak yang lain', !P.sudahDipantau('unit', 'Rutan Kelas I Medan'))

P.simpanPantauan(P.pantauanUntuk('kata', 'kerusuhan'))
sama('pantauan kedua masuk', P.daftarPantauan().length, 2)

P.lepasPantauan('kata', 'kerusuhan')
sama('lepasPantauan membuang menurut nilainya', P.daftarPantauan().length, 1)

{
  // Batas. Di atas ini, daftar pantauan berhenti menjadi daftar.
  for (let i = 0; i < P.BATAS + 5; i += 1) P.simpanPantauan(P.pantauanUntuk('kata', `kata${i}`))
  sama('jumlah berhenti di batas', P.daftarPantauan().length, P.BATAS)
  const hasil = P.simpanPantauan(P.pantauanUntuk('kata', 'satu lagi'))
  periksa('penambahan di atas batas dinyatakan penuh', hasil.penuh)
  periksa('penambahan di atas batas tidak dinyatakan baru', !hasil.baru)
}

P.kosongkanPantauan()
sama('pengosongan menyisakan nol', P.daftarPantauan().length, 0)

/* ---------------------------------------------------------- 3. penilaian */

console.log('3. Penilaian terhadap arsip')

{
  const nilai = P.nilaiPantauan(P.pantauanUntuk('unit', 'Lapas Kelas IIA Cilegon'), ARSIP, SEKARANG)
  // a, b, c, g — bukan e (tidak valid) dan bukan f (di luar lingkup).
  sama('hanya himpunan dasar yang terhitung', nilai.jumlah, 4)
  periksa('baris tidak valid tidak ikut', !nilai.hasil.some((b) => b.id === 'e'))
  periksa('baris di luar lingkup tidak ikut', !nilai.hasil.some((b) => b.id === 'f'))
  sama('mendesak terhitung terpisah', nilai.mendesak, 1)
  sama('negatif terhitung terpisah', nilai.negatif, 3)
  periksa('contoh berisi paling banyak tiga', nilai.contoh.length <= 3)
  periksa('contoh terurut dari yang terbaru', nilai.contoh[0]?.id === 'a')
}

{
  // Janji nomor satu: pertanyaan yang sama lewat dua jalan harus berjumlah sama.
  const lewatDaftarPantau = P.nilaiPantauan(
    P.pantauanUntuk('unit', 'Lapas Kelas IIA Cilegon'), ARSIP, SEKARANG)
  const lewatPencarian = P.nilaiPantauan(
    P.bakukan({ jenis: 'pencarian', nama: 'apa saja', kueri: 'upt:"Lapas Kelas IIA Cilegon"' }),
    ARSIP, SEKARANG)
  sama('daftar pantau dan pencarian tersimpan berjumlah sama',
    lewatDaftarPantau.jumlah, lewatPencarian.jumlah)
}

{
  const nilai = P.nilaiPantauan(P.pantauanUntuk('kata', 'kerusuhan'), ARSIP, SEKARANG)
  sama('pantauan kata kunci menemukan judulnya', nilai.jumlah, 1)
  sama('yang ditemukan baris c', nilai.hasil[0].id, 'c')
}

{
  // Tanpa penandaan, "baru" berarti 24 jam terakhir. Baris c berusia 50 jam.
  const nilai = P.nilaiPantauan(P.pantauanUntuk('unit', 'Lapas Kelas IIA Cilegon'), ARSIP, SEKARANG)
  sama('baru bawaan adalah 24 jam terakhir', nilai.baru, 3)
}

{
  // Sesudah ditandai dibaca, "baru" berarti sejak penandaan itu.
  const simpan = P.simpanPantauan(P.pantauanUntuk('unit', 'Lapas Kelas IIA Cilegon'))
  P.tandaiDilihat(simpan.pantauan.id, new Date(SEKARANG.getTime() - 2.5 * 3_600_000))
  const p = P.daftarPantauan()[0]
  const nilai = P.nilaiPantauan(p, ARSIP, SEKARANG)
  sama('baru dihitung sejak terakhir dibaca', nilai.baru, 1)
  sama('yang baru adalah baris a', nilai.hasil.filter((b) => b.id === 'a').length, 1)
  P.kosongkanPantauan()
}

/* ------------------------------------------------------------- 4. ambang */

console.log('4. Ambang')

{
  const p = P.bakukan({
    jenis: 'unit', nama: 'Cilegon', kueri: 'upt:"Lapas Kelas IIA Cilegon"',
    ambang: { minimum: 0 },
  })
  periksa('ambang nol tidak pernah menyala', !P.nilaiPantauan(p, ARSIP, SEKARANG).menyala)
}
{
  const p = P.bakukan({
    jenis: 'unit', nama: 'Cilegon', kueri: 'upt:"Lapas Kelas IIA Cilegon"',
    ambang: { minimum: 3 },
  })
  periksa('ambang tercapai menyala', P.nilaiPantauan(p, ARSIP, SEKARANG).menyala)
}
{
  const p = P.bakukan({
    jenis: 'unit', nama: 'Cilegon', kueri: 'upt:"Lapas Kelas IIA Cilegon"',
    ambang: { minimum: 4 },
  })
  const nilai = P.nilaiPantauan(p, ARSIP, SEKARANG)
  periksa('ambang di atas yang baru tidak menyala', !nilai.menyala)
  periksa('meski jumlah seluruhnya mencukupi', nilai.jumlah >= 4)
}
{
  const p = P.bakukan({
    jenis: 'unit', nama: 'Cilegon', kueri: 'upt:"Lapas Kelas IIA Cilegon"',
    ambang: { minimum: 2, hanyaMendesak: true },
  })
  const nilai = P.nilaiPantauan(p, ARSIP, SEKARANG)
  sama('saringan mendesak memangkas yang terhitung', nilai.terhitung, 1)
  periksa('sehingga ambangnya tidak tercapai', !nilai.menyala)
}
{
  const p = P.bakukan({
    jenis: 'unit', nama: 'Cilegon', kueri: 'upt:"Lapas Kelas IIA Cilegon"',
    ambang: { minimum: 1, hanyaNegatif: true },
  })
  const nilai = P.nilaiPantauan(p, ARSIP, SEKARANG)
  periksa('saringan negatif tetap menyala bila ada yang negatif', nilai.menyala)
  sama('baris positif tidak ikut terhitung', nilai.terhitung, 2)
}

/* ------------------------------------------------------------ 5. urutan */

console.log('5. Urutan dan rekap')

{
  P.kosongkanPantauan()
  P.simpanPantauan(P.bakukan({
    jenis: 'kata', nama: 'Sepi', kueri: 'kerusuhan', ambang: { minimum: 0 },
  }))
  P.simpanPantauan(P.bakukan({
    jenis: 'unit', nama: 'Menyala', kueri: 'upt:"Lapas Kelas IIA Cilegon"',
    ambang: { minimum: 1 },
  }))
  const semua = P.nilaiSemua(ARSIP, SEKARANG)
  sama('keduanya dinilai', semua.length, 2)
  sama('yang menyala berada di puncak', semua[0].pantauan.nama, 'Menyala')

  const rekap = P.rekapPantauan(semua)
  sama('rekap menghitung jumlah', rekap.jumlah, 2)
  sama('rekap menghitung yang menyala', rekap.menyala, 1)
  periksa('rekap menjumlahkan yang baru', rekap.baru >= 3)
  P.kosongkanPantauan()
}

/* ------------------------------------------- 6. penyimpanan yang menolak */

console.log('6. Peramban yang menolak menyimpan')

pasangPenyimpanan({ menolak: true })
const Q = await import('../web/js/lib/pantauan.js?tanpa-simpanan')

periksa('penyimpananAwet melaporkan tidak awet', !Q.penyimpananAwet())
{
  const hasil = Q.simpanPantauan(Q.pantauanUntuk('kata', 'sabu'))
  periksa('penambahan tetap dinyatakan baru', hasil.baru)
  periksa('tetapi tidak dinyatakan awet', !hasil.awet)
  sama('dan tetap terbaca dalam sesi berjalan', Q.daftarPantauan().length, 1)
}
{
  let meledak = false
  try { Q.nilaiSemua(ARSIP, SEKARANG) } catch { meledak = true }
  periksa('penilaian tetap berjalan tanpa penyimpanan', !meledak)
}

/* ----------------------------------------------------------------- akhir */

console.log(`\n  ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
