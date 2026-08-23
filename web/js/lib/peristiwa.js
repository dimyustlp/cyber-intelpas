/**
 * Pengelompokan peristiwa dan validasi hasil mesin.
 *
 * Lapisan ini menjawab satu keluhan yang wajar dari siapa pun yang membaca
 * laporan: satu kejadian yang sama diberitakan sebelas kali, lalu laporan
 * menghitungnya sebelas kali juga. Pekan 16–22 Agustus adalah contohnya —
 * sembilan dari sembilan publikasi "Pelarian WBP" sebenarnya satu narapidana
 * yang sama, kabur satu kali, dari satu unit.
 *
 * Angka sebelas tidak salah sebagai hitungan publikasi. Yang salah adalah
 * membiarkan pimpinan membacanya sebagai sebelas kejadian. Maka mulai sekarang
 * laporan menyebut dua angka: berapa peristiwanya, dan berapa kali diberitakan.
 * Eksposur media memang penting — tetapi ia ukuran tekanan opini, bukan ukuran
 * jumlah insiden.
 *
 * Yang dikerjakan berkas ini:
 *
 *   1. Menggabungkan publikasi yang menunjuk satu peristiwa yang sama.
 *   2. Menandai publikasi kembar — teks yang nyaris identik, biasanya karena
 *      satu rilis disalin banyak media atau satu unggahan tercatat dua kali.
 *   3. Memvalidasi hasil mesin: mencari pertentangan antarsinyal, dan
 *      menurunkan berita yang meragukan ke antrean telaah alih-alih
 *      membiarkannya masuk laporan seolah-olah sudah pasti.
 *
 * Modul ES murni. Dipakai di peramban, di Edge Function, dan oleh penyusun
 * laporan.
 */

import { normalkan, akarKata } from './teks.js'
import { belumTerpetakan } from './pencocokan-upt.js'

/** Rentang hari maksimum dua publikasi masih boleh dianggap satu peristiwa. */
const JENDELA_HARI = 10

/** Ambang kemiripan kata sebelum dua judul dianggap membicarakan hal yang sama. */
const AMBANG_SERUMPUN = 0.42

/** Ambang kemiripan ketika subkategori dan unitnya sudah sama-sama pasti. */
const AMBANG_SERUMPUN_UNIT = 0.12

/** Ambang kemiripan sebelum dua publikasi dianggap benar-benar kembar. */
const AMBANG_KEMBAR = 0.82

/**
 * Kata yang muncul di hampir semua judul pemasyarakatan, sehingga tidak
 * membantu membedakan satu peristiwa dari peristiwa lain.
 */
const KATA_HAMPA = new Set([
  'lapas', 'rutan', 'lpka', 'bapas', 'pemasyarakatan', 'kelas', 'iia', 'iib',
  'iii', 'kota', 'kabupaten', 'yang', 'dan', 'di', 'ke', 'dari', 'pada',
  'untuk', 'dengan', 'ini', 'itu', 'oleh', 'dalam', 'saat', 'akan', 'telah',
  'sudah', 'tidak', 'para', 'juga', 'adalah', 'atau', 'serta', 'bagi',
  'kepada', 'sebagai', 'karena', 'agar', 'lebih', 'bisa', 'ada', 'seorang',
  'sebuah', 'setelah', 'sebelum', 'hingga', 'sampai', 'namun', 'tetapi',
  'news', 'com', 'video', 'berita', 'terbaru', 'viral', 'update',
])

/**
 * Kata-kata yang menyebut hal yang sama dengan bunyi berbeda.
 *
 * Ini bagian yang paling sering menentukan benar-salahnya pengelompokan.
 * Satu narapidana yang kabur bisa ditulis "kabur" oleh satu media, "melarikan
 * diri" oleh media kedua, dan "buron" oleh media ketiga. Secara kata, ketiga
 * judul itu tidak berbagi apa pun selain nama lapasnya — padahal jelas satu
 * kejadian. Tanpa lapisan ini, satu peristiwa pecah menjadi tiga, dan laporan
 * pimpinan menghitung tiga insiden yang sebetulnya tidak pernah terjadi.
 *
 * Kunci di kiri adalah nama konsep; yang di kanan bentuk-bentuk yang dianggap
 * sama. Semua dibandingkan setelah dibawa ke bentuk akar.
 */
