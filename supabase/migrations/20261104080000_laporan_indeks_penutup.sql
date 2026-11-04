-- Laporan Berkala tetap cepat saat cache basis data dingin.
--
-- Sesudah 20261104060000, snapshot_negatif 30 hari = 0,6 detik dalam keadaan
-- hangat, tetapi panggilan PERTAMA sesudah tabel berita lama tak dibaca masih
-- 3,9–8,9 detik — sesekali lewat batas 8 detik. Sebabnya fisik: hitungannya
-- menyentuh ±31 ribu baris, dan heap berita 123 MB (±3,6 KB per baris: teks
-- analisis, caption, vektor pencarian), jadi ±13 ribu halaman heap harus
-- dibaca dari disk.
--
-- Perbaikannya membagi laporan menjadi dua jalur:
--
--   hitungan   total, per sentimen, sebaran unit pembanding — dijawab dari
--              indeks penutup di bawah (index-only scan), tanpa heap
--   rincian    18 kolom publikasi — hanya untuk berita NEGATIF periode
--              berjalan (±2 ribu), diambil dari heap menurut id
--
-- Indeksnya memuat juga kolom yang dibaca aturan RLS (deleted_at lewat
-- predikat, kanwil_asal, nama_upt). Tanpa itu, kueri pengguna yang terikat RLS
-- tidak bisa memakai index-only scan sama sekali, sebab policy merujuk kolom
-- yang tidak ada di indeks.
--
-- Keluarannya diuji identik penuh (jsonb utuh, termasuk urutan publikasi)
-- dengan versi 20261104060000 untuk 30 hari, 4 November 2026.
--
-- Ukuran baris indeks: kolom terpanjang 146 bita (nama UPT + kanwil +
-- kategori + status + sentimen), jauh di bawah batas btree ±2.700 bita.

create index if not exists berita_laporan_idx on public.berita (created_at)
  include (id, sentimen, nama_upt, kategori, status_verifikasi, kanwil_asal)
  where deleted_at is null;

create or replace function public.snapshot_negatif(p_mulai date, p_selesai date)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $function$
  with basis as materialized (
    select b.id, b.created_at, b.sentimen, b.nama_upt
    from public.berita b
    where b.deleted_at is null
      and coalesce(b.kategori, '') <> 'Di Luar Lingkup'
      and coalesce(b.status_verifikasi, '') not in ('Tidak Valid', 'Diarsipkan')
      and b.created_at >= ((p_mulai - (p_selesai - p_mulai + 1))::timestamp at time zone 'Asia/Jakarta')
      and b.created_at <  ((p_selesai + 1)::timestamp at time zone 'Asia/Jakarta')
  ),
  dasar as (
    select * from basis where created_at >= (p_mulai::timestamp at time zone 'Asia/Jakarta')
  ),
  lalu as (
    select * from basis where created_at < (p_mulai::timestamp at time zone 'Asia/Jakarta')
  ),
  neg as (
    select n.id, n.judul, n.media, n.platform, n.link, n.tanggal_publikasi, n.created_at,
           n.kategori, n.subkategori, n.subkategori_kode, n.urgensi, n.sentimen, n.nama_upt,
           n.status_verifikasi, n.ai_confidence, n.tier_media, n.tanggapan_sikap, n.kanwil_asal
    from public.berita n
    where n.id in (select id from dasar where sentimen = 'Negatif')
  )
  select jsonb_build_object(
    'periode', jsonb_build_object(
      'mulai', p_mulai, 'selesai', p_selesai,
      'hari', (p_selesai - p_mulai) + 1,
      'pembanding_mulai', p_mulai - (p_selesai - p_mulai + 1),
      'pembanding_selesai', p_mulai - 1),
    'konteks', jsonb_build_object(
      'total', (select count(*) from dasar),
      'negatif', (select count(*) from dasar where sentimen = 'Negatif'),
      'positif', (select count(*) from dasar where sentimen = 'Positif'),
      'netral', (select count(*) from dasar
                  where coalesce(sentimen, 'Netral') in ('Netral', 'Campuran', 'Tidak diketahui')),
      'lalu_total', (select count(*) from lalu),
      'lalu_negatif', (select count(*) from lalu where sentimen = 'Negatif')),
    'unit_lalu', coalesce((
      select jsonb_object_agg(x.nama_upt, x.jumlah)
      from (
        select l.nama_upt, count(*)::int as jumlah
        from lalu l
        where l.sentimen = 'Negatif'
          and coalesce(l.nama_upt, '') <> ''
          and l.nama_upt not ilike 'belum%'
          and l.nama_upt not ilike 'tidak%'
        group by l.nama_upt
      ) x), '{}'::jsonb),
    'publikasi', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id,
        'judul', left(regexp_replace(coalesce(n.judul,''), '\s+', ' ', 'g'), 220),
        'media', coalesce(n.media, 'Tidak tercatat'),
        'platform', coalesce(n.platform, 'Lainnya'),
        'link', n.link,
        'tanggal', coalesce(n.tanggal_publikasi, n.created_at),
        'hari', (n.created_at at time zone 'Asia/Jakarta')::date,
        'kategori', coalesce(n.kategori, 'Lainnya'),
        'subkategori', coalesce(n.subkategori, 'Belum Dikelompokkan'),
        'subkategori_kode', coalesce(n.subkategori_kode, '0.1'),
        'urgensi', coalesce(n.urgensi, 'Rendah'),
        'sentimen', coalesce(n.sentimen, 'Netral'),
        'nama_upt', coalesce(n.nama_upt, 'Belum Teridentifikasi'),
        'status_verifikasi', coalesce(n.status_verifikasi, 'Belum Ditelaah'),
        'ai_confidence', n.ai_confidence,
        'tier_media', n.tier_media,
        'tanggapan_sikap', n.tanggapan_sikap,
        'provinsi', u.provinsi,
        'kanwil', coalesce(n.kanwil_asal, u.kanwil))
        order by coalesce(n.tanggal_publikasi, n.created_at) desc, n.id)
      from neg n left join public.upt u on u.nama_upt = n.nama_upt), '[]'::jsonb),
    'dibuat_pada', now()
  );
$function$;
