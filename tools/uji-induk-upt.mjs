#!/usr/bin/env node
/**
 * Uji angka data induk yang tampil sebelum ada sesi.
 *
 * INDUK_UPT di web/js/lib/konfig.js diketik tangan, sebab halaman masuk harus
 * menyebutnya sebelum siapa pun boleh membaca tabel `upt`. Angka ketikan
 * tangan tertinggal diam-diam: pada 3 November 2026 halaman masuk masih
 * menulis 38 kantor wilayah, sehari setelah data induknya menjadi 33.
 *
 * Uji ini mencocokkannya dengan data/master-upt.csv, sumber kebenaran yang
 * sama dengan yang dimuat ke basis data.
 *
 * Jalankan: node tools/uji-induk-upt.mjs
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INDUK_UPT } from '../web/js/lib/konfig.js'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')

let lulus = 0
let gagal = 0
function sama(nama, dapat, harap) {
  if (dapat === harap) { lulus += 1; return }
  gagal += 1
  console.log(`  GAGAL  ${nama}: konfig.js menulis ${dapat}, data induk memuat ${harap}`)
}

/** Pembaca CSV kecil yang mengerti sel berkutip (alamat memuat koma). */
function bacaCsv(teks) {
  const baris = []
  let sel = ''
  let r = []
  let kutip = false
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i]
    if (kutip) {
      if (c === '"' && teks[i + 1] === '"') { sel += '"'; i++ } else if (c === '"') kutip = false
      else sel += c
    } else if (c === '"') kutip = true
    else if (c === ',') { r.push(sel); sel = '' }
    else if (c === '\n') { r.push(sel.replace(/\r$/, '')); baris.push(r); r = []; sel = '' }
    else sel += c
  }
  if (sel || r.length) { r.push(sel); baris.push(r) }
  return baris.filter((x) => x.length > 1)
}

const [kepala, ...isi] = bacaCsv(readFileSync(join(AKAR, 'data/master-upt.csv'), 'utf8').replace(/^﻿/, ''))
const kolom = (n) => kepala.indexOf(n)
const aktif = isi.filter((r) => String(r[kolom('aktif')]).toLowerCase() !== 'false')

sama('jumlah UPT', INDUK_UPT.jumlah, aktif.length)
sama('jumlah kantor wilayah', INDUK_UPT.kanwil, new Set(aktif.map((r) => r[kolom('kanwil')]).filter(Boolean)).size)

console.log(`${lulus} lulus, ${gagal} gagal — data induk ${aktif.length} UPT.`)
process.exit(gagal ? 1 : 0)
