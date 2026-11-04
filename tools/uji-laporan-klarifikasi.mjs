/**
 * Uji laporan klarifikasi berita (lib/laporan-klarifikasi.js).
 *
 * Yang dijaga:
 *
 *   1. Penolakan di peramban sama dengan penolakan peladen
 *      (penanganan_kirim_klarifikasi): tiga butir penentu, tidak lebih.
 *   2. Isian awal diambil dari berita, bukan diketik ulang UPT.
 *   3. Hanya kunci yang dikenal yang dikirim — kolom jsonb tidak menjadi
 *      tempat sampah isian formulir (nama pengirim, berkas).
 *   4. Berkas .docx adalah ZIP yang sah dengan bagian-bagian yang diminta
 *      Word, dan teks isian yang mengandung < & > tidak merusak XML-nya.
 *   5. Waktu konfirmasi dibaca apa adanya, bukan digeser zona waktu mesin.
 *
 * Bentuk tampilannya di Word diperiksa dengan membukanya lewat Word (lihat
 * catatan commit), bukan di sini.
 *
 * Dijalankan tanpa peramban: node tools/uji-laporan-klarifikasi.mjs
 */

import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import {
  LEMBAR, BIDANG, HASIL, TINGKAT, laporanBawaan, bersihkanLaporan, periksaLaporan,
  kalimatWaktuKonfirmasi, labelPilihan, susunDocxKlarifikasi, namaBerkasLaporan,
} from '../web/js/lib/laporan-klarifikasi.js'

let lulus = 0
let gagal = 0

function periksa(nama, kondisi, rinci = '') {
  if (kondisi) { lulus += 1; return }
  gagal += 1
  console.error(`  GAGAL  ${nama}${rinci ? ` — ${rinci}` : ''}`)
}

