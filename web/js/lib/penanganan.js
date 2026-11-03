/**
 * Penanganan berita — satu pintu baca dan tulis untuk tabel penanganan_berita.
 *
 * Analisis kasus per kasus (pages/analisis-berita.js) menerbitkan dua jenis
 * pekerjaan yang dilihat di Tindak Lanjut:
 *
 *   klarifikasi_upt     kanwil meneruskan, UPT mengunggah berkas klarifikasi
 *                       (PDF/DOCX) beserta nama dan jabatan pengirimnya,
 *                       kanwil atau pusat menilainya
 *   disposisi_pimpinan  disposisi pimpinan dicatat, dikerjakan, dilaporkan
 *
 * Seluruh penulisan lewat fungsi basis data penanganan_* — tabelnya sendiri
 * tidak punya policy tulis — supaya urutan status tidak bisa dilompati dari
 * peramban dan nama pelaku diisi peladen. Berkas ini hanya memanggilnya.
 *
 * Mode peragaan tidak punya peladen: penanganan hidup di memori dan hilang
 * saat halaman dimuat ulang, dan itu dikatakan di layar.
 */

import { KONFIG } from './konfig.js'
import { ambil, panggilFungsi, unggahBerkas, tautanBerkas } from './api.js'

export const BUCKET_KLARIFIKASI = 'klarifikasi-upt'

/** Status dan cara membacanya. `pihak` = siapa yang sedang ditunggu. */
export const STATUS = {
  menunggu_kanwil: { label: 'Menunggu diteruskan kanwil', pendek: 'Belum diteruskan', nada: 'sedang', pihak: 'kanwil', selesai: false },
  menunggu_upt: { label: 'Menunggu klarifikasi UPT', pendek: 'Belum menginput', nada: 'tinggi', pihak: 'upt', selesai: false },
  perlu_perbaikan: { label: 'Dikembalikan untuk diperbaiki', pendek: 'Perlu perbaikan', nada: 'tinggi', pihak: 'upt', selesai: false },
  klarifikasi_masuk: { label: 'Klarifikasi masuk, menunggu dinilai', pendek: 'Sudah menginput', nada: 'aksen', pihak: 'penilai', selesai: false },
  diterima: { label: 'Klarifikasi diterima', pendek: 'Selesai', nada: 'positif', pihak: null, selesai: true },
  menunggu_disposisi: { label: 'Menunggu disposisi pimpinan', pendek: 'Menunggu disposisi', nada: 'sedang', pihak: 'pimpinan', selesai: false },
  dalam_proses: { label: 'Disposisi sedang ditindaklanjuti', pendek: 'Dalam proses', nada: 'aksen', pihak: 'pelaksana', selesai: false },
  selesai: { label: 'Disposisi selesai ditindaklanjuti', pendek: 'Selesai', nada: 'positif', pihak: null, selesai: true },
}

export const TUJUAN = {
  klarifikasi_upt: { label: 'Klarifikasi UPT', ket: 'Kanwil meneruskan ke UPT; UPT mengunggah hasil klarifikasi (PDF/DOCX).' },
  disposisi_pimpinan: { label: 'Tindak lanjut disposisi pimpinan', ket: 'Disposisi pimpinan dicatat, dikerjakan, lalu hasilnya dilaporkan.' },
}

export function infoStatus(kode) {
  return STATUS[kode] || { label: kode || '-', pendek: kode || '-', nada: 'netral', selesai: false }
}

/** Lewat batas: masih menunggu, dan batas waktunya sudah lewat. */
export function lewatBatas(p, kini = new Date()) {
  if (!p?.batas_waktu || infoStatus(p.status).selesai) return false
  return new Date(p.batas_waktu) < kini
}

/** Nama kanwil tanpa awalan baku, untuk judul kelompok. */
export function namaKanwilPendek(kanwil) {
  return String(kanwil || 'Tanpa kanwil').replace(/^Kantor Wilayah Ditjenpas\s+/i, 'Kanwil ')
}

const simpanan = { daftar: [], dimuat: false, galat: null, sedang: null }

export function penangananSaatIni() { return simpanan.daftar }
export function penangananDimuat() { return simpanan.dimuat }
export function galatPenanganan() { return simpanan.galat }

