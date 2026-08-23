/**
 * Mesin klasifikasi berita Cyber-Intelpas.
 *
 * ---------------------------------------------------------------------------
 * Versi 4 — mesin mulai membaca penerbit, bukan hanya teks
 * ---------------------------------------------------------------------------
 *
 * Pemeriksaan atas arsip menemukan bahwa 159 dari 653 publikasi — hampir satu
 * dari empat — tidak menghasilkan keterangan apa pun. Tujuh puluh empat jatuh
 * ke "Lainnya" dengan keyakinan 0,20, dan delapan puluh lima dibuang sebagai
 * di luar lingkup. Ketika dibaca satu per satu, ternyata sebagian besarnya
 * adalah publikasi kehumasan unit pelaksana teknis sendiri.
 *
 * Empat sebab, dan keempatnya diperbaiki di versi ini:
 *
 *   1. Pola tekstual tidak pernah dijalankan. Seluruh blok pola berada di balik
 *      penjagaan "hanya bila sudah ada kata kunci yang cocok", sehingga pola
 *      hanya berlaku pada berita yang justru paling tidak membutuhkannya.
 *      "Kapasitas 71 Orang, Rutan Negara Kini Dihuni 213 Warga Binaan" punya
 *      polanya sendiri, cocok sempurna, dan tetap berskor nol.
 *
 *   2. Penerbit tidak pernah dibaca. Sebuah unggahan dari kanal "Rutan
 *      Boyolali" atau "Humas Lapas Pasir Pangarayan" adalah publikasi kehumasan
 *      unit itu — pertanyaannya tinggal kegiatan apa, bukan termasuk apa.
 *      Mesin lama hanya membaca judulnya, dan judul unggahan kehumasan memang
 *      tidak ditulis dengan kata kunci.
 *
 *   3. Gerbang relevansi membuang terbitan resmi. Judul "Sehat Bersama, Peduli
 *      Bersama" tidak menyebut nama unit mana pun, karena nama unitnya sudah
 *      tertulis pada kanal yang menerbitkannya. Mesin lama membuangnya sebagai
 *      konten tidak relevan.
 *
 *   4. Bantahan yang menggeser kandidat lain ikut terbuang bersamanya. Pelarian
 *      menang dengan 4,23 dan lolos ambang; bantahan naik ke puncak dengan
 *      2,43 dan tidak lolos; keduanya sama-sama hilang.
 *
 * Yang tetap dijaga: tidak ada penyedia AI luar yang dipanggil, tidak ada
 * kunci yang dikirim ke mana pun, dan seluruh keputusan tetap bisa dijelaskan
 * kalimat per kalimat kepada analis yang menelaahnya.
 *
 * ---------------------------------------------------------------------------
 * Warisan versi 3 yang tetap berlaku
 * ---------------------------------------------------------------------------
 *
 *   Pencocokan kata kini menghormati batas kata dan bentuk imbuhan. Dulu kata
 *   kunci "sabu" ikut cocok pada "pembuatan sabun", sementara "penganiayaan"
 *   tidak pernah cocok pada "dianiaya". Dua-duanya sudah tidak terjadi lagi;
 *   dasarnya ada di teks.js.
 *
 *   Ada gerbang relevansi di depan. Rutan KPK dan Rutan Bareskrim bukan unit
 *   Pemasyarakatan, dan unggahan berbahasa Hindi yang memuat kata "bapas" bukan
 *   berita. Keduanya kini punya kategorinya sendiri dan tidak lagi ikut dihitung
 *   sebagai publikasi terpantau.
 *
 *   Konteks kehumasan dikenali. Sebagian besar publikasi harian adalah unggahan
 *   resmi UPT. Ketika mesin melihat ciri unggahan semacam itu dan tidak
 *   menemukan satu pun indikasi negatif, ambang untuk kategori positif
 *   diturunkan — sebab kegiatan seremonial memang jarang memakai kata kunci yang
 *   tegas.
 *
 *   Bantahan dipisahkan dari peristiwanya. "Bukan kabur, Rutan Muntok sebut yang
 *   bersangkutan sedang menjalani asimilasi" bukan berita pelarian, melainkan
 *   berita klarifikasi. Dulu mesin membacanya sebagai pelarian dan menaikkan
 *   angka insiden tanpa ada insiden.
 *
 * Warisan yang tetap dipertahankan dari versi sebelumnya: seluruh subkategori
 * diberi skor lalu yang tertinggi menang, pelaku dideteksi terpisah supaya
 * perbuatan petugas tidak tertukar dengan perbuatan warga binaan, frasa pembalik
 * dikenali, dan keyakinan dihitung dari selisih skor juara terhadap pesaing
 * terdekatnya sehingga angkanya berarti sesuatu bagi analis.
 *
 * Modul ES murni. Dipakai di peramban dan di Edge Function tanpa perubahan.
 */

