/**
 * Skor risiko peristiwa — 0 sampai 100, beserta rincian penyumbangnya.
 *
 * ---------------------------------------------------------------------------
 * Kenapa berkas ini ada, dan kenapa ia berbahaya
 * ---------------------------------------------------------------------------
 *
 * Urgensi hanya punya empat tingkat, dan empat tingkat tidak bisa membedakan
 * dua hal yang di lapangan sangat berbeda: satu berita "Tinggi" di satu media
 * daerah yang sudah ditanggapi unitnya, dan satu berita "Tinggi" yang sama
 * yang dalam dua hari diangkat sebelas media nasional tanpa satu kalimat pun
 * tanggapan. Keduanya berlencana sama di seluruh layar hari ini.
 *
 * Tetapi angka gabungan adalah alat yang mudah disalahgunakan. Angka 87 akan
 * dikutip dalam rapat, ditulis di nota dinas, dan dipakai membandingkan dua
 * unit — padahal bobot yang menghasilkannya adalah pertimbangan yang disusun
 * manusia, bukan temuan yang diukur. Sistem ini sudah bersusah payah
 * membedakan klaim media, penilaian mesin, dan penilaian analis; satu angka
 * tunggal yang berdiri sendiri berpotensi meruntuhkan pembedaan itu dalam satu
 * langkah.
 *
 * Maka tiga syarat dipegang berkas ini, dan ketiganya wajib:
 *
 *   1. SKOR TIDAK PERNAH BERDIRI SENDIRI. `skorRisiko()` selalu mengembalikan
 *      `faktor` — enam baris berisi bobot, nilai, poin, dan kalimat dasarnya.
 *      Halaman yang menampilkan skor tanpa menampilkan rinciannya sedang
 *      melanggar maksud berkas ini. Untuk mempersulit pelanggaran itu, tidak
 *      ada satu pun fungsi di sini yang mengembalikan angka telanjang.
 *
 *   2. BOBOTNYA TERBACA. `BOBOT` di bawah adalah satu-satunya tempat angka
 *      pembobot hidup, tertulis lengkap dengan alasan tiap besarannya.
 *      Siapa pun yang mempertanyakan sebuah skor bisa dibawa ke sini.
 *
 *   3. PERUBAHAN BOBOT TERCATAT. Bobot tinggal di dalam kode, bukan di dalam
 *      basis data. Konsekuensinya disengaja: mengubahnya menuntut commit dan
 *      penggelaran, dan keduanya meninggalkan jejak bernama dengan tanggal.
 *      Bobot yang bisa diubah lewat layar tanpa jejak akan berubah diam-diam,
 *      dan seluruh skor lama menjadi tidak bisa dibandingkan tanpa ada yang
 *      tahu kapan patahnya.
 *
 * ---------------------------------------------------------------------------
 * Satuannya peristiwa, bukan publikasi
 * ---------------------------------------------------------------------------
 *
 * Delapan berita tentang satu narapidana yang kabur adalah SATU peristiwa
 * dengan eksposur besar — bukan delapan risiko. Karena itu masukan utama
 * fungsi ini adalah kelompok peristiwa dari lib/peristiwa.js. Untuk satu
 * berita yang berdiri sendiri, `skorRisikoBerita()` membungkusnya menjadi
 * peristiwa berisi satu publikasi, sehingga rumusnya tetap satu.
 *
 * Modul ES murni, tanpa pustaka luar. Tidak dipakai Edge Function — skor ini
 * dihitung di layar, dari data yang sudah ada, dan tidak pernah disimpan.
 * Lihat catatan "Kenapa tidak disimpan" di kaki berkas.
 */

import { ember } from './sentimen.js'
import { kenaliPenerbit } from './penerbit.js'
import { sumberAsli } from './peristiwa.js'

/* -------------------------------------------------------------------- bobot */

/**
 * Enam faktor dan bobotnya. Jumlahnya harus 100.
 *
 * Besarannya mengikuti pertimbangan berikut, dan pertimbangan itu ditulis di
 * sini supaya bisa dibantah — bukan supaya terlihat ilmiah.
 */
