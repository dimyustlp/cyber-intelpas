-- =============================================================================
-- Cyber-Intelpas — Migrasi 06: Cakupan Wilayah
-- =============================================================================
-- Prasyarat sebelum satu pun akun kantor wilayah diterbitkan.
--
-- Fungsi `can_access_upt()` pada migrasi 01 berbunyi: bila `assigned_upt`
-- kosong, izinkan semuanya. Aturan itu masuk akal ketika satu-satunya pengguna
-- tanpa penugasan adalah petugas pusat. Begitu akun kanwil dibuat — dan mereka
-- memang ditugaskan per wilayah, bukan per unit — klausa yang sama memberi
-- mereka seluruh arsip nasional, termasuk berita yang tidak pernah menyangkut
-- wilayahnya.
--
-- Migrasi ini membalik urutannya: tolak lebih dulu, lalu izinkan menurut kelas
-- peran. Peran pusat tetap melihat seluruhnya seperti sebelumnya, sehingga tidak
-- ada satu pun pengguna yang sedang bekerja kehilangan aksesnya hari ini.
--
-- Sifat: idempoten. Aman dijalankan ulang.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Dua peran wilayah
-- -----------------------------------------------------------------------------
-- Dipisahkan menjadi dua, bukan satu, karena pekerjaannya memang dua: yang
-- memasukkan berita, dan yang memeriksa kiriman itu sebelum naik ke pusat.
-- Menggabungkannya berarti pemeriksa memeriksa pekerjaannya sendiri.

alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check check (role in (
    'super_admin',
    'media_intelligence_analyst',
    'news_data_operator',
    'field_verification_officer',
    'evaluation_recommendation_analyst',
    'executive_decision_maker',
    'kanwil_admin',
    'kanwil_penginput'
));

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
        when 'kanwil_admin'                      then 'Administrator Kantor Wilayah'
        when 'kanwil_penginput'                  then 'Penginput Berita Kantor Wilayah'
        else role_key
    end;
$$;

grant execute on function public.role_label(text) to authenticated;

/* Peran pusat, disebut sekali supaya tidak tersebar sebagai daftar panjang di
   dalam tiap policy — dan supaya menambah peran pusat kelak tidak menuntut
   penyuntingan sepuluh tempat. */
create or replace function public.peran_pusat()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.has_role(
        'super_admin',
        'media_intelligence_analyst',
        'evaluation_recommendation_analyst',
        'executive_decision_maker',
        'news_data_operator',
        'field_verification_officer'
    );
$$;

create or replace function public.peran_wilayah()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.has_role('kanwil_admin', 'kanwil_penginput');
$$;

create or replace function public.kanwil_saya()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select nullif(u.assigned_kanwil, '')
    from public.app_users u
    where u.auth_user_id = auth.uid()
      and u.aktif is true
      and u.deleted_at is null
    limit 1;
$$;

revoke execute on function public.peran_pusat()   from anon, public;
revoke execute on function public.peran_wilayah() from anon, public;
revoke execute on function public.kanwil_saya()   from anon, public;
grant execute on function public.peran_pusat()    to authenticated;
grant execute on function public.peran_wilayah()  to authenticated;
grant execute on function public.kanwil_saya()    to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Cakupan unit — menolak lebih dulu
-- -----------------------------------------------------------------------------

create or replace function public.can_access_upt(target_upt text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with saya as (
        select u.role, nullif(u.assigned_upt, '') as upt, nullif(u.assigned_kanwil, '') as kanwil
        from public.app_users u
        where u.auth_user_id = auth.uid()
          and u.aktif is true
          and u.deleted_at is null
        limit 1
    )
    select case
        -- Tanpa profil aktif, tidak ada apa pun yang boleh dibaca.
        when not exists (select 1 from saya) then false

        -- Penugasan tegas selalu menang, apa pun perannya. Petugas yang
        -- ditugaskan ke satu unit memang sedang dibatasi ke unit itu.
        when (select upt from saya) is not null
            then (select upt from saya) = target_upt

        when (select kanwil from saya) is not null
            then exists (
                select 1 from public.upt t
                where t.nama_upt = target_upt
                  and t.kanwil = (select kanwil from saya)
            )

        -- Tanpa penugasan: peran pusat melihat seluruhnya, peran wilayah tidak
        -- melihat apa pun. Inilah kebalikan dari aturan lama, dan alasan
        -- migrasi ini ada.
        else (select role from saya) in (
            'super_admin',
            'media_intelligence_analyst',
            'evaluation_recommendation_analyst',
            'executive_decision_maker',
            'news_data_operator',
            'field_verification_officer'
        )
    end;
$$;

revoke execute on function public.can_access_upt(text) from anon, public;
grant execute on function public.can_access_upt(text) to authenticated;

/* Berita yang unitnya belum terpetakan tidak punya nama UPT untuk dicocokkan,
   sedangkan kiriman kanwil selalu membawa asal wilayahnya sendiri. Tanpa fungsi
   ini, petugas wilayah tidak akan pernah melihat kirimannya sendiri sampai
   analis pusat memetakan unitnya. */
create or replace function public.can_access_berita(target_upt text, target_kanwil text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.can_access_upt(target_upt)
        or (
            target_kanwil is not null
            and public.kanwil_saya() is not null
            and target_kanwil = public.kanwil_saya()
        );
$$;

revoke execute on function public.can_access_berita(text, text) from anon, public;
grant execute on function public.can_access_berita(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Policy berita yang ikut menghitung asal wilayah
-- -----------------------------------------------------------------------------

drop policy if exists berita_select_scoped on public.berita;
create policy berita_select_scoped on public.berita
    for select to authenticated
    using (
        deleted_at is null
        and public.can_access_berita(nama_upt, kanwil_asal)
    );

-- Penginput wilayah boleh menambah berita, tetapi hanya atas nama wilayahnya
-- sendiri dan hanya dengan menandai dirinya. Tanpa syarat kedua, satu akun
-- wilayah bisa menuliskan kiriman seolah-olah berasal dari wilayah lain.
drop policy if exists berita_insert_kanwil on public.berita;
create policy berita_insert_kanwil on public.berita
    for insert to authenticated
    with check (
        public.peran_wilayah()
        and kanwil_asal is not null
        and kanwil_asal = public.kanwil_saya()
        and created_by = public.current_username()
    );

-- Menyunting kiriman sendiri hanya selama belum disentuh analis pusat.
drop policy if exists berita_update_kanwil on public.berita;
create policy berita_update_kanwil on public.berita
    for update to authenticated
    using (
        public.peran_wilayah()
        and kanwil_asal is not null
        and kanwil_asal = public.kanwil_saya()
        and (
            public.has_role('kanwil_admin')
            or created_by = public.current_username()
        )
        and coalesce(status_verifikasi, 'Belum Ditelaah') = 'Belum Ditelaah'
        and deleted_at is null
    )
    with check (
        kanwil_asal = public.kanwil_saya()
        and coalesce(status_verifikasi, 'Belum Ditelaah') = 'Belum Ditelaah'
    );

commit;
