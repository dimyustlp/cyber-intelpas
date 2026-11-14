/**
 * Memasukkan seluruh Balai Pemasyarakatan (Bapas) ke data induk UPT.
 *
 * Latar belakang. Sampai 14 November 2026 data induk hanya memuat Lapas, Rutan,
 * dan LPKA (531 unit). Bapas sengaja dilewati oleh tools/susun-master-upt.mjs
 * dengan alasan "tidak pernah menjadi subjek berita kondisi hunian". Alasan itu
 * benar untuk hitungan hunian, tetapi akibatnya lain: Bapas adalah UPT seperti
 * Lapas dan Rutan, dan tanpa barisnya di data induk setiap berita Bapas
 * jatuh ke dua nasib buruk — "Belum Teridentifikasi", atau lebih buruk, salah
 * dipetakan ke Lapas di kota yang sama ("Bapas Denpasar" menjadi "Lapas
 * Perempuan Denpasar"). Dasbor, peta, dan lembar kanwil pun tidak pernah
 * melihat satu pun Bapas.
 *
 * Alat ini TIDAK menyusun ulang 532 unit yang sudah ada. Ia hanya:
 *   1. membaca baris Bapas dari data/sumber/daftar-upt-nasional.csv,
 *   2. menurunkan kanwil, provinsi, kabupaten/kota, dan titik sementara dari
 *      unit lain di tempat yang sama (aturan yang sama dengan unit baru
 *      sebelumnya — titik itu BUKAN lokasi gedung dan ditandai demikian),
 *   3. menulis ulang bagian Bapas pada data/master-upt.csv (aman dijalankan
 *      berulang: baris Bapas lama dibuang dulu), dan
 *   4. menerbitkan satu migrasi SQL yang hanya MENAMBAH baris.
 *
 * Dijalankan dengan: node tools/susun-bapas.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')
const SUMBER = join(AKAR, 'data', 'sumber', 'daftar-upt-nasional.csv')
const INDUK = join(AKAR, 'data', 'master-upt.csv')
const MIGRASI = join(AKAR, 'supabase', 'migrations', '20261114010000_bapas_data_induk.sql')

/**
 * Titik dan kabupaten/kota yang ditulis tangan karena tidak ada unit lain
 * di tempat yang sama, atau karena unit tetangganya tercatat di kabupaten yang
 * keliru. Nilainya [nama unit yang dipinjam titiknya, kabupaten/kota, alasan].
 */
const TANGAN = {
  'Bapas Kelas I Tangerang': ['Lapas Kelas I Tangerang', 'Kota Tangerang', 'kota yang sama'],
  'Bapas Kelas I Jakarta Barat': ['Lapas Kelas I Cipinang', 'Kota Jakarta Barat', 'titik sementara di Jakarta'],
  'Bapas Kelas I Jakarta Pusat': ['Lapas Kelas I Cipinang', 'Kota Jakarta Pusat', 'titik sementara di Jakarta'],
  'Bapas Kelas I Jakarta Selatan': ['Lapas Kelas I Cipinang', 'Kota Jakarta Selatan', 'titik sementara di Jakarta'],
  'Bapas Kelas I Jakarta Timur Utara': ['Lapas Kelas I Cipinang', 'Kota Jakarta Timur', 'titik sementara di Jakarta'],
  'Bapas Kelas II Lhok Semawe': ['Lapas Kelas IIA Lhok Seumawe', 'Kota Lhokseumawe', 'daftar nasional menulis "Lhok Semawe"'],
  'Bapas Kelas I Denpasar': ['Lapas Perempuan Kelas IIA Denpasar', 'Kota Denpasar', 'kota yang sama'],
  'Bapas Kelas II Ciangir': ['Lapas Terbuka Kelas IIB Ciangir', 'Kota Tangerang Selatan', 'nama tempat yang sama'],
  'Bapas Kelas II Pringsewu': ['Lapas Kelas I Bandar Lampung', 'Pringsewu', 'Pringsewu berbatasan dengan Bandar Lampung'],
  'Bapas Kelas II Tidore': ['Lapas Kelas IIA Ternate', 'Kota Tidore Kepulauan', 'Tidore bertetangga dengan Ternate'],
  'Bapas Kelas II Keerom': ['Lapas Kelas IIA Abepura', 'Keerom', 'Keerom berbatasan dengan Jayapura'],
  'Bapas Kelas II Musi Rawas Utara': ['Lapas Narkotika Kelas IIA Muara Beliti', 'Musi Rawas Utara', 'kabupaten yang sama'],
  'Bapas Kelas II OKU Induk': ['Rutan Kelas IIB Baturaja', 'Ogan Komering Ulu', 'Baturaja ibu kota Ogan Komering Ulu'],
  'Bapas Kelas II Nusakambangan': ['Lapas Kelas IIA Besi Nusakambangan', 'Cilacap', 'satu pulau'],
}

