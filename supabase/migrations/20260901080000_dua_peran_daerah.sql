-- =============================================================================
-- Trans-Siber PAS — Migrasi 14: Dua Peran Daerah
-- =============================================================================
-- Penyederhanaan yang diputuskan coach beberapa jam sesudah migrasi 13 digelar.
-- Peran daerah tinggal dua, dan pembagiannya kini menurut CAKUPAN, bukan
-- menurut jenis pekerjaan:
--
--   Administrator Kantor Wilayah  →  seluruh UPT di wilayahnya.
--                                    Memasukkan berita untuk tiap UPT,
--                                    menerbitkan akun penelaah UPT, menelaah,
--                                    dan membaca dasbor wilayah beserta seluruh
--                                    unit yang dibawahinya.
--
--   Penelaah Berita UPT           →  satu unit saja.
--                                    Menelaah berita unitnya, menuliskan
--                                    tanggapan resmi unit, dan membaca dasbor
--                                    unitnya sendiri.
--
-- Dua peran dihapus, dan keduanya lebur menjadi `upt_penelaah`:
--
--   `upt_petugas`     — dihapus atas permintaan coach.
--   `kanwil_penelaah` — penelaah bercakupan satu kantor wilayah. Tidak ada
--                       lagi; yang menelaah adalah unit yang bersangkutan,
--                       sebab unit itulah yang tahu keadaan sebenarnya.
--
-- Tidak ada satu pun akun yang terdampak: pada saat migrasi ini disusun,
-- `app_users` hanya memuat peran pusat dan satu `kanwil_admin`. Klausa
-- pemindahan di bawah tetap ditulis, sebab migrasi yang benar hanya ketika
-- tabelnya kebetulan kosong bukan migrasi, melainkan kebetulan.
--
-- PERINGATAN yang harus dibaca bila kelak dijalankan pada basis data yang sudah
-- berisi: sebuah akun `kanwil_penelaah` lama punya `assigned_kanwil` tetapi
-- TIDAK punya `assigned_upt`. Sesudah dipindahkan ke `upt_penelaah`, cakupannya
-- menyusut menjadi satu unit — dan selama `assigned_upt`-nya kosong, ia tidak
-- melihat satu baris pun. Blok pemberitahuan di bawah menyebutkan namanya satu
-- per satu supaya administrator tahu siapa yang harus segera ditetapkan
-- unitnya, bukan menemukannya dari laporan petugas yang layarnya kosong.
--
-- Sifat: idempoten. Aman dijalankan ulang.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Pindahkan akun berperan lama, lalu sebutkan yang menggantung
-- -----------------------------------------------------------------------------

do $$
declare
    menggantung text;
begin
    select string_agg(username, ', ' order by username)
      into menggantung
      from public.app_users
     where deleted_at is null
       and role in ('kanwil_penelaah', 'kanwil_penginput')
       and nullif(assigned_upt, '') is null;

    if menggantung is not null then
        raise notice 'Akun berikut menjadi Penelaah Berita UPT tetapi belum punya unit, '
                     'dan tidak akan melihat satu baris pun sampai unitnya ditetapkan: %',
                     menggantung;
    end if;
end $$;

update public.app_users
   set role = 'upt_penelaah', updated_at = now()
 where role in ('kanwil_penelaah', 'kanwil_penginput', 'upt_petugas');

-- -----------------------------------------------------------------------------
-- 2. Daftar peran — nama lama tidak lagi diterima
-- -----------------------------------------------------------------------------
-- Berbeda dari migrasi 13, kali ini nama lamanya benar-benar ditutup. Alasannya
-- berbalik: pada migrasi 13 nama lama masih mungkin dikirim halaman web yang
-- belum tergelar, sedangkan sekarang tidak ada satu pun akun yang memakainya
-- dan Edge Function `kelola-pengguna` sudah menerjemahkan ketiganya sebelum
-- menyentuh basis data. Membiarkan nama yang tidak berarti apa-apa di dalam
-- batasan hanya menunda pertanyaan "ini peran apa" ke orang berikutnya.

alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check check (role in (
    'super_admin',
    'media_intelligence_analyst',
    'news_data_operator',
    'field_verification_officer',
    'evaluation_recommendation_analyst',
    'executive_decision_maker',
    'kanwil_admin',
    'upt_penelaah'
));

