-- ============================================================================
-- Unit yang naik ke permukaan
-- ----------------------------------------------------------------------------
-- Laporan berkala dan pesan Telegram selama ini menyebut UPT paling disorot
-- sebagai deret nama beserta angkanya: "Lapas A (8), Rutan B (6), Lapas C (4)".
-- Angka itu benar dan hampir tidak berguna. Delapan berita di unit yang pekan
-- lalu juga delapan adalah keadaan tenang; delapan di unit yang pekan lalu nol
-- adalah keadaan yang harus dibaca malam itu juga — dan keduanya tercetak
-- sebagai baris yang sama persis.
--
-- Migrasi ini menambahkan pembandingnya, di satu tempat, supaya ketiga
-- pemakainya membaca angka yang sama:
--
--   1. `snapshot_negatif` mengembalikan `unit_lalu` — jumlah publikasi negatif
--      per unit pada periode sepanjang periode yang diminta, tepat sebelumnya.
--      Dipakai halaman Laporan Berkala, berkas laporannya, dan pesan Telegram
--      yang disusun peramban.
--
--   2. `pesan_harian_telegram` memuat diagram batang tujuh hari terakhir.
--      Pesan hariannya tetap tentang hari kemarin; yang ditambahkan adalah
--      satu blok yang menjawab pertanyaan yang tidak bisa dijawab angka
--      harian — unit mana yang sepekan ini naik ke permukaan.
--
-- Keduanya CREATE OR REPLACE atas fungsi yang sudah ada. Tidak ada tabel yang
-- disentuh, dan tidak ada kolom yang berubah bentuk.
-- ============================================================================

-- --- 1. snapshot_negatif: tambah unit_lalu ----------------------------------

create or replace function public.snapshot_negatif(p_mulai date, p_selesai date)
returns jsonb
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
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
    /*
       Jumlah publikasi negatif per unit pada periode PEMBANDING.

       Hanya yang negatif, supaya sebanding dengan `publikasi` di bawah yang
       juga hanya negatif. Membandingkan delapan berita negatif pekan ini
       dengan dua puluh berita apa saja pekan lalu akan terbaca sebagai
       penurunan, padahal yang terjadi kebalikannya.

       Unit yang belum terpetakan tidak dihitung — sama seperti di peta sebaran
       dan di seluruh rekap per unit. Berita yang unitnya tidak diketahui tidak
       boleh jatuh ke unit mana pun.
    */
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

comment on function public.snapshot_negatif(date, date) is
  'Bahan mentah laporan berkala. Sejak 2 September 2026 memuat unit_lalu: '
  'jumlah publikasi negatif per unit pada periode pembanding, dipakai bagan '
  'batang "UPT naik ke permukaan".';

-- --- 2. pesan_harian_telegram: diagram batang tujuh hari ---------------------

create or replace function public.pesan_harian_telegram(p_tanggal date default null::date)
returns text
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  hari       date := coalesce(p_tanggal, ((now() at time zone 'Asia/Jakarta')::date - 1));
  s          jsonb;
  ikh        jsonb;
  bnd        jsonb;
  teks       text;
  baris      text := '';
  batang     text := '';
  n_total    int;
  n_negatif  int;
  n_positif  int;
  n_netral   int;
  n_kritis   int;
  n_tinggi   int;
  n_lalu     int;
  selisih    int;
  arah       text;
  keadaan    text;
  r          record;
  urut       int := 0;
  puncak     int := 0;
