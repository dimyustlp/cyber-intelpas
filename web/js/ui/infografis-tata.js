/**
 * Ukuran, warna, dan lambang lembar infografis.
 *
 * Dipisahkan dari penggambarnya karena tata letak yang sama dipakai DUA
 * penggambar: ui/infografis-svg.js di peramban, dan penyusun PDF di dalam Edge
 * Function. Bila angkanya ditulis dua kali, keduanya akan berbeda pada
 * perubahan berikutnya — dan yang paling jarang dilihat, yang PDF, yang paling
 * lama salah tanpa ketahuan.
 *
 * WARNA DI SINI TIDAK IKUT TEMA GELAP, DAN ITU DISENGAJA.
 *
 * Seluruh aplikasi memakai peubah CSS supaya bisa berganti terang-gelap. Lembar
 * ini tidak: ia dicetak, dikirim ke grup Telegram, dan ditempel di paparan.
 * Sebuah lembar yang warnanya ikut berubah menurut setelan peramban penyusunnya
 * adalah lembar yang tidak bisa dijamin bentuknya — dan dua orang yang
 * membandingkan lembar yang sama akan melihat dua benda yang berbeda.
 */

export const TATA = {
  /* Perbandingan A4 lanskap (√2). Lembar yang sama memenuhi kertas ketika
     dicetak dan memenuhi layar ketika dilihat, tanpa penyesuaian. */
  lebar: 1600,
  tinggi: 1131,
  tepi: 22,

  tinggiKepala: 132,
  tinggiAngka: 86,
  tinggiTengah: 560,
  tinggiBawah: 250,
  kepalaPanel: 30,

  huruf: {
    /* Nama huruf ditulis lengkap dengan cadangannya. SVG yang dirasterkan
       menjadi PNG memakai huruf yang benar-benar ada di mesin penggambar, dan
       cadangan yang tidak disebutkan berarti huruf serif bawaan peramban —
       yang membuat lembar resmi terlihat seperti dokumen tahun 1998. */
    judul: "'Plus Jakarta Sans', 'Segoe UI', system-ui, -apple-system, sans-serif",
    badan: "'Plus Jakarta Sans', 'Segoe UI', system-ui, -apple-system, sans-serif",
    angka: "'IBM Plex Mono', ui-monospace, monospace",
  },
}

export const WARNA = {
  latar: '#eef2f7',
  kartu: '#ffffff',
  latarLembut: '#f4f7fa',
  garis: '#dde3ea',
  tinta: '#16202e',
  redup: '#67717f',
  navy: '#173a63',
  biru: '#1d6fd0',
  ungu: '#7c4dbd',
  jingga: '#e2711d',
  merahTua: '#a4262c',

  /* Tiga warna ember, sama seperti yang dipakai layar — supaya orang yang
     terbiasa dengan dasbor tidak perlu belajar warna baru untuk membaca
     lembar ini. */
  positif: '#1f9d55',
  netral: '#f0b429',
  negatif: '#d93025',
  abu: '#c8d0d9',
  abuSamar: '#dfe5ec',
}

/**
 * Lambang pada kepala lembar.
 *
 * Digambar, bukan ditempel. Lembar ini juga disusun di dalam Edge Function,
 * yang tidak bisa membaca berkas gambar mana pun dari repositori.
 *
 * Yang digambar sengaja BUKAN tiruan lambang resmi Kemenimipas. Lambang negara
 * punya bentuk baku yang tidak boleh diterka, dan tiruan yang mirip-tetapi-tidak
 * -sama justru lebih buruk daripada tanda netral: ia terbaca sebagai lambang
 * resmi yang digambar sembarangan. Yang ada di sini perisai polos dengan huruf
 * PAS — tanda milik aplikasi ini sendiri. Bila suatu saat berkas lambang resmi
 * disediakan, ia bisa disisipkan sebagai data URI lewat opsi `lambang`.
 */