const KONSEP = {
  '~kabur': ['kabur', 'lari', 'larikan', 'melarikan', 'buron', 'buronan', 'lolos',
    'lepas', 'escape', 'alcatraz', 'kabuur', 'raib', 'hilang', 'menghilang'],
  '~narapidana': ['napi', 'narapidana', 'pidana', 'tahanan', 'warga binaan', 'wbp',
    'napiter', 'residivis'],
  '~selundup': ['selundup', 'seludup', 'menyelundupkan', 'penyelundupan', 'sisip',
    'sembunyikan', 'menyembunyikan', 'lempar', 'lemparan'],
  '~narkoba': ['narkoba', 'sabu', 'ganja', 'ekstasi', 'narkotika', 'psikotropika',
    'tembakau sintetis', 'metamfetamina'],
  '~pungli': ['pungli', 'pungutan', 'pemerasan', 'peras', 'memeras', 'setoran', 'upeti'],
  '~korupsi': ['korupsi', 'suap', 'gratifikasi', 'rasuah', 'sita', 'menyita', 'penyitaan'],
  '~mati': ['tewas', 'meninggal', 'mati', 'kematian', 'wafat', 'nyawa', 'jenazah', 'autopsi'],
  '~rusuh': ['rusuh', 'kerusuhan', 'ricuh', 'kericuhan', 'bentrok', 'huru hara', 'berontak',
    'pemberontakan', 'membakar', 'pembakaran'],
  '~aniaya': ['aniaya', 'penganiayaan', 'pukul', 'memukul', 'kekerasan', 'siksa', 'penyiksaan',
    'keroyok', 'pengeroyokan'],
  '~tangkap': ['tangkap', 'ditangkap', 'menangkap', 'amankan', 'diamankan', 'ciduk', 'diciduk',
    'gerebek', 'penggerebekan', 'razia'],
  '~periksa': ['periksa', 'diperiksa', 'pemeriksaan', 'selidik', 'penyelidikan', 'sidik',
    'penyidikan', 'usut', 'audit', 'investigasi'],
  '~asimilasi': ['asimilasi', 'integrasi', 'remisi', 'pembebasan', 'bebas bersyarat', 'cuti'],
  '~ponsel': ['ponsel', 'handphone', 'telepon genggam', 'gawai'],
}

/** Peta terbalik: satu kata akar menunjuk ke satu nama konsep. */
const PETA_KONSEP = (() => {
  const peta = new Map()
  for (const [konsep, daftar] of Object.entries(KONSEP)) {
    for (const bentuk of daftar) {
      for (const potong of bentuk.split(' ')) {
        peta.set(potong, konsep)
        for (const akar of akarKata(potong)) peta.set(akar, konsep)
      }
    }
  }
  return peta
})()

/* --------------------------------------------------------------- sidik kata */

/** Himpunan kata bermakna dari sebuah teks, sudah dibawa ke bentuk akarnya. */
function sidik(teks) {
  const hasil = new Set()
  for (const kata of normalkan(teks).split(' ')) {
    if (kata.length < 4 || KATA_HAMPA.has(kata)) continue
    // Bentuk akar dipakai supaya "melarikan" dan "pelarian" dianggap sama.
    const akar = [...akarKata(kata)].sort((a, b) => a.length - b.length)[0] || kata
    hasil.add(PETA_KONSEP.get(akar) || PETA_KONSEP.get(kata) || akar)
  }
  return hasil
}

/** Kemiripan dua himpunan: irisan dibagi himpunan terkecil. */
function kemiripan(a, b) {
  if (!a.size || !b.size) return 0
  let iris = 0
  const kecil = a.size <= b.size ? a : b
  const besar = kecil === a ? b : a
  for (const k of kecil) if (besar.has(k)) iris += 1
  return iris / kecil.size
}

function keHari(nilai) {
  const t = new Date(nilai)
  return Number.isNaN(t.getTime()) ? 0 : Math.floor(t.getTime() / 86400000)
}

/* ------------------------------------------------------- sumber dan judul */

/** Nama pengumpul, bukan nama media yang sebenarnya menulis. */
const PENGUMPUL = /^(google news|medsos|rss|feed|crawler|scraper)/i

