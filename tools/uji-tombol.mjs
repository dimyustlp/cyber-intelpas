/**
 * Uji integritas tombol antar fitur.
 *
 * Yang diperiksa bukan apakah sebuah tombol tampil, melainkan apakah menekannya
 * benar-benar mendaratkan penekannya di tempat yang dijanjikan labelnya. Ada
 * empat cara sebuah tombol berbohong, dan keempatnya pernah ada di sini:
 *
 *   1. Tujuannya tidak terdaftar. `data-halaman="x"` yang tidak ada di penunjuk
 *      halaman mendarat di layar "halaman tidak dikenali" — tanpa galat, tanpa
 *      catatan konsol, tanpa satu pun tanda bahwa yang salah adalah tombolnya.
 *
 *   2. Tujuannya ada, tetapi penekannya tidak berhak membukanya. Tombol
 *      "Bentuk kasus" di Kanal Negatif tampil bagi Operator Puldata, yang tidak
 *      punya izin `lihat_kasus`. Ia menekan, dan layar berikutnya kosong atau
 *      — lebih buruk — berisi halaman pusat yang tidak pantas ia lihat.
 *
 *   3. Aksinya tidak pernah disimak. `aksi: 'kirim'` yang tidak punya penyimak
 *      menghasilkan tombol yang benar-benar bisa ditekan dan tidak melakukan
 *      apa pun. Inilah kegagalan yang paling lama tidak terdeteksi, sebab
 *      tidak ada yang rusak di layar.
 *
 *   4. Saringan titipannya tidak dikenali halaman tujuan. Ubin dasbor yang
 *      menyebut angka 12 membuka daftar berisi 400 baris, dan pembacanya
 *      menyimpulkan angka di dasbor salah.
 *
 * Alat ini membaca berkas sebagai teks, bukan menjalankannya. Itu memang
 * batasnya: tujuan yang disusun saat program berjalan tidak terlihat dari
 * sini. Karena itu setiap temuan menyebut berkas dan barisnya, supaya yang
 * membaca bisa memeriksa sendiri — dan bukan mempercayai alat ini begitu saja.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')
const JS = join(AKAR, 'web', 'js')

/* ------------------------------------------------------------- pembacaan */

function baca(jalur) {
  return readFileSync(jalur, 'utf8')
}

/** Seluruh berkas .js di bawah web/js, berikut isinya. */
function berkasJs() {
  const hasil = []
  const telusuri = (dir) => {
    for (const nama of readdirSync(dir, { withFileTypes: true })) {
      const jalur = join(dir, nama.name)
      if (nama.isDirectory()) telusuri(jalur)
      else if (nama.name.endsWith('.js')) {
        hasil.push({ jalur, nama: relative(JS, jalur).replace(/\\/g, '/'), isi: baca(jalur) })
      }
    }
  }
  telusuri(JS)
  return hasil.sort((a, b) => a.nama.localeCompare(b.nama))
}

/** Nomor baris sebuah indeks karakter, supaya temuan bisa ditunjuk. */
function barisDi(isi, indeks) {
  return isi.slice(0, indeks).split('\n').length
}

/* ------------------------------------ apa yang terdaftar di penunjuk halaman */

const isiMain = baca(join(JS, 'main.js'))

/**
 * Nama halaman yang dikenali penunjuk halaman.
 *
 * Dibaca dari blok `const HALAMAN = { ... }` di main.js. Kalau blok itu
 * berpindah atau berganti bentuk, alat ini berhenti dengan galat alih-alih
 * diam-diam menyatakan seluruh tombol rusak.
 */
function halamanTerdaftar() {
  const awal = isiMain.indexOf('const HALAMAN = {')
  if (awal < 0) throw new Error('Blok `const HALAMAN = {` tidak ditemukan di main.js')
  const akhir = isiMain.indexOf('\n}', awal)
  const blok = isiMain.slice(awal, akhir)
  const nama = new Set()
  for (const c of blok.matchAll(/^\s*'?([a-z][a-z0-9-]*)'?:\s*\(\)\s*=>/gm)) nama.add(c[1])
  if (!nama.size) throw new Error('Penunjuk halaman terbaca kosong')
  return nama
}

const HALAMAN = halamanTerdaftar()

/* --------------------------------------------------- peran, izin, dan menu */

const isiPeran = baca(join(JS, 'lib', 'peran.js'))