import {
  KATEGORI,
  KATEGORI_LAINNYA,
  KATEGORI_LUAR_LINGKUP,
  SEMUA_SUBKATEGORI,
  PENANDA_AKTOR,
  PENANDA_LEMBAGA_LAIN,
  PENANDA_KEHUMASAN,
  JANGKAR_PEMASYARAKATAN,
  JANGKAR_KUAT,
  KATA_FUNGSI_INDONESIA,
  FRASA_PEMBALIK,
  FRASA_BANTAHAN,
  PEMICU_KRITIS,
  PERINGKAT_URGENSI,
} from './taksonomi.js'

import { bersihkanTeks, normalkan, siapkanKonteks, hitungFrasa, yangMuncul } from './teks.js'
import { kenaliPenerbit } from './penerbit.js'

const VERSI_MESIN = 'aturan-v4.0'

/** Ambang skor minimum sebelum sebuah berita boleh keluar dari "Lainnya". */
const AMBANG_SKOR = 3.0

/**
 * Ambang khusus kategori positif ketika teks jelas berupa unggahan humas UPT.
 * Kegiatan seremonial memang jarang memakai kata yang tegas; menuntut skor
 * setinggi berita insiden akan membuang ratusan publikasi positif setiap bulan.
 */
const AMBANG_HUMAS = 2.0

/** Panjang minimum teks yang masih layak dinilai. */
const PANJANG_MINIMUM = 8

export { bersihkanTeks, normalkan }

/* ------------------------------------------------------------ deteksi pelaku */

/**
 * Mendeteksi pelaku yang disebut dalam teks.
 * @returns {{petugas:number, wbp:number, eksternal:number, dominan:string|null}}
 */
export function deteksiAktor(konteks) {
  const skor = { petugas: 0, wbp: 0, eksternal: 0 }

  for (const [aktor, penanda] of Object.entries(PENANDA_AKTOR)) {
    for (const kata of penanda) {
      const n = hitungFrasa(konteks, kata)
      if (!n) continue
      // Frasa "oknum ..." adalah penanda paling tegas dalam bahasa pemberitaan
      // Indonesia; nyaris selalu merujuk aparat yang diduga melanggar.
      const bobot = kata.startsWith('oknum') ? 3 : kata.length > 10 ? 2 : 1
      skor[aktor] += n * bobot
    }
  }

  const urut = Object.entries(skor).sort((a, b) => b[1] - a[1])
  const dominan = urut[0][1] > 0 && urut[0][1] > urut[1][1] ? urut[0][0] : null
  return { ...skor, dominan }
}

/** Benar bila teks memuat frasa yang menempatkan petugas sebagai penindak. */
export function adaFrasaPembalik(konteks) {
  for (const f of FRASA_PEMBALIK) if (hitungFrasa(konteks, f, 1)) return true
  return false
}

/** Benar bila teks berisi bantahan atau klarifikasi atas sebuah isu. */
export function adaBantahan(konteks) {
  for (const f of FRASA_BANTAHAN) if (hitungFrasa(konteks, f, 1)) return true
  return false
}

/** Benar bila teks berciri unggahan resmi humas unit pelaksana teknis. */
export function adaKonteksHumas(konteks) {
  let nilai = 0
  for (const p of PENANDA_KEHUMASAN) {
    if (hitungFrasa(konteks, p, 1)) nilai += 1
    if (nilai >= 2) return true
  }
  return false
}

/* ------------------------------------------------------- gerbang relevansi */

/**
 * Memutuskan apakah sebuah berita memang urusan Pemasyarakatan.
 *
 * Tiga kemungkinan jawaban:
 *   { lolos: true }                       lanjutkan penilaian
 *   { lolos: false, kode: '9.1', ... }    unit milik lembaga lain
 *   { lolos: false, kode: '9.2', ... }    bukan berita, atau bukan bahasa kita
 */
