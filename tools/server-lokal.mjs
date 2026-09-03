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
import { readFileSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web')
const PORTA = Number(process.argv[2] || 4173)

/**
 * Tajuk yang sama persis dengan yang dikirim Vercel, dibaca dari sumber yang
 * sama: `web/vercel.json`.
 *
 * Alasannya satu kelas kegagalan yang khas dan mahal: Content-Security-Policy
 * hanya berlaku di penggelaran, sehingga kebijakan yang memblokir sesuatu yang
 * dipakai aplikasi — sebuah <style> yang disusun saat berjalan, sebuah bingkai
 * pratinjau, sebuah panggilan ke peladen — berjalan mulus di komputer
 * pengembang dan baru gagal di layar petugas. Dengan membaca berkas yang sama,
 * peladen ini menolak hal yang sama, dan yang salah ketahuan sebelum digelar.
 *
 * Ditulis apa adanya: dua pola sumber yang benar-benar dipakai, bukan penafsir
 * pola Vercel yang utuh. Penafsir setengah jadi lebih berbahaya daripada tidak
 * ada — ia akan cocok pada sesuatu yang di penggelaran tidak cocok.
 *
 * **Alasan tiap tajuknya ada di `docs/tajuk-keamanan.md`, bukan di dalam
 * berkasnya.** JSON tidak mengenal komentar, dan skema Vercel memakai
 * `additionalProperties: false` di setiap tingkat — kunci `"//"` yang biasa
 * dipakai sebagai komentar bukan diabaikan melainkan menggagalkan seluruh
 * penggelaran. Berkas itu juga menjelaskan mengapa `vercel.json` harus berada
 * di dalam `web/` dan bukan di akar repositori.
 */
/**
 * Kunci yang diterima skema Vercel, dan tidak satu pun lebih.
 *
 * Skemanya memakai `additionalProperties: false` di setiap tingkat: satu kunci
 * asing membuat **seluruh penggelaran gagal dibangun**, dan pesan galatnya
 * hanya muncul di log Vercel — situsnya sementara itu tetap menyajikan versi
 * lama, sehingga dari luar tidak ada yang tampak berubah. Itu sudah terjadi
 * sekali, pada 3 September 2026, karena kunci `"//"` yang dipakai sebagai
 * komentar. Pemeriksaan di bawah menangkapnya di sini, sebelum didorong.
 */
const KUNCI_SAH = {
  akar: new Set(['$schema', 'headers', 'redirects', 'rewrites', 'cleanUrls',
    'trailingSlash', 'buildCommand', 'outputDirectory', 'framework', 'regions',
    'installCommand', 'devCommand', 'ignoreCommand', 'public', 'functions', 'crons']),
  aturan: new Set(['source', 'headers', 'has', 'missing']),
  tajuk: new Set(['key', 'value']),
}

function periksaBentuk(berkas) {
  const salah = []
  for (const k of Object.keys(berkas)) if (!KUNCI_SAH.akar.has(k)) salah.push(k)
  for (const aturan of berkas.headers || []) {
    for (const k of Object.keys(aturan)) if (!KUNCI_SAH.aturan.has(k)) salah.push(`headers[].${k}`)
    for (const tajuk of aturan.headers || []) {
      for (const k of Object.keys(tajuk)) if (!KUNCI_SAH.tajuk.has(k)) salah.push(`headers[].headers[].${k}`)
    }
  }
  if (salah.length) {
    console.error('\n  BERHENTI: web/vercel.json memuat kunci yang ditolak Vercel:')
    for (const k of [...new Set(salah)]) console.error(`    ${k}`)
    console.error('  Skema Vercel memakai additionalProperties: false. Mendorong berkas ini')
    console.error('  akan menggagalkan penggelaran. Penjelasan: docs/tajuk-keamanan.md\n')
    process.exit(2)
  }
}

function bacaTajukVercel() {
  try {
    const berkas = JSON.parse(readFileSync(join(AKAR, 'vercel.json'), 'utf8'))
    periksaBentuk(berkas)
    return (berkas.headers || []).map((aturan) => ({
      cocok: aturan.source === '/(.*)'
        ? () => true
        : (jalur) => jalur.startsWith(aturan.source.replace('/(.*)', '/')),
      tajuk: Object.fromEntries(
        (aturan.headers || []).filter((h) => h.key).map((h) => [h.key, h.value]),
      ),
    }))
  } catch (galat) {
    console.warn(`  Peringatan: web/vercel.json tidak terbaca (${galat.message}).`)
    console.warn('  Peladen berjalan tanpa tajuk keamanan — dan produksi TIDAK begitu.')
    return []
  }
}

const ATURAN_TAJUK = bacaTajukVercel()

function tajukUntuk(jalur) {
  const hasil = {}
  for (const aturan of ATURAN_TAJUK) {
    if (aturan.cocok(jalur)) Object.assign(hasil, aturan.tajuk)
  }
  return hasil
}

const JENIS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  // Tanpa baris ini peramban menerima manifesnya sebagai octet-stream dan
  // mengabaikannya diam-diam — tidak ada galat, hanya tombol "Pasang" yang
  // tidak pernah muncul dan tidak ada yang menjelaskan mengapa.
  '.webmanifest': 'application/manifest+json; charset=utf-8',
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
      ...tajukUntuk(jalur),
      'Content-Type': JENIS[extname(berkas)] || 'application/octet-stream',
      // Menang atas Cache-Control dari vercel.json, dan memang harus: berkas
      // yang tersimpan di peramban saat pengembangan berarti suntingan yang
      // tidak muncul, dan setengah jam mencari sebabnya di tempat yang salah.
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
