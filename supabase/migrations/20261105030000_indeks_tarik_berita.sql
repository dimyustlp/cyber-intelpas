-- Penarikan berita untuk akun KANWIL/UPT kadang habis waktu (statement timeout
-- 8 detik), sehingga dasbor wilayah tampil "Peladen terlalu lama menjawab" dan
-- kosong. Diukur 5 November 2026 sebagai Kanwil DKI Jakarta, halaman pertama
-- (500 baris, order created_at desc, id desc) dari 34 ribu arsip: 9,38 detik.
--
-- Sebabnya bukan RLS yang lambat per baris (itu sudah diperbaiki), melainkan
-- SEBARAN yang jarang: DKI hanya ~1.000 dari 34.000 baris, tersebar merata
-- sepanjang waktu. Untuk mengumpulkan 500 baris DKI terbaru, Postgres memindai
-- belasan ribu baris berita_created_at_idx dan MENGAMBIL HEAP setiap baris
-- hanya untuk memeriksa wilayahnya — padahal 18.470 di antaranya bukan miliknya.
-- Ditambah urutan (created_at desc, id desc) memaksa Incremental Sort.
--
-- Indeks ini menutup keduanya:
--   * Urutannya PERSIS (created_at desc, id desc) — tidak ada sort tambahan.
--   * Memuat kanwil_asal dan nama_upt (INCLUDE) — kolom yang dibaca RLS
--     (kanwil_asal = kanwil_saya() OR nama_upt = any(upt_terjangkau)). Karena
--     keduanya ada DI DALAM indeks, penyaringan wilayah dikerjakan dari indeks,
--     dan heap hanya disentuh untuk ~500 baris yang benar-benar cocok.
--
-- Hasil (DKI, indeks terpasang): halaman pertama 9,38 -> 2,1 detik; halaman
-- terjauh 0,8 detik. Semua di bawah 8 detik, dengan margin lebar.
--
-- Peran PUSAT tidak dirugikan: akses_berita_semua() true membuat penyaring
-- selalu lolos, jadi indeks mengembalikan 500 baris pertama langsung menurut
-- urutannya — bahkan menghapus Incremental Sort yang dulu mereka tanggung.
--
-- Partial (where deleted_at is null): seluruh penarikan layar memang menyaring
-- itu, dan indeksnya jadi jauh lebih kecil.

create index if not exists berita_urut_saring_idx
  on public.berita (created_at desc, id desc)
  include (kanwil_asal, nama_upt)
  where deleted_at is null;
