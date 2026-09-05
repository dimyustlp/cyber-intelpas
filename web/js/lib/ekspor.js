/**
 * Ekspor — satu jalan keluar untuk seluruh berkas yang dibawa petugas.
 *
 * Sampai berkas ini ada, tiga halaman menyusun CSV-nya sendiri: Pusat Data
 * Berita, Jejak Audit, dan Lembar Infografis. Ketiganya menulis pengutip
 * tanda kutip yang sama, BOM yang sama, dan pembuat tautan unduhan yang
 * hampir sama. "Hampir" itu yang mahal:
 *
 *   - Pusat Data Berita menolak mengunduh dalam mode peragaan dan
 *     mengatakannya; Jejak Audit tidak, sehingga tombolnya di pratinjau
 *     ditekan tanpa terjadi apa pun.
 *   - Satu membebaskan alamat objek setelah 1 detik, satu lagi setelah 4.
 *     Yang pertama bisa membatalkan unduhan yang belum sempat dimulai pada
 *     komputer yang sibuk.
 *   - Tidak satu pun di antaranya mencantumkan siapa yang mengunduh, kapan,
 *     dengan saringan apa, dan sejauh mana berkas itu boleh berjalan.
 *
 * ## Kepala berkas
 *
 * Setiap keluaran diawali blok keterangan: tingkat klasifikasi, nama dan peran
 * pengunduh, waktu, nomor berkas, jumlah baris, dan kueri yang menghasilkannya.
 *
 * Pada CSV, blok itu ditulis sebagai baris-baris dua kolom yang diawali `#`,
 * lalu satu baris kosong, baru tabelnya. Bentuk itu memang membuat berkasnya
 * bukan CSV murni, dan itu pilihan sadar: Excel, LibreOffice, dan
 * `pandas.read_csv(skiprows=...)` sama-sama bisa melewatinya, sedangkan berkas
 * tanpa keterangan yang beredar tiga bulan kemudian tidak bisa lagi dijelaskan
 * oleh siapa pun. Yang butuh tabel murni memakai `keCsvPolos()`.
 */

import { KONFIG } from './konfig.js'
import { tanggalJam, tanggalIso } from './format.js'
import { bannerTingkat, labelTingkat, tingkatDari, bolehMembawa } from './klasifikasi-informasi.js'
import { labelPeran } from './peran.js'

/** Awalan nomor berkas. Sengaja pendek — ia dibacakan lewat telepon. */
const AWALAN = 'TSP'

/**
 * Nomor berkas keluaran.
 *
 * Bentuknya TSP-20260905-4F2A: tanggal supaya bisa diurutkan mata, empat
 * huruf acak supaya dua unduhan pada hari yang sama tetap bisa dibedakan.
 * Bukan pengenal yang tersimpan di mana pun — gunanya hanya satu, yaitu
 * memberi nama pada berkas yang sedang ditanyakan seseorang di telepon.
 */
export function nomorEkspor(waktu = new Date()) {
  const hari = tanggalIso(waktu).replace(/-/g, '')
  const acak = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${AWALAN}-${hari}-${acak}`
}

/** Nama berkas yang aman di ketiga sistem berkas yang lazim dipakai. */
export function namaBerkas(judul, ekstensi, waktu = new Date()) {
  const inti = String(judul || 'keluaran')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `trans-siber-pas-${inti}-${tanggalIso(waktu)}.${ekstensi}`
}

/**
 * Menyusun keterangan berkas.
 *
 * `profil` boleh null — mode peragaan tidak punya sesi sungguhan — dan bila
 * null, kolom pengunduh diisi apa adanya sebagai "mode peragaan", bukan
 * dikosongkan. Kolom kosong pada berkas berklasifikasi terbaca sebagai
 * kelalaian pengisian, padahal ia keterangan yang benar.
 */
export function susunKeterangan({
  judul, tingkat = 'internal', profil = null, kueri = '', jumlah = 0,
  waktu = new Date(), catatan = '',
}) {
  return {
    nomor: nomorEkspor(waktu),
    judul: String(judul || 'Keluaran Trans-Siber PAS'),
    tingkat,
    banner: bannerTingkat(tingkat),
    oleh: profil?.full_name || profil?.username || (KONFIG.mode === 'demo' ? 'Mode peragaan' : 'Tidak diketahui'),
    peran: profil?.role ? labelPeran(profil.role) : (KONFIG.mode === 'demo' ? 'Mode peragaan' : ''),
    waktu: tanggalJam(waktu),
    waktuIso: waktu.toISOString(),
    kueri: String(kueri || '').trim() || 'seluruh baris',
    jumlah,
    catatan,
    sistem: `${KONFIG.nama} · ${KONFIG.mode === 'demo' ? 'data peragaan' : 'data operasional'}`,
  }
}

/** Pasangan label dan nilai yang dicetak di kepala tiap berkas, berurutan. */
function barisKeterangan(k) {
  return [
    ['Klasifikasi', labelTingkat(k.tingkat).toUpperCase()],
    ['Perlakuan', tingkatDari(k.tingkat).keterangan],
    ['Judul', k.judul],
    ['Nomor berkas', k.nomor],
    ['Diunduh oleh', k.peran ? `${k.oleh} (${k.peran})` : k.oleh],
    ['Waktu unduh', `${k.waktu} WIB`],
    ['Saringan', k.kueri],
    ['Jumlah baris', String(k.jumlah)],
    ['Sistem', k.sistem],
    ...(k.catatan ? [['Catatan', k.catatan]] : []),
  ]
}

/* ------------------------------------------------------------------- CSV */

/** Pengutip sel. Tanda kutip di dalam nilai digandakan, sesuai RFC 4180. */
function sel(nilai) {
  return `"${String(nilai ?? '').replace(/"/g, '""')}"`
}

