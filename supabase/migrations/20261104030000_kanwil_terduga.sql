-- Berita tanpa UPT kini disalurkan ke kanwil hasil dugaan.
--
-- Keadaan 4 November 2026: 5.646 berita (penjaring 5.072, lembar pusat 574)
-- tidak punya kanwil_asal karena UPT-nya belum dikenali, sehingga tidak masuk
-- dasbor kanwil MANA PUN — padahal banyak judulnya menyebut wilayahnya sendiri
-- ("Lapas Jayapura", "Kakanwil Ditjenpas Malut"). web/js/lib/wilayah-berita.js
-- sudah bisa menduga kanwilnya, tetapi dugaan itu hanya hidup di layar
-- Analisis Berita pusat. Atas keputusan user, dugaan itu kini ditulis ke
-- kanwil_asal — dengan penanda bahwa ia dugaan, bukan kepastian.
--
-- Tiga aturan yang menjaga dugaan tetap dugaan:
--
--   1. Dugaan HANYA mengisi kanwil_asal yang kosong. Kanwil dari lembar
--      pengirim atau dari UPT di data induk tidak pernah ditimpa.
--   2. Begitu UPT sebuah berita ditetapkan (mesin atau analis), pemicu
--      tandai_tier_berita mengganti kanwil dengan kanwil UPT itu dan
--      menghapus tanda dugaannya. Dugaan yang salah terkoreksi sendiri oleh
--      pemetaan UPT — jalur kerja yang memang sudah ada.
--   3. Kolom kanwil_terduga ikut ke peramban, sehingga setiap layar bisa
--      menyebut "terduga" alih-alih menyajikannya sebagai fakta.
--
-- Berita lintas wilayah dan berita tanpa lokasi tetap tanpa kanwil: menebak
-- salah satu dari dua kanwil lebih buruk daripada tidak menyalurkannya.

alter table public.berita
  add column if not exists kanwil_terduga boolean not null default false,
  add column if not exists kanwil_dasar text;

comment on column public.berita.kanwil_terduga is
  'Benar bila kanwil_asal hasil dugaan teks (lib/wilayah-berita.js), bukan dari lembar pengirim atau UPT data induk.';
comment on column public.berita.kanwil_dasar is
  'Dasar penentuan kanwil_asal: lembar, upt, atau dasar dugaan (upt-terduga, sebut-kanwil, kandidat-upt, nama-tempat).';

-- Penanda pasti untuk yang sudah ada, supaya "kosong" tidak lagi berarti dua hal.
-- Ditulis tanpa memukul updated_at: yang berubah hanya keterangannya.
alter table public.berita disable trigger trg_berita_updated_at;
update public.berita b
   set kanwil_dasar = case
         when exists (select 1 from public.upt u where u.nama_upt = b.nama_upt and u.kanwil = b.kanwil_asal) then 'upt'
         else 'lembar' end
 where b.kanwil_asal is not null and b.kanwil_dasar is null;
alter table public.berita enable trigger trg_berita_updated_at;

/*
   Pemicu kanwil dari UPT: kini juga menghapus tanda dugaan. Isi lainnya
   SAMA PERSIS dengan versi yang berjalan (tier media, kunci peristiwa, induk).
*/
create or replace function public.tandai_tier_berita()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare d text; hasil record; kanwil_induk text; kunci text; induk uuid;
begin
  d := public.domain_dari_tautan(coalesce(new.link_normalized, new.link));
  new.domain_media := d;
  if d is not null and d like '%.%' then
    select * into hasil from public.cari_tier_media('https://' || d) limit 1;
    if not found then
      insert into public.media_tier (domain, nama_media, tier, jangkauan, tier_sumber, catatan)
      values (d, d, 4, 'Hiperlokal', 'otomatis',
              'Terlihat pertama kali dari sebuah berita. Tier 4 adalah bawaan yang aman, bukan hasil telaah.')
      on conflict (domain) do nothing;
      new.tier_media := 4; new.bobot_media := 25;
    else
      new.tier_media := hasil.tier; new.bobot_media := hasil.bobot;
    end if;
  end if;
  if new.nama_upt is not null and new.nama_upt <> '' then
    select u.kanwil into kanwil_induk from public.upt u where u.nama_upt = new.nama_upt limit 1;
    if kanwil_induk is not null then
      new.kanwil_asal := kanwil_induk;
      new.kanwil_terduga := false;
      new.kanwil_dasar := 'upt';
    end if;
  end if;
  if tg_op = 'INSERT' and new.kanwil_asal is not null and new.kanwil_dasar is null then
    new.kanwil_dasar := 'lembar';
  end if;
  kunci := public.kunci_peristiwa(new.judul);
  new.kunci_peristiwa := kunci;
  if kunci is not null then
    select coalesce(b.induk_id, b.id) into induk
    from public.berita b
    where b.kunci_peristiwa = kunci and b.id is distinct from new.id
      and b.deleted_at is null and b.created_at > now() - interval '7 days'
    order by b.created_at asc, b.id asc limit 1;
    new.induk_id := induk;
  else
    new.induk_id := null;
  end if;
  return new;
end; $function$;

/*
   Penulis dugaan. Dipanggil Edge Function klasifikasi dengan service role,
   satu potongan sekali panggil: [{id, kanwil, dasar}, ...].

   - Nama kanwil diperiksa ke tabel kanwil; nama yang tidak ada dibuang
     diam-diam di sini dan dihitung di jawaban, bukan ditulis.
   - Hanya baris yang kanwil_asal-nya masih kosong.
   - p_sentuh = false (pengisian arsip) tidak memukul updated_at.
*/
create or replace function public.terapkan_dugaan_kanwil(p_hasil jsonb, p_sentuh boolean default true)
returns table(ditulis integer, ditolak integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare n_tulis integer := 0; n_masuk integer := 0;
begin
  select count(*) into n_masuk from jsonb_array_elements(p_hasil);
  if not p_sentuh then
    execute 'alter table public.berita disable trigger trg_berita_updated_at';
  end if;
  with masuk as (
    select (x ->> 'id')::uuid as id, x ->> 'kanwil' as kanwil, nullif(x ->> 'dasar', '') as dasar
    from jsonb_array_elements(p_hasil) x
  ),
  ubah as (
    update public.berita b
       set kanwil_asal = m.kanwil,
           kanwil_terduga = true,
           kanwil_dasar = coalesce(m.dasar, 'terduga')
      from masuk m
      join public.kanwil k on k.nama = m.kanwil
     where b.id = m.id
       and b.kanwil_asal is null
       and b.deleted_at is null
    returning b.id
  )
  select count(*) into n_tulis from ubah;
  if not p_sentuh then
    execute 'alter table public.berita enable trigger trg_berita_updated_at';
  end if;
  return query select n_tulis, n_masuk - n_tulis;
end; $function$;

revoke all on function public.terapkan_dugaan_kanwil(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.terapkan_dugaan_kanwil(jsonb, boolean) to service_role;

create index if not exists berita_tanpa_kanwil_idx on public.berita (created_at desc)
  where deleted_at is null and kanwil_asal is null;
