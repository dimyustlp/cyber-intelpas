-- Publikasi negatif satu periode, apa adanya, untuk lampiran laporan harian.
--
-- Pesan Telegram harian sudah memuat angkanya. Yang belum pernah ada adalah
-- uraiannya: pimpinan membaca "Negatif: 62" tanpa satu pun cara mengetahui 62
-- itu tentang apa, kecuali membuka dasbor. Dalam praktik, tidak ada yang
-- membukanya sampai seseorang bertanya.
--
-- KENAPA FUNGSI INI TIDAK MENGELOMPOKKAN APA PUN
--
-- Versi pertama fungsi ini mengelompokkan sendiri menurut kategori dan
-- subkategori, dan hasilnya terlihat benar sampai PDF-nya dibaca: enam dari
-- tujuh belas butir ternyata satu kejadian yang sama — pelarian satu narapidana
-- dari Rutan Sukadana — yang diberitakan enam media berbeda. Laporan yang
-- mengulang satu peristiwa enam kali membuat pembacanya berhenti membaca.
--
-- Layar sudah punya jawabannya: `kelompokkanPeristiwa()` di lib/peristiwa.js,
-- yang dipakai dasbor, halaman Kanal Negatif, dan laporan di layar. Fungsi itu
-- tinggal di JavaScript dan menimbang kemiripan kosakata, jarak hari, serta
-- kesamaan unit — pekerjaan yang tidak pantas ditulis ulang dalam SQL hanya
-- supaya terjadi di tempat yang berbeda. Bila ditulis ulang, angka "peristiwa"
-- pada lampiran dan angka di layar akan berselisih untuk hari yang sama.
--
-- Maka pembagian tugasnya: SQL memutuskan berita mana yang ikut dihitung,
-- JavaScript memutuskan bagaimana ia dikelompokkan.
--
-- ATURAN YANG TIDAK BOLEH DILANGGAR
--
-- Penyaring di bawah harus sama persis dengan `snapshot_laporan`. Sistem ini
-- pernah kehilangan kepercayaan karena angka dasbor dan angka lencana
-- berselisih; sebuah lampiran yang menguraikan 62 berita padahal pesannya
-- menyebut 58 akan menghabiskannya lagi, kali ini di depan pimpinan.

create or replace function public.rincian_negatif_laporan(
  p_mulai date,
  p_selesai date,
  p_batas int default 400
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  hasil jsonb;
begin
  with p as (
    select b.*
    from public.berita b
    where b.deleted_at is null
      and coalesce(b.status_verifikasi, '') not in ('Tidak Valid', 'Diarsipkan')
      and coalesce(b.kategori, '') <> 'Di Luar Lingkup'
      and (b.created_at at time zone 'Asia/Jakarta')::date between p_mulai and p_selesai
  ),
  neg as (
    select p.*, u.kanwil, u.provinsi
    from p left join public.upt u on u.nama_upt = p.nama_upt
    where p.sentimen = 'Negatif'
  ),
  -- Urutan baca ditentukan urgensi lebih dulu, baru waktu masuk. Petugas yang
  -- hanya sempat membaca satu halaman harus menemukan yang paling mendesak di
  -- halaman itu. `count(*) over ()` menghitung seluruhnya sebelum dipotong,
  -- sehingga jumlah yang dilaporkan tetap jumlah sebenarnya.
  urut as (
    select neg.*,
      count(*) over () as n_semua,
      row_number() over (
        order by case coalesce(urgensi,'')
                   when 'Kritis' then 1 when 'Tinggi' then 2
                   when 'Sedang' then 3 when 'Rendah' then 4 else 5 end,
                 created_at desc
      ) as urutan
    from neg
  )
  select jsonb_build_object(
    'periode',   jsonb_build_object('mulai', p_mulai, 'selesai', p_selesai),
    'jumlah',    coalesce((select max(n_semua) from urut), 0),
    'diambil',   least(coalesce((select max(n_semua) from urut), 0), p_batas),
    'batas',     p_batas,
    -- Nama medannya sengaja sama dengan nama kolom `berita`, sebab
    -- kelompokkanPeristiwa() membaca medan itu apa adanya. Menamainya ulang di
    -- sini berarti satu tempat lagi yang harus ikut berubah bila modulnya
    -- berubah.
    'publikasi', coalesce((
      select jsonb_agg(jsonb_build_object(
        'judul',            coalesce(nullif(btrim(judul),''), '(tanpa judul)'),
        'ringkasan',        coalesce(ringkasan, ''),
        'kategori',         coalesce(nullif(kategori,''), 'Lainnya'),
        'subkategori',      coalesce(nullif(subkategori,''), 'Belum Dikelompokkan'),
        'subkategori_kode', coalesce(subkategori_kode, ''),
        'nama_upt',         coalesce(nama_upt, ''),
        'kanwil',           coalesce(kanwil, ''),
        'provinsi',         coalesce(provinsi, ''),
        'sentimen',         coalesce(sentimen, ''),
        'urgensi',          coalesce(nullif(urgensi,''), 'Tidak dinilai'),
        'media',            coalesce(media, ''),
        'platform',         coalesce(platform, ''),
        'link',             coalesce(link, ''),
        'tanggal_publikasi', tanggal_publikasi,
        'created_at',       created_at
      ) order by urutan)
      from urut where urutan <= p_batas), '[]'::jsonb)
  ) into hasil;

  return hasil;
end;
$$;

revoke all on function public.rincian_negatif_laporan(date, date, int)
  from public, anon, authenticated;

grant execute on function public.rincian_negatif_laporan(date, date, int)
  to authenticated;

comment on function public.rincian_negatif_laporan(date, date, int) is
  'Publikasi negatif satu periode, apa adanya. Pengelompokan menjadi peristiwa '
  'dikerjakan lib/peristiwa.js, bukan di sini. Penyaringnya WAJIB sama dengan '
  'snapshot_laporan.';

-- Bentuk lama fungsi ini punya empat parameter dan mengelompokkan sendiri.
-- Ia dibuang supaya tidak ada dua bentuk yang bisa dipanggil.
drop function if exists public.rincian_negatif_laporan(date, date, int, int);
