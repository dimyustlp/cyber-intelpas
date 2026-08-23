/**
 * Menyusun satu berkas modul ringkas untuk Edge Function.
 *
 * Alasannya bukan kinerja, melainkan biaya pengiriman: berkas sumber sengaja
 * dipenuhi penjelasan supaya bisa dirawat orang lain, dan penjelasan itu tidak
 * perlu ikut naik ke server. Yang dibuang hanya komentar dan baris kosong;
 * tidak ada satu pun nama yang diubah, sehingga jejak galat tetap terbaca.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const BERKAS = ['teks.js', 'taksonomi.js', 'penerbit.js', 'klasifikasi.js', 'pencocokan-upt.js']

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

for (const nama of BERKAS) {
  const sumber = readFileSync(`web/js/lib/${nama}`, 'utf8')
  // Lekukan ikut dibuang. Nomor baris tetap utuh — dan nomor baris itulah yang
  // dipakai jejak galat Deno; kolomnya tidak pernah dibaca siapa pun. Pada
  // taksonomi yang isinya ribuan baris larik berlekuk sepuluh spasi, potongan
  // ini saja bernilai belasan kilobita setiap kali fungsi digelar.
  const ringkas = buangKomentar(sumber)
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b !== '')
    .join('\n')
  writeFileSync(`supabase/functions/klasifikasi/${nama}`, ringkas + '\n')
  console.log(nama.padEnd(20), String(sumber.length).padStart(6), '->', String(ringkas.length).padStart(6))
}
