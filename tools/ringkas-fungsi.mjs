/**
 * Menyusun satu berkas modul ringkas untuk Edge Function.
 *
 * Alasannya bukan kinerja, melainkan biaya pengiriman: berkas sumber sengaja
 * dipenuhi penjelasan supaya bisa dirawat orang lain, dan penjelasan itu tidak
 * perlu ikut naik ke server. Yang dibuang hanya komentar dan baris kosong;
 * tidak ada satu pun nama yang diubah, sehingga jejak galat tetap terbaca.
 */
import { readFileSync, writeFileSync } from 'node:fs'

/**
 * Modul yang dibutuhkan tiap Edge Function.
 *
 * Dua fungsi memakai modul yang sama sebagian. Yang berbahaya bukan salinannya
 * — salinan dibuat ulang alat ini setiap kali — melainkan godaan menulis versi
 * sendiri di dalam salah satu fungsi ketika ada yang perlu diubah. Laporan
 * harian mengelompokkan publikasi menjadi peristiwa dengan `peristiwa.js` yang
 * SAMA PERSIS dengan yang dipakai dasbor dan halaman Kanal Negatif; kalau tidak,
 * pimpinan akan membaca "tiga peristiwa" pada lampiran dan "lima peristiwa" di
 * layar untuk hari yang sama.
 */
const KEBUTUHAN = {
  klasifikasi: ['unit-terpetakan.js', 'teks.js', 'taksonomi.js', 'penerbit.js', 'klasifikasi.js', 'pencocokan-upt.js'],
  /*
     laporan-harian menyusun DUA hal dari modul yang sama dengan layar:
     uraian peristiwa (peristiwa.js) dan lembar infografis (infografis.js
     beserta penggambarnya di ui/).

     Daftarnya panjang, dan panjangnya disengaja. Setiap modul di sini adalah
     modul yang angkanya muncul juga di layar; menyalin salah satunya berarti
     lembar yang dikirim ke grup pimpinan pukul setengah enam pagi menyebut
     angka yang tidak sama dengan yang dilihat analis siang harinya.

     Awalan `ui/` menunjuk web/js/ui/. Berkasnya disalin RATA ke dalam folder
     fungsi — tanpa membuat subfolder — sehingga impor './infografis-tata.js'
     di dalam infografis-svg.js tetap benar tanpa satu pun penyesuaian.
  */
  'laporan-harian': [
    'unit-terpetakan.js', 'teks.js', 'pencocokan-upt.js', 'peristiwa.js',
    'format.js', 'sentimen.js', 'hitung.js', 'taksonomi.js', 'penerbit.js',
    'infografis.js', 'peta-indonesia.js', 'peta-provinsi.js',
    'ui/infografis-tata.js', 'ui/infografis-svg.js',
  ],
}

function buangKomentar(kode) {
  let hasil = ''
  let i = 0
  let mode = 'kode'
  let pembatas = ''
  let sebelumnya = ''

  while (i < kode.length) {
    const c = kode[i]
    const d = kode[i + 1]

    if (mode === 'kode') {
      if (c === '/' && d === '*') { mode = 'blok'; i += 2; continue }
      if (c === '/' && d === '/') { mode = 'baris'; i += 2; continue }
      if (c === '"' || c === "'" || c === '`') { mode = 'teks'; pembatas = c; hasil += c; i += 1; continue }
      // Garis miring pembuka pola hanya mungkin sesudah tanda tertentu.
      if (c === '/' && /[=(,:[!&|?{};+\-*%]/.test(sebelumnya)) { mode = 'pola'; hasil += c; i += 1; continue }
      hasil += c
      if (!/\s/.test(c)) sebelumnya = c
      i += 1
      continue
    }

    if (mode === 'blok') { if (c === '*' && d === '/') { mode = 'kode'; i += 2 } else i += 1; continue }
    if (mode === 'baris') { if (c === '\n') { mode = 'kode'; hasil += '\n' } ; i += 1; continue }

    if (mode === 'teks') {
      hasil += c
      if (c === '\\') { hasil += kode[i + 1] ?? ''; i += 2; continue }
      if (c === pembatas) { mode = 'kode'; sebelumnya = c }
      i += 1
      continue
    }

    if (mode === 'pola') {
      hasil += c
      if (c === '\\') { hasil += kode[i + 1] ?? ''; i += 2; continue }
      if (c === '[') pembatas = 'kelas'
      else if (c === ']') pembatas = ''
      else if (c === '/' && pembatas !== 'kelas') { mode = 'kode'; sebelumnya = c }
      i += 1
      continue
    }
  }
  return hasil
}

for (const [fungsi, berkas] of Object.entries(KEBUTUHAN)) {
  console.log(`\n  supabase/functions/${fungsi}/`)
  for (const jalur of berkas) {
    // 'ui/x.js' dibaca dari web/js/ui/, sisanya dari web/js/lib/ — tetapi
    // KEDUANYA ditulis rata di folder fungsi, tanpa subfolder.
    const nama = jalur.includes('/') ? jalur.slice(jalur.lastIndexOf('/') + 1) : jalur
    const asal = jalur.includes('/') ? `web/js/${jalur}` : `web/js/lib/${jalur}`
    const sumber = readFileSync(asal, 'utf8')
    // Lekukan ikut dibuang. Nomor baris tetap utuh — dan nomor baris itulah yang
    // dipakai jejak galat Deno; kolomnya tidak pernah dibaca siapa pun. Pada
    // taksonomi yang isinya ribuan baris larik berlekuk sepuluh spasi, potongan
    // ini saja bernilai belasan kilobita setiap kali fungsi digelar.
    const ringkas = buangKomentar(sumber)
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => b !== '')
      .join('\n')
    writeFileSync(`supabase/functions/${fungsi}/${nama}`, ringkas + '\n')
    console.log('   ', nama.padEnd(20), String(sumber.length).padStart(6), '->', String(ringkas.length).padStart(6))
  }
}