/**
 * Nama media yang sebenarnya memuat sebuah berita.
 *
 * Kolom `media` pada basis data sering berisi nama pengumpulnya — "Google News
 * Pas", "Medsos Radar" — bukan penerbitnya. Kalau itu dipakai apa adanya,
 * empat berita dari empat koran berbeda terhitung sebagai satu media, dan
 * angka eksposur pada laporan menjadi jauh lebih kecil daripada kenyataannya.
 *
 * Nama penerbit hampir selalu masih ada: Google News menempelkannya di ujung
 * judul setelah tanda hubung, dan YouTube menaruh nama kanal di dalam kurung
 * siku. Keduanya diambil kembali di sini.
 */
export function sumberAsli(b) {
  const media = String(b.media || '').trim()

  const kanal = media.match(/\[([^\]]+)\]/)
  if (kanal) return kanal[1].trim()

  if (media && !PENGUMPUL.test(media)) return media

  const judul = String(b.judul || '')
  // Google News: "Judul berita - Nama Media" (kadang nama medianya diulang).
  const potong = judul.split(' - ').map((s) => s.trim()).filter(Boolean)
  if (potong.length > 1) {
    const ekor = potong[potong.length - 1]
    if (ekor.length <= 45 && !/\d{4}|\bkabur\b|\bditangkap\b/i.test(ekor)) return ekor
  }

  try {
    const inang = new URL(b.link || b.url).hostname.replace(/^www\./, '')
    if (inang && !/google|youtube|bit\.ly/i.test(inang)) return inang
  } catch { /* tautan kosong atau tidak sah */ }

  return media || 'Sumber tidak tercatat'
}

