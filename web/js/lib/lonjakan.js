/**
 * Lonjakan dan isu lintas media — bahan bersama Deteksi Lonjakan dan
 * Situation Room.
 *
 * Kedua tabelnya diisi mesin di peladen (Edge Function `deteksi-lonjakan`,
 * dijalankan pg_cron tiap jam). Halaman hanya membaca. Karena dua halaman
 * membaca bahan yang sama, penarikan dan aturan "apa yang masih aktif" ditulis
 * sekali di sini; kalau ditulis di masing-masing halaman, layar dinding dan
 * layar meja akan berselisih angka pada hari ambangnya diubah di satu tempat.
 */

import { ambil } from './api.js'

/** Ambang yang dipakai mesin di peladen. Ditulis di layar supaya bisa ditelusuri. */
export const AMBANG = {
  lonjakan: 'Sebuah unit ditandai bila berita negatifnya dalam 24 jam mencapai sedikitnya 8, '
    + 'sedikitnya 2,5 kali rata-rata hariannya, dan melewati rata-rata ditambah tiga simpangan baku '
    + '(dihitung dari 21 hari ke belakang). Unit yang sama tidak ditandai lagi selama 12 jam.',
  isu: 'Sebuah isu ditandai bila ada sedikitnya 5 artikel dari sedikitnya 3 media berbeda, '
    + 'sebagian besar bernada negatif, dan masih bergerak dalam 24 jam terakhir. '
    + 'Isu yang sama tidak ditandai lagi selama 24 jam.',
}

const JAM = 3_600_000

/** Menarik kedua tabel. Kegagalan satu tabel tidak menggagalkan yang lain. */
export async function muatLonjakan() {
  const [lonjakan, isu] = await Promise.allSettled([
    ambil('peringatan_lonjakan', {
      select: 'id,subjek_tipe,subjek,terdeteksi,jumlah_24j,rata_harian,simpangan,lipat,contoh',
      order: 'terdeteksi.desc', limit: 60,
    }),
    ambil('isu_terpantau', {
      select: 'id,kunci,judul,artikel,media,negatif,mulai,terakhir,terdeteksi,contoh',
      order: 'terakhir.desc', limit: 40,
    }),
  ])

  return {
    lonjakan: lonjakan.status === 'fulfilled' && Array.isArray(lonjakan.value) ? lonjakan.value : [],
    isu: isu.status === 'fulfilled' && Array.isArray(isu.value) ? isu.value : [],
    galatLonjakan: lonjakan.status === 'rejected' ? lonjakan.reason : null,
    galatIsu: isu.status === 'rejected' ? isu.reason : null,
    dimuatPada: new Date().toISOString(),
  }
}

/** Benar bila waktunya jatuh dalam jendela jam terakhir. */
export function dalamJam(iso, jendela = 24, sekarang = Date.now()) {
  const t = new Date(iso || 0).getTime()
  return Number.isFinite(t) && t > 0 && sekarang - t <= jendela * JAM
}

/**
 * Tautan yang aman dibuka dari layar. Isi `contoh` berasal dari judul dan
 * alamat artikel di web, jadi hanya http dan https yang dilewatkan; alamat
 * `javascript:` atau `data:` yang terselip tidak pernah menjadi tautan.
 */
export function tautanAman(url) {
  try {
    const u = new URL(String(url || ''))
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

/** Contoh artikel dari kolom jsonb, dijaga bentuknya. */
export function contohArtikel(contoh, maks = 3) {
  if (!Array.isArray(contoh)) return []
  return contoh
    .filter((c) => c && typeof c === 'object')
    .slice(0, maks)
    .map((c) => ({
      judul: String(c.judul || 'Tanpa judul'),
      media: String(c.media || ''),
      link: tautanAman(c.link),
    }))
}

/** Lonjakan dan isu yang masih aktif (24 jam terakhir), terberat dulu. */
export function aktifSekarang({ lonjakan, isu }, sekarang = Date.now()) {
  return {
    lonjakan: lonjakan
      .filter((l) => dalamJam(l.terdeteksi, 24, sekarang))
      .sort((a, b) => Number(b.lipat || 0) - Number(a.lipat || 0)),
    isu: isu
      .filter((i) => dalamJam(i.terakhir, 24, sekarang))
      .sort((a, b) => (b.artikel || 0) - (a.artikel || 0)),
  }
}

/** Data contoh untuk mode peragaan. */
export function lonjakanPeragaan() {
  const lalu = (jam) => new Date(Date.now() - jam * JAM).toISOString()
  return {
    lonjakan: [
      { id: 1, subjek_tipe: 'upt', subjek: 'Lapas Contoh A', terdeteksi: lalu(2), jumlah_24j: 14, rata_harian: 1.8, simpangan: 1.2, lipat: 7.8,
        contoh: [{ judul: 'Contoh judul berita satu', media: 'Media A', link: 'https://example.com/1' },
          { judul: 'Contoh judul berita dua', media: 'Media B', link: 'https://example.com/2' }] },
      { id: 2, subjek_tipe: 'upt', subjek: 'Rutan Contoh B', terdeteksi: lalu(30), jumlah_24j: 9, rata_harian: 3, simpangan: 1.5, lipat: 3,
        contoh: [] },
    ],
    isu: [
      { id: 1, kunci: 'contoh', judul: 'Isu contoh lintas media', artikel: 7, media: 4, negatif: 6, mulai: lalu(20), terakhir: lalu(1), terdeteksi: lalu(3),
        contoh: [{ judul: 'Contoh artikel isu', media: 'Media C', link: 'https://example.com/3' }] },
    ],
    galatLonjakan: null,
    galatIsu: null,
    dimuatPada: new Date().toISOString(),
  }
}
