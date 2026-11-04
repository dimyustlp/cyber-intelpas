/**
 * Wilayah sebuah berita — kanwil mana yang semestinya memegangnya.
 *
 * ## Masalah yang ditutup
 *
 * Sampai 4 November 2026 kanwil sebuah berita hanya punya dua sumber: kanwil
 * asal lembar (berita kiriman daerah) dan kanwil UPT-nya di data induk. Berita
 * yang masuk lewat penjaring dan lembar pusat tanpa UPT terpetakan tidak punya
 * keduanya, dan seluruhnya jatuh ke satu kelompok "Tanpa kanwil" — 115 berita
 * negatif di Analisis Berita, kelompok terbesar di layar itu, padahal judulnya
 * menyebut "Lapas Jayapura", "Lapas Kediri", "Kanwil Ditjenpas Malut",
 * "Polrestabes Medan". Wilayahnya tertulis; hanya tidak ada yang membacanya.
 *
 * Mesin pencocok UPT memang benar menolak "Lapas Jayapura": tiga unit di
 * Jayapura, dan memilih salah satunya berarti menuduh unit yang mungkin tidak
 * bersangkutan. Tetapi ketiganya di Kanwil Papua. Pertanyaan "unit mana" dan
 * "kanwil mana" adalah dua pertanyaan, dan yang kedua sering bisa dijawab
 * ketika yang pertama belum.
 *
 * ## Urutan bukti, dari yang paling kuat
 *
 *   lembar        kanwil_asal — lembar kanwil yang mengirimnya       pasti
 *   upt           nama_upt ada di data induk                           pasti
 *   upt-terduga   mesin pencocok menemukan satu unit (≥ ambang)        terduga
 *   sebut-kanwil  "Kanwil/Kakanwil ... <wilayah>" tertulis             terduga
 *   kandidat-upt  kandidat unit berbeda-beda, tetapi satu kanwil       terduga
 *   nama-tempat   nama provinsi/kabupaten/kota yang hanya milik satu   terduga
 *                 kanwil
 *   lintas        nama tempat menunjuk lebih dari satu kanwil          —
 *   tanpa-lokasi  tidak ada petunjuk wilayah sama sekali               —
 *
 * Sejak 4 November 2026 dugaan DITULIS ke basis data, atas keputusan user:
 * berita tanpa UPT tidak sampai ke dasbor kanwil mana pun, dan itu lebih
 * merugikan daripada sesekali salah wilayah. Edge Function klasifikasi
 * (mode "wilayah", dipanggil penyapu duga-kanwil) memanggil modul ini dan
 * mengisi kanwil_asal yang masih kosong dengan `kanwil_terduga = true`
 * (migrasi 20261104030000 dan 20261104040000).
 * Kanwil dari lembar dan dari UPT tidak pernah ditimpa, dan begitu UPT-nya
 * ditetapkan, pemicu basis data mengganti dugaan dengan kanwil UPT itu.
 * Lintas wilayah dan tanpa lokasi tetap tidak disalurkan.
 *
 * Modul ES murni; mesin pencocoknya diimpor, tidak disalin.
 */

import { bangunIndeks, cocokkanUpt, normalkanUpt, SEBUTAN_POPULER } from './pencocokan-upt.js'
import { belumTerpetakan } from './unit-terpetakan.js'

/**
 * Singkatan provinsi yang dipakai media. Ditulis tangan karena tidak ada di
 * data induk mana pun — dan hanya singkatan yang tidak punya arti lain.
 * "Kaltara" menunjuk provinsi, bukan kanwil: kanwilnya dicari lewat data
 * induk, sehingga perubahan ampuan (Kaltara diampu Kaltim sejak 2 November
 * 2026) tidak perlu ditulis ulang di sini.
 */