export function periksaRelevansi(konteks, penerbit = null) {
  const lembagaLain = yangMuncul(konteks, PENANDA_LEMBAGA_LAIN)
  if (lembagaLain.length) {
    return {
      lolos: false,
      kode: '9.1',
      alasan: `Teks menyebut ${lembagaLain[0]}, yaitu fasilitas penahanan milik lembaga di luar Ditjen Pemasyarakatan.`,
    }
  }

  const jangkar = yangMuncul(konteks, JANGKAR_PEMASYARAKATAN)
  if (jangkar.length) return { lolos: true, jangkar }

  // Penerbit adalah jangkar, dan sebelum ini ia tidak pernah dibaca.
  //
  // Akibatnya terlihat pada 56 publikasi yang dibuang sebagai "konten tidak
  // relevan": separuhnya adalah unggahan kanal resmi UPT sendiri yang judulnya
  // memang tidak menyebut nama unit — "Sehat Bersama, Peduli Bersama",
  // "PASTI BANGKIT", "Daily Inspection, Minggu 16 Agustus". Judul semacam itu
  // tidak perlu menyebut unitnya, sebab nama unitnya sudah tertulis di kanal
  // yang menerbitkannya. Membuangnya berarti membuang justru publikasi yang
  // paling pasti asalnya.
  if (penerbit?.resmi) {
    return { lolos: true, jangkar: [penerbit.akun], dariPenerbit: true }
  }

  return {
    lolos: false,
    kode: '9.2',
    alasan: 'Tidak ada satu pun penyebutan Lapas, Rutan, Bapas, warga binaan, atau Pemasyarakatan, '
      + 'dan penerbitnya bukan akun resmi unit Pemasyarakatan.',
  }
}

/**
 * Pemeriksaan lanjutan yang hanya dijalankan setelah mesin gagal menemukan
 * apa pun.
 *
 * Urutan ini penting dan pernah salah. Ketika pemeriksaan bahasa dijalankan di
 * depan, judul "LAPAS SEMARANG GAGALKAN PENYELUNDUPAN NARKOBA LEWAT LEMPARAN
 * TEMBOK" ikut terbuang — kata penghubungnya kebetulan tidak ada di daftar,
 * padahal isinya justru laporan pengamanan yang berhasil. Sekarang berita yang
 * kata kuncinya berbicara tidak pernah lagi ditanya soal bahasa.
 */
/**
 * Nama unit yang lengkap dengan penanda kelasnya.
 *
 * "Rutan Kelas 1 Jakarta Pusat" dan "Lapas Perempuan Bandung" adalah nama
 * lembaga Indonesia, dan tidak ada bahasa lain yang kebetulan menyusun kata
 * dalam urutan itu. Satu kecocokan sudah cukup membuktikan teksnya berbahasa
 * Indonesia dan berbicara tentang sebuah unit — tanpa perlu menunggu ada kata
 * penghubung yang kebetulan ada di dalam daftar.
 */
const POLA_NAMA_UNIT =
  /\b(lapas|rutan|bapas|lpka|lpp)\s+(kelas|perempuan|narkotika|pemuda|terbuka|khusus|anak)\b/

export function periksaKebisingan(konteks) {
  // Kata "lapas" dan "bapas" muncul juga pada unggahan berbahasa Hindi dan
  // Spanyol. Bila hanya itu jangkarnya, tidak ada satu pun kata penghubung
  // bahasa Indonesia, dan mesin tidak menemukan kata kunci apa pun, teksnya
  // hampir pasti bukan berita Indonesia.
  if (yangMuncul(konteks, JANGKAR_KUAT).length) return null
  if (POLA_NAMA_UNIT.test(konteks.teks)) return null
  if (yangMuncul(konteks, KATA_FUNGSI_INDONESIA).length) return null

  return {
    kode: '9.2',
    alasan:
      'Kata "lapas" atau "bapas" muncul tanpa satu pun kata bahasa Indonesia lain dan tanpa kata kunci isu apa pun.',
  }
}

/* --------------------------------------------------------------- penilaian */

/**
 * Pengali kecocokan pelaku. Subkategori yang menuntut pelaku tertentu
 * dinaikkan ketika pelakunya memang disebut, dan diturunkan ketika teks justru
 * menyebut pelaku yang berlawanan.
 */
