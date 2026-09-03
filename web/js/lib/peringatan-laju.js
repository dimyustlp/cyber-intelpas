/**
 * Aturan peringatan dini — yang bergerak, bukan yang berlencana.
 *
 * ---------------------------------------------------------------------------
 * Persoalan yang dijawab berkas ini
 * ---------------------------------------------------------------------------
 *
 * Peringatan Dini sampai hari ini murni penyaringan: ia menampilkan berita
 * yang urgensinya sudah dinilai Tinggi atau Kritis oleh mesin. Itu berguna,
 * dan itu juga reaktif — ia menunggu satu berita cukup buruk untuk berdiri
 * sendiri.
 *
 * Yang lolos dari penyaringan semacam itu justru pola yang paling merugikan:
 *
 *   Sepuluh berita berurgensi "Sedang" tentang satu unit dalam dua pekan tidak
 *   pernah memicu apa pun. Tidak satu pun cukup buruk untuk berdiri sendiri,
 *   dan bersama-sama mereka adalah unit yang sedang bermasalah.
 *
 *   Satu isu yang naik dari dua terbitan menjadi delapan dalam sehari terbaca
 *   sama dengan isu yang delapan terbitannya tersebar selama sebulan.
 *
 *   Satu peristiwa yang diangkat empat media yang saling bebas jauh lebih
 *   sulit dibantah daripada satu peristiwa yang diangkat satu media empat
 *   kali — dan keduanya berlencana sama.
 *
 * Empat aturan di bawah membaca ketiganya. Semuanya dihitung dari data yang
 * sudah ada, dengan mesin yang sudah ada.
 *
 * ---------------------------------------------------------------------------
 * Kenapa tidak disimpan sebagai tabel
 * ---------------------------------------------------------------------------
 *
 * Peringatan yang lengkap menurut spesifikasi punya nomor, status, pemilik,
 * dan riwayat — dan itu menuntut tabel `alerts` beserta migrasinya. Tabel itu
 * memang seharusnya ada.
 *
 * Yang dikerjakan di sini hanya DETEKSInya, dihitung ulang setiap kali halaman
 * dibuka. Alasannya bukan kemalasan: menambah tabel berarti mengubah basis
 * data, dan basis data ini satu untuk folder kerja maupun folder penggelar —
 * ia berubah begitu migrasinya dijalankan, tanpa menunggu penggelaran. Deteksi
 * yang dihitung di layar bisa diperiksa, dibantah, dan disetel dulu; barulah
 * kemudian ia layak diberi tabel.
 *
 * Akibat yang harus diketahui pemakainya, dan disebutkan di layar: peringatan
 * ini tidak punya ingatan. Ia tidak tahu apakah seseorang sudah membacanya.
 *
 * Modul ES murni. Tidak dipakai Edge Function.
 */

import { ember } from './sentimen.js'
import { dasar, URGENSI_MENDESAK } from './hitung.js'
import { belumTerpetakan } from './unit-terpetakan.js'
import { kelompokkanPeristiwa } from './peristiwa.js'
import { skorRisiko } from './risiko.js'

const JAM = 3_600_000
const HARI = 24 * JAM

/* -------------------------------------------------------------------- atur */

/**
 * Angka penyetel tiap aturan, di satu tempat.
 *
 * Ditulis di sini dan bukan tersebar di dalam fungsinya masing-masing supaya
 * seseorang yang mengeluh "peringatannya terlalu ramai" punya satu tempat
 * untuk dibawa — dan supaya perubahannya menuntut commit, sehingga tercatat.
 */