function sama(nama, dapat, harap) {
  periksa(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, seharusnya ${JSON.stringify(harap)}`)
}

/** Membaca isi ZIP dari direktori pusatnya: { nama → Uint8Array }. */
function bacaZip(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  let akhir = u8.length - 22
  while (akhir >= 0 && dv.getUint32(akhir, true) !== 0x06054b50) akhir -= 1
  const jumlah = dv.getUint16(akhir + 10, true)
  let pos = dv.getUint32(akhir + 16, true)
  const isi = {}
  for (let i = 0; i < jumlah; i++) {
    const metode = dv.getUint16(pos + 10, true)
    const ukuran = dv.getUint32(pos + 20, true)
    const panjangNama = dv.getUint16(pos + 28, true)
    const tambahan = dv.getUint16(pos + 30, true) + dv.getUint16(pos + 32, true)
    const lokal = dv.getUint32(pos + 42, true)
    const nama = new TextDecoder().decode(u8.subarray(pos + 46, pos + 46 + panjangNama))
    const awal = lokal + 30 + dv.getUint16(lokal + 26, true) + dv.getUint16(lokal + 28, true)
    const data = u8.subarray(awal, awal + ukuran)
    isi[nama] = metode === 8 ? new Uint8Array(inflateRawSync(data)) : data
    pos += 46 + panjangNama + tambahan
  }
  return isi
}

const p = {
  nama_upt: 'Lapas Kelas IIA Kediri',
  berita: { judul: 'Napi diduga kendalikan narkoba', media: 'detik.com', link: 'https://detik.com/x', created_at: '2026-11-03T02:15:00Z' },
}

/* 1. penolakan */
sama('kosong ditolak karena hasil', periksaLaporan({}).startsWith('Pilih hasil'), true)
sama('hasil tak dikenal ditolak', periksaLaporan({ hasil_konfirmasi: 'mungkin', fakta: 'x'.repeat(20), tingkat: 'sedang' }).startsWith('Pilih hasil'), true)
sama('fakta pendek ditolak', periksaLaporan({ hasil_konfirmasi: 'benar', fakta: 'pendek', tingkat: 'sedang' }).startsWith('Tuliskan fakta'), true)
sama('tingkat wajib', periksaLaporan({ hasil_konfirmasi: 'benar', fakta: 'cukup panjang sekali', tingkat: '' }).startsWith('Pilih tingkat'), true)
sama('tiga butir cukup', periksaLaporan({ hasil_konfirmasi: 'tidak_benar', fakta: 'cukup panjang sekali', tingkat: 'kritis' }), '')
// Kode yang diterima harus sama persis dengan daftar di migrasi 20261104010000.
const migrasi = readFileSync(new URL('../supabase/migrations/20261104010000_laporan_klarifikasi.sql', import.meta.url), 'utf8')
for (const k of Object.keys(HASIL)) periksa(`hasil "${k}" dikenal peladen`, migrasi.includes(`'${k}'`))
for (const k of Object.keys(TINGKAT)) periksa(`tingkat "${k}" dikenal peladen`, migrasi.includes(`'${k}'`))
sama('bidang wajib = tiga butir peladen', BIDANG.filter((b) => b.wajib).map((b) => b.k).sort().join(','), 'fakta,hasil_konfirmasi,tingkat')

/* 2. isian awal */
const awal = laporanBawaan(p, new Date('2026-11-04T03:30:00Z'))
sama('ringkasan dari judul', awal.ringkasan_isu, 'Napi diduga kendalikan narkoba')
sama('sumber dari media + tautan', awal.sumber, 'detik.com — https://detik.com/x')
sama('waktu ditemukan dalam WIB', awal.waktu_ditemukan, 'Selasa, 3 November 2026 pukul 09.15 WIB')
periksa('setiap bidang punya isian awal', BIDANG.every((b) => b.k in awal))

/* 3. pembersihan */
const bersih = bersihkanLaporan({ ...awal, hasil_konfirmasi: 'benar', pengirim: 'Andi', jabatan: 'X', berkas: {}, asing: 1, fakta: '  isi  ' })
periksa('pengirim tidak ikut', !('pengirim' in bersih) && !('jabatan' in bersih) && !('asing' in bersih))
sama('dipangkas', bersih.fakta, 'isi')
sama('bertanda versi', bersih.format, 'format-klarifikasi-v1')
periksa('kosong dibuang', !('dampak' in bersih))
sama('panjang dibatasi', bersihkanLaporan({ fakta: 'a'.repeat(9000) }).fakta.length, 4000)

/* 4. dokumen */
const laporan = { ...awal, hasil_konfirmasi: 'sebagian_benar', fakta: 'Ponsel <blok C> & "bukan" narkoba.\nBaris dua.', tingkat: 'tinggi', draf_tanggapan: 'Satu.\n\nDua.' }
const logo = new Uint8Array(readFileSync(new URL('../web/format/logo-kop.png', import.meta.url)))
const zip = bacaZip(susunDocxKlarifikasi(laporan, { p, logo, waktuLaporan: new Date('2026-11-04T04:00:00Z') }))
for (const bagian of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels', 'word/media/logo-kop.png']) {
  periksa(`bagian ${bagian}`, Boolean(zip[bagian]))
}
const xml = new TextDecoder().decode(zip['word/document.xml'])
periksa('teks di-escape', xml.includes('Ponsel &lt;blok C&gt; &amp; &quot;bukan&quot;') && !xml.includes('<blok C>'))
for (const judul of ['LAPORAN INSIDENTAL', 'BERITA ACARA', 'VERIFIKASI ISU', 'DRAFT TANGGAPAN']) periksa(`lembar ${judul}`, xml.includes(judul))
periksa('hasil berlabel', xml.includes('Sebagian benar') && xml.includes('>Tinggi<'))
periksa('dua halaman baru', (xml.match(/<w:pageBreakBefore\/>/g) || []).length === 2)
periksa('draf jadi dua alinea', xml.includes('>Satu.<') && xml.includes('>Dua.<'))
periksa('logo direlasikan', new TextDecoder().decode(zip['word/_rels/document.xml.rels']).includes('media/logo-kop.png'))
const tanpaLogo = bacaZip(susunDocxKlarifikasi({}, {}))
periksa('tanpa logo tetap sah', !tanpaLogo['word/media/logo-kop.png'] && !new TextDecoder().decode(tanpaLogo['word/document.xml']).includes('rIdLogo'))
sama('nama berkas', namaBerkasLaporan(p, new Date('2026-11-04T04:00:00Z')), 'laporan-klarifikasi-lapas-kelas-iia-kediri-2026-11-04.docx')

/* 5. waktu */
const w = kalimatWaktuKonfirmasi({ waktu_konfirmasi: '2026-11-04T23:45', zona: 'WITA' })
sama('hari tidak bergeser', `${w.hari} ${w.tanggal} ${w.pukul} ${w.zona}`, 'Rabu 4 November 2026 23.45 WITA')
sama('waktu kosong bertitik', kalimatWaktuKonfirmasi({}).pukul, '........')

/* label */
sama('label pilihan objek', labelPilihan(BIDANG.find((b) => b.k === 'hasil_konfirmasi'), 'tidak_benar'), 'Tidak benar')
sama('label bidang teks', labelPilihan(BIDANG.find((b) => b.k === 'fakta'), 'apa adanya'), 'apa adanya')
sama('tiga lembar', LEMBAR.length, 3)

console.log(`uji-laporan-klarifikasi: ${lulus} lulus, ${gagal} gagal`)
if (gagal) process.exit(1)