function pengaliAktor(sub, aktor) {
  if (!sub.aktor || sub.aktor === 'campuran' || sub.aktor === 'sistem') return 1

  if (sub.aktor === 'petugas') {
    if (aktor.petugas > 0 && aktor.petugas >= aktor.wbp) return 1.6
    if (aktor.petugas > 0) return 1.15
    // Pelaku tidak disebut sama sekali bukan alasan membuang kandidat; yang
    // layak dihukum berat hanyalah teks yang justru menunjuk pelaku lain.
    return aktor.wbp > 0 ? 0.45 : 0.85
  }

  if (sub.aktor === 'wbp') {
    if (aktor.wbp > 0 && aktor.wbp >= aktor.petugas) return 1.4
    if (aktor.wbp > 0) return 1.1
    return aktor.petugas > 0 ? 0.65 : 0.9
  }

  if (sub.aktor === 'eksternal') {
    if (aktor.eksternal > 0) return 1.5
    return 0.9
  }

  return 1
}

function labelKunci(kunci) {
  return Array.isArray(kunci) ? kunci.join(' + ') : kunci
}

/** Menilai satu butir kunci: frasa tunggal, atau larik istilah yang semuanya harus ada. */
function nilaiKunci(konteks, kunci) {
  if (Array.isArray(kunci)) {
    let terkecil = Infinity
    for (const istilah of kunci) {
      const n = hitungFrasa(konteks, istilah)
      if (!n) return 0
      terkecil = Math.min(terkecil, n)
    }
    return terkecil === Infinity ? 0 : terkecil
  }
  return hitungFrasa(konteks, kunci)
}

/**
 * Memberi skor pada seluruh subkategori.
 * @returns {Array<{sub:object, skor:number, cocok:string[]}>} urut menurun
 */
export function skorSubkategori(konteks, aktor, konteksHumas) {
  const hasil = []

  for (const sub of SEMUA_SUBKATEGORI) {
    let skor = 0
    const cocok = []

    let adaPositif = false
    for (const [kata, bobot] of sub.kunci) {
      if (!bobot) continue
      const n = nilaiKunci(konteks, kata)
      if (!n) continue
      // Kemunculan kedua dan ketiga bernilai lebih kecil, supaya satu kata yang
      // diulang-ulang tidak mengalahkan tiga kata kunci berbeda.
      skor += bobot * (1 + (n - 1) * 0.35)
      // Frasa berbobot negatif membatalkan, jadi ia bukan "kata kunci penentu"
      // dan tidak layak ditampilkan sebagai alasan.
      if (bobot > 0) { cocok.push(labelKunci(kata)); adaPositif = true }
    }

    // Pola tekstual dinilai tanpa menunggu ada kata kunci yang cocok lebih dulu.
    //
    // Sebelum ini seluruh blok pola berada di balik `if (!adaPositif) continue`,
    // sehingga pola hanya pernah dijalankan pada berita yang sudah tertangkap
    // kata kunci — yaitu justru berita yang paling tidak membutuhkannya. Pola
    // ditulis untuk menangkap yang tidak bisa ditangkap kata kunci, dan
    // menggantungkannya pada kata kunci membuat seluruhnya tidak berguna.
    //
    // Akibatnya nyata: "Kapasitas 71 Orang, Rutan Negara Kini Dihuni 213 Warga
    // Binaan" memiliki polanya sendiri di 4.2, cocok sempurna, dan tetap jatuh
    // ke "Lainnya" dengan skor nol — karena tidak ada satu pun kata kunci
    // overkapasitas yang muncul secara harfiah di judul itu.
    for (const [pola, bobot] of sub.pola) {
      if (!pola.test(konteks.teks)) continue
      skor += bobot
      cocok.push('pola tekstual')
      if (bobot > 0) adaPositif = true
    }

    if (!adaPositif) continue
    if (skor <= 0) continue

    skor *= pengaliAktor(sub, aktor)

    // Unggahan humas yang jelas memberi sedikit dorongan pada kategori positif.
    // Nilainya kecil dengan sengaja: yang menentukan tetap kata kuncinya.
    if (konteksHumas && sub.sifat === 'positif') skor *= 1.2

    hasil.push({ sub, skor: Number(skor.toFixed(3)), cocok })
  }

  return hasil.sort((a, b) => b.skor - a.skor)
}

/* ------------------------------------------------------- sentimen & urgensi */

