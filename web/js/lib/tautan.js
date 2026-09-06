/**
 * Penyeragaman tautan — salinan sisi peramban.
 *
 * ---------------------------------------------------------------------------
 * YANG BERWENANG BUKAN BERKAS INI
 * ---------------------------------------------------------------------------
 *
 * Sejak 6 September 2026 yang menentukan bentuk tersimpan sebuah tautan adalah
 * fungsi `public.normalkan_tautan()` di basis data, dipanggil pemicu
 * `berita_seragamkan_tautan` pada setiap INSERT dan UPDATE. Apa pun yang
 * dikirim berkas ini akan **ditimpa** di sana.
 *
 * Lalu untuk apa berkas ini ada? Untuk dua hal yang tidak bisa dikerjakan
 * basis data:
 *
 *   1. Memberi tahu petugas bahwa tautannya kembar SEBELUM ia menekan Simpan,
 *      lengkap dengan berita mana yang menabraknya. Menunggu penolakan
 *      basis data berarti petugas mengetik seluruh borang lebih dulu, lalu
 *      kehilangan pekerjaannya.
 *   2. Menampilkan asal tautan di layar sambil diketik.
 *
 * Karena wewenangnya di basis data, perbedaan kecil di sini tidak lagi
 * menghasilkan berita kembar — ia hanya membuat peringatan dininya meleset.
 * Sebelum ini tidak begitu: aturan yang sama ditulis dua kali di dua bahasa,
 * tanpa satu pun yang menahannya tetap sama, dan yang menyunting salah satunya
 * tidak akan pernah tahu ia baru saja membuka celah.
 *
 * `tools/uji-tautan.mjs` menahan ketiganya tetap sama, dengan daftar contoh
 * yang jawabannya sudah diperiksa langsung terhadap fungsi basis datanya.
 *
 * Modul ES murni, tanpa pustaka luar.
 */

/**
 * Penanda yang hanya menerangkan DARI MANA pembaca datang, bukan artikel apa
 * yang dibukanya. Dua perayap yang menemukan artikel yang sama akan
 * menempelkan penanda yang berbeda; tanpa dibuang, keduanya tersimpan sebagai
 * dua berita.
 */
const PENANDA_PELACAK = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'igsh', 'igshid', 'mibextid',
  'ref', 'ref_src', 'refsrc', 'source', 'src', 'spm', 'scm',
  'mc_cid', 'mc_eid', '_ga', '_gl', 'ncid', 'cmpid', 'campaign_id',
  'at_medium', 'at_campaign', 'share_id', 'si',
])

/**
 * Menyeragamkan sebuah tautan.
 *
 * Urutannya penting dan mengikuti urutan yang sama dengan fungsi basis data:
 * fragmen, skema, inang, penanda pelacak, ekor AMP, garis miring.
 *
 * @param {unknown} nilai
 * @returns {string} bentuk seragam, atau '' bila kosong
 */
export function normalkanTautan(nilai) {
  let teks = String(nilai ?? '').replace(/\s+/g, ' ').trim()
  if (!teks) return ''
  if (!/^https?:\/\//i.test(teks)) teks = `https://${teks}`

  try {
    const alamat = new URL(teks)

    // Fragmen tidak pernah menunjuk artikel yang berbeda.
    alamat.hash = ''

    // http dan https selalu disamakan. Portal yang sama disebut dengan dua
    // skema oleh dua perayap adalah kejadian sehari-hari.
    alamat.protocol = 'https:'

    // Nama inang memang tidak peka besar-kecil huruf. Jalurnya TIDAK ikut
    // dikecilkan: di sebagian peladen jalur itu peka, dan mengecilkannya
    // menghasilkan alamat yang tidak bisa dibuka — pengenal video YouTube
    // salah satunya.
    alamat.hostname = alamat.hostname.toLowerCase().replace(/^www\./, '')

    for (const kunci of [...alamat.searchParams.keys()]) {
      const k = kunci.toLowerCase()
      if (k.startsWith('utm_') || PENANDA_PELACAK.has(k)) alamat.searchParams.delete(kunci)
    }

    let hasil = alamat.toString()
    hasil = hasil.replace(/\?$/, '')
    hasil = hasil.replace(/\/amp\/?$/i, '')
    hasil = hasil.replace(/\?outputType=amp$/i, '')
    return hasil.replace(/\/+$/, '')
  } catch {
    // Alamat yang tidak bisa diurai tetap dikembalikan apa adanya, bukan
    // dibuang. Yang menolaknya nanti adalah basis data, dengan pesan yang
    // menyebut sebabnya — jauh lebih berguna daripada kolom yang diam-diam
    // menjadi kosong.
    return teks.replace(/\/+$/, '')
  }
}

/*
   asalTautan() dan kenaliPlatform() SENGAJA tidak ada di sini. Keduanya sudah
   hidup di lib/format.js dan di halaman Input Berita; menyalinnya kemari
   berarti mengulang persis kesalahan yang berkas ini ada untuk memperbaikinya.
   Yang dipindahkan ke sini hanya aturan yang kembarannya sudah terbukti
   menimbulkan berita ganda.
*/

export const META_TAUTAN = { versi: 'tautan-v1.0', selaras: 'public.normalkan_tautan()' }
