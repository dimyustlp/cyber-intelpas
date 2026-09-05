/**
 * Uji jaringan kaitan.
 *
 * Yang diuji bukan keindahan gambarnya, melainkan empat hal yang membuat
 * gambar itu boleh dipercaya:
 *
 *   1. **Tidak ada simpul orang.** Sampai kewenangannya dinyatakan hitam di
 *      atas putih, jaringan ini hanya berisi lembaga, media, wilayah, tema,
 *      dan platform. Pemeriksaan ini ada supaya penambahan jenis simpul baru
 *      menuntut keputusan, bukan sekadar satu baris kode.
 *   2. **Pemangkasan membuang yang paling sedikit menerangkan**, dan simpul
 *      fokus tidak pernah ikut terbuang.
 *   3. **Derajat dihitung ulang sesudah pemangkasan.** Simpul yang menyebut
 *      sepuluh tetangga di dalam gambar berisi tiga sedang berbohong tentang
 *      gambar yang sedang dilihat pembacanya.
 *   4. **Tata letaknya deterministik.** Masukan yang sama harus menghasilkan
 *      koordinat yang sama persis, sebab yang dicari analis adalah perubahan
 *      pada datanya, bukan pada gambarnya.
 *
 * Dijalankan tanpa peramban: node tools/uji-jaringan.mjs
 */

import {
  JENIS_SIMPUL, jenisSimpul, idSimpul, susunJaringan, penjembatan, tataLingkar,
} from '../web/js/lib/jaringan.js'

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

/* -------------------------------------------------------------- data uji */

const CILEGON = 'Lapas Kelas IIA Cilegon'
const MEDAN = 'Rutan Kelas I Medan'
const SURABAYA = 'Lapas Kelas I Surabaya'

function berita(x) {
  return {
    id: x.id,
    judul: x.judul || 'Judul uji',
    nama_upt: x.upt,
    kanwil_asal: x.kanwil || 'Kantor Wilayah Ditjenpas Banten',
    provinsi: x.provinsi || 'Banten',
    media: x.media,
    platform: x.platform || 'Portal Berita',
    kategori: 'Keamanan dan Ketertiban',
    subkategori: x.sub || 'Penyelundupan Barang Terlarang',
    subkategori_kode: x.kode || '1.1',
    sentimen: x.sentimen || 'Negatif',
    urgensi: x.urgensi || 'Sedang',
    status_verifikasi: x.status || 'Terverifikasi',
    tanggal_publikasi: '2026-09-03T08:00:00+07:00',
    created_at: '2026-09-03T08:00:00+07:00',
  }
}

const ARSIP = [
  berita({ id: '1', upt: CILEGON, media: 'Banten Pos' }),
  berita({ id: '2', upt: CILEGON, media: 'Banten Pos' }),
  berita({ id: '3', upt: CILEGON, media: 'Detik', sub: 'Kerusuhan dan Gangguan Kamtib', kode: '1.2' }),
  berita({ id: '4', upt: MEDAN, media: 'Detik', kanwil: 'Kantor Wilayah Ditjenpas Sumatera Utara', provinsi: 'Sumatera Utara' }),
  berita({ id: '5', upt: SURABAYA, media: 'Jawa Pos', kanwil: 'Kantor Wilayah Ditjenpas Jawa Timur', provinsi: 'Jawa Timur', platform: 'Instagram' }),
  // Tidak boleh terhitung: sudah dinyatakan tidak valid.
  berita({ id: '6', upt: CILEGON, media: 'Kabar Hoaks', status: 'Tidak Valid' }),
]

/* --------------------------------------------------------- 1. jenis simpul */

console.log('\n1. Jenis simpul')

sama('ada lima jenis simpul', JENIS_SIMPUL.length, 5)
periksa('tidak ada jenis simpul orang',
  !JENIS_SIMPUL.some((j) => ['orang', 'akun', 'pegawai', 'pejabat', 'pengguna'].includes(j.kode)))
periksa('setiap jenis menyebut bidang kueri yang membuka daftarnya',
  JENIS_SIMPUL.every((j) => typeof j.bidang === 'string' && j.bidang.length))
sama('jenis tak dikenal jatuh ke yang terakhir', jenisSimpul('entahapa').kode, 'platform')
sama('id simpul menggabungkan jenis dan nama', idSimpul('unit', CILEGON), `unit:${CILEGON}`)

/* ------------------------------------------------------------ 2. penyusunan */

console.log('2. Penyusunan')

const penuh = susunJaringan(ARSIP)