const PENANDA_POSITIF = [
  'berhasil', 'prestasi', 'penghargaan', 'inovasi', 'apresiasi', 'meraih',
  'sukses', 'lancar', 'kondusif', 'meningkat', 'terbaik', 'juara',
  'digagalkan', 'menggagalkan', 'terkendali', 'nihil', 'meriah', 'khidmat',
  'semangat', 'kebersamaan', 'gratis', 'peduli', 'sinergi', 'komitmen',
  'selamat', 'bangga', 'harmonis', 'produktif', 'mandiri',
]

const PENANDA_NEGATIF = [
  'kabur', 'tewas', 'meninggal', 'kerusuhan', 'kebakaran', 'pungli',
  'kekerasan', 'pelanggaran', 'korupsi', 'pemerasan', 'suap', 'dianiaya',
  'diselundupkan', 'ilegal', 'dikeluhkan', 'protes', 'menuntut', 'disorot',
  'lemah', 'lalai', 'kelalaian', 'buron', 'overkapasitas', 'penyiksaan',
  'penembakan', 'pembiaran', 'memprihatinkan', 'dicopot', 'tersangka',
]

/**
 * Menurunkan sentimen. Sifat kategori menjadi dasar, lalu disesuaikan oleh
 * penanda eksplisit dalam teks.
 */
export function tentukanSentimen(konteks, sub, adaPembalik) {
  const positif = yangMuncul(konteks, PENANDA_POSITIF).length
  const negatif = yangMuncul(konteks, PENANDA_NEGATIF).length

  if (!sub) {
    if (negatif > positif) return 'Negatif'
    if (positif > negatif) return 'Positif'
    return 'Netral'
  }

  if (sub.sifat === 'positif') return negatif > positif + 1 ? 'Campuran' : 'Positif'

  // Ancaman eksternal yang digagalkan petugas bukan sentimen negatif murni:
  // kejadiannya buruk, penanganannya baik. Berlaku juga untuk penyelundupan
  // yang berhasil dicegah, yang justru menunjukkan pengamanan bekerja.
  if (adaPembalik && (sub.kategoriKode === '6' || sub.kode === '8.5')) return 'Campuran'

  // Bantahan dan klarifikasi adalah tindakan pengelolaan isu, bukan insiden.
  if (sub.kode === '7.1') return negatif > positif + 1 ? 'Negatif' : 'Netral'

  if (sub.sifat === 'negatif') return positif > negatif + 2 ? 'Campuran' : 'Negatif'
  return 'Netral'
}

/**
 * Menurunkan urgensi. Nilai dasar berasal dari subkategori, lalu dinaikkan
 * bila ada pemicu kritis, dan diturunkan bila kejadiannya sudah digagalkan.
 */
export function tentukanUrgensi(konteks, sub, adaPembalik, risikoCrawler) {
  let urgensi = sub ? sub.urgensi : 'Rendah'

  // Panduan Dirpamintel hanya mengenal tiga tingkat: Tinggi, Sedang, Rendah.
  // Basis data memiliki satu tingkat lagi di atasnya, dan tingkat itu sengaja
  // dijaga tetap langka. "Kritis" berarti kejadian sedang berlangsung dan
  // menyangkut banyak nyawa sekaligus — kerusuhan massal, kebakaran dengan
  // evakuasi, penyanderaan, pelarian berkelompok, penyerangan dari luar.
  // Kalau nilai ini diobral, ia berhenti berarti apa-apa bagi pimpinan.
  const SUB_BOLEH_KRITIS = new Set(['1.1', '1.2', '3.3', '4.1', '4.3', '5.1', '6.2'])
  const pemicu = yangMuncul(konteks, PEMICU_KRITIS)

  if (sub && SUB_BOLEH_KRITIS.has(sub.kode)) {
    const massal =
      /(massal|berjamaah|serentak|puluhan|ratusan|napiter|terorisme|penyanderaan|sandera|evakuasi|dievakuasi)/.test(
        konteks.teks,
      ) ||
      /\b([3-9]|\d{2,})\s*(orang|napi|narapidana|tahanan|warga binaan)\b[^.]{0,40}\bkabur\b/.test(konteks.teks)

    if (massal && pemicu.length >= 1) urgensi = 'Kritis'
    else if (pemicu.length >= 3) urgensi = 'Kritis'
  }

  if (adaPembalik && PERINGKAT_URGENSI[urgensi] > 2) {
    // Sudah tertangani. Tetap dilaporkan, tetapi bukan lagi respons segera.
    urgensi = 'Sedang'
  }

  // Penilaian crawler dipakai sebagai lantai, bukan sebagai penentu. Kalau
  // mesin sendiri menilai lebih tinggi, penilaian mesin yang dipakai.
  const lantai = { RENDAH: 'Rendah', SEDANG: 'Sedang', TINGGI: 'Tinggi', KRITIS: 'Kritis' }[
    String(risikoCrawler ?? '').trim().toUpperCase()
  ]
  if (lantai && PERINGKAT_URGENSI[lantai] > PERINGKAT_URGENSI[urgensi]) {
    // Hanya untuk berita yang mesin sendiri tidak yakin. Kalau mesin sudah
    // menemukan kategori kuat, penilaian crawler yang generik tidak menang.
    if (!sub || sub.kategoriKode === '0') urgensi = lantai
  }

  return urgensi
}

