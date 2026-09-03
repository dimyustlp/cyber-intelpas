/**
 * Satu-satunya pemeriksaan "apakah nama UPT ini sudah terpetakan".
 *
 * Isinya dulu tinggal di ujung `pencocokan-upt.js`, bersama mesin pencocokan
 * nama yang panjangnya 39 KiB. Itu keliru bukan karena tempatnya salah secara
 * logika — keduanya memang berbicara tentang nama unit — melainkan karena
 * hampir setiap halaman memerlukan pemeriksaan sebaris ini dan **tidak satu
 * pun** dari mereka memerlukan mesin pencocoknya. Akibatnya setiap dasbor,
 * setiap daftar berita, dan setiap layar wilayah mengunduh seluruh mesin
 * pencocokan hanya untuk menanyakan satu hal yang jawabannya ada di sebuah Set
 * berisi delapan kata.
 *
 * `pencocokan-upt.js` mengekspor ulang keduanya, sehingga berkas yang memang
 * memakai mesin pencocoknya tidak perlu mengimpor dari dua tempat.
 *
 * Modul ES murni tanpa impor.
 */

/**
 * Nilai yang berarti "unitnya belum diketahui".
 *
 * Bukan satu nilai melainkan delapan, sebab sumbernya juga bukan satu: crawler
 * menuliskan "Belum Teridentifikasi", ekspor spreadsheet menuliskan sel kosong,
 * dan jalur yang lewat JSON menuliskan `null` atau `undefined` sebagai teks.
 * Ketiganya menyatakan hal yang sama, dan layar yang hanya mengenali satu di
 * antaranya akan menghitung dua unit hantu.
 */
export const NILAI_TAK_TERPETAKAN = new Set([
  '', 'belum teridentifikasi', 'tidak diketahui', 'null', 'none', 'nan', '-', 'undefined',
])

/** Satu-satunya pemeriksaan "apakah UPT ini sudah terpetakan" di seluruh sistem. */
export function belumTerpetakan(nama) {
  return NILAI_TAK_TERPETAKAN.has(String(nama ?? '').trim().toLowerCase())
}
