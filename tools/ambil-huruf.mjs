/**
 * Mengunduh berkas huruf dari Google Fonts, sekali, lalu menyimpannya di repo.
 *
 * Alasannya prinsip yang sudah tertulis di README sejak awal dan selama ini
 * dilanggar oleh satu baris di `index.html`: **tidak ada berkas dari peladen
 * orang lain yang ditarik saat halaman dibuka.** Sebuah sistem intelijen yang
 * memberi tahu fonts.googleapis.com setiap kali seorang petugas membuka
 * dasbornya sedang membocorkan pola kerja unitnya sendiri — alamat IP, jam
 * kerja, dan frekuensinya — kepada pihak yang tidak pernah diminta menyimpannya.
 *
 * Dua akibat lain, dan keduanya terasa: dua perjalanan lintas-ranah (DNS, TLS,
 * CSS, lalu berkas hurufnya) berdiri di depan cat pertama; dan di jaringan
 * kantor yang memblokir ranah Google, seluruh aplikasi tampil dengan huruf
 * sistem tanpa ada yang tahu mengapa.
 *
 * Menjalankan alat ini:
 *
 *   node tools/ambil-huruf.mjs
 *
 * Hasilnya `web/fonts/*.woff2` dan `web/css/huruf.css`. Keduanya **dihasilkan,
 * bukan disunting** — sama seperti peta-indonesia.js. Yang perlu dijalankan
 * ulang hanya ketika daftar KELUARGA di bawah berubah, atau ketika Google
 * menaikkan versi hurufnya dan versi baru itu memang diinginkan.
 *
 * Hanya subset **latin** yang diambil. Bahasa Indonesia seluruhnya ASCII, dan
 * huruf beraksen pada nama asing tetap tampil: peramban mencari huruf pengganti
 * per aksara, bukan per berkas, sehingga satu nama Ceko di judul berita
 * memakai huruf sistem untuk aksara itu saja. Mengambil seluruh subset akan
 * melipatgandakan ukurannya demi aksara yang tidak pernah muncul.
 *
 * Lisensi kedua keluarga huruf ini SIL Open Font License 1.1, yang memang
 * mengizinkan penyimpanan dan penyajian ulang seperti ini.
 */

import { mkdir, writeFile } from 'node:fs/promises'

/** Peramban modern, supaya Google mengirimkan woff2 dan bukan format lama. */
const PERAMBAN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/**
 * Keluarga yang diambil, beserta bentuk permintaannya ke Google.
 *
 * Plus Jakarta Sans diminta sebagai **rentang** `200..800`, bukan sebagai
 * daftar berat. Bedanya bukan sepele: app.css memakai berat 450, 550, dan 650,
 * dan berat itu tidak ada di antara berkas statis. Dengan huruf bervariasi
 * ketiganya digambar tepat; dengan huruf statis peramban menebalkan sendiri
 * berat terdekat, dan hasilnya huruf yang bentuknya sedikit meleset di seluruh
 * label kecil.
 */
const KELUARGA = [
  { nama: 'Plus Jakarta Sans', minta: 'Plus+Jakarta+Sans:wght@200..800', berkas: 'plus-jakarta-sans' },
  { nama: 'IBM Plex Mono', minta: 'IBM+Plex+Mono:wght@400;500;600', berkas: 'ibm-plex-mono' },
]

const alamat = `https://fonts.googleapis.com/css2?${KELUARGA.map((k) => `family=${k.minta}`).join('&')}&display=swap`

/**
 * Memisahkan CSS Google menjadi blok-blok @font-face beserta nama subsetnya.
 *
 * Nama subset hanya ada sebagai komentar tepat di atas tiap blok — tidak ada
 * cara lain mengetahuinya, dan justru komentar itulah yang menentukan berkas
 * mana yang perlu diunduh.
 */
function bacaBlok(css) {
  const blok = []
  const pola = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g
  let cocok
  while ((cocok = pola.exec(css)) !== null) {
    blok.push({ subset: cocok[1], isi: cocok[2] })
  }
  return blok
}