/** Tingkat perhatian untuk penanda peta dan antrean telaah. */
export function tentukanPerhatian(urgensi, sentimen) {
  if (PERINGKAT_URGENSI[urgensi] >= 3) return 'Tinggi'
  if (urgensi === 'Sedang' || sentimen === 'Negatif') return 'Sedang'
  return 'Rendah'
}

/* ------------------------------------------------------------- pintu utama */

/**
 * Mengklasifikasi satu berita.
 *
 * @param {object} berita
 * @param {string} [berita.judul]
 * @param {string} [berita.ringkasan]
 * @param {string} [berita.caption_manual]
 * @param {string} [berita.raw_analysis]
 * @param {string} [berita.media]
 * @param {string} [berita.urgensi] penilaian risiko dari crawler
 * @returns {object} hasil klasifikasi lengkap dengan jejak alasannya
 */
export function klasifikasikan(berita = {}) {
  const judul = bersihkanTeks(berita.judul)
  const ringkasan = bersihkanTeks(berita.ringkasan)
  const tambahan = bersihkanTeks(berita.caption_manual || berita.raw_analysis)

  // Judul diberi bobot ganda karena di sanalah inti peristiwa berada, sedangkan
  // ringkasan hasil crawl sering berisi kalimat generik yang sama untuk semua.
  const gabungan = [judul, judul, ringkasan, tambahan].filter(Boolean).join(' . ')
  const teksNormal = normalkan(gabungan)

  if (!teksNormal || teksNormal.length < PANJANG_MINIMUM) {
    return hasilKosong('Teks terlalu pendek untuk dinilai')
  }

  const konteks = siapkanKonteks(teksNormal)

  // Penerbit dikenali lebih dulu, sebab gerbang relevansi membutuhkannya.
  const penerbit = kenaliPenerbit(berita, teksNormal)

  const relevansi = periksaRelevansi(konteks, penerbit)
  if (!relevansi.lolos) return hasilLuarLingkup(relevansi.kode, relevansi.alasan)

  const aktor = deteksiAktor(konteks)
  const pembalik = adaFrasaPembalik(konteks)
  const bantahan = adaBantahan(konteks)
  const konteksHumas = adaKonteksHumas(konteks)

  let peringkat = skorSubkategori(konteks, aktor, konteksHumas || penerbit.resmi)

  // Bantahan mengalahkan peristiwa yang dibantahnya. Berita "Bukan kabur, Rutan
  // Muntok sebut yang bersangkutan menjalani asimilasi" tidak boleh menambah
  // satu angka pun pada hitungan pelarian.
  //
  // Skor yang digeser ikut dicatat. Tanpa itu, penggeseran ini justru membuang
  // beritanya: pelarian menang dengan 4,23 dan lolos ambang, bantahan naik ke
  // puncak dengan 2,43 dan tidak lolos, lalu keduanya sama-sama hilang ke
  // "Lainnya". Padahal yang berubah hanyalah nama peristiwanya — bahwa ini
  // berita bermuatan tetap sudah terbukti oleh skor yang digeser tadi.
  let skorTergeser = 0
  if (bantahan) {
    const hoaks = peringkat.find((p) => p.sub.kode === '7.1')
    if (hoaks && peringkat[0] && peringkat[0].sub.kode !== '7.1') {
      const juaraLain = peringkat[0].skor
      if (hoaks.skor >= juaraLain * 0.5) {
        skorTergeser = juaraLain
        peringkat = [hoaks, ...peringkat.filter((p) => p !== hoaks)]
      }
    }
  }

  const juara = peringkat[0]

  // Ambang turun ketika penerbitnya sudah pasti institusi, bukan hanya ketika
  // teksnya berciri kehumasan. Keduanya tidak sama kuat: ciri teks adalah
  // dugaan, sedangkan penerbit adalah keterangan.
  const humasKuat = konteksHumas || penerbit.resmi
  let ambang = juara && juara.sub.sifat === 'positif' && humasKuat ? AMBANG_HUMAS : AMBANG_SKOR

  // Bantahan yang menggeser kandidat yang sudah lolos ambang mewarisi kelolosan
  // itu. Yang diperiksa ambang adalah "apakah teks ini bermuatan", dan
  // pertanyaan itu sudah dijawab oleh kandidat yang digeser.
  if (skorTergeser >= AMBANG_SKOR && juara?.sub.kode === '7.1') ambang = 0

  if (!juara || juara.skor < ambang) {
    // Pemeriksaan kebisingan hanya berlaku untuk publikasi yang penerbitnya
    // tidak diketahui. Menanyakan "apakah ini benar berbahasa Indonesia" pada
    // unggahan kanal Lapas Wonogiri yang berjudul "PASTI BANGKIT" adalah
    // pertanyaan yang jawabannya sudah diketahui sebelum ditanyakan — dan
    // menjawabnya dengan menebak dari dua patah kata judul selalu salah.
    if (!penerbit.resmi) {
      const bising = periksaKebisingan(konteks)
      if (bising) return hasilLuarLingkup(bising.kode, bising.alasan)
    }

    // Unggahan yang diterbitkan akun resmi sebuah unit sudah pasti publikasi
    // kehumasan unit itu, dan tidak perlu menunggu kata kunci untuk diakui
    // demikian. Yang belum pasti hanyalah kegiatan apa yang diunggah — dan
    // untuk itu 8.4 adalah jawaban paling jujur: kegiatan kelembagaan, jenis
    // belum dirinci.
    //
    // Keyakinannya sengaja ditahan di 0,55: cukup untuk menyingkirkan publikasi
    // ini dari antrean "tidak dikenali", tetapi tetap di bawah ambang telaah
    // 0,75 sehingga analis tetap melihatnya sebelum angkanya dipakai.
    if (penerbit.resmi) {
      const sub = SEMUA_SUBKATEGORI.find((s) => s.kode === '8.4')
      return {
        kategori: sub.kategoriNama,
        kategori_kode: '8',
        subkategori: sub.nama,
        subkategori_kode: '8.4',
        sentimen: 'Positif',
        urgensi: 'Rendah',
        tingkat_perhatian: 'Rendah',
        kata_kunci: [],
        aktor_terdeteksi: aktor.dominan,
        ada_frasa_pembalik: pembalik,
        ada_bantahan: bantahan,
        konteks_humas: true,
        penerbit: penerbit.jenis,
        dalam_lingkup: true,
        ai_confidence: 0.55,
        ai_provider: VERSI_MESIN,
        skor_tertinggi: juara?.skor ?? 0,
        pesaing: peringkat.slice(0, 3).map(ringkasPesaing),
        alasan: `${penerbit.alasan} Tidak ada kata kunci isu yang menonjol, `
          + 'sehingga dicatat sebagai publikasi kehumasan yang jenis kegiatannya belum dirinci.',
      }
    }

    const sentimen = tentukanSentimen(konteks, null, pembalik)
    const urgensi = tentukanUrgensi(konteks, null, pembalik, berita.urgensi)
    return {
      ...hasilKosong('Tidak ada subkategori yang melewati ambang skor'),
      sentimen,
      urgensi,
      tingkat_perhatian: tentukanPerhatian(urgensi, sentimen),
      penerbit: penerbit.jenis,
      skor_tertinggi: juara?.skor ?? 0,
      pesaing: peringkat.slice(0, 3).map(ringkasPesaing),
    }
  }

  const runnerUp = peringkat[1]
  const sub = juara.sub

  // Keyakinan: seberapa jauh juara meninggalkan pesaing terdekatnya, digabung
  // dengan seberapa kuat skor absolutnya. Dua-duanya harus baik.
  const selisih = runnerUp ? (juara.skor - runnerUp.skor) / juara.skor : 1
  const kekuatan = Math.min(1, juara.skor / 12)
  const keyakinan = Number(Math.max(0.3, Math.min(0.97, 0.35 * kekuatan + 0.45 * selisih + 0.2)).toFixed(3))

  const sentimen = tentukanSentimen(konteks, sub, pembalik)
  const urgensi = tentukanUrgensi(konteks, sub, pembalik, berita.urgensi)

  return {
    kategori: sub.kategoriNama,
    kategori_kode: sub.kategoriKode,
    subkategori: sub.nama,
    subkategori_kode: sub.kode,
    sentimen,
    urgensi,
    tingkat_perhatian: tentukanPerhatian(urgensi, sentimen),
    kata_kunci: [...new Set(juara.cocok)].slice(0, 8),
    aktor_terdeteksi: aktor.dominan,
    ada_frasa_pembalik: pembalik,
    ada_bantahan: bantahan,
    konteks_humas: konteksHumas,
    penerbit: penerbit.jenis,
    dalam_lingkup: true,
    ai_confidence: keyakinan,
    ai_provider: VERSI_MESIN,
    skor_tertinggi: juara.skor,
    pesaing: peringkat.slice(1, 4).map(ringkasPesaing),
    alasan: susunAlasan(sub, juara.cocok, aktor, pembalik, bantahan),
  }
}

