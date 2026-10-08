/**
 * Sejak Terakhir Dibuka — apa yang berubah sejak dasbor terakhir dilihat.
 *
 * Waktu kunjungan disimpan di peramban (localStorage), satu per akun. Batas
 * itu disebutkan di layar: membuka dasbor dari komputer lain dihitung sebagai
 * kunjungan pertama di sana.
 *
 * Titik acuannya dikunci per sesi peramban (sessionStorage). Tanpa kunci itu,
 * kartunya akan kosong pada penyegaran halaman yang pertama: waktu kunjungan
 * sudah diperbarui oleh gambar pertama, dan gambar kedua membandingkan
 * dirinya dengan dirinya sendiri.
 */

import { dasar, ringkasan } from './hitung.js'

const KUNCI_TERAKHIR = 'transsiberpas.dasbor-terakhir'
const KUNCI_ACUAN = 'transsiberpas.dasbor-acuan'
const JEDA_MINIMAL_MS = 5 * 60_000

function baca(penyimpanan, kunci) {
  try { return penyimpanan.getItem(kunci) } catch { return null }
}

function tulis(penyimpanan, kunci, nilai) {
  try { penyimpanan.setItem(kunci, nilai) } catch { /* peramban menolak; kartu tidak tampil */ }
}

/**
 * Titik acuan sesi ini: waktu kunjungan sebelumnya, atau null bila belum ada.
 * Memperbarui waktu kunjungan tersimpan untuk sesi berikutnya.
 */
export function acuanKunjungan(idPengguna, sekarang = new Date()) {
  const id = String(idPengguna || 'anon')
  const kunciAcuan = `${KUNCI_ACUAN}.${id}`
  const kunciTerakhir = `${KUNCI_TERAKHIR}.${id}`

  const sesiIni = baca(sessionStorage, kunciAcuan)
  if (sesiIni) return sesiIni === 'pertama' ? null : sesiIni

  const lalu = baca(localStorage, kunciTerakhir)
  tulis(localStorage, kunciTerakhir, sekarang.toISOString())
  tulis(sessionStorage, kunciAcuan, lalu || 'pertama')
  return lalu || null
}

/** Ringkasan yang masuk setelah titik acuan. Null bila tidak ada yang layak dilaporkan. */
export function perubahanSejak(berita, acuanIso, sekarang = new Date()) {
  const acuan = new Date(acuanIso || 0).getTime()
  if (!Number.isFinite(acuan) || acuan <= 0) return null
  if (sekarang.getTime() - acuan < JEDA_MINIMAL_MS) return null

  const baru = dasar(berita || []).filter((b) => new Date(b.created_at || 0).getTime() > acuan)
  const r = ringkasan(baru, sekarang)

  return {
    acuan: acuanIso,
    total: r.total,
    negatif: r.negatif.length,
    mendesak: r.mendesak.length,
    kritis: r.kritis.length,
    antrean: r.antrean.length,
  }
}
