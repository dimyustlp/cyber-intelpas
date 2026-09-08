/**
 * Konfigurasi aplikasi.
 *
 * Kunci di bawah adalah publishable key Supabase. Kunci jenis ini memang
 * dirancang untuk ditempel di sisi klien dan tidak memberi hak apa pun dengan
 * sendirinya — yang menentukan apa yang boleh dibaca dan ditulis adalah policy
 * RLS pada basis data, dievaluasi terhadap sesi pengguna yang sedang masuk.
 *
 * Tidak ada service role key di berkas ini, dan tidak boleh pernah ada.
 * Kunci itu hanya dipegang Edge Function yang berjalan di peladen.
 *
 * Mode:
 *   "langsung" — terhubung ke Supabase sungguhan
 *   "demo"     — memakai data contoh bawaan, dipakai untuk pratinjau tampilan
 *                dan pemeriksaan visual tanpa menyentuh data sungguhan
 */

const parameter = new URLSearchParams(globalThis.location?.search ?? '')

export const KONFIG = {
  /*
     Nama sistem, satu tempat.

     Sampai 1 September 2026 sistem ini bernama Cyber-Intelpas, dan namanya
     ditulis ulang di belasan berkas. Sekarang halaman apa pun yang perlu
     menyebut namanya mengambilnya dari sini — termasuk kop menu samping dan
     halaman masuk, yang dulu menuliskannya sendiri.

     Yang TIDAK ikut berganti dan tidak boleh diganti: ranah username bayangan
     di lib/api.js, nama folder, nama repositori, dan nama tabel basis data.
     Ketiganya bukan tulisan di layar, melainkan pengenal yang sudah tersimpan.
  */
  nama: 'Trans-Siber PAS',
  /**
     Dua huruf, dipakai ketika berkas lambang tidak tergambar: teks alternatif
     gambar, dan tempat yang memang hanya menerima aksara.
  */
  lambang: 'TS',

  /**
     Dua lencana resmi, dan hanya di sini alamatnya ditulis.

     Keduanya berbentuk lingkaran penuh yang menyentuh keempat tepi berkas.
     Itu bukan kebetulan: yang menggambarnya cukup memberi `border-radius: 50%`
     untuk mendapatkan lencana bundar yang rapi, dan ukuran berapa pun tetap
     seimbang tanpa satu pun penyesuaian per tempat.

     Lembar infografis TIDAK memakai alamat ini — ia menanam lambangnya sebagai
     data URI lewat ui/lambang-data.js, sebab dua dari tiga keluarannya tidak
     bisa mengambil berkas dari mana pun. Alasannya di kepala berkas itu.
  */
  lencana: {
    /** Lencana sistem: Trans-Siber Pemasyarakatan · Database Pamintel. */
    sistem: 'assets/lambang-trans-siber.png',
    /** Lencana Direktorat Pengamanan dan Intelijen Republik Indonesia. */
    direktorat: 'assets/lambang-ditpamintel.png',
  },

  instansi: 'Direktorat Pengamanan dan Intelijen',
  /**
     Singkatan resmi direktorat, huruf besar seluruhnya.

     Sampai 7 September 2026 kop menu samping menuliskan "Dirpamintel" — awalan
     yang keliru: satuan kerjanya direktorat, bukan direktur, sehingga
     singkatannya DIT-, bukan DIR-. Kata itu diketik langsung di main.js dan
     tidak punya sumber lain, jadi setiap tempat yang butuh menyebutnya
     mengetiknya sendiri. Sekarang satu tempat.
  */
  instansiSingkat: 'DITPAMINTEL',
  induk: 'Direktorat Jenderal Pemasyarakatan',
  kementerian: 'Kementerian Imigrasi dan Pemasyarakatan',
  versi: '2.0.0',

  url: 'https://ffcebfslmnhivravwhvm.supabase.co',
  kunciPublik: 'sb_publishable_zPFtwp1EbYbIHaKT80FwWA_tZs4vNdn',

  mode: parameter.get('mode') === 'demo' ? 'demo' : 'langsung',

  /** Berapa baris ditarik sekali jalan pada tabel panjang. */
  ukuranHalaman: 50,

  /** Ambang keyakinan mesin sebelum hasil boleh dipakai tanpa telaah manusia. */
  ambangKeyakinan: 0.75,
}

/**
 * Ukuran data induk UPT, untuk halaman yang harus menyebut angkanya sebelum ada
 * sesi — halaman masuk dan kartu fitur yang belum siap.
 *
 * Angka ini pernah ditulis lima kali di lima berkas berbeda, dan kelimanya
 * menyebut 492 karena memang itulah isi tabelnya. Ketika daftar Ditjenpas
 * dibandingkan ulang pada 1 September 2026, tabelnya ternyata kehilangan 39
 * unit — seluruh LPKA di Indonesia di antaranya — dan lima kalimat di layar
 * ikut salah tanpa ada satu pun yang berubah warna. Sekarang angkanya satu,
 * dan berasal dari satu tempat.
 *
 * Sumber kebenarannya adalah data/master-upt.csv, yang disusun
 * tools/susun-master-upt.mjs dari daftar UPT nasional. Halaman yang sudah punya
 * sesi TIDAK memakai angka ini — mereka menghitung dari tabelnya sendiri.
 */
export const INDUK_UPT = {
  jumlah: 531,
  kanwil: 38,
  /** Unit yang koordinatnya masih titik wilayah, bukan alamat gedung. */
  belumTerverifikasi: 530,
}

export const ADA_DEMO = KONFIG.mode === 'demo'