/** Memuat seluruh penanganan yang boleh dibaca peran ini (RLS yang memotong). */
export async function muatPenanganan({ paksa = false } = {}) {
  if (KONFIG.mode === 'demo') { simpanan.dimuat = true; return simpanan.daftar }
  if (simpanan.dimuat && !paksa) return simpanan.daftar
  if (simpanan.sedang) return simpanan.sedang
  simpanan.sedang = (async () => {
    try {
      simpanan.daftar = await ambil('penanganan_berita', {
        select: '*,berita:berita_id(id,judul,media,link,nama_upt,sentimen,urgensi,created_at,tanggal_publikasi,subkategori)',
        order: 'diperbarui_pada.desc',
      }, { jangkauan: '0-1999' }) || []
      simpanan.galat = null
    } catch (e) {
      simpanan.galat = String(e?.message || e)
    }
    simpanan.dimuat = true
    return simpanan.daftar
  })()
  try { return await simpanan.sedang } finally { simpanan.sedang = null }
}

function pasang(baris) {
  for (const b of [].concat(baris || [])) {
    if (!b?.id) continue
    const lama = simpanan.daftar.find((x) => x.id === b.id)
    const gabung = { ...(lama || {}), ...b, berita: b.berita || lama?.berita }
    simpanan.daftar = [gabung, ...simpanan.daftar.filter((x) => x.id !== b.id)]
  }
}

/* ---------------------------------------------------------------- peragaan */

function demoBaris(berita, tujuan, isi) {
  const ada = simpanan.daftar.find((x) => x.berita_id === berita.id && x.tujuan === tujuan)
  const kini = new Date().toISOString()
  const baris = {
    id: ada?.id || `demo-${tujuan}-${berita.id}`,
    berita_id: berita.id, tujuan, kanwil: berita.kanwil_asal || 'Kantor Wilayah Ditjenpas Jawa Timur',
    nama_upt: berita.nama_upt, dibuat_oleh: 'peragaan', dibuat_pada: ada?.dibuat_pada || kini,
    diperbarui_pada: kini, berita, ...ada, ...isi,
  }
  pasang(baris)
  return baris
}

/* ------------------------------------------------------------------- tulis */

/**
 * Menyimpan hasil analisis dan menerbitkan tujuannya.
 * @param {object} opsi { berita, klarifikasi, disposisi, analisis, instruksi, batas, pimpinan, isiDisposisi, kanwilPembuat }
 */
export async function buatPenanganan(opsi) {
  const { berita, klarifikasi, disposisi, analisis, instruksi, batas, pimpinan, isiDisposisi } = opsi
  if (KONFIG.mode === 'demo') {
    const hasil = []
    const batasIso = batas || new Date(Date.now() + 2 * 86400000).toISOString()
    if (klarifikasi) {
      hasil.push(demoBaris(berita, 'klarifikasi_upt', {
        status: opsi.kanwilPembuat ? 'menunggu_upt' : 'menunggu_kanwil',
        analisis, instruksi, batas_waktu: batasIso,
        diteruskan_pada: opsi.kanwilPembuat ? new Date().toISOString() : null,
      }))
    }
    if (disposisi) {
      hasil.push(demoBaris(berita, 'disposisi_pimpinan', {
        status: isiDisposisi ? 'dalam_proses' : 'menunggu_disposisi',
        analisis, pimpinan, isi_disposisi: isiDisposisi, batas_waktu: batas || null,
      }))
    }
    return hasil
  }
  const hasil = await panggilFungsi('penanganan_buat', {
    p_berita: berita.id, p_klarifikasi: Boolean(klarifikasi), p_disposisi: Boolean(disposisi),
    p_analisis: analisis || {}, p_instruksi: instruksi || null, p_batas: batas || null,
    p_pimpinan: pimpinan || null, p_isi_disposisi: isiDisposisi || null,
  })
  pasang((hasil || []).map((b) => ({ ...b, berita })))
  return hasil
}

async function ubah(nama, isi, demo) {
  if (KONFIG.mode === 'demo') {
    const lama = simpanan.daftar.find((x) => x.id === isi.p_id)
    const baris = { ...lama, ...demo, diperbarui_pada: new Date().toISOString() }
    pasang(baris)
    return baris
  }
  const hasil = await panggilFungsi(nama, isi)
  const baris = Array.isArray(hasil) ? hasil[0] : hasil
  pasang(baris)
  return baris
}