/** Daftar izin tiap peran, dibaca dari blok `export const IZIN = { ... }`. */
function izinPeran() {
  const awal = isiPeran.indexOf('export const IZIN = {')
  const akhir = isiPeran.indexOf('\n}', awal)
  const blok = isiPeran.slice(awal, akhir)
  const peta = {}
  for (const c of blok.matchAll(/^ {2}([a-z_]+):\s*\[([\s\S]*?)\],$/gm)) {
    peta[c[1]] = [...c[2].matchAll(/'([^']+)'/g)].map((m) => m[1])
  }
  return peta
}

const IZIN = izinPeran()

/** Butir menu tiap ruang: id halaman → izin yang dituntutnya. */
function butirMenu(namaKonstanta) {
  const awal = isiPeran.indexOf(`export const ${namaKonstanta} = [`)
  if (awal < 0) throw new Error(`Blok ${namaKonstanta} tidak ditemukan`)
  const akhir = isiPeran.indexOf('\n]', awal)
  const blok = isiPeran.slice(awal, akhir)
  const butir = []
  for (const c of blok.matchAll(/\{ id: '([a-z-]+)'.*?izin: '([a-z_]+)'/g)) {
    butir.push({ id: c[1], izin: c[2] })
  }
  return butir
}

const MENU_INTERNAL = butirMenu('MENU')
const MENU_KANWIL = butirMenu('MENU_KANWIL')
const MENU_UPT = butirMenu('MENU_UPT')

const PERAN_EKSTERNAL = new Set(['kanwil_admin', 'upt_penelaah'])
const PERAN_UNIT = new Set(['upt_penelaah'])

function menuUntuk(peran) {
  return PERAN_UNIT.has(peran) ? MENU_UPT
    : PERAN_EKSTERNAL.has(peran) ? MENU_KANWIL
      : MENU_INTERNAL
}

function punyaIzin(peran, izin) {
  const daftar = IZIN[peran] || []
  return daftar.includes('*') || daftar.includes(izin)
}

const SEMUA_PERAN = Object.keys(IZIN)

/**
 * Halaman yang boleh dibuka sebuah peran lewat menunya sendiri.
 *
 * Halaman yang tidak punya butir menu — detail berita, profil — ditambahkan
 * di bawah dengan izin yang setara, sebab ketiadaan butir menu bukan berarti
 * ketiadaan hak.
 */
const IZIN_TAMBAHAN = {
  /* Detail berita dibuka dari Pusat Data Berita dan palet perintah. Haknya
     mengikuti hak membaca berita pusat. */
  'berita-detail': 'lihat_berita',
  /* Profil saya. Setiap orang yang punya sesi berhak atas halamannya sendiri,
     termasuk peran daerah — karena itu tidak ada syarat izin di sini. */
  profil: null,
  /* Nama lama halaman berita daerah, dipertahankan untuk tautan tersimpan. */
  'kanwil-riwayat': 'lihat_berita_wilayah',
}

function halamanBoleh(peran) {
  const boleh = new Set(
    menuUntuk(peran).filter((b) => punyaIzin(peran, b.izin)).map((b) => b.id),
  )
  for (const [id, izin] of Object.entries(IZIN_TAMBAHAN)) {
    if (izin === null || punyaIzin(peran, izin)) boleh.add(id)
  }
  return boleh
}

/** peran → himpunan halaman yang sah baginya. */
const BOLEH = Object.fromEntries(SEMUA_PERAN.map((p) => [p, halamanBoleh(p)]))

/**
 * Halaman → peran yang bisa sampai ke sana lewat menu.
 *
 * Dipakai terbalik: sebuah tombol yang tertulis di berkas halaman X hanya
 * pernah dilihat oleh peran yang boleh membuka X.
 */
function peranYangMelihat(halaman) {
  return SEMUA_PERAN.filter((p) => BOLEH[p].has(halaman))
}

/* ------------------------------------- berkas halaman → nama halamannya */

/**
 * Satu berkas bisa membangun lebih dari satu halaman — kanwil.js membangun
 * empat. Pemetaan ini dibaca dari penunjuk halaman di main.js, sehingga
 * penambahan halaman baru tidak menuntut penyuntingan berkas ini.
 */
function berkasKeHalaman() {
  const peta = {}
  for (const c of isiMain.matchAll(/'?([a-z][a-z0-9-]*)'?:\s*\(\)\s*=>\s*import\('\.\/(pages\/[a-z-]+\.js)'\)/g)) {
    ;(peta[c[2]] ||= []).push(c[1])
  }
  return peta
}

const BERKAS_HALAMAN = berkasKeHalaman()

/* ------------------------------------------------------------- pemeriksaan */

const temuan = []
const catatan = []

/*
   Tiga penjaga di main.js, dibaca sekali di muka.

   Keberadaan penyapu menentukan apakah "tombol melampaui izin penekannya"
   masih berupa cacat atau sudah sekadar catatan. Sesudah penyapu ada, tombol
   semacam itu tidak pernah sampai ke layar — tetapi daftarnya tetap layak
   dicetak: ia memberi tahu halaman mana yang tampil berbeda bagi peran yang
   berbeda, dan itu yang perlu diperiksa dengan mata sebelum rilis.
*/
const ADA_PENJAGA_RUTE = /bolehBuka\(keadaan\.profil\.role, id\)/.test(isiMain)
const ADA_PENYAPU = /function saringTombolTakBerhak/.test(isiMain)
  && /saringTombolTakBerhak\(isi\)/.test(isiMain)
const ADA_PENJAGA_ACARA = /buka-halaman[\s\S]{0,900}?bolehBuka/.test(isiMain)

function catat(jenis, berkas, baris, pesan) {
  /* Tombol yang melampaui izin sudah disapu sebelum tampil. Yang tersisa
     bukan cacat, melainkan keterangan tentang apa yang hilang bagi siapa. */
  const tujuan = jenis === 'izin-timpang' && ADA_PENYAPU ? catatan : temuan
  tujuan.push({ jenis, berkas, baris, pesan })
}

const semua = berkasJs()

/* --- 1 & 2: tujuan navigasi ------------------------------------------- */

/**
 * Tujuan navigasi yang tertulis apa adanya di sebuah berkas.
 *
 * Tiga bentuk yang dipakai di seluruh aplikasi, dan ketiganya bermuara pada
 * penunjuk halaman yang sama:
 *   `halaman: 'x'`        — lewat komponen tombol dan ubin
 *   `data-halaman="x"`    — HTML yang ditulis langsung
 *   `halaman: 'x'` di detail acara `buka-halaman`
 */
function tujuanNavigasi(isi) {
  const hasil = []
  for (const c of isi.matchAll(/halaman:\s*'([a-z][a-z0-9-]*)'/g)) {
    hasil.push({ id: c[1], baris: barisDi(isi, c.index) })
  }
  for (const c of isi.matchAll(/data-halaman="([a-z][a-z0-9-]*)"/g)) {
    hasil.push({ id: c[1], baris: barisDi(isi, c.index) })
  }
  for (const c of isi.matchAll(/location\.hash\s*=\s*'#([a-z][a-z0-9-]*)'/g)) {
    hasil.push({ id: c[1], baris: barisDi(isi, c.index) })
  }
  return hasil
}

for (const { nama, isi } of semua) {
  if (nama === 'main.js') continue
  const sumberHalaman = BERKAS_HALAMAN[nama] || []

  for (const { id, baris } of tujuanNavigasi(isi)) {
    /* Cacat 1 — tujuan tidak terdaftar. */
    if (!HALAMAN.has(id)) {
      catat('tujuan-hilang', nama, baris,
        `Tombol menuju "${id}", yang tidak terdaftar di penunjuk halaman main.js.`)
      continue
    }

    /* Cacat 2 — tujuan ada, tetapi sebagian peran yang melihat tombol ini
       tidak berhak membukanya. Hanya diperiksa untuk tombol yang tinggal di
       berkas halaman: yang tinggal di pustaka bisa dipanggil dari mana saja,
       dan menebaknya akan menghasilkan tuduhan palsu. */
    if (!sumberHalaman.length) continue

    for (const asal of sumberHalaman) {
      const penonton = peranYangMelihat(asal)
      const buta = penonton.filter((p) => !BOLEH[p].has(id))
      if (!buta.length) continue
      catat('izin-timpang', nama, baris,
        `Di halaman "${asal}" ada tombol menuju "${id}". Peran ${buta.join(', ')} `
        + 'melihat tombol itu tetapi tidak berhak membuka tujuannya.')
    }
  }
}

/* --- 3: aksi tanpa penyimak -------------------------------------------- */

/** Aksi yang disimak main.js untuk seluruh halaman. */
const AKSI_GLOBAL = new Set(
  [...isiMain.matchAll(/aksi === '([a-z-]+)'/g)].map((c) => c[1]),
)

for (const { nama, isi } of semua) {
  if (nama === 'main.js') continue

  /*
     Hanya `aksi: 'literal'` yang dihitung sebagai penamaan aksi. Bentuk
     `aksi: \`...\`` adalah slot HTML pada kartu, bukan nama aksi — dan
     menghitungnya akan membuat setiap kartu tampak rusak.

     Yang juga harus dikeluarkan, dan sempat tidak: `aksi` di dalam muatan
     `panggilEdge(...)`. Nama itu milik Edge Function di seberang, bukan milik
     sebuah tombol. Menghitungnya menuduh tujuh tombol yang sehat — antara
     lain seluruh tombol di halaman Integrasi dan penerbitan akun di Manajemen
     Pengguna — dan tuduhan palsu sebanyak itu membuat seluruh daftar temuan
     berhenti dipercaya, termasuk yang benar.
  */
  const tanpaMuatanEdge = isi.replace(/panggilEdge\([^)]*\)/gs, '')

  const disebut = new Map()
  for (const c of tanpaMuatanEdge.matchAll(/\baksi:\s*'([a-z][a-z0-9-]*)'/g)) {
    if (!disebut.has(c[1])) disebut.set(c[1], barisDi(tanpaMuatanEdge, c.index))
  }
  for (const c of tanpaMuatanEdge.matchAll(/data-aksi="([a-z][a-z0-9-]*)"/g)) {
    if (!disebut.has(c[1])) disebut.set(c[1], barisDi(tanpaMuatanEdge, c.index))
  }

  /*
     Penyimak dikenali dari perbandingan terhadap teks apa pun, bukan hanya
     dari `aksi === '...'`.

     Beberapa halaman memisahkan argumen dari nama aksinya lebih dulu —
     `const [nama, arg] = aksi.split(':')` — lalu membandingkan `nama`. Pola
     yang hanya mencari kata "aksi" akan menyatakan seluruh tombol Distribusi
     Telegram mati, padahal ketiganya bekerja.

     Longgar dengan sengaja. Alat ini mencari tombol yang namanya tidak
     disebut di mana pun di berkasnya; ketelitian yang lebih tinggi dari itu
     menuntut penguraian sintaks yang utuh, dan harganya tidak sepadan.
  */
  const disimak = new Set([
    ...[...isi.matchAll(/===\s*'([a-z][a-z0-9-]*)'/g)].map((c) => c[1]),
    ...[...isi.matchAll(/\[data-aksi="([a-z-]+)"\]/g)].map((c) => c[1]),
    ...[...isi.matchAll(/case '([a-z-]+)'/g)].map((c) => c[1]),
  ])

  for (const [aksi, baris] of disebut) {
    if (disimak.has(aksi) || AKSI_GLOBAL.has(aksi)) continue
    catat('aksi-mati', nama, baris,
      `Tombol beraksi "${aksi}" tidak punya penyimak di berkas ini maupun di main.js. `
      + 'Menekannya tidak melakukan apa pun.')
  }
}