function ambilNilai(blok, sifat) {
  return blok.match(new RegExp(`${sifat}:\\s*([^;]+);`))?.[1]?.trim() || ''
}

const jawaban = await fetch(alamat, { headers: { 'User-Agent': PERAMBAN } })
if (!jawaban.ok) throw new Error(`Google Fonts membalas ${jawaban.status}.`)

const semua = bacaBlok(await jawaban.text()).filter((b) => b.subset === 'latin')
if (semua.length === 0) throw new Error('Tidak ada blok subset latin — bentuk CSS Google berubah.')

await mkdir(new URL('../web/fonts/', import.meta.url), { recursive: true })

const aturan = []
let totalBita = 0

for (const blok of semua) {
  const keluarga = ambilNilai(blok.isi, 'font-family').replace(/['"]/g, '')
  const berat = ambilNilai(blok.isi, 'font-weight')
  const gaya = ambilNilai(blok.isi, 'font-style') || 'normal'
  const rentang = ambilNilai(blok.isi, 'unicode-range')
  const sumber = blok.isi.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1]
  if (!sumber) continue

  const info = KELUARGA.find((k) => k.nama === keluarga)
  // Versi ikut ke dalam nama berkas — itulah yang membuat Cache-Control
  // "immutable" pada web/vercel.json aman: berkas dengan nama ini tidak akan
  // pernah berubah isinya, dan versi baru datang dengan nama baru.
  const versi = sumber.match(/\/(v\d+)\//)?.[1] || 'v0'
  const label = berat.includes(' ') ? 'variabel' : berat
  const nama = `${info?.berkas || 'huruf'}-${versi}-latin-${label}.woff2`

  const berkas = await fetch(sumber, { headers: { 'User-Agent': PERAMBAN } })
  if (!berkas.ok) throw new Error(`${nama} gagal diunduh (${berkas.status}).`)
  const isi = Buffer.from(await berkas.arrayBuffer())
  await writeFile(new URL(`../web/fonts/${nama}`, import.meta.url), isi)
  totalBita += isi.length
  console.log(`  ${nama.padEnd(46)} ${String(isi.length).padStart(7)} bita`)

  aturan.push(`@font-face {
  font-family: '${keluarga}';
  font-style: ${gaya};
  font-weight: ${berat};
  /* swap: teksnya terbaca sejak cat pertama dengan huruf sistem, lalu berganti.
     Pada jaringan lambat, alternatifnya adalah beberapa detik layar yang
     susunannya sudah benar tetapi seluruh tulisannya tidak ada. */
  font-display: swap;
  src: url('../fonts/${nama}') format('woff2');
  unicode-range: ${rentang};
}`)
}

const kepala = `/*
 * Huruf yang disimpan sendiri — DIHASILKAN, jangan disunting.
 *
 * Disusun oleh tools/ambil-huruf.mjs dari Google Fonts, sekali, lalu ikut ke
 * dalam repo. Alasan lengkapnya ada di kepala alat itu; ringkasnya: aplikasi
 * ini tidak boleh menarik satu berkas pun dari peladen orang lain ketika
 * seorang petugas membuka dasbornya.
 *
 * Berkasnya di web/fonts/, dengan versi Google di dalam namanya, dan disajikan
 * dengan Cache-Control immutable selama setahun (web/vercel.json).
 *
 * Disusun ${new Date().toISOString().slice(0, 10)}. Total ${(totalBita / 1024).toFixed(0)} KiB.
 */

`

await writeFile(new URL('../web/css/huruf.css', import.meta.url), kepala + aturan.join('\n\n') + '\n')

console.log(`\n  web/css/huruf.css — ${aturan.length} aturan, ${(totalBita / 1024).toFixed(0)} KiB seluruhnya.`)
console.log('  index.html tidak lagi perlu menyebut fonts.googleapis.com.')
