/**
 * Standar Intelijen Pemasyarakatan (SIP) 2023 — kosakata produk intelijen.
 *
 * Sumbernya Keputusan Dirjenpas Nomor PAS-17.OT.02.02 Tahun 2023 tentang
 * Standar Intelijen Pemasyarakatan: bab 1.7 huruf e (Klasifikasi Produk
 * Intelijen), bagian penilaian sumber dan kebenaran bahan keterangan, Lampiran
 * I A-D (formulir laporan), dan Lampiran VI (Panduan Pengaburan Informasi).
 * Halaman buku disebut di tiap bagian supaya bisa dicocokkan ulang.
 *
 * ## Yang dinilai mesin, dan yang tidak pernah
 *
 * Arsip ini menerima ribuan berita seminggu. Penilaian yang hanya bisa diisi
 * manusia per baris tidak akan pernah terisi, jadi mesin menyarankan nilainya
 * dari tanda yang sudah tercatat (tier media, jumlah media, sikap unit, hasil
 * verifikasi). Tetapi tiga hal SENGAJA tidak pernah dipilih mesin:
 *
 *   - Evaluasi sumber "A" (selalu andal). Buku meminta rekam jejak tangan
 *     pertama yang sudah dikenal; daftar tier media tidak mengetahuinya.
 *   - Prioritas "Mendesak". Ia untuk laporan yang memengaruhi keamanan negara
 *     dan mengancam jiwa, berpasangan dengan klasifikasi SR. Kata "Kritis"
 *     di mesin klasifikasi berarti genting bagi unit, bukan bagi negara.
 *   - Klasifikasi SR dan R. Keduanya membatasi pembaca sampai tingkat Dirjen
 *     dan direktur; yang menetapkannya harus orang yang bertanggung jawab
 *     atas pembatasan itu.
 *
 * Penilaian analis (tabel rekomendasi_berita) selalu menang atas saran mesin.
 *
 * ## Hubungan dengan klasifikasi-informasi.js
 *
 * Berkas itu menjawab "sejauh mana berkas ini boleh berjalan" dengan lima
 * tingkat internal, dan dipakai untuk menolak unduhan peran yang tidak
 * berhak. Berkas ini memetakan kelima tingkat itu ke kode SIP yang dicetak
 * di kepala produk. Pemetaannya satu arah dan hanya bisa NAIK: pengguna boleh
 * menandai berkas lebih tinggi dari hitungan mesin, tidak lebih rendah.
 */

import { URGENSI_MENDESAK, dikecualikan } from './hitung.js'
import { ember } from './sentimen.js'
import { tingkatDari } from './klasifikasi-informasi.js'

/* ----------------------------------------------------- klasifikasi keamanan */

/**
 * Empat klasifikasi keamanan, dari yang paling longgar (SIP hlm. 28-29).
 *
 * `tingkat` menunjuk tingkat internal yang hak bawanya dipakai untuk kode ini,
 * supaya penegakan hak tetap satu daftar di klasifikasi-informasi.js.
 */
export const KLASIFIKASI = [
  {
    kode: 'YPM',
    label: 'Yang Perlu Mengetahui',
    urutan: 1,
    tingkat: 'internal',
    akses: 'Orang yang perlu mengetahui, ke samping, ke atas, dan ke bawah, yang secara resmi bertanggung jawab atas informasinya.',
  },
  {
    kode: 'YB',
    label: 'Yang Berkepentingan',
    urutan: 2,
    tingkat: 'rahasia',
    akses: 'Dirjen Pemasyarakatan, Direktur Kamtib, Kantor Wilayah, KOMINPUS, dan KOMINDA.',
  },
  {
    kode: 'R',
    label: 'Rahasia',
    urutan: 3,
    tingkat: 'sangat_terbatas',
    akses: 'Dirjen Pemasyarakatan, Direktur Kamtib, KOMINPUS, dan KOMINDA.',
  },
  {
    kode: 'SR',
    label: 'Sangat Rahasia',
    urutan: 4,
    tingkat: 'sangat_terbatas',
    akses: 'Hanya Direktur Jenderal Pemasyarakatan.',
  },
]

