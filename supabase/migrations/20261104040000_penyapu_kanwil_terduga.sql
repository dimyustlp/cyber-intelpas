-- Penyapu kanwil terduga, sebagai jadwal tersendiri.
--
-- Rencana awal (20261104030000) menjalankan penduga di dalam klasifikasi
-- rutin. Ditarik sebelum sempat bekerja: satu panggilan untuk seluruh arsip
-- berakhir WORKER_RESOURCE_LIMIT, sebab penduga membaca ribuan nama tempat
-- untuk setiap berita — dan di dalam klasifikasi rutin, satu lonjakan berita
-- akan ikut menjatuhkan penilaian sentimennya. Diukur 4 November 2026:
-- 200 berita = 1,6 detik, 107 di antaranya mendapat kanwil terduga.
--
-- 1. terapkan_dugaan_kanwil menerima juga hasil TANPA kanwil (lintas wilayah,
--    tanpa lokasi): dasarnya dicatat di kanwil_dasar, kanwilnya tetap kosong.
--    Tanpa catatan itu penyapu membaca baris yang sama setiap kali, sebab
--    kira-kira separuh berita tanpa UPT memang tidak bisa diduga.
-- 2. Indeks untuk klasifikasi-auto. Kuerinya (urut ai_classified_at, 300 baris)
--    memindai seluruh tabel — 3 detik pada keadaan biasa, dan pukul 06.45 UTC
--    tanggal ini tembus batas 8 detik ketika basis data sedang sibuk.
--
-- Arsip (5.754 berita) diisi manual pada 4 November 2026 lewat 15 panggilan
-- mode wilayah × 400: 3.053 mendapat kanwil terduga (344 negatif), 2.701
-- tetap tanpa kanwil (2.623 tanpa lokasi, 78 lintas wilayah). Jadwal untuk
-- berita BARU ada di 20261104050000 dan diterapkan terpisah.
--
-- Penyapu memanggil dengan p_sentuh = true, yang TIDAK memakai jalur
-- `alter table … disable trigger`. Jalur itu mengunci seluruh tabel berita;
-- sekali jalan masih wajar, tetapi diulang tiap 10 menit ia bisa mengantre di
-- belakang penarikan dasbor yang sedang berlangsung dan menahan semua kueri di
-- belakangnya. Akibatnya updated_at ikut bergerak — dan memang ada yang
-- berubah: kanwilnya. p_sentuh = false hanya untuk pemakaian manual.

create or replace function public.terapkan_dugaan_kanwil(p_hasil jsonb, p_sentuh boolean default true)
returns table(ditulis integer, ditolak integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare n_tulis integer := 0; n_tanda integer := 0; n_masuk integer := 0;
begin
  select count(*) into n_masuk from jsonb_array_elements(p_hasil);
  if not p_sentuh then
    execute 'alter table public.berita disable trigger trg_berita_updated_at';
  end if;

  with masuk as (
    select (x ->> 'id')::uuid as id, nullif(x ->> 'kanwil', '') as kanwil, nullif(x ->> 'dasar', '') as dasar
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

  -- Yang tidak bisa diduga, atau nama kanwilnya tidak dikenal data induk:
  -- hanya dasarnya yang dicatat, supaya penyapu tidak mengulanginya.
  with masuk as (
    select (x ->> 'id')::uuid as id, nullif(x ->> 'kanwil', '') as kanwil, nullif(x ->> 'dasar', '') as dasar
    from jsonb_array_elements(p_hasil) x
  ),
  tanda as (
    update public.berita b
       set kanwil_dasar = case
             when m.kanwil is null then coalesce(m.dasar, 'tanpa-lokasi')
             else 'kanwil-tak-dikenal' end
      from masuk m
     where b.id = m.id
       and b.kanwil_asal is null
       and b.kanwil_dasar is null
       and b.deleted_at is null
    returning b.id
  )
  select count(*) into n_tanda from tanda;

  if not p_sentuh then
    execute 'alter table public.berita enable trigger trg_berita_updated_at';
  end if;
  return query select n_tulis, n_masuk - n_tulis;
end; $function$;

revoke all on function public.terapkan_dugaan_kanwil(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.terapkan_dugaan_kanwil(jsonb, boolean) to service_role;

-- Penyapu membaca berita yang belum pernah diduga.
drop index if exists public.berita_tanpa_kanwil_idx;
create index if not exists berita_belum_diduga_idx on public.berita (id)
  where deleted_at is null and kanwil_asal is null and kanwil_dasar is null;

-- klasifikasi-auto: yang paling lama dinilai didahulukan.
create index if not exists berita_antre_klasifikasi_idx on public.berita (ai_classified_at asc nulls first)
  where deleted_at is null;