begin
  s   := public.snapshot_laporan(hari, hari);
  ikh := s->'ikhtisar';
  bnd := s->'pembanding';

  n_total   := coalesce((ikh->>'total')::int, 0);
  n_negatif := coalesce((ikh->>'negatif')::int, 0);
  n_positif := coalesce((ikh->>'positif')::int, 0);
  n_netral  := coalesce((ikh->>'netral')::int, 0);
  n_kritis  := coalesce((ikh->>'kritis')::int, 0);
  n_tinggi  := coalesce((ikh->>'tinggi')::int, 0);
  n_lalu    := coalesce((bnd->>'total')::int, 0);

  -- Tidak ada data bukan kegagalan, dan tidak boleh disamarkan sebagai laporan.
  if n_total = 0 then
    return '<b>Laporan Harian Trans-Siber PAS</b>' || chr(10)
        || to_char(hari, 'DD-MM-YYYY') || chr(10) || chr(10)
        || 'Tidak ada publikasi yang tercatat pada tanggal ini. '
        || 'Bila ini di luar dugaan, periksa halaman Sinkronisasi Sumber — '
        || 'kosongnya data lebih sering berarti penarikan terhenti daripada berarti tidak ada berita.';
  end if;

  -- Keadaan ditentukan oleh urgensi lebih dulu, baru oleh proporsi negatif.
  if n_kritis > 0 then
    keadaan := '🔴 <b>PERLU PERHATIAN SEGERA</b>';
  elsif n_tinggi > 0 or (n_negatif::numeric / greatest(n_total,1)) >= 0.35 then
    keadaan := '🟠 <b>PERLU DICERMATI</b>';
  else
    keadaan := '🟢 <b>TERKENDALI</b>';
  end if;

  selisih := n_total - n_lalu;
  arah := case
            when n_lalu = 0 then 'tidak ada pembanding kemarin'
            when selisih > 0 then 'naik ' || selisih || ' dari kemarin'
            when selisih < 0 then 'turun ' || abs(selisih) || ' dari kemarin'
            else 'sama dengan kemarin'
          end;

  teks := '<b>Laporan Harian Trans-Siber PAS</b>' || chr(10)
       || to_char(hari, 'DD-MM-YYYY') || chr(10) || chr(10)
       || keadaan || chr(10) || chr(10)
       || '<b>Publikasi:</b> ' || n_total || ' (' || arah || ')' || chr(10)
       || '• Negatif: ' || n_negatif || chr(10)
       || '• Netral: '  || n_netral  || chr(10)
       || '• Positif: ' || n_positif || chr(10);

  if n_kritis > 0 or n_tinggi > 0 then
    teks := teks || '<b>Urgensi:</b> ' || n_kritis || ' kritis, ' || n_tinggi || ' tinggi' || chr(10);
  end if;

  teks := teks || '<b>UPT tersorot:</b> ' || coalesce(ikh->>'upt_tersorot','0')
               || '  |  <b>Media:</b> ' || coalesce(ikh->>'media_unik','0') || chr(10);

  /*
     Diagram batang tujuh hari terakhir.

     Blok ini menjawab pertanyaan yang tidak bisa dijawab angka harian: unit
     mana yang sepekan ini naik ke permukaan. Rentangnya tujuh hari yang
     berakhir pada hari yang dilaporkan, dan pembandingnya tujuh hari tepat
     sebelumnya — sama persis dengan aturan `uptNaik` di web/js/lib/hitung.js,
     supaya angka di Telegram dan angka di layar tidak pernah berbeda.

     Batangnya dibuat dari karakter blok di dalam <code>, bukan dari gambar.
     Telegram tidak menggambarkan apa pun di dalam pesan, dan lampiran PDF
     baru terbuka setelah seseorang menekannya — sedangkan yang harus terbaca
     dalam sepuluh detik adalah blok ini.
  */
  select max(j) into puncak from (
    select count(*)::int as j
    from public.berita b
    where b.deleted_at is null
      and coalesce(b.kategori, '') <> 'Di Luar Lingkup'
      and coalesce(b.status_verifikasi, '') not in ('Tidak Valid', 'Diarsipkan')
      and b.sentimen = 'Negatif'
      and coalesce(b.nama_upt, '') <> ''
      and b.nama_upt not ilike 'belum%'
      and b.nama_upt not ilike 'tidak%'
      and coalesce(b.tanggal_publikasi, b.created_at)::date between hari - 6 and hari
    group by b.nama_upt
  ) t;

  if coalesce(puncak, 0) > 0 then
    for r in
      with pekan as (
        select b.nama_upt, count(*)::int as jumlah
        from public.berita b
        where b.deleted_at is null
          and coalesce(b.kategori, '') <> 'Di Luar Lingkup'
          and coalesce(b.status_verifikasi, '') not in ('Tidak Valid', 'Diarsipkan')
          and b.sentimen = 'Negatif'
          and coalesce(b.nama_upt, '') <> ''
          and b.nama_upt not ilike 'belum%'
          and b.nama_upt not ilike 'tidak%'
          and coalesce(b.tanggal_publikasi, b.created_at)::date between hari - 6 and hari
        group by b.nama_upt
      ),
      pekan_lalu as (
        select b.nama_upt, count(*)::int as jumlah
        from public.berita b
        where b.deleted_at is null
          and coalesce(b.kategori, '') <> 'Di Luar Lingkup'
          and coalesce(b.status_verifikasi, '') not in ('Tidak Valid', 'Diarsipkan')
          and b.sentimen = 'Negatif'
          and coalesce(b.nama_upt, '') <> ''
          and coalesce(b.tanggal_publikasi, b.created_at)::date between hari - 13 and hari - 7
        group by b.nama_upt
      )
      select
        replace(replace(replace(p.nama_upt, '&','&amp;'), '<','&lt;'), '>','&gt;') as nama,
        p.jumlah,
        coalesce(l.jumlah, 0) as sebelum,
        p.jumlah - coalesce(l.jumlah, 0) as delta
      from pekan p left join pekan_lalu l on l.nama_upt = p.nama_upt
      -- Diurutkan menurut jumlah, bukan menurut kenaikan. Kenaikan terbesar
      -- hampir selalu dimiliki unit yang pekan lalu nol dan pekan ini dua, dan
      -- daftar yang dipimpin unit berberita dua tidak menjawab pertanyaan
      -- siapa pun. Kenaikannya tetap tercetak pada tiap baris.
      order by p.jumlah desc, delta desc, p.nama_upt asc
      limit 5
    loop
      batang := batang
        || '• ' || left(r.nama, 60) || chr(10)
        || '   <code>'
        || repeat('█', greatest(1, round(r.jumlah::numeric / puncak * 12)::int))
        || '</code> ' || r.jumlah
        || case
             when r.sebelum = 0 then ' — <b>baru muncul</b>'
             when r.delta > 0  then ' — naik ' || r.delta
             when r.delta < 0  then ' — turun ' || abs(r.delta)
             else ' — tetap'
           end
        || chr(10);
    end loop;

    teks := teks || chr(10)
         || '<b>UPT naik ke permukaan — 7 hari terakhir</b>' || chr(10)
         || '<i>Publikasi negatif, dibandingkan tujuh hari sebelumnya.</i>' || chr(10)
         || batang;
  end if;

  -- Tiga isu teratas. Judul dilepas tanda HTML-nya karena Telegram menolak
  -- SELURUH pesan bila ada satu tanda yang tidak sah, bukan hanya baris itu.
  for r in
    select
      replace(replace(replace(coalesce(p->>'judul','(tanpa judul)'), '&','&amp;'), '<','&lt;'), '>','&gt;') as judul,
      replace(replace(replace(coalesce(nullif(p->>'upt',''),'Belum terpetakan'), '&','&amp;'), '<','&lt;'), '>','&gt;') as upt,
      coalesce(p->>'urgensi','-') as urgensi
    from jsonb_array_elements(s->'prioritas') p
    limit 3
  loop
    urut := urut + 1;
    baris := baris || urut || '. ' || left(r.judul, 150) || chr(10)
                   || '    <i>' || r.upt || ' — ' || r.urgensi || '</i>' || chr(10);
  end loop;

  if urut > 0 then
    teks := teks || chr(10) || '<b>Perlu dibaca lebih dulu:</b>' || chr(10) || baris;
  end if;

  teks := teks || chr(10) || '<i>Rincian lengkap tersedia pada dasbor Trans-Siber PAS.</i>';

  -- Telegram menolak pesan di atas 4096 karakter secara utuh.
  return left(teks, 3900);
end;
$function$;

comment on function public.pesan_harian_telegram(date) is
  'Pesan harian untuk grup pimpinan. Sejak 2 September 2026 memuat diagram '
  'batang "UPT naik ke permukaan" tujuh hari terakhir beserta pembandingnya.';
