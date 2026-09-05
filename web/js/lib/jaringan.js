/**
 * Jaringan kaitan — siapa bertemu apa, dan seberapa sering.
 *
 * Seluruh halaman lain membaca arsip sebagai daftar: baris demi baris,
 * terurut waktu. Ada satu golongan pertanyaan yang tidak bisa dijawab daftar,
 * dan golongan itu justru yang paling sering ditanyakan di ruang analis:
 *
 *   Media mana yang mengangkat Cilegon, dan apa lagi yang mereka angkat?
 *   Tema apa yang muncul di banyak unit sekaligus?
 *   Unit mana yang selalu muncul bersama unit lain di berita yang sama?
 *
 * Berkas ini menyusun kaitan itu dari data yang sudah ada — tidak ada satu
 * kolom baru pun. Sebuah publikasi menautkan unitnya, medianya, temanya,
 * wilayahnya, dan platformnya; kaitan yang sama muncul berulang menjadi garis
 * yang lebih tebal.
 *
 * ## Yang TIDAK dikerjakan berkas ini
 *
 * Ia tidak menyusun jaringan akun perorangan, tidak menelusuri siapa membalas
 * siapa, dan tidak menyimpan satu pun pengenal orang. Daftar periksa
 * menyebutkan analisis jaringan sosial sebagai kemungkinan "bila kewenangan
 * dan sumber datanya memungkinkan" — dan sampai kewenangan itu dinyatakan
 * hitam di atas putih, simpul di sini hanya berupa lembaga, media, wilayah,
 * tema, dan platform. Menambahkan simpul orang menuntut dasar hukum, bukan
 * menuntut kode.
 *
 * ## Tata letak yang tidak bergoyang
 *
 * Tata letaknya melingkar dan **deterministik**: masukan yang sama selalu
 * menghasilkan gambar yang sama persis. Tata letak berbasis gaya tarik-menarik
 * lebih cantik dan salah untuk pekerjaan ini — analis yang membuka layar yang
 * sama dua kali harus melihat gambar yang sama, sebab yang ia cari adalah
 * perubahan pada datanya, bukan perubahan pada gambarnya.
 */

import { dasar } from './hitung.js'
import { ember } from './sentimen.js'
import { sumberAsli } from './peristiwa.js'
import { belumTerpetakan } from './unit-terpetakan.js'

/**
 * Jenis simpul.
 *
 * `bidang` menyebut nama bidang kueri yang membuka daftar di balik sebuah
 * simpul, sehingga menekan simpul di gambar mendarat pada daftar yang berjumlah
 * sama dengan angka pada simpulnya — janji yang sama dengan ubin dasbor.
 */
export const JENIS_SIMPUL = [
  { kode: 'unit', label: 'Unit', nada: 'aksen', ikon: 'peta', bidang: 'upt' },
  { kode: 'media', label: 'Media', nada: 'netral', ikon: 'berita', bidang: 'media' },
  { kode: 'tema', label: 'Tema isu', nada: 'sedang', ikon: 'kasus', bidang: 'subkategori' },
  { kode: 'wilayah', label: 'Wilayah', nada: 'rendah', ikon: 'peta', bidang: 'wilayah' },
  { kode: 'platform', label: 'Platform', nada: 'rendah', ikon: 'sinkron', bidang: 'platform' },
]

export function jenisSimpul(kode) {
  return JENIS_SIMPUL.find((j) => j.kode === kode) || JENIS_SIMPUL[JENIS_SIMPUL.length - 1]
}

/**
 * Pasangan jenis yang ditautkan sebuah publikasi.
 *
 * Sengaja bukan seluruh kombinasi. Tautan wilayah–platform dan
 * wilayah–tema tidak menerangkan apa pun yang belum diterangkan lewat
 * unitnya, dan setiap garis yang tidak menerangkan apa-apa mengurangi
 * keterbacaan seluruh gambar.
 */
const PASANGAN = [
  ['unit', 'media'],
  ['unit', 'tema'],
  ['unit', 'wilayah'],
  ['media', 'tema'],
  ['media', 'platform'],
]

const NILAI = {
  unit: (b) => (belumTerpetakan(b.nama_upt) ? null : b.nama_upt),
  media: (b) => sumberAsli(b) || b.media || null,
  tema: (b) => b.subkategori || null,
  wilayah: (b) => b.kanwil_asal || b.provinsi || null,
  platform: (b) => b.platform || null,
}

export function idSimpul(jenis, nama) {
  return `${jenis}:${nama}`
}

/* --------------------------------------------------------------- penyusun */

