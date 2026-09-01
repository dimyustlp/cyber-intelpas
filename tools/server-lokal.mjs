/**
 * Peladen statis untuk pengembangan dan pemeriksaan tampilan.
 *
 * Aplikasi ini tidak memerlukan proses bangun, jadi tidak ada yang perlu
 * dikompilasi — cukup sajikan berkasnya apa adanya. Dijalankan dengan:
 *
 *   node tools/server-lokal.mjs [porta]
 */

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web')
const PORTA = Number(process.argv[2] || 4173)

const JENIS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  // Laporan harian diterbitkan sebagai PDF. Tanpa baris ini peladen
  // mengirimkannya sebagai octet-stream, dan peramban mengunduhnya alih-alih
  // menampilkannya — yang membuat hasil laporan tidak bisa diperiksa mata.
  '.pdf': 'application/pdf',
}

const peladen = createServer(async (permintaan, jawaban) => {
  try {
    const jalur = decodeURIComponent(new URL(permintaan.url, 'http://x').pathname)
    // Normalisasi mencegah permintaan menembus ke luar direktori web/.
    const aman = normalize(jalur).replace(/^(\.\.[/\\])+/, '')
    let berkas = join(AKAR, aman === '/' ? 'index.html' : aman)

    try {
      const info = await stat(berkas)
      if (info.isDirectory()) berkas = join(berkas, 'index.html')
    } catch {
      berkas = join(AKAR, 'index.html') // rute sisi klien
    }

    const isi = await readFile(berkas)
    jawaban.writeHead(200, {
      'Content-Type': JENIS[extname(berkas)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    jawaban.end(isi)
  } catch (galat) {
    jawaban.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    jawaban.end(`Gagal menyajikan berkas: ${galat.message}`)
  }
})

peladen.listen(PORTA, () => {
  console.log(`Trans-Siber PAS disajikan di http://localhost:${PORTA}`)
  console.log(`Mode peragaan          : http://localhost:${PORTA}/?mode=demo`)
})
