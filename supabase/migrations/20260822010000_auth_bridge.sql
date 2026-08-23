-- =============================================================================
-- Cyber-Intelpas — Migrasi 01: Jembatan Otentikasi
-- =============================================================================
-- Tujuan
--   Memindahkan otentikasi dari tabel `app_users` berbasis password_hash ke
--   Supabase Auth, tanpa membuang satu pun data profil yang sudah ada.
--
--   Sebelum migrasi ini, seluruh akses database berjalan lewat service_role key.
--   Konsekuensinya, setiap sesi aplikasi memegang hak penuh atas database dan
--   pembatasan peran hanya ditegakkan di lapisan tampilan. Migrasi ini adalah
--   prasyarat agar RLS pada migrasi berikutnya punya identitas untuk dievaluasi.
--
-- Sifat: idempoten. Aman dijalankan ulang.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Kaitkan profil aplikasi dengan identitas Supabase Auth
-- -----------------------------------------------------------------------------

alter table public.app_users
    add column if not exists auth_user_id uuid unique
        references auth.users (id) on delete set null,
    add column if not exists email text unique,
    add column if not exists jabatan text,
    add column if not exists nip text,
    add column if not exists nomor_telepon text,
    add column if not exists avatar_path text,
    add column if not exists must_change_password boolean not null default false;

comment on column public.app_users.auth_user_id is
    'Relasi ke auth.users. Kolom inilah yang dibaca seluruh policy RLS.';
comment on column public.app_users.password_hash is
    'Peninggalan otentikasi Streamlit. Dipertahankan sementara untuk rollback, '
    'dan dikosongkan setelah seluruh pengguna berpindah ke Supabase Auth.';

create index if not exists app_users_auth_user_id_idx
    on public.app_users (auth_user_id)
    where auth_user_id is not null;

create index if not exists app_users_role_aktif_idx
    on public.app_users (role, aktif)
    where deleted_at is null;

-- -----------------------------------------------------------------------------
-- 2. Fungsi identitas — dipakai berulang oleh seluruh policy
-- -----------------------------------------------------------------------------
-- Ketiganya STABLE dan SECURITY DEFINER supaya bisa membaca app_users tanpa
-- terjerat policy app_users itu sendiri (rekursi tak berujung).

create or replace function public.current_app_user()
returns public.app_users
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select u.*
    from public.app_users u
    where u.auth_user_id = auth.uid()
      and u.aktif is true
      and u.deleted_at is null
    limit 1;
$$;

comment on function public.current_app_user() is
    'Profil aplikasi milik sesi yang sedang berjalan, atau NULL bila tidak ada.';

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select u.role
    from public.app_users u
    where u.auth_user_id = auth.uid()
      and u.aktif is true
      and u.deleted_at is null
    limit 1;
$$;

create or replace function public.current_username()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select u.username
    from public.app_users u
    where u.auth_user_id = auth.uid()
      and u.aktif is true
      and u.deleted_at is null
    limit 1;
$$;

create or replace function public.has_role(variadic roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(public.current_role_name() = any (roles), false);
$$;

comment on function public.has_role(text[]) is
    'Benar bila peran sesi berjalan termasuk salah satu argumen. '
    'Contoh: has_role(''super_admin'', ''media_intelligence_analyst'').';

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.has_role('super_admin');
$$;

-- Cakupan wilayah. Operator UPT hanya boleh menyentuh unitnya sendiri,
-- admin kanwil hanya wilayahnya. Kolom assigned_kanwil / assigned_upt sudah ada
-- di app_users sejak awal tetapi belum pernah ditegakkan.
create or replace function public.can_access_upt(target_upt text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select case
        when public.has_role('super_admin',
                             'media_intelligence_analyst',
                             'evaluation_recommendation_analyst',
                             'executive_decision_maker') then true
        else exists (
            select 1
            from public.app_users u
            where u.auth_user_id = auth.uid()
              and u.aktif is true
              and u.deleted_at is null
              and (
                    u.assigned_upt is null
                 or u.assigned_upt = ''
                 or u.assigned_upt = target_upt
                 or exists (
                        select 1 from public.upt t
                        where t.nama_upt = target_upt
                          and t.kanwil = u.assigned_kanwil
                    )
              )
        )
    end;
$$;

-- Hak eksekusi: hanya untuk pengguna yang sudah masuk.
revoke execute on function public.current_app_user()        from anon, public;
revoke execute on function public.current_role_name()       from anon, public;
revoke execute on function public.current_username()        from anon, public;
revoke execute on function public.has_role(text[])          from anon, public;
revoke execute on function public.is_super_admin()          from anon, public;
revoke execute on function public.can_access_upt(text)      from anon, public;

grant execute on function public.current_app_user()         to authenticated;
grant execute on function public.current_role_name()        to authenticated;
grant execute on function public.current_username()         to authenticated;
grant execute on function public.has_role(text[])           to authenticated;
grant execute on function public.is_super_admin()           to authenticated;
grant execute on function public.can_access_upt(text)       to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Sinkronisasi otomatis saat pengguna Auth dibuat
-- -----------------------------------------------------------------------------
-- Undangan pengguna dibuat dari panel admin aplikasi dengan metadata peran.
-- Trigger ini menautkan atau membuatkan profil app_users-nya.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    target_username text;
    target_role     text;
begin
    target_username := coalesce(
        nullif(new.raw_user_meta_data ->> 'username', ''),
        split_part(new.email, '@', 1)
    );

    target_role := coalesce(
        nullif(new.raw_user_meta_data ->> 'role', ''),
        'news_data_operator'
    );

    -- Profil yang sudah ada (peninggalan Streamlit) cukup ditautkan.
    update public.app_users
       set auth_user_id = new.id,
           email        = coalesce(email, new.email),
           updated_at   = now()
     where username = target_username
       and auth_user_id is null;

    if not found then
        insert into public.app_users (
            id, username, password_hash, full_name, role,
            email, auth_user_id, aktif, created_at, updated_at
        )
        values (
            gen_random_uuid(),
            target_username,
            '',
            coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), target_username),
            target_role,
            new.email,
            new.id,
            true,
            now(),
            now()
        )
        on conflict (username) do update
            set auth_user_id = excluded.auth_user_id,
                email        = coalesce(public.app_users.email, excluded.email),
                updated_at   = now();
    end if;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 4. Peran dalam Bahasa Indonesia untuk tampilan
-- -----------------------------------------------------------------------------

create or replace function public.role_label(role_key text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
    select case role_key
        when 'super_admin'                       then 'Administrator Utama Sistem'
        when 'media_intelligence_analyst'        then 'Analis Pemberitaan Strategis'
        when 'news_data_operator'                then 'Operator Akuisisi Data Berita'
        when 'field_verification_officer'        then 'Petugas Verifikasi Lapangan'
        when 'evaluation_recommendation_analyst' then 'Analis Evaluasi dan Rekomendasi'
        when 'executive_decision_maker'          then 'Pimpinan Pengambil Keputusan'
        else role_key
    end;
$$;

grant execute on function public.role_label(text) to authenticated;

commit;
