/**
 * Uji mesin aturan peringatan.
 *
 * Empat janji yang dijaga di sini:
 *
 *   1. **Satu peristiwa, satu temuan per aturan.** Aturan yang menyala per
 *      publikasi akan menyala sebelas kali untuk satu pelarian yang diberitakan
 *      sebelas media, dan sebelas peringatan tentang satu kejadian adalah cara
 *      tercepat membuat orang berhenti membaca peringatan.
 *   2. **Urgensi dibandingkan menurut kedudukannya, bukan abjadnya.** Secara
 *      abjad "Kritis" lebih kecil daripada "Sedang", dan aturan "urgensi ≥
 *      Tinggi" yang membandingkan abjad akan diam persis pada peristiwa yang
 *      paling perlu dibaca.
 *   3. **Aturan bawaan tidak bisa dihapus, hanya dipulihkan** — dan ambang
 *      yang sudah disunting sebuah kantor tidak dikembalikan diam-diam ke
 *      angka bawaan.
 *   4. **Setiap temuan bisa menjelaskan dirinya**, dan pada aturan "salah
 *      satu" hanya syarat yang benar-benar terpenuhi yang disebut.
 *
 * Dijalankan tanpa peramban: node tools/uji-aturan.mjs
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

/* --------------------------------------------------- penyimpanan tiruan */

const isi = new Map()
globalThis.localStorage = {
  getItem: (k) => (isi.has(k) ? isi.get(k) : null),
  setItem: (k, v) => { isi.set(k, String(v)) },
  removeItem: (k) => { isi.delete(k) },
}

const A = await import('../web/js/lib/aturan.js')

/* ------------------------------------------------------------ data uji */

const SEKARANG = new Date('2026-09-05T09:00:00+07:00')
const jamLalu = (n) => new Date(SEKARANG.getTime() - n * 3_600_000).toISOString()

function berita(x) {
  return {
    id: x.id,
    judul: x.judul,
    nama_upt: x.upt || 'Lapas Kelas IIA Cilegon',
    kanwil_asal: x.kanwil || 'Kantor Wilayah Ditjenpas Banten',
    provinsi: x.provinsi || 'Banten',
    media: x.media,
    platform: x.platform || 'Portal Berita',
    kategori: x.kategori || 'Keamanan dan Ketertiban',
    subkategori: x.sub || 'Kerusuhan dan Gangguan Kamtib',
    subkategori_kode: x.kode || '1.2',
    sentimen: x.sentimen || 'Negatif',
    urgensi: x.urgensi || 'Kritis',
    status_verifikasi: x.status || 'Belum Ditelaah',
    tanggapan_sikap: x.sikap || null,
    tanggal_publikasi: jamLalu(x.jam),
    created_at: jamLalu(x.jam),
  }
}

/*
   Satu kerusuhan di Cilegon, diberitakan lima media di dua platform.

   Judulnya sengaja berbagi kosakata inti — kerusuhan, Cilegon, warga binaan,
   blok. Tanpa itu `kelompokkanPeristiwa()` memecahnya menjadi dua peristiwa,
   dan yang diuji di berkas ini bukan pengelompokannya melainkan aturan yang
   berjalan di atasnya.
*/
const KERUSUHAN = [
  berita({ id: 'k1', jam: 20, media: 'Banten Pos', judul: 'Kerusuhan pecah di Lapas Cilegon, puluhan warga binaan dievakuasi dari blok tengah' }),
  berita({ id: 'k2', jam: 18, media: 'Detik', judul: 'Kerusuhan Lapas Cilegon, puluhan warga binaan dievakuasi ke blok yang lebih aman' }),
  berita({ id: 'k3', jam: 16, media: 'Kompas', judul: 'Kerusuhan di Lapas Cilegon diredam, warga binaan kembali ke blok masing-masing' }),
  berita({ id: 'k4', jam: 12, media: 'Tempo', platform: 'Instagram', judul: 'Video kerusuhan Lapas Cilegon beredar, warga binaan terlihat dievakuasi' }),
  berita({ id: 'k5', jam: 6, media: 'Kumparan', platform: 'Instagram', judul: 'Kerusuhan Lapas Cilegon terkendali, seluruh warga binaan sudah kembali ke blok' }),
]