const PETA_KLASIFIKASI = new Map(KLASIFIKASI.map((k) => [k.kode, k]))

export function klasifikasi(kode) {
  return PETA_KLASIFIKASI.get(kode) || PETA_KLASIFIKASI.get('YPM')
}

/**
 * Kode SIP untuk tingkat internal. Tingkat "rahasia" internal (isu mendesak
 * atau tuduhan yang belum diperiksa) menjadi YB, bukan R: namanya mirip,
 * artinya tidak. R di SIP membatasi pembaca sampai direktur.
 */
const DARI_TINGKAT = {
  publik: 'YPM',
  internal: 'YPM',
  terbatas: 'YB',
  rahasia: 'YB',
  sangat_terbatas: 'R',
}

export function klasifikasiDariTingkat(tingkat) {
  return DARI_TINGKAT[tingkatDari(tingkat).kode] || 'YPM'
}

/** Klasifikasi yang lebih tinggi di antara dua kode. */
export function klasifikasiTertinggi(a, b) {
  return klasifikasi(a).urutan >= klasifikasi(b).urutan ? klasifikasi(a).kode : klasifikasi(b).kode
}

/** Pilihan yang sah bila hitungan mesin menghasilkan `minimum`. */
export function pilihanKlasifikasi(minimum) {
  const lantai = klasifikasi(minimum).urutan
  return KLASIFIKASI.filter((k) => k.urutan >= lantai)
}

/* ----------------------------------------------------------------- prioritas */

/** Tiga prioritas dan batas waktu tanganinya (SIP hlm. 29-30). */
export const PRIORITAS = [
  {
    kode: 'M',
    label: 'Mendesak',
    urutan: 3,
    batas: 'Secepat mungkin, mendahului laporan lain',
    ket: 'Memengaruhi keamanan negara dan mengancam jiwa.',
  },
  {
    kode: 'S',
    label: 'Segera',
    urutan: 2,
    batas: 'Paling lambat 30 menit',
    ket: 'Memengaruhi kamtib operasional UPT: kerusuhan, pelarian, bencana, kematian, narkotika, terorisme, serangan dari luar, unjuk rasa.',
  },
  {
    kode: 'Rt',
    label: 'Rutin',
    urutan: 1,
    batas: 'Paling lambat 1 x 24 jam',
    ket: 'Berpotensi mengganggu kamtib, tetapi tidak mendesak dan tidak segera.',
  },
]

const PETA_PRIORITAS = new Map(PRIORITAS.map((p) => [p.kode, p]))

/**
 * Klasifikasi yang menyertai tiap prioritas (SIP hlm. 30: "laporan memiliki
 * klasifikasi keamanan SR / YB / YPM"). R tidak berpasangan dengan prioritas
 * mana pun di buku, jadi hanya bisa dipilih langsung.
 */
const PASANGAN_PRIORITAS = { M: 'SR', S: 'YB', Rt: 'YPM' }

export function prioritas(kode) {
  return PETA_PRIORITAS.get(kode) || PETA_PRIORITAS.get('Rt')
}

/** Urgensi apa adanya ditulis sumber, tidak selalu berhuruf sama ("SEDANG"). */
export function urgensiBaku(nilai) {
  const s = String(nilai || '').trim().toLowerCase()
  const peta = { kritis: 'Kritis', tinggi: 'Tinggi', sedang: 'Sedang', rendah: 'Rendah' }
  return peta[s] || 'Rendah'
}

/**
 * Prioritas SIP sebuah berita.
 *
 * Hanya berita negatif yang bisa naik dari Rutin: berita positif berurgensi
 * tinggi tetap kabar baik, tidak perlu ditangani dalam 30 menit. Mendesak
 * tidak pernah dari sini (lihat kepala berkas).
 */
export function prioritasBerita(b) {
  if (!b || ember(b) !== 'negatif' || dikecualikan(b)) return 'Rt'
  return URGENSI_MENDESAK.includes(urgensiBaku(b.urgensi)) ? 'S' : 'Rt'
}

