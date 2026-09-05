/**
 * Narasi — cerita yang lebih panjang daripada satu peristiwa.
 *
 * `lib/peristiwa.js` menjawab pertanyaan "berapa kejadian di balik seratus
 * artikel ini". Berkas ini menjawab pertanyaan berikutnya, yang tidak bisa
 * dijawab daftar kejadian: **cerita apa yang sedang berjalan tentang kami.**
 *
 * Bedanya nyata. Tiga pelarian di tiga lapas berbeda dalam dua pekan adalah
 * tiga peristiwa terpisah, dan pada daftar peristiwa ketiganya duduk berjauhan
 * di antara empat puluh baris lain. Sebagai narasi, ketiganya satu benda —
 * "pengamanan lapas lemah" — dan benda itulah yang dibaca publik, dikutip
 * anggota dewan, dan ditanyakan wartawan pada konferensi pers berikutnya.
 *
 * ## Bagaimana peristiwa dikelompokkan menjadi narasi
 *
 * Dua peristiwa satu narasi bila subkategorinya sama DAN salah satu berlaku:
 *
 *   - unitnya sama — cerita yang berulang di satu tempat, dan
 *   - unitnya berbeda — cerita nasional tentang satu jenis persoalan.
 *
 * Keduanya sengaja dipisahkan menjadi dua `lingkup`, bukan dilebur. Narasi
 * unit dijawab kepala unit; narasi nasional dijawab direktorat. Meleburnya
 * berarti menyerahkan pertanyaan yang salah kepada orang yang salah.
 *
 * ## Bentuk narasi
 *
 * Lima bentuk, dan urutan pemeriksaannya disengaja. **Berulang diperiksa lebih
 * dulu daripada menanjak dan mereda**, karena ia yang paling sulit dilihat
 * manusia: dua letupan yang dipisahkan sepekan sunyi tampak seperti dua
 * kejadian yang sudah selesai, padahal itu satu cerita yang belum padam.
 * Alasan yang sama dengan aturan "penumpukan pelan" di `peringatan-laju.js`.
 *
 * ## Narasi tandingan
 *
 * Setiap narasi negatif diperiksa: adakah suara lain pada tema dan unit yang
 * sama — publikasi positif, atau sikap resmi yang sudah dinyatakan unitnya.
 * Yang dicatat bukan penilaian bahwa institusi sudah aman, melainkan satu
 * fakta yang menentukan langkah berikutnya: apakah cerita ini sedang berjalan
 * SENDIRIAN. Cerita yang berjalan sendirian selama sepuluh hari adalah cerita
 * yang akan diingat dalam bentuk itu.
 */

import { dasar } from './hitung.js'
import { ember } from './sentimen.js'
import { kelompokkanPeristiwa, sumberAsli } from './peristiwa.js'
import { belumTerpetakan } from './unit-terpetakan.js'

const HARI = 86_400_000

/**
 * Angka penyetel, satu tempat.
 *
 * Yang paling menentukan hasilnya adalah `jedaSunyi`. Terlalu kecil, dan
 * setiap akhir pekan tanpa pemberitaan memecah satu cerita menjadi dua;
 * terlalu besar, dan dua cerita yang benar-benar terpisah sebulan dilaporkan
 * sebagai satu yang berulang. Lima hari dipilih karena siklus pemberitaan
 * daerah praktis berhenti dua hari tiap pekan, dan lima memberi ruang satu
 * akhir pekan panjang tanpa memecah cerita.
 */
export const ATUR = {
  /** Berapa hari ke belakang yang dibaca. */
  jendelaHari: 30,
  /** Jeda sunyi yang memisahkan dua letupan pada narasi berulang. */
  jedaSunyi: 5,
  /** Rentang minimum sebelum sebuah narasi boleh disebut bertahan. */
  bertahanHari: 7,
  /** Kelipatan yang membuat separuh terakhir disebut menanjak. */
  kelipatanMenanjak: 2,
  /** Sebuah narasi baru berdiri bila peristiwanya sekurangnya sebanyak ini. */
  minimumPeristiwa: 1,
  /** Narasi nasional menuntut sekurangnya sebanyak ini unit yang berbeda. */
  minimumUnitNasional: 2,
}

