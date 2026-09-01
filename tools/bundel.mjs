/**
 * Penggabung berkas — membuat satu halaman HTML mandiri dari seluruh modul.
 *
 * Aplikasi ini dirancang tanpa proses bangun, dan itu tetap cara utamanya
 * dijalankan. Alat ini hanya untuk satu keperluan: menghasilkan satu berkas
 * HTML yang bisa dibuka langsung dari mana saja — dikirim lewat surel,
 * ditempel di halaman pratinjau, atau dibuka dari flashdisk — tanpa perlu
 * peladen sama sekali.
 *
 * Cara kerjanya sederhana. Tiap modul dibungkus menjadi satu fungsi dengan
 * lingkupnya sendiri, lalu didaftarkan ke sebuah pencatat kecil. Dengan begitu
 * dua modul yang kebetulan sama-sama punya variabel bernama `saring` tidak
 * saling menimpa.
 *
 * Daftar modulnya tidak ditulis tangan. Alat ini menelusuri sendiri rantai
 * impor mulai dari js/main.js, sehingga berkas baru yang diimpor dari mana pun
 * ikut terbawa tanpa ada yang perlu diingat. Daftar tangan pernah dipakai di
 * sini, dan hasilnya persis seperti yang bisa diduga: satu modul baru lupa
 * didaftarkan, bundelnya tetap jadi, lalu aplikasinya mati saat dibuka.
 *
 * Dijalankan dengan: node tools/bundel.mjs [keluaran.html]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web')
/* Argumen berbentuk penanda tidak boleh dikira nama berkas keluaran. Pernah
   terjadi: `node tools/bundel.mjs --demo` menulis sebuah berkas yang namanya
   justru penandanya sendiri, sementara berkas mandiri yang dimaksud tidak
   pernah ada — dan tidak ada satu baris pun yang mengatakannya. */
const KELUARAN = process.argv.slice(2).find((a) => !a.startsWith('--'))
  || join(AKAR, '..', 'trans-siber-pas-mandiri.html')

/**
 * Dengan --demo, berkas hasil selalu memakai data peragaan dan tidak pernah
 * menghubungi peladen. Dipakai untuk pratinjau yang boleh dibuka siapa pun
 * tanpa risiko menyentuh data sungguhan.
 */
const PAKSA_DEMO = process.argv.includes('--demo')

const PINTU = 'js/main.js'

/** Menyelesaikan jalur relatif sebuah impor menjadi kunci modul. */
function selesaikan(dariModul, jalur) {
  const abs = resolve(dirname(join(AKAR, dariModul)), jalur)
  return relative(AKAR, abs).split('\\').join('/')
}

/** Semua jalur yang diimpor sebuah berkas, statis maupun tertunda. */
function impornya(kunci, sumber) {
  const jalur = []
  const pola = [
    /import\s*\{[^}]*\}\s*from\s*['"]([^'"]+)['"]/g,
    /import\s*['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const p of pola) {
    let m
    while ((m = p.exec(sumber))) jalur.push(selesaikan(kunci, m[1]))
  }
  return [...new Set(jalur)]
}

/**
 * Telusur mendalam. Modul anak selalu didaftarkan sebelum induknya, jadi
 * urutan pada berkas hasil enak dibaca — walau pencatat sebetulnya tidak
 * peduli urutan.
 */
function kumpulkan() {
  const urut = []
  const sudah = new Set()
  const sedang = new Set()

  function turun(kunci, dari) {
    if (sudah.has(kunci)) return
    if (sedang.has(kunci)) return // impor melingkar: cukup dilewati sekali
    const berkas = join(AKAR, kunci)
    if (!existsSync(berkas)) {
      throw new Error(`Modul ${kunci} diimpor oleh ${dari || '(pintu masuk)'} tetapi berkasnya tidak ada.`)
    }
    sedang.add(kunci)
    for (const anak of impornya(kunci, readFileSync(berkas, 'utf8'))) turun(anak, kunci)
    sedang.delete(kunci)
    sudah.add(kunci)
    urut.push(kunci)
  }

  turun(PINTU, null)
  return urut
}

const MODUL = kumpulkan()