export function LAMBANG(x, y, ukuran) {
  const s = ukuran / 60
  const g = (n) => Number((n * s).toFixed(2))
  return `<g transform="translate(${Number(x).toFixed(2)} ${Number(y).toFixed(2)})">`
    + `<path d="M${g(30)} ${g(2)}L${g(56)} ${g(12)}L${g(56)} ${g(32)}`
    + `C${g(56)} ${g(46)} ${g(44)} ${g(55)} ${g(30)} ${g(58)}`
    + `C${g(16)} ${g(55)} ${g(4)} ${g(46)} ${g(4)} ${g(32)}`
    + `L${g(4)} ${g(12)}Z" fill="${WARNA.navy}"/>`
    + `<path d="M${g(30)} ${g(8)}L${g(51)} ${g(16)}L${g(51)} ${g(32)}`
    + `C${g(51)} ${g(43)} ${g(41)} ${g(50)} ${g(30)} ${g(52)}`
    + `C${g(19)} ${g(50)} ${g(9)} ${g(43)} ${g(9)} ${g(32)}`
    + `L${g(9)} ${g(16)}Z" fill="none" stroke="#d9b34a" stroke-width="${g(1.6)}"/>`
    + `<text x="${g(30)}" y="${g(37)}" font-family="${TATA.huruf.judul}" font-size="${g(17)}"`
    + ` font-weight="800" fill="#ffffff" text-anchor="middle">PAS</text>`
    + '</g>'
}

/**
 * Piktogram tema dan ubin angka.
 *
 * Semuanya digambar di dalam kotak 24 × 24 lalu diskalakan, supaya satu
 * ukuran bisa dipakai di panel rincian isu (22 px), ubin angka (26 px), dan
 * kartu contoh berita (20 px) tanpa tiga berkas yang berbeda.
 *
 * Bentuknya sengaja sederhana: garis tebal, tanpa detail di bawah satu piksel.
 * Piktogram yang halus hilang seluruhnya ketika lembar ini dirasterkan menjadi
 * PNG selebar 1600 piksel, dan yang tersisa hanya noda abu-abu.
 */
function bungkus(x, y, ukuran, isi, warna) {
  const s = ukuran / 24
  return `<g transform="translate(${Number(x).toFixed(2)} ${Number(y).toFixed(2)}) scale(${s.toFixed(4)})"`
    + ` fill="none" stroke="${warna}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`
    + isi + '</g>'
}

export const IKON_TEMA = {
  /* --- tema rincian isu --- */
  pembinaan: (x, y, u, w) => bungkus(x, y, u,
    '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.2"/>'
    + '<path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M16 20c0-2.2 1-3.6 3-4.2"/>', w),
  perisai: (x, y, u, w) => bungkus(x, y, u,
    '<path d="M12 2.5 20 6v6c0 4.6-3.4 8-8 9.5C7.4 20 4 16.6 4 12V6Z"/>'
    + '<path d="M9 12l2 2 4-4"/>', w),
  medis: (x, y, u, w) => bungkus(x, y, u,
    '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M12 10v6M9 13h6"/>'
    + '<path d="M9 6V4h6v2"/>', w),
  dokumen: (x, y, u, w) => bungkus(x, y, u,
    '<path d="M6 2.5h8l4 4V21a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 21Z"/>'
    + '<path d="M14 2.5V7h4"/><path d="M9 12h6M9 16h4"/>', w),
  tanaman: (x, y, u, w) => bungkus(x, y, u,
    '<path d="M12 21v-8"/><path d="M12 13c0-4 3-6 7-6 0 4-3 6-7 6Z"/>'
    + '<path d="M12 16c0-3-2.4-5-5.5-5 0 3 2.4 5 5.5 5Z"/>', w),
  timbangan: (x, y, u, w) => bungkus(x, y, u,
    '<path d="M12 3v18M7 21h10"/><path d="M4 8h16"/>'
    + '<path d="M4 8 1.5 14h5Z"/><path d="M20 8l-2.5 6h5Z"/>', w),
  awas: (x, y, u, w) => bungkus(x, y, u,
    '<path d="M12 3 22 20H2Z"/><path d="M12 10v4M12 17h.01"/>', w),
  lembaga: (x, y, u, w) => bungkus(x, y, u,
    '<path d="M3 21h18M4 21V10l8-5 8 5v11"/><path d="M9 21v-6h6v6"/>', w),

  /* --- ubin angka --- */
  berita: (x, y, u, w) => bungkus(x, y, u,
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h7M7 13h10M7 17h6"/>', w),
  lapas: (x, y, u, w) => bungkus(x, y, u,
    '<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-8h6v8"/><path d="M12 3v6"/>', w),
  rutan: (x, y, u, w) => bungkus(x, y, u,
    '<rect x="4" y="5" width="16" height="16" rx="1.5"/>'
    + '<path d="M9 5v16M15 5v16M4 13h16"/>', w),
  peta: (x, y, u, w) => bungkus(x, y, u,
    '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>', w),
  media: (x, y, u, w) => bungkus(x, y, u,
    '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18"/>'
    + '<path d="M7 7.5h.01M10 7.5h.01"/><path d="M7 14h6"/>', w),
}
