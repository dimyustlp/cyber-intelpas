-- =============================================================================
-- Trans-Siber PAS — Migrasi 13: Peran UPT, Telaah Wilayah, dan Tanggapan Unit
-- =============================================================================
-- Tiga perubahan tata kerja yang diputuskan 1 September 2026, dituliskan dalam
-- satu transaksi karena ketiganya saling menuntut.
--
-- 1. Memasukkan berita menjadi wewenang Administrator Kantor Wilayah seorang
--    diri. Peran `kanwil_penginput` kehilangan hak itu dan berganti pekerjaan
--    menjadi penelaah: membaca berita wilayahnya dan memvalidasi atau merevisi
--    penilaian mesin. Namanya ikut berganti menjadi `kanwil_penelaah`, sebab
--    peran yang bernama "penginput" tetapi tidak boleh menginput adalah jebakan
--    bagi administrator berikutnya yang menerbitkan akun.
--
-- 2. Peran baru `upt_petugas` — petugas satu unit pelaksana teknis. Ia melihat
--    berita unitnya sendiri saja, menelaahnya, dan menuliskan tanggapan resmi
--    unit atas berita yang menyangkut unitnya.
--
-- 3. Telaah wilayah/unit disimpan pada kolomnya sendiri, BUKAN pada
--    `status_verifikasi`. Alasannya bukan kerapian melainkan wewenang:
--    `status_verifikasi` adalah putusan analis pusat yang menentukan sebuah
--    berita ikut dihitung atau tidak. Bila petugas unit boleh mengisinya, satu
--    unit dapat menyatakan berita tentang dirinya sendiri "Tidak Valid" dan
--    berita itu lenyap dari angka nasional tanpa seorang analis pun membacanya.
--    Maka putusan wilayah punya kolom sendiri, dan keduanya terbaca berdampingan.
--
-- Yang TIDAK diubah migrasi ini: kemampuan peran wilayah merevisi penilaian
-- mesin — sentimen, urgensi, kategori. Justru unit yang bersangkutan yang paling
-- tahu apakah sebuah kabar benar menyangkut unitnya, dan revisi itu tercatat
-- lengkap dengan alasannya.
--
-- Sifat: idempoten. Aman dijalankan ulang.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Daftar peran
-- -----------------------------------------------------------------------------
-- `kanwil_penginput` sengaja masih diterima oleh batasan di bawah meskipun
-- seluruh barisnya dipindahkan. Penggelaran tidak pernah serentak: Edge
-- Function, berkas web, dan basis data berpindah pada menit yang berbeda, dan
-- selama beberapa menit itu masih mungkin ada permintaan yang menyebut nama
-- lama. Membiarkannya diterima membuat permintaan itu berhasil; menolaknya
-- hanya menghasilkan galat yang tidak dipahami siapa pun.

alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check check (role in (
    'super_admin',
    'media_intelligence_analyst',
    'news_data_operator',
    'field_verification_officer',
    'evaluation_recommendation_analyst',
    'executive_decision_maker',
    'kanwil_admin',
    'kanwil_penelaah',
    'kanwil_penginput',   -- nama lama, diterima selama masa peralihan
    'upt_petugas'
));

update public.app_users
   set role = 'kanwil_penelaah', updated_at = now()
 where role = 'kanwil_penginput';

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
        when 'kanwil_penelaah'                   then 'Penelaah Berita Kantor Wilayah'
        when 'kanwil_penginput'                  then 'Penelaah Berita Kantor Wilayah'
        when 'upt_petugas'                       then 'Petugas Unit Pelaksana Teknis'
        else role_key
    end;
$$;

