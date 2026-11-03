/**
 * Daftar berita sebagai produk SIP 2023 — kolom, urutan, dan catatan mutu.
 *
 * Berkas CSV yang diunduh 3 November 2026 (2.511 baris, sepekan) dibuka user
 * dan disebut "berantakan". Bukan satu sebab, melainkan tujuh, dan keenam yang
 * terakhir tetap ada sekalipun pemisah kolomnya benar:
 *
 *   1. Pemisah koma terbuka sebagai satu kolom di Excel berbahasa Indonesia
 *      (ditangani lib/xlsx.js).
 *   2. Kolom Provinsi kosong di 2.511 dari 2.511 baris: tabel berita tidak
 *      punya kolom provinsi; nilainya harus diambil dari data induk UPT.
 *   3. Urgensi ditulis dua cara ("SEDANG" 630 kali, "Sedang" sisanya), jadi
 *      Saring Excel memecah satu tingkat menjadi dua.
 *   4. Berita Google News bermedia nama kueri ("Pelanggaran & Isu Spesifik")
 *      dan berjudul ganda "Judul - detikcom".
 *   5. 77 baris terbit SESUDAH ditangkap: jam terbit sumber dibaca di zona
 *      yang keliru. Tidak diubah di sini, tetapi ditandai.
 *   6. 313 baris berjudul sama dengan baris lain; tidak ada yang
 *      memberitahukannya.
 *   7. Urutannya urutan masuk: 297 berita negatif tersebar di antara 1.844
 *      berita positif.
 *
 * Kolom saran tindak lanjut dan dasar saran lama dipecah ulang menjadi dua
 * kolom SIP — "Peringatan dini" dan "Usulan pemecahan masalah" — bukan
 * digabung menjadi satu. Satu sel berisi dua hal tidak bisa disaring, dan
 * Lampiran I D menyebut keduanya sebagai dua unsur rekomendasi.
 */

import { ember } from './sentimen.js'
import { hariBerita } from './hitung.js'
import { tanggalJam } from './format.js'
import { sumberAsli, rapikanJudul, kelompokkanPeristiwa } from './peristiwa.js'
import { sarankanTindak } from './tindak-lanjut.js'
import {
  urgensiBaku, prioritasBerita, prioritas, evaluasiBerita, labelSumber, labelInformasi,
  kaburkanTeks, klasifikasiDariTingkat, prioritasKumpulan,
  KLASIFIKASI, PRIORITAS, EVALUASI_SUMBER, EVALUASI_INFORMASI, KODE_SEBAR,
} from './sip.js'
import { tingkatKumpulan } from './klasifikasi-informasi.js'

const URUT_PRIORITAS = { M: 3, S: 2, Rt: 1 }
const MENIT = 60_000

/** Selisih yang masih dianggap wajar antara jam terbit dan jam tangkap. */
const TOLERANSI_TERBIT = 15 * MENIT

function waktu(t) {
  const n = Date.parse(t || '')
  return Number.isFinite(n) ? n : null
}

/**
 * Memperkaya satu baris dengan semua nilai turunan, sekali, supaya kolom dan
 * pengurutan membaca hal yang sama.
 */
function perkaya(b, { keputusan, upt, peristiwaPer, judulPer }) {
  const k = keputusan.get(b.id) || null
  const p = peristiwaPer.get(b.id)
  const media = p?.jumlah_media || 1
  const negatif = ember(b) === 'negatif'
  const saran = negatif ? sarankanTindak(b, { media, keputusan: k }) : null
  const evaluasi = evaluasiBerita(b, { media, keputusan: k })
  const induk = upt.get(b.nama_upt) || null

  const mediaAsli = sumberAsli(b)
  const lewatPengumpul = mediaAsli && mediaAsli !== String(b.media || '').trim()

  const catatan = []
  const terbit = waktu(b.tanggal_publikasi)
  const masuk = waktu(b.created_at)
  if (terbit && masuk && terbit - masuk > TOLERANSI_TERBIT) {
    catatan.push('Jam terbit melewati jam tangkap; kemungkinan zona waktu sumber keliru.')
  }
  const kunci = rapikanJudul(b.judul).toLowerCase()
  const kembar = judulPer.get(kunci)
  if (kembar && kembar.length > 1) {
    catatan.push(`Judul sama dengan ${kembar.length - 1} baris lain.`)
  }
  if (lewatPengumpul) catatan.push(`Diterima lewat pengumpul (${b.media || b.platform}).`)

  return {
    ...b,
    _negatif: negatif,
    _urgensi: urgensiBaku(b.urgensi),
    _prioritas: prioritasBerita(b),
    _evaluasi: evaluasi,
    _saran: saran,
    _peristiwa: p,
    _media: lewatPengumpul ? mediaAsli : (b.media || ''),
    // Spasi lebar-nol dari salin-tempel membuat dua judul yang sama terurut
    // berjauhan di Excel dan tidak cocok saat dicari.
    _judul: (lewatPengumpul ? rapikanJudul(b.judul) : String(b.judul || ''))
      .replace(/[​-‍﻿]/g, '').trim(),
    _provinsi: induk?.provinsi || '',
    _kanwil: b.kanwil_asal || induk?.kanwil || '',
    _hari: hariBerita(b) || '',
    _catatan: catatan.join(' '),
  }
}

