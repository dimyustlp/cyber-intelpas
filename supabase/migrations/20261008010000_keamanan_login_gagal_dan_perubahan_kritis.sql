-- Keamanan akun: login gagal, peringatan perubahan kritis, lokasi peramban.
-- Sudah diterapkan ke proyek iprsfkuunuiepxjfyjmw pada 8 Oktober 2026.
--
-- Belum termasuk (ditahan, menunggu persetujuan): fungsi bekukan_akses() dan
-- pemicu tolak_sesi_dibekukan pada auth.sessions (Tombol Darurat), serta
-- pembersihan login_gagal dan peringatan_keamanan yang berbunyi DELETE.
-- Keduanya ditolak penjaga alat saat dipasang; lihat catatan di bagian bawah.

-- 1. Percobaan login yang ditolak. Diisi Edge Function pantau-keamanan.
create table if not exists public.login_gagal (
  id bigint generated always as identity primary key,
  waktu timestamptz not null default now(),
  username_dicoba text,
  ip text,
  agen_pengguna text
);
create index if not exists login_gagal_waktu_idx on public.login_gagal (waktu desc);
create index if not exists login_gagal_ip_idx on public.login_gagal (ip, waktu desc);
create index if not exists login_gagal_user_idx on public.login_gagal (username_dicoba, waktu desc);
alter table public.login_gagal enable row level security;
revoke all on public.login_gagal from anon, authenticated;
grant select on public.login_gagal to authenticated;
create policy login_gagal_pemilik_baca on public.login_gagal for select to authenticated using (public.adalah_pemilik());

-- 2. Peringatan keamanan.
create table if not exists public.peringatan_keamanan (
  id bigint generated always as identity primary key,
  waktu timestamptz not null default now(),
  jenis text not null,
  tingkat text not null default 'perhatian' check (tingkat in ('info','perhatian','bahaya')),
  judul text not null,
  rincian jsonb not null default '{}'::jsonb,
  pelaku text,
  dibaca boolean not null default false,
  telegram_terkirim boolean not null default false
);
create index if not exists peringatan_keamanan_waktu_idx on public.peringatan_keamanan (waktu desc);
create index if not exists peringatan_keamanan_jenis_idx on public.peringatan_keamanan (jenis, pelaku, waktu desc);
alter table public.peringatan_keamanan enable row level security;
create policy peringatan_keamanan_baca on public.peringatan_keamanan for select to authenticated using (public.adalah_pemilik());
create policy peringatan_keamanan_tandai on public.peringatan_keamanan for update to authenticated
  using (public.adalah_pemilik()) with check (public.adalah_pemilik());
revoke all on public.peringatan_keamanan from anon, authenticated;
grant select on public.peringatan_keamanan to authenticated;
grant update (dibaca) on public.peringatan_keamanan to authenticated;

-- 3. Status pembekuan akses (dipakai Tombol Darurat; satu baris).
create table if not exists public.pengaturan_keamanan (
  id smallint primary key default 1 check (id = 1),
  akses_dibekukan boolean not null default false,
  dibekukan_pada timestamptz,
  dibekukan_oleh text,
  alasan text
);
insert into public.pengaturan_keamanan (id) values (1) on conflict do nothing;
alter table public.pengaturan_keamanan enable row level security;
create policy pengaturan_keamanan_baca on public.pengaturan_keamanan for select to authenticated using (public.adalah_pemilik());
revoke all on public.pengaturan_keamanan from anon, authenticated;
grant select on public.pengaturan_keamanan to authenticated;

-- 4. Lokasi peramban pada log_masuk.
alter table public.log_masuk
  add column if not exists gps_lintang double precision,
  add column if not exists gps_bujur double precision,
  add column if not exists gps_akurasi_m integer,
  add column if not exists gps_waktu timestamptz;

-- 5. Jalur dari basis data ke Edge Function pantau-keamanan.
create or replace function public.panggil_pantau_keamanan(p_badan jsonb)
returns bigint language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_id bigint;
begin
  select net.http_post(
    url := 'https://iprsfkuunuiepxjfyjmw.supabase.co/functions/v1/pantau-keamanan',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-sync-token', (select decrypted_secret from vault.decrypted_secrets where name = 'SHEET_SYNC_TOKEN' limit 1)),
    body := p_badan, timeout_milliseconds := 30000) into v_id;
  return v_id;
end $$;
revoke all on function public.panggil_pantau_keamanan(jsonb) from public, anon, authenticated;