/* Satu kegiatan positif yang sepi. */
const PANEN = [
  berita({
    id: 'p1', jam: 30, upt: 'Lapas Kelas IIB Ciangir', media: 'InfoPAS',
    kategori: 'Narasi Positif Pemasyarakatan', sub: 'Ketahanan Pangan dan Pemberdayaan Ekonomi',
    kode: '8.6', sentimen: 'Positif', urgensi: 'Rendah', status: 'Terverifikasi',
    judul: 'Warga binaan memanen hasil kebun program ketahanan pangan',
  }),
]

const ARSIP = [...KERUSUHAN, ...PANEN]

/* --------------------------------------------------------- 1. kosakata */

console.log('\n1. Kosakata sinyal dan pembanding')

periksa('setiap sinyal punya label dan keterangan',
  A.SINYAL.every((s) => s.label && s.ket && s.ket.length > 15))
periksa('setiap sinyal menyebut jenisnya',
  A.SINYAL.every((s) => ['angka', 'urutan', 'pilihan', 'teks', 'boolean'].includes(s.jenis)))
periksa('setiap sinyal punya pengambil', A.SINYAL.every((s) => typeof s.ambil === 'function'))
sama('sinyal tak dikenal mengembalikan null', A.sinyalDari('entahapa'), null)

periksa('pembanding angka tersedia untuk sinyal angka',
  A.bandingUntuk('skor').some((b) => b.kode === 'ge'))
periksa('pembanding memuat tidak ditawarkan untuk sinyal angka',
  !A.bandingUntuk('skor').some((b) => b.kode === 'memuat'))
periksa('pembanding memuat ditawarkan untuk sinyal teks',
  A.bandingUntuk('unit').some((b) => b.kode === 'memuat'))
sama('sinyal tak dikenal tidak menawarkan pembanding apa pun',
  A.bandingUntuk('entahapa').length, 0)

// Kosakata tingkat harus yang sudah dikenal petugas, bukan yang kedua.
{
  const nama = new Set(A.ATURAN_BAWAAN.map((a) => a.tingkat))
  periksa('tingkat memakai kosakata yang sama dengan urgensi',
    [...nama].every((n) => ['Rendah', 'Sedang', 'Tinggi', 'Kritis'].includes(n)))
}

/* --------------------------------------------------- 2. penilaian syarat */

console.log('2. Penilaian syarat')

const { temuan: temuanAwal } = A.jalankanAturan(ARSIP, { sekarang: SEKARANG })
periksa('ada temuan dari aturan bawaan', temuanAwal.length > 0)

{
  // Janji nomor dua: urgensi dibandingkan menurut kedudukannya.
  const aturan = [A.bakukanAturan({
    id: 'uji-urgensi', nama: 'Urgensi tinggi ke atas', tingkat: 'Tinggi',
    syarat: [{ sinyal: 'urgensi', banding: 'ge', nilai: 'Tinggi' }],
  })]
  const hasil = A.jalankanAturan(ARSIP, { sekarang: SEKARANG, aturan })
  sama('kerusuhan Kritis lolos urgensi ≥ Tinggi', hasil.temuan.length, 1)
  periksa('dan yang lolos memang peristiwa kerusuhan',
    hasil.temuan[0].peristiwa.publikasi.some((b) => b.id === 'k1'))
}
{
  const aturan = [A.bakukanAturan({
    id: 'uji-urgensi-2', nama: 'Rendah saja', tingkat: 'Rendah',
    syarat: [{ sinyal: 'urgensi', banding: 'le', nilai: 'Rendah' }],
  })]
  const hasil = A.jalankanAturan(ARSIP, { sekarang: SEKARANG, aturan })
  sama('urgensi ≤ Rendah hanya menangkap yang positif', hasil.temuan.length, 1)
  periksa('yaitu peristiwa panen',
    hasil.temuan[0].peristiwa.publikasi.some((b) => b.id === 'p1'))
}