export const BOBOT = [
  {
    kode: 'dampak',
    nama: 'Dampak kejadian',
    bobot: 30,
    ket: 'Seberapa berat kejadiannya menurut urgensi dan sentimennya.',
    /* Terbesar, dan sengaja. Kejadian yang berat tetap berat sekalipun belum
       ada satu media pun yang mengangkatnya — dan justru itulah keadaan yang
       paling tidak boleh berskor rendah. Sebuah model yang membuat kejadian
       kritis berskor kecil hanya karena media belum tahu adalah model yang
       menghukum kecepatan sistemnya sendiri. */
  },
  {
    kode: 'jangkauan',
    nama: 'Jangkauan media',
    bobot: 20,
    ket: 'Berapa banyak media yang berbeda mengangkatnya.',
    /* Media yang berbeda bernilai jauh lebih besar daripada satu media yang
       mengulang. Sepuluh terbitan dari satu kanal adalah satu sudut pandang
       yang keras; tiga terbitan dari tiga media adalah isu yang menyebar. */
  },
  {
    kode: 'kredibilitas',
    nama: 'Kredibilitas penerbit',
    bobot: 15,
    ket: 'Siapa yang menerbitkannya — media massa, akun unit, atau sumber tak dikenal.',
    /* Bukan penilaian atas mutu jurnalistik sebuah media, dan tidak boleh
       dibaca begitu. Yang diukur hanya satu: seberapa besar bobot kelembagaan
       sebuah terbitan. Kabar buruk yang dibawa media massa menuntut sikap
       resmi; kabar yang sama pada kanal anonim menuntut verifikasi lebih
       dulu. */
  },
  {
    kode: 'laju',
    nama: 'Laju pemberitaan',
    bobot: 15,
    ket: 'Seberapa cepat terbitannya bertambah, dan apakah masih berlangsung.',
    /* Isu yang masih bergerak menuntut tindakan hari ini; isu dengan jumlah
       terbitan sama yang berhenti tiga pekan lalu menuntut evaluasi, bukan
       respons. Dua keadaan itu tidak boleh berskor sama. */
  },
  {
    kode: 'pengulangan',
    nama: 'Pengulangan',
    bobot: 10,
    ket: 'Berapa kali kabar yang sama diterbitkan ulang di luar media pertamanya.',
    /* Dipisahkan dari jangkauan supaya keduanya tidak menghitung hal yang
       sama dua kali: jangkauan mengukur lebar, pengulangan mengukur berapa
       lama sebuah kabar bertahan di permukaan. */
  },
  {
    kode: 'tanggapan',
    nama: 'Tanggapan resmi',
    bobot: 10,
    ket: 'Apakah unit sudah bersikap. Satu-satunya faktor yang MENURUNKAN skor.',
    /* Terkecil, dan sengaja. Tanggapan resmi meredakan tekanan opini, tetapi
       tidak menghapus kejadiannya. Bobot besar di sini akan membuat sebuah
       unit bisa menurunkan skornya sendiri hanya dengan menerbitkan
       pernyataan — dan itu mengubah alat ukur menjadi alat kehumasan. */
  },
]

/** Jumlah seluruh bobot. Dihitung, bukan ditulis, supaya tidak bisa berbeda. */
export const TOTAL_BOBOT = BOBOT.reduce((n, f) => n + f.bobot, 0)

/**
 * Ambang tingkat. Sengaja sejajar dengan empat tingkat urgensi yang sudah
 * dikenal petugas, supaya skor 78 dan lencana "Tinggi" tidak pernah saling
 * membantah di layar yang sama.
 */
export const TINGKAT_RISIKO = [
  { kode: 'Kritis', min: 75, nada: 'kritis', ket: 'Menuntut respons segera dan perhatian pimpinan.' },
  { kode: 'Tinggi', min: 50, nada: 'tinggi', ket: 'Menuntut verifikasi lapangan dan sikap resmi.' },
  { kode: 'Sedang', min: 25, nada: 'sedang', ket: 'Perlu diketahui pimpinan unit, belum menuntut tindakan hari ini.' },
  { kode: 'Rendah', min: 0, nada: 'rendah', ket: 'Bahan pemantauan biasa.' },
]

export function tingkatRisiko(skor) {
  return TINGKAT_RISIKO.find((t) => skor >= t.min) || TINGKAT_RISIKO[TINGKAT_RISIKO.length - 1]
}

/* ------------------------------------------------------------------ dasaran */

/** Nilai dasar tiap urgensi, 0..1. */
const NILAI_URGENSI = { Kritis: 1, Tinggi: 0.78, Sedang: 0.45, Rendah: 0.15 }