/** Prioritas sebuah kumpulan: yang tertinggi di antara isinya. */
export function prioritasKumpulan(daftar = []) {
  let hasil = 'Rt'
  for (const b of daftar) {
    if (prioritasBerita(b) === 'S') { hasil = 'S'; break }
  }
  return hasil
}

/* ---------------------------------------------------------------- evaluasi */

/** Evaluasi sumber (Lampiran I, SIP hlm. 24-25). */
export const EVALUASI_SUMBER = [
  { kode: 'A', label: 'Selalu andal' },
  { kode: 'B', label: 'Hampir selalu andal' },
  { kode: 'C', label: 'Terkadang andal' },
  { kode: 'D', label: 'Tidak dapat diandalkan' },
  { kode: 'E', label: 'Sumber belum diuji' },
]

/** Evaluasi kebenaran informasi (Lampiran I, SIP hlm. 26). */
export const EVALUASI_INFORMASI = [
  { kode: '1', label: 'Sangat dipercaya dan benar' },
  { kode: '2', label: 'Biasanya dapat dipercaya' },
  { kode: '3', label: 'Agak dapat dipercaya' },
  { kode: '4', label: 'Diragukan' },
  { kode: '5', label: 'Tidak dapat dipercaya' },
]

export function labelSumber(kode) {
  return EVALUASI_SUMBER.find((e) => e.kode === kode)?.label || ''
}
export function labelInformasi(kode) {
  return EVALUASI_INFORMASI.find((e) => e.kode === String(kode))?.label || ''
}

/**
 * Saran mesin untuk evaluasi sumber, dari tier media.
 *
 * Tier 4 adalah tempat setiap domain baru mendaftar sendiri sebelum ditelaah,
 * jadi artinya persis "sumber belum diuji" (E), bukan "tidak dapat
 * diandalkan" (D). D menyatakan rekam jejak buruk; mesin tidak punya rekam
 * jejak itu, dan menuduh media lokal tidak andal hanya karena belum dikenal
 * adalah kekeliruan yang terbaca di setiap berkas.
 */
export function sumberMesin(b) {
  const tier = Number(b?.tier_media)
  if (tier === 1) return 'B'
  if (tier === 2 || tier === 3) return 'C'
  return 'E'
}

/**
 * Saran mesin untuk evaluasi kebenaran informasi.
 *
 * Urutannya dari tanda yang paling kuat: hasil pemeriksaan manusia lebih
 * dulu, lalu sikap unit, baru jumlah dan mutu media. Tanpa pemeriksaan apa
 * pun, berita tunggal dari sumber yang belum diuji "diragukan" — bukan
 * "tidak dapat dipercaya", sebab belum ada yang membantahnya.
 *
 * @param {object} b
 * @param {{media?:number, keputusan?:object|null}} [konteks]
 */
export function informasiMesin(b, { media = 1, keputusan = null } = {}) {
  const hasil = keputusan?.hasil_verifikasi
  if (hasil === 'Tidak Sesuai' || b?.status_verifikasi === 'Tidak Valid') return '5'
  if (hasil === 'Sesuai Fakta') return '1'
  if (hasil === 'Sebagian Sesuai') return '3'

  const sikap = b?.tanggapan_sikap
  if (sikap === 'Tidak Benar') return '5'
  if (sikap === 'Dibenarkan' || sikap === 'Sudah Ditangani') return '1'
  if (sikap === 'Sebagian Benar') return '3'
  if (b?.status_verifikasi === 'Terverifikasi') return '2'

  const tier = Number(b?.tier_media)
  if (media >= 2) return '2'
  if (tier === 1 || tier === 2) return '3'
  if (tier === 3) return '3'
  return '4'
}

/**
 * Nilai akhir satu berita: penilaian analis bila ada, saran mesin bila tidak.
 * `dasar` menyebut asalnya, karena berkas yang keluar harus bisa membedakan
 * nilai yang ditimbang manusia dari nilai yang ditebak mesin.
 */
