/**
 * Uji saran tindak lanjut.
 *
 * Yang diuji adalah urutan pemeriksaan yang dijelaskan di kepala
 * lib/tindak-lanjut.js, karena urutan itulah yang menentukan apakah sebuah
 * tim dikirim atau sebuah bantahan diterbitkan:
 *
 *   1. Hoaks tetap klarifikasi walau urgensinya tinggi.
 *   2. Kata unit mendahului urgensi: "Tidak Benar" mengalahkan Kritis.
 *   3. Kritis tidak menunggu konfirmasi; Tinggi menunggu.
 *   4. Berita non-negatif, di luar lingkup, atau sudah dikecualikan tidak
 *      pernah mendapat saran.
 *   5. Keputusan analis menang atas mesin, dan perbedaannya ditandai.
 *   6. Peristiwa dinilai dari publikasinya yang TERBERAT.
 *
 * Dijalankan tanpa peramban: node tools/uji-tindak.mjs
 */

import {
  TINDAKAN, HASIL_VERIFIKASI, sarankanMesin, sarankanTindak, sarankanPeristiwa,
  terkonfirmasi, hitungTindakan,
} from '../web/js/lib/tindak-lanjut.js'

let lulus = 0
let gagal = 0

function periksa(nama, kondisi, rinci = '') {
  if (kondisi) { lulus += 1; return }
  gagal += 1
  console.error(`  GAGAL  ${nama}${rinci ? ` — ${rinci}` : ''}`)
}

