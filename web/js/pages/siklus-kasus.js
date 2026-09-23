/**
 * Kasus Intelijen — Antrean Telaah dan Kasus dalam satu menu Siklus Intelijen.
 *
 * Digabung 23 September 2026 atas permintaan user. Keduanya dua langkah dari
 * satu pekerjaan: berita ditelaah lebih dulu, lalu yang pantas dijadikan
 * perkara dibentuk menjadi kasus — beserta Analisa Awal-nya, yang diisi pada
 * borang Bentuk Kasus dan tampil di rincian kasus itu. Dulu keduanya
 * dipisahkan dua grup menu, dan analis yang selesai menelaah harus mencari
 * langkah berikutnya di grup lain.
 *
 * Urutan tabnya urutan kerja. Pimpinan dan Analis Evaluasi tidak memegang
 * `telaah_berita`; bagi mereka menu ini langsung membuka daftar kasus, tanpa
 * bilah tab (ui/bingkai-tab.js).
 */

import { bingkaiTab } from '../ui/bingkai-tab.js'
import { halamanTelaah } from './telaah.js'
import { halamanKasus } from './kasus.js'

export const halamanSiklusKasus = bingkaiTab({
  nama: 'Kasus Intelijen',
  tab: [
    { id: 'telaah', label: 'Antrean Telaah', ikon: 'centang', bangun: halamanTelaah },
    { id: 'kasus', label: 'Kasus Intelijen', ikon: 'kasus', bangun: halamanKasus },
  ],
})