const SINGKATAN_PROVINSI = [
  ['jatim', 'Jawa Timur'], ['jateng', 'Jawa Tengah'], ['jabar', 'Jawa Barat'],
  ['sumut', 'Sumatera Utara'], ['sumbar', 'Sumatera Barat'], ['sumsel', 'Sumatera Selatan'],
  ['sulsel', 'Sulawesi Selatan'], ['sulut', 'Sulawesi Utara'], ['sulteng', 'Sulawesi Tengah'],
  ['sultra', 'Sulawesi Tenggara'], ['sulbar', 'Sulawesi Barat'],
  ['kalbar', 'Kalimantan Barat'], ['kalteng', 'Kalimantan Tengah'], ['kalsel', 'Kalimantan Selatan'],
  ['kaltim', 'Kalimantan Timur'], ['kaltara', 'Kalimantan Utara'],
  ['ntb', 'Nusa Tenggara Barat'], ['ntt', 'Nusa Tenggara Timur'],
  ['babel', 'Kepulauan Bangka Belitung'], ['bangka belitung', 'Kepulauan Bangka Belitung'],
  ['kepri', 'Kepulauan Riau'], ['malut', 'Maluku Utara'],
  ['diy', 'D.I. Yogyakarta'], ['yogyakarta', 'D.I. Yogyakarta'], ['jogja', 'D.I. Yogyakarta'],
  ['yogya', 'D.I. Yogyakarta'], ['jogjakarta', 'D.I. Yogyakarta'],
  ['dki', 'DKI Jakarta'], ['pabar', 'Papua Barat'], ['pbd', 'Papua Barat Daya'],
  // Singkatan kabupaten yang dipakai media lebih sering daripada namanya.
  ['oku', 'Sumatera Selatan'], ['oki', 'Sumatera Selatan'], ['kuansing', 'Riau'],
]

/**
 * Nama tempat yang juga kata sehari-hari atau bagian ungkapan. "Palu hakim",
 * "batang tubuh", "banjar" di Bali (satuan desa adat), "landak", "batu". Satu
 * kata di daftar ini tetap dikenali bila ditulis lengkap dengan "kota" atau
 * "kabupaten" di depannya — "Kota Palu" tidak pernah berarti palu.
 */
const KATA_TERLARANG = new Set([
  'palu', 'batang', 'banjar', 'landak', 'batu', 'baru', 'raya', 'agung', 'besar',
  'tengah', 'utara', 'selatan', 'barat', 'timur', 'pusat', 'muara', 'sungai',
  'bukit', 'gunung', 'pasir', 'teluk', 'tanjung', 'kota', 'negara', 'kuningan',
  'tua', 'lima', 'empat', 'tiga', 'dua', 'kudus', 'malaka', 'jaya', 'indah',
  'sentral', 'rantau', 'kepulauan', 'pulau', 'selat', 'labuhan', 'pangkalan',
  // "Polres Metro Depok", "Metro TV"; "bandar narkoba".
  'metro', 'bandar',
])

/** Penyebutan kantor wilayah; nama tempat sesudahnya dibaca sebagai kanwil. */
const PENANDA_KANWIL = ['kanwil', 'kakanwil', 'kantor wilayah']

/**
 * Ungkapan yang menyebut nama tempat tanpa menunjuk tempat itu. "Dari Sabang
 * sampai Merauke" ada di pidato nasional, bukan di Aceh dan Papua.
 */
const UNGKAPAN = ['sabang sampai merauke', 'sabang hingga merauke', 'sabang merauke']

const BUANG_JENIS = new Set([
  'lapas', 'rutan', 'lpka', 'lpp', 'bapas', 'kelas', 'i', 'ii', 'iia', 'iib', 'iii',
  'ia', 'ib', 'narkotika', 'perempuan', 'anak', 'terbuka', 'pemuda', 'wanita', 'umum',
  'cabang', 'khusus', 'lembaga', 'pemasyarakatan', 'rumah', 'tahanan', 'negara',
])

/**
 * Menyiapkan peta dari daftar UPT (baris tabel `upt`). Cukup sekali.
 * @param {Array<object>} daftarUpt
 */
