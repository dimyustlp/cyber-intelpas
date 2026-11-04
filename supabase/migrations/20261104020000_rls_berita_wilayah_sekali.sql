-- Dasbor setiap kanwil kosong, padahal beritanya ada.
--
-- Migrasi 20261103010000 mempercepat aturan baca berita untuk peran PUSAT saja:
-- pertanyaan "boleh melihat semua?" dijawab sekali per kueri. Peran kanwil dan
-- UPT sengaja dibiarkan jatuh ke can_access_berita(nama_upt, kanwil_asal) per
-- baris, dan fungsi itu membaca app_users dua sampai empat kali untuk SETIAP
-- baris. Diukur 4 November 2026 sebagai kanwil_jawatimur, satu halaman tarik
-- 500 baris (offset 2000) dari 33.452 berita:
--
--   sebelum   29,95 detik   (batas peran authenticated 8 detik → galat)
--   sesudah    0,20 detik
--
-- Akibatnya di layar: peramban menerima "statement timeout", muatBerita()
-- menangkapnya, keadaan.berita menjadi [] — dan dasbor kanwil tergambar rapi
-- tanpa satu berita pun. Basis datanya sendiri sudah benar: Jatim 2.838 baris,
-- Jabar 5.330, Papua Barat 52, semuanya ber-kanwil_asal yang tepat.
--
-- Perbaikannya: seluruh cakupan pengguna dihitung SEKALI sebagai InitPlan —
-- kanwilnya, dan daftar UPT yang boleh dibacanya — lalu tiap baris hanya
-- dibandingkan dengan dua nilai itu. Cakupannya tidak berubah sedikit pun:
-- diuji baris demi baris terhadap can_access_berita() untuk akun kanwil, akun
-- penelaah unit, peran lapangan pusat, dan super_admin; selisihnya 0 baris
-- pada keempatnya.
--
-- upt_terjangkau() menyalin dua cabang pertama can_access_upt(); cabang
-- ketiganya (peran pusat tanpa penugasan) sudah dijawab akses_berita_semua().
-- Kalau salah satu dari ketiga fungsi itu berubah, ketiganya harus ditinjau
-- bersama.

create or replace function public.upt_terjangkau()
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with saya as (
    select nullif(u.assigned_upt, '') as upt, nullif(u.assigned_kanwil, '') as kanwil
    from public.app_users u
    where u.auth_user_id = auth.uid()
      and u.aktif is true
      and u.deleted_at is null
    limit 1
  )
  select case
    when (select upt from saya) is not null then array[(select upt from saya)]
    when (select kanwil from saya) is not null then coalesce(
      (select array_agg(t.nama_upt) from public.upt t where t.kanwil = (select kanwil from saya)),
      '{}'::text[])
    else '{}'::text[]
  end;
$$;

revoke all on function public.upt_terjangkau() from public, anon;
grant execute on function public.upt_terjangkau() to authenticated;

comment on function public.upt_terjangkau() is
  'Daftar UPT yang boleh dibaca pengguna wilayah/unit. Dipanggil sebagai (select ...) di policy supaya dihitung sekali per kueri; padanan set dari can_access_upt().';

drop policy if exists berita_select_scoped on public.berita;
create policy berita_select_scoped on public.berita
  for select to authenticated
  using (
    deleted_at is null
    and (
      (select public.akses_berita_semua())
      or (kanwil_asal is not null and kanwil_asal = (select public.kanwil_saya()))
      or nama_upt = any (coalesce((select public.upt_terjangkau()), '{}'::text[]))
    )
  );

-- is_super_admin() tidak membaca kolom baris mana pun, tetapi tanpa (select …)
-- ia tetap dipanggil untuk setiap baris terhapus — dan cabang OR antar-policy
-- tidak dijamin berhenti lebih dulu. Ini saja menyumbang ±4 detik.
drop policy if exists berita_select_deleted_admin on public.berita;
create policy berita_select_deleted_admin on public.berita
  for select to authenticated
  using (deleted_at is not null and (select public.is_super_admin()));

drop policy if exists berita_attachments_select on public.berita_attachments;
create policy berita_attachments_select on public.berita_attachments
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.berita b
      where b.id::text = berita_attachments.berita_id
        and b.deleted_at is null
        and ((select public.akses_berita_semua())
             or b.nama_upt = any (coalesce((select public.upt_terjangkau()), '{}'::text[])))
    )
  );

drop policy if exists berita_status_history_select on public.berita_status_history;
create policy berita_status_history_select on public.berita_status_history
  for select to authenticated
  using (
    exists (
      select 1 from public.berita b
      where b.id::text = berita_status_history.berita_id
        and ((select public.akses_berita_semua())
             or b.nama_upt = any (coalesce((select public.upt_terjangkau()), '{}'::text[])))
    )
  );

-- Tabel besar khusus pusat (30 ribuan baris): has_role() dibungkus supaya
-- dijawab sekali, bukan sekali per baris. Daftar perannya tidak diubah.
drop policy if exists notifikasi_berita_baca on public.notifikasi_berita;
create policy notifikasi_berita_baca on public.notifikasi_berita
  for select to authenticated
  using ((select public.has_role('super_admin', 'media_intelligence_analyst', 'news_data_operator')));

drop policy if exists penjaring_alamat_baca on public.penjaring_alamat;
create policy penjaring_alamat_baca on public.penjaring_alamat
  for select to authenticated
  using ((select public.has_role('super_admin', 'media_intelligence_analyst', 'news_data_operator')));

drop policy if exists sheet_sync_log_select on public.sheet_sync_log;
create policy sheet_sync_log_select on public.sheet_sync_log
  for select to authenticated
  using ((select public.has_role('super_admin', 'media_intelligence_analyst', 'news_data_operator')));

drop policy if exists telegram_deliveries_select on public.telegram_deliveries;
create policy telegram_deliveries_select on public.telegram_deliveries
  for select to authenticated
  using ((select public.has_role('super_admin', 'media_intelligence_analyst')));

drop policy if exists penjaring_log_baca on public.penjaring_log;
create policy penjaring_log_baca on public.penjaring_log
  for select to authenticated
  using ((select public.has_role('super_admin', 'media_intelligence_analyst', 'news_data_operator')));