export const ATUR = {
  /** Jendela pembanding lonjakan, dan jendela sebelumnya yang sepanjang itu. */
  lonjakanJam: 24,
  /** Terbitan negatif minimum sebelum sebuah lonjakan layak disebut lonjakan. */
  lonjakanMinimum: 3,
  /** Kelipatan terhadap jendela sebelumnya. 2 berarti naik lebih dari 100%. */
  lonjakanKelipatan: 2,
  /** Terbitan yang membuat lonjakan naik ke tingkat kritis. */
  lonjakanKritis: 6,

  /** Media saling bebas minimum sebelum sebuah peristiwa disebut menyebar. */
  sumberMinimum: 3,
  /** Skor risiko minimum yang menyertainya. */
  sumberSkorMinimum: 60,

  /** Skor risiko minimum untuk peringatan "membesar tanpa tanggapan". */
  diamSkorMinimum: 65,
  /** Peristiwa yang terbitan terakhirnya lebih tua dari ini tidak lagi mendesak. */
  diamHariMaksimum: 7,

  /** Jendela pengamatan penumpukan pelan. */
  menumpukHari: 30,
  /** Peristiwa negatif minimum di satu unit sebelum penumpukan disebut ada. */
  menumpukMinimum: 5,
}

/**
 * Empat aturan, beserta kalimat yang menjelaskan masing-masing di layar.
 *
 * Sebuah peringatan yang tidak bisa menjelaskan kenapa ia muncul akan
 * diabaikan setelah minggu kedua. Maka tiap aturan wajib punya `ket`, dan tiap
 * peringatan yang dihasilkannya wajib menyebut angka yang memicunya.
 */
export const ATURAN = {
  lonjakan: {
    nama: 'Lonjakan pemberitaan negatif',
    ket: `Terbitan negatif sebuah unit naik lebih dari ${(ATUR.lonjakanKelipatan - 1) * 100}% `
      + `dibanding ${ATUR.lonjakanJam} jam sebelumnya.`,
  },
  sumber: {
    nama: 'Menyebar ke banyak sumber',
    ket: `Satu peristiwa diangkat ${ATUR.sumberMinimum} media atau lebih yang saling bebas, `
      + `dengan skor risiko di atas ${ATUR.sumberSkorMinimum}.`,
  },
  diam: {
    nama: 'Membesar tanpa tanggapan',
    ket: `Peristiwa berskor di atas ${ATUR.diamSkorMinimum} yang masih berlangsung `
      + 'dan belum mendapat satu pun sikap resmi unit.',
  },
  menumpuk: {
    nama: 'Penumpukan pelan',
    ket: `${ATUR.menumpukMinimum} peristiwa negatif atau lebih di satu unit dalam `
      + `${ATUR.menumpukHari} hari, tanpa satu pun yang cukup berat untuk berdiri sendiri.`,
  },
}

/* ----------------------------------------------------------------- bantuan */

function waktu(b) {
  const t = new Date(b?.created_at || b?.tanggal_publikasi || 0).getTime()
  return Number.isFinite(t) && t > 0 ? t : 0
}

function negatif(b) {
  return ember(b) === 'negatif'
}

function unitDari(b) {
  return belumTerpetakan(b?.nama_upt) ? null : b.nama_upt
}

/* ----------------------------------------------------------------- aturan */

/**
 * Aturan 1 — lonjakan.
 *
 * Membandingkan jendela terakhir dengan jendela sepanjang itu tepat
 * sebelumnya, per unit. Unit yang belum terpetakan sengaja dilewati: sebuah
 * lonjakan yang tidak bisa ditunjuk unitnya tidak bisa ditindaklanjuti kepada
 * siapa pun, dan peringatan yang tidak bisa ditindaklanjuti hanya menambah
 * kebisingan.
 */
