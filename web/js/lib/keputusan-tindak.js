/**
 * Keputusan tindak lanjut — baca dan simpan, satu pintu.
 *
 * Mesin saran (lib/tindak-lanjut.js) tidak menyimpan apa pun; yang disimpan
 * hanya keputusan analis, di tabel rekomendasi_berita. Berkas ini satu-satunya
 * yang menyentuh tabel itu, supaya halaman Berita Negatif dan halaman detail
 * membaca keputusan yang sama persis dan tidak bisa berselisih tentang siapa
 * yang memutuskan apa.
 *
 * Keputusan dimuat SEKALI per sesi lalu disimpan di memori. Tabelnya kecil
 * (satu baris per berita yang pernah diputuskan) dan setiap simpan
 * memperbarui memori yang sama, sehingga dua halaman tidak perlu saling
 * menunggu jaringan.
 *
 * Mode peragaan tidak punya peladen: keputusan hanya hidup di memori dan
 * hilang saat halaman dimuat ulang. Itu dikatakan di layar, bukan disembunyikan.
 */

import { KONFIG } from './konfig.js'
import { ambil, sisip, perbarui } from './api.js'

const KOLOM = 'berita_id,tindakan,hasil_verifikasi,catatan,evaluasi_sumber,evaluasi_informasi,diputuskan_oleh,diputuskan_pada'

const simpanan = {
  peta: new Map(),
  dimuat: false,
  galat: null,
  sedang: null,
}

/** Peta id berita -> baris keputusan, dalam keadaannya sekarang. */
export function keputusanSaatIni() {
  return simpanan.peta
}

export function keputusanDimuat() {
  return simpanan.dimuat
}

/** Pesan bila pemuatan gagal; null bila baik-baik saja. */
export function galatKeputusan() {
  return simpanan.galat
}

/**
 * Memuat keputusan bila belum. Tidak pernah melempar: kegagalan dicatat di
 * `galatKeputusan()` dan `dimuat` tetap menjadi benar, sehingga halaman yang
 * menggambar ulang setelah pemuatan tidak mengulang pemanggilan tanpa henti.
 */
export async function muatKeputusan({ paksa = false } = {}) {
  if (KONFIG.mode === 'demo') {
    simpanan.dimuat = true
    return simpanan.peta
  }
  if (simpanan.dimuat && !paksa) return simpanan.peta
  if (simpanan.sedang) return simpanan.sedang

  simpanan.sedang = (async () => {
    try {
      const baris = await ambil('rekomendasi_berita', {
        select: KOLOM,
        order: 'diputuskan_pada.desc',
      }, { jangkauan: '0-4999' }) || []
      simpanan.peta = new Map(baris.map((r) => [r.berita_id, r]))
      simpanan.galat = null
    } catch (e) {
      simpanan.galat = String(e?.message || e)
    }
    simpanan.dimuat = true
    return simpanan.peta
  })()

  try {
    return await simpanan.sedang
  } finally {
    simpanan.sedang = null
  }
}

/**
 * Menyimpan keputusan atas satu berita.
 *
 * Memperbarui lebih dulu, menyisipkan bila tidak ada barisnya. PostgREST
 * mengembalikan daftar kosong untuk pembaruan yang tidak mengenai baris mana
 * pun, dan itulah tanda yang dipakai di sini — tanpa menebak dari galat.
 *
 * Nama pemutus dan waktunya diisi basis data lewat pemicu, bukan dikirim dari
 * sini; yang dikembalikan adalah baris yang benar-benar tersimpan.
 */
export async function simpanKeputusan({
  beritaId, tindakan, hasil = null, catatan = '', oleh = 'peragaan',
  evaluasiSumber = null, evaluasiInformasi = null,
}) {
  const isi = {
    tindakan,
    hasil_verifikasi: hasil || null,
    catatan: String(catatan || '').trim().slice(0, 1000) || null,
    // Penilaian SIP (lib/sip.js). Kosong berarti "pakai saran mesin".
    evaluasi_sumber: evaluasiSumber || null,
    evaluasi_informasi: evaluasiInformasi || null,
  }

  if (KONFIG.mode === 'demo') {
    const baris = { berita_id: beritaId, ...isi, diputuskan_oleh: oleh, diputuskan_pada: new Date().toISOString() }
    simpanan.peta.set(beritaId, baris)
    return baris
  }

  let hasilSimpan = await perbarui('rekomendasi_berita', { berita_id: `eq.${beritaId}` }, isi)
  if (!Array.isArray(hasilSimpan) || !hasilSimpan.length) {
    hasilSimpan = await sisip('rekomendasi_berita', { berita_id: beritaId, ...isi })
  }
  const baris = Array.isArray(hasilSimpan) ? hasilSimpan[0] : hasilSimpan
  if (!baris) throw new Error('Keputusan tidak tersimpan: basis data tidak mengembalikan baris.')
  simpanan.peta.set(beritaId, baris)
  return baris
}
