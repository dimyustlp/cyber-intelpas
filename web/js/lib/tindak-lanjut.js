/**
 * Saran tindak lanjut — apa yang sebaiknya dilakukan atas sebuah berita negatif.
 *
 * Pertanyaan yang dijawabnya datang dari pimpinan, dan selalu sama: "yang ini
 * harus kita datangi, atau cukup kita jawab?" Sampai berkas ini ada, jawabannya
 * tinggal di kepala analis. Analis yang berganti shift membawa jawabannya
 * pulang, dan berita yang sama bisa dijawab sidak oleh yang satu dan dibiarkan
 * oleh yang lain.
 *
 * ## Empat tindakan, bukan dua
 *
 * Permintaan awalnya dua pilihan: tangani langsung (sidak), atau cukup
 * statement klarifikasi bila beritanya tidak sesuai. Dua pilihan itu benar
 * hanya SESUDAH diketahui apakah beritanya sesuai fakta — dan itulah yang
 * paling sering belum diketahui ketika berita pertama masuk. Memaksa pilihan
 * dua arah pada saat itu berarti menebak, dan tebakan yang meleset ke arah
 * sidak mengirim tim ke tempat yang tidak ada apa-apanya, sedangkan yang
 * meleset ke arah klarifikasi membantah kejadian yang sungguh terjadi.
 *
 * Maka ada tindakan ketiga: VERIFIKASI — periksa dulu ke unit, lalu putuskan.
 * Dan yang keempat, PANTAU, untuk berita negatif yang tidak menuntut apa-apa
 * selain dilihat sekali lagi besok.
 *
 * ## Mesin menyarankan, analis memutuskan
 *
 * Saran dihitung dari tanda-tanda yang sudah ada di data — subkategori dan
 * pelakunya, urgensi, kualitas dan jumlah media, serta sikap unit bila sudah
 * menjawab. Setiap saran membawa ALASANNYA, ditulis sebagai kalimat, karena
 * saran yang tidak bisa dibantah tidak bisa dipercaya. Keputusan analis
 * (disimpan di tabel rekomendasi_berita) selalu menang atas saran mesin, dan
 * layar menampilkan keduanya bila berbeda: perbedaan itu informasi, bukan
 * galat.
 *
 * ## Urutan pemeriksaan
 *
 * Tanda dari UNIT dan dari jenis isu didahulukan daripada tanda dari urgensi,
 * karena yang pertama berbicara tentang apakah beritanya benar, dan yang
 * kedua hanya tentang seberapa buruk SEANDAINYA benar. Berita hoaks berurgensi
 * tinggi tetap hoaks; ia tidak lantas layak dikunjungi tim.
 *
 *   1. Subkategori Hoaks dan Kampanye Hitam        -> klarifikasi
 *   2. Unit menyatakan Tidak Benar / Sebagian Benar -> klarifikasi
 *   3. Unit menyatakan Sudah Ditangani              -> klarifikasi
 *      (kejadian benar, tetapi jawabannya kini keterangan resmi, bukan tim)
 *   4. Unit menyatakan Dibenarkan, atau telaah wilayah Perlu Perhatian
 *                                                   -> sidak bila urgensi >= Sedang
 *   5. Telaah wilayah Bukan Unit Kami               -> verifikasi (periksa pemetaan)
 *   6. Urgensi Kritis                               -> sidak, tanpa menunggu konfirmasi
 *   7. Urgensi Tinggi                               -> sidak bila terkonfirmasi,
 *                                                      verifikasi bila belum
 *   8. Urgensi Sedang, terkonfirmasi, dan menyangkut petugas atau diangkat
 *      tiga media atau lebih                        -> verifikasi
 *   9. Selebihnya                                   -> pantau
 *
 * "Terkonfirmasi" berarti diberitakan media tier 1-2, atau oleh dua media
 * berbeda atau lebih. Berita dari satu akun media sosial yang menyebut
 * penyerangan tidak sama nilainya dengan Kompas dan Tempo yang menyebut hal
 * yang sama. Sebagian besar arsip (tier 4) memang bersumber dari agregator
 * dan media sosial, jadi mayoritas berita berurgensi tinggi akan mendapat
 * saran VERIFIKASI, bukan SIDAK — dan itu disengaja.
 */

import { cariSubkategori, PERINGKAT_URGENSI } from './taksonomi.js'
import { ember } from './sentimen.js'
import { diLuarLingkup, dikecualikan } from './hitung.js'

/**
 * Keempat tindakan, dari yang paling berat. Urutannya dipakai untuk memilih
 * yang terberat ketika sebuah peristiwa memuat beberapa berita.
 */