/**
 * Gerbang sentimen — pengali atas SELURUH skor, bukan atas satu faktor.
 *
 * Pasal yang tidak boleh dilanggar: sentimen BUKAN risiko. Tetapi keenam
 * faktor di atas semuanya mengukur satu hal yang sama — tekanan pemberitaan —
 * dan tekanan hanya menjadi risiko kelembagaan ketika kabarnya merugikan.
 *
 * Versi pertama berkas ini keliru di sini, dan kekeliruannya tertangkap uji:
 * pengali hanya dikenakan pada faktor dampak, sehingga peresmian yang diliput
 * sembilan media berskor 68 dan masuk tingkat Tinggi. Lima faktor lainnya
 * dengan riang menghitung liputan positif sebagai risiko.
 *
 * Yang TIDAK dilakukan untuk memperbaikinya: menjadikan sentimen faktor
 * ketujuh dengan bobotnya sendiri. Itu akan menempatkannya sebagai salah satu
 * penyumbang risiko yang setara, dan pembacanya akan menyimpulkan persis hal
 * yang dilarang pasal ini.
 *
 * Yang dilakukan: skor mentah dihitung utuh dari keenam faktor — ia tetap
 * berarti sesuatu, yaitu besarnya tekanan pemberitaan — lalu dikalikan gerbang
 * ini. Keduanya dikembalikan terpisah, sehingga layar bisa menyebutkan
 * ketiganya berurutan: tekanan 68, gerbang positif 0,12, risiko 8.
 */
const GERBANG_SENTIMEN = {
  negatif: 1,
  netral: 0.5,
  positif: 0.12,
  /* Belum dinilai. Sengaja tinggi: menekan skor kabar yang belum diketahui
     sifatnya sama saja dengan menyembunyikannya dari daftar prioritas justru
     ketika ia paling perlu dilihat manusia. */
  belum: 0.75,
}

/** Kredibilitas kelembagaan tiap jenis penerbit, 0..1. */
const NILAI_PENERBIT = {
  media_massa: 1,
  penyisiran: 0.5,
  tidak_dikenal: 0.4,
  /* Kanal unit sendiri. Kabar negatif yang terbit di sini adalah pengakuan
     sendiri — beratnya ada pada kejadiannya, bukan pada tekanan opininya. */
  institusi: 0.25,
}

const HARI = 86_400_000

function keWaktu(nilai) {
  const t = new Date(nilai || 0).getTime()
  return Number.isFinite(t) && t > 0 ? t : null
}

