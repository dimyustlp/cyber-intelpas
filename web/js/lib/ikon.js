/**
 * Kumpulan ikon garis, digambar langsung sebagai SVG.
 *
 * Tidak ada pustaka ikon yang diunduh dari luar. Sistem intelijen sebaiknya
 * tidak menarik berkas dari peladen pihak ketiga setiap kali halaman dibuka,
 * dan seluruh ikon di sini bersama-sama hanya berukuran beberapa kilobita.
 *
 * Semua ikon memakai stroke currentColor, sehingga warnanya mengikuti teks.
 */

const B = (isi) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${isi}</svg>`

export const IKON = {
  dasbor: B('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
  berita: B('<path d="M4 5h11a1 1 0 0 1 1 1v13H5a1 1 0 0 1-1-1V5Z"/><path d="M16 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3"/><path d="M7 8h6M7 11h6M7 14h4"/>'),
  peringatan: B('<path d="M10.3 3.9 2.4 17a1.9 1.9 0 0 0 1.6 2.9h15.9a1.9 1.9 0 0 0 1.6-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>'),
  peta: B('<path d="m9 4-6 2.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z"/><path d="M9 4v13M15 6.5v13"/>'),
  kasus: B('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>'),
  lapangan: B('<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>'),
  laporan: B('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
  keputusan: B('<path d="M9 12.5 11 15l4.5-5.5"/><path d="M12 3 4 6.5v5c0 5 3.4 8.7 8 9.9 4.6-1.2 8-4.9 8-9.9v-5L12 3Z"/>'),
  tindak: B('<path d="M3 6h13M3 12h9M3 18h6"/><path d="m16 14 3 3 5-6"/>'),
  tren: B('<path d="M3 20V4"/><path d="M3 17.5 9 12l4 3 7-7.5"/><path d="M16 7.5h4v4"/>'),
  pengguna: B('<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a8 8 0 0 1 15 0"/>'),
  pengaturan: B('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>'),
  audit: B('<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>'),
  kesehatan: B('<path d="M3 12h4l2-6 4 12 2-6h6"/>'),
  sinkron: B('<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-7.4-3.9"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 7.4 3.9"/><path d="M19.4 3v4.2h-4.2M4.6 21v-4.2h4.2"/>'),
  cari: B('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  saring: B('<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>'),
  unduh: B('<path d="M12 3v12"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/>'),
  kirim: B('<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5 21 3Z"/>'),
  tambah: B('<path d="M12 5v14M5 12h14"/>'),
  kurang: B('<path d="M5 12h14"/>'),
  tutup: B('<path d="m6 6 12 12M18 6 6 18"/>'),
  centang: B('<path d="m5 12.5 4.5 4.5L19 7"/>'),
  panahKanan: B('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'),
  menu: B('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  terang: B('<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  gelap: B('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"/>'),
  keluar: B('<path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8"/><path d="m16 15 4-3-4-3"/><path d="M20 12H10"/>'),
  gembok: B('<rect x="4.5" y="10" width="15" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>'),
  arsip: B('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>'),
  info: B('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  kosong: B('<path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>'),
  jam: B('<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>'),
  tautan: B('<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7l-1.3 1.3"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 1 0 5.7 5.7l1.3-1.3"/>'),
  segar: B('<path d="M20 11a8 8 0 1 0-.7 4.3"/><path d="M20 5v6h-6"/>'),
}

/** @param {keyof typeof IKON} nama */
export function ikon(nama, kelas = '') {
  const svg = IKON[nama] || IKON.info
  return kelas ? svg.replace('<svg ', `<svg class="${kelas}" `) : svg
}
