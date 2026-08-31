-- =============================================================================
-- Cyber-Intelpas — Migrasi 07: Menutup Fungsi yang Terbuka untuk Anon
-- =============================================================================
-- Ditemukan saat memeriksa ulang basis data sesudah migrasi 05 dan 06.
--
-- `snapshot_laporan` berjalan sebagai SECURITY DEFINER — ia menembus RLS dengan
-- sengaja, supaya laporan berkala bisa menghitung seluruh arsip tanpa terhalang
-- cakupan pembacanya. Tetapi hak eksekusinya masih melekat pada PUBLIC, dan
-- PUBLIC pada PostgREST berarti anon: siapa pun yang memegang kunci publik dapat
-- memanggilnya lewat /rest/v1/rpc dan menerima isi laporan tanpa pernah masuk.
-- Kunci itu memang tertulis di berkas yang dikirim ke peramban — ia tidak pernah
-- dimaksudkan menjadi rahasia; yang menahan data seharusnya policy, dan fungsi
-- yang menembus policy tidak boleh ikut terbuka.
--
-- `handle_new_auth_user` adalah fungsi pemicu. Ia tidak pernah pantas dipanggil
-- sebagai RPC oleh siapa pun.
--
-- Sifat: idempoten. Aman dijalankan ulang.
-- =============================================================================

begin;

revoke execute on function public.snapshot_laporan(date, date)   from public, anon;
revoke execute on function public.snapshot_negatif(date, date)   from public, anon;
revoke execute on function public.snapshot_ringkas(date, date)   from public, anon;
revoke execute on function public.next_report_number(text)       from public, anon;
revoke execute on function public.handle_new_auth_user()         from public, anon, authenticated;

grant execute on function public.snapshot_laporan(date, date)  to authenticated;
grant execute on function public.snapshot_negatif(date, date)  to authenticated;
grant execute on function public.snapshot_ringkas(date, date)  to authenticated;
grant execute on function public.next_report_number(text)      to authenticated;

-- search_path yang bisa dibelokkan: dua fungsi snapshot terlewat pada migrasi 04.
alter function public.snapshot_negatif(date, date) set search_path = public, pg_temp;
alter function public.snapshot_ringkas(date, date) set search_path = public, pg_temp;

commit;