{
  const aturan = [A.bakukanAturan({
    id: 'uji-media', nama: 'Banyak media', tingkat: 'Tinggi',
    syarat: [{ sinyal: 'media', banding: 'ge', nilai: 4 }],
  })]
  const hasil = A.jalankanAturan(ARSIP, { sekarang: SEKARANG, aturan })
  sama('lima media lolos ambang empat', hasil.temuan.length, 1)
}
{
  const aturan = [A.bakukanAturan({
    id: 'uji-platform', nama: 'Lintas platform', tingkat: 'Sedang',
    syarat: [{ sinyal: 'platform', banding: 'ge', nilai: 2 }],
  })]
  sama('dua platform terdeteksi',
    A.jalankanAturan(ARSIP, { sekarang: SEKARANG, aturan }).temuan.length, 1)
}
{
  const aturan = [A.bakukanAturan({
    id: 'uji-teks', nama: 'Unit tertentu', tingkat: 'Sedang',
    syarat: [{ sinyal: 'unit', banding: 'memuat', nilai: 'cilegon' }],
  })]
  const hasil = A.jalankanAturan(ARSIP, { sekarang: SEKARANG, aturan })
  sama('pencocokan teks tidak peka huruf besar-kecil', hasil.temuan.length, 1)
}
{
  const aturan = [A.bakukanAturan({
    id: 'uji-boolean', nama: 'Belum ditelaah', tingkat: 'Sedang',
    syarat: [{ sinyal: 'tertelaah', banding: 'eq', nilai: false }],
  })]
  const hasil = A.jalankanAturan(ARSIP, { sekarang: SEKARANG, aturan })
  sama('hanya yang belum seluruhnya terverifikasi', hasil.temuan.length, 1)
  periksa('yaitu kerusuhan', hasil.temuan[0].peristiwa.publikasi.some((b) => b.id === 'k1'))
}
{
  const aturan = [A.bakukanAturan({
    id: 'uji-sentimen', nama: 'Positif', tingkat: 'Rendah',
    syarat: [{ sinyal: 'sentimen', banding: 'eq', nilai: 'Positif' }],
  })]
  const hasil = A.jalankanAturan(ARSIP, { sekarang: SEKARANG, aturan })
  sama('sentimen dibaca lewat embernya', hasil.temuan.length, 1)
  periksa('yaitu panen', hasil.temuan[0].peristiwa.publikasi.some((b) => b.id === 'p1'))
}

/* ------------------------------------------------------ 3. gabungan syarat */

console.log('3. Gabungan syarat')

{
  const semua = [A.bakukanAturan({
    id: 'uji-semua', nama: 'Dua syarat sekaligus', tingkat: 'Tinggi', gabung: 'semua',
    syarat: [
      { sinyal: 'media', banding: 'ge', nilai: 4 },
      { sinyal: 'urgensi', banding: 'ge', nilai: 'Kritis' },
    ],
  })]
  sama('kedua syarat terpenuhi',
    A.jalankanAturan(ARSIP, { sekarang: SEKARANG, aturan: semua }).temuan.length, 1)

  const mustahil = [A.bakukanAturan({
    id: 'uji-semua-2', nama: 'Mustahil', tingkat: 'Tinggi', gabung: 'semua',
    syarat: [
      { sinyal: 'media', banding: 'ge', nilai: 4 },
      { sinyal: 'sentimen', banding: 'eq', nilai: 'Positif' },
    ],
  })]
  sama('satu syarat gagal membatalkan seluruhnya',
    A.jalankanAturan(ARSIP, { sekarang: SEKARANG, aturan: mustahil }).temuan.length, 0)

  const salahSatu = [A.bakukanAturan({
    id: 'uji-salah-satu', nama: 'Salah satu', tingkat: 'Sedang', gabung: 'salah_satu',
    syarat: [
      { sinyal: 'media', banding: 'ge', nilai: 4 },
      { sinyal: 'sentimen', banding: 'eq', nilai: 'Positif' },
    ],
  })]
  const hasil = A.jalankanAturan(ARSIP, { sekarang: SEKARANG, aturan: salahSatu })
  sama('salah satu menangkap keduanya', hasil.temuan.length, 2)

  // Janji nomor empat: hanya syarat yang terpenuhi yang disebut sebagai dasar.
  for (const t of hasil.temuan) {
    sama(`dasar temuan ${t.peristiwa.nama_upt} hanya satu kalimat`, t.dasar.length, 1)
  }
}

