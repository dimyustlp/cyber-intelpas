-- =============================================================================
-- Cyber-Intelpas — Migrasi 05: Sumber Ganda dan Angka yang Sejalan
-- =============================================================================
-- Dua pekerjaan yang kebetulan sama-sama menyentuh cara angka dihitung.
--
-- Pertama, sumber data berhenti menjadi satu spreadsheet yang alamatnya
-- tertanam di dalam kode Edge Function. Kantor wilayah akan mengumpulkan data
-- lewat spreadsheet masing-masing, dan menambahkan satu wilayah tidak boleh
-- berarti menggelar ulang fungsi. Tabel `sumber_sheet` menjadi daftarnya.
--
-- Kedua, definisi "berita negatif" disamakan. Sampai migrasi ini,
-- `snapshot_negatif` menghitung Negatif beserta Campuran sedangkan
-- `snapshot_laporan` — dan seluruh layar aplikasi — menghitung Negatif saja.
-- Keduanya berjalan persis seperti yang ditulis, dan justru karena itu satu
-- pertanyaan menghasilkan dua angka. Berita bersentimen campuran memuat kedua
-- sisi sekaligus; ia bukan berita yang merugikan institusi, dan sekarang
-- dihitung bersama Netral di mana pun.
--
-- Sifat: idempoten. Aman dijalankan ulang.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Asal wilayah pada berita
-- -----------------------------------------------------------------------------
-- Sampai sekarang, wilayah sebuah berita hanya bisa disimpulkan lewat nama UPT
-- yang dicocokkan mesin. Untuk berita yang unitnya belum terpetakan — dan itu
-- ratusan — kesimpulan itu tidak pernah ada. Kiriman kanwil membawa asalnya
-- sendiri, dan pembatasan akses wilayah nanti tidak boleh bergantung pada
-- keberhasilan pencocokan nama.

alter table public.berita
    add column if not exists kanwil_asal text;

comment on column public.berita.kanwil_asal is
    'Kantor wilayah asal kiriman. Diisi penyalin spreadsheet kanwil dan formulir '
    'input wilayah; kosong untuk berita yang masuk lewat sumber pusat.';

create index if not exists berita_kanwil_asal_idx
    on public.berita (kanwil_asal)
    where kanwil_asal is not null;

-- -----------------------------------------------------------------------------
-- 2. Daftar sumber spreadsheet
-- -----------------------------------------------------------------------------

