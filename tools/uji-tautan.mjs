/**
 * Penjaga keselarasan aturan penyeragaman tautan.
 *
 * Aturannya hidup di TIGA tempat, dan itu tidak bisa dihindari:
 *
 *   public.normalkan_tautan()                     basis data — YANG BERWENANG
 *   web/js/lib/tautan.js                          peramban — peringatan dini
 *   supabase/functions/sheet-sync/sheet-sync.ts   penyalin — penyaringan awal
 *
 * Sampai 6 September 2026 tidak ada satu pun yang menahan ketiganya tetap
 * sama. Komentar di salah satunya sudah menyebut akibatnya: "Kalau keduanya
 * berbeda, satu berita yang sama akan tersimpan dua kali." Kalimat itu benar,
 * dan kalimat saja tidak pernah cukup.
 *
 * Berkas ini memeriksa salinan JavaScript terhadap daftar jawaban yang
 * SUDAH DIPERIKSA LANGSUNG terhadap fungsi basis datanya pada tanggal itu.
 * Menyunting salah satu salinan tanpa menyunting yang lain akan memerahkan
 * perintah ini.
 *
 *   node tools/uji-tautan.mjs
 */

import { normalkanTautan } from '../web/js/lib/tautan.js'

/**
 * [nama, masukan, keluaran yang diharapkan]
 *
 * Kolom ketiga bukan tebakan penulis berkas ini. Seluruhnya dijalankan
 * terhadap `public.normalkan_tautan()` di basis data produksi pada 6 September
 * 2026, dan disalin apa adanya dari hasilnya.
 */
const KASUS = [
  ['penanda iklan dibuang',
    'https://www.kompas.com/news/123/?utm_source=fb&utm_medium=post',
    'https://kompas.com/news/123'],

  ['http disamakan menjadi https',
    'http://kompas.com/news/123',
    'https://kompas.com/news/123'],

  ['inang dikecilkan hurufnya',
    'https://KOMPAS.com/news/123/',
    'https://kompas.com/news/123'],

  ['fragmen dibuang',
    'https://www.kompas.com/news/123#komentar',
    'https://kompas.com/news/123'],

  ['tanpa skema dianggap https',
    'kompas.com/news/123',
    'https://kompas.com/news/123'],

  ['fbclid dibuang, halaman dipertahankan',
    'https://www.detik.com/a/b?fbclid=XYZ&page=2',
    'https://detik.com/a/b?page=2'],

  ['halaman tanpa penanda tidak berubah',
    'https://www.detik.com/a/b?page=2',
    'https://detik.com/a/b?page=2'],

  ['ekor AMP dibuang',
    'https://tribunnews.com/x/amp',
    'https://tribunnews.com/x'],

  ['tanpa AMP tidak berubah',
    'https://tribunnews.com/x',
    'https://tribunnews.com/x'],

  ['igsh instagram dibuang',
    'https://Instagram.com/p/ABC/?igsh=zzz',
    'https://instagram.com/p/ABC'],

  /*
     Jalur TIDAK ikut dikecilkan hurufnya, dan ini kasus yang paling mudah
     dirusak tanpa sengaja. Pengenal video YouTube peka besar-kecil huruf;
     mengecilkannya menghasilkan alamat yang membuka video yang berbeda, atau
     tidak membuka apa pun.
  */
  ['jalur peka besar-kecil huruf dipertahankan',
    'https://youtu.be/AbCdEf_12',
    'https://youtu.be/AbCdEf_12'],

  ['kosong tetap kosong', '', ''],
  ['spasi saja tetap kosong', '   ', ''],
]

let benar = 0
const gagal = []

for (const [nama, masuk, harap] of KASUS) {
  const dapat = normalkanTautan(masuk)
  if (dapat === harap) benar += 1
  else gagal.push({ nama, masuk, harap, dapat })
}

console.log(`\nPenyeragaman tautan: ${benar}/${KASUS.length} sesuai basis data\n`)

if (gagal.length) {
  console.log('─'.repeat(84))
  for (const g of gagal) {
    console.log(`\nBEDA  ${g.nama}`)
    console.log(`  masukan : ${g.masuk}`)
    console.log(`  harapan : ${g.harap}   (dari public.normalkan_tautan)`)
    console.log(`  didapat : ${g.dapat}`)
  }
  console.log('\n' + '─'.repeat(84))
  console.log('\nSalinan JavaScript sudah berbeda dari aturan basis data.')
  console.log('Yang tersimpan tetap benar — pemicu basis data menimpanya — tetapi')
  console.log('peringatan kembar di halaman Input Berita kini bisa meleset.\n')
}

/* ------------------------------------------------ keselarasan dengan penyalin */

/*
   Salinan di sheet-sync.ts tidak bisa diimpor dari sini: ia TypeScript dan
   ditulis untuk Deno. Yang diperiksa karena itu bukan perilakunya melainkan
   satu hal yang bisa diperiksa tanpa menjalankannya — bahwa daftar penanda
   pelacaknya sudah diperbarui. Pemeriksaan yang lemah tetapi jujur lebih baik
   daripada kesan aman tanpa dasar.
*/
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const akar = join(dirname(fileURLToPath(import.meta.url)), '..')
const penyalin = readFileSync(join(akar, 'supabase/functions/sheet-sync/sheet-sync.ts'), 'utf8')

const WAJIB_ADA = ['mibextid', 'msclkid', 'at_campaign', 'amp']
const hilang = WAJIB_ADA.filter((k) => !penyalin.includes(k))

if (hilang.length) {
  console.log(`sheet-sync.ts belum memuat penanda: ${hilang.join(', ')}`)
  console.log('Daftar penanda pelacaknya tertinggal dari aturan basis data.\n')
}

process.exit(gagal.length || hilang.length ? 1 : 0)
