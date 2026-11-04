-- Dua fungsi yang dipanggil hampir setiap kali situs dibuka kembali mendekati
-- batas 8 detik peran authenticated, karena arsip tumbuh: 33 ribu berita pada
-- 3 November, 34 ribu baris di heap 123 MB (±3,6 KB per baris — teks analisis,
-- caption, dan vektor pencarian ikut di setiap baris). Diukur 4 November 2026
-- sebagai pemilik fungsi (tanpa RLS sekalipun):
--
--   snapshot_negatif 30 hari   12,10 detik   → Laporan Berkala bulanan gagal
--   kesehatan_asupan            5,80 detik   → dipanggil setiap pemuatan, semua peran
--
-- snapshot_negatif: CTE `select b.*` menyalin SELURUH kolom lebar untuk ±15
-- ribu baris, padahal yang dibaca hanya 18 kolom. Kini kolomnya disebut satu
-- per satu, dan kedua periode (berjalan + pembanding) diambil dalam satu
-- pindaian indeks created_at: 12,10 → 0,79 detik. Diuji terhadap versi lama
-- untuk 30 hari: konteks, unit_lalu, dan himpunan publikasi identik (2.046
-- berita negatif). Satu-satunya beda adalah urutan berita bertanggal kembar,
-- yang di versi lama tidak ditentukan; kini `id` menjadi pengikat urutannya.
--
-- kesehatan_asupan: dua pindaian penuh tabel berita (count filter + max
-- tanggal_publikasi). Kini tiap angka ditanyakan lewat indeks (yang ada:
-- berita_created_at_idx, sheet_sync_log_started_idx; yang baru: tanggal
-- terbit). Artinya sama persis — termasuk tetap menghitung baris terhapus,
-- seperti sebelumnya. Bagian berindeks lama diukur 0,97 detik.

create index if not exists berita_tanggal_publikasi_idx on public.berita (tanggal_publikasi desc nulls last);

create or replace function public.snapshot_negatif(p_mulai date, p_selesai date)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $function$
  with basis as materialized (
    select b.id, b.judul, b.media, b.platform, b.link, b.tanggal_publikasi, b.created_at,
           b.kategori, b.subkategori, b.subkategori_kode, b.urgensi, b.sentimen, b.nama_upt,
           b.status_verifikasi, b.ai_confidence, b.tier_media, b.tanggapan_sikap, b.kanwil_asal
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
  neg as (
    select * from dasar where sentimen = 'Negatif'
  ),
  lalu as (
    select * from basis where created_at < (p_mulai::timestamp at time zone 'Asia/Jakarta')
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

create or replace function public.kesehatan_asupan()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
with sinkron as (
    select (select max(started_at) from public.sheet_sync_log where status = 'Berhasil') as sukses_terakhir,
           (select max(started_at) from public.sheet_sync_log)                          as coba_terakhir,
           (select count(*) from public.sheet_sync_log
             where started_at > now() - interval '24 hours' and status = 'Gagal')       as gagal_sehari
),
masuk as (
    select (select max(created_at) from public.berita)                                  as baris_terakhir,
           (select count(*) from public.berita where created_at > now() - interval '24 hours') as sehari,
           (select count(*) from public.berita where created_at > now() - interval '7 days')   as sepekan,
           (select count(*) from public.berita
             where created_at > now() - interval '14 days'
               and created_at <= now() - interval '7 days')                             as pekan_lalu
),
terbit as (
    select (select max(tanggal_publikasi) from public.berita) as terbit_terakhir
)
select jsonb_build_object(
    'sinkron_sukses_terakhir', s.sukses_terakhir,
    'sinkron_coba_terakhir',   s.coba_terakhir,
    'sinkron_gagal_sehari',    s.gagal_sehari,
    'sinkron_jeda_menit',      round(extract(epoch from (now() - s.sukses_terakhir)) / 60),
    'baris_terakhir',          m.baris_terakhir,
    'baris_jeda_jam',          round(extract(epoch from (now() - m.baris_terakhir)) / 3600),
    'terbit_terakhir',         t.terbit_terakhir,
    'terbit_jeda_jam',         round(extract(epoch from (now() - t.terbit_terakhir)) / 3600),
    'masuk_sehari',            m.sehari,
    'masuk_sepekan',           m.sepekan,
    'masuk_pekan_lalu',        m.pekan_lalu,
    'perubahan_persen',        case when m.pekan_lalu > 0
                                    then round(((m.sepekan - m.pekan_lalu)::numeric / m.pekan_lalu) * 100)
                                    else null end,
    'status', case
        when s.sukses_terakhir is null
          or s.sukses_terakhir < now() - interval '3 hours'          then 'sinkron-mati'
        when m.baris_terakhir  is null
          or m.baris_terakhir  < now() - interval '48 hours'         then 'asupan-berhenti'
        when m.baris_terakhir  < now() - interval '18 hours'         then 'asupan-melambat'
        when m.pekan_lalu >= 20 and m.sepekan < m.pekan_lalu * 0.4   then 'asupan-menurun'
        else 'sehat'
    end,
    'diperiksa_pada', now()
)
from sinkron s, masuk m, terbit t;
$function$;