// --------------------------------------------------------------------- CSV

function baraiCsv(teks) {
  const baris = []
  let sel = []
  let nilai = ''
  let kutip = false
  for (let i = 0; i < teks.length; i += 1) {
    const c = teks[i]
    if (kutip) {
      if (c === '"') {
        if (teks[i + 1] === '"') { nilai += '"'; i += 1 } else kutip = false
      } else nilai += c
      continue
    }
    if (c === '"') kutip = true
    else if (c === ',') { sel.push(nilai); nilai = '' }
    else if (c === '\n') { sel.push(nilai.replace(/\r$/, '')); baris.push(sel); sel = []; nilai = '' }
    else nilai += c
  }
  if (nilai || sel.length) { sel.push(nilai.replace(/\r$/, '')); baris.push(sel) }
  return baris.filter((b) => b.some((v) => String(v).trim() !== ''))
}

function bacaCsv(jalur) {
  const baris = baraiCsv(readFileSync(jalur, 'utf8').replace(/^﻿/, ''))
  const kepala = baris[0].map((h) => h.trim())
  return { kepala, isi: baris.slice(1).map((b) => Object.fromEntries(kepala.map((h, i) => [h, (b[i] ?? '').trim()]))) }
}

const selCsv = (nilai) => {
  const teks = String(nilai ?? '')
  return /[",\n]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks
}

// ------------------------------------------------------------------ nama

const KELAS = /\bKELAS\s+(I{1,3})(\s*[AB])?(?![A-Za-z])/i

function judulkan(teks) {
  return teks.split(' ').map((k) => {
    if (/^(I{1,3})([AB])?$/.test(k)) return k.toUpperCase()
    if (/^[A-Z]+-[A-Z]+$/.test(k)) return k.split('-').map(judulkan).join('-')
    return k.charAt(0) + k.slice(1).toLowerCase()
  }).join(' ')
}

/** "BAPAS KELAS II OKU INDUK" menjadi "Bapas Kelas II OKU Induk". */
function bakukan(mentah) {
  let n = mentah.toUpperCase().replace(/\s+/g, ' ').trim()
  n = n.replace(/^BALAI PEMASYARAKATAN\b/, 'BAPAS')
  n = n.replace(KELAS, (_, romawi, huruf) => `KELAS ${romawi}${(huruf || '').trim()}`)
  return judulkan(n).replace(/\bOku\b/, 'OKU')
}

const KATA_UMUM = new Set([
  'lapas', 'rutan', 'lpka', 'lpp', 'bapas', 'lembaga', 'pemasyarakatan', 'rumah',
  'tahanan', 'negara', 'balai', 'pembinaan', 'khusus', 'kelas', 'i', 'ii', 'iia',
  'iib', 'iii', 'ia', 'ib', 'umum',
])

const normal = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
const tempatDari = (nama) => normal(nama).split(' ').filter((t) => t.length > 1 && !KATA_UMUM.has(t)).join('')
const petunjukDari = (kk) => String(kk || '').replace(/^(Kota|Kabupaten)\s+/i, '').trim().toUpperCase()

// ----------------------------------------------------------------- susun

const { kepala: KEPALA, isi: induk } = bacaCsv(INDUK)
const tanpaBapas = induk.filter((u) => u.jenis_upt !== 'Bapas')
const nasional = bacaCsv(SUMBER).isi
const sumberBapas = nasional.filter((r) => /^BAPAS\b|^BALAI PEMASYARAKATAN\b/i.test(r.nama_upt))

const perNama = new Map(tanpaBapas.map((u) => [u.nama_upt, u]))
const KANWIL_PROVINSI = Object.fromEntries(tanpaBapas.map((u) => [u.kanwil, u.provinsi]))

// Sebelum menimpa: seorang Super Admin mungkin sudah memperbaiki titik sebuah
// Bapas di berkas ini. Titik yang tidak lagi bertanda "warisan" dipertahankan.
const bapasLama = new Map(induk.filter((u) => u.jenis_upt === 'Bapas').map((u) => [u.nama_upt, u]))

// Unit tetangga: utamakan Lapas/Rutan di tempat yang sama dan yang punya titik.
const perTempat = new Map()
for (const u of tanpaBapas) {
  if (!u.latitude) continue
  const t = tempatDari(u.nama_upt)
  if (!t) continue
  const cur = perTempat.get(t)
  const lebihBaik = !cur || (cur.jenis_upt === 'LPKA' && u.jenis_upt !== 'LPKA')
  if (lebihBaik) perTempat.set(t, u)
}
const perProvinsi = new Map()
for (const u of tanpaBapas) if (u.latitude && u.provinsi && !perProvinsi.has(u.provinsi)) perProvinsi.set(u.provinsi, u)

const masalah = []
const hasil = []

for (const r of sumberBapas) {
  const nama = bakukan(r.nama_upt)
  const kanwil = `Kantor Wilayah Ditjenpas ${r.kanwil.replace(/^D\. I\. /, 'D.I. ')}`
  const provinsiKanwil = KANWIL_PROVINSI[kanwil]
  if (!provinsiKanwil) masalah.push(`Kanwil tidak dikenal untuk ${nama}: ${kanwil}`)

  const [pinjam, kabkotaTangan, alasanTangan] = TANGAN[nama] || []
  const sekota = pinjam ? perNama.get(pinjam) : perTempat.get(tempatDari(nama))
  if (pinjam && !sekota) masalah.push(`TANGAN menunjuk "${pinjam}" yang tidak ada di data induk.`)

  const lama = bapasLama.get(nama)
  const sudahDiperbaiki = lama && lama.latitude && !/warisan|titik provinsi/i.test(lama.coordinate_quality)

  const baris = {
    nama_upt: nama,
    jenis_upt: 'Bapas',
    kelas_upt: (KELAS.exec(nama) || [])[1] || '',
    subjenis_upt: 'Umum',
    provinsi: sekota?.provinsi || provinsiKanwil || '',
    kanwil,
    kabupaten_kota: kabkotaTangan || sekota?.kabupaten_kota || '',
    alamat: '',
    latitude: '', longitude: '', coordinate_quality: '', coordinate_source: '', coordinate_score: '',
    location_hint: '',
    aktif: 'True',
    catatan_verifikasi: '',
  }

  if (sudahDiperbaiki) {
    Object.assign(baris, lama)
  } else if (sekota) {
    baris.latitude = sekota.latitude
    baris.longitude = sekota.longitude
    baris.coordinate_quality = 'Titik wilayah—warisan unit terdekat'
    baris.coordinate_source = `Diwarisi dari ${sekota.nama_upt}${alasanTangan ? `: ${alasanTangan}` : ', nama tempat yang sama'}`
    baris.coordinate_score = '0.50'
    baris.location_hint = petunjukDari(baris.kabupaten_kota)
    baris.catatan_verifikasi = 'Bapas pada data induk sejak 14 November 2026. Titik masih titik wilayah, BUKAN lokasi gedung; wajib diperiksa Super Admin.'
  } else {
    const prov = perProvinsi.get(provinsiKanwil)
    if (!prov) { masalah.push(`Tidak ada titik untuk ${nama} (${provinsiKanwil})`); continue }
    baris.latitude = prov.latitude
    baris.longitude = prov.longitude
    baris.coordinate_quality = 'Titik provinsi—belum ditentukan'
    baris.coordinate_source = `Titik sementara provinsi ${provinsiKanwil}; belum ada unit lain di ${nama.replace(/^Bapas Kelas I{1,3}\s+/, '')}`
    baris.coordinate_score = '0.20'
    baris.location_hint = petunjukDari(baris.kabupaten_kota)
    baris.catatan_verifikasi = 'Bapas tanpa unit tetangga. Titik masih titik provinsi, BUKAN lokasi gedung; wajib ditentukan Super Admin.'
  }
  hasil.push(baris)
}

const nama = new Map()
for (const h of hasil) nama.set(h.nama_upt, (nama.get(h.nama_upt) || 0) + 1)
for (const [n, c] of nama) if (c > 1) masalah.push(`Nama kembar: ${n} (${c}x)`)
for (const h of hasil) if (perNama.has(h.nama_upt)) masalah.push(`Bentrok dengan unit lama: ${h.nama_upt}`)

if (masalah.length) {
  console.log('MASALAH:\n' + masalah.map((m) => `  - ${m}`).join('\n'))
  process.exit(1)
}

// ------------------------------------------------------------------ tulis

// Urutan 531 baris lama dibiarkan apa adanya; Bapas diurutkan lalu ditaruh di
// belakangnya, supaya perbedaan berkas ini hanya berisi baris yang bertambah.
hasil.sort((a, b) => a.kanwil.localeCompare(b.kanwil, 'id') || a.nama_upt.localeCompare(b.nama_upt, 'id'))
const semua = [...tanpaBapas, ...hasil]
writeFileSync(INDUK, `${[KEPALA.join(','), ...semua.map((b) => KEPALA.map((k) => selCsv(b[k])).join(','))].join('\r\n')}\r\n`)

const sql = (v) => (v === '' || v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const num = (v) => (v === '' || v == null ? 'null' : String(Number(v)))
const nilai = hasil.map((h) =>
  `  (${sql(h.nama_upt)}, 'Bapas', ${sql(h.kelas_upt)}, 'Umum', ${sql(h.provinsi)}, ${sql(h.kanwil)}, ${sql(h.kabupaten_kota)}, `
  + `${num(h.latitude)}, ${num(h.longitude)}, ${sql(h.coordinate_quality)}, ${sql(h.coordinate_source)}, ${num(h.coordinate_score)}, `
  + `${sql(h.location_hint)}, ${sql(h.catatan_verifikasi)}, true)`).join(',\n')

writeFileSync(MIGRASI, `-- Data induk UPT: Balai Pemasyarakatan (Bapas) masuk sebagai UPT, sejajar Lapas dan Rutan.
--
-- Dihasilkan oleh tools/susun-bapas.mjs dari data/sumber/daftar-upt-nasional.csv.
-- ${hasil.length} Bapas ditambahkan; 532 unit yang sudah ada tidak disentuh. Dengan ini data induk
-- memuat ${532 + hasil.length} unit.
--
-- Kanwil tiap Bapas dibaca dari daftar nasional, sehingga berita Bapas masuk ke
-- kantor wilayahnya masing-masing. Titik ${hasil.length} Bapas diwarisi dari unit di tempat yang
-- sama (titik wilayah, BUKAN lokasi gedung) dan menunggu verifikasi Super Admin.
--
-- "on conflict do nothing" membuat migrasi aman dijalankan dua kali.

begin;

insert into public.upt (
  nama_upt, jenis_upt, kelas_upt, subjenis_upt, provinsi, kanwil, kabupaten_kota,
  latitude, longitude, coordinate_quality, coordinate_source, coordinate_score,
  location_hint, catatan_verifikasi, aktif
)
values
${nilai}
on conflict do nothing;

-- Penjaring berita mencari nama unit satu per satu; Bapas ikut dalam antrean,
-- didahulukan karena belum pernah diperiksa (terakhir_diperiksa_at kosong).
insert into public.penjaring_sasaran (nama_upt, kanwil, terakhir_diperiksa_at)
select u.nama_upt, u.kanwil, null
from public.upt u
where u.jenis_upt = 'Bapas' and u.aktif
on conflict (nama_upt) do nothing;

update public.penjaring_sasaran s
set alias = public.ragam_nama_upt(u.nama_upt, u.jenis_upt, u.kabupaten_kota)
from public.upt u
where u.nama_upt = s.nama_upt and u.jenis_upt = 'Bapas' and s.alias is null;

commit;
`)

const tanpaTetangga = hasil.filter((h) => /provinsi/i.test(h.coordinate_quality)).map((h) => h.nama_upt)
console.log(`Bapas ditulis: ${hasil.length}; total unit: ${semua.length}`)
console.log(`Tanpa unit tetangga (titik provinsi): ${tanpaTetangga.length}${tanpaTetangga.length ? ' -> ' + tanpaTetangga.join('; ') : ''}`)
console.log(`Tanpa kabupaten/kota: ${hasil.filter((h) => !h.kabupaten_kota).map((h) => h.nama_upt).join('; ') || '-'}`)