/**
 * Menyusun daftar.
 *
 * @param {Array<object>} baris berita periode ini
 * @param {object} opsi
 * @param {Map<string,object>} [opsi.keputusan] id berita -> baris rekomendasi_berita
 * @param {Array<object>} [opsi.upt] data induk: nama_upt, kanwil, provinsi
 * @param {boolean} [opsi.denganSaran] sertakan kolom rekomendasi (butuh izin lihat_saran_tindak)
 * @param {boolean} [opsi.edaran] versi edaran: catatan analis dikaburkan
 */
export function susunDaftarSip(baris, {
  keputusan = new Map(), upt = [], denganSaran = true, edaran = false,
} = {}) {
  const petaUpt = new Map(upt.map((u) => [u.nama_upt, u]))

  // Peristiwa dihitung atas seluruh baris periode: dari situ jumlah media,
  // yang menentukan evaluasi informasi dan saran tindak lanjut.
  const peristiwaPer = new Map()
  kelompokkanPeristiwa(baris).forEach((p, i) => {
    const isi = { ...p, nomor: i + 1 }
    for (const b of p.publikasi || []) peristiwaPer.set(b.id, isi)
  })

  const judulPer = new Map()
  for (const b of baris) {
    const kunci = rapikanJudul(b.judul).toLowerCase()
    if (!kunci) continue
    if (!judulPer.has(kunci)) judulPer.set(kunci, [])
    judulPer.get(kunci).push(b.id)
  }

  const kaya = baris.map((b) => perkaya(b, { keputusan, upt: petaUpt, peristiwaPer, judulPer }))

  // Negatif lebih dulu, lalu prioritas, lalu hari terbaru, lalu jam terbaru.
  kaya.sort((a, b) => (Number(b._negatif) - Number(a._negatif))
    || (URUT_PRIORITAS[b._prioritas] - URUT_PRIORITAS[a._prioritas])
    || String(b._hari).localeCompare(String(a._hari))
    || ((waktu(b.created_at) || 0) - (waktu(a.created_at) || 0)))
  kaya.forEach((b, i) => { b._no = i + 1 })

  const merah = 5
  const kuning = 6
  const kolom = [
    { kunci: 'no', label: 'No', lebar: 6, ambil: (b) => b._no },
    { kunci: 'hari', label: 'Hari tangkap (WIB)', lebar: 12, ambil: (b) => b._hari },
    { kunci: 'terbit', label: 'Terbit', lebar: 17, ambil: (b) => tanggalJam(b.tanggal_publikasi) },
    { kunci: 'judul', label: 'Judul', lebar: 60, ambil: (b) => b._judul },
    { kunci: 'media', label: 'Media', lebar: 20, ambil: (b) => b._media },
    { kunci: 'platform', label: 'Platform', lebar: 13, ambil: (b) => b.platform || '' },
    { kunci: 'upt', label: 'UPT', lebar: 30, ambil: (b) => b.nama_upt || 'Belum Teridentifikasi' },
    { kunci: 'kanwil', label: 'Kantor Wilayah', lebar: 28, ambil: (b) => b._kanwil },
    { kunci: 'provinsi', label: 'Provinsi', lebar: 18, ambil: (b) => b._provinsi },
    { kunci: 'kategori', label: 'Kategori', lebar: 26, ambil: (b) => b.kategori || '' },
    { kunci: 'subkategori', label: 'Subkategori', lebar: 28, ambil: (b) => b.subkategori || '' },
    {
      kunci: 'sentimen', label: 'Sentimen', lebar: 11, ambil: (b) => b.sentimen || '',
      gaya: (b) => (b._negatif ? merah : 0),
    },
    { kunci: 'urgensi', label: 'Urgensi (mesin)', lebar: 11, ambil: (b) => b._urgensi },
    {
      kunci: 'prioritas', label: 'Prioritas SIP', lebar: 11,
      ambil: (b) => prioritas(b._prioritas).label,
      gaya: (b) => (b._prioritas !== 'Rt' ? merah : 0),
    },
    {
      kunci: 'evaluasi_sumber', label: 'Evaluasi sumber', lebar: 22,
      ambil: (b) => `${b._evaluasi.sumber} — ${labelSumber(b._evaluasi.sumber)}`,
    },
    {
      kunci: 'evaluasi_informasi', label: 'Evaluasi informasi', lebar: 24,
      ambil: (b) => `${b._evaluasi.informasi} — ${labelInformasi(b._evaluasi.informasi)}`,
      gaya: (b) => (Number(b._evaluasi.informasi) >= 4 ? kuning : 0),
    },
    { kunci: 'nilai', label: 'Nilai', lebar: 7, ambil: (b) => b._evaluasi.nilai },
    { kunci: 'dinilai', label: 'Dinilai oleh', lebar: 10, ambil: (b) => (b._evaluasi.dasar === 'analis' ? 'Analis' : 'Mesin') },
    { kunci: 'status', label: 'Status telaah', lebar: 15, ambil: (b) => b.status_verifikasi || 'Belum Ditelaah' },
    {
      kunci: 'peristiwa', label: 'Peristiwa', lebar: 16,
      ambil: (b) => (b._peristiwa
        ? `P${b._peristiwa.nomor} · ${b._peristiwa.publikasi?.length || 1} publikasi · ${b._peristiwa.jumlah_media || 1} media`
        : ''),
    },
    ...(denganSaran ? [
      {
        kunci: 'peringatan_dini', label: 'Peringatan dini', lebar: 50,
        ambil: (b) => {
          if (!b._saran) return ''
          const teks = (b._saran.alasan || []).join(' ')
          return edaran ? kaburkanTeks(teks) : teks
        },
      },
      {
        kunci: 'pemecahan_masalah', label: 'Usulan pemecahan masalah', lebar: 50,
        ambil: (b) => (b._saran
          ? `${b._saran.label}: ${(b._saran.langkah || []).slice(0, 2).join(' ')}`
          : ''),
        gaya: (b) => (b._saran?.kode === 'sidak' ? merah : 0),
      },
      {
        kunci: 'dasar_saran', label: 'Dasar rekomendasi', lebar: 12,
        ambil: (b) => ({ mesin: 'Mesin', unit: 'Jawaban unit', analis: 'Analis' }[b._saran?.dasar] || ''),
      },
    ] : []),
    {
      kunci: 'catatan_data', label: 'Catatan mutu data', lebar: 36, ambil: (b) => b._catatan,
      gaya: (b) => (b._catatan ? kuning : 0),
    },
    { kunci: 'masuk', label: 'Ditangkap', lebar: 17, ambil: (b) => tanggalJam(b.created_at) },
    { kunci: 'tautan', label: 'Tautan', lebar: 50, ambil: (b) => b.link || '' },
  ]

  return {
    kolom,
    baris: kaya,
    /** Klasifikasi minimum dan prioritas yang dihitung mesin dari isinya. */
    minimum: klasifikasiDariTingkat(tingkatKumpulan(baris)),
    prioritasMesin: prioritasKumpulan(baris),
    ringkas: {
      total: kaya.length,
      negatif: kaya.filter((b) => b._negatif).length,
      segera: kaya.filter((b) => b._prioritas === 'S').length,
      tanpaProvinsi: kaya.filter((b) => !b._provinsi).length,
      bercatatan: kaya.filter((b) => b._catatan).length,
    },
  }
}

