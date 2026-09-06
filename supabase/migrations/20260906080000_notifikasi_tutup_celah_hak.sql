/*
  Dua celah yang dibawa masuk migrasi notifikasi, ditemukan pemeriksa keamanan
  Supabase pada hari yang sama.

  1. VIEW YANG MENEMBUS RLS

  `notifikasi_antrean_siap` dibuat tanpa penanda, dan bawaan PostgreSQL untuk
  view adalah SECURITY DEFINER: ia memakai hak PEMBUATNYA, bukan hak yang
  bertanya. Akibatnya seorang petugas UPT yang hanya berhak melihat beritanya
  sendiri bisa membaca SELURUH berita nasional lewat view ini — seluruh lapis
  RLS pada tabel `berita` dilewati begitu saja.

  Ini persis kelas kekeliruan yang paling berbahaya pada sistem berjenjang
  seperti ini: tidak ada galat, tidak ada tanda, dan yang bocor justru data
  yang paling dijaga.

  Edge Function penguras tidak terpengaruh: ia memakai kunci peladen, yang
  memang melewati RLS dengan sendirinya.

  2. FUNGSI PEMICU YANG BISA DIPANGGIL SIAPA SAJA

  `antrekan_notifikasi_berita()` adalah fungsi pemicu, dan tidak ada seorang pun
  yang perlu memanggilnya sendiri. Karena ia berada di skema public, PostgREST
  menerbitkannya sebagai /rest/v1/rpc/antrekan_notifikasi_berita — terbuka bagi
  anon sekalipun, dan ia berjalan SECURITY DEFINER.

  Yang bisa diperbuat memang terbatas, tetapi fungsi SECURITY DEFINER yang bisa
  dipanggil tanpa masuk akun adalah permukaan serang yang tidak ada gunanya
  dibiarkan terbuka.
*/

alter view public.notifikasi_antrean_siap set (security_invoker = on);

revoke all on function public.antrekan_notifikasi_berita() from public, anon, authenticated;
