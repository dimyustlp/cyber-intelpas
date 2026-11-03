-- ============================================================================
-- Keputusan tindak lanjut per berita (dibawa dari SI-RADAR INTEL, 3 November 2026)
-- ============================================================================
--
-- Mesin menyarankan, analis memutuskan. Saran (sidak / klarifikasi / verifikasi
-- / pantau) dihitung di peramban dari taksonomi dan sumber berita; tabel ini
-- hanya menyimpan KEPUTUSAN manusia atas saran itu, beserta hasil
-- verifikasinya. Tabelnya sengaja terpisah dari `berita`:
--
--   * `berita` punya pemicu penjaga wilayah dan 33 ribu baris; menambah kolom
--     keputusan di sana berarti setiap perubahan menyentuh tabel yang paling
--     dijaga, hanya untuk satu catatan kecil.
--   * Keputusan tindak lanjut adalah milik pusat. Kolom di `berita` akan ikut
--     terbaca oleh peran daerah lewat baris yang sama.
--
-- Satu baris per berita: keputusan terbaru menggantikan yang lama. Riwayatnya
-- tidak disimpan di sini; yang perlu dijejak (siapa, kapan) ada di dua kolom
-- terakhir, dan pemicunya yang mengisi — bukan klien — supaya nama pemutus
-- tidak bisa dipalsukan dari peramban.

create table if not exists public.rekomendasi_berita (
  berita_id        uuid primary key references public.berita(id) on delete cascade,
  tindakan         text not null
                   check (tindakan in ('sidak', 'klarifikasi', 'verifikasi', 'pantau')),
  hasil_verifikasi text
                   check (hasil_verifikasi in ('Sesuai Fakta', 'Sebagian Sesuai', 'Tidak Sesuai', 'Belum Dapat Dipastikan')),
  catatan          text check (catatan is null or char_length(catatan) <= 1000),
  diputuskan_oleh  text,
  diputuskan_pada  timestamptz not null default now()
);

comment on table public.rekomendasi_berita is
  'Keputusan analis atas saran tindak lanjut sebuah berita negatif. Saran mesin tidak disimpan; hanya keputusan manusia.';
comment on column public.rekomendasi_berita.tindakan is
  'sidak = tangani langsung; klarifikasi = cukup statement; verifikasi = periksa dulu ke unit; pantau = pantau dan arsipkan.';
comment on column public.rekomendasi_berita.hasil_verifikasi is
  'Apakah isi berita sesuai fakta setelah diperiksa. Tidak Sesuai/Sebagian Sesuai membawa ke klarifikasi; Sesuai Fakta ke tindakan langsung.';

-- Pemicu: pemutus dan waktunya diisi basis data, bukan klien.
create or replace function public.rekomendasi_berita_cap()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  new.diputuskan_oleh := coalesce(public.current_username(), new.diputuskan_oleh);
  new.diputuskan_pada := now();
  return new;
end
$fn$;

drop trigger if exists rekomendasi_berita_cap on public.rekomendasi_berita;
create trigger rekomendasi_berita_cap
  before insert or update on public.rekomendasi_berita
  for each row execute function public.rekomendasi_berita_cap();

alter table public.rekomendasi_berita enable row level security;

-- Membaca dan memutuskan: peran yang memang menelaah atau memutuskan kasus.
-- Operator puldata dan petugas lapangan tidak termasuk, dan peran daerah tidak
-- pernah melihat tabel ini.
drop policy if exists rekomendasi_berita_baca on public.rekomendasi_berita;
create policy rekomendasi_berita_baca on public.rekomendasi_berita
  for select to authenticated
  using (public.has_role('super_admin', 'media_intelligence_analyst',
                         'evaluation_recommendation_analyst', 'executive_decision_maker'));

drop policy if exists rekomendasi_berita_tulis on public.rekomendasi_berita;
create policy rekomendasi_berita_tulis on public.rekomendasi_berita
  for insert to authenticated
  with check (public.has_role('super_admin', 'media_intelligence_analyst',
                              'evaluation_recommendation_analyst', 'executive_decision_maker'));

drop policy if exists rekomendasi_berita_ubah on public.rekomendasi_berita;
create policy rekomendasi_berita_ubah on public.rekomendasi_berita
  for update to authenticated
  using (public.has_role('super_admin', 'media_intelligence_analyst',
                         'evaluation_recommendation_analyst', 'executive_decision_maker'))
  with check (public.has_role('super_admin', 'media_intelligence_analyst',
                              'evaluation_recommendation_analyst', 'executive_decision_maker'));

revoke all on public.rekomendasi_berita from public, anon;
grant select, insert, update on public.rekomendasi_berita to authenticated;
grant all on public.rekomendasi_berita to service_role;