export function bangunPetaWilayah(daftarUpt) {
  const indeks = bangunIndeks(daftarUpt)
  const kanwilUpt = new Map()
  const kanwilProvinsi = new Map()
  const frasa = new Map()

  const tambah = (teks, kanwil, { lengkap = false } = {}) => {
    const f = normalkanUpt(teks)
    if (!f || !kanwil) return
    if (!lengkap && (f.length < 4 || KATA_TERLARANG.has(f))) return
    if (!frasa.has(f)) frasa.set(f, new Set())
    frasa.get(f).add(kanwil)
  }

  for (const u of daftarUpt) {
    if (!u.nama_upt || !u.kanwil) continue
    kanwilUpt.set(u.nama_upt, u.kanwil)
    if (u.provinsi) kanwilProvinsi.set(u.provinsi, u.kanwil)
  }

  for (const u of daftarUpt) {
    if (!u.kanwil) continue
    tambah(u.provinsi, u.kanwil)
    const kabkota = String(u.kabupaten_kota || '').trim()
    if (kabkota) {
      tambah(kabkota, u.kanwil, { lengkap: /^(kota|kabupaten|kab\.?) /i.test(kabkota) })
      tambah(kabkota.replace(/^(kota|kabupaten|kab\.?)\s+/i, ''), u.kanwil)
    }
    if (u.location_hint) tambah(u.location_hint, u.kanwil)
    // Nama tempat di dalam nama unit: "Lapas Kelas IIA Kerobokan" → "kerobokan".
    const tempat = normalkanUpt(u.nama_upt).split(' ').filter((k) => !BUANG_JENIS.has(k)).join(' ')
    tambah(tempat, u.kanwil)
  }

  for (const [alias, namaResmi] of SEBUTAN_POPULER) {
    if (namaResmi && kanwilUpt.has(namaResmi)) tambah(alias, kanwilUpt.get(namaResmi))
  }
  for (const [singkat, provinsi] of SINGKATAN_PROVINSI) {
    if (kanwilProvinsi.has(provinsi)) tambah(singkat, kanwilProvinsi.get(provinsi), { lengkap: true })
  }

  // Nama tempat yang dipakai lebih dari satu kanwil tidak menunjuk apa pun:
  // "Martapura" ada di Kalimantan Selatan dan Sumatera Selatan.
  const tunggal = [...frasa.entries()]
    .filter(([, set]) => set.size === 1)
    .map(([f, set]) => [f, [...set][0]])
    .sort((a, b) => b[0].length - a[0].length)

  return { indeks, kanwilUpt, frasa: tunggal, cache: new WeakMap() }
}

function posisiUtuh(teks, kata, dari = 0) {
  for (;;) {
    const p = teks.indexOf(kata, dari)
    if (p === -1) return -1
    const sebelum = p === 0 ? ' ' : teks[p - 1]
    const sesudah = teks[p + kata.length] ?? ' '
    if (!/[a-z0-9]/.test(sebelum) && !/[a-z0-9]/.test(sesudah)) return p
    dari = p + 1
  }
}

/**
 * Teks yang dibaca: judul dan ringkasan. Nama media sengaja tidak — "Radar
 * Kediri" dan "Tribun Bali" memberitakan seluruh negeri. Kepala berita
 * "JAKARTA, KOMPAS.com -" juga dibuang: itu letak meja redaksi, bukan letak
 * peristiwa, dan hampir setiap berita nasional membawanya. Begitu pula ekor
 * judul "… - Riau Satu" atau "… - Hallo Sukabumi": itu nama portal yang
 * ditempelkan penjaring, dan portal daerah memuat ulang berita nasional.
 */
function teksDibaca(b) {
  const judul = String(b.judul || '').replace(/\s[-–—|]\s[^-–—|]{2,40}$/, '')
  const ringkasan = String(b.ringkasan || '').replace(/^\s*jakarta\b[^-–—]{0,40}[-–—]\s*/i, '')
  let t = ` ${normalkanUpt(`${judul} . ${ringkasan}`)} `
  for (const u of UNGKAPAN) t = t.split(` ${u} `).join(' ')
  return t
}

/** Kanwil dari nama tempat dalam teks; frasa terpanjang menang dan memakan rentangnya. */
function bacaTempat(teks, peta) {
  const terpakai = []
  const hit = new Map()
  let sebutKanwil = null
  for (const [f, kanwil] of peta.frasa) {
    let dari = 0
    for (;;) {
      const p = posisiUtuh(teks, f, dari)
      if (p === -1) break
      dari = p + f.length
      if (terpakai.some(([a, z]) => p < z && p + f.length > a)) continue
      terpakai.push([p, p + f.length])
      hit.set(kanwil, (hit.get(kanwil) || 0) + 1)
      const depan = teks.slice(Math.max(0, p - 45), p)
      if (!sebutKanwil && PENANDA_KANWIL.some((m) => posisiUtuh(depan, m) >= 0)) sebutKanwil = { kanwil, bukti: f }
    }
  }
  return { hit, sebutKanwil }
}

/**
 * @param {object} b baris berita (judul, ringkasan, nama_upt, kanwil_asal)
 * @param {ReturnType<typeof bangunPetaWilayah>|null} peta
 * @returns {{kanwil:string|null, dasar:string, pasti:boolean, kandidat:string[],
 *            uptSaran:Array<{nama:string, kanwil:string}>, bukti:string}}
 */
