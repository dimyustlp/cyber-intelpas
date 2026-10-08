/**
 * Unit yang diberitakan negatif dalam waktu dekat.
 *
 * Menjawab satu pertanyaan pimpinan di pagi hari: unit mana yang baru saja
 * disorot, dalam sehari terakhir, dengan nada buruk. Berbeda dari Deteksi
 * Lonjakan, yang menunggu angkanya melewati ambang statistik, daftar ini
 * memuat setiap unit yang punya satu saja berita negatif dalam jendela waktu.
 *
 * Dua keputusan yang perlu diketahui pembaca kodenya:
 *
 *   Waktunya waktu terbit (`tanggal_publikasi`), bukan waktu penarikan. Berita
 *   yang terbit kemarin pagi tetapi baru tertarik penyalin malam ini bukan
 *   berita dalam 24 jam terakhir. Bila waktu terbit tidak tercatat, barulah
 *   waktu masuk dipakai.
 *
 *   Himpunannya seluruh arsip yang termuat, tidak dibatasi bulan kalender.
 *   Pada pagi tanggal 1, 24 jam terakhir jatuh sebagian di bulan lalu.
 *
 * Berita yang belum terpetakan ke unit tidak ikut dikelompokkan, tetapi
 * jumlahnya dikembalikan supaya layar bisa menyebutnya, bukan menghilangkannya.
 */

import { ringkasan } from './hitung.js'
import { belumTerpetakan } from './unit-terpetakan.js'

export const JENDELA_JAM = 24
const JAM = 3_600_000
const URUT_URGENSI = { Kritis: 3, Tinggi: 2, Sedang: 1 }

function waktuTerbit(b) {
  const t = new Date(b.tanggal_publikasi || b.created_at || 0).getTime()
  return Number.isFinite(t) ? t : 0
}

export function unitNegatifTerbaru(berita = [], sekarang = new Date(), jendelaJam = JENDELA_JAM) {
  const t0 = sekarang.getTime()
  const dalamJendela = ringkasan(berita, sekarang).negatif.filter((b) => {
    const t = waktuTerbit(b)
    // Waktu di masa depan (jam peladen sumber yang maju) tidak dihitung.
    return t > 0 && t <= t0 + 5 * 60_000 && t0 - t <= jendelaJam * JAM
  })

  const peta = new Map()
  let tanpaUnit = 0
  for (const b of dalamJendela) {
    if (belumTerpetakan(b.nama_upt)) { tanpaUnit += 1; continue }
    const nama = String(b.nama_upt).trim()
    if (!peta.has(nama)) peta.set(nama, { nama, jumlah: 0, terakhir: 0, urgensi: '', skor: 0, contoh: null })
    const u = peta.get(nama)
    u.jumlah += 1
    const t = waktuTerbit(b)
    if (t > u.terakhir) { u.terakhir = t; u.contoh = b }
    const skor = URUT_URGENSI[b.urgensi] || 0
    if (skor > u.skor) { u.skor = skor; u.urgensi = b.urgensi }
  }

  const unit = [...peta.values()].sort((a, b) => b.skor - a.skor || b.jumlah - a.jumlah || b.terakhir - a.terakhir)
  return { unit, tanpaUnit, totalBerita: dalamJendela.length, jendelaJam }
}