/**
 * Tabel murni, tanpa kepala keterangan.
 * Dipakai bila berkasnya akan dibaca alat lain yang tidak bisa melewati kepala.
 */
export function keCsvPolos({ kolom, baris }) {
  const judul = kolom.map((k) => sel(k.label)).join(',')
  const isi = baris.map((b) => kolom.map((k) => sel(k.ambil(b))).join(','))
  return [judul, ...isi].join('\r\n')
}

export function keCsv({ kolom, baris, keterangan }) {
  const kepala = barisKeterangan(keterangan).map(([a, b]) => `${sel(`# ${a}`)},${sel(b)}`)
  return [...kepala, '', keCsvPolos({ kolom, baris })].join('\r\n')
}

/* ------------------------------------------------------------------ JSON */

/**
 * Bentuk JSON menaruh keterangan sebagai objek tersendiri, bukan menyebarnya
 * ke tiap baris. Alat yang membacanya kembali karena itu bisa memeriksa
 * tingkat klasifikasinya sebelum menyentuh satu baris pun isinya.
 */
export function keJson({ kolom, baris, keterangan }) {
  return `${JSON.stringify({
    keterangan,
    kolom: kolom.map((k) => ({ kunci: k.kunci, label: k.label })),
    baris: baris.map((b) => Object.fromEntries(kolom.map((k) => [k.kunci, k.ambil(b)]))),
  }, null, 2)}\n`
}

/* -------------------------------------------------------------- pengunduh */

/**
 * Membawa isi keluar sebagai berkas.
 *
 * Mengembalikan keterangan, bukan melempar dan bukan diam. Ada tiga sebab
 * unduhan tidak jadi, dan ketiganya perlu dibedakan di layar: mode peragaan
 * berjalan di dalam bingkai yang menolak unduhan, peramban tanpa dukungan
 * Blob, dan peran yang tidak berhak membawa berkas setinggi itu.
 *
 * Alamat objek dibebaskan setelah sepuluh detik. Empat detik masih terlalu
 * cepat pada komputer yang sedang sibuk: berkas yang belum sempat dimulai
 * unduhannya akan berakhir sebagai kesalahan jaringan tanpa sebab yang jelas.
 */
export function unduh({ nama, isi, jenis = 'text/csv;charset=utf-8', bom = true }) {
  if (KONFIG.mode === 'demo') {
    return {
      berhasil: false,
      alasan: 'Pengunduhan hanya berfungsi pada aplikasi yang sudah digelar, bukan di pratinjau peragaan.',
    }
  }
  /*
     Ketiganya diperiksa, bukan hanya Blob.

     Node 18 ke atas punya `Blob` dan `URL.createObjectURL` tetapi tidak punya
     `document`, sehingga pemeriksaan yang berhenti di Blob akan lolos lalu
     tersandung satu baris kemudian — di dalam alat uji, dengan jejak tumpukan
     yang menunjuk ke tempat yang bukan sebabnya.
  */
  if (typeof Blob === 'undefined'
    || typeof URL?.createObjectURL !== 'function'
    || typeof document === 'undefined') {
    return { berhasil: false, alasan: 'Peramban ini tidak mendukung pengunduhan berkas.' }
  }

  // BOM di depan supaya Excel di Windows membaca UTF-8 dengan benar; tanpa itu,
  // setiap "é" dan setiap tanda pisah panjang berubah menjadi sampah.
  const berkas = new Blob([bom ? `﻿${isi}` : isi], { type: jenis })
  const alamat = URL.createObjectURL(berkas)
  const tautan = document.createElement('a')
  tautan.href = alamat
  tautan.download = nama
  tautan.rel = 'noopener'
  document.body.appendChild(tautan)
  tautan.click()
  tautan.remove()
  setTimeout(() => URL.revokeObjectURL(alamat), 10_000)
  return { berhasil: true, alasan: '' }
}

/**
 * Satu panggilan untuk seluruh alur: periksa hak, susun keterangan, ubah
 * bentuk, unduh.
 *
 * Pemeriksaan hak dilakukan DI SINI, bukan di halaman, dengan alasan yang sama
 * seperti penyaring tombol terpusat di main.js: halaman yang memeriksa sendiri
 * akan lupa memeriksa, dan yang lupa tidak meninggalkan jejak apa pun.
 */
export function ekspor({
  judul, kolom, baris, bentuk = 'csv', tingkat = 'internal',
  profil = null, kueri = '', catatan = '', waktu = new Date(),
}) {
  if (!baris?.length) return { berhasil: false, alasan: 'Tidak ada baris untuk diunduh.' }

  if (profil?.role && !bolehMembawa(profil.role, tingkat)) {
    return {
      berhasil: false,
      alasan: `Berkas ini berklasifikasi ${labelTingkat(tingkat)}. Peran Anda tidak berhak membawanya keluar.`,
    }
  }

  const keterangan = susunKeterangan({ judul, tingkat, profil, kueri, jumlah: baris.length, waktu, catatan })
  const isi = bentuk === 'json'
    ? keJson({ kolom, baris, keterangan })
    : keCsv({ kolom, baris, keterangan })

  const hasil = unduh({
    nama: namaBerkas(judul, bentuk, waktu),
    isi,
    jenis: bentuk === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8',
  })
  return { ...hasil, keterangan }
}

/* ----------------------------------------------------------- kolom baku */

/**
 * Kolom baku sebuah keluaran berita.
 *
 * Satu daftar, dipakai setiap halaman yang mengekspor berita. Dua halaman yang
 * menyusun kolomnya sendiri menghasilkan dua berkas yang sekilas sama dan
 * tidak bisa ditumpuk — dan yang menumpuknya baru tahu setelah barisnya
 * bergeser satu kolom.
 */
export const KOLOM_BERITA = [
  { kunci: 'judul', label: 'Judul', ambil: (b) => b.judul },
  { kunci: 'nama_upt', label: 'UPT', ambil: (b) => b.nama_upt },
  { kunci: 'kanwil_asal', label: 'Kantor Wilayah', ambil: (b) => b.kanwil_asal },
  { kunci: 'provinsi', label: 'Provinsi', ambil: (b) => b.provinsi },
  { kunci: 'media', label: 'Media', ambil: (b) => b.media },
  { kunci: 'platform', label: 'Platform', ambil: (b) => b.platform },
  { kunci: 'kategori', label: 'Kategori', ambil: (b) => b.kategori },
  { kunci: 'subkategori', label: 'Subkategori', ambil: (b) => b.subkategori },
  { kunci: 'sentimen', label: 'Sentimen', ambil: (b) => b.sentimen },
  { kunci: 'urgensi', label: 'Urgensi', ambil: (b) => b.urgensi },
  { kunci: 'status_verifikasi', label: 'Status telaah', ambil: (b) => b.status_verifikasi },
  { kunci: 'tanggal_publikasi', label: 'Terbit', ambil: (b) => tanggalJam(b.tanggal_publikasi) },
  { kunci: 'created_at', label: 'Masuk', ambil: (b) => tanggalJam(b.created_at) },
  { kunci: 'link', label: 'Tautan', ambil: (b) => b.link },
]

export const META_EKSPOR = { versi: 'ekspor-v1.0', kolomBerita: KOLOM_BERITA.length }