export function wilayahBerita(b, peta) {
  /* Kanwil yang ditulis mesin sebagai dugaan tetap dugaan di layar: tanpa
     cabang ini ia terbaca "dari lembar kanwil pengirim", dan analis pusat
     kehilangan satu-satunya tanda bahwa wilayahnya belum dipastikan. */
  if (b.kanwil_asal && b.kanwil_terduga) {
    return hasil(b.kanwil_asal, KET_DASAR[b.kanwil_dasar] ? b.kanwil_dasar : 'nama-tempat', false)
  }
  if (b.kanwil_asal) return hasil(b.kanwil_asal, b.kanwil_dasar === 'upt' ? 'upt' : 'lembar', true)
  if (!peta) return hasil(null, 'tanpa-lokasi', false)
  if (!belumTerpetakan(b.nama_upt) && peta.kanwilUpt.has(b.nama_upt)) {
    return hasil(peta.kanwilUpt.get(b.nama_upt), 'upt', true, { bukti: b.nama_upt })
  }
  if (peta.cache.has(b)) return peta.cache.get(b)

  const teks = teksDibaca(b)
  const cocok = cocokkanUpt(teks, peta.indeks)
  // Hanya kandidat yang kuat dan setara dengan yang terbaik. Saran lemah
  // (skor 0,45–0,6) adalah kemiripan nama, bukan penyebutan: "fenomena gunung
  // es" menarik Lapas Gunung Sitoli, Gunung Sindur, dan Gunung Sugih sekaligus,
  // dan berita nasional itu tampil sebagai "lintas tiga kanwil".
  const terbaik = cocok.saran[0]?.skor || 0
  const uptSaran = (cocok.otomatis ? [{ nama: cocok.nama }] : cocok.saran
    .filter((s) => s.skor >= 0.6 && s.skor >= terbaik - 0.05))
    .map((s) => ({ nama: s.nama, kanwil: peta.kanwilUpt.get(s.nama) }))
    .filter((s) => s.kanwil)

  let jawab
  const kanwilKandidat = [...new Set(uptSaran.map((s) => s.kanwil))]
  if (cocok.otomatis && uptSaran.length) {
    jawab = hasil(uptSaran[0].kanwil, 'upt-terduga', false, { uptSaran, bukti: cocok.nama })
  } else {
    const { hit, sebutKanwil } = bacaTempat(teks, peta)
    const kanwilTempat = [...hit.keys()]
    if (sebutKanwil) {
      jawab = hasil(sebutKanwil.kanwil, 'sebut-kanwil', false, { uptSaran, bukti: sebutKanwil.bukti })
    } else if (kanwilKandidat.length === 1) {
      jawab = hasil(kanwilKandidat[0], 'kandidat-upt', false, { uptSaran, bukti: uptSaran.map((s) => s.nama).join(', ') })
    } else if (kanwilTempat.length === 1) {
      jawab = hasil(kanwilTempat[0], 'nama-tempat', false, { uptSaran })
    } else if (kanwilTempat.length > 1 || kanwilKandidat.length > 1) {
      jawab = hasil(null, 'lintas', false, {
        uptSaran, kandidat: [...new Set([...kanwilKandidat, ...kanwilTempat])],
      })
    } else {
      jawab = hasil(null, 'tanpa-lokasi', false, { uptSaran })
    }
  }
  peta.cache.set(b, jawab)
  return jawab
}

function hasil(kanwil, dasar, pasti, lain = {}) {
  return { kanwil, dasar, pasti, kandidat: lain.kandidat || (kanwil ? [kanwil] : []), uptSaran: lain.uptSaran || [], bukti: lain.bukti || '' }
}

/** Kalimat pendek tentang dari mana kanwil itu diketahui, untuk layar. */
export const KET_DASAR = {
  lembar: 'dari lembar kanwil pengirim',
  upt: 'dari UPT di data induk',
  'upt-terduga': 'terduga: mesin mengenali unitnya, UPT belum ditetapkan',
  'sebut-kanwil': 'terduga: kanwil disebut di berita',
  'kandidat-upt': 'terduga: kandidat unit semuanya di kanwil ini',
  'nama-tempat': 'terduga: nama daerah di berita',
  lintas: 'menyebut daerah dari lebih dari satu kanwil',
  'tanpa-lokasi': 'tidak menyebut daerah mana pun',
}

/** Nama kelompok bagi berita yang kanwilnya belum bisa ditentukan. */
export const KELOMPOK_TANPA = {
  lintas: 'Lintas wilayah',
  'tanpa-lokasi': 'Nasional / tanpa lokasi',
}
