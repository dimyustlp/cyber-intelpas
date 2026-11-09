-- =============================================================================
-- Profil sendiri bisa disimpan lagi (perbaikan 9 November 2026)
-- =============================================================================
--
-- Gejala di lapangan: setiap akun yang masih ditandai "sandi awal" terkunci di
-- halaman Profil selamanya. Sandinya sendiri berhasil diganti (GoTrue menjawab
-- 200), tetapi penanda `must_change_password` tidak pernah bisa dihapus, jadi
-- pada masuk berikutnya akun itu diminta mengganti sandi lagi, dan lagi.
--
-- Sebabnya ada di policy `app_users_update_self`. Klausa WITH CHECK-nya membaca
-- tabel app_users dari dalam policy app_users sendiri:
--
--     role  = (select u.role  from public.app_users u where ...)
--     aktif = (select u.aktif from public.app_users u where ...)
--
-- Postgres menolak policy yang merujuk tabelnya sendiri dengan
-- "42P17 infinite recursion detected in policy for relation app_users". PostgREST
-- meneruskannya sebagai HTTP 500, dan setiap PATCH ke baris milik sendiri —
-- menghapus penanda sandi awal, mengganti nama, mengganti username — gagal.
-- Log Supabase 5–6 November mencatat PATCH 500 beruntun dari akun UPT yang
-- sudah berhasil mengganti sandinya.
--
-- Perbaikannya: nilai lama dibaca lewat fungsi SECURITY DEFINER, yang berjalan
-- di luar RLS sehingga tidak memicu rekursi. Sekalian kolom yang menentukan
-- jangkauan data — kanwil, UPT, dan status hapus — ikut dikunci. Sebelumnya
-- hanya peran dan status aktif yang dijaga, sehingga akun biasa secara teknis
-- bisa memindahkan `assigned_kanwil`-nya sendiri ke wilayah lain. Super admin
-- tidak terdampak: ia tetap lewat policy `app_users_admin_all`.
-- =============================================================================

create or replace function public.kunci_profil_saya()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'role',            u.role,
        'aktif',           u.aktif,
        'assigned_kanwil', u.assigned_kanwil,
        'assigned_upt',    u.assigned_upt,
        'deleted_at',      u.deleted_at
    )
    from public.app_users u
    where u.auth_user_id = auth.uid()
    limit 1;
$$;

revoke all on function public.kunci_profil_saya() from public, anon;
grant execute on function public.kunci_profil_saya() to authenticated;

drop policy if exists app_users_update_self on public.app_users;
create policy app_users_update_self on public.app_users
  for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (
    auth_user_id = (select auth.uid())
    and jsonb_build_object(
          'role',            role,
          'aktif',           aktif,
          'assigned_kanwil', assigned_kanwil,
          'assigned_upt',    assigned_upt,
          'deleted_at',      deleted_at
        ) = (select public.kunci_profil_saya())
  );

-- Akun yang terbukti (log GoTrue 5–6 November) sudah mengganti sandinya tetapi
-- penandanya tertahan oleh galat di atas. Akun lain yang masih bersandi awal
-- tetap ditandai; mereka cukup mengganti sandi sekali lagi dan kali ini akan
-- tersimpan.
update public.app_users
   set must_change_password = false
 where must_change_password
   and auth_user_id in (
     'b202debd-7541-4a27-8b24-4c80577ce2a4',  -- kprrutanbarru@gmail.com
     '5a012dc1-96b2-47a2-8058-7849639ab5aa'   -- maroskamtib@gmail.com
   );
