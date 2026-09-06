/**
 * Penjaga logika penjaring celah.
 *
 * `tools/penjaring-celah.gs` berjalan di Apps Script, di komputer Google, dan
 * tidak bisa dijalankan alat uji mana pun di repositori ini. Yang bisa diuji
 * adalah bagian yang TIDAK menyentuh Apps Script sama sekali — pembangun
 * kueri, saringan relevansi, dan penyeragam tautan — dan justru di sanalah
 * seluruh regexnya berada.
 *
 * Kenapa ini perlu: skrip itu ditempel dengan tangan ke peramban, dijalankan
 * sekali sehari pukul tiga pagi, dan menuliskan hasilnya ke lembar yang tidak
 * dibaca siapa pun sampai penyalin mengambilnya. Regex yang salah di sana
 * tidak menghasilkan galat — ia menghasilkan NOL BARIS, dan nol baris terlihat
 * persis sama dengan "memang tidak ada berita baru".
 *
 * Berkas .gs-nya dibaca apa adanya lalu dijalankan dengan boneka untuk seluruh
 * layanan Google. Aman: berkas itu hanya mendeklarasikan fungsi dan var di
 * aras atasnya, tidak menjalankan apa pun saat dimuat.
 *
 *   node tools/uji-penjaring.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const akar = join(dirname(fileURLToPath(import.meta.url)), '..')
const sumber = readFileSync(join(akar, 'tools/penjaring-celah.gs'), 'utf8')

/*
   Boneka layanan Google. Tidak satu pun dipanggil oleh fungsi yang diuji;
   keberadaannya hanya supaya berkasnya bisa dimuat tanpa ReferenceError.
*/
const boneka = {
  SpreadsheetApp: {}, UrlFetchApp: {}, XmlService: {}, Utilities: {},
  PropertiesService: {}, CacheService: {}, ScriptApp: {}, Logger: { log() {} },
}

const muat = new Function(
  ...Object.keys(boneka),
  `${sumber}\nreturn { kueriUnit, relevanUntukUnit, normalkanTautan, berjangkarPemasyarakatan, ISU, TARGET_AWAL, PENJARING_VERSI };`,
)
const P = muat(...Object.values(boneka))

let gagal = 0
const catat = (ok, nama, ket) => {
  if (!ok) { gagal += 1; console.log(`  GAGAL  ${nama}${ket ? '\n         ' + ket : ''}`) }
  return ok
}

/* ------------------------------------------------------ 1. Pembangun kueri */

console.log('\n1. Ragam nama unit\n')

/*
   Yang diuji bukan bentuk persis kuerinya melainkan satu hal yang menentukan:
   apakah bentuk PENDEK ikut dicari. Wartawan daerah menulis "Lapas Tobello",
   tidak pernah "Lapas Kelas IIB Tobello" — bentuk lengkap hanya dipakai siaran
   pers unit itu sendiri, yang justru sudah tertangkap sumber lain. Penjaring
   yang hanya mencari bentuk lengkap mencari di tempat yang sudah disapu.
*/
const KUERI = [
  ['Lapas Kelas IIB Tobello', 'Lapas Tobello'],
  ['Rutan Kelas IIB Kotamobagu', 'Rutan Kotamobagu'],
  ['LPKA Kelas II Ternate', 'LPKA Ternate'],
  ['Lapas Kelas III Namlea', 'Lapas Namlea'],
  ['Rutan Kelas I Semarang', 'Rutan Semarang'],
  ['Lapas Perempuan Kelas IIA Semarang', 'Lapas Perempuan Semarang'],
  ['Lapas Narkotika Kelas IIA Langkat', 'Lapas Narkotika Langkat'],
]

