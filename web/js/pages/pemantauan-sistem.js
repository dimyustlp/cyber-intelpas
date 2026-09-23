/**
 * Pemantauan Sistem — Aturan Peringatan dan Kesehatan Sistem.
 *
 * Digabung 23 September 2026 atas permintaan user: keduanya menjawab
 * "apakah sistem ini akan memberi tahu saya pada waktunya" — yang satu dari
 * sisi aturan yang dinyalakan, yang lain dari sisi aliran data yang membawa
 * beritanya.
 *
 * Hak tiap tab tidak ikut digabung. Analis memegang `kelola_aturan` tetapi
 * tidak `lihat_kesehatan`; baginya menu ini langsung membuka Aturan
 * Peringatan tanpa bilah tab (ui/bingkai-tab.js).
 */

import { bingkaiTab } from '../ui/bingkai-tab.js'
import { halamanAturan } from './aturan.js'
import { halamanKesehatan } from './kesehatan.js'

export const halamanPemantauanSistem = bingkaiTab({
  nama: 'Pemantauan Sistem',
  tab: [
    { id: 'aturan', label: 'Aturan Peringatan', ikon: 'gembok', bangun: halamanAturan },
    { id: 'kesehatan', label: 'Kesehatan Sistem', ikon: 'kesehatan', bangun: halamanKesehatan },
  ],
})
