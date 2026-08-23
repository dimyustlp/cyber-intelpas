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
  nama: 'Cyber-Intelpas',
  instansi: 'Direktorat Pengamanan dan Intelijen',
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

export const ADA_DEMO = KONFIG.mode === 'demo'
