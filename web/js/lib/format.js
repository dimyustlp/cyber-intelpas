/**
 * Pemformat nilai untuk seluruh antarmuka.
 * Semua tanggal dan jam ditampilkan dalam waktu Jakarta, apa pun zona waktu
 * peramban yang dipakai. Laporan intelijen tidak boleh berpindah hari hanya
 * karena analisnya sedang bertugas di luar negeri.
 */

export const ZONA = 'Asia/Jakarta'

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const BULAN_ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function keJakarta(nilai) {
  const d = nilai instanceof Date ? nilai : new Date(nilai)
  if (Number.isNaN(d.getTime())) return null
  const bagian = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, weekday: 'short',
  }).formatToParts(d)
  const p = Object.fromEntries(bagian.map((b) => [b.type, b.value]))
  return {
    tahun: Number(p.year),
    bulan: Number(p.month),
    hari: Number(p.day),
    jam: p.hour === '24' ? '00' : p.hour,
    menit: p.minute,
    detik: p.second,
    hariNama: HARI[new Date(`${p.year}-${p.month}-${p.day}T00:00:00Z`).getUTCDay()],
    asli: d,
  }
}

/** 22 Agustus 2026 */
export function tanggal(nilai) {
  const j = keJakarta(nilai)
  if (!j) return '—'
  return `${j.hari} ${BULAN[j.bulan - 1]} ${j.tahun}`
}

/** Sabtu, 22 Agustus 2026 */
export function tanggalPanjang(nilai) {
  const j = keJakarta(nilai)
  if (!j) return '—'
  return `${j.hariNama}, ${j.hari} ${BULAN[j.bulan - 1]} ${j.tahun}`
}

/** 22 Agu 2026, 09.41 */
export function tanggalJam(nilai) {
  const j = keJakarta(nilai)
  if (!j) return '—'
  return `${j.hari} ${BULAN[j.bulan - 1].slice(0, 3)} ${j.tahun}, ${j.jam}.${j.menit}`
}

/** 09.41 */
export function jam(nilai) {
  const j = keJakarta(nilai)
  return j ? `${j.jam}.${j.menit}` : '—'
}

/** 2026-08-22 — bentuk yang dipakai untuk kueri rentang. */
export function tanggalIso(nilai) {
  const j = keJakarta(nilai)
  if (!j) return ''
  return `${j.tahun}-${String(j.bulan).padStart(2, '0')}-${String(j.hari).padStart(2, '0')}`
}

export function romawiBulan(nilai) {
  const j = keJakarta(nilai)
  return j ? BULAN_ROMAWI[j.bulan - 1] : ''
}

/** "3 menit lalu", "kemarin", "12 Agu". Tidak pernah melompat ke masa depan. */
export function jarakWaktu(nilai) {
  const d = new Date(nilai)
  if (Number.isNaN(d.getTime())) return '—'
  const detik = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (detik < 45) return 'baru saja'
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`
  if (detik < 172800) return 'kemarin'
  if (detik < 604800) return `${Math.floor(detik / 86400)} hari lalu`
  return tanggal(d)
}

/** 1.248 — pemisah ribuan gaya Indonesia. */
export function angka(nilai) {
  const n = Number(nilai)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('id-ID')
}

/** 86,0% */
export function persen(bagian, total, desimal = 1) {
  if (!total) return '0%'
  return `${((bagian / total) * 100).toFixed(desimal).replace('.', ',')}%`
}

/** +12 / −3 / 0, beserta arah untuk pewarnaan. */
export function delta(sekarang, sebelum) {
  const selisih = Number(sekarang || 0) - Number(sebelum || 0)
  const arah = selisih > 0 ? 'naik' : selisih < 0 ? 'turun' : 'diam'
  const tanda = selisih > 0 ? '+' : selisih < 0 ? '−' : ''
  return { selisih, arah, teks: `${tanda}${angka(Math.abs(selisih))}` }
}

/** 2,4 MB */
export function ukuranBerkas(bita) {
  const n = Number(bita) || 0
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1).replace('.', ',')} KB`
  return `${(n / 1048576).toFixed(1).replace('.', ',')} MB`
}

/** Memotong teks pada batas kata, bukan di tengah kata. */
export function ringkas(teks, maks = 140) {
  const t = String(teks ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= maks) return t
  const potong = t.slice(0, maks)
  const spasi = potong.lastIndexOf(' ')
  return `${potong.slice(0, spasi > maks * 0.6 ? spasi : maks)}…`
}

/** Inisial untuk avatar: "Denial Arif" → "DA" */
export function inisial(nama) {
  const bagian = String(nama ?? '').trim().split(/\s+/).filter(Boolean)
  if (!bagian.length) return '?'
  if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase()
  return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase()
}

/** Nama domain dari sebuah tautan, untuk ditampilkan sebagai sumber. */
export function asalTautan(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return String(url ?? '').slice(0, 40)
  }
}

/** Pemetaan tingkat urgensi ke nada warna sistem desain. */
export function nadaUrgensi(urgensi) {
  return {
    Kritis: 'kritis',
    Tinggi: 'tinggi',
    Sedang: 'sedang',
    Rendah: 'rendah',
  }[urgensi] || 'rendah'
}

/**
 * Warna sentimen mengikuti ember di lib/sentimen.js, bukan daftar tersendiri.
 * Netral dan Campuran karena itu berwarna sama — keduanya satu ember, dan dua
 * warna untuk satu ember membuat pembaca menyangka ada dua golongan.
 */
export function nadaSentimen(sentimen) {
  return {
    Negatif: 'kritis',
    Campuran: 'netral',
    Netral: 'netral',
    Positif: 'positif',
  }[sentimen] || 'rendah'
}

export function nadaStatus(status) {
  return {
    'Belum Ditelaah': 'sedang',
    'Perlu Koreksi': 'tinggi',
    'Terverifikasi': 'positif',
    'Tidak Valid': 'rendah',
    'Diarsipkan': 'rendah',
  }[status] || 'rendah'
}

/** Rentang minggu berjalan menurut waktu Jakarta: Senin sampai Minggu. */
export function rentangMinggu(acuan = new Date()) {
  const j = keJakarta(acuan)
  const dasar = new Date(Date.UTC(j.tahun, j.bulan - 1, j.hari))
  const hariKe = (dasar.getUTCDay() + 6) % 7 // Senin = 0
  const mulai = new Date(dasar)
  mulai.setUTCDate(dasar.getUTCDate() - hariKe)
  const akhir = new Date(mulai)
  akhir.setUTCDate(mulai.getUTCDate() + 6)
  return { mulai: tanggalIso(mulai), akhir: tanggalIso(akhir) }
}

/** Pengaman terakhir sebelum teks apa pun masuk ke innerHTML. */
export function amankan(nilai) {
  return String(nilai ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