export const BENTUK = [
  {
    kode: 'menanjak',
    label: 'Menanjak',
    nada: 'kritis',
    keterangan: 'Separuh terakhir jendela membawa lebih banyak pemberitaan daripada separuh awalnya.',
  },
  {
    kode: 'berulang',
    label: 'Berulang',
    nada: 'tinggi',
    keterangan: 'Dua letupan atau lebih yang dipisahkan jeda sunyi — cerita yang tidak pernah benar-benar padam.',
  },
  {
    kode: 'bertahan',
    label: 'Bertahan',
    nada: 'sedang',
    keterangan: 'Mengalir terus tanpa jeda panjang selama sepekan atau lebih.',
  },
  {
    kode: 'mereda',
    label: 'Mereda',
    nada: 'positif',
    keterangan: 'Separuh terakhir jauh lebih sepi daripada separuh awalnya.',
  },
  {
    kode: 'sekali',
    label: 'Sekali muncul',
    nada: 'netral',
    keterangan: 'Belum menjadi cerita berjalan — satu letupan pendek.',
  },
]

export function bentukDari(kode) {
  return BENTUK.find((b) => b.kode === kode) || BENTUK[BENTUK.length - 1]
}

export function nadaBentuk(kode) { return bentukDari(kode).nada }
export function labelBentuk(kode) { return bentukDari(kode).label }

/* ------------------------------------------------------------------ bentuk */

/**
 * Menentukan bentuk sebuah narasi dari deret harinya.
 *
 * `hari` adalah daftar nomor hari (bilangan bulat) tempat narasi ini muncul,
 * boleh berulang — satu entri per publikasi. Bekerja atas nomor hari, bukan
 * atas tanggal, supaya dapat diuji tanpa bergantung pada hari menjalankannya.
 */
export function bentukNarasi(hari = [], atur = ATUR) {
  if (!hari.length) return 'sekali'

  const urut = [...hari].sort((a, b) => a - b)
  const mulai = urut[0]
  const akhir = urut[urut.length - 1]
  const rentang = akhir - mulai + 1

  if (urut.length === 1 || rentang <= 2) return 'sekali'

  // Berulang lebih dulu: dua letupan yang dipisahkan jeda sunyi adalah bentuk
  // yang paling sulit dilihat manusia, dan yang paling keliru bila terlewat.
  const unik = [...new Set(urut)]
  const adaJeda = unik.some((h, i) => i > 0 && h - unik[i - 1] > atur.jedaSunyi)
  if (adaJeda) return 'berulang'

  const tengah = mulai + rentang / 2
  const awal = urut.filter((h) => h < tengah).length
  const akhirnya = urut.length - awal

  if (akhirnya >= 2 && akhirnya >= awal * atur.kelipatanMenanjak) return 'menanjak'
  if (awal >= 2 && awal >= akhirnya * atur.kelipatanMenanjak) return 'mereda'
  if (rentang >= atur.bertahanHari) return 'bertahan'
  return 'sekali'
}

/* ---------------------------------------------------------------- penyusun */

function keHari(nilai) {
  const t = new Date(nilai).getTime()
  return Number.isFinite(t) ? Math.floor(t / HARI) : null
}

/** Kunci pengelompokan: tema ditambah unit, atau tema saja untuk yang nasional. */
function kunciNarasi(p) {
  const tema = p.subkategori_kode || p.subkategori || 'tanpa-tema'
  return belumTerpetakan(p.nama_upt) ? `${tema}|nasional` : `${tema}|${p.nama_upt}`
}

/**
 * Menyusun narasi dari arsip berita.
 *
 * Himpunan yang dibaca adalah himpunan dasar `lib/hitung.js`. Narasi yang
 * memuat baris tidak valid akan menyebut jumlah publikasi yang tidak bisa
 * ditemukan kembali di layar mana pun.
 */
