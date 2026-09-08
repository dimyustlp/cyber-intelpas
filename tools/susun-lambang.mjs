/**
 * Menyusun web/js/ui/lambang-data.js dari berkas lambang di web/assets/.
 *
 * KENAPA LAMBANGNYA DITANAM, BUKAN DITAUTKAN
 *
 * Lembar infografis digambar sekali dan dipakai di tiga tempat, dan dua di
 * antaranya tidak bisa mengambil berkas dari mana pun:
 *
 *   - PNG untuk grup Telegram dirasterkan peramban dengan memuat SVG-nya ke
 *     dalam <img>. SVG di dalam <img> berjalan dalam mode terkunci: setiap
 *     rujukan ke luar — berkas gambar, huruf, lembar gaya — diabaikan tanpa
 *     satu pun pesan. Yang keluar adalah lembar tanpa lambang, dan tidak ada
 *     galat yang memberitahunya. Data URI adalah satu-satunya bentuk gambar
 *     yang dimuat di mode itu, dan satu-satunya yang tidak menodai canvas
 *     sehingga toBlob() tetap boleh dipanggil.
 *   - PDF disusun Edge Function, yang tidak punya satu pun berkas repositori
 *     di sampingnya.
 *
 * Maka lambangnya ikut sebagai teks di dalam modul, dan modul itu ikut disalin
 * ke Edge Function oleh tools/ringkas-fungsi.mjs.
 *
 * KENAPA JPEG, BUKAN PNG BERALFA
 *
 * Kartu kepala lembar berlatar putih polos, jadi alfa tidak dibutuhkan di
 * sana — dan PNG beralfa dari lencana berfoto ini tiga kali lebih besar
 * daripada JPEG dengan mutu yang sama. Yang lebih menentukan: JPEG bisa
 * ditanam ke dalam PDF apa adanya sebagai aliran DCTDecode, sehingga penerjemah
 * SVG→PDF tidak perlu menyandikan ulang satu piksel pun.
 *
 * Berkas beralfa tetap ada — web/assets/lambang-*.png — dan itulah yang dipakai
 * antarmuka, yang latarnya berganti mengikuti tema.
 *
 * Jalankan sesudah mengganti berkas lambang mana pun:
 *   node tools/susun-lambang.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const akar = join(dirname(fileURLToPath(import.meta.url)), '..')

const LAMBANG = [
  {
    nama: 'TRANS_SIBER',
    berkas: 'web/assets/lambang-trans-siber-lembar.jpg',
    keterangan: 'Lencana Trans-Siber Pemasyarakatan — Database Pamintel.',
  },
  {
    nama: 'DITPAMINTEL',
    berkas: 'web/assets/lambang-ditpamintel-lembar.jpg',
    keterangan: 'Lencana Direktorat Pengamanan dan Intelijen Republik Indonesia.',
  },
]

/* Batas kewarasan. Lembar SVG dibawa utuh ke dalam memori peramban, dikirim
   sebagai lampiran Telegram, dan disalin ke Edge Function; lambang yang tanpa
   sengaja diganti dengan berkas sepuluh megabita akan mematikan ketiganya
   sekaligus, dan yang pertama terlihat hanyalah laporan pagi yang tidak
   pernah sampai. */
const BATAS_BITA = 60 * 1024

const potongan = []
for (const { nama, berkas, keterangan } of LAMBANG) {
  const bita = readFileSync(join(akar, berkas))
  if (bita.length > BATAS_BITA) {
    console.error(`${berkas}: ${bita.length} bita, lebih dari batas ${BATAS_BITA}.`)
    process.exit(1)
  }
  // Empat bita pertama JPEG selalu FF D8 FF; berkas yang salah jenis akan
  // tertanam sebagai data URI yang sah tetapi tidak pernah tergambar.
  if (bita[0] !== 0xff || bita[1] !== 0xd8 || bita[2] !== 0xff) {
    console.error(`${berkas}: bukan JPEG.`)
    process.exit(1)
  }
  potongan.push({ nama, keterangan, data: bita.toString('base64'), bita: bita.length })
  console.log(`${berkas.padEnd(46)} ${String(bita.length).padStart(6)} bita`)
}

const isi = `/**
 * Lambang lembar infografis, sebagai data URI.
 *
 * BERKAS INI DISUSUN ALAT — jangan disunting dengan tangan. Ganti berkasnya di
 * web/assets/, lalu jalankan: node tools/susun-lambang.mjs
 *
 * Alasan lambangnya ditanam sebagai teks dan bukan ditautkan ada di kepala
 * alat itu; ringkasnya, dua dari tiga keluaran lembar ini — PNG yang
 * dirasterkan peramban dan PDF yang disusun Edge Function — tidak bisa
 * mengambil berkas dari mana pun.
 */

${potongan.map(({ nama, keterangan, data, bita }) => `/** ${keterangan} (${bita} bita) */
export const ${nama} = 'data:image/jpeg;base64,${data}'`).join('\n\n')}
`

writeFileSync(join(akar, 'web/js/ui/lambang-data.js'), isi)
console.log(`\nweb/js/ui/lambang-data.js ditulis — ${isi.length} aksara.`)