/*
   Sisa penanda kelas adalah cacat yang paling mudah lolos: kuerinya tetap sah,
   Google tetap menjawab, dan yang hilang hanya satu slot dari tiga. Kerugiannya
   tidak pernah terlihat sebagai kesalahan — hanya sebagai hasil yang lebih
   sedikit daripada seharusnya.
*/
const SISA_KELAS = /"[^"]*\b(I{1,3}|IV)[AB]?\b[^"]*"/

for (const [penuh, harusMuat] of KUERI) {
  const q = P.kueriUnit(penuh)
  const adaPenuh = q.includes(`"${penuh}"`)
  const adaPendek = q.includes(`"${harusMuat}"`)
  // Nama lengkapnya sendiri memang memuat kelas; yang diperiksa hanya ragamnya.
  const tanpaPenuh = q.split(' OR ').filter((x) => x !== `"${penuh}"`).join(' ')
  const adaSisa = SISA_KELAS.test(tanpaPenuh)

  const ok = catat(adaPenuh && adaPendek && !adaSisa, penuh,
    `kueri: ${q}
         lengkap: ${adaPenuh ? 'ada' : 'HILANG'} | pendek: ${adaPendek ? 'ada' : 'HILANG'}${adaSisa ? ' | RAGAM BERSISA KELAS' : ''}`)
  if (ok) console.log(`  ok     ${penuh}\n         → ${q}`)
}

/* ---------------------------------------------------- 2. Saringan relevansi */

console.log('\n2. Saringan relevansi\n')

const b = (judul, keterangan = '') => ({ judul, keterangan })

const RELEVAN = [
  // [nama uji, berita, unit, harus diterima?]
  ['berita unitnya sendiri',
    b('Lapas Tobello Gelar Apel Kesiapsiagaan', 'Warga binaan mengikuti apel di Lapas Tobello'),
    'Lapas Kelas IIB Tobello', true],

  /*
     Inilah kasus yang membuat saringan ini ada. Kueri untuk "Lapas Kelas IIB
     Ende" mengembalikan berita tentang KOTA Ende yang sama sekali bukan
     urusan Pemasyarakatan. v1.0 menulisnya apa adanya, dan hasilnya mengotori
     arsip intelijen dengan berita pariwisata.
  */
  ['kota bernama sama, tanpa jangkar pemasyarakatan',
    b('Festival Danau Kelimutu Digelar di Ende', 'Pemkab Ende menggelar festival tahunan'),
    'Lapas Kelas IIB Ende', false],

  ['berita lapas lain yang kebetulan lewat',
    b('Lapas Kelas IIA Bandung Terima Kunjungan', 'Kegiatan pembinaan warga binaan'),
    'Lapas Kelas IIB Tobello', false],

  ['jangkar ada, penanda tempat ada',
    b('Napi Rutan Kotamobagu Terima Remisi', 'Sebanyak 40 warga binaan Rutan Kotamobagu'),
    'Rutan Kelas IIB Kotamobagu', true],

  ['jangkar ada tetapi tempatnya lain',
    b('Napi Rutan Manado Terima Remisi', 'Warga binaan di Manado'),
    'Rutan Kelas IIB Kotamobagu', false],
]

for (const [nama, berita, unit, harus] of RELEVAN) {
  const dapat = P.relevanUntukUnit(berita, unit)
  if (catat(dapat === harus, nama, `harus ${harus ? 'DITERIMA' : 'DITOLAK'}, ternyata ${dapat ? 'diterima' : 'ditolak'}`)) {
    console.log(`  ok     ${nama} → ${dapat ? 'diterima' : 'ditolak'}`)
  }
}

/* ------------------------------------------------------- 3. Jangkar isu */

console.log('\n3. Jangkar pemasyarakatan pada sapuan isu\n')

const JANGKAR_UJI = [
  ['pungli lapas', b('Pungli di Rutan Kelas IIB Kabanjahe Diselidiki'), true],
  ['pungli dinas lain', b('Pungli Retribusi Pasar Kota Diusut Inspektorat'), false],
  ['tewas di dalam', b('Tahanan Ditemukan Meninggal di Sel'), true],
  ['tewas tanpa kaitan', b('Korban Kecelakaan Tol Meninggal di Lokasi'), false],
]

for (const [nama, berita, harus] of JANGKAR_UJI) {
  const dapat = P.berjangkarPemasyarakatan(berita)
  if (catat(dapat === harus, nama, `harus ${harus}, ternyata ${dapat}`)) {
    console.log(`  ok     ${nama} → ${dapat ? 'diterima' : 'ditolak'}`)
  }
}

/* -------------------------------------------- 4. Penyeragam tautan sama */

console.log('\n4. Penyeragam tautan selaras dengan basis data\n')

/*
   Jawaban di kolom kanan diperiksa langsung terhadap `public.normalkan_tautan()`
   di basis data produksi pada 6 September 2026, sama seperti tools/uji-tautan.mjs.
   Salinan di .gs adalah yang KEEMPAT; ia boleh meleset tanpa menimbulkan berita
   kembar, tetapi melesetnya berarti penjaring membayar ongkos jaringan untuk
   baris yang pasti ditolak basis data.
*/
const TAUTAN = [
  ['https://www.kompas.com/news/123/?utm_source=fb&utm_medium=post', 'https://kompas.com/news/123'],
  ['http://kompas.com/news/123', 'https://kompas.com/news/123'],
  ['https://KOMPAS.com/news/123/', 'https://kompas.com/news/123'],
  ['https://www.kompas.com/news/123#komentar', 'https://kompas.com/news/123'],
  ['kompas.com/news/123', 'https://kompas.com/news/123'],
  ['https://www.detik.com/a/b?fbclid=XYZ&page=2', 'https://detik.com/a/b?page=2'],
  ['https://tribunnews.com/x/amp', 'https://tribunnews.com/x'],
  ['https://Instagram.com/p/ABC/?igsh=zzz', 'https://instagram.com/p/ABC'],
  ['https://youtu.be/AbCdEf_12', 'https://youtu.be/AbCdEf_12'],
  ['', ''],
]

for (const [masuk, harap] of TAUTAN) {
  const dapat = P.normalkanTautan(masuk)
  if (catat(dapat === harap, masuk || '(kosong)', `harap ${harap}\n         dapat ${dapat}`)) {
    console.log(`  ok     ${(masuk || '(kosong)').slice(0, 58)}`)
  }
}

/* --------------------------------------------------------- 5. Kelengkapan */

console.log('\n5. Kelengkapan daftar\n')

const unik = new Set(P.TARGET_AWAL)
catat(P.TARGET_AWAL.length === 343, 'jumlah sasaran', `harap 343, dapat ${P.TARGET_AWAL.length}`)
catat(unik.size === P.TARGET_AWAL.length, 'sasaran tidak berulang',
  `${P.TARGET_AWAL.length - unik.size} nama berulang`)
catat(P.ISU.length >= 12, 'jumlah kueri isu', `dapat ${P.ISU.length}`)

/*
   Tiap kueri isu WAJIB mengikat kata isunya pada kata Pemasyarakatan. Tanpa
   ikatan itu, "pungli" mengembalikan seluruh pungli di republik ini, dan yang
   masuk ke arsip intelijen pemasyarakatan adalah berita dinas perhubungan.
*/
const TERIKAT = /lapas|rutan|sipir|kalapas|karutan|napiter|narapidana|residivis|bebas/i
for (const isu of P.ISU) {
  catat(TERIKAT.test(isu.kueri), `kueri isu ${isu.kode} terikat pemasyarakatan`, isu.kueri)
}
console.log(`  ok     ${P.TARGET_AWAL.length} sasaran unik, ${P.ISU.length} kueri isu, semuanya terikat`)

/* ------------------------------------------------------------------ hasil */

console.log('\n' + '─'.repeat(76))
if (gagal) {
  console.log(`\n${gagal} pemeriksaan GAGAL — jangan tempel skripnya sebelum diperbaiki.\n`)
} else {
  console.log(`\nSeluruh pemeriksaan lulus. ${P.PENJARING_VERSI} siap ditempel.\n`)
}
process.exit(gagal ? 1 : 0)