create table if not exists public.sumber_sheet (
    id                  uuid primary key default gen_random_uuid(),
    kode                text not null unique,
    nama                text not null,
    lingkup             text not null default 'kanwil'
                        check (lingkup in ('pusat', 'kanwil')),
    kanwil              text,
    sheet_id            text,
    sheet_nama          text not null default 'Sheet1',
    csv_url             text not null,
    -- Pemetaan kolom khusus bila judul kolom lembar berbeda dari kelaziman.
    -- Kosong berarti memakai daftar alias bawaan di dalam Edge Function.
    kolom_alias         jsonb,
    aktif               boolean not null default true,
    urutan              integer not null default 100,
    terakhir_sinkron_at timestamptz,
    terakhir_status     text,
    terakhir_pesan      text,
    baris_terakhir      integer,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table public.sumber_sheet is
    'Daftar spreadsheet yang ditarik penyalin. Satu baris untuk pusat, satu baris '
    'untuk tiap kantor wilayah. Menambah wilayah cukup menambah baris di sini — '
    'tidak ada penggelaran ulang Edge Function.';

comment on column public.sumber_sheet.csv_url is
    'Alamat CSV. Boleh berupa tautan /edit biasa: penyalin menerjemahkannya sendiri '
    'menjadi alamat ekspor CSV, dan mencoba lebih dari satu bentuk sebelum menyerah.';

create index if not exists sumber_sheet_aktif_idx
    on public.sumber_sheet (aktif, urutan)
    where aktif is true;

drop trigger if exists sumber_sheet_updated_at on public.sumber_sheet;
create trigger sumber_sheet_updated_at
    before update on public.sumber_sheet
    for each row execute function public.set_updated_at();

alter table public.sumber_sheet enable row level security;

drop policy if exists sumber_sheet_baca on public.sumber_sheet;
drop policy if exists sumber_sheet_admin on public.sumber_sheet;

-- Baca: petugas pusat melihat seluruh sumber; petugas wilayah hanya sumbernya
-- sendiri. Alamat spreadsheet wilayah lain bukan urusan siapa pun di luarnya.
create policy sumber_sheet_baca on public.sumber_sheet
    for select to authenticated
    using (
        public.has_role('super_admin', 'media_intelligence_analyst',
                        'evaluation_recommendation_analyst', 'executive_decision_maker',
                        'news_data_operator')
        or (
            kanwil is not null
            and kanwil = (select u.assigned_kanwil
                            from public.app_users u
                           where u.auth_user_id = auth.uid()
                             and u.aktif is true
                             and u.deleted_at is null
                           limit 1)
        )
    );

create policy sumber_sheet_admin on public.sumber_sheet
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- 3. Dua sumber pertama
-- -----------------------------------------------------------------------------
-- Sumber pusat memakai alamat yang selama ini tertanam di dalam Edge Function.
-- Kodenya harus tetap 'pusat': penyalin memakai kode itu untuk mempertahankan
-- bentuk penanda baris lama, sehingga ratusan berita yang sudah tersimpan tidak
-- masuk ulang sebagai berita baru.

insert into public.sumber_sheet (kode, nama, lingkup, kanwil, sheet_id, sheet_nama, csv_url, urutan)
values (
    'pusat',
    'Pemantauan Pusat — Dirpamintel',
    'pusat',
    null,
    '2PACX-1vQ0-o2qi5vHXxjnwxPAB4wxtAo8ZdmmVjG-wMvOLSXKjNWXOLCyyR0-1F4aOUn9SnFY8NtFvZeSzaft',
    'Sheet1',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0-o2qi5vHXxjnwxPAB4wxtAo8ZdmmVjG-wMvOLSXKjNWXOLCyyR0-1F4aOUn9SnFY8NtFvZeSzaft/pub?output=csv',
    10
)
on conflict (kode) do nothing;

insert into public.sumber_sheet (kode, nama, lingkup, kanwil, sheet_id, sheet_nama, csv_url, urutan)
values (
    'kanwil-1',
    'Pengumpulan Data Kantor Wilayah',
    'kanwil',
    null,
    '1VRfyAVuacd2wUmaM9HfrmbopjhKuF9eCtGizKEm_eS0',
    'Sheet1',
    'https://docs.google.com/spreadsheets/d/1VRfyAVuacd2wUmaM9HfrmbopjhKuF9eCtGizKEm_eS0/edit',
    20
)
on conflict (kode) do nothing;

-- -----------------------------------------------------------------------------
-- 4. Satu definisi "negatif"
-- -----------------------------------------------------------------------------

create or replace function public.snapshot_negatif(p_mulai date, p_selesai date)
returns jsonb
language sql
stable
as $function$
  -- Bahan mentah laporan negatif: publikasi apa adanya, bukan agregat.
  --
  -- Dua perubahan terhadap bentuk sebelumnya, keduanya untuk menyamakan angka
  -- laporan dengan angka layar:
  --
  --   1. Sentimen "Campuran" tidak lagi ikut dihitung sebagai negatif. Ia satu
  --      ember dengan Netral, sama seperti di dasbor, kanal, dan antrean telaah.
  --   2. Berita yang sudah dinyatakan "Tidak Valid" atau "Diarsipkan" oleh
  --      analis tidak lagi menjadi angka. Kalau ia tetap dihitung, telaah yang
  --      menyatakannya tidak valid menjadi pekerjaan tanpa akibat.
  with dasar as (
    select b.*
    from public.berita b
    where b.deleted_at is null
      and coalesce(b.kategori, '') <> 'Di Luar Lingkup'
      and coalesce(b.status_verifikasi, '') not in ('Tidak Valid', 'Diarsipkan')
      and coalesce(b.tanggal_publikasi, b.created_at)::date between p_mulai and p_selesai
  ),
  neg as (
    select * from dasar where sentimen = 'Negatif'
  ),
  lalu as (
    select b.*
    from public.berita b
    where b.deleted_at is null
      and coalesce(b.kategori, '') <> 'Di Luar Lingkup'
      and coalesce(b.status_verifikasi, '') not in ('Tidak Valid', 'Diarsipkan')
      and coalesce(b.tanggal_publikasi, b.created_at)::date
          between p_mulai - (p_selesai - p_mulai + 1) and p_mulai - 1
  )
  select jsonb_build_object(
    'periode', jsonb_build_object(
      'mulai', p_mulai, 'selesai', p_selesai,
      'hari', (p_selesai - p_mulai) + 1,
      'pembanding_mulai', p_mulai - (p_selesai - p_mulai + 1),
      'pembanding_selesai', p_mulai - 1),
    'konteks', jsonb_build_object(
      'total', (select count(*) from dasar),
      'negatif', (select count(*) from neg),
      'positif', (select count(*) from dasar where sentimen = 'Positif'),
      'netral', (select count(*) from dasar
                  where coalesce(sentimen, 'Netral') in ('Netral', 'Campuran', 'Tidak diketahui')),
      'lalu_total', (select count(*) from lalu),
      'lalu_negatif', (select count(*) from lalu where sentimen = 'Negatif')),
    'publikasi', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id,
        'judul', left(regexp_replace(coalesce(n.judul,''), '\s+', ' ', 'g'), 220),
        'media', coalesce(n.media, 'Tidak tercatat'),
        'platform', coalesce(n.platform, 'Lainnya'),
        'link', n.link,
        'tanggal', coalesce(n.tanggal_publikasi, n.created_at),
        'kategori', coalesce(n.kategori, 'Lainnya'),
        'subkategori', coalesce(n.subkategori, 'Belum Dikelompokkan'),
        'subkategori_kode', coalesce(n.subkategori_kode, '0.1'),
        'urgensi', coalesce(n.urgensi, 'Rendah'),
        'sentimen', coalesce(n.sentimen, 'Netral'),
        'nama_upt', coalesce(n.nama_upt, 'Belum Teridentifikasi'),
        'status_verifikasi', coalesce(n.status_verifikasi, 'Belum Ditelaah'),
        'ai_confidence', n.ai_confidence,
        'provinsi', u.provinsi,
        'kanwil', coalesce(n.kanwil_asal, u.kanwil))
        order by coalesce(n.tanggal_publikasi, n.created_at) desc)
      from neg n left join public.upt u on u.nama_upt = n.nama_upt), '[]'::jsonb),
    'dibuat_pada', now()
  );