/** Membersihkan judul dari sisa-sisa pengumpul dan hiasan media sosial. */
export function rapikanJudul(teks) {
  let s = String(teks || '').trim()

  // Ekor "- Nama Media" dari Google News, kadang dua kali.
  s = s.replace(/\s+-\s+[^-]{2,45}(\s+-\s+[^-]{2,45})?\s*$/, '')
  // Tagar dan sisipan media sosial.
  s = s.replace(/[#＃][\p{L}\p{N}_]+/gu, ' ')
  s = s.replace(/\s{2,}/g, ' ').trim()
  // Judul yang seluruhnya huruf besar dikembalikan ke bentuk judul berita.
  if (s.length > 12 && s === s.toUpperCase() && /[A-Z]/.test(s)) s = keHurufJudul(s)
  return s.replace(/[\s,;:–—-]+$/, '').trim()
}

/** Kata sambung dan kata depan yang tetap huruf kecil di tengah judul. */
const KATA_KECIL = new Set([
  'di', 'ke', 'dari', 'dan', 'atau', 'yang', 'untuk', 'pada', 'dengan', 'oleh',
  'dalam', 'atas', 'bagi', 'serta', 'itu', 'ini', 'saat', 'ke', 'demi', 'per',
])

/** Singkatan yang tetap huruf besar seluruhnya. */
const AKRONIM = new Set([
  'KPK', 'BNN', 'BNNP', 'BNNK', 'TNI', 'ASN', 'PNS',
  'WBP', 'HAM', 'RI', 'UPT', 'SAE', 'DPR', 'PN', 'PT', 'CV', 'WNA', 'WNI',
  'IIA', 'IIB', 'IIC', 'IA', 'IB', 'III', 'HP', 'CCTV', 'OTT', 'SOP',
])

function keHurufJudul(teks) {
  const kata = teks.toLowerCase().split(/(\s+)/)
  let pertama = true
  return kata.map((k) => {
    if (!k.trim()) return k
    const polos = k.replace(/[^\p{L}\p{N}]/gu, '')
    if (AKRONIM.has(polos.toUpperCase())) {
      return k.replace(polos, polos.toUpperCase())
    }
    if (!pertama && KATA_KECIL.has(polos)) return k
    pertama = false
    return k.charAt(0).toUpperCase() + k.slice(1)
  }).join('')
}

/**
 * Judul yang paling layak mewakili sebuah peristiwa.
 *
 * Yang dicari bukan judul terpanjang, melainkan judul yang paling mungkin
 * dimengerti pimpinan saat membaca laporan: kalimat berita utuh dari penerbit
 * yang jelas, bukan potongan paragraf hasil salin-tempel media sosial dan
 * bukan judul meme berisi tagar.
 */
export function judulTerbaik(daftar) {
  let terbaik = null
  let nilaiTerbaik = -Infinity

  for (const b of daftar) {
    const asli = String(b.judul || '')
    const bersih = rapikanJudul(asli)
    if (!bersih) continue

    let nilai = 0
    const panjang = bersih.length

    // Panjang ideal sebuah judul berita: cukup menjelaskan, masih satu baris.
    if (panjang >= 40 && panjang <= 120) nilai += 6
    else if (panjang > 120 && panjang <= 180) nilai += 2
    else if (panjang > 180) nilai -= 4
    else if (panjang < 25) nilai -= 3

    if (/antara|kompas|detik|tempo|republika|cnn|tribun|liputan6|kumparan|suara|okezone/i
      .test(`${b.media || ''} ${asli}`)) nilai += 5
    if (/^(medsos|google news)/i.test(String(b.media || ''))) nilai += 0
    if (/youtube|tiktok|instagram|facebook/i.test(String(b.platform || b.media || ''))) nilai -= 3

    if (/[#＃]/.test(asli)) nilai -= 6
    if (asli === asli.toUpperCase() && asli.length > 12) nilai -= 3
    // Paragraf berita, bukan judul: diawali keterangan tempat-tanggal atau
    // memuat lebih dari satu kalimat penuh.
    if (/^\p{Lu}[\p{L} ]{2,20},\s*\d/u.test(asli)) nilai -= 5
    if ((asli.match(/\.\s+\p{Lu}/gu) || []).length >= 1) nilai -= 4
    if (/\b(sebagaimana|tersebut di|selengkapnya|baca juga)\b/i.test(asli)) nilai -= 3

    if (nilai > nilaiTerbaik) { nilaiTerbaik = nilai; terbaik = bersih }
  }

  return terbaik || rapikanJudul(daftar[0]?.judul) || 'Tanpa judul'
}

/* ------------------------------------------------------ kelompokkan peristiwa */

/**
 * Menggabungkan daftar berita menjadi daftar peristiwa.
 *
 * Dua publikasi dianggap satu peristiwa bila ketiganya terpenuhi: subkategori
 * sama, unit sama (atau salah satunya belum terpetakan), dan jaraknya tidak
 * lebih dari sepuluh hari — lalu kata-kata bermakna pada judulnya cukup
 * beririsan.
 *
 * Syarat "subkategori sama" sengaja tegas. Tanpa itu, berita pelarian dan
 * berita pungli dari unit yang sama bisa tergabung hanya karena nama unitnya
 * beririsan, dan laporan justru kehilangan satu isu.
 *
 * @param {Array<object>} daftar berita yang sudah diklasifikasi mesin
 * @returns {Array<object>} peristiwa, terurut dari yang paling banyak diberitakan
 */
export function kelompokkanPeristiwa(daftar) {
  const butir = daftar.map((b, i) => ({
    ...b,
    _i: i,
    _sidik: sidik([b.judul, b.ringkasan].filter(Boolean).join(' ')),
    _hari: keHari(b.tanggal_publikasi || b.created_at || b.tanggal),
  }))

  const peristiwa = []

  for (const b of butir) {
    let induk = null

    for (const p of peristiwa) {
      if ((p.subkategori_kode || '') !== (b.subkategori_kode || '')) continue
      if (Math.abs(p.hariAkhir - b._hari) > JENDELA_HARI) continue

      const keduanyaTerpetakan = !belumTerpetakan(p.nama_upt) && !belumTerpetakan(b.nama_upt)
      const uptSama = !keduanyaTerpetakan || p.nama_upt === b.nama_upt
      if (!uptSama) continue

      // Bila subkategori DAN unitnya sama-sama pasti, dan jaraknya masih di
      // dalam jendela, dua publikasi itu nyaris selalu satu kejadian. Satu
      // lapas tidak kehilangan dua narapidana yang berbeda dalam sepuluh hari
      // dengan kebetulan yang begitu rapi. Karena itu ambang kemiripan
      // katanya diturunkan jauh — judul dari media berbeda bisa saja tidak
      // berbagi satu kata pun selain nama unitnya.
      const ambang = keduanyaTerpetakan ? AMBANG_SERUMPUN_UNIT : AMBANG_SERUMPUN
      if (kemiripan(p.sidik, b._sidik) < ambang) continue

      induk = p
      break
    }

    if (!induk) {
      peristiwa.push({
        subkategori_kode: b.subkategori_kode || '',
        subkategori: b.subkategori || 'Belum Dikelompokkan',
        kategori: b.kategori || 'Lainnya',
        nama_upt: b.nama_upt || null,
        provinsi: b.provinsi || null,
        sentimen: b.sentimen,
        urgensi: b.urgensi,
        judul: b.judul,
        hariMulai: b._hari,
        hariAkhir: b._hari,
        tanggal_pertama: b.tanggal_publikasi || b.created_at,
        tanggal_terakhir: b.tanggal_publikasi || b.created_at,
        sidik: new Set(b._sidik),
        publikasi: [b],
        kembar: 0,
      })
      continue
    }

    // Publikasi yang nyaris identik dicatat terpisah: ia menambah eksposur,
    // tetapi tidak menambah informasi baru bagi analis.
    if (induk.publikasi.some((p) => kemiripan(sidik(p.judul), b._sidik) >= AMBANG_KEMBAR)) {
      induk.kembar += 1
    }

    induk.publikasi.push(b)

    // Sidik peristiwa adalah GABUNGAN kosakata seluruh publikasinya, bukan
    // sidik publikasi terakhir. Versi sebelumnya mengiris lalu menggabung,
    // yang secara matematis membuat sidik induk selalu berakhir sama persis
    // dengan sidik publikasi yang baru masuk. Akibatnya satu peristiwa hanya
    // "mengingat" judul terakhirnya, dan judul berikutnya yang memakai kata
    // lain gagal menyusul — persis yang membuat satu pelarian di Warungkiara
    // terhitung sebagai dua kejadian.
    for (const k of b._sidik) induk.sidik.add(k)

    induk.hariMulai = Math.min(induk.hariMulai, b._hari)
    induk.hariAkhir = Math.max(induk.hariAkhir, b._hari)

    if (belumTerpetakan(induk.nama_upt) && !belumTerpetakan(b.nama_upt)) {
      induk.nama_upt = b.nama_upt
      induk.provinsi = b.provinsi || induk.provinsi
    }

    // Urgensi peristiwa adalah urgensi tertinggi di antara publikasinya.
    const peringkat = { Rendah: 1, Sedang: 2, Tinggi: 3, Kritis: 4 }
    if ((peringkat[b.urgensi] || 0) > (peringkat[induk.urgensi] || 0)) induk.urgensi = b.urgensi
  }

  for (const p of peristiwa) {
    p.jumlah_publikasi = p.publikasi.length
    // Dihitung dari penerbit sebenarnya, bukan dari nama pengumpulnya.
    p.daftar_media = [...new Set(p.publikasi.map(sumberAsli).filter(Boolean))]
    p.jumlah_media = p.daftar_media.length
    p.judul = judulTerbaik(p.publikasi)
    p.rentang_hari = p.hariAkhir - p.hariMulai + 1
    p.tanggal_pertama = p.publikasi
      .map((b) => b.tanggal_publikasi || b.created_at)
      .filter(Boolean)
      .sort()[0] || p.tanggal_pertama
    p.tanggal_terakhir = p.publikasi
      .map((b) => b.tanggal_publikasi || b.created_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || p.tanggal_terakhir
    // Eksposur: seberapa besar tekanan opini yang ditimbulkan satu peristiwa.
    // Media berbeda bernilai lebih daripada satu media yang mengulang berkali-kali.
    p.eksposur = p.jumlah_media * 2 + (p.jumlah_publikasi - p.jumlah_media)
    delete p.sidik
  }

  return peristiwa.sort((a, b) => b.eksposur - a.eksposur || b.jumlah_publikasi - a.jumlah_publikasi)
}

/* ------------------------------------------------------------------ validasi */

/**
 * Hal-hal yang membuat sebuah hasil klasifikasi patut diragukan.
 * Masing-masing menurunkan keyakinan dan, bila cukup berat, mengirim berita
 * ke antrean telaah analis alih-alih langsung masuk laporan.
 */
const PEMERIKSAAN = [
  {
    kode: 'keyakinan-rendah',
    berat: 2,
    pesan: 'Keyakinan mesin di bawah setengah.',
    uji: (b) => Number(b.ai_confidence ?? 0) < 0.5 && (b.kategori || '') !== 'Di Luar Lingkup',
  },
  {
    kode: 'pesaing-rapat',
    berat: 2,
    pesan: 'Subkategori kedua hampir sekuat yang terpilih.',
    uji: (b) => {
      const pesaing = Array.isArray(b.pesaing) ? b.pesaing[0] : null
      if (!pesaing || !b.skor_tertinggi) return false
      return pesaing.skor / b.skor_tertinggi > 0.85
    },
  },
  {
    kode: 'negatif-tanpa-unit',
    berat: 1,
    pesan: 'Berita negatif tanpa unit yang terpetakan; tidak bisa ditindaklanjuti ke UPT mana pun.',
    uji: (b) => b.sentimen === 'Negatif' && belumTerpetakan(b.nama_upt),
  },
  {
    kode: 'urgensi-tanpa-dasar',
    berat: 2,
    pesan: 'Urgensi tinggi tetapi sentimennya tidak negatif.',
    uji: (b) => ['Tinggi', 'Kritis'].includes(b.urgensi) && b.sentimen === 'Positif',
  },
  {
    kode: 'judul-terlalu-pendek',
    berat: 1,
    pesan: 'Judul terlalu pendek untuk dinilai dengan yakin.',
    uji: (b) => normalkan(b.judul || '').split(' ').filter((k) => k.length > 2).length < 4,
  },
  {
    kode: 'belum-dikelompokkan',
    berat: 2,
    pesan: 'Mesin tidak menemukan subkategori yang cukup meyakinkan.',
    uji: (b) => (b.subkategori_kode || '0.1') === '0.1',
  },
]

/**
 * Memeriksa satu hasil klasifikasi dan mengembalikan penilaian mutunya.
 *
 * @returns {{lolos:boolean, bobot:number, temuan:Array<{kode:string,pesan:string}>, mutu:string}}
 */
export function validasi(berita) {
  const temuan = []
  let bobot = 0

  for (const p of PEMERIKSAAN) {
    let kena = false
    try { kena = p.uji(berita) } catch { kena = false }
    if (!kena) continue
    temuan.push({ kode: p.kode, pesan: p.pesan })
    bobot += p.berat
  }

  // Tiga tingkat, bukan lulus-gagal. Analis perlu tahu bedanya antara "ada
  // yang perlu dilihat" dan "jangan dipakai sebelum diperiksa".
  const mutu = bobot === 0 ? 'baik' : bobot <= 2 ? 'perlu-lirik' : 'perlu-telaah'

  return { lolos: bobot <= 2, bobot, temuan, mutu }
}

/** Versi massal, sekaligus menempelkan hasilnya ke tiap butir. */
export function validasiBanyak(daftar) {
  return daftar.map((b) => ({ ...b, mutu: validasi(b) }))
}

/**
 * Ringkasan mutu satu kumpulan berita. Dipakai di dasbor sebagai ukuran
 * seberapa jauh angka yang ditampilkan boleh dipercaya apa adanya.
 */
export function rekapMutu(daftar) {
  const rekap = { baik: 0, 'perlu-lirik': 0, 'perlu-telaah': 0 }
  const alasan = new Map()

  for (const b of daftar) {
    const v = b.mutu || validasi(b)
    rekap[v.mutu] = (rekap[v.mutu] || 0) + 1
    for (const t of v.temuan) alasan.set(t.kode, (alasan.get(t.kode) || 0) + 1)
  }

  return {
    ...rekap,
    total: daftar.length,
    persenBaik: daftar.length ? Math.round((rekap.baik / daftar.length) * 100) : 0,
    alasanTeratas: [...alasan.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([kode, jumlah]) => ({ kode, jumlah })),
  }
}

export const META_PERISTIWA = {
  versi: 'peristiwa-v2.0',
  jendelaHari: JENDELA_HARI,
  ambangSerumpun: AMBANG_SERUMPUN,
  ambangSerumpunUnit: AMBANG_SERUMPUN_UNIT,
  jumlahKonsep: Object.keys(KONSEP).length,
}