periksa('simpul unit tersusun',
  penuh.simpul.some((s) => s.jenis === 'unit' && s.nama === CILEGON))
periksa('simpul media tersusun',
  penuh.simpul.some((s) => s.jenis === 'media' && s.nama === 'Banten Pos'))
periksa('baris tidak valid tidak ikut',
  !penuh.simpul.some((s) => s.nama === 'Kabar Hoaks'))

{
  const cilegon = penuh.simpul.find((s) => s.id === idSimpul('unit', CILEGON))
  sama('bobot unit sama dengan jumlah publikasinya', cilegon.bobot, 3)
  sama('seluruhnya negatif', cilegon.negatif, 3)
}
{
  const bantenPos = penuh.simpul.find((s) => s.id === idSimpul('media', 'Banten Pos'))
  sama('bobot media sama dengan jumlah publikasinya', bantenPos.bobot, 2)
}
{
  const sisi = penuh.sisi.find((e) => e.dari === idSimpul('unit', CILEGON) && e.ke === idSimpul('media', 'Banten Pos'))
  periksa('sisi unit–media ada', Boolean(sisi))
  sama('bobot sisi sama dengan jumlah publikasi bersamanya', sisi.bobot, 2)
}
periksa('tidak ada sisi wilayah–platform',
  !penuh.sisi.some((e) => (e.dari.startsWith('wilayah:') && e.ke.startsWith('platform:'))
    || (e.dari.startsWith('platform:') && e.ke.startsWith('wilayah:'))))

periksa('seluruh sisi menunjuk simpul yang ada',
  penuh.sisi.every((e) => penuh.simpul.some((s) => s.id === e.dari)
    && penuh.simpul.some((s) => s.id === e.ke)))

{
  // Derajat harus sama dengan jumlah sisi yang benar-benar menyentuhnya.
  const benar = penuh.simpul.every((s) => {
    const hitung = penuh.sisi.filter((e) => e.dari === s.id || e.ke === s.id).length
    return s.derajat === hitung
  })
  periksa('derajat sama dengan jumlah sisi yang menyentuhnya', benar)
}

{
  const tanpaPlatform = susunJaringan(ARSIP, { jenisAktif: ['unit', 'media', 'tema'] })
  periksa('jenis yang dimatikan tidak muncul',
    !tanpaPlatform.simpul.some((s) => s.jenis === 'platform'))
  periksa('dan sisinya ikut hilang',
    !tanpaPlatform.sisi.some((e) => e.dari.startsWith('platform:') || e.ke.startsWith('platform:')))
}

{
  const berbobot = susunJaringan(ARSIP, { minBobot: 2 })
  periksa('ambang bobot membuang sisi tipis', berbobot.sisi.every((e) => e.bobot >= 2))
  periksa('dan menyisakan yang tebal', berbobot.sisi.length >= 1)
}

/* ---------------------------------------------------------------- 3. fokus */

console.log('3. Fokus dan kedalaman')

{
  const f = idSimpul('unit', CILEGON)
  const satu = susunJaringan(ARSIP, { fokus: f, kedalaman: 1 })
  sama('fokusnya tercatat', satu.fokus, f)
  periksa('fokus ikut di dalam gambar', satu.simpul.some((s) => s.id === f))
  periksa('Banten Pos adalah tetangga langsung',
    satu.simpul.some((s) => s.id === idSimpul('media', 'Banten Pos')))
  periksa('Jawa Pos bukan tetangga langsung Cilegon',
    !satu.simpul.some((s) => s.id === idSimpul('media', 'Jawa Pos')))

  const dua = susunJaringan(ARSIP, { fokus: f, kedalaman: 2 })
  periksa('kedalaman dua menjangkau lebih jauh', dua.simpul.length > satu.simpul.length)
  periksa('Medan tercapai lewat Detik pada kedalaman dua',
    dua.simpul.some((s) => s.id === idSimpul('unit', MEDAN)))
}

sama('fokus yang tidak ada diabaikan',
  susunJaringan(ARSIP, { fokus: 'unit:Tidak Ada' }).fokus, null)
periksa('dan gambarnya kembali penuh',
  susunJaringan(ARSIP, { fokus: 'unit:Tidak Ada' }).simpul.length === penuh.simpul.length)

/* ----------------------------------------------------------- 4. pemangkasan */

console.log('4. Pemangkasan')

