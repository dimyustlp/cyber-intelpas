/**
 * Pengguna & Data Induk — Pengguna, Koordinat UPT, Integrasi dan Kunci, Jejak Audit.
 *
 * Digabung 23 September 2026 atas permintaan user. Keempatnya pekerjaan
 * superadmin yang jarang dan berurutan: menerbitkan akun, membetulkan data
 * induk unit, mengatur sambungan keluar, lalu memeriksa siapa mengubah apa.
 *
 * Alamat `pengguna` juga dipakai ruang wilayah untuk halaman Pengguna Wilayah
 * milik admin kanwil. Admin kanwil tidak berhak atas tiga tab lainnya, jadi
 * bingkai ini menggambar halamannya tanpa bilah dan tanpa nama fitur pusat —
 * persis seperti sebelum penggabungan (ui/bingkai-tab.js).
 */

import { bingkaiTab } from '../ui/bingkai-tab.js'
import { halamanPengguna } from './pengguna.js'
import { halamanKoordinat } from './koordinat.js'
import { halamanIntegrasi } from './integrasi.js'
import { halamanAudit } from './audit.js'

export const halamanPenggunaData = bingkaiTab({
  nama: 'Pengguna & Data Induk',
  tab: [
    { id: 'pengguna', label: 'Pengguna', ikon: 'pengguna', bangun: halamanPengguna },
    { id: 'koordinat', label: 'Koordinat UPT', ikon: 'peta', bangun: halamanKoordinat },
    { id: 'integrasi', label: 'Integrasi dan Kunci', ikon: 'gembok', bangun: halamanIntegrasi },
    { id: 'audit', label: 'Jejak Audit', ikon: 'audit', bangun: halamanAudit },
  ],
})
