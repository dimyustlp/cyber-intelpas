-- ============================================================================
-- Mode "ragam": pencarian per unit memakai sebutan yang sungguh dipakai orang
-- ============================================================================
--
-- SEBABNYA TERUKUR, BUKAN SELERA
--
-- Lembar kanwil v1.x punya tiga kaki yang bertanya kepada Google News. Diukur
-- 8 September 2026, pada jam yang sama:
--
--     dari basis data (Edge Function `penjaring`)  ->  100% berhasil, tiap jam
--     dari Apps Script (lembar kanwil)             ->  0% berhasil, 115 dari 115
--
-- Penguraian alamat Google News dari Apps Script MUSTAHIL berhasil. Ini
-- bayangan cermin temuan 6 September, ketika Google menolak Edge Function tetapi
-- menerima basis data: yang menentukan bukan kodenya, melainkan dari mana
-- permintaannya berangkat.
--
-- Maka pencarian per unit dipindahkan ke pusat. Yang ikut pindah bukan sekadar
-- tempatnya — melainkan juga kualitas kuerinya.
--
-- KENAPA TIDAK MENYUNTING `penjaring` SAJA
--
-- `kueriUnit()` di dalamnya sudah menurunkan bentuk pendek ("Lapas Kelas IIA
-- Kediri" -> "Lapas Kediri"), tetapi tidak bentuk sehari-hari ("Penjara
-- Kediri") apalagi nama panggilan setempat ("Medaeng"). Menambahkannya berarti
-- menggelar ulang 1.523 baris untuk perubahan yang sebenarnya DATA.
--
-- Fungsi itu sudah menyediakan jalannya: mode apa pun selain 'umpan' dan 'unit'
-- dibaca dari tabel `penjaring_kueri`, berputar menurut yang paling lama tidak
-- dijalankan. Menambah mode karena itu cukup menambah baris — persis prinsip
-- yang sudah tertulis di README: "menambah kueri atau portal tidak menuntut
-- penggelaran ulang".
--
-- Keuntungan sampingannya lebih besar daripada yang dihindari: kuerinya kini
-- TERLIHAT dan BISA DISUNTING analis. Satu unit yang tidak pernah tertangkap
-- bisa diperbaiki tanpa menyentuh kode sama sekali.
--
-- MODE INI MENGGANTIKAN MODE 'unit', BUKAN MENDAMPINGINYA
--
-- Alias pertama tiap unit adalah nama resminya, jadi 'ragam' memuat seluruh isi
-- 'unit'. Menjalankan keduanya hanya membayar Google dua kali untuk jawaban
-- yang sama, dan Google membalas 429 bila diminta terlalu sering. Jadwal
-- jobid 9 karena itu dialihkan, bukan ditambah.

-- --------------------------------------------------------- ragam nama unit

/**
 * Menurunkan sebutan yang mungkin dipakai wartawan dari data induk.
 *
 * Nama daerah SENDIRIAN tidak pernah dihasilkan: "Kediri" akan menarik seluruh
 * berita kota itu, termasuk jadwal pertandingan sepak bola.
 *
 * Huruf kelas harus menempel langsung pada angkanya. Pola pertama memakai
 * `\s*[ABC]?`, dan pada nama tanpa huruf kelas ("Rutan Kelas I Surabaya") `\s*`
 * menelan spasi pemisahnya sehingga lahir "RutanSurabaya" — nama gabung yang
 * tidak akan mencocokkan judul mana pun, sambil memakan satu dari tiga slot
 * kueri. Penjaga `v !~ '[a-z][A-Z]'` menahan bentuk seperti itu seandainya ada
 * jalan lain menuju ke sana.
 */
create or replace function public.ragam_nama_upt(p_nama text, p_jenis text, p_kota text)
returns text[]
language plpgsql
immutable
as $fn$
declare
  kota text;
  pendek text;
  jenis text;
  calon text[];
  hasil text[];
begin
  kota := trim(regexp_replace(coalesce(p_kota, ''), '^(Kota Administrasi|Kota|Kabupaten|Kab\.?)\s+', '', 'i'));
  pendek := trim(regexp_replace(regexp_replace(coalesce(p_nama, ''),
              '\s+Kelas\s+([IVX]+|[0-9]+)[ABC]?\y', '', 'i'), '\s{2,}', ' ', 'g'));
  jenis := lower(coalesce(p_jenis, ''));

  calon := array[
    p_nama,
    nullif(pendek, p_nama),
    case when kota <> '' then p_jenis || ' ' || kota end,
    case when jenis = 'lapas'    and kota <> '' then 'Penjara ' || kota end,
    case when jenis = 'lapas'    and kota <> '' then 'LP ' || kota end,
    case when jenis = 'rutan'    and kota <> '' then 'Rumah Tahanan ' || kota end,
    case when jenis = 'bapas'    and kota <> '' then 'Balai Pemasyarakatan ' || kota end,
    case when jenis = 'lpka'     and kota <> '' then 'Lapas Anak ' || kota end,
    case when jenis = 'lpp'      and kota <> '' then 'Lapas Perempuan ' || kota end,
    case when jenis = 'rupbasan' and kota <> '' then 'Rupbasan ' || kota end
  ];

  -- Urutannya dipertahankan: yang paling resmi lebih dulu, sebab hanya tiga
  -- teratas yang muat dalam satu kueri.
  select array_agg(v order by ord) into hasil
  from (
    select distinct on (lower(v)) v, ord
    from unnest(calon) with ordinality as t(v, ord)
    where v is not null and length(v) > 5 and v !~ '[a-z][A-Z]'
    order by lower(v), ord
  ) s;

  return coalesce(hasil, array[p_nama]);
end;
$fn$;

comment on function public.ragam_nama_upt(text, text, text) is
  'Menurunkan sebutan yang mungkin dipakai wartawan dari data induk. Nama daerah SENDIRIAN tidak pernah dihasilkan.';

alter table public.penjaring_sasaran add column if not exists alias text[];

comment on column public.penjaring_sasaran.alias is
  'Sebutan yang dicari penjaring untuk unit ini. Disemai dari data induk, dan BOLEH ditambah analis dengan nama panggilan setempat. Tiga teratas yang dipakai dalam kueri.';

update public.penjaring_sasaran s
set alias = public.ragam_nama_upt(u.nama_upt, u.jenis_upt, u.kabupaten_kota)
from public.upt u
where u.nama_upt = s.nama_upt;

-- ------------------------------------------------------------- mode "ragam"

alter table public.penjaring_kueri drop constraint if exists penjaring_kueri_mode_check;
alter table public.penjaring_kueri add constraint penjaring_kueri_mode_check
  check (mode = any (array['umum'::text, 'isu'::text, 'ragam'::text]));

/**
 * Menyusun ulang kueri mode "ragam" dari `penjaring_sasaran.alias`.
 *
 * Jalankan setiap kali alias sebuah unit disunting analis. Kueri yang disunting
 * dengan tangan akan DITIMPA — yang disunting seharusnya aliasnya, bukan
 * kuerinya, supaya sumber kebenarannya tetap satu.
 */
create or replace function public.susun_kueri_ragam()
returns table (aktif_sekarang int, dinonaktifkan int)
language plpgsql
as $fn$
declare
  v_mati int;
  v_aktif int;
begin
  insert into public.penjaring_kueri (kode, mode, kueri, aktif, urutan, catatan)
  select
    'ragam-' || regexp_replace(lower(s.nama_upt), '[^a-z0-9]+', '-', 'g'),
    'ragam',
    -- Tiga sebutan teratas. Lebih dari itu memanjangkan kueri tanpa menambah
    -- jangkauan: yang keempat hampir selalu bentuk yang sama.
    --
    -- `when:5d` ditulis DI DALAM teks kuerinya karena `alamatRss()` tidak
    -- menambahkan apa pun. Pencarian Google News mengurutkan menurut RELEVANSI,
    -- bukan tanggal; tanpa operator ini, berita bertahun lalu diunduh dan
    -- diurai lebih dulu sebelum dibuang. Terukur di Apps Script: 1.075 butir
    -- ditolak "terlalu lama" dalam satu jalan, dan menjadi nol sesudahnya.
    (select string_agg('"' || a || '"', ' OR ' order by ord)
       from unnest(s.alias) with ordinality as t(a, ord)
      where ord <= 3)
      || ' when:5d',
    s.aktif,
    500,
    'Disusun susun_kueri_ragam() dari penjaring_sasaran.alias. Boleh disunting analis; suntingan DITIMPA bila fungsi itu dijalankan lagi.'
  from public.penjaring_sasaran s
  where s.alias is not null and cardinality(s.alias) > 0
  on conflict (kode) do update set
    kueri = excluded.kueri,
    aktif = excluded.aktif,
    updated_at = now();

  -- Sasaran yang dinonaktifkan tidak menyisakan kueri yang terus berjalan.
  update public.penjaring_kueri k
  set aktif = false, updated_at = now()
  where k.mode = 'ragam'
    and k.aktif
    and not exists (
      select 1 from public.penjaring_sasaran s
      where s.aktif
        and 'ragam-' || regexp_replace(lower(s.nama_upt), '[^a-z0-9]+', '-', 'g') = k.kode
    );
  get diagnostics v_mati = row_count;

  select count(*) into v_aktif from public.penjaring_kueri where mode = 'ragam' and aktif;
  return query select v_aktif, v_mati;
end;
$fn$;

comment on function public.susun_kueri_ragam() is
  'Menyusun ulang kueri mode "ragam" dari penjaring_sasaran.alias. Jalankan setiap kali alias sebuah unit disunting analis.';

select * from public.susun_kueri_ragam();

-- Batas umur untuk kueri yang sudah ada. Tanpa ini, mode 'umum' dan 'isu'
-- tetap mengunduh berita lama lebih dulu baru membuangnya.
update public.penjaring_kueri
set kueri = kueri || ' when:5d', updated_at = now()
where mode in ('umum', 'isu') and aktif and kueri not like '%when:%';

-- Jadwal jobid 9 dialihkan dari mode 'unit' ke 'ragam'.
-- Dicatat di sini sebagai riwayat; dijalankan sekali dengan tangan:
--
--   select cron.alter_job(9, command :=
--     $$select public.panggil_penjaring(
--        '{"aksi":"jaring","mode":"ragam","batas_kueri":14,"batas_uraikan":30}'::jsonb)$$);