{
  const f = idSimpul('unit', CILEGON)
  const kecil = susunJaringan(ARSIP, { fokus: f, maksSimpul: 3 })
  sama('jumlah simpul dijepit', kecil.simpul.length, 3)
  periksa('fokus tidak ikut terbuang', kecil.simpul.some((s) => s.id === f))
  periksa('yang tersisa bukan yang paling ringan',
    kecil.simpul.filter((s) => s.id !== f).every((s) => s.bobot >= 1))
  periksa('jumlah yang terbuang dilaporkan', kecil.terpangkas > 0)
  periksa('seluruh sisi masih menunjuk simpul yang tersisa',
    kecil.sisi.every((e) => kecil.simpul.some((s) => s.id === e.dari)
      && kecil.simpul.some((s) => s.id === e.ke)))

  // Janji nomor tiga.
  periksa('derajat dihitung ulang sesudah pemangkasan',
    kecil.simpul.every((s) => s.derajat
      === kecil.sisi.filter((e) => e.dari === s.id || e.ke === s.id).length))
}
sama('jumlah simpul sebenarnya tetap dilaporkan',
  susunJaringan(ARSIP, { maksSimpul: 2 }).total.simpul, penuh.total.simpul)

/* --------------------------------------------------------- 5. penjembatan */

console.log('5. Penjembatan')

{
  const jembatan = penjembatan(penuh, 5)
  periksa('menghasilkan daftar', jembatan.length > 0)
  periksa('terurut menurun', jembatan.every((s, i) => i === 0 || jembatan[i - 1].skorJembatan >= s.skorJembatan))
  periksa('setiap butir menyebut ragam jenis tetangganya',
    jembatan.every((s) => typeof s.ragamJenis === 'number' && s.ragamJenis > 0))

  // Detik menyentuh dua unit di dua wilayah; Banten Pos hanya satu unit.
  const detik = jembatan.find((s) => s.id === idSimpul('media', 'Detik'))
  const bantenPos = jembatan.find((s) => s.id === idSimpul('media', 'Banten Pos'))
  periksa('media yang menyeberang unit berskor lebih tinggi',
    detik && bantenPos && detik.skorJembatan > bantenPos.skorJembatan,
    `${detik?.skorJembatan} vs ${bantenPos?.skorJembatan}`)
}
sama('jaringan kosong tidak meledak',
  penjembatan(susunJaringan([]), 5).length, 0)

/* --------------------------------------------------------- 6. tata letak */

console.log('6. Tata letak')

{
  const f = idSimpul('unit', CILEGON)
  const j = susunJaringan(ARSIP, { fokus: f })
  const a = tataLingkar(j, { lebar: 720, tinggi: 520 })
  const b = tataLingkar(j, { lebar: 720, tinggi: 520 })

  // Janji nomor empat.
  const sama1 = [...a.letak.entries()].every(([id, p]) => {
    const q = b.letak.get(id)
    return q && q.x === p.x && q.y === p.y
  })
  periksa('tata letak sama persis pada pemanggilan kedua', sama1)

  const pusat = a.letak.get(f)
  sama('fokus berada tepat di tengah', `${pusat.x},${pusat.y}`, '360,260')
  sama('fokus berada di cincin nol', pusat.cincin, 0)

  periksa('setiap simpul mendapat tempat', j.simpul.every((s) => a.letak.has(s.id)))
  periksa('tidak ada simpul yang keluar bidang',
    [...a.letak.values()].every((p) => p.x >= 0 && p.x <= 720 && p.y >= 0 && p.y <= 520))
}

{
  const j = susunJaringan(ARSIP)
  const a = tataLingkar(j, { lebar: 600, tinggi: 600 })
  periksa('tanpa fokus seluruhnya di satu cincin',
    [...a.letak.values()].every((p) => p.cincin === 1))
  periksa('tanpa fokus pun setiap simpul mendapat tempat',
    j.simpul.every((s) => a.letak.has(s.id)))
  periksa('jenis yang sama duduk berdampingan', (() => {
    const urut = j.simpul
      .map((s) => ({ jenis: s.jenis, sudut: Math.atan2(a.letak.get(s.id).y - 300, a.letak.get(s.id).x - 300) }))
      .sort((x, y) => x.sudut - y.sudut)
    // Berapa kali jenis berganti sepanjang lingkaran. Bila jenis yang sama
    // benar-benar berdampingan, pergantiannya paling banyak sebanyak jenisnya.
    let ganti = 0
    for (let i = 1; i < urut.length; i += 1) if (urut[i].jenis !== urut[i - 1].jenis) ganti += 1
    return ganti <= JENIS_SIMPUL.length
  })())
}

sama('jaringan kosong menghasilkan tata letak kosong',
  tataLingkar(susunJaringan([])).letak.size, 0)

/* ----------------------------------------------------------------- akhir */

console.log(`\n  ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