/* Nama lama tetap dikenali oleh penamaan. Bukan untuk akun — tidak ada lagi
   yang memakainya — melainkan untuk baris `audit_log` yang sudah terlanjur
   mencatatnya: jejak audit yang membacanya sebagai kode mentah tidak bisa
   dibaca orang yang membukanya setahun kemudian. */
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
        when 'upt_penelaah'                      then 'Penelaah Berita UPT'
        -- Peran yang sudah tidak ada, disebut apa adanya supaya jejak lama terbaca.
        when 'upt_petugas'                       then 'Petugas Unit Pelaksana Teknis (dihapus)'
        when 'kanwil_penelaah'                   then 'Penelaah Berita Kantor Wilayah (dihapus)'
        when 'kanwil_penginput'                  then 'Penginput Berita Kantor Wilayah (dihapus)'
        else role_key
    end;
$$;

grant execute on function public.role_label(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Kelas peran
-- -----------------------------------------------------------------------------

create or replace function public.peran_wilayah()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.has_role('kanwil_admin', 'upt_penelaah');
$$;

create or replace function public.peran_upt()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select public.has_role('upt_penelaah');
$$;

/* Dibuang. Ia lahir pada migrasi 13 untuk menampung "siapa yang menelaah di
   luar pusat", lalu tidak pernah dipanggil satu kali pun — tidak oleh policy,
   tidak oleh fungsi lain. Fungsi SECURITY DEFINER yang tidak dipakai siapa pun
   tetap merupakan pintu; menyimpannya hanya menambah yang harus diperiksa
   ketika kelak ada yang menelusuri hak akses. */
drop function if exists public.peran_penelaah_wilayah();

revoke execute on function public.peran_wilayah() from anon, public;
revoke execute on function public.peran_upt()     from anon, public;
grant execute on function public.peran_wilayah()  to authenticated;
grant execute on function public.peran_upt()      to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Menelaah
-- -----------------------------------------------------------------------------

/* Kantor wilayah tetap boleh menelaah seluruh berita wilayahnya. Ia memang juga
   yang memasukkan berita, sehingga ia bisa memeriksa kirimannya sendiri — itu
   diketahui dan diterima: penelaah unit yang memeriksa lebih dulu, dan putusan
   keduanya tercatat dengan nama penelaahnya masing-masing. */
drop policy if exists berita_update_telaah_kanwil on public.berita;
create policy berita_update_telaah_kanwil on public.berita
    for update to authenticated
    using (
        public.has_role('kanwil_admin')
        and public.kanwil_saya() is not null
        and public.can_access_berita(nama_upt, kanwil_asal)
        and deleted_at is null
    )
    with check (
        public.can_access_berita(nama_upt, kanwil_asal)
    );

/* Penelaah unit menyentuh berita unitnya sendiri. Diikat ke `nama_upt`, bukan
   ke `can_access_berita`: berita kiriman kanwil yang unitnya belum dipetakan
   tidak boleh jatuh ke tangan satu unit hanya karena berasal dari wilayah yang
   sama. */
drop policy if exists berita_update_telaah_upt on public.berita;
create policy berita_update_telaah_upt on public.berita
    for update to authenticated
    using (
        public.has_role('upt_penelaah')
        and public.upt_saya() is not null
        and nama_upt = public.upt_saya()
        and deleted_at is null
    )
    with check (
        nama_upt = public.upt_saya()
    );

-- -----------------------------------------------------------------------------
-- 5. Admin kanwil mengelola akun penelaah di wilayahnya
-- -----------------------------------------------------------------------------
-- Hanya satu peran yang boleh ia terbitkan sekarang, jadi daftarnya tinggal satu.
-- WITH CHECK tetap menuntut hasil suntingannya tidak naik peran dan tidak
-- berpindah wilayah.

drop policy if exists app_users_kanwil_admin_update on public.app_users;
create policy app_users_kanwil_admin_update on public.app_users
    for update to authenticated
    using (
        public.has_role('kanwil_admin')
        and role = 'upt_penelaah'
        and assigned_kanwil is not null
        and assigned_kanwil = public.kanwil_saya()
        and deleted_at is null
    )
    with check (
        role = 'upt_penelaah'
        and assigned_kanwil = public.kanwil_saya()
    );

/*
   Catatan yang menjelaskan mengapa akun penelaah UPT tetap membawa
   `assigned_kanwil` meskipun cakupannya satu unit:

   Bukan untuk menentukan apa yang ia lihat — `kanwil_saya()` memang sengaja
   mengembalikan NULL begitu `assigned_upt` terisi, sehingga kolom itu tidak
   memberinya akses apa pun. Ia dibutuhkan policy SELECT di atas, yang
   menentukan admin kanwil mana yang boleh melihat dan mengelola akun itu.
   Tanpa `assigned_kanwil`, sebuah akun penelaah menjadi yatim: tidak seorang
   admin kanwil pun dapat menemukannya, sekalipun unitnya jelas berada di
   wilayahnya.
*/

commit;
