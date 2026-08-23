/**
 * Membuat berkas laporan berkala dari sebuah snapshot negatif.
 *
 *   node tools/buat-laporan.mjs <snapshot.json> <keluaran.html> [harian|mingguan] [nomor]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { susunLaporan, nomorLaporan } from '../web/js/lib/laporan.js'

const [, , masuk, keluar, jenis = 'mingguan', urutan = '1'] = process.argv
if (!masuk || !keluar) {
  console.error('Pemakaian: node tools/buat-laporan.mjs <snapshot.json> <keluaran.html> [harian|mingguan] [nomor]')
  process.exit(1)
}

const snapshot = JSON.parse(readFileSync(masuk, 'utf8'))
const html = susunLaporan(snapshot, {
  jenis,
  urutan: Number(urutan),
  nomor: nomorLaporan(jenis, Number(urutan), snapshot.periode.selesai),
})
writeFileSync(keluar, html, 'utf8')
console.log(`Laporan ${jenis} ditulis ke ${keluar} (${(html.length / 1024).toFixed(0)} KB)`)