/**
 * Menyusun jaringan dari arsip.
 *
 * `fokus` membatasi gambar pada satu simpul beserta tetangganya. Tanpa fokus,
 * arsip nasional menghasilkan ribuan simpul — gambar yang benar dan tidak bisa
 * dibaca siapa pun. `kedalaman` 1 berarti tetangga langsung; 2 menambahkan
 * tetangga dari tetangga, dan di situlah pertanyaan "apa lagi yang mereka
 * angkat" terjawab.
 */
export function susunJaringan(berita = [], {
  fokus = null, kedalaman = 1, maksSimpul = 60, minBobot = 1,
  jenisAktif = JENIS_SIMPUL.map((j) => j.kode),
} = {}) {
  const aktif = new Set(jenisAktif)
  const simpul = new Map()
  const sisi = new Map()

  function catatSimpul(jenis, nama, b) {
    const id = idSimpul(jenis, nama)
    let s = simpul.get(id)
    if (!s) {
      s = { id, jenis, nama, bobot: 0, negatif: 0, mendesak: 0, tetangga: new Set() }
      simpul.set(id, s)
    }
    s.bobot += 1
    if (ember(b) === 'negatif') s.negatif += 1
    if (['Tinggi', 'Kritis'].includes(b.urgensi)) s.mendesak += 1
    return s
  }

  for (const b of dasar(berita)) {
    const nilai = {}
    for (const j of JENIS_SIMPUL) {
      if (!aktif.has(j.kode)) continue
      const n = NILAI[j.kode](b)
      if (n) nilai[j.kode] = n
    }

    for (const nama of Object.keys(nilai)) catatSimpul(nama, nilai[nama], b)

    for (const [a, z] of PASANGAN) {
      if (!nilai[a] || !nilai[z]) continue
      const kiri = idSimpul(a, nilai[a])
      const kanan = idSimpul(z, nilai[z])
      const kunci = `${kiri}→${kanan}`
      let e = sisi.get(kunci)
      if (!e) { e = { kunci, dari: kiri, ke: kanan, bobot: 0, negatif: 0 }; sisi.set(kunci, e) }
      e.bobot += 1
      if (ember(b) === 'negatif') e.negatif += 1
      simpul.get(kiri).tetangga.add(kanan)
      simpul.get(kanan).tetangga.add(kiri)
    }
  }

  let daftarSisi = [...sisi.values()].filter((e) => e.bobot >= minBobot)
  let daftarSimpul = [...simpul.values()]

  if (fokus && simpul.has(fokus)) {
    const terpilih = new Set([fokus])
    let batas = new Set([fokus])
    for (let d = 0; d < Math.max(1, kedalaman); d += 1) {
      const berikut = new Set()
      for (const id of batas) {
        for (const t of simpul.get(id)?.tetangga || []) {
          if (!terpilih.has(t)) { terpilih.add(t); berikut.add(t) }
        }
      }
      batas = berikut
      if (!batas.size) break
    }
    daftarSimpul = daftarSimpul.filter((s) => terpilih.has(s.id))
    daftarSisi = daftarSisi.filter((e) => terpilih.has(e.dari) && terpilih.has(e.ke))
  }

  /*
     Pemangkasan menurut bobot, bukan menurut urutan penemuan.

     Yang dibuang harus yang paling sedikit menerangkan. Memangkas menurut
     urutan penemuan akan membuang simpul besar hanya karena ia muncul di
     baris ke-dua ribu, dan yang membaca gambarnya tidak akan pernah tahu
     apa yang hilang.
  */
  daftarSimpul.sort((a, b) => (
    (a.id === fokus ? -1 : 0) - (b.id === fokus ? -1 : 0)
    || b.bobot - a.bobot
    || a.nama.localeCompare(b.nama)
  ))
  const dipakai = new Set(daftarSimpul.slice(0, maksSimpul).map((s) => s.id))
  const terpangkas = daftarSimpul.length - dipakai.size
  daftarSimpul = daftarSimpul.filter((s) => dipakai.has(s.id))
  daftarSisi = daftarSisi
    .filter((e) => dipakai.has(e.dari) && dipakai.has(e.ke))
    .sort((a, b) => b.bobot - a.bobot)

  // Derajat dihitung ULANG setelah pemangkasan. Simpul yang menyebut sepuluh
  // tetangga di dalam gambar yang hanya menunjukkan tiga sedang berbohong
  // tentang gambar yang sedang dilihat pembacanya.
  const derajat = new Map(daftarSimpul.map((s) => [s.id, 0]))
  for (const e of daftarSisi) {
    derajat.set(e.dari, derajat.get(e.dari) + 1)
    derajat.set(e.ke, derajat.get(e.ke) + 1)
  }
  for (const s of daftarSimpul) s.derajat = derajat.get(s.id) || 0

  return {
    fokus: fokus && dipakai.has(fokus) ? fokus : null,
    simpul: daftarSimpul,
    sisi: daftarSisi,
    terpangkas,
    total: { simpul: simpul.size, sisi: sisi.size },
  }
}