function sama(nama, dapat, harap) {
  periksa(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, seharusnya ${JSON.stringify(harap)}`)
}

/** Berita negatif dasar; setiap uji hanya mengubah yang sedang diuji. */
function berita(sisip = {}) {
  return {
    id: 'b1', judul: 'Uji', sentimen: 'Negatif', kategori: 'Gangguan Keamanan dan Ketertiban',
    subkategori_kode: '1.3', urgensi: 'Sedang', status_verifikasi: 'Belum Ditelaah',
    tier_media: 4, ...sisip,
  }
}

const kode = (b, media = 1) => sarankanMesin(b, media)?.kode

/* ------------------------------------------------------------------ kamus */

sama('Ada empat tindakan', TINDAKAN.length, 4)
periksa('Tiap tindakan punya langkah', TINDAKAN.every((t) => t.langkah.length >= 2))
periksa('Hasil verifikasi menunjuk tindakan yang ada',
  HASIL_VERIFIKASI.every((h) => TINDAKAN.some((t) => t.kode === h.tindakan)))

/* ------------------------------------------------------- yang tak disarankan */

sama('Berita positif tidak disarankan', sarankanMesin(berita({ sentimen: 'Positif' })), null)
sama('Di luar lingkup tidak disarankan', sarankanMesin(berita({ kategori: 'Di Luar Lingkup' })), null)
sama('Yang sudah Tidak Valid tidak disarankan', sarankanMesin(berita({ status_verifikasi: 'Tidak Valid' })), null)
sama('Yang sudah Diarsipkan tidak disarankan', sarankanMesin(berita({ status_verifikasi: 'Diarsipkan' })), null)

/* ---------------------------------------------------------------- urgensi */

sama('Rendah dipantau', kode(berita({ urgensi: 'Rendah' })), 'pantau')
sama('Sedang tanpa konfirmasi dipantau', kode(berita()), 'pantau')
sama('Kritis sidak walau sumbernya media sosial', kode(berita({ urgensi: 'Kritis' })), 'sidak')
sama('Tinggi dari tier 4 diverifikasi dulu', kode(berita({ urgensi: 'Tinggi' })), 'verifikasi')
sama('Tinggi dari tier 1 sidak', kode(berita({ urgensi: 'Tinggi', tier_media: 1 })), 'sidak')
sama('Tinggi dari tier 4 tetapi dua media sidak', kode(berita({ urgensi: 'Tinggi' }), 2), 'sidak')
sama('Tinggi tanpa data tier dan satu media diverifikasi',
  kode(berita({ urgensi: 'Tinggi', tier_media: null })), 'verifikasi')

periksa('Tier 2 terkonfirmasi', terkonfirmasi({ tier_media: 2 }))
periksa('Tier 3 belum terkonfirmasi', !terkonfirmasi({ tier_media: 3 }))
periksa('Dua media terkonfirmasi', terkonfirmasi({ tier_media: 4 }, 2))

/* ----------------------------------------------------------------- Sedang */

// 3.1 Pungli: pelakunya petugas.
sama('Sedang, petugas, terkonfirmasi: verifikasi',
  kode(berita({ subkategori_kode: '3.1', tier_media: 1 })), 'verifikasi')
// 1.3 Kekerasan antar WBP: bukan petugas, satu media.
sama('Sedang, WBP, terkonfirmasi, satu media: pantau',
  kode(berita({ subkategori_kode: '1.3', tier_media: 1 })), 'pantau')
sama('Sedang, WBP, tiga media: verifikasi',
  kode(berita({ subkategori_kode: '1.3', tier_media: 1 }), 3), 'verifikasi')

/* ---------------------------------------------------------- tanda dari unit */

sama('Hoaks klarifikasi walau Kritis',
  kode(berita({ subkategori_kode: '7.1', urgensi: 'Kritis' })), 'klarifikasi')
sama('Unit "Tidak Benar" mengalahkan Kritis',
  kode(berita({ urgensi: 'Kritis', tanggapan_sikap: 'Tidak Benar' })), 'klarifikasi')
sama('Unit "Sebagian Benar" klarifikasi',
  kode(berita({ urgensi: 'Tinggi', tanggapan_sikap: 'Sebagian Benar' })), 'klarifikasi')
sama('Unit "Sudah Ditangani" klarifikasi',
  kode(berita({ urgensi: 'Tinggi', tanggapan_sikap: 'Sudah Ditangani' })), 'klarifikasi')
sama('Unit "Dibenarkan" berurgensi Sedang sidak',
  kode(berita({ tanggapan_sikap: 'Dibenarkan' })), 'sidak')
sama('Unit "Dibenarkan" berurgensi Rendah dipantau',
  kode(berita({ urgensi: 'Rendah', tanggapan_sikap: 'Dibenarkan' })), 'pantau')
sama('Telaah wilayah "Perlu Perhatian" sidak',
  kode(berita({ telaah_wilayah_status: 'Perlu Perhatian' })), 'sidak')
sama('Telaah wilayah "Bukan Unit Kami" periksa pemetaan',
  kode(berita({ urgensi: 'Kritis', telaah_wilayah_status: 'Bukan Unit Kami' })), 'verifikasi')

/* ---------------------------------------------------------------- alasan */

periksa('Setiap saran membawa alasan',
  ['Rendah', 'Sedang', 'Tinggi', 'Kritis'].every((u) => sarankanMesin(berita({ urgensi: u }))?.alasan.length >= 1))
periksa('Dasar saran dari unit ditandai',
  sarankanMesin(berita({ tanggapan_sikap: 'Tidak Benar' })).dasar === 'unit')

/* ----------------------------------------------------- keputusan analis */

const keputusan = {
  tindakan: 'klarifikasi', hasil_verifikasi: 'Tidak Sesuai', catatan: 'CCTV membantah.',
  diputuskan_oleh: 'analis1', diputuskan_pada: '2026-11-02T10:00:00Z',
}
const menang = sarankanTindak(berita({ urgensi: 'Kritis' }), { keputusan })
sama('Keputusan analis menang atas mesin', menang.kode, 'klarifikasi')
sama('Dasarnya analis', menang.dasar, 'analis')
sama('Perbedaan dengan mesin ditandai', menang.berbeda, true)
sama('Saran mesin tetap terbaca', menang.mesin.kode, 'sidak')
sama('Pemutus tercatat', menang.oleh, 'analis1')
periksa('Alasan memuat hasil verifikasi dan catatan', menang.alasan.length === 2)

const searah = sarankanTindak(berita({ urgensi: 'Kritis' }), { keputusan: { ...keputusan, tindakan: 'sidak' } })
sama('Keputusan yang searah tidak ditandai berbeda', searah.berbeda, false)
sama('Keputusan dengan kode ngawur diabaikan',
  sarankanTindak(berita(), { keputusan: { tindakan: 'bakar' } }).dasar, 'mesin')

/* -------------------------------------------------------------- peristiwa */

const biasa = berita({ id: 'p1' })
const genting = berita({ id: 'p2', urgensi: 'Kritis' })
const peristiwa = { publikasi: [biasa, genting], jumlah_media: 2 }
sama('Peristiwa dinilai dari publikasi terberat', sarankanPeristiwa(peristiwa).kode, 'sidak')
sama('Peristiwa membawa berita pemutusnya', sarankanPeristiwa(peristiwa).berita.id, 'p2')

const lama = { ...keputusan, diputuskan_pada: '2026-11-01T10:00:00Z', tindakan: 'pantau' }
const baru = { ...keputusan, diputuskan_pada: '2026-11-02T10:00:00Z', tindakan: 'verifikasi' }
const peta = new Map([['p1', lama], ['p2', baru]])
sama('Keputusan terbaru di antara anggota yang menang', sarankanPeristiwa(peristiwa, peta).kode, 'verifikasi')
sama('Peristiwa tanpa saran bernilai null',
  sarankanPeristiwa({ publikasi: [berita({ sentimen: 'Positif' })], jumlah_media: 1 }), null)

/* ---------------------------------------------------------------- hitungan */

const h = hitungTindakan([sarankanMesin(genting), sarankanMesin(biasa), null])
sama('Hitungan sidak', h.sidak, 1)
sama('Hitungan pantau', h.pantau, 1)
sama('Hitungan tanpa saran', h.tanpa, 1)

console.log()
console.log(`${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