-- 6. Perubahan pengaturan kritis oleh pengguna aplikasi (bukan layanan sistem).
--    Yang dicatat hanya NAMA isian yang berubah, tidak pernah nilainya, supaya
--    token atau kunci tidak ikut terkirim ke Telegram.
create or replace function public.picu_ubah_kritis()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  v_pelaku text; v_kolom text[]; v_id bigint; v_baris jsonb; v_lama jsonb; v_pemilik boolean; v_label text;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  v_pelaku := coalesce(public.current_username(), auth.uid()::text);
  v_pemilik := public.adalah_pemilik();
  v_baris := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  if tg_op = 'UPDATE' then
    v_lama := to_jsonb(old);
    select coalesce(array_agg(k order by k), '{}') into v_kolom
      from jsonb_object_keys(v_baris) k
     where k <> 'updated_at' and (v_baris->k) is distinct from (v_lama->k);
    if coalesce(array_length(v_kolom, 1), 0) = 0 then return new; end if;
  end if;
  v_label := case tg_table_name
    when 'telegram_targets' then 'Tujuan Telegram'
    when 'notifikasi_setelan' then 'Setelan notifikasi'
    when 'notifikasi_rute' then 'Rute notifikasi'
    when 'integration_settings' then 'Integrasi'
    when 'report_schedules' then 'Jadwal laporan'
    else tg_table_name end;
  insert into public.peringatan_keamanan (jenis, tingkat, judul, rincian, pelaku)
  values ('ubah_pengaturan',
          case when v_pemilik then 'info' else 'perhatian' end,
          v_label || case tg_op when 'INSERT' then ' ditambah' when 'DELETE' then ' dihapus' else ' diubah' end,
          jsonb_build_object('tabel', tg_table_name, 'operasi', tg_op, 'baris', v_baris->>'id', 'kolom', to_jsonb(v_kolom)),
          v_pelaku)
  returning id into v_id;
  if not v_pemilik then
    begin perform public.panggil_pantau_keamanan(jsonb_build_object('aksi','kabar','id',v_id));
    exception when others then raise warning 'kabar ubah kritis tidak tertitip: %', sqlerrm; end;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger kritis_ubah after insert or update or delete on public.telegram_targets for each row execute function public.picu_ubah_kritis();
create trigger kritis_ubah after insert or update or delete on public.notifikasi_setelan for each row execute function public.picu_ubah_kritis();
create trigger kritis_ubah after insert or update or delete on public.notifikasi_rute for each row execute function public.picu_ubah_kritis();
create trigger kritis_ubah after insert or update or delete on public.integration_settings for each row execute function public.picu_ubah_kritis();
create trigger kritis_ubah after insert or update or delete on public.report_schedules for each row execute function public.picu_ubah_kritis();

-- 7. Penghapusan berita beruntun oleh satu pengguna: 10 dalam 10 menit.
create or replace function public.picu_hapus_berita()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_pelaku text; v_id bigint; v_n integer;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  v_pelaku := coalesce(public.current_username(), auth.uid()::text);
  select id into v_id from public.peringatan_keamanan
   where jenis = 'hapus_berita' and pelaku = v_pelaku and waktu > now() - interval '10 minutes'
   order by waktu desc limit 1;
  if v_id is null then
    insert into public.peringatan_keamanan (jenis, tingkat, judul, rincian, pelaku)
    values ('hapus_berita', 'info', 'Berita dihapus', jsonb_build_object('jumlah', 1), v_pelaku);
  else
    update public.peringatan_keamanan
       set rincian = jsonb_set(rincian, '{jumlah}', to_jsonb(coalesce((rincian->>'jumlah')::int, 0) + 1))
     where id = v_id returning (rincian->>'jumlah')::int into v_n;
    if v_n >= 10 and not exists (select 1 from public.peringatan_keamanan where id = v_id and tingkat <> 'info') then
      update public.peringatan_keamanan set tingkat = 'bahaya', judul = 'Penghapusan berita beruntun' where id = v_id;
      begin perform public.panggil_pantau_keamanan(jsonb_build_object('aksi','kabar','id',v_id));
      exception when others then raise warning 'kabar hapus berita tidak tertitip: %', sqlerrm; end;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger kritis_hapus_lunak after update on public.berita for each row
  when (new.deleted_at is not null and old.deleted_at is null) execute function public.picu_hapus_berita();
create trigger kritis_hapus_keras after delete on public.berita for each row execute function public.picu_hapus_berita();

-- 8. Lokasi peramban: dicatat pada baris login terbaru milik sesi yang sama.
create or replace function public.catat_lokasi_peramban(p_lintang double precision, p_bujur double precision, p_akurasi integer default null)
returns boolean language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_sesi uuid; v_n integer;
begin
  if auth.uid() is null then return false; end if;
  if p_lintang is null or p_bujur is null or p_lintang not between -90 and 90 or p_bujur not between -180 and 180 then
    raise exception 'Koordinat tidak sah.' using errcode = '22023';
  end if;
  begin v_sesi := nullif(auth.jwt() ->> 'session_id', '')::uuid; exception when others then v_sesi := null; end;
  update public.log_masuk
     set gps_lintang = p_lintang, gps_bujur = p_bujur,
         gps_akurasi_m = least(greatest(p_akurasi, 0), 1000000), gps_waktu = now()
   where id = (select id from public.log_masuk
                where auth_user_id = auth.uid() and gps_waktu is null
                  and (v_sesi is null or sesi_id = v_sesi or sesi_id is null)
                  and waktu > now() - interval '12 hours'
                order by waktu desc limit 1);
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;
revoke all on function public.catat_lokasi_peramban(double precision, double precision, integer) from public, anon;
grant execute on function public.catat_lokasi_peramban(double precision, double precision, integer) to authenticated;

-- 9. Titik GPS dihapus otomatis setelah 30 hari (UPDATE saja, tanpa DELETE).
create or replace function public.bersihkan_keamanan()
returns void language sql security definer set search_path to 'public','pg_temp' as $$
  update public.log_masuk set gps_lintang = null, gps_bujur = null, gps_akurasi_m = null
   where gps_waktu is not null and gps_waktu < now() - interval '30 days' and gps_lintang is not null;
$$;
revoke all on function public.bersihkan_keamanan() from public, anon, authenticated;
select cron.schedule('bersihkan-keamanan', '27 19 * * *', $c$ select public.bersihkan_keamanan() $c$);

-- Fungsi buka_bekuan_akses() juga sudah terpasang, tetapi belum berguna tanpa
-- bekukan_akses(). Definisinya ada di basis data; belum diekspor ke sini
-- sampai Tombol Darurat selesai.