export const TINDAKAN = [
  {
    kode: 'sidak',
    label: 'Tangani langsung (sidak)',
    pendek: 'Sidak',
    nada: 'kritis',
    ket: 'Kejadian ini cukup pasti dan cukup berat untuk didatangi: tugaskan pemeriksaan langsung ke unit.',
    langkah: [
      'Hubungi Kepala UPT atau Kepala Kantor Wilayah, minta kronologi awal tertulis dalam 1 x 24 jam.',
      'Terbitkan penugasan lapangan lewat Kasus Intelijen lalu Verifikasi Lapangan; bawa bukti yang ada ke petugas.',
      'Laporkan kepada pimpinan bila urgensinya Tinggi atau Kritis, jangan menunggu hasil sidak.',
      'Siapkan satu pintu keterangan resmi bila beritanya sudah diangkat lebih dari dua media.',
    ],
  },
  {
    kode: 'klarifikasi',
    label: 'Statement klarifikasi',
    pendek: 'Klarifikasi',
    nada: 'sedang',
    ket: 'Beritanya keliru, sebagian keliru, atau kejadiannya sudah ditangani: cukup dijawab dengan keterangan resmi.',
    langkah: [
      'Kumpulkan bukti dari unit: kronologi, foto atau rekaman, dan dokumen yang membantah.',
      'Susun statement atau hak jawab yang singkat; sampaikan lewat Humas, bukan lewat akun pribadi.',
      'Bila ada kekeliruan fakta yang jelas, minta media terkait mengoreksi beritanya.',
      'Catat hasilnya sebagai Tidak Sesuai atau Sebagian Sesuai supaya tidak ditanyakan dua kali.',
    ],
  },
  {
    kode: 'verifikasi',
    label: 'Verifikasi dulu',
    pendek: 'Verifikasi',
    nada: 'rendah',
    ket: 'Belum bisa diputuskan: periksa ke unit dan sumber aslinya, lalu pilih sidak atau klarifikasi.',
    langkah: [
      'Minta konfirmasi unit lewat telepon atau lewat Telaah Wilayah; catat siapa yang menjawab.',
      'Buka sumber aslinya dan cari media lain yang memuat kejadian yang sama.',
      'Putuskan sesudahnya: bila benar, ubah menjadi sidak; bila tidak, menjadi klarifikasi.',
      'Beri batas waktu. Verifikasi yang tidak punya tenggat berubah menjadi pembiaran.',
    ],
  },
  {
    kode: 'pantau',
    label: 'Pantau dan arsipkan',
    pendek: 'Pantau',
    nada: 'netral',
    ket: 'Berita negatif yang belum menuntut tindakan. Cukup dilihat ulang besok.',
    langkah: [
      'Biarkan masuk Deteksi Lonjakan; ia akan menyala sendiri bila beritanya berkembang.',
      'Lihat ulang dalam 24 sampai 48 jam. Arsipkan bila tidak berkembang.',
    ],
  },
]

/** Peringkat tiap tindakan; makin besar makin berat. */
const BERAT = { sidak: 4, klarifikasi: 3, verifikasi: 2, pantau: 1 }

/** Hasil verifikasi yang bisa dicatat analis. */
export const HASIL_VERIFIKASI = [
  { kode: 'Sesuai Fakta', ket: 'Isi berita sesuai dengan keadaan sebenarnya.', tindakan: 'sidak' },
  { kode: 'Sebagian Sesuai', ket: 'Ada bagian yang benar dan ada yang keliru.', tindakan: 'klarifikasi' },
  { kode: 'Tidak Sesuai', ket: 'Isi berita tidak sesuai dengan keadaan sebenarnya.', tindakan: 'klarifikasi' },
  { kode: 'Belum Dapat Dipastikan', ket: 'Pemeriksaan belum menghasilkan kepastian.', tindakan: 'verifikasi' },
]

/** Satu tindakan menurut kodenya. */
export function tindakan(kode) {
  return TINDAKAN.find((t) => t.kode === kode) || null
}

/** Benar bila berita ini layak diberi saran: negatif, dalam lingkup, belum dikecualikan. */
export function layakDisarankan(b) {
  if (!b) return false
  if (diLuarLingkup(b) || dikecualikan(b)) return false
  return ember(b) === 'negatif'
}

/**
 * Terkonfirmasi: ada alasan menganggap kejadiannya memang terjadi.
 *
 * Tier 1 dan 2 adalah media yang punya redaksi dan reputasi; dua media berbeda
 * yang menyebut kejadian yang sama juga cukup, karena dua sumber yang tidak
 * saling menyalin jarang keliru bersama-sama.
 */
