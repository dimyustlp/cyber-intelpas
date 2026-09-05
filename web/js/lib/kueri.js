/**
 * Bahasa kueri — satu kotak yang menerima pertanyaan berlapis.
 *
 * Sampai berkas ini ada, setiap halaman menyaring dengan satu kotak "cari" yang
 * hanya bisa menjawab satu pertanyaan: apakah teks ini muncul. Pertanyaan yang
 * sebenarnya diajukan petugas piket jarang sesederhana itu. Yang ia tanyakan
 * berbunyi seperti ini:
 *
 *   (narkoba ATAU sabu) DAN upt:Cilegon TIDAK status:"Tidak Valid"
 *
 * Tanpa bahasa kueri, pertanyaan itu dijawab dengan tiga kali pencarian
 * terpisah lalu penggabungan di kepala — dan penggabungan di kepala adalah
 * tempat angka mulai berselisih dengan angka di layar lain.
 *
 * ## Yang diterima
 *
 *   kata              cocok bila kata itu, ATAU salah satu bentuk imbuhannya,
 *                     muncul. "selundup" menemukan "penyelundupan".
 *   "frasa utuh"      cocok hanya bila kata-katanya berurutan.
 *   "dua kata"~5      cocok bila keduanya muncul dalam jarak 5 kata.
 *   bidang:nilai      membatasi pencarian pada satu kolom. Lihat BIDANG.
 *   awal*             jokar. Jokar mematikan pencocokan imbuhan — orang yang
 *                     mengetik bintang sudah menyebut sendiri sejauh mana ia
 *                     ingin kata itu meluas.
 *   ( )               pengelompokan.
 *   DAN / AND / &     wajib. Dua istilah berdampingan tanpa kata hubung juga
 *                     berarti DAN — itu yang diharapkan orang saat mengetik.
 *   ATAU / OR / |     salah satu.
 *   TIDAK / NOT / -   pengecualian.
 *
 * ## Dua aturan yang mengikat berkas ini
 *
 * **Kueri yang belum selesai diketik bukan galat.** Kotak pencarian menerima
 * satu huruf pada satu waktu, jadi tanda kurung yang belum ditutup dan tanda
 * kutip yang baru dibuka adalah keadaan NORMAL, bukan kekecualian. `uraiKueri`
 * karena itu tidak pernah melempar: ia mengembalikan pohon terbaik yang bisa
 * disusunnya beserta daftar catatan. Halaman menampilkan catatannya sebagai
 * keterangan, bukan sebagai kegagalan.
 *
 * **Yang menyaring baris tetap penyaring ini, bukan halaman.** Sama alasannya
 * dengan lib/hitung.js: dua tempat yang menyaring dengan aturan yang diam-diam
 * berbeda menghasilkan dua angka yang tidak bisa dijelaskan siapa pun.
 */

import { normalkan, akarKata, siapkanKonteks } from './teks.js'
import { tanggalIso } from './format.js'

/**
 * Perataan untuk kolom berkosakata tertutup.
 *
 * Sengaja BUKAN `normalkan()` dari lib/teks.js. Perata itu dirancang untuk
 * kalimat berita: ia membuang alamat tautan seluruhnya, membuang boilerplate
 * crawler, dan memulihkan huruf yang disamarkan menjadi angka. Ketiganya benar
 * untuk judul dan tepat salah untuk nama kolom — `tautan:` yang alamatnya
 * dibuang lebih dulu tidak akan pernah cocok dengan apa pun, dan tidak akan
 * ada satu pun pesan yang mengatakannya.
 */
