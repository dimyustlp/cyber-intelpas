/**
 * Menggambar lembar infografis dari berkas JSON, sebagai berkas HTML.
 *
 * Untuk memeriksa tata letak tanpa menjalankan aplikasi, tanpa basis data, dan
 * tanpa menunggu pukul setengah enam pagi. Lembar ini penuh dengan hal yang
 * hanya bisa dinilai dengan melihat — judul yang menabrak panel sebelah, peta
 * yang tidak muat, batang tema yang meluber ke bawah kartu — dan tidak satu pun
 * di antaranya tertangkap uji angka.
 *
 * Jalankan:
 *   node tools/pratinjau-infografis.mjs <berkas.json> [keluaran.html] [harian|mingguan]
 *
 * Berkas JSON-nya: { berita: [...], unit: [...] }.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { susunInfografis } from '../web/js/lib/infografis.js'
import { svgInfografis } from '../web/js/ui/infografis-svg.js'
import { BATAS, DARATAN, TETANGGA } from '../web/js/lib/peta-indonesia.js'
import { PROVINSI, PROVINSI_INDUK } from '../web/js/lib/peta-provinsi.js'

const AKAR = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const berkas = process.argv[2]
if (!berkas) {
  console.error('Sebutkan berkas JSON berisi { berita, unit } sebagai argumen pertama.')
  process.exit(1)
}
const keluaran = process.argv[3] || join(AKAR, 'potret', 'infografis.html')
const jenis = process.argv[4] || 'mingguan'

const mentah = JSON.parse(readFileSync(berkas, 'utf8'))
const berita = Array.isArray(mentah) ? mentah : mentah.berita || []
const unit = Array.isArray(mentah) ? [] : mentah.unit || []

const hari = berita
  .map((b) => String(b.tanggal_publikasi || b.created_at || '').slice(0, 10))
  .filter(Boolean)
  .sort()

const model = susunInfografis({
  berita,
  unit,
  mulai: hari[0],
  selesai: hari[hari.length - 1],
  jenis,
  indukProvinsi: PROVINSI_INDUK,
})

const svg = svgInfografis(model, {
  batas: BATAS,
  daratan: DARATAN,
  tetangga: TETANGGA,
  provinsi: PROVINSI,
})

const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Pratinjau lembar infografis</title>
<style>
  body { margin: 0; background: #333a44; display: grid; place-items: center; min-height: 100vh; }
  .lembar { width: min(96vw, 1600px); box-shadow: 0 24px 60px rgba(0,0,0,.4); }
  .lembar svg { display: block; width: 100%; height: auto; }
  @media print {
    body { background: #fff; }
    .lembar { width: 100%; box-shadow: none; }
    @page { size: A4 landscape; margin: 0; }
  }
</style>
</head>
<body><div class="lembar">${svg}</div></body>
</html>
`

writeFileSync(keluaran, html)
writeFileSync(keluaran.replace(/\.html$/, '.svg'), svg)

console.log(`Berita       : ${model.ikhtisar.total} (dari ${berita.length} baris)`)
console.log(`Periode      : ${model.periode.label}`)
console.log(`Tema         : ${model.tema.length}`)
console.log(`Provinsi     : ${model.ikhtisar.provinsi}`)
console.log(`Berkas       : ${keluaran}`)
console.log(`Ukuran SVG   : ${(svg.length / 1024).toFixed(0)} KB`)