export function terkonfirmasi(b, media = 1) {
  const tier = Number(b?.tier_media)
  if (Number.isFinite(tier) && tier >= 1 && tier <= 2) return true
  return media >= 2
}

/** Satu saran lengkap, dalam bentuk yang sama dari mana pun ia dibuat. */
function saran(kode, alasan, dasar = 'mesin') {
  const t = tindakan(kode)
  return { kode, label: t.label, pendek: t.pendek, nada: t.nada, alasan, langkah: t.langkah, dasar }
}

/**
 * Saran MESIN untuk satu berita, tanpa keputusan analis.
 *
 * @param {object} b       baris berita
 * @param {number} [media] jumlah media berbeda yang memuat kejadian yang sama
 * @returns {object|null}  null bila berita ini tidak layak diberi saran
 */
export function sarankanMesin(b, media = 1) {
  if (!layakDisarankan(b)) return null

  const sub = cariSubkategori(b.subkategori_kode)
  const urgensi = PERINGKAT_URGENSI[b.urgensi] || 1
  const konfirm = terkonfirmasi(b, media)
  const sikap = b.tanggapan_sikap
  const telaah = b.telaah_wilayah_status
  const alasan = []

  // 1. Isu yang kabarnya sendiri keliru.
  if (sub?.kode === '7.1') {
    alasan.push('Subkategorinya Hoaks dan Kampanye Hitam: yang bermasalah adalah kabarnya, bukan unitnya.')
    alasan.push('Jawabannya keterangan resmi, bukan pemeriksaan ke dalam.')
    return saran('klarifikasi', alasan)
  }

  // 2-3. Yang unit katakan menentukan apakah beritanya benar.
  if (sikap === 'Tidak Benar') {
    alasan.push('Unit menyatakan isi berita tidak sesuai keadaan di unit.')
    return saran('klarifikasi', alasan, 'unit')
  }
  if (sikap === 'Sebagian Benar') {
    alasan.push('Unit menyatakan sebagian isi berita benar dan sebagian keliru.')
    alasan.push('Klarifikasi bagian yang keliru; tindak bagian yang benar secara terpisah.')
    return saran('klarifikasi', alasan, 'unit')
  }
  if (sikap === 'Sudah Ditangani') {
    alasan.push('Unit menyatakan kejadiannya benar dan tindakannya sudah diambil.')
    alasan.push('Yang tersisa menjawab publik: sampaikan tindakan yang sudah dilakukan.')
    return saran('klarifikasi', alasan, 'unit')
  }

  // 4. Unit membenarkan, atau daerah menyatakan perlu perhatian.
  if (sikap === 'Dibenarkan' || telaah === 'Perlu Perhatian') {
    alasan.push(sikap === 'Dibenarkan'
      ? 'Unit membenarkan isi berita.'
      : 'Telaah wilayah menyatakan kabar ini benar dan menuntut tindakan.')
    if (urgensi >= 2) {
      alasan.push(`Urgensinya ${b.urgensi}.`)
      return saran('sidak', alasan, 'unit')
    }
    alasan.push('Urgensinya rendah, jadi cukup dipantau sambil menunggu perkembangan.')
    return saran('pantau', alasan, 'unit')
  }

  // 5. Daerah menolak kabar ini sebagai urusannya.
  if (telaah === 'Bukan Unit Kami') {
    alasan.push('Telaah wilayah menyatakan kabar ini bukan menyangkut unit atau wilayahnya.')
    alasan.push('Periksa pemetaan UPT; mungkin berita ini terhubung ke unit yang keliru.')
    return saran('verifikasi', alasan, 'unit')
  }

  // 6. Yang kritis tidak menunggu konfirmasi.
  if (urgensi >= 4) {
    alasan.push('Urgensinya Kritis: kejadian yang menyangkut keselamatan atau keamanan unit.')
    if (!konfirm) alasan.push('Belum terkonfirmasi media lain; konfirmasi sambil menugaskan, jangan sebelumnya.')
    return saran('sidak', alasan)
  }

  // 7. Tinggi: terkonfirmasi atau belum.
  if (urgensi === 3) {
    alasan.push('Urgensinya Tinggi.')
    if (konfirm) {
      alasan.push(media >= 2
        ? `Diberitakan ${media} media berbeda, jadi kejadiannya sangat mungkin sungguh terjadi.`
        : 'Dimuat media tier 1 atau 2, yang punya redaksi dan reputasi.')
      return saran('sidak', alasan)
    }
    alasan.push('Belum terkonfirmasi: sumbernya tunggal atau media tier 3-4. Periksa dulu sebelum mengirim tim.')
    return saran('verifikasi', alasan)
  }

  // 8. Sedang: hanya yang menyangkut petugas atau yang ramai diangkat.
  if (urgensi === 2 && konfirm) {
    const petugas = sub && (sub.aktor === 'petugas' || sub.aktor === 'campuran')
    if (petugas || media >= 3) {
      alasan.push('Urgensinya Sedang, tetapi terkonfirmasi.')
      alasan.push(petugas
        ? 'Menyangkut petugas; dugaan pelanggaran integritas tidak boleh dibiarkan tanpa diperiksa.'
        : `Diangkat ${media} media berbeda; tekanan opininya sudah nyata.`)
      return saran('verifikasi', alasan)
    }
  }

  // 9. Selebihnya.
  alasan.push(urgensi >= 2
    ? 'Urgensinya Sedang dan belum ada tanda yang menuntut pemeriksaan.'
    : 'Urgensinya Rendah.')
  return saran('pantau', alasan)
}

