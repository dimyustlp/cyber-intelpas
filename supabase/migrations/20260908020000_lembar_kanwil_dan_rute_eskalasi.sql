-- ============================================================================
-- Pendaftaran lembar kanwil, dan model rute eskalasi menurut tier
-- ============================================================================

-- ------------------------------------------------- mendaftarkan lembar kanwil

/**
 * Mendaftarkan satu spreadsheet kanwil sebagai sumber.
 *
 * Dibuat sebagai fungsi, bukan INSERT yang disalin tiga puluh delapan kali,
 * karena `sumber_sheet` punya kolom yang mudah salah isi dan salahnya tidak
 * berbunyi: `csv_url` wajib ada, `sheet_nama` harus persis nama tab, dan
 * `kanwil` harus persis nama pada data induk `upt`. Satu huruf beda pada yang
 * terakhir membuat seluruh berita lembar itu tidak terpetakan — tanpa galat,
 * hanya sunyi.
 *
 * Nama kanwil karena itu DIPERIKSA di sini. Lebih baik pendaftaran ditolak
 * sekarang daripada seorang petugas menunggu berminggu-minggu menunggu berita
 * yang tidak akan pernah datang.
 */
create or replace function public.daftarkan_lembar_kanwil(
  p_kanwil text,
  p_sheet_id text,
  p_sheet_nama text default 'Berita'
)
returns public.sumber_sheet
language plpgsql
as $fn$
declare
  v_kode text;
  v_baris public.sumber_sheet;
begin
  if not exists (select 1 from public.upt where kanwil = p_kanwil) then
    raise exception
      'Kanwil "%" tidak ada pada data induk upt. Salin namanya persis, termasuk kata "Kantor Wilayah Ditjenpas".',
      p_kanwil;
  end if;

  if coalesce(p_sheet_id, '') = '' then
    raise exception 'ID spreadsheet kosong. Ambil dari alamatnya, bagian antara /d/ dan /edit.';
  end if;

  -- Kode dibuat dari nama kanwil, bukan diketik: kode yang diketik cepat atau
  -- lambat akan bertabrakan, dan `kode` dipakai sebagai penanda `created_by`
  -- pada tiap baris berita yang masuk lewat lembar itu.
  v_kode := 'kanwil-' || regexp_replace(
    lower(regexp_replace(p_kanwil, '^Kantor Wilayah Ditjenpas\s+', '', 'i')),
    '[^a-z0-9]+', '-', 'g');
  v_kode := trim(both '-' from v_kode);

  insert into public.sumber_sheet
    (kode, nama, lingkup, kanwil, sheet_id, sheet_nama, csv_url, aktif, urutan)
  values (
    v_kode,
    'Lembar Kanwil — ' || regexp_replace(p_kanwil, '^Kantor Wilayah Ditjenpas\s+', '', 'i'),
    'kanwil',
    p_kanwil,
    p_sheet_id,
    coalesce(nullif(p_sheet_nama, ''), 'Berita'),
    'https://docs.google.com/spreadsheets/d/' || p_sheet_id
      || '/gviz/tq?tqx=out:csv&sheet=' || replace(coalesce(nullif(p_sheet_nama,''),'Berita'), ' ', '%20'),
    true,
    200
  )
  on conflict (kode) do update set
    sheet_id = excluded.sheet_id,
    sheet_nama = excluded.sheet_nama,
    csv_url = excluded.csv_url,
    kanwil = excluded.kanwil,
    aktif = true,
    updated_at = now()
  returning * into v_baris;

  return v_baris;
end;
$fn$;

comment on function public.daftarkan_lembar_kanwil(text, text, text) is
  'Mendaftarkan spreadsheet kanwil ke sumber_sheet. Menolak nama kanwil yang tidak ada di data induk upt, sebab salah nama di sana tidak menimbulkan galat apa pun — hanya berita yang tidak pernah terpetakan.';

-- --------------------------------------------------------- rute eskalasi SOP

/**
 * Ke mana sebuah berita negatif dikirim, menurut tier medianya.
 *
 * Menerjemahkan matriks SOP Buku Panduan Emas:
 *
 *   Tier 4  Level 1 Pantau    -> unit saja, kalau memang diminta
 *   Tier 3  Level 2 Waspada   -> unit
 *   Tier 2  Level 3 Siaga     -> kanwil (dan unit sebagai tembusan)
 *   Tier 1  Level 4 Krisis    -> pusat, kanwil, unit
 *
 * TABEL INI SENGAJA DIBIARKAN KOSONG.
 *
 * Selama kosong, tidak ada satu pun perilaku yang berubah: pemberitahuan tetap
 * berjalan persis seperti sebelumnya. Ia baru menyala setelah ID grup yang
 * sungguhan diisi.
 *
 * Kenapa tidak diisi dengan tebakan: pemberitahuan pertama yang pernah terkirim
 * ke grup pimpinan sistem ini berisi lima pesan "BERITA NEGATIF MASUK" yang
 * empat di antaranya kegiatan positif. Grup yang dibanjiri akan dibisukan, dan
 * grup yang dibisukan tidak menerima pemberitahuan yang benar-benar penting
 * nanti. Rute yang salah alamat jauh lebih mahal daripada rute yang belum ada.
 */
create table if not exists public.notifikasi_rute (
  id uuid primary key default gen_random_uuid(),

  -- Tier media yang memicu rute ini. NULL berarti seluruh tier.
  tier smallint check (tier between 1 and 4),

  -- Lingkup penerima. NULL pada kanwil berarti berlaku nasional.
  kanwil text,
  nama_upt text,

  tingkat text not null check (tingkat in ('unit','kanwil','pusat')),
  chat_id text not null,
  keterangan text,

  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifikasi_rute_cari_idx
  on public.notifikasi_rute (tier, kanwil) where aktif;

comment on table public.notifikasi_rute is
  'Rute eskalasi pemberitahuan menurut tier media. Kosong = perilaku lama tidak berubah. Lihat matriks SOP pada Bab VI Buku Panduan Emas.';

/**
 * Menjawab: berita ini harus dikirim ke grup mana saja?
 *
 * Aturannya bukan "tier sekian ke tingkat sekian", melainkan MENUMPUK: krisis
 * Tier 1 dikirim ke pusat, kanwil, DAN unit sekaligus. Pimpinan yang membaca
 * pesan Pusat tetap perlu tahu bahwa Kalapasnya juga sudah membacanya.
 */
create or replace function public.rute_notifikasi(
  p_tier smallint,
  p_kanwil text,
  p_nama_upt text
)
returns table (chat_id text, tingkat text, keterangan text)
language sql
stable
as $fn$
  with tingkat_wajib as (
    select unnest(
      case
        when p_tier = 1 then array['pusat','kanwil','unit']
        when p_tier = 2 then array['kanwil','unit']
        when p_tier = 3 then array['unit']
        else array['unit']
      end
    ) as tingkat
  )
  select distinct r.chat_id, r.tingkat, r.keterangan
  from public.notifikasi_rute r
  join tingkat_wajib w on w.tingkat = r.tingkat
  where r.aktif
    and (r.tier is null or r.tier = p_tier)
    and (r.kanwil is null or r.kanwil = p_kanwil)
    and (r.nama_upt is null or r.nama_upt = p_nama_upt);
$fn$;

comment on function public.rute_notifikasi(smallint, text, text) is
  'Daftar grup tujuan sebuah berita negatif menurut tier. Tingkatnya menumpuk: Tier 1 mengenai pusat, kanwil, dan unit sekaligus.';
