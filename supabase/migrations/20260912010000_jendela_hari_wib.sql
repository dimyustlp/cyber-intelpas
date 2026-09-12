-- Satu arti untuk kata "hari": 00.00 sampai 23.59 WIB.
--
-- Yang diperbaiki. Sampai migrasi ini, dua layar yang menyebut tanggal yang
-- sama menjawab dengan angka yang berbeda, dan tidak ada satu pun galat yang
-- menandainya:
--
--   * Laporan harian Telegram memakai `snapshot_laporan`, yang sejak awal
--     memotong harinya dengan `(created_at at time zone 'Asia/Jakarta')::date`.
--     Benar.
--
--   * Laporan Berkala di layar — ekspor mandiri lewat situs — memakai
--     `snapshot_negatif`, yang memotong harinya dengan
--     `coalesce(tanggal_publikasi, created_at)::date`. Dua kekeliruan sekaligus
--     dalam satu baris: `::date` atas timestamptz memakai zona sesi, dan zona
--     sesi peladen ini UTC, sehingga batas harinya jatuh pukul 07.00 WIB; dan
--     yang dipotong adalah tanggal TERBIT, sedangkan yang dilaporkan adalah
--     berita yang DITANGKAP pada hari itu.
--
-- Untuk 11 September 2026 selisihnya terukur: 429 baris menurut definisi
-- laporan Telegram, 385 baris menurut definisi layar. Empat puluh empat berita
-- yang ada di satu laporan dan tidak ada di laporan lain, untuk tanggal yang
-- sama, tanpa seorang pun bisa menunjuk sebabnya dari layar mana pun.
--
-- Sesudah migrasi ini keduanya memotong hari dengan cara yang sama persis, dan
-- cara itu sama dengan yang sudah dipakai `rincian_negatif_laporan` dan
-- `snapshot_laporan`: hari kalender Jakarta atas `created_at`.
--
-- Kenapa `created_at`, bukan `tanggal_publikasi`. Yang dilaporkan setiap pagi
-- adalah pekerjaan sistem sehari sebelumnya — apa yang tertangkap sepanjang
-- hari itu. Tanggal terbit adalah keterangan tentang beritanya, bukan tentang
-- harinya: sebuah berita yang terbit pekan lalu dan baru tertangkap tadi malam
-- tetap kabar baru bagi yang membaca laporan pagi ini, dan memotongnya menurut
-- tanggal terbit membuatnya tidak pernah muncul di laporan mana pun. Tanggal
-- terbitnya tidak hilang — ia tetap dikirim pada tiap baris sebagai `tanggal`,
-- dan tetap tercetak di laporan.

-- -----------------------------------------------------------------------------
-- 1. snapshot_negatif — bahan mentah Laporan Berkala dan Distribusi Telegram
-- -----------------------------------------------------------------------------

create or replace function public.snapshot_negatif(p_mulai date, p_selesai date)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $function$
  with dasar as (
    select b.*
    from public.berita b
    where b.deleted_at is null
      and coalesce(b.kategori, '') <> 'Di Luar Lingkup'
      and coalesce(b.status_verifikasi, '') not in ('Tidak Valid', 'Diarsipkan')
      and (b.created_at at time zone 'Asia/Jakarta')::date between p_mulai and p_selesai
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
      and (b.created_at at time zone 'Asia/Jakarta')::date
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
        -- Hari yang menentukan baris ini masuk periode, dikirim apa adanya
        -- supaya rekap per hari di layar memakai pemotongan yang sama dengan
        -- yang dipakai memilih barisnya. Tanpa kolom ini, penyusun laporan
        -- mengelompokkan menurut `tanggal` — tanggal terbit — dan grafik
        -- hariannya tidak lagi berjumlah sama dengan angka totalnya sendiri.
        'hari', (n.created_at at time zone 'Asia/Jakarta')::date,
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

-- -----------------------------------------------------------------------------
-- 2. Penjadwal laporan — 05.30 WIB, dan sumbernya ditulis di repo
-- -----------------------------------------------------------------------------
--
-- Yang berjalan di Supabase sudah benar sejak lama: `30 22 * * *` UTC, yaitu
-- 05.30 WIB, memanggil Edge Function `laporan-harian`. Yang tertulis di repo
-- tidak: migrasi 20260901020000 menjadwalkannya `30 23` — 06.30 WIB —
-- memanggil `telegram-kirim`, dan laporan mingguan tidak tertulis sama sekali.
--
-- Selisih itu tidak berakibat apa-apa sampai ada yang memutar ulang migrasi
-- dari awal; pada hari itu jam kirimnya mundur satu jam dan laporan mingguan
-- berhenti terbit, keduanya tanpa satu pun pesan. Blok ini menutupnya dengan
-- menuliskan keadaan yang berjalan, bukan keadaan yang pernah dirancang.
--
-- Urutannya: harian tiap hari pukul 05.30 WIB memuat hari sebelumnya secara
-- utuh (00.00–23.59 WIB); mingguan tiap Minggu pukul 05.30 WIB.

select cron.unschedule('telegram-laporan-harian')
where exists (select 1 from cron.job where jobname = 'telegram-laporan-harian');

select cron.schedule(
  'telegram-laporan-harian',
  '30 22 * * *',
  $CRON$
  select net.http_post(
      url     := 'https://ffcebfslmnhivravwhvm.supabase.co/functions/v1/laporan-harian',
      headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-sync-token', (select decrypted_secret
                             from vault.decrypted_secrets
                            where name = 'SHEET_SYNC_TOKEN'
                            limit 1)
      ),
      body    := jsonb_build_object('jenis', 'harian', 'oleh', 'Penjadwal Harian'),
      timeout_milliseconds := 120000
  );
  $CRON$
);

select cron.unschedule('telegram-laporan-mingguan')
where exists (select 1 from cron.job where jobname = 'telegram-laporan-mingguan');

select cron.schedule(
  'telegram-laporan-mingguan',
  '30 22 * * 0',
  $CRON$
  select net.http_post(
      url     := 'https://ffcebfslmnhivravwhvm.supabase.co/functions/v1/laporan-harian',
      headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-sync-token', (select decrypted_secret
                             from vault.decrypted_secrets
                            where name = 'SHEET_SYNC_TOKEN'
                            limit 1)
      ),
      body    := jsonb_build_object('jenis', 'mingguan', 'oleh', 'Penjadwal Mingguan'),
      timeout_milliseconds := 120000
  );
  $CRON$
);