export function teruskanKeUpt(id, { instruksi = '', batas = null } = {}) {
  return ubah('penanganan_teruskan', { p_id: id, p_instruksi: instruksi || null, p_batas: batas },
    { status: 'menunggu_upt', instruksi, batas_waktu: batas, diteruskan_pada: new Date().toISOString() })
}

/**
 * Mengunggah berkas klarifikasi lalu mencatatnya. Dua langkah: berkasnya ke
 * bucket privat, jalurnya ke basis data. Bila langkah kedua ditolak, berkas
 * yatim tertinggal di bucket — lebih baik daripada catatan yang menunjuk ke
 * berkas yang tidak pernah ada.
 */
export async function kirimKlarifikasi(id, { berkas, pengirim, jabatan, ringkasan = '' }) {
  if (!berkas) throw new Error('Pilih berkas klarifikasi (PDF atau DOCX).')
  if (!/\.(pdf|docx)$/i.test(berkas.name)) throw new Error('Berkas klarifikasi harus PDF atau DOCX.')
  if (berkas.size > 10 * 1024 * 1024) throw new Error('Berkas melebihi 10 MB.')
  if (String(pengirim || '').trim().length < 3) throw new Error('Nama pengirim wajib diisi.')
  if (String(jabatan || '').trim().length < 2) throw new Error('Jabatan pengirim wajib diisi.')
  const { jalur } = await unggahBerkas(BUCKET_KLARIFIKASI, id, berkas)
  return ubah('penanganan_kirim_klarifikasi', {
    p_id: id, p_jalur: jalur, p_nama_berkas: berkas.name, p_pengirim: pengirim, p_jabatan: jabatan, p_ringkasan: ringkasan || null,
  }, {
    status: 'klarifikasi_masuk', berkas_jalur: jalur, berkas_nama: berkas.name, pengirim_nama: pengirim,
    pengirim_jabatan: jabatan, ringkasan_klarifikasi: ringkasan, diunggah_pada: new Date().toISOString(), diunggah_oleh: 'peragaan',
  })
}

export function nilaiKlarifikasi(id, { terima, catatan = '' }) {
  return ubah('penanganan_nilai', { p_id: id, p_terima: Boolean(terima), p_catatan: catatan || null },
    { status: terima ? 'diterima' : 'perlu_perbaikan', catatan_penilaian: catatan, dinilai_pada: new Date().toISOString() })
}

export function catatDisposisi(id, { pimpinan, isi, batas = null, hasil = '', selesai = false }) {
  return ubah('penanganan_disposisi', {
    p_id: id, p_pimpinan: pimpinan || null, p_isi: isi || null, p_batas: batas, p_hasil: hasil || null, p_selesai: Boolean(selesai),
  }, { pimpinan, isi_disposisi: isi, batas_waktu: batas, hasil_tindak: hasil, status: selesai ? 'selesai' : 'dalam_proses' })
}

export function tautanKlarifikasi(jalur) {
  return tautanBerkas(BUCKET_KLARIFIKASI, jalur)
}

/** Hitungan untuk lencana menu dan ubin, menurut siapa yang sedang ditunggu. */
export function hitungPenanganan(daftar = [], { peran = '' } = {}) {
  const k = daftar.filter((p) => p.tujuan === 'klarifikasi_upt')
  const d = daftar.filter((p) => p.tujuan === 'disposisi_pimpinan')
  const unit = peran === 'upt_penelaah'
  return {
    klarifikasi: k.length,
    belumDiteruskan: k.filter((p) => p.status === 'menunggu_kanwil').length,
    belumMenginput: k.filter((p) => ['menunggu_upt', 'perlu_perbaikan'].includes(p.status)).length,
    sudahMenginput: k.filter((p) => p.status === 'klarifikasi_masuk').length,
    diterima: k.filter((p) => p.status === 'diterima').length,
    lewat: k.filter((p) => lewatBatas(p)).length,
    disposisi: d.length,
    disposisiJalan: d.filter((p) => !infoStatus(p.status).selesai).length,
    /** Yang menuntut tindakan pemegang peran ini sekarang. */
    tugasSaya: unit
      ? k.filter((p) => ['menunggu_upt', 'perlu_perbaikan'].includes(p.status)).length
      : k.filter((p) => ['menunggu_kanwil', 'klarifikasi_masuk'].includes(p.status)).length
        + d.filter((p) => p.status === 'menunggu_disposisi').length,
  }
}

export const META_PENANGANAN = { versi: 'penanganan-v1.0', status: Object.keys(STATUS).length }
