-- =============================================================================
-- Cyber-Intelpas — Migrasi 08: Admin Kanwil Mengelola Penginput Wilayahnya
-- =============================================================================
-- Penerbitan akun didelegasikan: Administrator Kantor Wilayah menerbitkan
-- Penginput Berita di wilayahnya sendiri, sedangkan peran internal tetap hanya
-- boleh diterbitkan Administrator Sistem Intelijen.
--
-- Penegakan aturan itu ada di Edge Function `kelola-pengguna`, sebab menerbitkan
-- akun menuntut kunci layanan. Yang dikerjakan migrasi ini adalah bagian yang
-- memang milik basis data: membuat akun yang baru terbit itu *terlihat* oleh
-- yang menerbitkannya.
--
-- Sampai sekarang `app_users` hanya terbaca oleh pemiliknya sendiri dan oleh
-- super admin. Tanpa migrasi ini, admin kanwil tidak bisa melihat satu baris
-- pun — termasuk akun yang baru saja ia terbitkan.
--
-- Kedua policy membuka persis sebesar tugasnya, tidak lebih. Menaikkan peran
-- atau memindahkan orang ke wilayah lain tetap tertutup: WITH CHECK menuntut
-- baris hasil suntingan tetap penginput dan tetap di wilayah yang sama.
--
-- Sifat: idempoten. Aman dijalankan ulang.
-- =============================================================================

begin;

drop policy if exists app_users_kanwil_admin_select on public.app_users;
create policy app_users_kanwil_admin_select on public.app_users
    for select to authenticated
    using (
        public.has_role('kanwil_admin')
        and deleted_at is null
        and assigned_kanwil is not null
        and assigned_kanwil = public.kanwil_saya()
    );

drop policy if exists app_users_kanwil_admin_update on public.app_users;
create policy app_users_kanwil_admin_update on public.app_users
    for update to authenticated
    using (
        public.has_role('kanwil_admin')
        and role = 'kanwil_penginput'
        and assigned_kanwil is not null
        and assigned_kanwil = public.kanwil_saya()
        and deleted_at is null
    )
    with check (
        role = 'kanwil_penginput'
        and assigned_kanwil = public.kanwil_saya()
    );

commit;