/**
 * Simpul yang paling banyak menjembatani.
 *
 * Diukur dengan **keragaman jenis tetangga**, bukan dengan sekadar jumlah
 * tetangga. Sebuah media yang mengangkat sepuluh unit di lima wilayah lebih
 * layak diperhatikan daripada media yang mengangkat sepuluh unit di satu
 * wilayah, dan jumlah tetangga tidak bisa membedakan keduanya.
 */
export function penjembatan(jaringan, maks = 6) {
  const jenisTetangga = new Map(jaringan.simpul.map((s) => [s.id, new Set()]))
  const petaJenis = new Map(jaringan.simpul.map((s) => [s.id, s.jenis]))

  for (const e of jaringan.sisi) {
    jenisTetangga.get(e.dari)?.add(`${petaJenis.get(e.ke)}:${e.ke}`)
    jenisTetangga.get(e.ke)?.add(`${petaJenis.get(e.dari)}:${e.dari}`)
  }

  return jaringan.simpul
    .map((s) => {
      const tetangga = jenisTetangga.get(s.id) || new Set()
      const ragamJenis = new Set([...tetangga].map((t) => t.split(':')[0])).size
      return { ...s, ragamJenis, skorJembatan: s.derajat * ragamJenis }
    })
    .filter((s) => s.skorJembatan > 0)
    .sort((a, b) => b.skorJembatan - a.skorJembatan || b.bobot - a.bobot)
    .slice(0, maks)
}

/* ------------------------------------------------------------- tata letak */

/**
 * Menempatkan simpul pada lingkaran sepusat.
 *
 * Fokus di tengah, tetangga langsung pada lingkaran pertama, sisanya pada
 * lingkaran kedua. Sudut ditentukan urutan bobot, bukan bilangan acak —
 * itulah yang membuat gambarnya sama setiap kali dibuka.
 *
 * Tanpa fokus, seluruh simpul ditempatkan pada satu lingkaran, dikelompokkan
 * menurut jenisnya, sehingga jenis yang sama duduk berdampingan dan garis
 * antarjenis terbaca sebagai berkas garis, bukan sebagai jaring kusut.
 */
export function tataLingkar(jaringan, { lebar = 720, tinggi = 520, pinggir = 60 } = {}) {
  const pusatX = lebar / 2
  const pusatY = tinggi / 2
  const jariMaks = Math.min(lebar, tinggi) / 2 - pinggir

  const letak = new Map()

  if (!jaringan.fokus) {
    const urut = [...jaringan.simpul].sort((a, b) => (
      JENIS_SIMPUL.findIndex((j) => j.kode === a.jenis) - JENIS_SIMPUL.findIndex((j) => j.kode === b.jenis)
      || b.bobot - a.bobot
      || a.nama.localeCompare(b.nama)
    ))
    urut.forEach((s, i) => {
      const sudut = (i / Math.max(1, urut.length)) * Math.PI * 2 - Math.PI / 2
      letak.set(s.id, {
        x: pusatX + Math.cos(sudut) * jariMaks,
        y: pusatY + Math.sin(sudut) * jariMaks,
        cincin: 1,
      })
    })
    return { letak, lebar, tinggi }
  }

  const tetanggaFokus = new Set()
  for (const e of jaringan.sisi) {
    if (e.dari === jaringan.fokus) tetanggaFokus.add(e.ke)
    if (e.ke === jaringan.fokus) tetanggaFokus.add(e.dari)
  }

  letak.set(jaringan.fokus, { x: pusatX, y: pusatY, cincin: 0 })

  const cincin = [
    jaringan.simpul.filter((s) => tetanggaFokus.has(s.id)),
    jaringan.simpul.filter((s) => s.id !== jaringan.fokus && !tetanggaFokus.has(s.id)),
  ]

  cincin.forEach((isi, n) => {
    const jari = jariMaks * (n === 0 ? 0.56 : 1)
    const urut = [...isi].sort((a, b) => b.bobot - a.bobot || a.nama.localeCompare(b.nama))
    urut.forEach((s, i) => {
      // Cincin kedua digeser setengah langkah supaya simpulnya tidak berbaris
      // tepat di belakang simpul cincin pertama dan tertutup garisnya.
      const geser = n === 0 ? 0 : 0.5
      const sudut = ((i + geser) / Math.max(1, urut.length)) * Math.PI * 2 - Math.PI / 2
      letak.set(s.id, { x: pusatX + Math.cos(sudut) * jari, y: pusatY + Math.sin(sudut) * jari, cincin: n + 1 })
    })
  })

  return { letak, lebar, tinggi }
}

export const META_JARINGAN = {
  versi: 'jaringan-v1.0',
  jenis: JENIS_SIMPUL.length,
  pasangan: PASANGAN.length,
}