/* --- 4: saringan titipan ------------------------------------------------ */

/**
 * Kunci saringan yang dititipkan sebuah tombol, dan kunci yang benar-benar
 * dikenali halaman tujuan.
 *
 * Halaman tujuan dianggap mengenali sebuah kunci bila nama kunci itu muncul
 * di berkasnya. Longgar dengan sengaja: yang dicari di sini adalah kunci yang
 * sama sekali tidak dikenal siapa pun, bukan salah eja yang kebetulan mirip.
 */
/*
   Dibaca dari `const saring = { ... }`, bukan dari `NILAI_BAKU`.

   Keduanya memang memuat kunci yang sama, tetapi yang kedua ditulis sebagai
   `{ ...saring }` — sebuah sebaran, tanpa satu pun nama kunci di dalamnya.
   Membacanya menghasilkan himpunan kosong, dan himpunan kosong membuat SETIAP
   saringan titipan tampak asing. Ketiga tuduhan pertama alat ini lahir dari
   situ, dan ketiganya keliru.
*/
const NILAI_BAKU_BERITA = (() => {
  const isi = baca(join(JS, 'pages', 'berita.js'))
  const awal = isi.indexOf('const saring = {')
  if (awal < 0) throw new Error('Blok `const saring = {` tidak ditemukan di pages/berita.js')
  const blok = isi.slice(awal, isi.indexOf('\n}', awal))
  const kunci = new Set([...blok.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((c) => c[1]))
  if (!kunci.size) throw new Error('Saringan Pusat Data Berita terbaca kosong')
  return kunci
})()

/**
 * Nama halaman → berkas yang membangunnya.
 *
 * Kebalikan `BERKAS_HALAMAN`, dipakai untuk menemukan berkas tujuan sebuah
 * saringan titipan.
 */
const HALAMAN_KE_BERKAS = (() => {
  const peta = new Map()
  for (const [berkas, daftar] of Object.entries(BERKAS_HALAMAN)) {
    for (const id of daftar) peta.set(id, berkas)
  }
  return peta
})()

const ISI_BERKAS = new Map(semua.map((b) => [b.nama, b.isi]))

/**
 * Halaman tujuan sebuah saringan titipan.
 *
 * Dicari pada potongan teks di sekitar `saring: { ... }` — bentuk yang dipakai
 * seluruh aplikasi menaruh keduanya di dalam satu objek yang sama, entah
 * sebagai `{ halaman: 'x', saring: {...} }` pada ubin, entah sebagai
 * `detail: { halaman: 'x', saring: {...} }` pada acara.
 *
 * Sampai 5 September 2026 alat ini tidak mencarinya sama sekali: ia
 * membandingkan SETIAP kunci saringan dengan daftar kunci Pusat Data Berita,
 * sebab dulu memang hanya halaman itu yang membaca `saringMasuk`. Begitu
 * halaman kedua ikut membacanya, ketiga tombol yang menuju ke sana dituduh
 * membawa kunci asing — tuduhan yang benar menurut daftar lama dan keliru
 * menurut aplikasinya.
 */
function tujuanSaring(isi, indeks) {
  const awal = Math.max(0, indeks - 220)
  const jendela = isi.slice(awal, indeks + 220)
  const kedudukanSaring = indeks - awal

  /*
     Yang diambil adalah `halaman:` yang PALING DEKAT, bukan yang terakhir.

     Penyimak klik sebuah halaman menaruh beberapa cabang berdampingan, dan
     cabang berikutnya sering menyebut tujuan lain hanya beberapa baris di
     bawahnya. Mengambil yang terakhir di dalam jendela berarti membaca tujuan
     milik cabang tetangga — dan menuduh sebuah saringan salah alamat justru
     ketika alamatnya benar.
  */
  let terdekat = null
  let jarak = Infinity
  for (const c of jendela.matchAll(/halaman:\s*'([a-z][a-z0-9-]*)'/g)) {
    const d = Math.abs(c.index - kedudukanSaring)
    if (d < jarak) { jarak = d; terdekat = c[1] }
  }
  return terdekat
}

for (const { nama, isi } of semua) {
  for (const c of isi.matchAll(/saring:\s*\{([^}]*)\}/g)) {
    const kunci = [...c[1].matchAll(/([a-zA-Z][a-zA-Z0-9]*)\s*:/g)].map((m) => m[1])
    const baris = barisDi(isi, c.index)

    const tujuan = tujuanSaring(isi, c.index)
    const berkasTujuan = tujuan ? HALAMAN_KE_BERKAS.get(tujuan) : null
    const isiTujuan = berkasTujuan ? ISI_BERKAS.get(berkasTujuan) : null

    for (const k of kunci) {
      /* Halaman tujuan dianggap mengenali sebuah kunci bila nama kunci itu
         muncul di berkasnya. Longgar dengan sengaja: yang dicari di sini
         adalah kunci yang sama sekali tidak dikenal siapa pun, bukan salah
         eja yang kebetulan mirip. */
      if (isiTujuan) {
        if (new RegExp(`\\b${k}\\b`).test(isiTujuan)) continue
        catat('saring-asing', nama, baris,
          `Saringan titipan memakai kunci "${k}", yang tidak disebut di mana pun pada `
          + `halaman tujuan "${tujuan}" (${berkasTujuan}). Halamannya terbuka tanpa tersaring.`)
        continue
      }

      // Tujuan tidak terbaca dari teksnya — kembali ke anggapan lama, yaitu
      // Pusat Data Berita, satu-satunya halaman yang dulu membaca saringMasuk.
      if (NILAI_BAKU_BERITA.has(k)) continue
      catat('saring-asing', nama, baris,
        `Saringan titipan memakai kunci "${k}", dan halaman tujuannya tidak terbaca `
        + 'dari teks. Kunci itu juga tidak ada pada saringan Pusat Data Berita.')
    }
  }
}

