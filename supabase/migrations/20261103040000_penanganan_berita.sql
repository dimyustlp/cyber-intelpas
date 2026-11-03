-- ============================================================================
-- Penanganan berita: analisis kasus per kasus -> Klarifikasi UPT / Disposisi
-- ============================================================================
--
-- Permintaan user 3 November 2026 (untuk demonstrasi 4 November):
--
--   * Analis memilih satu berita negatif, menganalisanya, lalu hasilnya
--     langsung masuk Tindak Lanjut dengan tujuan yang jelas:
--       1. Klarifikasi UPT
--       2. Tindak lanjut disposisi pimpinan
--   * Peran pusat dan kanwil memegang keduanya; peran UPT hanya klarifikasi,
--     dan hanya untuk berita yang menyangkut unitnya.
--   * Kanwil yang MENERUSKAN berita kepada UPT; UPT mengunggah hasil
--     klarifikasinya (docx/pdf) dan WAJIB menyebut siapa pengirimnya.
--   * Pusat melihat seluruhnya, dikelompokkan per kanwil.
--   * Pemberitahuan otomatis: UPT sudah / belum menginput klarifikasi.
--
-- ## Alur status
--
--   klarifikasi_upt
--     menunggu_kanwil  dibuat pusat; kanwil belum meneruskan
--     menunggu_upt     diteruskan ke UPT (dibuat kanwil = langsung di sini)
--     klarifikasi_masuk  UPT sudah mengunggah berkas
--     perlu_perbaikan  kanwil/pusat mengembalikan ke UPT
--     diterima         selesai
--
--   disposisi_pimpinan
--     menunggu_disposisi  analisis menyatakan perlu putusan pimpinan
--     dalam_proses        disposisi sudah dicatat, sedang dikerjakan
--     selesai             hasil tindak lanjut sudah dilaporkan
--
-- Tabel ini TIDAK punya policy tulis. Seluruh perubahan lewat fungsi di bawah,
-- supaya urutan status tidak bisa dilompati dari peramban dan nama pelaku
-- diisi basis data, bukan klien.

create table if not exists public.penanganan_berita (
  id                  uuid primary key default gen_random_uuid(),
  berita_id           uuid not null references public.berita(id) on delete cascade,
  tujuan              text not null check (tujuan in ('klarifikasi_upt', 'disposisi_pimpinan')),
  status              text not null check (status in (
                        'menunggu_kanwil', 'menunggu_upt', 'klarifikasi_masuk', 'perlu_perbaikan', 'diterima',
                        'menunggu_disposisi', 'dalam_proses', 'selesai')),
  kanwil              text,
  nama_upt            text,
  analisis            jsonb not null default '{}'::jsonb,
  instruksi           text check (instruksi is null or char_length(instruksi) <= 2000),
  batas_waktu         timestamptz,
  dibuat_oleh         text,
  dibuat_peran        text,
  dibuat_pada         timestamptz not null default now(),
  diteruskan_oleh     text,
  diteruskan_pada     timestamptz,
  -- Klarifikasi dari UPT. Nama pengirim WAJIB (permintaan user).
  berkas_jalur        text,
  berkas_nama         text,
  pengirim_nama       text,
  pengirim_jabatan    text,
  ringkasan_klarifikasi text check (ringkasan_klarifikasi is null or char_length(ringkasan_klarifikasi) <= 2000),
  diunggah_oleh       text,
  diunggah_pada       timestamptz,
  -- Penilaian kanwil/pusat atas klarifikasi.
  catatan_penilaian   text check (catatan_penilaian is null or char_length(catatan_penilaian) <= 2000),
  dinilai_oleh        text,
  dinilai_pada        timestamptz,
  -- Disposisi pimpinan.
  pimpinan            text,
  isi_disposisi       text check (isi_disposisi is null or char_length(isi_disposisi) <= 2000),
  hasil_tindak        text check (hasil_tindak is null or char_length(hasil_tindak) <= 2000),
  diperbarui_oleh     text,
  diperbarui_pada     timestamptz not null default now(),
  unique (berita_id, tujuan)
);

create index if not exists penanganan_kanwil_idx on public.penanganan_berita (kanwil, status);
create index if not exists penanganan_upt_idx on public.penanganan_berita (nama_upt, status);