function aturanLonjakan(inti, sekarang) {
  const jendela = ATUR.lonjakanJam * JAM
  const batasKini = sekarang - jendela
  const batasLalu = sekarang - jendela * 2

  const per = new Map()
  for (const b of inti) {
    if (!negatif(b)) continue
    const unit = unitDari(b)
    if (!unit) continue
    const t = waktu(b)
    if (t < batasLalu) continue

    const u = per.get(unit) || { unit, kini: [], lalu: 0 }
    if (t >= batasKini) u.kini.push(b)
    else u.lalu += 1
    per.set(unit, u)
  }

  const hasil = []
  for (const u of per.values()) {
    const kini = u.kini.length
    if (kini < ATUR.lonjakanMinimum) continue
    if (u.lalu > 0 && kini < u.lalu * ATUR.lonjakanKelipatan) continue

    const naik = u.lalu === 0 ? null : Math.round(((kini - u.lalu) / u.lalu) * 100)

    hasil.push({
      kode: 'lonjakan',
      tingkat: kini >= ATUR.lonjakanKritis ? 'Kritis' : 'Tinggi',
      unit: u.unit,
      judul: `${u.unit} — ${kini} terbitan negatif dalam ${ATUR.lonjakanJam} jam`,
      sebab: naik === null
        ? `Tidak ada satu pun terbitan negatif pada ${ATUR.lonjakanJam} jam sebelumnya. `
          + 'Kenaikannya karena itu tidak bisa dinyatakan sebagai persentase — ia bermula dari nol.'
        : `Naik ${naik}% dibanding ${ATUR.lonjakanJam} jam sebelumnya, yang berisi ${u.lalu} terbitan.`,
      berita: u.kini.sort((a, b) => waktu(b) - waktu(a)),
      waktu: Math.max(...u.kini.map(waktu)),
    })
  }
  return hasil
}

/** Aturan 2 — satu peristiwa yang diangkat banyak media saling bebas. */
function aturanSumber(peristiwa, sekarang) {
  const hasil = []
  for (const p of peristiwa) {
    if (ember(p) === 'positif') continue
    if ((p.jumlah_media || 0) < ATUR.sumberMinimum) continue

    const r = skorRisiko(p, { sekarang: new Date(sekarang) })
    if (r.skor < ATUR.sumberSkorMinimum) continue

    hasil.push({
      kode: 'sumber',
      tingkat: r.skor >= 75 ? 'Kritis' : 'Tinggi',
      unit: unitDari(p),
      judul: p.judul,
      sebab: `${p.jumlah_media} media berbeda mengangkatnya dalam ${p.rentang_hari} hari `
        + `(${p.jumlah_publikasi} terbitan). Skor risiko ${r.skor} dari 100.`,
      berita: p.publikasi,
      peristiwa: p,
      risiko: r,
      waktu: new Date(p.tanggal_terakhir || 0).getTime(),
    })
  }
  return hasil
}

/** Aturan 3 — peristiwa berat yang masih berjalan dan belum ditanggapi. */
function aturanDiam(peristiwa, sekarang) {
  const hasil = []
  for (const p of peristiwa) {
    if (ember(p) === 'positif') continue

    const akhir = new Date(p.tanggal_terakhir || 0).getTime()
    if (!akhir || (sekarang - akhir) / HARI > ATUR.diamHariMaksimum) continue

    const r = skorRisiko(p, { sekarang: new Date(sekarang) })
    if (r.skor < ATUR.diamSkorMinimum) continue

    // Faktor tanggapan bernilai penuh berarti belum ada sikap resmi sama
    // sekali. Nilainya dibaca dari hasil skor, bukan dihitung ulang di sini —
    // dua definisi "belum ditanggapi" akan berpisah.
    const tanggapan = r.faktor.find((f) => f.kode === 'tanggapan')
    if (!tanggapan || tanggapan.nilai < 1) continue

    // "0 hari lalu" adalah cara yang paling kaku untuk mengatakan "hari ini",
    // dan kalimat peringatan dibaca orang yang sedang terburu-buru.
    const umur = Math.max(0, Math.round((sekarang - akhir) / HARI))
    const kapan = umur === 0 ? 'terbitan terakhir hari ini'
      : umur === 1 ? 'terbitan terakhir kemarin'
        : `terbitan terakhir ${umur} hari lalu`

    hasil.push({
      kode: 'diam',
      tingkat: r.skor >= 80 ? 'Kritis' : 'Tinggi',
      unit: unitDari(p),
      judul: p.judul,
      sebab: `Skor risiko ${r.skor} dari 100, ${kapan}, `
        + 'dan belum ada satu pun sikap resmi dari unit yang bersangkutan.',
      berita: p.publikasi,
      peristiwa: p,
      risiko: r,
      waktu: akhir,
    })
  }
  return hasil
}

