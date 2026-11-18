-- ============================================================================
-- Lapor Langsung: Laporan Verifikasi Pemberitaan dari UPT
-- ============================================================================
--
-- Permintaan user 18 November 2026. UPT bisa memberi umpan balik atas temuan
-- Lapor Langsung dalam bentuk Berita Acara Verifikasi Isu (format yang sama
-- dengan Klarifikasi UPT, lib/laporan-klarifikasi.js), lewat dua jalan:
--
--   1. UPT melapor temuannya sendiri dan langsung melampirkan verifikasinya.
--      Kolom verifikasi ikut diisi saat INSERT; policy insert yang ada sudah
--      cukup (pelapor_user_id = auth.uid()).
--   2. Laporan dari kanwil/pusat yang menyebut sebuah UPT dijawab UPT itu
--      (atau kanwilnya) lewat fungsi lapor_kirim_verifikasi(). Pelapor dan
--      UPT tidak punya hak UPDATE langsung pada tabel; fungsi ini yang
--      menjaga siapa boleh mengisi dan isian minimum yang menentukan arti
--      verifikasi: hasil konfirmasi, fakta sebenarnya, tingkat isu.
-- ============================================================================

alter table public.lapor_langsung
  add column if not exists verifikasi jsonb,
  add column if not exists verifikasi_berkas jsonb not null default '[]'::jsonb,
  add column if not exists verifikasi_oleh text,
  add column if not exists verifikasi_nama text,
  add column if not exists verifikasi_jabatan text,
  add column if not exists verifikasi_pada timestamptz,
  add column if not exists verifikasi_drive_url text;

alter table public.lapor_langsung drop constraint if exists lapor_verifikasi_bentuk;
alter table public.lapor_langsung
  add constraint lapor_verifikasi_bentuk check (
    verifikasi is null
    or (jsonb_typeof(verifikasi) = 'object' and pg_column_size(verifikasi) <= 65536)
  );

create index if not exists lapor_langsung_upt_idx on public.lapor_langsung (nama_upt, created_at desc);

create or replace function public.lapor_kirim_verifikasi(
  p_id uuid,
  p_laporan jsonb,
  p_nama text,
  p_jabatan text default null,
  p_berkas jsonb default '[]'::jsonb,
  p_drive_url text default null
)
returns public.lapor_langsung
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.lapor_langsung;
begin
  select * into r from public.lapor_langsung where id = p_id for update;
  if not found then raise exception 'Laporan tidak ditemukan.'; end if;

  if not ((public.has_role('upt_penelaah') and r.nama_upt = public.upt_saya())
          or (public.has_role('kanwil_admin') and r.kanwil = public.kanwil_saya())
          or public.has_role('super_admin')) then
    raise exception 'Laporan ini bukan untuk unit Anda.' using errcode = '42501';
  end if;

  if p_laporan is null or jsonb_typeof(p_laporan) <> 'object' or pg_column_size(p_laporan) > 65536 then
    raise exception 'Isian laporan verifikasi tidak sah.';
  end if;
  if coalesce(p_laporan->>'hasil_konfirmasi', '') not in ('benar', 'sebagian_benar', 'tidak_benar') then
    raise exception 'Pilih hasil konfirmasi: benar, sebagian benar, atau tidak benar.';
  end if;
  if char_length(trim(coalesce(p_laporan->>'fakta', ''))) < 10 then
    raise exception 'Tuliskan fakta sebenarnya (paling sedikit 10 huruf).';
  end if;
  if coalesce(p_laporan->>'tingkat', '') not in ('rendah', 'sedang', 'tinggi', 'kritis') then
    raise exception 'Pilih tingkat isu: rendah, sedang, tinggi, atau kritis.';
  end if;
  if char_length(trim(coalesce(p_nama, ''))) < 3 then
    raise exception 'Nama pengirim wajib diisi.';
  end if;
  if p_berkas is not null and jsonb_typeof(p_berkas) <> 'array' then
    raise exception 'Daftar berkas tidak sah.';
  end if;

  update public.lapor_langsung set
    verifikasi = p_laporan,
    verifikasi_berkas = coalesce(p_berkas, '[]'::jsonb),
    verifikasi_oleh = coalesce(public.current_username(), 'sistem'),
    verifikasi_nama = trim(p_nama),
    verifikasi_jabatan = nullif(trim(coalesce(p_jabatan, '')), ''),
    verifikasi_pada = now(),
    verifikasi_drive_url = nullif(trim(coalesce(p_drive_url, '')), ''),
    status = 'diverifikasi_upt'
  where id = p_id
  returning * into r;

  return r;
end $$;

revoke all on function public.lapor_kirim_verifikasi(uuid, jsonb, text, text, jsonb, text) from public, anon;
grant execute on function public.lapor_kirim_verifikasi(uuid, jsonb, text, text, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