export function susunNarasi(berita = [], { sekarang = new Date(), atur = ATUR } = {}) {
  const batas = sekarang.getTime() - atur.jendelaHari * HARI
  const dalamJendela = dasar(berita).filter((b) => {
    const t = new Date(b.tanggal_publikasi || b.created_at || 0).getTime()
    return Number.isFinite(t) && t >= batas
  })

  const peristiwa = kelompokkanPeristiwa(dalamJendela)
  const totalPublikasi = dalamJendela.length

  /*
     Dua lapis pengelompokan.

     Lapis pertama menyatukan peristiwa pada unit yang sama. Lapis kedua
     menyatukan sisa peristiwa satu tema yang tersebar di banyak unit menjadi
     narasi nasional. Urutannya penting: kalau nasional disusun lebih dulu,
     setiap cerita unit ikut terserap ke dalamnya dan kepala unit kehilangan
     satu-satunya layar yang menyebut namanya.
  */
  const perUnit = new Map()
  for (const p of peristiwa) {
    const kunci = kunciNarasi(p)
    if (!perUnit.has(kunci)) perUnit.set(kunci, [])
    perUnit.get(kunci).push(p)
  }

  const kelompok = []
  const sisaNasional = new Map()

  for (const [kunci, daftar] of perUnit) {
    const nasional = kunci.endsWith('|nasional')
    // Cerita yang hanya muncul sekali di satu unit belum berdiri sendiri; ia
    // lebih berarti sebagai sumbangan pada narasi nasional temanya.
    if (!nasional && daftar.length >= 2) {
      kelompok.push({ lingkup: 'unit', daftar })
      continue
    }
    const tema = kunci.split('|')[0]
    if (!sisaNasional.has(tema)) sisaNasional.set(tema, [])
    sisaNasional.get(tema).push(...daftar)
  }

  for (const daftar of sisaNasional.values()) {
    const unit = new Set(daftar.map((p) => p.nama_upt).filter((u) => !belumTerpetakan(u)))
    const layak = daftar.length >= atur.minimumPeristiwa
      && (unit.size >= atur.minimumUnitNasional || daftar.length >= 2)
    kelompok.push({ lingkup: layak ? 'nasional' : 'tunggal', daftar })
  }

  return kelompok
    .map((k) => susunSatu(k, { totalPublikasi, atur }))
    .sort((a, b) => b.bobot - a.bobot)
}

