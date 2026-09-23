/**
 * Analisis Pemberitaan — Tren, Narasi, Kaitan, dan Pusat Komando dalam satu fitur.
 *
 * Sampai 23 September 2026 keempatnya berdiri sebagai empat butir menu, dengan
 * alasan tertulis bahwa halaman bertab membuat dua di antaranya tidak pernah
 * dibuka. User memutuskan sebaliknya: empat butir yang membaca arsip yang sama
 * dari sudut berbeda membuat menu Ruang Pimpinan terlalu panjang untuk
 * dipindai. Cara bingkainya bekerja — dan kenapa tabnya tautan — ada di
 * ui/bingkai-tab.js.
 *
 * Urutannya urutan baca: apa yang berubah, cerita apa, siapa bertemu apa, lalu
 * layar dinding. Operator Puldata memegang `lihat_dasbor` tetapi tidak
 * `lihat_tren`; baginya fitur ini hanya berisi Pusat Komando, dan itu memang
 * yang dulu ia lihat di menunya.
 */

import { bingkaiTab } from '../ui/bingkai-tab.js'
import { halamanTren } from './tren.js'
import { halamanNarasi } from './narasi.js'
import { halamanJaringan } from './jaringan.js'
import { halamanKomando } from './komando.js'

export const halamanAnalisis = bingkaiTab({
  nama: 'Analisis Pemberitaan',
  tab: [
    { id: 'tren', label: 'Tren', ikon: 'tren', bangun: halamanTren },
    { id: 'narasi', label: 'Narasi', ikon: 'laporan', bangun: halamanNarasi },
    { id: 'jaringan', label: 'Kaitan', ikon: 'kasus', bangun: halamanJaringan },
    { id: 'komando', label: 'Pusat Komando', ikon: 'dasbor', bangun: halamanKomando },
  ],
})
