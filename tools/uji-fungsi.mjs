/**
 * Memeriksa bahwa daftar modul tiap Edge Function BENAR-BENAR lengkap, dan
 * bahwa setiap butir menu punya berkas halamannya.
 *
 * DUA KEGAGALAN YANG SAMA-SAMA BARU TERLIHAT SESUDAH TERLAMBAT
 *
 * Yang pertama: `KEBUTUHAN` di tools/ringkas-fungsi.mjs adalah daftar tulis
 * tangan. Sebuah modul yang mengimpor modul lain tidak menariknya ikut serta —
 * yang menariknya hanyalah nama yang diketik seseorang ke dalam daftar itu.
 * Modul yang terlewat tidak menghasilkan galat di komputer siapa pun: seluruh
 * uji lulus, `node tools/ringkas-fungsi.mjs` berhasil, penggelarannya berhasil,
 * dan fungsinya baru mati saat dipanggil — pukul setengah enam pagi, ketika
 * laporan harian tidak sampai dan tidak ada yang tahu sebabnya sampai ada yang
 * membuka log Supabase.
 *
 * Yang kedua: butir menu di web/js/main.js memuat halamannya lewat
 * `import('./pages/x.js')`. Berkas yang tidak ada tidak menggagalkan apa pun
 * saat dibangun — tidak ada langkah membangun — dan tidak menggagalkan satu uji
 * pun. Ia menjadi 404 pada saat butir menunya ditekan, di komputer orang lain.
 *
 * Keduanya jenis kegagalan yang sama: daftar yang harus dijaga disiplin, bukan
 * dijaga mesin. Berkas ini memindahkan keduanya ke mesin.
 *
 * Jalankan:
 *   node tools/uji-fungsi.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname, resolve, relative } from 'node:path'

import { KEBUTUHAN } from './ringkas-fungsi.mjs'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')
const JS = join(AKAR, 'web', 'js')

let lulus = 0
let gagal = 0

function uji(nama, benar, keterangan = '') {
  if (benar) { lulus += 1; return }
  gagal += 1
  console.log(`  GAGAL  ${nama}${keterangan ? `\n         ${keterangan}` : ''}`)
}

/** Jalur modul yang diimpor sebuah berkas, relatif terhadap web/js/. */
function impornya(jalurPenuh, sumber) {
  const pola = [
    /import\s*\{[^}]*\}\s*from\s*['"]([^'"]+)['"]/g,
    /import\s+[A-Za-z0-9_$]+\s+from\s*['"]([^'"]+)['"]/g,
    /export\s*\{[^}]*\}\s*from\s*['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  const hasil = []
  for (const p of pola) {
    let m
    while ((m = p.exec(sumber)) !== null) {
      // Hanya modul setempat. Rujukan http(s) tidak pernah ada di web/js/,
      // tetapi menyaringnya di sini membuat berkas ini tetap benar bila suatu
      // saat ada.
      if (!m[1].startsWith('.')) continue
      const abs = resolve(dirname(jalurPenuh), m[1])
      hasil.push(relative(JS, abs).split('\\').join('/'))
    }
  }
  return [...new Set(hasil)]
}

/* -------------------------------------------- ketertutupan modul Edge Function */

console.log('\nKetertutupan modul Edge Function')
for (const [fungsi, daftar] of Object.entries(KEBUTUHAN)) {
  /*
     Kunci daftar ditulis dua rupa: 'teks.js' berarti lib/teks.js, sedangkan
     'ui/infografis-svg.js' berarti ui/infografis-svg.js. Keduanya disalin RATA
     ke folder fungsi, jadi dari sudut pandang modul yang mengimpornya, seluruh
     berkas berada di satu folder yang sama — dan itulah yang membuat
     `./lambang-data.js` benar di kedua tempat sekaligus.

     Perbandingan di bawah karena itu memakai NAMA BERKAS saja, persis seperti
     yang dilihat modul di dalam fungsi.
  */
  const tersedia = new Set(daftar.map((j) => j.slice(j.lastIndexOf('/') + 1)))

  for (const jalur of daftar) {
    const relatif = jalur.includes('/') ? jalur : `lib/${jalur}`
    const penuh = join(JS, relatif)

    if (!existsSync(penuh)) {
      uji(`${fungsi}: ${jalur} ada`, false,
        `Disebut KEBUTUHAN tetapi berkasnya tidak ada di web/js/${relatif}.`)
      continue
    }

    for (const anak of impornya(penuh, readFileSync(penuh, 'utf8'))) {
      const namaAnak = anak.slice(anak.lastIndexOf('/') + 1)
      uji(
        `${fungsi}: ${jalur} → ${namaAnak}`,
        tersedia.has(namaAnak),
        `${relatif} mengimpor ${anak}, tetapi berkas itu TIDAK ikut disalin ke `
        + `supabase/functions/${fungsi}/.\n         `
        + `Tambahkan ke KEBUTUHAN['${fungsi}'] di tools/ringkas-fungsi.mjs, lalu `
        + 'jalankan ulang alat itu.\n         '
        + 'Tanpa itu fungsinya tergelar tanpa keluhan dan baru mati saat dipanggil.',
      )
    }
  }
}

/* ------------------------------------------------- berkas halaman untuk tiap menu */

console.log('Berkas halaman untuk tiap butir menu')
{
  const main = readFileSync(join(JS, 'main.js'), 'utf8')
  const dimuat = [...main.matchAll(/import\(\s*'\.\/pages\/([a-z0-9-]+\.js)'\s*\)/g)].map((m) => m[1])

  uji('daftar halaman terbaca', dimuat.length > 0,
    'Tidak satu pun `import(\'./pages/…\')` ditemukan di main.js — polanya mungkin berubah, '
    + 'dan uji ini menjadi tidak menguji apa pun.')

  for (const berkas of [...new Set(dimuat)]) {
    uji(`pages/${berkas}`, existsSync(join(JS, 'pages', berkas)),
      `main.js memuat pages/${berkas}, tetapi berkasnya tidak ada. Butir menunya `
      + '404 saat ditekan — tanpa galat saat membangun dan tanpa satu uji pun yang gagal.')
  }
}

/* ------------------------------------- salinan Edge Function memang sudah disegarkan */

console.log('Salinan di supabase/functions sudah disegarkan')
for (const [fungsi, daftar] of Object.entries(KEBUTUHAN)) {
  for (const jalur of daftar) {
    const nama = jalur.slice(jalur.lastIndexOf('/') + 1)
    const salinan = join(AKAR, 'supabase', 'functions', fungsi, nama)
    uji(`${fungsi}/${nama} ada`, existsSync(salinan),
      `Salinannya belum pernah dibuat. Jalankan: node tools/ringkas-fungsi.mjs`)
  }
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