/**
 * Saran akhir untuk satu berita: keputusan analis bila ada, saran mesin bila tidak.
 *
 * @param {object} b
 * @param {{media?:number, keputusan?:object|null}} [konteks]
 *        keputusan: baris tabel rekomendasi_berita untuk berita ini
 */
export function sarankanTindak(b, { media = 1, keputusan = null } = {}) {
  const mesin = sarankanMesin(b, media)

  if (keputusan && tindakan(keputusan.tindakan)) {
    const alasan = []
    if (keputusan.hasil_verifikasi) alasan.push(`Hasil verifikasi: ${keputusan.hasil_verifikasi}.`)
    if (keputusan.catatan) alasan.push(`Catatan analis: ${keputusan.catatan}`)
    const akhir = saran(keputusan.tindakan, alasan, 'analis')
    return {
      ...akhir,
      oleh: keputusan.diputuskan_oleh || null,
      pada: keputusan.diputuskan_pada || null,
      hasil: keputusan.hasil_verifikasi || null,
      // Perbedaan dengan mesin ditandai, tidak dihapus.
      mesin: mesin ? { kode: mesin.kode, pendek: mesin.pendek, alasan: mesin.alasan } : null,
      berbeda: Boolean(mesin && mesin.kode !== keputusan.tindakan),
    }
  }

  return mesin ? { ...mesin, mesin: null, berbeda: false } : null
}

/**
 * Saran untuk satu peristiwa — gabungan beberapa publikasi.
 *
 * Keputusan analis atas publikasi mana pun menang; bila ada beberapa, yang
 * terbaru. Tanpa keputusan, yang dinilai adalah publikasi TERBERAT, dengan
 * jumlah media dari seluruh peristiwa. Memilih rata-rata akan membuat satu
 * publikasi kritis tenggelam di antara sepuluh yang biasa.
 *
 * @param {object} p peristiwa dari lib/peristiwa.js
 * @param {Map<string, object>} [keputusanPer] id berita -> baris keputusan
 */
export function sarankanPeristiwa(p, keputusanPer = new Map()) {
  const anggota = p?.publikasi || []
  const media = p?.jumlah_media || 1

  let terbaru = null
  for (const b of anggota) {
    const k = keputusanPer.get(b.id)
    if (k && (!terbaru || String(k.diputuskan_pada) > String(terbaru.k.diputuskan_pada))) terbaru = { b, k }
  }
  if (terbaru) return { ...sarankanTindak(terbaru.b, { media, keputusan: terbaru.k }), berita: terbaru.b }

  let terberat = null
  for (const b of anggota) {
    const s = sarankanMesin(b, media)
    if (!s) continue
    // Seri dipecahkan urgensi yang lebih tinggi: dua saran verifikasi tidak
    // sama gentingnya bila yang satu berurgensi Tinggi.
    const skor = BERAT[s.kode] * 10 + (PERINGKAT_URGENSI[b.urgensi] || 0)
    if (!terberat || skor > terberat.skor) terberat = { s, b, skor }
  }
  return terberat ? { ...terberat.s, mesin: null, berbeda: false, berita: terberat.b } : null
}

/** Hitungan per tindakan atas daftar saran, untuk ringkasan di puncak halaman. */
export function hitungTindakan(daftarSaran = []) {
  const hasil = { sidak: 0, klarifikasi: 0, verifikasi: 0, pantau: 0, tanpa: 0 }
  for (const s of daftarSaran) {
    if (!s) hasil.tanpa += 1
    else hasil[s.kode] += 1
  }
  return hasil
}