/* --- 5: penjaga rute ---------------------------------------------------- */

/*
   Penunjuk halaman menggambar halaman apa pun yang namanya terdaftar, tanpa
   sekali pun bertanya apakah peran yang sedang masuk berhak atasnya. Menu
   memang tidak menampilkan butirnya — tetapi alamat bisa diketik, disalin dari
   rekan, dan tersimpan di penanda peramban.
*/
if (!ADA_PENJAGA_RUTE) {
  catat('rute-tanpa-penjaga', 'main.js', barisDi(isiMain, isiMain.indexOf('export function gambar()')),
    'Penunjuk halaman tidak memeriksa izin sebelum menggambar. Peran mana pun '
    + 'yang mengetik alamat halaman lain akan mendapatkannya.')
}

if (!ADA_PENYAPU) {
  catat('rute-tanpa-penjaga', 'main.js', 0,
    'Tidak ada penyaring tombol sesudah halaman digambar. Setiap halaman harus '
    + 'mengingat sendiri untuk menyaring tombolnya, dan sebagian besar tidak.')
}

if (!ADA_PENJAGA_ACARA) {
  catat('rute-tanpa-penjaga', 'main.js', 0,
    'Acara `buka-halaman` tidak diperiksa izinnya. Tombol yang menyebut '
    + 'tujuannya di dalam penyimak kliknya tidak tersapu penyaring tombol.')
}