export function evaluasiBerita(b, { media = 1, keputusan = null } = {}) {
  const sumberAnalis = keputusan?.evaluasi_sumber || null
  const infoAnalis = keputusan?.evaluasi_informasi || null
  const sumber = sumberAnalis || sumberMesin(b)
  const informasi = infoAnalis || informasiMesin(b, { media, keputusan })
  return {
    sumber,
    informasi: String(informasi),
    nilai: `${sumber}${informasi}`,
    dasar: sumberAnalis || infoAnalis ? 'analis' : 'mesin',
  }
}

/* ------------------------------------------------------- kode penyebarluasan */

/** Kode penyebarluasan (Lampiran I A-D). */
export const KODE_SEBAR = [
  { kode: 'A', label: 'Ke Menteri, Dirjenpas, dan Direktur Kamtib' },
  { kode: 'B', label: 'Ke KOMINPUS, KOMINDA, K/L penyelenggara intelijen, Pemda' },
  { kode: 'C', label: 'Dapat disebarluaskan ke BPH asing (kondisi khusus berlaku)' },
  { kode: 'D', label: 'Ke samping, ke bawah, dan ke atas, internal dan eksternal lembaga' },
  { kode: 'E', label: 'Tidak ada penyebarluasan; menunggu arahan lebih lanjut' },
]

export function kodeSebar(kode) {
  return KODE_SEBAR.find((k) => k.kode === kode) || KODE_SEBAR[4]
}

/**
 * Kode penyebarluasan yang sah untuk sebuah klasifikasi.
 *
 * Buku tidak memuat matriksnya; yang ditegakkan di sini hanya yang terbaca
 * langsung dari daftar akses tiap klasifikasi. SR hanya untuk Dirjen, jadi
 * tidak boleh lebih jauh dari A. R berhenti di direktur dan komunitas
 * intelijen, jadi A atau B. Selebihnya dibiarkan pada penilaian pengirim.
 */
export function kodeSebarBoleh(kodeKlasifikasi) {
  if (kodeKlasifikasi === 'SR') return ['A', 'E']
  if (kodeKlasifikasi === 'R') return ['A', 'B', 'E']
  return KODE_SEBAR.map((k) => k.kode)
}

/** Benar bila berkas ini akan berjalan ke luar pimpinan Pemasyarakatan. */
export function keluarPimpinan(kode) {
  return ['B', 'C', 'D'].includes(kode)
}

/* -------------------------------------------------------- jenis laporan */

/** Empat produk intelijen (SIP hlm. 27-28). */
export const JENIS_PRODUK = {
  harian: 'Laporan Harian',
  informasi: 'Laporan Informasi',
  perkiraan: 'Laporan Perkiraan Intelijen',
  intelijen: 'Laporan Intelijen',
}

/**
 * Jenis produk untuk laporan berkala. Harian adalah Laporan Harian. Rekap
 * mingguan dan bulanan menghimpun banyak Laporan Informasi (pemberitaan media
 * termasuk di dalamnya, hlm. 28) dan menutupnya dengan perkiraan serta
 * rekomendasi: itu Laporan Perkiraan Intelijen.
 */
export function jenisProdukBerkala(jenis) {
  return jenis === 'harian' ? JENIS_PRODUK.harian : JENIS_PRODUK.perkiraan
}

/* ------------------------------------------------------- penandaan produk */

/** Kalimat pembatas yang tercetak di atas dan bawah setiap formulir SIP. */
export const PERNYATAAN_PEMBATAS = 'Informasi yang disajikan hanya digunakan untuk tujuan intelijen. '
  + 'Informasi ini tidak dapat digunakan, atau disebarluaskan, untuk tujuan pembuktian atau '
  + 'peradilan. Informasi ini tidak boleh diungkapkan kepada pihak yang tidak berwenang, tanpa '
  + 'persetujuan tertulis dari pihak Intelijen Pemasyarakatan yang berwenang, dan/atau '
  + 'Direktorat Jenderal Pemasyarakatan.'