/** Arti setiap kode, untuk lembar Keterangan. */
export function penjelasanSip() {
  return [
    ...KLASIFIKASI.map((k) => [`Klasifikasi ${k.kode}`, `${k.label}. Akses: ${k.akses}`]),
    ...PRIORITAS.map((p) => [`Prioritas ${p.label} (${p.kode})`, `${p.batas}. ${p.ket}`]),
    ...EVALUASI_SUMBER.map((e) => [`Evaluasi sumber ${e.kode}`, e.label]),
    ...EVALUASI_INFORMASI.map((e) => [`Evaluasi informasi ${e.kode}`, e.label]),
    ...KODE_SEBAR.map((k) => [`Kode penyebarluasan ${k.kode}`, k.label]),
    ['Nilai', 'Gabungan evaluasi sumber dan informasi, mis. C3: sumber terkadang andal, informasi agak dapat dipercaya.'],
    ['Dinilai oleh', 'Mesin: disarankan dari tier media, jumlah media, sikap unit, dan status telaah. Analis: ditetapkan di halaman Detail Berita dan selalu menang atas mesin.'],
    ['Prioritas SIP', 'Hanya berita negatif berurgensi Tinggi atau Kritis yang menjadi Segera. Mendesak tidak pernah ditetapkan mesin: ia untuk ancaman keamanan negara dan jiwa.'],
    ['Peringatan dini', 'Alasan sebuah berita menuntut perhatian (early warning), dari saran tindak lanjut.'],
    ['Usulan pemecahan masalah', 'Tindakan yang diusulkan beserta dua langkah pertamanya (problem solving).'],
    ['Peristiwa', 'Publikasi tentang kejadian yang sama dikelompokkan; jumlah medianya menentukan evaluasi informasi.'],
    ['Catatan mutu data', 'Kejanggalan pada baris itu: jam terbit sesudah jam tangkap, judul kembar, atau diterima lewat pengumpul.'],
  ]
}

export const META_DAFTAR_SIP = { versi: 'daftar-sip-v1.0' }