/* ------------------------------------------------------------------ hasil */

const JENIS = {
  'tujuan-hilang': 'Tujuan tidak terdaftar',
  'izin-timpang': 'Tombol melampaui izin penekannya',
  'aksi-mati': 'Tombol tanpa penyimak',
  'saring-asing': 'Saringan titipan tidak dikenali',
  'rute-tanpa-penjaga': 'Rute tanpa penjaga izin',
}

console.log('\nUji integritas tombol antar fitur\n' + '='.repeat(52))
console.log(`Halaman terdaftar: ${HALAMAN.size}   Peran: ${SEMUA_PERAN.length}   Berkas dipindai: ${semua.length}`)
console.log(`Penjaga rute: ${ADA_PENJAGA_RUTE ? 'ada' : 'TIDAK ADA'}   `
  + `Penyapu tombol: ${ADA_PENYAPU ? 'ada' : 'TIDAK ADA'}   `
  + `Penjaga acara: ${ADA_PENJAGA_ACARA ? 'ada' : 'TIDAK ADA'}\n`)

if (catatan.length) {
  console.log(`Tombol yang disapu penyaring — ${catatan.length}`)
  console.log('-'.repeat(52))
  console.log('  Bukan cacat. Tombol berikut tidak digambar bagi peran yang tidak')
  console.log('  berhak atas tujuannya. Yang perlu diperiksa dengan mata: apakah')
  console.log('  halaman yang kehilangan tombolnya masih masuk akal tanpa tombol itu.\n')
  const perBerkas = new Map()
  for (const c of catatan) {
    const kunci = c.berkas
    if (!perBerkas.has(kunci)) perBerkas.set(kunci, [])
    perBerkas.get(kunci).push(c)
  }
  for (const [berkas, daftar] of perBerkas) {
    console.log(`  ${berkas} — ${daftar.length} tombol`)
  }
  console.log()
}

if (!temuan.length) {
  console.log('Tidak ada cacat. Seluruh tombol menuju halaman yang terdaftar,')
  console.log('punya penyimak, dan menitipkan saringan yang dikenali tujuannya.\n')
  process.exit(0)
}

for (const jenis of Object.keys(JENIS)) {
  const kelompok = temuan.filter((t) => t.jenis === jenis)
  if (!kelompok.length) continue
  console.log(`\n${JENIS[jenis]} — ${kelompok.length}`)
  console.log('-'.repeat(52))
  for (const t of kelompok) console.log(`  ${t.berkas}:${t.baris}\n    ${t.pesan}`)
}

console.log(`\nJumlah temuan: ${temuan.length}\n`)
process.exit(1)
