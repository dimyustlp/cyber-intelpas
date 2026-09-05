/**
 * Menyusun batas provinsi Indonesia menjadi satu modul JavaScript.
 *
 * Kenapa berkas ini ada, padahal sudah ada tools/susun-peta.mjs.
 *
 * Peta Sebaran pada halaman hanya perlu tahu di mana daratannya, sebab yang
 * digambar di atasnya adalah titik unit. Laporan berkala menuntut hal yang
 * lain: ia mewarnai tiap provinsi menurut sentimen dominan pemberitaannya —
 * sebuah choropleth. Titik tidak bisa melakukannya, dan garis pantai tidak
 * punya batas dalam sama sekali.
 *
 * Sumbernya tetap Natural Earth, domain publik, dan tetap diunduh SEKALI saat
 * menyusun — bukan saat halaman dibuka. Aturan repositori ini melarang aset
 * pihak ketiga ditarik dari peramban, dan larangan itu tidak dilanggar oleh
 * berkas yang hasilnya ikut masuk repo sebagai kode.
 *
 * PERINGATAN YANG PALING MAHAL BILA TERLEWAT
 *
 * Natural Earth masih memakai pembagian 33 provinsi. Indonesia punya 38 sejak
 * 2022. Lima yang belum ada — Kalimantan Utara dan empat provinsi baru di
 * Papua — TIDAK dibuang, melainkan dicatat sebagai bagian dari provinsi
 * induknya lewat PROVINSI_INDUK. Yang menggambar peta menggabungkan angkanya
 * ke induk itu; yang menghitung dan menyusun daftar tetap memakai 38 provinsi
 * sesungguhnya. Menyamakan keduanya berarti lima provinsi hilang dari laporan
 * tanpa satu pun tanda.
 *
 * Jalankan:
 *   node tools/susun-provinsi.mjs <jalur-geojson> [toleransi]
 *
 * Berkasnya: ne_50m_admin_1_states_provinces.geojson dari
 * github.com/nvkelso/natural-earth-vector.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const AKAR = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const jalur = process.argv[2]
const TOLERANSI = Number(process.argv[3] || 0.02)

if (!jalur) {
  console.error('Sebutkan jalur berkas GeoJSON Natural Earth admin-1 sebagai argumen pertama.')
  process.exit(1)
}

/*
   Ambang pulau jauh lebih kecil daripada pada susun-peta.mjs.

   Di sana ambang 0,02° membuang pulau kecil supaya peta tidak berbintik. Di
   sini ambang sebesar itu akan menghapus Maluku, Kepulauan Riau, dan Nusa
   Tenggara Timur hampir seluruhnya — provinsi yang memang tidak punya satu pun
   pulau besar. Sebuah provinsi yang tidak tergambar tidak bisa diwarnai, dan
   pembaca laporan akan membacanya sebagai "tidak ada berita".
*/
const AMBANG_PULAU = 0.004

/** Nama Natural Earth yang berbeda dari nama yang dipakai data induk UPT. */
const PADANAN_NAMA = {
  'Jakarta Raya': 'DKI Jakarta',
  Yogyakarta: 'D.I. Yogyakarta',
  'Bangka-Belitung': 'Kepulauan Bangka Belitung',
}

/**
 * Provinsi yang belum ada pada Natural Earth, dan induk yang wilayahnya masih
 * mencakupnya. Dipakai penggambar peta untuk menggabungkan angka.
 */
const PROVINSI_INDUK = {
  'Kalimantan Utara': 'Kalimantan Timur',
  'Papua Selatan': 'Papua',
  'Papua Tengah': 'Papua',
  'Papua Pegunungan': 'Papua',
  'Papua Barat Daya': 'Papua Barat',
}

function jarakKeGaris([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const panjang = dx * dx + dy * dy
  if (!panjang) return Math.hypot(x - x1, y - y1)
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / panjang))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

/** Penyederhanaan Douglas–Peucker, sama seperti pada susun-peta.mjs. */
function sederhanakan(titik, toleransi) {
  if (titik.length < 3) return titik
  let terjauh = 0
  let indeks = 0
  for (let i = 1; i < titik.length - 1; i++) {
    const d = jarakKeGaris(titik[i], titik[0], titik[titik.length - 1])
    if (d > terjauh) { terjauh = d; indeks = i }
  }
  if (terjauh <= toleransi) return [titik[0], titik[titik.length - 1]]
  return [
    ...sederhanakan(titik.slice(0, indeks + 1), toleransi).slice(0, -1),
    ...sederhanakan(titik.slice(indeks), toleransi),
  ]
}

function cincinDari(geometri) {
  if (geometri.type === 'Polygon') return [geometri.coordinates[0]]
  if (geometri.type === 'MultiPolygon') return geometri.coordinates.map((p) => p[0])
  return []
}

function kotak(cincin) {
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity
  for (const [x, y] of cincin) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, maxX, minY, maxY, luas: (maxX - minX) * (maxY - minY) }
}

function jalurSvg(cincin) {
  const bulat = (n) => Number(n.toFixed(2))
  const bagian = cincin.map(([x, y], i) => `${i ? 'L' : 'M'}${bulat(x)} ${bulat(y)}`)
  return `${bagian.join('')}Z`
}

/**
 * Titik pusat provinsi untuk menaruh label.
 *
 * Dipakai pusat cincin TERLUAS, bukan rata-rata seluruh cincin. Rata-rata
 * seluruh cincin menaruh label Maluku di tengah laut, jauh dari setiap pulau
 * yang menyusunnya — dan label yang mengambang di laut terbaca sebagai milik
 * provinsi yang salah.
 */