/* --------------------------------------------- 4. satu peristiwa satu temuan */

console.log('4. Satu peristiwa, satu temuan per aturan')

{
  const aturan = [A.bakukanAturan({
    id: 'uji-tunggal', nama: 'Apa saja yang negatif', tingkat: 'Sedang',
    syarat: [{ sinyal: 'sentimen', banding: 'eq', nilai: 'Negatif' }],
  })]
  const hasil = A.jalankanAturan(ARSIP, { sekarang: SEKARANG, aturan })
  // Janji nomor satu: lima publikasi, satu peristiwa, satu temuan.
  sama('lima publikasi menghasilkan satu temuan', hasil.temuan.length, 1)
  sama('dan peristiwanya memuat kelima publikasinya',
    hasil.temuan[0].peristiwa.jumlah_publikasi, 5)
  sama('penghitung per aturan sejalan', hasil.perAturan['uji-tunggal'], 1)
}

/* ---------------------------------------------------------- 5. keterangan */

console.log('5. Keterangan dan urutan')

periksa('setiap temuan menyebut dasarnya',
  temuanAwal.every((t) => t.dasar.length > 0 && t.dasar.every((d) => d.length > 5)))
periksa('setiap temuan menyebut alamat eskalasinya',
  temuanAwal.every((t) => t.eskalasi?.label))
periksa('setiap temuan membawa rincian risikonya',
  temuanAwal.every((t) => Array.isArray(t.risiko?.faktor) && t.risiko.faktor.length === 6))
{
  const peringkat = { Kritis: 4, Tinggi: 3, Sedang: 2, Rendah: 1 }
  periksa('temuan terurut dari yang paling berat',
    temuanAwal.every((t, i) => i === 0 || peringkat[temuanAwal[i - 1].tingkat] >= peringkat[t.tingkat]))
}

{
  const a = A.bakukanAturan({
    nama: 'Contoh', tingkat: 'Kritis', eskalasi: 'pimpinan',
    syarat: [
      { sinyal: 'skor', banding: 'ge', nilai: 70 },
      { sinyal: 'media', banding: 'ge', nilai: 3 },
    ],
  })
  sama('ringkasan aturan terbaca sebagai kalimat', A.ringkasAturan(a),
    'Bila Skor risiko ≥ 70 dan Jumlah media ≥ 3, tandai Kritis dan naikkan ke Pimpinan.')
}
{
  const a = A.bakukanAturan({
    nama: 'Salah satu', tingkat: 'Sedang', gabung: 'salah_satu',
    syarat: [
      { sinyal: 'media', banding: 'ge', nilai: 3 },
      { sinyal: 'ditanggapi', banding: 'eq', nilai: false },
    ],
  })
  periksa('ringkasan aturan salah-satu memakai kata atau', A.ringkasAturan(a).includes(' atau '))
  periksa('ringkasan sinyal boolean terbaca', A.ringkasAturan(a).includes('sikap resmi tidak'))
}
periksa('aturan tanpa syarat mengatakan dirinya tidak pernah menyala',
  A.ringkasAturan(A.bakukanAturan({ nama: 'Kosong' })).includes('tidak pernah menyala'))

/* --------------------------------------------------------- 6. penyimpanan */

console.log('6. Penyimpanan dan aturan bawaan')

sama('daftar bawaan lengkap sejak awal',
  A.daftarAturan().filter((a) => a.bawaan).length, A.ATURAN_BAWAAN.length)
periksa('seluruh bawaan aktif secara bawaan',
  A.daftarAturan().filter((a) => a.bawaan).every((a) => a.aktif))
periksa('setiap bawaan bisa diringkas menjadi kalimat',
  A.daftarAturan().every((a) => A.ringkasAturan(a).length > 30))