function susunSatu({ lingkup, daftar }, { totalPublikasi, atur }) {
  const publikasi = daftar.flatMap((p) => p.publikasi)
  const hari = publikasi.map((b) => keHari(b.tanggal_publikasi || b.created_at)).filter((h) => h !== null)

  const unit = [...new Set(daftar.map((p) => p.nama_upt).filter((u) => !belumTerpetakan(u)))]
  const provinsi = [...new Set(daftar.map((p) => p.provinsi).filter(Boolean))]
  const media = [...new Set(publikasi.map(sumberAsli).filter(Boolean))]
  const platform = [...new Set(publikasi.map((b) => b.platform).filter(Boolean))]

  const negatif = publikasi.filter((b) => ember(b) === 'negatif')
  const positif = publikasi.filter((b) => ember(b) === 'positif')
  const ditanggapi = publikasi.filter((b) => Boolean(b.tanggapan_sikap))

  const berurut = [...publikasi].sort((a, b) => String(a.tanggal_publikasi || a.created_at || '')
    .localeCompare(String(b.tanggal_publikasi || b.created_at || '')))
  const pertama = berurut[0]
  const terakhir = berurut[berurut.length - 1]

  const deret = deretHarian(hari)
  const puncak = deret.reduce((t, d) => (d.jumlah > t.jumlah ? d : t), { hari: 0, jumlah: 0 })

  const bentuk = bentukNarasi(hari, atur)
  const teratas = daftar.slice().sort((a, b) => b.jumlah_publikasi - a.jumlah_publikasi)[0]

  /*
     Bobot menentukan urutan di layar, bukan tingkat bahaya.

     Keragaman media dihitung dua kali lipat jumlah publikasi. Sepuluh artikel
     dari satu media adalah satu redaksi yang tekun; sepuluh artikel dari
     sepuluh media adalah cerita yang sudah menyeberang, dan yang kedua jauh
     lebih sulit dihentikan.
  */
  const bobot = publikasi.length + media.length * 2 + negatif.length + (bentuk === 'menanjak' ? 6 : 0)

  return {
    id: `n-${(teratas?.subkategori_kode || 'x')}-${lingkup}-${(unit[0] || 'nasional').slice(0, 24)}`,
    lingkup,
    tema: teratas?.subkategori || 'Belum Dikelompokkan',
    tema_kode: teratas?.subkategori_kode || '',
    kategori: teratas?.kategori || 'Lainnya',
    judul: teratas?.judul || pertama?.judul || 'Tanpa judul',
    nama_upt: lingkup === 'unit' ? (unit[0] || null) : null,
    unit,
    provinsi,
    peristiwa: daftar,
    jumlah_peristiwa: daftar.length,
    publikasi,
    jumlah_publikasi: publikasi.length,
    daftar_media: media,
    jumlah_media: media.length,
    platform,
    lintas_platform: platform.length >= 2,
    negatif: negatif.length,
    positif: positif.length,
    bentuk,
    deret,
    puncak,
    mulai: pertama?.tanggal_publikasi || pertama?.created_at || null,
    akhir: terakhir?.tanggal_publikasi || terakhir?.created_at || null,
    rentang_hari: hari.length ? Math.max(...hari) - Math.min(...hari) + 1 : 0,
    pangsa: totalPublikasi ? publikasi.length / totalPublikasi : 0,
    /** Siapa yang memantik. Bukan tuduhan — hanya yang tercatat paling awal. */
    pemantik: pertama
      ? { media: sumberAsli(pertama) || pertama.media, tanggal: pertama.tanggal_publikasi || pertama.created_at, judul: pertama.judul }
      : null,
    /**
     * Suara lain pada tema dan unit yang sama. `sendirian` adalah bidang yang
     * paling sering dibaca: narasi negatif tanpa satu pun suara lain selama
     * sepekan adalah cerita yang sedang mengeras.
     */
    tandingan: {
      publikasi: positif.length,
      tanggapan: ditanggapi.length,
      ada: positif.length > 0 || ditanggapi.length > 0,
      sendirian: negatif.length > 0 && positif.length === 0 && ditanggapi.length === 0,
    },
    bobot,
  }
}

/** Deret jumlah publikasi per hari, tanpa lubang, untuk bagan garis kecil. */
function deretHarian(hari = []) {
  if (!hari.length) return []
  const mulai = Math.min(...hari)
  const akhir = Math.max(...hari)
  const hitung = new Map()
  for (const h of hari) hitung.set(h, (hitung.get(h) || 0) + 1)
  const keluar = []
  for (let h = mulai; h <= akhir; h += 1) keluar.push({ hari: h, jumlah: hitung.get(h) || 0 })
  return keluar
}

/* ------------------------------------------------------------------ rekap */

/**
 * Ringkasan satu baris untuk kepala halaman.
 *
 * `dominan` adalah narasi berpangsa terbesar, dan hanya disebut bila pangsanya
 * melewati seperlima. Menyebut "narasi dominan" untuk cerita berpangsa tiga
 * persen adalah menamai sesuatu yang tidak dominan, dan nama itu akan dikutip
 * di rapat.
 */
export function rekapNarasi(daftar = []) {
  const perBentuk = Object.fromEntries(BENTUK.map((b) => [b.kode, 0]))
  for (const n of daftar) perBentuk[n.bentuk] += 1

  const berpangsa = [...daftar].sort((a, b) => b.pangsa - a.pangsa)[0]

  return {
    jumlah: daftar.length,
    perBentuk,
    menanjak: perBentuk.menanjak,
    berulang: perBentuk.berulang,
    nasional: daftar.filter((n) => n.lingkup === 'nasional').length,
    unit: daftar.filter((n) => n.lingkup === 'unit').length,
    sendirian: daftar.filter((n) => n.tandingan.sendirian).length,
    lintasPlatform: daftar.filter((n) => n.lintas_platform).length,
    dominan: berpangsa && berpangsa.pangsa >= 0.2 ? berpangsa : null,
  }
}

export const META_NARASI = { versi: 'narasi-v1.0', bentuk: BENTUK.length, atur: ATUR }