function pusat(cincinTerpilih) {
  let terluas = null
  for (const c of cincinTerpilih) {
    const k = kotak(c)
    if (!terluas || k.luas > terluas.luas) terluas = k
  }
  if (!terluas) return null
  return [
    Number(((terluas.minX + terluas.maxX) / 2).toFixed(2)),
    Number(((terluas.minY + terluas.maxY) / 2).toFixed(2)),
  ]
}

/* ------------------------------------------------------------------ jalan */

const geo = JSON.parse(readFileSync(jalur, 'utf8'))
const fiturIndonesia = geo.features.filter(
  (f) => (f.properties.adm0_a3 || f.properties.ADM0_A3) === 'IDN',
)

if (!fiturIndonesia.length) {
  console.error('Tidak ada satu pun provinsi Indonesia di dalam berkas itu.')
  process.exit(1)
}

const provinsi = []
for (const f of fiturIndonesia) {
  const namaNe = f.properties.name || f.properties.NAME
  const nama = PADANAN_NAMA[namaNe] || namaNe
  const dipakai = []
  const jalurnya = []
  for (const cincin of cincinDari(f.geometry)) {
    if (kotak(cincin).luas < AMBANG_PULAU) continue
    const ringkas = sederhanakan(cincin, TOLERANSI)
    if (ringkas.length < 4) continue
    dipakai.push(ringkas)
    jalurnya.push(jalurSvg(ringkas))
  }
  if (!jalurnya.length) {
    console.warn(`  ! ${nama}: tidak ada cincin yang lolos ambang`)
    continue
  }
  provinsi.push({ nama, jalur: jalurnya, pusat: pusat(dipakai) })
}

provinsi.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))

const badanProvinsi = provinsi.map((p) => [
  '  {',
  `    nama: ${JSON.stringify(p.nama)},`,
  `    pusat: ${JSON.stringify(p.pusat)},`,
  '    jalur: [',
  ...p.jalur.map((d) => `      '${d}',`),
  '    ],',
  '  },',
].join('\n')).join('\n')

const kepala = [
  '/**',
  ' * Batas provinsi Indonesia, sebagai jalur SVG dalam satuan derajat.',
  ' *',
  ' * DIHASILKAN OLEH tools/susun-provinsi.mjs — jangan disunting tangan.',
  ' * Menyunting berkas ini berarti perubahannya hilang pada penyusunan',
  ' * berikutnya, dan tidak ada satu pun yang memberi tahu bahwa itu terjadi.',
  ' *',
  ' * Sumber: Natural Earth 1:50 juta (ne_50m_admin_1_states_provinces), domain',
  ` * publik. Toleransi penyederhanaan ${TOLERANSI}° (≈${(TOLERANSI * 111).toFixed(1)} km); pulau yang kotak`,
  ` * pembatasnya lebih kecil dari ${AMBANG_PULAU}° persegi dibuang.`,
  ' *',
  ' * Satuannya bujur dan lintang apa adanya — proyeksinya dikerjakan yang',
  ' * menggambar, sama seperti peta-indonesia.js, sehingga keduanya bisa',
  ' * ditumpuk tanpa satu pun penyesuaian.',
  ' *',
  ' * Natural Earth masih memakai pembagian 33 provinsi; Indonesia punya 38',
  ' * sejak 2022. Lima yang belum ada dipetakan ke induknya lewat',
  ' * PROVINSI_INDUK. Yang MENGGAMBAR menggabungkan angkanya ke induk; yang',
  ' * MENGHITUNG tetap memakai 38 provinsi sesungguhnya.',
  ' */',
  '',
].join('\n')

const kaki = [
  '',
  '/**',
  ' * Provinsi yang belum dikenal Natural Earth, dan induk yang wilayahnya masih',
  ' * mencakupnya. Hanya untuk menggambar — jangan dipakai saat menghitung.',
  ' */',
  `export const PROVINSI_INDUK = ${JSON.stringify(PROVINSI_INDUK, null, 2)}`,
  '',
  '/** Nama provinsi yang punya bentuknya sendiri di peta ini. */',
  'export const PROVINSI_TERGAMBAR = new Set(PROVINSI.map((p) => p.nama))',
  '',
  '/**',
  ' * Nama provinsi yang bentuknya dipakai untuk menggambar sebuah provinsi.',
  ' * Provinsi yang sudah punya bentuknya sendiri mengembalikan namanya sendiri.',
  ' */',
  'export function bentukProvinsi(nama) {',
  "  const n = String(nama || '').trim()",
  '  return PROVINSI_INDUK[n] || n',
  '}',
  '',
].join('\n')

const isi = `${kepala}
/** ${provinsi.length} provinsi menurut pembagian Natural Earth. */
export const PROVINSI = [
${badanProvinsi}
]
${kaki}`

const keluaran = join(AKAR, 'web', 'js', 'lib', 'peta-provinsi.js')
writeFileSync(keluaran, isi)

const jumlahJalur = provinsi.reduce((n, p) => n + p.jalur.length, 0)
console.log(`Provinsi  : ${provinsi.length}`)
console.log(`Jalur     : ${jumlahJalur}`)
console.log(`Berkas    : ${keluaran} (${(isi.length / 1024).toFixed(0)} KB)`)