function ratakanLabel(nilai) {
  return String(nilai ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Perataan istilah yang memuat jokar.
 *
 * Diratakan sepotong demi sepotong lalu disambung kembali dengan bintangnya,
 * sebab `normalkan()` memperlakukan bintang sebagai tanda baca dan
 * menggantinya dengan spasi. Tanpa ini, `ker*han` diam-diam berubah menjadi
 * dua kata `ker han` — kueri yang masih berjalan, tidak pernah cocok, dan
 * tidak pernah mengeluh.
 */
function ratakanIstilah(nilai) {
  const teks = String(nilai ?? '')
  if (!teks.includes('*')) return normalkan(teks)
  return teks.split('*').map((b) => normalkan(b)).join('*')
}

/* -------------------------------------------------------------------- bidang */

/**
 * Bidang yang bisa disebut di depan sebuah istilah.
 *
 * Dibagi menjadi tiga jenis, dan pembagiannya bukan kerapian melainkan
 * perilaku:
 *
 *   `teks`    kolom berisi kalimat. Dicocokkan dengan kesadaran imbuhan,
 *             sebab bentuk yang diketik hampir tidak pernah bentuk yang
 *             dicetak media.
 *   `label`   kolom berisi kosakata tertutup — nama unit, nama kategori,
 *             nama status. Dicocokkan sebagai potongan harfiah, tanpa
 *             imbuhan: orang yang mengetik `status:Valid` sedang menyalin
 *             tulisan yang barusan ia lihat, bukan sedang mengarang kata.
 *   `tanggal` batas rentang.
 */
export const BIDANG = {
  judul: { kolom: 'judul', jenis: 'teks', label: 'judul' },
  isi: { kolom: 'ringkasan', jenis: 'teks', label: 'ringkasan' },
  ringkasan: { kolom: 'ringkasan', jenis: 'teks', label: 'ringkasan' },
  rekomendasi: { kolom: 'rekomendasi', jenis: 'teks', label: 'rekomendasi' },
  catatan: { kolom: 'review_note', jenis: 'teks', label: 'catatan telaah' },

  upt: { kolom: 'nama_upt', jenis: 'label', label: 'UPT' },
  unit: { kolom: 'nama_upt', jenis: 'label', label: 'UPT' },
  media: { kolom: 'media', jenis: 'label', label: 'media' },
  sumber: { kolom: 'media', jenis: 'label', label: 'media' },
  platform: { kolom: 'platform', jenis: 'label', label: 'platform' },
  kanal: { kolom: 'platform', jenis: 'label', label: 'platform' },
  kategori: { kolom: 'kategori', jenis: 'label', label: 'kategori' },
  subkategori: { kolom: 'subkategori', jenis: 'label', label: 'subkategori' },
  sub: { kolom: 'subkategori', jenis: 'label', label: 'subkategori' },
  sentimen: { kolom: 'sentimen', jenis: 'label', label: 'sentimen' },
  urgensi: { kolom: 'urgensi', jenis: 'label', label: 'urgensi' },
  perhatian: { kolom: 'tingkat_perhatian', jenis: 'label', label: 'tingkat perhatian' },
  status: { kolom: 'status_verifikasi', jenis: 'label', label: 'status telaah' },
  wilayah: { kolom: 'kanwil_asal', jenis: 'label', label: 'kantor wilayah' },
  kanwil: { kolom: 'kanwil_asal', jenis: 'label', label: 'kantor wilayah' },
  provinsi: { kolom: 'provinsi', jenis: 'label', label: 'provinsi' },
  tautan: { kolom: 'link', jenis: 'label', label: 'tautan' },
  link: { kolom: 'link', jenis: 'label', label: 'tautan' },
  penelaah: { kolom: 'verified_by', jenis: 'label', label: 'penelaah' },
  analis: { kolom: 'verified_by', jenis: 'label', label: 'penelaah' },
  sikap: { kolom: 'tanggapan_sikap', jenis: 'label', label: 'sikap tanggapan' },

  sejak: { jenis: 'tanggal', arah: 'mulai', label: 'terbit sejak' },
  sampai: { jenis: 'tanggal', arah: 'akhir', label: 'terbit sampai' },
}

/** Nama bidang yang ditawarkan sebagai bantuan pengetikan, tanpa nama kembar. */
export const BIDANG_UTAMA = [
  'judul', 'upt', 'media', 'platform', 'kategori', 'subkategori',
  'sentimen', 'urgensi', 'status', 'wilayah', 'provinsi', 'sejak', 'sampai',
]

/**
 * Kolom yang ikut dibaca oleh istilah tanpa nama bidang.
 *
 * Sengaja tidak seluruh kolom. `link` tidak ikut karena alamat berisi potongan
 * kata yang tidak pernah dimaksudkan sebagai kata — sebuah pencarian "sabu"
 * akan menangkap setiap berita dari media yang alamatnya memuat "sabu".
 */
const KOLOM_UMUM = [
  'judul', 'ringkasan', 'nama_upt', 'media', 'kategori', 'subkategori',
  'platform', 'provinsi', 'kanwil_asal',
]

/* ---------------------------------------------------------------- pemenggalan */

const KATA_DAN = new Set(['and', 'dan', '&', '&&'])
const KATA_ATAU = new Set(['or', 'atau', '|', '||'])
const KATA_TIDAK = new Set(['not', 'tidak', 'bukan', 'kecuali'])

/** Ketiga bentuk tanda kutip yang bisa masuk lewat tempel-salin dari dokumen. */
const KUTIP = ['"', '“', '”']

/**
 * Memenggal teks kueri menjadi tanda-tanda.
 *
 * Tanda kutip yang tidak ditutup diperlakukan sebagai menutup di ujung teks.
 * Itu bukan kelonggaran: kotak pencarian menerima huruf demi huruf, dan
 * pengetik yang baru menekan tanda kutip pertamanya belum salah — ia baru
 * belum selesai.
 */
function penggal(teks) {
  const tanda = []
  const s = String(teks ?? '')
  let i = 0

  while (i < s.length) {
    const c = s[i]

    if (/\s/.test(c)) { i += 1; continue }

    if (c === '(' || c === ')') {
      tanda.push({ jenis: c === '(' ? 'buka' : 'tutup' })
      i += 1
      continue
    }

    if (KUTIP.includes(c)) {
      let j = i + 1
      let isi = ''
      while (j < s.length && !KUTIP.includes(s[j])) { isi += s[j]; j += 1 }
      const tertutup = j < s.length
      j += 1
      // Jarak kedekatan: "dua kata"~5
      let jarak = 0
      const cocokJarak = s.slice(j).match(/^~(\d+)/)
      if (cocokJarak) { jarak = Number(cocokJarak[1]); j += cocokJarak[0].length }
      tanda.push({ jenis: 'frasa', nilai: isi, jarak, tertutup })
      i = j
      continue
    }

    if ((c === '-' || c === '!') && /[^\s)]/.test(s[i + 1] || '')) {
      tanda.push({ jenis: 'tidak' })
      i += 1
      continue
    }

    // Kata biasa. Dihentikan spasi, kurung, atau tanda kutip pembuka.
    let j = i
    let kata = ''
    while (j < s.length && !/[\s()]/.test(s[j]) && !KUTIP.includes(s[j])) { kata += s[j]; j += 1 }
    i = j

    const rendah = kata.toLowerCase()
    if (KATA_DAN.has(rendah)) { tanda.push({ jenis: 'dan' }); continue }
    if (KATA_ATAU.has(rendah)) { tanda.push({ jenis: 'atau' }); continue }
    if (KATA_TIDAK.has(rendah)) { tanda.push({ jenis: 'tidak' }); continue }

    // Nama bidang di depan istilah: upt:cilegon
    const pisah = kata.indexOf(':')
    if (pisah > 0) {
      const namaBidang = kata.slice(0, pisah).toLowerCase()
      if (BIDANG[namaBidang]) {
        // Bidang tanpa nilai — yang baru diketik separuh. Nilainya mungkin
        // frasa berkutip yang menyusul; itu ditangani penyusun pohon.
        tanda.push({ jenis: 'kata', nilai: kata.slice(pisah + 1), bidang: namaBidang })
        continue
      }
    }

    tanda.push({ jenis: 'kata', nilai: kata })
  }

  return tanda
}

/* ------------------------------------------------------------------- pohon */

/** 2026-09-04, 4/9/2026, atau 4-9-2026 — dikembalikan sebagai 2026-09-04. */
function bacaTanggal(nilai) {
  const t = String(nilai).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const pisah = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (pisah) {
    const [, h, b, th] = pisah
    return `${th}-${String(b).padStart(2, '0')}-${String(h).padStart(2, '0')}`
  }
  return ''
}

/**
 * Menyusun pohon dari deret tanda. Turun rekursif, tiga tingkat:
 * ATAU mengikat paling longgar, lalu DAN, lalu istilah dan kurung.
 */
function susun(tanda, catatan) {
  let p = 0

  const lihat = () => tanda[p]
  const ambil = () => tanda[p++]

  function istilah() {
    const t = ambil()
    if (!t) return null

    if (t.jenis === 'tidak') {
      const isi = istilah()
      if (!isi) { catatan.push('Ada TIDAK yang belum diikuti apa pun.'); return null }
      return { jenis: 'tidak', isi }
    }

    if (t.jenis === 'buka') {
      const isi = ekspresi()
      if (lihat()?.jenis === 'tutup') ambil()
      else catatan.push('Ada tanda kurung yang belum ditutup.')
      return isi
    }

    if (t.jenis === 'tutup') {
      catatan.push('Ada tanda kurung penutup tanpa pembuka.')
      return istilah()
    }

    if (t.jenis === 'frasa') {
      if (!t.tertutup) catatan.push('Ada tanda kutip yang belum ditutup.')
      const isi = String(t.nilai).trim()
      if (!isi) return null
      return { jenis: 'frasa', nilai: isi, jarak: t.jarak, bidang: null }
    }

    if (t.jenis === 'kata') {
      const bidang = t.bidang || null
      const nilai = t.nilai

      /*
         upt:"Lapas Kelas IIA Cilegon" — nama bidang dan frasanya terpisah
         menjadi dua tanda oleh pemenggal. Disatukan di sini, bukan di
         pemenggal, supaya pemenggal tetap tidak perlu tahu apa pun tentang
         arti tanda di sebelahnya.
      */
      if (bidang && nilai === '' && lihat()?.jenis === 'frasa') {
        const f = ambil()
        if (!f.tertutup) catatan.push('Ada tanda kutip yang belum ditutup.')
        const isi = String(f.nilai).trim()
        if (!isi) return null
        return { jenis: 'frasa', nilai: isi, jarak: f.jarak, bidang }
      }

      // Bidang yang belum diberi nilai. Bukan galat — belum selesai diketik.
      if (nilai === '') return null

      const bd = bidang ? BIDANG[bidang] : null
      if (bd?.jenis === 'tanggal') {
        const iso = bacaTanggal(nilai)
        if (!iso) { catatan.push(`Tanggal "${nilai}" tidak terbaca. Pakai bentuk 2026-09-04.`); return null }
        return { jenis: 'tanggal', arah: bd.arah, nilai: iso, bidang }
      }

      return { jenis: 'kata', nilai, bidang }
    }

    return null
  }

  function konjungsi() {
    let kiri = istilah()
    while (p < tanda.length) {
      const t = lihat()
      if (!t || t.jenis === 'tutup' || t.jenis === 'atau') break
      if (t.jenis === 'dan') { ambil(); continue }
      const kanan = istilah()
      if (!kanan) continue
      kiri = kiri ? { jenis: 'dan', kiri, kanan } : kanan
    }
    return kiri
  }

  function ekspresi() {
    let kiri = konjungsi()
    while (lihat()?.jenis === 'atau') {
      ambil()
      const kanan = konjungsi()
      if (!kanan) { catatan.push('Ada ATAU yang belum diikuti apa pun.'); break }
      kiri = kiri ? { jenis: 'atau', kiri, kanan } : kanan
    }
    return kiri
  }

  const pohon = ekspresi()
  // Sisa yang tidak terbaca hanya mungkin muncul dari kurung penutup berlebih,
  // dan itu sudah dicatat di atas.
  while (p < tanda.length) ambil()
  return pohon
}

/**
 * Membaca teks kueri menjadi pohon yang siap dinilai.
 *
 * Tidak pernah melempar. `pohon` bernilai null berarti kueri kosong — dan
 * kueri kosong berarti seluruh baris lolos, bukan tidak satu pun.
 */
export function uraiKueri(teks) {
  const catatan = []
  const tanda = penggal(teks)
  const pohon = tanda.length ? susun(tanda, catatan) : null
  return { pohon, catatan: [...new Set(catatan)], kosong: !pohon }
}

/* ------------------------------------------------------------- penyiapan baris */

/**
 * Bentuk siap-cari sebuah baris, disimpan supaya tidak disusun ulang untuk
 * setiap istilah dalam kueri.
 *
 * Disimpan pada WeakMap, bukan pada barisnya sendiri: menempelkan bidang
 * tambahan pada objek berita akan ikut terkirim kembali ke peladen pada
 * penyuntingan berikutnya, dan kolom yang tidak dikenal ditolak PostgREST.
 */
const simpanan = new WeakMap()

const KOLOM_LABEL = [...new Set(
  Object.values(BIDANG).filter((b) => b.jenis === 'label').map((b) => b.kolom),
)]
const KOLOM_TEKS = [...new Set(
  Object.values(BIDANG).filter((b) => b.jenis === 'teks').map((b) => b.kolom),
)]

function siapkan(baris) {
  const ada = simpanan.get(baris)
  if (ada) return ada

  const label = {}
  for (const nama of KOLOM_LABEL) label[nama] = ratakanLabel(baris[nama])

  const teks = {}
  for (const nama of KOLOM_TEKS) teks[nama] = normalkan(baris[nama] ?? '')

  const siap = {
    label,
    teks,
    umum: siapkanKonteks(normalkan(KOLOM_UMUM.map((k) => baris[k] ?? '').filter(Boolean).join(' . '))),
    konteksKolom: new Map(),
    tanggal: tanggalIso(baris.tanggal_publikasi || baris.created_at || ''),
  }
  simpanan.set(baris, siap)
  return siap
}

function konteksUntuk(siap, kolom) {
  let k = siap.konteksKolom.get(kolom)
  if (!k) { k = siapkanKonteks(siap.teks[kolom] || ''); siap.konteksKolom.set(kolom, k) }
  return k
}

/* ------------------------------------------------------------------ pencocokan */

/** Jokar * menjadi pola. Titik dan tanda lain sudah hilang saat dinormalkan. */
function polaJokar(kata) {
  const pola = kata.split('*')
    .map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[a-z0-9 ]*')
  return new RegExp(`^${pola}$`)
}

/**
 * Benar bila sebuah kata cocok dengan salah satu token dalam konteks.
 *
 * Tiga cara sebuah kata dianggap cocok, berurutan dari yang paling ketat:
 * sama persis, sekeluarga bentuk (lewat akar yang sudah diindeks
 * `siapkanKonteks`), atau berawalan sama. Yang ketiga menampung nama diri dan
 * singkatan yang tidak punya akar — "cileg" tetap menemukan "cilegon".
 */
function kataCocok(konteks, kata) {
  if (!konteks.jumlahToken || !kata) return false

  if (kata.includes('*')) {
    const pola = polaJokar(kata)
    return konteks.token.some((t) => pola.test(t))
  }

  if (konteks.indeks.has(kata)) return true
  for (const calon of akarKata(kata)) if (konteks.indeks.has(calon)) return true

  // Berawalan sama, minimal empat huruf. Di bawah empat huruf, awalan
  // menangkap terlalu banyak: "pas" akan cocok dengan setiap "pasar".
  if (kata.length >= 4) return konteks.token.some((t) => t.startsWith(kata))
  return false
}

/** Kedudukan seluruh token yang cocok dengan satu kata kunci. */
function kedudukanKata(konteks, k) {
  if (k.includes('*')) {
    const pola = polaJokar(k)
    return konteks.token.map((t, i) => (pola.test(t) ? i : -1)).filter((i) => i >= 0)
  }
  const semua = new Set()
  for (const calon of [k, ...akarKata(k)]) {
    for (const i of konteks.indeks.get(calon) || []) semua.add(i)
  }
  if (!semua.size && k.length >= 4) {
    konteks.token.forEach((t, i) => { if (t.startsWith(k)) semua.add(i) })
  }
  return [...semua].sort((a, b) => a - b)
}

/**
 * Benar bila frasa muncul utuh dan berurutan dalam konteks.
 * Bila `jarak` lebih dari nol, kata-katanya cukup muncul dalam jendela
 * sepanjang itu, dan urutannya tidak mengikat.
 */
function frasaCocok(konteks, frasa, jarak = 0) {
  const kata = ratakanIstilah(frasa).split(' ').filter(Boolean)
  if (!kata.length) return false
  if (kata.length === 1) return kataCocok(konteks, kata[0])

  const kedudukan = kata.map((k) => kedudukanKata(konteks, k))
  if (kedudukan.some((d) => !d.length)) return false

  if (jarak > 0) {
    // Kedekatan: seluruh kata harus muat dalam satu jendela sepanjang `jarak`.
    for (const awal of kedudukan[0]) {
      if (kedudukan.every((d) => d.some((i) => Math.abs(i - awal) <= jarak))) return true
    }
    return false
  }

  // Berurutan: kedudukan kata ke-n harus tepat satu langkah setelah ke-(n−1).
  for (const awal of kedudukan[0]) {
    let lanjut = true
    for (let n = 1; n < kedudukan.length; n += 1) {
      if (!kedudukan[n].includes(awal + n)) { lanjut = false; break }
    }
    if (lanjut) return true
  }
  return false
}

/** Pencocokan potongan harfiah untuk kolom berkosakata tertutup. */
function labelCocok(nilaiKolom, dicari) {
  const cari = ratakanLabel(dicari)
  const isi = nilaiKolom || ''
  if (!cari) return false
  if (cari.includes('*')) return polaJokar(cari).test(isi)
  return isi.includes(cari)
}

function nilaiSimpul(simpul, siap) {
  if (!simpul) return true

  switch (simpul.jenis) {
    case 'dan': return nilaiSimpul(simpul.kiri, siap) && nilaiSimpul(simpul.kanan, siap)
    case 'atau': return nilaiSimpul(simpul.kiri, siap) || nilaiSimpul(simpul.kanan, siap)
    case 'tidak': return !nilaiSimpul(simpul.isi, siap)

    case 'tanggal': {
      if (!siap.tanggal) return false
      return simpul.arah === 'mulai' ? siap.tanggal >= simpul.nilai : siap.tanggal <= simpul.nilai
    }

    case 'kata':
    case 'frasa': {
      const bd = simpul.bidang ? BIDANG[simpul.bidang] : null
      if (bd?.jenis === 'label') return labelCocok(siap.label[bd.kolom], simpul.nilai)

      const konteks = bd ? konteksUntuk(siap, bd.kolom) : siap.umum
      return simpul.jenis === 'frasa'
        ? frasaCocok(konteks, simpul.nilai, simpul.jarak)
        : kataCocok(konteks, ratakanIstilah(simpul.nilai))
    }

    default: return true
  }
}

/** Benar bila baris ini menjawab kueri. Pohon kosong berarti seluruhnya lolos. */
export function cocokkan(pohon, baris) {
  if (!pohon) return true
  return nilaiSimpul(pohon, siapkan(baris))
}

/**
 * Menyaring sebuah daftar dengan teks kueri.
 *
 * Satu pintu untuk seluruh halaman: yang memanggilnya tidak perlu tahu apa pun
 * tentang penguraian, dan karena itu tidak bisa keliru mengurainya sendiri.
 */
export function saringKueri(daftar = [], teks = '') {
  const { pohon, catatan, kosong } = uraiKueri(teks)
  if (kosong) return { hasil: daftar, catatan, kosong: true, pohon: null }
  return { hasil: daftar.filter((b) => cocokkan(pohon, b)), catatan, kosong: false, pohon }
}

/* ---------------------------------------------------------------- keterangan */

/**
 * Menerjemahkan pohon kembali menjadi kalimat Indonesia.
 *
 * Ada supaya kueri yang rumit bisa DIBACA ULANG oleh penulisnya. Kueri dengan
 * tiga tanda kurung tidak pernah salah menurut mesin; yang keliru adalah
 * anggapan penulisnya tentang apa yang ia tulis, dan satu-satunya cara
 * menemukannya adalah membacanya kembali dalam kalimat biasa.
 */
export function jelaskan(simpul) {
  if (!simpul) return 'seluruh baris'

  switch (simpul.jenis) {
    case 'dan': return `${jelaskan(simpul.kiri)} dan ${jelaskan(simpul.kanan)}`
    case 'atau': return `(${jelaskan(simpul.kiri)} atau ${jelaskan(simpul.kanan)})`
    case 'tidak': return `bukan ${jelaskan(simpul.isi)}`
    case 'tanggal': return `${BIDANG[simpul.bidang]?.label || simpul.arah} ${simpul.nilai}`
    case 'frasa': {
      const inti = simpul.jarak
        ? `"${simpul.nilai}" dalam jarak ${simpul.jarak} kata`
        : `frasa "${simpul.nilai}"`
      return simpul.bidang ? `${BIDANG[simpul.bidang].label} memuat ${inti}` : `memuat ${inti}`
    }
    case 'kata':
      return simpul.bidang
        ? `${BIDANG[simpul.bidang].label} memuat "${simpul.nilai}"`
        : `memuat "${simpul.nilai}"`
    default: return ''
  }
}

/**
 * Kata yang layak disorot pada hasil — hanya yang positif.
 *
 * Istilah di bawah TIDAK sengaja tidak ikut: menyorot kata yang justru
 * membuat sebuah baris disingkirkan akan menandai baris yang lolos dengan
 * alasan kelolosannya yang terbalik.
 */
export function kataSorot(simpul, keluar = new Set(), dibalik = false) {
  if (!simpul) return [...keluar]
  switch (simpul.jenis) {
    case 'dan':
    case 'atau':
      kataSorot(simpul.kiri, keluar, dibalik)
      kataSorot(simpul.kanan, keluar, dibalik)
      break
    case 'tidak':
      kataSorot(simpul.isi, keluar, !dibalik)
      break
    case 'kata':
    case 'frasa':
      if (!dibalik) {
        for (const k of normalkan(simpul.nilai).split(' ')) {
          if (k.length >= 3 && !k.includes('*')) keluar.add(k)
        }
      }
      break
    default: break
  }
  return [...keluar]
}

/**
 * Menyusun teks kueri dari sepasang bidang dan nilai.
 *
 * Dipakai halaman untuk mengubah pilihan saringan menjadi kueri yang terbaca —
 * sehingga saringan yang dipasang lewat tombol tetap bisa disunting sebagai
 * teks, bukan menjadi keadaan tersembunyi yang tidak muncul di kotaknya.
 */
export function sebagaiKueri(bidang, nilai) {
  const teks = String(nilai ?? '').trim()
  if (!teks) return ''
  return /\s/.test(teks) ? `${bidang}:"${teks}"` : `${bidang}:${teks}`
}

export const META_KUERI = { versi: 'kueri-v1.0', bidang: Object.keys(BIDANG).length }