grant execute on function public.role_label(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Kelas peran
-- -----------------------------------------------------------------------------

create or replace function public.peran_wilayah()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.has_role('kanwil_admin', 'kanwil_penelaah', 'kanwil_penginput', 'upt_petugas');
$$;

/* Petugas satu unit. Dipisahkan dari peran kantor wilayah karena cakupannya
   berbeda sama sekali: kantor wilayah melihat puluhan unit, petugas unit
   melihat satu. */
create or replace function public.peran_upt()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.has_role('upt_petugas');
$$;

/* Siapa yang boleh menelaah di luar pusat: kantor wilayah dan unit. */
create or replace function public.peran_penelaah_wilayah()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.has_role('kanwil_admin', 'kanwil_penelaah', 'kanwil_penginput', 'upt_petugas');
$$;

create or replace function public.upt_saya()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select nullif(u.assigned_upt, '')
    from public.app_users u
    where u.auth_user_id = auth.uid()
      and u.aktif is true
      and u.deleted_at is null
    limit 1;
$$;

/*
   Perbaikan penting pada `kanwil_saya()`.

   Sampai sekarang fungsi ini mengembalikan `assigned_kanwil` apa adanya. Bagi
   petugas unit, kolom itu memang terisi — unitnya berada di bawah sebuah kantor
   wilayah — dan `can_access_berita` memakainya sebagai jalan kedua:
   "atau kanwil beritanya sama dengan kanwil saya". Akibatnya petugas Lapas
   Kediri akan membaca seluruh berita Jawa Timur, tepat kebalikan dari yang
   diminta.

   Karena itu penugasan unit menang: siapa pun yang ditugaskan ke satu unit
   tidak punya cakupan kantor wilayah, sekalipun kolomnya terisi.
*/
create or replace function public.kanwil_saya()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select case
        when nullif(u.assigned_upt, '') is not null then null
        else nullif(u.assigned_kanwil, '')
    end
    from public.app_users u
    where u.auth_user_id = auth.uid()
      and u.aktif is true
      and u.deleted_at is null
    limit 1;
$$;

revoke execute on function public.peran_wilayah()           from anon, public;
revoke execute on function public.peran_upt()               from anon, public;
revoke execute on function public.peran_penelaah_wilayah()  from anon, public;
revoke execute on function public.upt_saya()                from anon, public;
revoke execute on function public.kanwil_saya()             from anon, public;
grant execute on function public.peran_wilayah()            to authenticated;
grant execute on function public.peran_upt()                to authenticated;
grant execute on function public.peran_penelaah_wilayah()   to authenticated;
grant execute on function public.upt_saya()                 to authenticated;
grant execute on function public.kanwil_saya()              to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Kolom telaah wilayah dan tanggapan unit
-- -----------------------------------------------------------------------------

alter table public.berita
    add column if not exists telaah_wilayah_status  text,
    add column if not exists telaah_wilayah_catatan text,
    add column if not exists telaah_wilayah_oleh    text,
    add column if not exists telaah_wilayah_pada    timestamptz,
    add column if not exists tanggapan_upt          text,
    add column if not exists tanggapan_sikap        text,
    add column if not exists tanggapan_oleh         text,
    add column if not exists tanggapan_pada         timestamptz;

alter table public.berita drop constraint if exists berita_telaah_wilayah_status_check;
alter table public.berita add constraint berita_telaah_wilayah_status_check
    check (telaah_wilayah_status is null or telaah_wilayah_status in (
        'Belum Ditelaah',
        'Sesuai',           -- penilaian mesin dibenarkan penelaah wilayah/unit
        'Direvisi',         -- penilaian mesin diperbaiki, alasannya wajib
        'Bukan Unit Kami',  -- berita tidak menyangkut unit/wilayah ini
        'Perlu Perhatian'   -- benar, dan menuntut tindakan di luar telaah
    ));

/* Sikap resmi unit atas berita yang menyangkutnya. Empat nilai, bukan teks
   bebas: dasbor pimpinan harus bisa menghitung berapa berita negatif yang sudah
   dibantah dan berapa yang dibenarkan, dan kalimat bebas tidak bisa dihitung. */
alter table public.berita drop constraint if exists berita_tanggapan_sikap_check;
alter table public.berita add constraint berita_tanggapan_sikap_check
    check (tanggapan_sikap is null or tanggapan_sikap in (
        'Dibenarkan',
        'Sebagian Benar',
        'Tidak Benar',
        'Sudah Ditangani'
    ));

comment on column public.berita.telaah_wilayah_status is
    'Putusan penelaah kantor wilayah atau unit. Berdiri sendiri dari status_verifikasi, '
    'yang tetap menjadi wewenang analis pusat dan yang menentukan berita ikut dihitung.';
comment on column public.berita.tanggapan_upt is
    'Tanggapan resmi unit pelaksana teknis atas berita yang menyangkut unitnya.';

create index if not exists berita_telaah_wilayah_idx
    on public.berita (kanwil_asal, telaah_wilayah_status)
    where deleted_at is null;

-- -----------------------------------------------------------------------------
-- 4. Menulis berita — kini hanya Administrator Kantor Wilayah
-- -----------------------------------------------------------------------------
-- Peran wilayah lain kehilangan hak sisip. Yang mencabutnya policy ini, bukan
-- menu di peramban: menu yang disembunyikan tetap bisa dilewati oleh siapa pun
-- yang mengetik alamat halaman langsung.

drop policy if exists berita_insert_kanwil on public.berita;
create policy berita_insert_kanwil on public.berita
    for insert to authenticated
    with check (
        public.has_role('kanwil_admin')
        and kanwil_asal is not null
        and kanwil_asal = public.kanwil_saya()
        and created_by = public.current_username()
    );

-- Menyunting kiriman sendiri selama analis pusat belum menyentuhnya. Hanya
-- admin kanwil, sebab hanya ia yang bisa membuat kiriman.
drop policy if exists berita_update_kanwil on public.berita;
create policy berita_update_kanwil on public.berita
    for update to authenticated
    using (
        public.has_role('kanwil_admin')
        and kanwil_asal is not null
        and kanwil_asal = public.kanwil_saya()
        and coalesce(status_verifikasi, 'Belum Ditelaah') = 'Belum Ditelaah'
        and deleted_at is null
    )
    with check (
        kanwil_asal = public.kanwil_saya()
        and coalesce(status_verifikasi, 'Belum Ditelaah') = 'Belum Ditelaah'
    );

-- -----------------------------------------------------------------------------
-- 5. Menelaah — kantor wilayah dan unit
-- -----------------------------------------------------------------------------

/* Penelaah kantor wilayah menyentuh berita wilayahnya, apa pun statusnya di
   pusat. Berita yang sudah diverifikasi pusat pun masih boleh ditanggapi
   wilayah — putusan pusat tidak menutup mulut daerah, ia hanya menentukan
   angkanya. */
drop policy if exists berita_update_telaah_kanwil on public.berita;
create policy berita_update_telaah_kanwil on public.berita
    for update to authenticated
    using (
        public.has_role('kanwil_admin', 'kanwil_penelaah', 'kanwil_penginput')
        and public.kanwil_saya() is not null
        and public.can_access_berita(nama_upt, kanwil_asal)
        and deleted_at is null
    )
    with check (
        public.can_access_berita(nama_upt, kanwil_asal)
    );

/* Petugas unit menyentuh berita unitnya sendiri. Cakupannya sengaja diikat ke
   `nama_upt`, bukan ke `can_access_berita`: berita kiriman kanwil yang unitnya
   belum dipetakan tidak boleh jatuh ke tangan satu unit hanya karena berasal
   dari wilayah yang sama. */
drop policy if exists berita_update_telaah_upt on public.berita;
create policy berita_update_telaah_upt on public.berita
    for update to authenticated
    using (
        public.has_role('upt_petugas')
        and public.upt_saya() is not null
        and nama_upt = public.upt_saya()
        and deleted_at is null
    )
    with check (
        nama_upt = public.upt_saya()
    );

-- -----------------------------------------------------------------------------
-- 6. Pagar kolom
-- -----------------------------------------------------------------------------
-- Policy RLS bekerja per baris, bukan per kolom: begitu sebuah baris boleh
-- disunting, seluruh kolomnya boleh disunting. Padahal yang diberikan kepada
-- peran wilayah dan unit adalah wewenang menelaah, bukan wewenang menulis
-- ulang. Tanpa pemicu di bawah, seorang petugas unit dapat memindahkan berita
-- ke unit lain, mengaku sebagai pengirimnya, atau menyatakan berita tentang
-- unitnya sendiri "Tidak Valid" sehingga hilang dari angka nasional.
--
-- Ditegakkan di basis data, bukan di peramban, karena peramban hanya menyusun
-- permintaan — siapa pun yang membuka alat pengembang bisa menyusun yang lain.

create or replace function public.jaga_sunting_wilayah()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    -- Peran pusat tidak dibatasi pemicu ini; batasnya sudah pada policy.
    if public.peran_pusat() then
        return new;
    end if;

    if not public.peran_wilayah() then
        return new;
    end if;

    if new.id is distinct from old.id
       or new.kanwil_asal is distinct from old.kanwil_asal
       or new.created_by  is distinct from old.created_by
       or new.deleted_at  is distinct from old.deleted_at then
        raise exception 'Asal berita dan penandanya tidak dapat diubah dari ruang wilayah.'
            using errcode = '42501';
    end if;

    -- Putusan pusat tetap milik pusat.
    if new.status_verifikasi is distinct from old.status_verifikasi then
        raise exception 'Status verifikasi pusat hanya dapat diubah analis pusat. '
                        'Pakailah telaah wilayah untuk menyatakan putusan Anda.'
            using errcode = '42501';
    end if;

    if public.peran_upt() then
        -- Unit tidak boleh memindahkan berita ke unit lain, baik untuk menarik
        -- berita unit tetangga maupun untuk melepas berita tentang dirinya.
        if new.nama_upt is distinct from old.nama_upt then
            raise exception 'Petugas unit tidak dapat memindahkan berita ke unit lain.'
                using errcode = '42501';
        end if;
    else
        -- Tanggapan resmi unit hanya ditulis unit yang bersangkutan. Kantor
        -- wilayah membacanya; menuliskannya atas nama unit akan menjadikan
        -- tanggapan itu tidak berarti apa-apa.
        if new.tanggapan_upt   is distinct from old.tanggapan_upt
           or new.tanggapan_sikap is distinct from old.tanggapan_sikap
           or new.tanggapan_oleh  is distinct from old.tanggapan_oleh
           or new.tanggapan_pada  is distinct from old.tanggapan_pada then
            raise exception 'Tanggapan unit hanya dapat ditulis petugas unit yang bersangkutan.'
                using errcode = '42501';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists berita_jaga_sunting_wilayah on public.berita;
create trigger berita_jaga_sunting_wilayah
    before update on public.berita
    for each row execute function public.jaga_sunting_wilayah();

-- -----------------------------------------------------------------------------
-- 7. Admin kanwil melihat dan mengelola akun wilayahnya
-- -----------------------------------------------------------------------------
-- Sama seperti migrasi 08, hanya daftar perannya yang bertambah: kini admin
-- kanwil juga menerbitkan akun petugas unit di wilayahnya.

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
        and role in ('kanwil_penelaah', 'kanwil_penginput', 'upt_petugas')
        and assigned_kanwil is not null
        and assigned_kanwil = public.kanwil_saya()
        and deleted_at is null
    )
    with check (
        role in ('kanwil_penelaah', 'upt_petugas')
        and assigned_kanwil = public.kanwil_saya()
    );

commit;
