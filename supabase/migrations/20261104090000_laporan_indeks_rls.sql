-- Indeks penutup laporan ikut memuat deleted_at, supaya RLS pun bisa dijawab
-- dari indeks.
--
-- Sesudah 20261104080000, hitungan laporan sebagai PEMILIK fungsi memang
-- index-only (32 ribu baris, 25 ms). Tetapi sebagai pengguna yang terikat RLS
-- — siapa pun yang membuka Laporan Berkala — perencana kembali ke bitmap heap
-- scan dan membaca 9.801 halaman tabel: panggilan pertama 10,9 detik,
-- berikutnya 0,3 detik. Sebabnya aturan baca berita gabungan dari dua policy:
--
--   berita_select_scoped         deleted_at IS NULL AND (...)
--   berita_select_deleted_admin  deleted_at IS NOT NULL AND (select is_super_admin())
--
-- Ekspresi OR keduanya merujuk deleted_at sebagai KOLOM, dan index-only scan
-- hanya mungkin bila setiap kolom yang dirujuk ada di indeks. Pada indeks
-- parsial `where deleted_at is null`, deleted_at hanya ada di predikat.
-- Memuatnya sebagai kolom INCLUDE tidak menambah arti apa pun (nilainya selalu
-- kosong di indeks ini) dan hampir tidak menambah ukuran.

drop index if exists public.berita_laporan_idx;

create index berita_laporan_idx on public.berita (created_at)
  include (id, sentimen, nama_upt, kategori, status_verifikasi, kanwil_asal, deleted_at)
  where deleted_at is null;