/** Membatasi sebuah nilai ke rentang 0..1. */
function jepit(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

/**
 * Kurva jenuh: naik cepat di awal lalu melandai.
 *
 * Dipakai untuk jangkauan dan pengulangan. Bedanya media kedua dengan media
 * pertama jauh lebih berarti daripada bedanya media kedua belas dengan media
 * kesebelas, dan penjumlahan lurus tidak bisa menyatakan itu.
 */
function jenuh(n, penuh) {
  if (n <= 0) return 0
  return jepit(Math.log(1 + n) / Math.log(1 + penuh))
}

/* ------------------------------------------------------------------- faktor */

function faktorDampak(p) {
  const urgensi = p.urgensi || 'Rendah'
  const nilai = NILAI_URGENSI[urgensi] ?? NILAI_URGENSI.Rendah
  return {
    nilai: jepit(nilai),
    dasar: `Urgensi peristiwa ini dinilai ${urgensi}.`,
  }
}

function faktorJangkauan(p) {
  const media = p.jumlah_media || 0
  return {
    nilai: jenuh(media, 12),
    dasar: media === 0
      ? 'Penerbitnya belum bisa dikenali dari data yang ada.'
      : media === 1
        ? 'Baru satu media yang mengangkatnya.'
        : `${media} media berbeda mengangkatnya.`,
  }
}

function faktorKredibilitas(p) {
  const terbitan = p.publikasi || []
  if (!terbitan.length) return { nilai: 0, dasar: 'Tidak ada publikasi yang bisa diperiksa.' }

  const jenis = terbitan.map((b) => kenaliPenerbit(b).jenis)
  const nilai = jenis.map((j) => NILAI_PENERBIT[j] ?? NILAI_PENERBIT.tidak_dikenal)

  /*
     Diambil yang TERTINGGI, bukan reratanya.

     Satu terbitan media massa nasional sudah cukup menjadikan sebuah kabar
     persoalan kelembagaan, sekalipun sembilan terbitan lainnya adalah salinan
     di kanal tak dikenal. Rerata akan mengencerkan satu terbitan yang paling
     menentukan itu sampai nyaris hilang — persis kebalikan dari yang
     dibutuhkan orang yang membaca skornya.
  */
  const puncak = Math.max(...nilai)
  const jumlahMassa = jenis.filter((j) => j === 'media_massa').length

  const dasar = jumlahMassa
    ? `${jumlahMassa} dari ${terbitan.length} terbitan berasal dari media massa.`
    : jenis.every((j) => j === 'institusi')
      ? 'Seluruh terbitan berasal dari kanal resmi unit sendiri.'
      : 'Tidak ada terbitan dari media massa; penerbitnya kanal tak dikenal atau hasil penyisiran.'

  return { nilai: jepit(puncak), dasar }
}

function faktorLaju(p, sekarang) {
  const jumlah = p.jumlah_publikasi || (p.publikasi?.length ?? 0)
  const rentang = Math.max(1, p.rentang_hari || 1)
  const perHari = jumlah / rentang

  // Enam terbitan sehari sudah termasuk isu yang bergerak keras. Di atas itu
  // perbedaannya tidak lagi mengubah apa yang harus dilakukan.
  const kecepatan = jepit(perHari / 6)

  const akhir = keWaktu(p.tanggal_terakhir)
  const usia = akhir ? (sekarang - akhir) / HARI : 999

  /*
     Peredam usia. Isu yang terbitan terakhirnya sebulan lalu tidak lagi
     menuntut respons hari ini, betapa pun ramainya ia dulu. Tanpa peredam ini,
     arsip lama akan selamanya menduduki puncak daftar dan mengubur isu yang
     sedang berlangsung — kegagalan paling mahal yang bisa dilakukan sebuah
     daftar prioritas.
  */
  const peredam = usia <= 2 ? 1
    : usia <= 7 ? 0.8
      : usia <= 14 ? 0.55
        : usia <= 30 ? 0.3
          : 0.12

  const dasarUsia = usia > 900 ? 'tanggal terbitannya tidak diketahui'
    : usia <= 2 ? 'masih berlangsung'
      : `terbitan terakhir ${Math.round(usia)} hari lalu`

  return {
    nilai: jepit(kecepatan * peredam),
    // Koma, bukan titik. Berkas ini menghasilkan kalimat yang tampil apa adanya
    // di layar berbahasa Indonesia, dan "0.8" di antara kalimat Indonesia
    // terbaca sebagai kutipan dari sistem lain.
    dasar: `${perHari.toFixed(1).replace('.', ',')} terbitan per hari selama ${rentang} hari, ${dasarUsia}.`,
  }
}

function faktorPengulangan(p) {
  const jumlah = p.jumlah_publikasi || (p.publikasi?.length ?? 0)
  const media = p.jumlah_media || 0
  // Terbitan di luar media pertamanya masing-masing: inilah pengulangan yang
  // sebenarnya, bukan sekadar banyaknya terbitan.
  const ulang = Math.max(0, jumlah - media)

  return {
    nilai: jenuh(ulang, 8),
    dasar: ulang === 0
      ? 'Tidak ada media yang menerbitkannya lebih dari sekali.'
      : `${ulang} terbitan ulang di luar terbitan pertama tiap media`
        + (p.kembar ? `, ${p.kembar} di antaranya nyaris identik.` : '.'),
  }
}

/**
 * Nilai tiap sikap resmi. Angka besar berarti risiko masih TERBUKA — faktor
 * ini menyumbang poin ketika unit belum bersikap, bukan ketika sudah.
 */
const NILAI_TANGGAPAN = {
  'Sudah Ditangani': 0.1,
  'Tidak Benar': 0.35,
  Dibenarkan: 0.5,
  'Sebagian Benar': 0.55,
}

function faktorTanggapan(p) {
  const terbitan = p.publikasi || []
  const bersikap = terbitan
    .map((b) => b.tanggapan_sikap)
    .filter((s) => s && NILAI_TANGGAPAN[s] !== undefined)

  if (!bersikap.length) {
    const adaTeks = terbitan.some((b) => String(b.tanggapan_upt || '').trim())
    if (adaTeks) {
      return { nilai: 0.6, dasar: 'Unit menuliskan tanggapan, tetapi belum menyatakan sikapnya.' }
    }
    return { nilai: 1, dasar: 'Belum ada tanggapan resmi dari unit yang bersangkutan.' }
  }

  // Sikap yang paling meredakan yang dipakai — sebuah unit yang sudah
  // menangani tidak dihukum karena terbitan lain masih menunggu tanggapan.
  const nilai = Math.min(...bersikap.map((s) => NILAI_TANGGAPAN[s]))
  const dipakai = bersikap.find((s) => NILAI_TANGGAPAN[s] === nilai)
  return { nilai: jepit(nilai), dasar: `Sikap resmi unit: ${dipakai}.` }
}

const PENGHITUNG = {
  dampak: faktorDampak,
  jangkauan: faktorJangkauan,
  kredibilitas: faktorKredibilitas,
  laju: faktorLaju,
  pengulangan: faktorPengulangan,
  tanggapan: faktorTanggapan,
}

/* ------------------------------------------------------------- pintu utama */

/**
 * Menghitung skor risiko satu peristiwa.
 *
 * Tiga angka dikembalikan berurutan, dan ketiganya dimaksudkan untuk tampil
 * berurutan pula di layar: `tekanan` (0..100, hasil keenam faktor), `gerbang`
 * (pengali sentimen), dan `skor` (hasil kali keduanya). Menampilkan `skor`
 * tanpa dua yang mendahuluinya menyembunyikan langkah yang paling menentukan.
 *
 * @param {object} peristiwa kelompok dari `kelompokkanPeristiwa()`
 * @param {object} [opsi]
 * @param {Date}   [opsi.sekarang] acuan waktu, disuntikkan supaya bisa diuji
 * @returns {{
 *   skor: number,
 *   tekanan: number,
 *   gerbang: {kode:string, pengali:number, ket:string},
 *   tingkat: {kode:string, nada:string, ket:string},
 *   faktor: Array<{kode:string, nama:string, bobot:number, nilai:number, poin:number, dasar:string, ket:string}>,
 *   catatan: string[],
 * }}
 */
export function skorRisiko(peristiwa, opsi = {}) {
  const sekarang = (opsi.sekarang || new Date()).getTime()
  const p = peristiwa || {}

  const faktor = BOBOT.map((f) => {
    const { nilai, dasar } = PENGHITUNG[f.kode](p, sekarang)
    return {
      kode: f.kode,
      nama: f.nama,
      ket: f.ket,
      bobot: f.bobot,
      nilai: Number(nilai.toFixed(3)),
      poin: Number((nilai * f.bobot).toFixed(1)),
      dasar,
    }
  })

  const tekanan = Math.round(faktor.reduce((n, f) => n + f.poin, 0))

  const kode = ember(p)
  const pengali = GERBANG_SENTIMEN[kode] ?? GERBANG_SENTIMEN.netral
  const gerbang = { kode, pengali, ket: KET_GERBANG[kode] || KET_GERBANG.netral }

  const skor = Math.round(tekanan * pengali)

  return {
    skor,
    tekanan,
    gerbang,
    tingkat: tingkatRisiko(skor),
    faktor,
    catatan: catatan(p, faktor, gerbang),
  }
}

/** Kalimat yang menjelaskan gerbang sentimen di layar. */
const KET_GERBANG = {
  negatif: 'Pemberitaan negatif. Seluruh tekanan pemberitaan dihitung penuh sebagai risiko.',
  netral: 'Pemberitaan netral atau campuran. Tekanannya nyata, tetapi belum tentu merugikan.',
  positif: 'Pemberitaan positif. Liputan yang luas di sini bukan risiko kelembagaan.',
  belum: 'Sentimennya belum dinilai. Tekanan dihitung hampir penuh supaya kabar ini tetap terlihat sampai ada yang menilainya.',
}

/**
 * Hal-hal yang membuat sebuah skor patut dibaca dengan hati-hati.
 *
 * Ditampilkan berdampingan dengan angkanya, bukan disembunyikan di balik
 * tautan. Skor yang dihitung dari satu terbitan tanpa unit yang terpetakan
 * adalah tebakan, dan pembacanya berhak tahu itu sebelum mengutipnya.
 */
function catatan(p, faktor, gerbang) {
  const pesan = []
  const jumlah = p.jumlah_publikasi || (p.publikasi?.length ?? 0)

  if (jumlah <= 1) {
    pesan.push('Dihitung dari satu terbitan. Jangkauan, laju, dan pengulangan '
      + 'belum punya bahan yang cukup, sehingga skornya cenderung rendah — '
      + 'rendah di sini berarti "belum diketahui", bukan "tidak berbahaya".')
  }

  if (!p.jumlah_media) {
    pesan.push('Penerbitnya belum bisa dikenali, sehingga kredibilitas dan '
      + 'jangkauan dinilai seadanya.')
  }

  const tanggapan = faktor.find((f) => f.kode === 'tanggapan')
  if (tanggapan && tanggapan.nilai === 1) {
    pesan.push('Belum ada sikap resmi unit. Sepuluh poin dari skor ini akan '
      + 'turun begitu unit yang bersangkutan menyatakan sikapnya.')
  }

  if (gerbang.kode === 'positif') {
    pesan.push('Sentimennya positif, sehingga tekanan pemberitaannya tidak '
      + 'dihitung sebagai risiko. Skor untuk pemberitaan positif sebaiknya '
      + 'tidak dipakai membandingkan apa pun.')
  }

  if (gerbang.kode === 'belum') {
    pesan.push('Sentimennya belum dinilai analis. Selama itu, skor ini masih '
      + 'perkiraan — nilainya akan bergeser begitu berita ditelaah.')
  }

  return pesan
}

/**
 * Skor untuk satu berita yang berdiri sendiri.
 *
 * Dibungkus menjadi peristiwa berisi satu publikasi supaya rumusnya tetap satu.
 * Bila berita itu sebenarnya bagian dari peristiwa yang lebih besar, berikan
 * peristiwanya lewat argumen kedua — skornya akan jauh berbeda, dan perbedaan
 * itu memang yang dicari: satu berita dari sebelas bersaudara jauh lebih
 * berisiko daripada satu berita yang sendirian.
 */
export function skorRisikoBerita(berita, peristiwa = null, opsi = {}) {
  if (peristiwa) return skorRisiko(peristiwa, opsi)

  const media = sumberAsli(berita)
  return skorRisiko({
    urgensi: berita.urgensi,
    sentimen: berita.sentimen,
    nama_upt: berita.nama_upt,
    publikasi: [berita],
    jumlah_publikasi: 1,
    jumlah_media: media ? 1 : 0,
    daftar_media: media ? [media] : [],
    rentang_hari: 1,
    kembar: 0,
    tanggal_pertama: berita.tanggal_publikasi || berita.created_at,
    tanggal_terakhir: berita.tanggal_publikasi || berita.created_at,
  }, opsi)
}

/**
 * Peristiwa yang paling menuntut perhatian, berurut menurun.
 *
 * Dipakai Executive Brief dan Peringatan Dini. Peristiwa positif dibuang di
 * sini, bukan di halaman pemanggilnya: daftar "yang menuntut perhatian" yang
 * memuat peresmian masjid adalah daftar yang berhenti dibaca orang.
 */
export function peringkatRisiko(daftarPeristiwa = [], opsi = {}) {
  return daftarPeristiwa
    .filter((p) => ember(p) !== 'positif')
    .map((p) => ({ peristiwa: p, ...skorRisiko(p, opsi) }))
    .sort((a, b) => b.skor - a.skor)
}

export const META_RISIKO = { versi: 'risiko-v1.0', bobot: TOTAL_BOBOT }

/*
   ---------------------------------------------------------------------------
   Kenapa skor ini tidak disimpan di basis data
   ---------------------------------------------------------------------------

   Godaannya jelas: menyimpan `risk_score` pada tabel berita membuatnya bisa
   diurutkan dan disaring di peladen, dan itu memang yang dituntut arsip besar.

   Tetapi skor yang tersimpan adalah skor yang membeku. Faktor laju dan
   tanggapan berubah setiap hari — sebuah peristiwa yang berskor 82 kemarin
   pagi bisa berskor 61 sore ini karena unitnya sudah bersikap. Kolom tersimpan
   yang tidak dihitung ulang akan menyebut 82 selamanya, dan tidak ada satu
   kalimat pun di layar yang menjelaskan kenapa angkanya tidak cocok dengan
   keadaan.

   Bila kelak skor perlu disimpan — dan pada arsip yang jauh lebih besar itu
   akan perlu — yang disimpan harus disertai `dihitung_pada`, dan layar harus
   menyebut umurnya. Menyimpannya tanpa itu lebih buruk daripada tidak
   menyimpannya sama sekali.
*/
