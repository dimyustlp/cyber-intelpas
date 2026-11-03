/**
 * Tindak Lanjut — tiga tab di bawah satu butir menu (3 November 2026).
 *
 *   Klarifikasi UPT       pusat, kanwil, dan UPT (pages/penanganan.js)
 *   Disposisi Pimpinan    pusat dan kanwil (pages/penanganan.js)
 *   Tindak Lanjut Kasus   butir dari Keputusan Pimpinan atas kasus intelijen,
 *                         halaman yang sudah ada sebelumnya (pages/tindak.js)
 *
 * Dua tab pertama diisi dari Analisis Berita: berita negatif yang sudah
 * dianalisis kasus per kasus lalu diberi tujuan. Tab yang tidak berhak dibuka
 * sebuah peran tidak tergambar (ui/bingkai-tab.js); UPT, yang hanya berhak
 * atas Klarifikasi UPT, melihat halamannya tanpa bilah tab.
 */

import { bingkaiTab } from '../ui/bingkai-tab.js'
import { halamanKlarifikasi, halamanDisposisi } from './penanganan.js'
import { halamanTindak } from './tindak.js'

export const halamanTindakLanjut = bingkaiTab({
  nama: 'Tindak Lanjut',
  tab: [
    { id: 'klarifikasi', label: 'Klarifikasi UPT', ikon: 'centang', bangun: halamanKlarifikasi },
    { id: 'disposisi', label: 'Disposisi Pimpinan', ikon: 'keputusan', bangun: halamanDisposisi },
    { id: 'tindak', label: 'Tindak Lanjut Kasus', ikon: 'tindak', bangun: halamanTindak },
  ],
})