comment on table public.penanganan_berita is
  'Hasil analisis kasus per kasus yang diteruskan ke Klarifikasi UPT atau Disposisi Pimpinan. Ditulis hanya lewat fungsi penanganan_*.';

alter table public.penanganan_berita enable row level security;

/** Peran pusat yang menganalisis dan memantau seluruh kanwil. */
create or replace function public.peran_pusat_penanganan()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.has_role('super_admin', 'media_intelligence_analyst',
                         'evaluation_recommendation_analyst', 'executive_decision_maker');
$$;

drop policy if exists penanganan_baca on public.penanganan_berita;
create policy penanganan_baca on public.penanganan_berita
  for select to authenticated
  using (
    (select public.peran_pusat_penanganan())
    or ((select public.has_role('kanwil_admin')) and kanwil is not null and kanwil = (select public.kanwil_saya()))
    or ((select public.has_role('upt_penelaah')) and tujuan = 'klarifikasi_upt'
        and status <> 'menunggu_kanwil' and nama_upt = (select public.upt_saya()))
  );

revoke all on public.penanganan_berita from public, anon;
grant select on public.penanganan_berita to authenticated;
grant all on public.penanganan_berita to service_role;

-- ------------------------------------------------------------- pembantu

/** Kanwil sebuah berita: kanwil asal lembarnya, atau kanwil UPT-nya di data induk. */
create or replace function public.kanwil_berita(p_berita uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(nullif(b.kanwil_asal, ''), u.kanwil)
  from public.berita b left join public.upt u on u.nama_upt = b.nama_upt
  where b.id = p_berita;
$$;

/** Benar bila pemanggil boleh mengelola penanganan di kanwil ini. */
create or replace function public.boleh_kelola_kanwil(p_kanwil text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.peran_pusat_penanganan()
      or (public.has_role('kanwil_admin') and p_kanwil is not null and p_kanwil = public.kanwil_saya());
$$;

create or replace function public.penanganan_baris(p_id uuid)
returns public.penanganan_berita language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.penanganan_berita;
begin
  select * into r from public.penanganan_berita where id = p_id;
  if not found then raise exception 'Penanganan tidak ditemukan.' using errcode = 'P0002'; end if;
  return r;
end $$;

-- ------------------------------------------------------------------ buat

/**
 * Menyimpan hasil analisis satu berita dan menerbitkan tujuannya.
 *
 * Analisis yang diulang atas berita yang sama MEMPERBARUI baris yang ada,
 * bukan membuat kembaran: satu berita, satu klarifikasi, satu disposisi.
 * Klarifikasi yang dibuat kanwil langsung berstatus menunggu_upt (membuatnya
 * sama dengan meneruskannya); yang dibuat pusat menunggu kanwil meneruskan.
 */
create or replace function public.penanganan_buat(
  p_berita uuid,
  p_klarifikasi boolean,
  p_disposisi boolean,
  p_analisis jsonb,
  p_instruksi text default null,
  p_batas timestamptz default null,
  p_pimpinan text default null,
  p_isi_disposisi text default null
)
returns setof public.penanganan_berita
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_kanwil text := public.kanwil_berita(p_berita);
  v_upt text;
  v_saya text := coalesce(public.current_username(), 'sistem');
  v_peran text := public.current_role_name();
  v_kanwil_pembuat boolean := public.has_role('kanwil_admin');
  v_status text;
begin
  if not coalesce(p_klarifikasi, false) and not coalesce(p_disposisi, false) then
    raise exception 'Pilih paling sedikit satu tujuan: Klarifikasi UPT atau Disposisi Pimpinan.';
  end if;
  if not public.boleh_kelola_kanwil(v_kanwil) then
    raise exception 'Berita ini di luar wilayah Anda, atau peran Anda tidak berhak menganalisisnya.'
      using errcode = '42501';
  end if;

  select nullif(b.nama_upt, '') into v_upt from public.berita b where b.id = p_berita;

  if coalesce(p_klarifikasi, false) then
    if v_upt is null or lower(v_upt) in ('belum teridentifikasi', 'tidak diketahui') then
      raise exception 'Berita ini belum terpetakan ke UPT mana pun, jadi belum bisa dimintakan klarifikasi UPT. Petakan UPT-nya lebih dulu.';
    end if;
    v_status := case when v_kanwil_pembuat then 'menunggu_upt' else 'menunggu_kanwil' end;

    insert into public.penanganan_berita as p
      (berita_id, tujuan, status, kanwil, nama_upt, analisis, instruksi, batas_waktu,
       dibuat_oleh, dibuat_peran, diteruskan_oleh, diteruskan_pada, diperbarui_oleh)
    values
      (p_berita, 'klarifikasi_upt', v_status, v_kanwil, v_upt, coalesce(p_analisis, '{}'::jsonb),
       nullif(trim(p_instruksi), ''), coalesce(p_batas, now() + interval '2 days'),
       v_saya, v_peran,
       case when v_kanwil_pembuat then v_saya end, case when v_kanwil_pembuat then now() end, v_saya)
    on conflict (berita_id, tujuan) do update
      set analisis = excluded.analisis,
          instruksi = coalesce(excluded.instruksi, p.instruksi),
          batas_waktu = coalesce(p_batas, p.batas_waktu),
          diperbarui_oleh = v_saya, diperbarui_pada = now();
  end if;

  if coalesce(p_disposisi, false) then
    v_status := case when nullif(trim(p_isi_disposisi), '') is not null then 'dalam_proses' else 'menunggu_disposisi' end;
    insert into public.penanganan_berita as p
      (berita_id, tujuan, status, kanwil, nama_upt, analisis, batas_waktu, pimpinan, isi_disposisi,
       dibuat_oleh, dibuat_peran, diperbarui_oleh)
    values
      (p_berita, 'disposisi_pimpinan', v_status, v_kanwil, v_upt, coalesce(p_analisis, '{}'::jsonb),
       p_batas, nullif(trim(p_pimpinan), ''), nullif(trim(p_isi_disposisi), ''),
       v_saya, v_peran, v_saya)
    on conflict (berita_id, tujuan) do update
      set analisis = excluded.analisis,
          pimpinan = coalesce(excluded.pimpinan, p.pimpinan),
          isi_disposisi = coalesce(excluded.isi_disposisi, p.isi_disposisi),
          status = case when p.status = 'menunggu_disposisi' and excluded.isi_disposisi is not null
                        then 'dalam_proses' else p.status end,
          diperbarui_oleh = v_saya, diperbarui_pada = now();
  end if;

  insert into public.audit_log (actor_username, actor_role, action, entity, entity_id, metadata)
  values (v_saya, v_peran, 'penanganan_analisis', 'berita', p_berita::text,
          jsonb_build_object('klarifikasi', p_klarifikasi, 'disposisi', p_disposisi, 'kanwil', v_kanwil, 'upt', v_upt));

  return query select * from public.penanganan_berita where berita_id = p_berita order by tujuan;
end $$;

-- ------------------------------------------------------------- teruskan

create or replace function public.penanganan_teruskan(p_id uuid, p_instruksi text default null, p_batas timestamptz default null)
returns public.penanganan_berita
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.penanganan_berita := public.penanganan_baris(p_id);
        v_saya text := coalesce(public.current_username(), 'sistem');
begin
  if r.tujuan <> 'klarifikasi_upt' then raise exception 'Hanya klarifikasi UPT yang diteruskan.'; end if;
  if not public.boleh_kelola_kanwil(r.kanwil) then raise exception 'Bukan wilayah Anda.' using errcode = '42501'; end if;
  if r.status not in ('menunggu_kanwil') then
    raise exception 'Klarifikasi ini sudah diteruskan (status: %).', r.status;
  end if;
  update public.penanganan_berita
     set status = 'menunggu_upt', diteruskan_oleh = v_saya, diteruskan_pada = now(),
         instruksi = coalesce(nullif(trim(p_instruksi), ''), instruksi),
         batas_waktu = coalesce(p_batas, batas_waktu, now() + interval '2 days'),
         diperbarui_oleh = v_saya, diperbarui_pada = now()
   where id = p_id returning * into r;
  return r;
end $$;

-- ------------------------------------------------------ kirim klarifikasi

/**
 * UPT mengirim hasil klarifikasinya. Berkasnya sudah diunggah ke bucket
 * klarifikasi-upt; yang dicatat di sini jalurnya, nama berkasnya, dan SIAPA
 * pengirimnya (nama dan jabatan, diketik pengirim — bukan nama akun, sebab
 * satu akun UPT bisa dipakai bergantian).
 *
 * Admin kanwil boleh mengunggah atas nama UPT-nya; tandanya tetap tercatat
 * di diunggah_oleh.
 */
create or replace function public.penanganan_kirim_klarifikasi(
  p_id uuid, p_jalur text, p_nama_berkas text, p_pengirim text, p_jabatan text, p_ringkasan text default null
)
returns public.penanganan_berita
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.penanganan_berita := public.penanganan_baris(p_id);
        v_saya text := coalesce(public.current_username(), 'sistem');
begin
  if r.tujuan <> 'klarifikasi_upt' then raise exception 'Bukan permintaan klarifikasi.'; end if;
  if not ((public.has_role('upt_penelaah') and r.nama_upt = public.upt_saya())
          or (public.has_role('kanwil_admin') and r.kanwil = public.kanwil_saya())
          or public.has_role('super_admin')) then
    raise exception 'Klarifikasi ini bukan untuk unit Anda.' using errcode = '42501';
  end if;
  if r.status not in ('menunggu_upt', 'perlu_perbaikan') then
    raise exception 'Klarifikasi tidak sedang ditunggu (status: %).', r.status;
  end if;
  if char_length(trim(coalesce(p_pengirim, ''))) < 3 then
    raise exception 'Nama pengirim wajib diisi.';
  end if;
  if char_length(trim(coalesce(p_jabatan, ''))) < 2 then
    raise exception 'Jabatan pengirim wajib diisi.';
  end if;
  if coalesce(p_jalur, '') not like ('%/' || p_id::text || '/%') then
    raise exception 'Berkas klarifikasi belum terunggah untuk permintaan ini.';
  end if;
  if lower(coalesce(p_nama_berkas, '')) !~ '\.(pdf|docx)$' then
    raise exception 'Berkas klarifikasi harus PDF atau DOCX.';
  end if;

  update public.penanganan_berita
     set status = 'klarifikasi_masuk', berkas_jalur = p_jalur, berkas_nama = p_nama_berkas,
         pengirim_nama = trim(p_pengirim), pengirim_jabatan = trim(p_jabatan),
         ringkasan_klarifikasi = nullif(trim(p_ringkasan), ''),
         diunggah_oleh = v_saya, diunggah_pada = now(),
         diperbarui_oleh = v_saya, diperbarui_pada = now()
   where id = p_id returning * into r;
  return r;
end $$;

-- ------------------------------------------------------------------ nilai

create or replace function public.penanganan_nilai(p_id uuid, p_terima boolean, p_catatan text default null)
returns public.penanganan_berita
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.penanganan_berita := public.penanganan_baris(p_id);
        v_saya text := coalesce(public.current_username(), 'sistem');
begin
  if not public.boleh_kelola_kanwil(r.kanwil) then raise exception 'Bukan wilayah Anda.' using errcode = '42501'; end if;
  if r.status <> 'klarifikasi_masuk' then raise exception 'Belum ada klarifikasi untuk dinilai.'; end if;
  if not p_terima and char_length(trim(coalesce(p_catatan, ''))) < 5 then
    raise exception 'Tuliskan apa yang perlu diperbaiki UPT.';
  end if;
  update public.penanganan_berita
     set status = case when p_terima then 'diterima' else 'perlu_perbaikan' end,
         catatan_penilaian = nullif(trim(p_catatan), ''), dinilai_oleh = v_saya, dinilai_pada = now(),
         batas_waktu = case when p_terima then batas_waktu else greatest(coalesce(batas_waktu, now()), now() + interval '1 day') end,
         diperbarui_oleh = v_saya, diperbarui_pada = now()
   where id = p_id returning * into r;
  return r;
end $$;

-- --------------------------------------------------------------- disposisi

create or replace function public.penanganan_disposisi(
  p_id uuid, p_pimpinan text, p_isi text, p_batas timestamptz default null,
  p_hasil text default null, p_selesai boolean default false
)
returns public.penanganan_berita
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.penanganan_berita := public.penanganan_baris(p_id);
        v_saya text := coalesce(public.current_username(), 'sistem');
begin
  if r.tujuan <> 'disposisi_pimpinan' then raise exception 'Bukan disposisi pimpinan.'; end if;
  if not public.boleh_kelola_kanwil(r.kanwil) then raise exception 'Bukan wilayah Anda.' using errcode = '42501'; end if;
  if p_selesai and char_length(trim(coalesce(p_hasil, r.hasil_tindak, ''))) < 5 then
    raise exception 'Tuliskan hasil tindak lanjutnya sebelum menandai selesai.';
  end if;
  if char_length(trim(coalesce(p_isi, r.isi_disposisi, ''))) < 3 then
    raise exception 'Isi disposisi pimpinan wajib diisi.';
  end if;
  update public.penanganan_berita
     set pimpinan = coalesce(nullif(trim(p_pimpinan), ''), pimpinan),
         isi_disposisi = coalesce(nullif(trim(p_isi), ''), isi_disposisi),
         batas_waktu = coalesce(p_batas, batas_waktu),
         hasil_tindak = coalesce(nullif(trim(p_hasil), ''), hasil_tindak),
         status = case when p_selesai then 'selesai' else 'dalam_proses' end,
         diperbarui_oleh = v_saya, diperbarui_pada = now()
   where id = p_id returning * into r;
  return r;
end $$;

revoke all on function public.penanganan_buat(uuid, boolean, boolean, jsonb, text, timestamptz, text, text) from public, anon;
revoke all on function public.penanganan_teruskan(uuid, text, timestamptz) from public, anon;
revoke all on function public.penanganan_kirim_klarifikasi(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.penanganan_nilai(uuid, boolean, text) from public, anon;
revoke all on function public.penanganan_disposisi(uuid, text, text, timestamptz, text, boolean) from public, anon;
grant execute on function public.penanganan_buat(uuid, boolean, boolean, jsonb, text, timestamptz, text, text) to authenticated;
grant execute on function public.penanganan_teruskan(uuid, text, timestamptz) to authenticated;
grant execute on function public.penanganan_kirim_klarifikasi(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.penanganan_nilai(uuid, boolean, text) to authenticated;
grant execute on function public.penanganan_disposisi(uuid, text, text, timestamptz, text, boolean) to authenticated;
revoke all on function public.penanganan_baris(uuid) from public, anon, authenticated;
revoke all on function public.kanwil_berita(uuid) from public, anon;
grant execute on function public.kanwil_berita(uuid) to authenticated;

-- ------------------------------------------------------- berkas klarifikasi

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('klarifikasi-upt', 'klarifikasi-upt', false, 10485760,
        array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Jalur unggahan: <tahun>/<bulan>/<id penanganan>/<waktu>-<nama> (lib/api.js
-- unggahBerkas), jadi id penanganannya foldername ke-3.
drop policy if exists klarifikasi_upt_unggah on storage.objects;
create policy klarifikasi_upt_unggah on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'klarifikasi-upt'
    and exists (
      select 1 from public.penanganan_berita p
      where p.id::text = (storage.foldername(name))[3]
        and p.tujuan = 'klarifikasi_upt'
        and p.status in ('menunggu_upt', 'perlu_perbaikan')
        and ((public.has_role('upt_penelaah') and p.nama_upt = public.upt_saya())
             or (public.has_role('kanwil_admin') and p.kanwil = public.kanwil_saya())
             or public.has_role('super_admin'))
    )
  );

drop policy if exists klarifikasi_upt_baca on storage.objects;
create policy klarifikasi_upt_baca on storage.objects
  for select to authenticated
  using (
    bucket_id = 'klarifikasi-upt'
    and exists (select 1 from public.penanganan_berita p where p.id::text = (storage.foldername(name))[3])
  );

-- ---------------------------------------------------- pemberitahuan otomatis

/**
 * Antrean pesan Telegram penanganan. Diisi pemicu dan rekap terjadwal,
 * dikuras kirim_kabar_penanganan() dua menit sekali. Antrean, bukan kirim
 * langsung dari pemicu: pemicu yang menunggu Telegram akan menahan transaksi
 * UPT yang sedang mengunggah, dan Telegram yang lambat menjadi formulir yang
 * gagal disimpan.
 */
create table if not exists public.kabar_penanganan (
  id             bigserial primary key,
  penanganan_id  uuid references public.penanganan_berita(id) on delete cascade,
  kanwil         text,
  jenis          text not null,
  teks           text not null,
  ke_kanwil      boolean not null default true,
  ke_pusat       boolean not null default false,
  dibuat_pada    timestamptz not null default now(),
  dikirim_pada   timestamptz,
  hasil          text
);
create index if not exists kabar_penanganan_antre_idx on public.kabar_penanganan (dibuat_pada) where dikirim_pada is null;
alter table public.kabar_penanganan enable row level security;
revoke all on public.kabar_penanganan from public, anon, authenticated;
grant all on public.kabar_penanganan to service_role;

-- Grup kanwil bisa memakai bot sendiri: nama secret Edge Function-nya.
alter table public.notifikasi_rute add column if not exists bot_secret text
  check (bot_secret is null or bot_secret ~ '^TELEGRAM_BOT_TOKEN(_[A-Z0-9]+)?$');
comment on column public.notifikasi_rute.bot_secret is
  'Nama secret Edge Function berisi kunci bot untuk grup ini (mis. TELEGRAM_BOT_TOKEN_ACEH). Kosong = bot pusat.';

create or replace function public.esc_html(t text)
returns text language sql immutable as $$
  select replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
$$;

create or replace function public.jam_wib(t timestamptz)
returns text language sql stable as $$
  select to_char(t at time zone 'Asia/Jakarta', 'DD/MM/YYYY HH24.MI') || ' WIB';
$$;

/** Menyusun pesan untuk satu perubahan status. */
create or replace function public.kabar_penanganan_pemicu()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_judul text;
  v_teks text;
  v_jenis text;
  v_pusat boolean := false;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  select left(regexp_replace(coalesce(judul, ''), '\s+', ' ', 'g'), 160) into v_judul from public.berita where id = new.berita_id;

  if new.tujuan = 'klarifikasi_upt' then
    if new.status = 'menunggu_kanwil' then
      v_jenis := 'perlu_diteruskan';
      v_teks := format(E'📨 <b>Klarifikasi UPT perlu diteruskan</b>\nPusat meminta klarifikasi dari <b>%s</b>.\n%s\n\nMohon admin kanwil meneruskannya ke UPT lewat Trans-Siber PAS › Tindak Lanjut.',
        esc_html(new.nama_upt), esc_html(v_judul));
    elsif new.status = 'menunggu_upt' then
      v_jenis := 'diteruskan';
      v_teks := format(E'📌 <b>Permintaan klarifikasi ke %s</b>\n%s\nBatas: %s\n%s\nStatus: <b>BELUM</b> ada berkas klarifikasi.',
        esc_html(new.nama_upt), esc_html(v_judul), coalesce(jam_wib(new.batas_waktu), '-'),
        coalesce('Instruksi: ' || esc_html(new.instruksi), ''));
    elsif new.status = 'klarifikasi_masuk' then
      v_jenis := 'sudah';
      v_pusat := true;
      v_teks := format(E'✅ <b>%s SUDAH menginput klarifikasi</b>\n%s\nDikirim oleh: <b>%s</b> (%s)\nBerkas: %s\nWaktu: %s\n\nSilakan dinilai di Tindak Lanjut.',
        esc_html(new.nama_upt), esc_html(v_judul), esc_html(new.pengirim_nama), esc_html(new.pengirim_jabatan),
        esc_html(new.berkas_nama), jam_wib(new.diunggah_pada));
    elsif new.status = 'perlu_perbaikan' then
      v_jenis := 'perbaikan';
      v_teks := format(E'↩️ <b>Klarifikasi %s dikembalikan untuk diperbaiki</b>\n%s\nCatatan: %s\nBatas baru: %s',
        esc_html(new.nama_upt), esc_html(v_judul), esc_html(new.catatan_penilaian), coalesce(jam_wib(new.batas_waktu), '-'));
    elsif new.status = 'diterima' then
      v_jenis := 'diterima';
      v_teks := format(E'☑️ <b>Klarifikasi %s diterima</b>\n%s', esc_html(new.nama_upt), esc_html(v_judul));
    end if;
  else
    if new.status = 'menunggu_disposisi' then
      v_jenis := 'disposisi_baru'; v_pusat := true;
      v_teks := format(E'🗂️ <b>Berita menunggu disposisi pimpinan</b>\n%s\nUPT: %s', esc_html(v_judul), esc_html(coalesce(new.nama_upt, '-')));
    elsif new.status = 'dalam_proses' then
      v_jenis := 'disposisi_jalan';
      v_teks := format(E'🗂️ <b>Disposisi pimpinan dicatat</b>\n%s\nDari: %s\nIsi: %s\nBatas: %s',
        esc_html(v_judul), esc_html(coalesce(new.pimpinan, '-')), esc_html(new.isi_disposisi), coalesce(jam_wib(new.batas_waktu), '-'));
    elsif new.status = 'selesai' then
      v_jenis := 'disposisi_selesai'; v_pusat := true;
      v_teks := format(E'☑️ <b>Disposisi pimpinan selesai ditindaklanjuti</b>\n%s\nHasil: %s', esc_html(v_judul), esc_html(new.hasil_tindak));
    end if;
  end if;

  if v_teks is not null then
    insert into public.kabar_penanganan (penanganan_id, kanwil, jenis, teks, ke_pusat)
    values (new.id, new.kanwil, v_jenis, v_teks || E'\n\n<i>Trans-Siber PAS · ' || esc_html(coalesce(new.kanwil, 'tanpa kanwil')) || '</i>', v_pusat);
  end if;
  return new;
end $$;

drop trigger if exists penanganan_kabar on public.penanganan_berita;
create trigger penanganan_kabar
  after insert or update of status on public.penanganan_berita
  for each row execute function public.kabar_penanganan_pemicu();

/**
 * Rekap BELUM/SUDAH per kanwil — pengingat terjadwal.
 *
 * Satu pesan per kanwil yang masih punya klarifikasi tertunggak, berisi tiap
 * UPT yang BELUM menginput beserta umur permintaannya, dan yang SUDAH masuk
 * dalam 24 jam terakhir. Pusat menerima satu rekap per kanwil dalam satu
 * pesan. Kanwil tanpa tunggakan tidak dikirimi apa pun: pesan "nihil" setiap
 * hari adalah cara tercepat membuat grup dibisukan.
 */
create or replace function public.rekap_klarifikasi()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  k record;
  v_baris text;
  v_jumlah integer := 0;
  v_pusat text := '';
begin
  for k in
    select p.kanwil,
           count(*) filter (where p.status in ('menunggu_upt', 'perlu_perbaikan')) belum,
           count(*) filter (where p.status = 'menunggu_kanwil') belum_diteruskan,
           count(*) filter (where p.status = 'klarifikasi_masuk' or (p.status = 'diterima' and p.diunggah_pada > now() - interval '24 hours')) sudah,
           count(*) filter (where p.status in ('menunggu_upt', 'perlu_perbaikan') and p.batas_waktu < now()) lewat
    from public.penanganan_berita p
    where p.tujuan = 'klarifikasi_upt' and p.kanwil is not null
    group by p.kanwil
    having count(*) filter (where p.status in ('menunggu_upt', 'perlu_perbaikan', 'menunggu_kanwil')) > 0
  loop
    select string_agg(format('• %s — %s%s', esc_html(p.nama_upt),
             case when p.status = 'menunggu_kanwil' then 'belum diteruskan kanwil'
                  when p.status = 'perlu_perbaikan' then 'BELUM mengirim perbaikan'
                  else 'BELUM menginput' end,
             case when p.batas_waktu < now() then format(' (lewat batas %s hari)', greatest(1, extract(day from now() - p.batas_waktu)::int))
                  else format(' (batas %s)', jam_wib(p.batas_waktu)) end), E'\n' order by p.batas_waktu nulls last)
      into v_baris
      from public.penanganan_berita p
     where p.kanwil = k.kanwil and p.tujuan = 'klarifikasi_upt'
       and p.status in ('menunggu_upt', 'perlu_perbaikan', 'menunggu_kanwil');

    insert into public.kabar_penanganan (kanwil, jenis, teks, ke_kanwil, ke_pusat)
    values (k.kanwil, 'pengingat',
      format(E'⏰ <b>Pengingat klarifikasi UPT — %s</b>\nBelum menginput: <b>%s</b> · lewat batas: <b>%s</b> · sudah masuk 24 jam: <b>%s</b>\n\n%s\n\n<i>Trans-Siber PAS · %s</i>',
        esc_html(k.kanwil), k.belum + k.belum_diteruskan, k.lewat, k.sudah, v_baris, jam_wib(now())),
      true, false);
    v_jumlah := v_jumlah + 1;
    v_pusat := v_pusat || format(E'\n• %s — belum %s, lewat batas %s, sudah %s',
      esc_html(replace(k.kanwil, 'Kantor Wilayah Ditjenpas ', '')), k.belum + k.belum_diteruskan, k.lewat, k.sudah);
  end loop;

  if v_jumlah > 0 then
    insert into public.kabar_penanganan (kanwil, jenis, teks, ke_kanwil, ke_pusat)
    values (null, 'pengingat_pusat',
      format(E'⏰ <b>Rekap klarifikasi UPT per kanwil</b>%s\n\n<i>Trans-Siber PAS · %s</i>', v_pusat, jam_wib(now())),
      false, true);
  end if;
  return v_jumlah;
end $$;

/**
 * Menguras antrean: grup kanwil lewat notifikasi_rute (tingkat kanwil, aktif),
 * pusat lewat telegram-kirim tanpa chat_id (seluruh telegram_targets aktif).
 * Baris tanpa grup tujuan tetap ditandai terproses dengan alasannya — antrean
 * yang menahan pesan selamanya akan menenggelamkan pesan sesudahnya.
 */
create or replace function public.kirim_kabar_penanganan(p_batas integer default 20)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  m record;
  r record;
  v_token text := (select decrypted_secret from vault.decrypted_secrets where name = 'SHEET_SYNC_TOKEN' limit 1);
  v_url text := 'https://iprsfkuunuiepxjfyjmw.supabase.co/functions/v1/telegram-kirim';
  v_n integer;
  v_total integer := 0;
begin
  for m in select * from public.kabar_penanganan where dikirim_pada is null order by id limit p_batas for update skip locked loop
    v_n := 0;
    if m.ke_kanwil and m.kanwil is not null then
      for r in select distinct chat_id from public.notifikasi_rute
               where aktif and tingkat = 'kanwil' and kanwil = m.kanwil loop
        perform net.http_post(url := v_url,
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-token', v_token),
          body := jsonb_build_object('aksi', 'kirim', 'chat_id', r.chat_id, 'teks', m.teks,
                                     'jenis', 'kasus', 'pemicu', 'scheduled', 'oleh', 'penanganan'),
          timeout_milliseconds := 30000);
        v_n := v_n + 1;
      end loop;
    end if;
    if m.ke_pusat then
      perform net.http_post(url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-token', v_token),
        body := jsonb_build_object('aksi', 'kirim', 'teks', m.teks, 'jenis', 'kasus', 'pemicu', 'scheduled', 'oleh', 'penanganan'),
        timeout_milliseconds := 30000);
      v_n := v_n + 1;
    end if;
    update public.kabar_penanganan
       set dikirim_pada = now(),
           hasil = case when v_n = 0 then 'Tidak ada grup Telegram aktif untuk kanwil ini.' else format('Diteruskan ke %s tujuan.', v_n) end
     where id = m.id;
    v_total := v_total + 1;
  end loop;
  return v_total;
end $$;

revoke all on function public.rekap_klarifikasi() from public, anon, authenticated;
revoke all on function public.kirim_kabar_penanganan(integer) from public, anon, authenticated;

-- Dua menit sekali menguras antrean; pengingat 08.00 dan 14.00 WIB.
select cron.unschedule(jobid) from cron.job where jobname in ('kabar-penanganan', 'pengingat-klarifikasi-pagi', 'pengingat-klarifikasi-siang');
select cron.schedule('kabar-penanganan', '*/2 * * * *', 'select public.kirim_kabar_penanganan(20)');
select cron.schedule('pengingat-klarifikasi-pagi', '0 1 * * *', 'select public.rekap_klarifikasi()');
select cron.schedule('pengingat-klarifikasi-siang', '0 7 * * *', 'select public.rekap_klarifikasi()');

-- Grup Jatim sudah memakai bot sendiri sejak September; sebelum ini pilihannya
-- ditulis langsung di kode telegram-kirim menurut chat_id.
update public.notifikasi_rute set bot_secret = 'TELEGRAM_BOT_TOKEN_JATIM'
 where chat_id = '-5409449489' and bot_secret is null;

-- Halaman Integrasi (superadmin) menampilkan grup Telegram tiap kanwil.
-- Penulisannya tetap hanya lewat telegram-kirim (aksi daftarkan_rute).
alter table public.notifikasi_rute enable row level security;
drop policy if exists notifikasi_rute_baca_admin on public.notifikasi_rute;
create policy notifikasi_rute_baca_admin on public.notifikasi_rute
  for select to authenticated using ((select public.is_super_admin()));
grant select on public.notifikasi_rute to authenticated;