/**
 * Penandaan lengkap satu produk, dari pilihan pengguna dan hitungan mesin.
 *
 * Yang dipilih pengguna dipakai hanya bila sah: klasifikasi tidak boleh di
 * bawah minimum, prioritas tidak boleh di bawah pasangan klasifikasinya, dan
 * kode penyebarluasan harus ada di daftar boleh. Yang tidak sah diganti nilai
 * aman, tidak ditolak diam-diam, dan `koreksi` menyebut apa yang diganti.
 */
export function tandaiProduk({ minimum = 'YPM', pilihan = {}, prioritasMesin = 'Rt' } = {}) {
  const koreksi = []

  // Prioritas lebih dulu: ia yang membawa klasifikasi, bukan sebaliknya.
  // Buku menulis "laporan Segera memiliki klasifikasi YB", tidak "laporan YB
  // harus Segera". Rekap sepekan yang YB karena memuat tuduhan belum
  // diperiksa tidak lantas wajib ditangani dalam 30 menit.
  let p = pilihan.prioritas || prioritasMesin
  if (prioritas(p).urutan < prioritas(prioritasMesin).urutan) {
    koreksi.push(`Prioritas dinaikkan ke ${prioritas(prioritasMesin).label}: berkas memuat berita yang menuntutnya.`)
    p = prioritasMesin
  }
  const pasangan = PASANGAN_PRIORITAS[p]

  let kode = pilihan.klasifikasi || minimum
  const lantai = klasifikasiTertinggi(minimum, pasangan)
  if (klasifikasi(kode).urutan < klasifikasi(lantai).urutan) {
    koreksi.push(lantai === minimum
      ? `Klasifikasi dinaikkan ke ${lantai}: isinya memuat berita yang tidak boleh beredar lebih longgar.`
      : `Klasifikasi dinaikkan ke ${lantai}: laporan berprioritas ${prioritas(p).label} berklasifikasi ${pasangan}.`)
    kode = lantai
  }
  const k = klasifikasi(kode)

  let sebar = pilihan.kodeSebar || 'E'
  if (!kodeSebarBoleh(k.kode).includes(sebar)) {
    koreksi.push(`Kode penyebarluasan ${sebar} tidak sah untuk klasifikasi ${k.kode}; diganti E (menunggu arahan).`)
    sebar = 'E'
  }

  return {
    klasifikasi: k.kode,
    klasifikasiLabel: k.label,
    akses: k.akses,
    tingkat: k.tingkat,
    prioritas: p,
    prioritasLabel: prioritas(p).label,
    batas: prioritas(p).batas,
    kodeSebar: sebar,
    kodeSebarLabel: kodeSebar(sebar).label,
    ditujukan: String(pilihan.ditujukan || '').trim(),
    edaran: keluarPimpinan(sebar),
    koreksi,
  }
}

/* -------------------------------------------------------------- pengaburan */

/**
 * Pengaburan untuk versi edaran (Lampiran VI).
 *
 * Judul berita dan nama UPT TIDAK dikaburkan: keduanya sudah terbit di media
 * terbuka, dan berkas yang menyamarkannya tidak lagi bisa dicocokkan dengan
 * sumbernya. Yang dikaburkan adalah yang lahir di dalam sistem — identitas
 * petugas (huruf a), catatan analis yang bisa memuat nama orang dan instansi
 * (huruf a-b), dan nomor berkas (huruf d, diberi garis "-").
 */
export function kaburkanTeks(teks) {
  return String(teks || '')
    // Catatan analis: dibuang utuh. Isinya bebas dan tidak bisa disaring aman.
    .replace(/Catatan analis:.*$/s, 'Catatan analis: [dikaburkan]')
    // NIP 18 digit dan nomor telepon.
    .replace(/\b\d{18}\b/g, '[NIP]')
    .replace(/(\+62|\b0)8\d{7,11}\b/g, '[telepon]')
    .trim()
}

export const META_SIP = {
  versi: 'sip-2023-v1.0',
  sumber: 'Kepdirjenpas PAS-17.OT.02.02 Tahun 2023',
  klasifikasi: KLASIFIKASI.length,
  prioritas: PRIORITAS.length,
}
