-- Optimasi dari Supabase Performance Advisor (5 November 2026).
--
-- Dua kelas temuan yang aman ditutup tanpa mengubah perilaku:
--
-- 1. Indeks kembar PERSIS. Setiap sisip/ubah baris memperbarui SEMUA indeks
--    tabelnya; dua indeks identik berarti satu pekerjaan tulis sia-sia pada
--    tiap baris. `berita` menerima ribuan sisipan sepekan dari penjaring, jadi
--    ini beban tulis yang berulang.
--      berita_upt_idx        == berita_nama_upt_idx      (btree nama_upt)
--      audit_log_created_idx == audit_log_created_at_idx (btree created_at)
--    Yang dipertahankan adalah yang pernah terpakai (idx_scan > 0).
--
-- 2. RLS yang menilai ulang auth.uid()/is_super_admin() PER BARIS. Dibungkus
--    `(select ...)` supaya Postgres menghitungnya SEKALI per kueri (InitPlan),
--    bukan sekali per baris — transform yang dianjurkan dokumentasi Supabase.
--    Artinya identik; hanya rencana eksekusinya yang berubah. Tiga policy pada
--    tabel kecil (app_users 47 baris, sumber_sheet 36), jadi dampaknya kecil,
--    tetapi menutup peringatan dan menyeragamkan pola dengan policy berita yang
--    sudah dibungkus lebih dulu.

drop index if exists public.berita_upt_idx;
drop index if exists public.audit_log_created_idx;

drop policy if exists app_users_select_self on public.app_users;
create policy app_users_select_self on public.app_users
  for select to authenticated
  using ((auth_user_id = (select auth.uid())) or (select public.is_super_admin()));

drop policy if exists app_users_update_self on public.app_users;
create policy app_users_update_self on public.app_users
  for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (
    auth_user_id = (select auth.uid())
    and role = (select u.role from public.app_users u where u.auth_user_id = (select auth.uid()))
    and aktif = (select u.aktif from public.app_users u where u.auth_user_id = (select auth.uid()))
  );

drop policy if exists sumber_sheet_baca on public.sumber_sheet;
create policy sumber_sheet_baca on public.sumber_sheet
  for select to authenticated
  using (
    public.has_role(variadic array['super_admin','media_intelligence_analyst',
      'evaluation_recommendation_analyst','executive_decision_maker','news_data_operator'])
    or (kanwil is not null and kanwil = (
      select u.assigned_kanwil from public.app_users u
      where u.auth_user_id = (select auth.uid()) and u.aktif is true and u.deleted_at is null
      limit 1))
  );
