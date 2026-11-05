-- Peran baru "Administrator" (admin) — satu tingkat di bawah Superadmin.
--
-- Diminta user 5 November 2026: posisi teratas (Superadmin / Pemilik Sistem)
-- hanya dimyust; sebuah lapisan "admin" di bawahnya yang bisa SELURUH pekerjaan
-- operasional & analisis pusat, TETAPI tidak memegang kewenangan pemilik
-- (kelola pengguna, integrasi/kunci, audit, kesehatan, koordinat induk, peran).
--
-- Penegakannya di satu titik, bukan di 55 kebijakan. has_role() memperlakukan
-- peran 'admin' sebagai PEWARIS seluruh peran pusat operasional: di mana pun
-- sebuah kebijakan mengizinkan salah satu dari kelima peran itu, admin ikut
-- lolos. is_super_admin() = has_role('super_admin') — dan 'admin' sengaja TIDAK
-- diwariskan ke 'super_admin', sehingga setiap kewenangan pemilik (yang semua
-- bergantung pada is_super_admin) tertutup rapat bagi admin.
--
-- Perubahan untuk peran lain: TIDAK ADA. Cabang baru hanya aktif ketika peran
-- pemanggil benar-benar 'admin'; peran lain menempuh jalur yang sama persis
-- seperti sebelumnya.
--
-- BELUM ada akun yang diberi peran ini — user yang akan mengangkat sendiri
-- lewat Pengguna -> Sunting.

-- Daftar peran yang sah di app_users menerima 'admin'. Tanpa ini, menyetel
-- peran sebuah akun menjadi 'admin' ditolak check constraint.
alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check check (
  role = any (array[
    'super_admin','admin','media_intelligence_analyst','news_data_operator',
    'field_verification_officer','evaluation_recommendation_analyst',
    'executive_decision_maker','kanwil_admin','upt_penelaah'
  ])
);

create or replace function public.has_role(variadic roles text[])
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
    select coalesce(
        public.current_role_name() = any (roles)
        -- Administrator mewarisi SELURUH peran pusat operasional. Tidak termasuk
        -- 'super_admin', jadi is_super_admin() tetap false untuk admin.
        or (
            public.current_role_name() = 'admin'
            and roles && array[
                'media_intelligence_analyst',
                'evaluation_recommendation_analyst',
                'executive_decision_maker',
                'news_data_operator',
                'field_verification_officer'
            ]
        ),
        false);
$function$;

-- Hak baca "seluruh berita nasional": tambahkan 'admin' ke daftar peran pusat.
create or replace function public.akses_berita_semua()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((
    select nullif(u.assigned_upt, '') is null
       and nullif(u.assigned_kanwil, '') is null
       and u.role in (
         'super_admin',
         'admin',
         'media_intelligence_analyst',
         'evaluation_recommendation_analyst',
         'executive_decision_maker',
         'news_data_operator',
         'field_verification_officer'
       )
    from public.app_users u
    where u.auth_user_id = auth.uid()
      and u.aktif is true
      and u.deleted_at is null
    limit 1
  ), false);
$function$;

-- Akses per-UPT untuk peran pusat tanpa penugasan: tambahkan 'admin'.
create or replace function public.can_access_upt(target_upt text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
    with saya as (
        select u.role, nullif(u.assigned_upt, '') as upt, nullif(u.assigned_kanwil, '') as kanwil
        from public.app_users u
        where u.auth_user_id = auth.uid()
          and u.aktif is true
          and u.deleted_at is null
        limit 1
    )
    select case
        when not exists (select 1 from saya) then false
        when (select upt from saya) is not null
            then (select upt from saya) = target_upt
        when (select kanwil from saya) is not null
            then exists (
                select 1 from public.upt t
                where t.nama_upt = target_upt
                  and t.kanwil = (select kanwil from saya)
            )
        else (select role from saya) in (
            'super_admin',
            'admin',
            'media_intelligence_analyst',
            'evaluation_recommendation_analyst',
            'executive_decision_maker',
            'news_data_operator',
            'field_verification_officer'
        )
    end;
$function$;

-- Label tampilan sisi peladen (laporan, telegram, dsb.).
create or replace function public.role_label(role_key text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
    select case role_key
        when 'super_admin'                       then 'Administrator Utama Sistem'
        when 'admin'                             then 'Administrator'
        when 'media_intelligence_analyst'        then 'Analis Pemberitaan Strategis'
        when 'news_data_operator'                then 'Operator Akuisisi Data Berita'
        when 'field_verification_officer'        then 'Petugas Verifikasi Lapangan'
        when 'evaluation_recommendation_analyst' then 'Analis Evaluasi dan Rekomendasi'
        when 'executive_decision_maker'          then 'Pimpinan Pengambil Keputusan'
        when 'kanwil_admin'                      then 'Administrator Kantor Wilayah'
        when 'upt_penelaah'                      then 'Penelaah Berita UPT'
        when 'upt_petugas'                       then 'Petugas Unit Pelaksana Teknis (dihapus)'
        when 'kanwil_penelaah'                   then 'Penelaah Berita Kantor Wilayah (dihapus)'
        when 'kanwil_penginput'                  then 'Penginput Berita Kantor Wilayah (dihapus)'
        else role_key
    end;
$function$;