/**
 * Aturan 4 — penumpukan pelan.
 *
 * Inilah aturan yang paling sulit dilihat manusia dan paling mudah dilihat
 * mesin. Yang dicari bukan satu berita yang buruk, melainkan sebuah unit yang
 * terus-menerus muncul tanpa pernah cukup buruk untuk diperhatikan.
 *
 * Unit yang SUDAH punya peristiwa mendesak sengaja dikeluarkan: ia sudah
 * muncul di daftar peringatan lewat jalur lain, dan memunculkannya dua kali
 * hanya membuat daftar itu lebih panjang tanpa lebih memberitahu.
 */
function aturanMenumpuk(peristiwa, sekarang) {
  const batas = sekarang - ATUR.menumpukHari * HARI

  const per = new Map()
  for (const p of peristiwa) {
    if (ember(p) !== 'negatif') continue
    const unit = unitDari(p)
    if (!unit) continue
    if (new Date(p.tanggal_terakhir || 0).getTime() < batas) continue

    const u = per.get(unit) || { unit, daftar: [], adaMendesak: false }
    u.daftar.push(p)
    if (URGENSI_MENDESAK.includes(p.urgensi)) u.adaMendesak = true
    per.set(unit, u)
  }

  const hasil = []
  for (const u of per.values()) {
    if (u.adaMendesak) continue
    if (u.daftar.length < ATUR.menumpukMinimum) continue

    const terbitan = u.daftar.reduce((n, p) => n + (p.jumlah_publikasi || 0), 0)

    hasil.push({
      kode: 'menumpuk',
      tingkat: 'Sedang',
      unit: u.unit,
      judul: `${u.unit} — ${u.daftar.length} peristiwa negatif dalam ${ATUR.menumpukHari} hari`,
      sebab: `${terbitan} terbitan di ${u.daftar.length} peristiwa berbeda, dan tidak satu pun `
        + 'berurgensi Tinggi atau Kritis. Pola semacam ini tidak pernah memicu peringatan '
        + 'satuan, dan justru itu yang membuatnya layak dibaca.',
      berita: u.daftar.flatMap((p) => p.publikasi),
      waktu: Math.max(...u.daftar.map((p) => new Date(p.tanggal_terakhir || 0).getTime())),
    })
  }
  return hasil
}

/* ------------------------------------------------------------- pintu utama */

const PERINGKAT = { Kritis: 3, Tinggi: 2, Sedang: 1 }

/**
 * Menjalankan keempat aturan atas satu arsip berita.
 *
 * @param {object[]} berita arsip mentah; himpunan dasarnya dihitung di sini
 * @param {object} [opsi]
 * @param {Date} [opsi.sekarang] acuan waktu, disuntikkan supaya bisa diuji
 * @returns {Array<{kode:string, tingkat:string, unit:?string, judul:string,
 *                  sebab:string, berita:object[], waktu:number}>}
 */
export function periksaLaju(berita = [], opsi = {}) {
  const sekarang = (opsi.sekarang || new Date()).getTime()
  const inti = dasar(berita)
  if (!inti.length) return []

  const peristiwa = kelompokkanPeristiwa(inti)

  return [
    ...aturanLonjakan(inti, sekarang),
    ...aturanSumber(peristiwa, sekarang),
    ...aturanDiam(peristiwa, sekarang),
    ...aturanMenumpuk(peristiwa, sekarang),
  ].sort((a, b) =>
    (PERINGKAT[b.tingkat] || 0) - (PERINGKAT[a.tingkat] || 0) || b.waktu - a.waktu)
}

/** Jumlah peringatan laju per tingkat, untuk lencana dan ringkasan. */
export function rekapLaju(daftar = []) {
  return {
    total: daftar.length,
    kritis: daftar.filter((a) => a.tingkat === 'Kritis').length,
    tinggi: daftar.filter((a) => a.tingkat === 'Tinggi').length,
    sedang: daftar.filter((a) => a.tingkat === 'Sedang').length,
  }
}

export const META_LAJU = { versi: 'laju-v1.0' }
