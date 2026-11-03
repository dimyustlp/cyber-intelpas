-- Laporan Berkala gagal dengan "canceling statement due to statement timeout".
--
-- Sebabnya bukan fungsi laporannya, melainkan aturan baca tabel berita. Policy
-- berita_select_scoped memanggil can_access_berita(nama_upt, kanwil_asal) untuk
-- SETIAP baris, dan fungsi itu sendiri membaca app_users dua sampai tiga kali.
-- Diukur 3 November 2026 sebagai super_admin di 33.508 baris:
--
--   count(*) seluruh berita        9,96 detik
--   snapshot_negatif 7 hari       34,29 detik
--   snapshot_negatif 30 hari      20,57 detik
--
-- Batas peran authenticated 8 detik, jadi laporan mingguan dan bulanan tidak
-- pernah bisa selesai. Harian kadang lolos, kadang tidak.
--
-- Perbaikannya: pertanyaan "apakah orang ini boleh melihat SEMUA berita?"
-- dijawab sekali per kueri. Bentuk `(select fungsi())` membuat Postgres
-- menghitungnya sebagai InitPlan, satu kali, lalu memakai hasilnya untuk setiap
-- baris. Peran pusat langsung lolos; peran kanwil dan UPT tetap jatuh ke
-- pemeriksaan per baris yang lama, sehingga cakupannya tidak berubah sedikit
-- pun. Sesudah perbaikan: 0,03 / 0,67 / 0,96 detik.
--
-- akses_berita_semua() sengaja menyalin cabang `else` can_access_upt: pengguna
-- aktif tanpa UPT dan tanpa kanwil, dengan salah satu peran pusat. Kalau daftar
-- peran pusat berubah, keduanya harus diubah bersama.

create or replace function public.akses_berita_semua()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select nullif(u.assigned_upt, '') is null
       and nullif(u.assigned_kanwil, '') is null
       and u.role in (
         'super_admin',
         'media_intelligence_analyst',
         'evaluation_recommendation_analyst',
         'executive_decision_maker',
         'news_data_operator',
         'field_verification_officer'
       )
    from public.app_users u
    where u.auth_user_id = auth.uid()
      and u.aktif is true
      and u.deleted_at is null
    limit 1
  ), false);
$$;

revoke all on function public.akses_berita_semua() from public, anon;
grant execute on function public.akses_berita_semua() to authenticated;

comment on function public.akses_berita_semua() is
  'Benar bila pengguna boleh membaca seluruh berita. Dipanggil sebagai (select ...) di policy supaya dihitung sekali per kueri.';

drop policy if exists berita_select_scoped on public.berita;
create policy berita_select_scoped on public.berita
  for select to authenticated
  using (
    deleted_at is null
    and ((select public.akses_berita_semua()) or public.can_access_berita(nama_upt, kanwil_asal))
  );

drop policy if exists berita_attachments_select on public.berita_attachments;
create policy berita_attachments_select on public.berita_attachments
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.berita b
      where b.id::text = berita_attachments.berita_id
        and b.deleted_at is null
        and ((select public.akses_berita_semua()) or public.can_access_upt(b.nama_upt))
    )
  );

drop policy if exists berita_status_history_select on public.berita_status_history;
create policy berita_status_history_select on public.berita_status_history
  for select to authenticated
  using (
    exists (
      select 1 from public.berita b
      where b.id::text = berita_status_history.berita_id
        and ((select public.akses_berita_semua()) or public.can_access_upt(b.nama_upt))
    )
  );

drop policy if exists cases_select_all on public.intelligence_cases;
create policy cases_select_all on public.intelligence_cases
  for select to authenticated
  using (
    (select public.has_role('super_admin', 'media_intelligence_analyst',
                            'evaluation_recommendation_analyst', 'executive_decision_maker'))
    or public.can_access_upt(primary_upt)
  );

-- Saringan hari di snapshot_negatif (dipanggil Laporan Berkala dengan hak
-- pembacanya sendiri) ditulis ulang dari
--   (created_at at time zone 'Asia/Jakarta')::date between a and b
-- menjadi rentang waktu biasa. Artinya sama persis (hari kalender WIB menurut
-- waktu tangkap), tetapi bentuk baru bisa memakai indeks berita_created_at_idx;
-- bentuk lama memaksa membaca seluruh tabel dua kali.

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
      and b.created_at >= (p_mulai::timestamp at time zone 'Asia/Jakarta')
      and b.created_at <  ((p_selesai + 1)::timestamp at time zone 'Asia/Jakarta')
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
      and b.created_at >= ((p_mulai - (p_selesai - p_mulai + 1))::timestamp at time zone 'Asia/Jakarta')
      and b.created_at <  (p_mulai::timestamp at time zone 'Asia/Jakarta')
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
        -- Bahan evaluasi sumber dan informasi SIP 2023 (web/js/lib/sip.js).
        'tier_media', n.tier_media,
        'tanggapan_sikap', n.tanggapan_sikap,
        'provinsi', u.provinsi,
        'kanwil', coalesce(n.kanwil_asal, u.kanwil))
        order by coalesce(n.tanggal_publikasi, n.created_at) desc)
      from neg n left join public.upt u on u.nama_upt = n.nama_upt), '[]'::jsonb),
    'dibuat_pada', now()
  );
$function$;