function ubah(kunci, sumber) {
  const ekspor = []
  let hasil = sumber

  // import { a, b as c } from './x.js'
  // Perhatikan: pola sengaja tidak memakan spasi setelah tanda kutip penutup.
  // Kalau baris baru ikut termakan, pernyataan `export` di baris berikutnya
  // tidak lagi berada di awal baris dan luput dari penggantian berikutnya.
  hasil = hasil.replace(
    /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/g,
    (_, isi, jalur) => {
      const bagian = isi
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const m = s.match(/^(\S+)\s+as\s+(\S+)$/)
          return m ? `${m[1]}: ${m[2]}` : s
        })
      return `const { ${bagian.join(', ')} } = __minta('${selesaikan(kunci, jalur)}');`
    },
  )

  // await import('./x.js') — dipakai main.js untuk menunda pemuatan api.js
  hasil = hasil.replace(
    /await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g,
    (_, jalur) => `__minta('${selesaikan(kunci, jalur)}')`,
  )

  // export function / const / let / class
  hasil = hasil.replace(
    /^export\s+(async\s+)?(function|const|let|class)\s+([A-Za-z0-9_$]+)/gm,
    (_, asinkron, jenis, nama) => {
      ekspor.push(nama)
      return `${asinkron || ''}${jenis} ${nama}`
    },
  )

  // export { a, b as c }
  hasil = hasil.replace(/^export\s*\{([^}]*)\}\s*;?$/gm, (_, isi) => {
    for (const s of isi.split(',').map((x) => x.trim()).filter(Boolean)) {
      const m = s.match(/^(\S+)\s+as\s+(\S+)$/)
      ekspor.push(m ? `${m[2]}: ${m[1]}` : s)
    }
    return ''
  })

  const sisa = hasil.match(/^\s*export\s/m)
  if (sisa) throw new Error(`Bentuk export yang belum ditangani di ${kunci}`)

  return { kode: hasil, ekspor: [...new Set(ekspor)] }
}

// ---------------------------------------------------------------- rakit

const potongan = []
for (const kunci of MODUL) {
  let sumber = readFileSync(join(AKAR, kunci), 'utf8')

  if (PAKSA_DEMO && kunci === 'js/lib/konfig.js') {
    sumber = sumber.replace(
      /mode: parameter\.get\('mode'\) === 'demo' \? 'demo' : 'langsung',/,
      "mode: 'demo', // dipaksa oleh tools/bundel.mjs --demo",
    )
    // Kunci peladen dibuang dari berkas pratinjau. Berkas ini boleh beredar,
    // dan tidak ada gunanya membawa alamat basis data ke dalamnya.
    sumber = sumber
      .replace(/url: 'https:\/\/[^']*',/, "url: '',")
      .replace(/kunciPublik: '[^']*',/, "kunciPublik: '',")
  }

  const { kode, ekspor } = ubah(kunci, sumber)
  potongan.push(
    `__daftar('${kunci}', function (__minta) {\n${kode}\nreturn { ${ekspor.join(', ')} };\n});`,
  )
}

const pencatat = `
/* Pencatat modul kecil. Tiap modul punya lingkupnya sendiri, sehingga nama
   variabel yang kebetulan sama antar berkas tidak saling menimpa. */
const __pabrik = new Map();
const __isi = new Map();
function __daftar(nama, fn) { __pabrik.set(nama, fn); }
function __minta(nama) {
  if (__isi.has(nama)) return __isi.get(nama);
  const fn = __pabrik.get(nama);
  if (!fn) throw new Error('Modul tidak ditemukan: ' + nama);
  const kotak = {};
  __isi.set(nama, kotak);
  Object.assign(kotak, fn(__minta) || {});
  return kotak;
}
`

const css = readFileSync(join(AKAR, 'css/app.css'), 'utf8')
const html = readFileSync(join(AKAR, 'index.html'), 'utf8')

const badan = html
  .replace(/<link rel="stylesheet" href="css\/app\.css">/, `<style>\n${css}\n</style>`)
  .replace(
    /<script type="module" src="js\/main\.js"><\/script>/,
    `<script type="module">\n${pencatat}\n${potongan.join('\n\n')}\n\n__minta('js/main.js');\n</script>`,
  )

/**
 * Pemeriksaan terakhir sebelum berkas ditulis: setiap permintaan modul di
 * dalam hasil harus punya pendaftarnya. Kalau tidak, bundel yang kelihatan
 * berhasil sebetulnya sudah mati sejak dibuat, dan itu baru ketahuan saat
 * layarnya kosong di komputer orang lain.
 */
const diminta = [...badan.matchAll(/__minta\('([^']+)'\)/g)].map((m) => m[1])
const hilang = [...new Set(diminta)].filter((n) => !MODUL.includes(n))
if (hilang.length) {
  console.error(`GAGAL — modul diminta tetapi tidak ikut terbundel:\n  ${hilang.join('\n  ')}`)
  process.exit(1)
}

// Pemeriksaan kedua: sisa sintaks modul ES di dalam blok skrip akan membuat
// seluruh berkas gagal diurai oleh peramban, tanpa pesan apa pun di layar.
const skrip = badan.slice(badan.indexOf('<script type="module">'))
if (/^\s*(import|export)\s/m.test(skrip.replace(/__minta\(/g, ''))) {
  console.error('GAGAL — masih ada pernyataan import/export yang belum diubah.')
  process.exit(1)
}

writeFileSync(KELUARAN, badan, 'utf8')

console.log(`Berkas mandiri ditulis ke ${KELUARAN}`)
console.log(`Ukuran: ${(Buffer.byteLength(badan) / 1024).toFixed(0)} KB · ${MODUL.length} modul digabung`)
console.log(MODUL.map((m) => `  · ${m}`).join('\n'))