{
  const bawaan = A.daftarAturan().find((a) => a.id === 'bawaan-menyeberang')
  A.simpanAturan({ ...bawaan, syarat: [{ sinyal: 'media', banding: 'ge', nilai: 9 }] })
  const sesudah = A.daftarAturan().find((a) => a.id === 'bawaan-menyeberang')
  sama('ambang bawaan yang disunting bertahan', sesudah.syarat[0].nilai, 9)
  periksa('dan tetap ditandai bawaan', sesudah.bawaan)
  sama('jumlah aturan tidak bertambah',
    A.daftarAturan().filter((a) => a.bawaan).length, A.ATURAN_BAWAAN.length)

  // Janji nomor tiga.
  const hapus = A.hapusAturan('bawaan-menyeberang')
  periksa('penghapusan bawaan dilaporkan sebagai pemulihan', hapus.dipulihkan)
  periksa('dan bukan sebagai penghapusan', !hapus.dihapus)
  sama('ambangnya kembali ke bawaan',
    A.daftarAturan().find((a) => a.id === 'bawaan-menyeberang').syarat[0].nilai, 3)
}

{
  const hasil = A.simpanAturan({
    nama: 'Aturan kantor', tingkat: 'Tinggi',
    syarat: [{ sinyal: 'skor', banding: 'ge', nilai: 65 }],
  })
  periksa('aturan sendiri tersimpan', hasil.baru)
  periksa('dan tidak ditandai bawaan', !hasil.aturan.bawaan)
  const hapus = A.hapusAturan(hasil.aturan.id)
  periksa('aturan sendiri benar-benar terhapus', hapus.dihapus)
  periksa('dan tidak dilaporkan sebagai pemulihan', !hapus.dipulihkan)
}

{
  const a = A.daftarAturan().find((x) => x.id === 'bawaan-kritis-cepat')
  A.setelAktif(a.id, false)
  periksa('bawaan bisa dimatikan',
    A.daftarAturan().find((x) => x.id === a.id).aktif === false)
  periksa('yang dimatikan tidak menghasilkan temuan',
    !A.jalankanAturan(ARSIP, { sekarang: SEKARANG }).temuan.some((t) => t.aturan.id === a.id))
  A.setelAktif(a.id, true)
  periksa('dan bisa dinyalakan kembali',
    A.daftarAturan().find((x) => x.id === a.id).aktif === true)
}

{
  A.kosongkanAturan()
  sama('pengosongan mengembalikan bawaan apa adanya',
    A.daftarAturan().length, A.ATURAN_BAWAAN.length)
}

/* --------------------------------------------------------- 7. pembakuan */

console.log('7. Pembakuan masukan')

{
  const a = A.bakukanAturan({
    nama: 'x', tingkat: 'Entahapa', eskalasi: 'entahsiapa',
    gabung: 'entahbagaimana', saluran: ['aplikasi', 'merpati'],
    syarat: [
      { sinyal: 'skor', banding: 'ge', nilai: 70 },
      { sinyal: 'tidakada', banding: 'ge', nilai: 1 },
      { sinyal: 'media', banding: 'entahapa', nilai: 1 },
    ],
  })
  sama('tingkat tak dikenal jatuh ke Sedang', a.tingkat, 'Sedang')
  sama('eskalasi tak dikenal jatuh ke analis', a.eskalasi, 'analis')
  sama('gabungan tak dikenal jatuh ke semua', a.gabung, 'semua')
  sama('saluran tak dikenal dibuang', a.saluran.join(','), 'aplikasi')
  sama('syarat bersinyal tak dikenal dibuang', a.syarat.length, 1)
}
{
  let meledak = false
  try { A.jalankanAturan([], { sekarang: SEKARANG }) } catch { meledak = true }
  periksa('arsip kosong tidak meledak', !meledak)
  sama('dan tidak menghasilkan temuan',
    A.jalankanAturan([], { sekarang: SEKARANG }).temuan.length, 0)
}

/* ----------------------------------------------------------------- akhir */

console.log(`\n  ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
