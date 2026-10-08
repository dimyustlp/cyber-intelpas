/**
 * Lokasi peramban (GPS) untuk catatan login.
 *
 * Lokasi dari alamat jaringan hanya setingkat kota dan mudah dikelirukan VPN.
 * Titik dari peramban lebih tepat, tetapi itu data pribadi, jadi aturannya:
 *
 *   Selalu didahului pemberitahuan yang menjelaskan siapa yang melihatnya,
 *   berapa lama disimpan, dan bahwa menolak tidak mengurangi hak apa pun.
 *   Jawaban diingat per akun di peramban ini, jadi pertanyaannya tidak
 *   diulang tiap login. Yang menolak tidak ditanya lagi.
 *   Peramban sendiri tetap memunculkan izin lokasinya; dua lapis persetujuan.
 *   Dikirim sekali per sesi. Tidak ada pelacakan terus-menerus.
 *
 * Kegagalan di sini tidak pernah mengganggu pemakaian aplikasi.
 */

import { konfirmasi } from '../ui/komponen.js'
import { panggilFungsi } from './api.js'

const KUNCI = 'transsiberpas.gps.'
const SESI = 'transsiberpas.gps-terkirim'

function baca(kunci, penyimpan = localStorage) {
  try { return penyimpan.getItem(kunci) } catch { return null }
}
function tulis(kunci, nilai, penyimpan = localStorage) {
  try { penyimpan.setItem(kunci, nilai) } catch { /* penyimpanan diblokir; jawaban tidak diingat */ }
}

function ambilPosisi() {
  return new Promise((selesai, gagal) => {
    navigator.geolocation.getCurrentPosition(selesai, gagal, {
      enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000,
    })
  })
}

async function kirim(posisi) {
  const { latitude, longitude, accuracy } = posisi.coords
  const akurasi = Number.isFinite(accuracy) ? Math.round(accuracy) : null
  // Baris log login ditulis peladen beberapa detik setelah masuk. Bila belum
  // ada saat pertama dicoba, dicoba sekali lagi tidak lama kemudian.
  for (const tunggu of [6_000, 20_000]) {
    await new Promise((r) => setTimeout(r, tunggu))
    const tercatat = await panggilFungsi('catat_lokasi_peramban', {
      p_lintang: latitude, p_bujur: longitude, p_akurasi: akurasi,
    }).catch(() => false)
    if (tercatat) return true
  }
  return false
}

/** Dipanggil sekali sesudah layar pertama berdiri. Tidak ditunggu pemanggilnya. */
export async function catatLokasiBilaDiizinkan(profil) {
  try {
    if (!profil || !('geolocation' in navigator)) return
    if (baca(SESI, sessionStorage)) return

    const kunci = KUNCI + (profil.auth_user_id || profil.id || 'anon')
    let jawaban = baca(kunci)
    if (jawaban === 'tolak') return

    if (jawaban !== 'setuju') {
      const ya = await konfirmasi({
        judul: 'Catat lokasi login Anda?',
        pesan: 'Untuk pengamanan akun, Pemilik Sistem dapat melihat titik lokasi perangkat Anda saat login, '
          + 'bila peramban mengizinkan. Titik ini dipakai hanya untuk memeriksa login yang janggal, tidak dilacak '
          + 'terus-menerus, dan dihapus otomatis setelah 30 hari. Menolak tidak mengurangi hak akses Anda.',
        tegas: 'Izinkan',
        batal: 'Tidak, terima kasih',
      })
      jawaban = ya ? 'setuju' : 'tolak'
      tulis(kunci, jawaban)
      if (!ya) return
    }

    tulis(SESI, '1', sessionStorage)
    const posisi = await ambilPosisi()
    await kirim(posisi)
  } catch {
    /* izin ditolak di peramban, waktu habis, atau sinyal GPS tidak ada */
  }
}