function ringkasPesaing(p) {
  return { kode: p.sub.kode, nama: p.sub.nama, skor: p.skor }
}

function hasilKosong(alasan) {
  return {
    kategori: KATEGORI_LAINNYA.nama,
    kategori_kode: '0',
    subkategori: 'Belum Dikelompokkan',
    subkategori_kode: '0.1',
    sentimen: 'Netral',
    urgensi: 'Rendah',
    tingkat_perhatian: 'Rendah',
    kata_kunci: [],
    aktor_terdeteksi: null,
    ada_frasa_pembalik: false,
    ada_bantahan: false,
    konteks_humas: false,
    dalam_lingkup: true,
    ai_confidence: 0.2,
    ai_provider: VERSI_MESIN,
    skor_tertinggi: 0,
    pesaing: [],
    alasan,
  }
}

function hasilLuarLingkup(kode, alasan) {
  const sub = KATEGORI_LUAR_LINGKUP.subkategori.find((s) => s.kode === kode)
  return {
    kategori: KATEGORI_LUAR_LINGKUP.nama,
    kategori_kode: '9',
    subkategori: sub ? sub.nama : 'Konten Tidak Relevan',
    subkategori_kode: kode,
    sentimen: 'Netral',
    urgensi: 'Rendah',
    tingkat_perhatian: 'Rendah',
    kata_kunci: [],
    aktor_terdeteksi: null,
    ada_frasa_pembalik: false,
    ada_bantahan: false,
    konteks_humas: false,
    dalam_lingkup: false,
    ai_confidence: 0.9,
    ai_provider: VERSI_MESIN,
    skor_tertinggi: 0,
    pesaing: [],
    alasan,
  }
}

function susunAlasan(sub, cocok, aktor, pembalik, bantahan) {
  const bagian = [`Kata kunci penentu: ${cocok.slice(0, 4).join(', ')}`]
  if (aktor.dominan) {
    const label = { petugas: 'petugas', wbp: 'warga binaan', eksternal: 'pihak luar' }[aktor.dominan]
    bagian.push(`pelaku yang disebut mengarah ke ${label}`)
  }
  if (pembalik) bagian.push('terdapat frasa yang menunjukkan kejadian berhasil dicegah atau digagalkan')
  if (bantahan) bagian.push('teks berisi bantahan atau klarifikasi, bukan laporan peristiwa')
  bagian.push(`sehingga masuk ${sub.kode} ${sub.nama}`)
  return bagian.join('; ') + '.'
}

/** Versi massal untuk penyeliaan ulang seluruh arsip. */
export function klasifikasikanBanyak(daftar) {
  return daftar.map((b) => ({ id: b.id, ...klasifikasikan(b) }))
}

export const META_MESIN = {
  versi: VERSI_MESIN,
  ambang: AMBANG_SKOR,
  ambangHumas: AMBANG_HUMAS,
  jumlahSubkategori: SEMUA_SUBKATEGORI.length,
}

export { KATEGORI }