$function$;

-- `snapshot_laporan` sudah memakai definisi sentimen yang benar, tetapi belum
-- membuang berita yang dinyatakan tidak valid. Ditambal pada definisinya yang
-- sedang berjalan supaya badan fungsi yang panjang itu tidak perlu disalin
-- ulang di sini — penyalinan yang justru mengundang selisih baru.
do $patch$
declare
    d text;
begin
    select pg_get_functiondef(p.oid) into d
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'snapshot_laporan'
     limit 1;

    if d is null then
        raise notice 'snapshot_laporan tidak ditemukan, penambalan dilewati.';
        return;
    end if;

    if position('Tidak Valid' in d) > 0 then
        raise notice 'snapshot_laporan sudah membuang berita tidak valid.';
        return;
    end if;

    execute replace(
        d,
        'deleted_at is null',
        'deleted_at is null and coalesce(status_verifikasi, '''') not in (''Tidak Valid'', ''Diarsipkan'')'
    );
end
$patch$;

-- -----------------------------------------------------------------------------
-- 5. Tabel cadangan klasifikasi
-- -----------------------------------------------------------------------------
-- Berbeda dengan seluruh tabel lain, `berita_klasifikasi_cadangan` berjalan
-- tanpa RLS sejak dibuat. Isinya 651 salinan nilai klasifikasi sebelum
-- penyeliaan ulang mesin — dan tanpa RLS, ia terbaca oleh siapa pun yang
-- memegang kunci publik, sedangkan kunci itu memang tertulis di dalam berkas
-- yang dikirim ke peramban. Tidak ada satu baris kode aplikasi pun yang
-- membacanya, jadi penguncian ini tidak menghentikan apa pun.

alter table public.berita_klasifikasi_cadangan enable row level security;

drop policy if exists cadangan_admin on public.berita_klasifikasi_cadangan;
create policy cadangan_admin on public.berita_klasifikasi_cadangan
    for select to authenticated
    using (public.is_super_admin());

commit;
