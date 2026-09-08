-- ============================================================================
-- Menutup keran alamat pengalih Google News, untuk seterusnya
-- ============================================================================
--
-- Migrasi sebelumnya membersihkan 24 baris yang menumpuk. Satu baris baru
-- muncul beberapa menit kemudian — jadi yang dibersihkan tadi gejalanya, bukan
-- sebabnya.
--
-- SEBABNYA ADA DI DUA TEMPAT, DAN KEDUANYA BUKAN CACAT
--
--   1. Lembar pusat Ditpamintel (`public_csv_sync`) memuat alamat pengalih
--      Google News yang ditempel manusia. Penyalin menyalinnya dengan setia;
--      ia memang tugasnya begitu.
--
--   2. `perbaikiAlamat()` di Edge Function `penjaring` menguraikan alamat itu
--      dengan benar, lalu MENOLAK menuliskannya karena alamat hasilnya sudah
--      dipakai baris lain. Penolakan itu benar — indeks unik sedang bekerja
--      sebagaimana mestinya.
--
-- Yang tidak ada selama ini adalah langkah ketiga: seseorang merapikan baris
-- yang sudah terbukti kembar. Komentar di `perbaikiAlamat()` menyebutnya
-- "dirapikan analis", dan selama enam pekan tidak ada analis yang tahu ia
-- diminta. Akibatnya baris yang sama terpilih ulang tiap sepuluh menit sejak
-- 6 Agustus, masing-masing berharga permintaan ke Google, untuk pekerjaan yang
-- tidak akan pernah bisa selesai.
--
-- KENAPA DIKERJAKAN DI SQL, BUKAN DI DALAM `penjaring`
--
-- Menyunting Edge Function menuntut penggelaran ulang, dan `deploy_edge_function`
-- mengganti SELURUH berkas — satu berkas yang lupa dikirim membuat fungsinya
-- gagal dibundel. Pekerjaan ini tidak perlu jaringan sama sekali: seluruh
-- bahannya sudah ada di basis data. Yang tidak perlu digelar, jangan digelar.

create or replace function public.rapikan_kembar_google(p_batas int default 200)
returns table (dirapikan int, tersisa int)
language plpgsql
as $fn$
declare
  v_dirapikan int;
  v_tersisa int;
begin
  with sasaran as (
    select b.id,
           (select a.id from public.berita a
             where a.link_normalized = public.normalkan_tautan(pa.url)
               and a.id <> b.id
               and a.deleted_at is null
             order by a.created_at asc
             limit 1) as asli_id
    from public.berita b
    join public.penjaring_alamat pa
      on pa.gnews_id = split_part(
           split_part(coalesce(b.link_normalized, b.link), '/articles/', 2), '?', 1)
    where b.domain_media = 'news.google.com'
      and b.deleted_at is null
      and pa.url is not null
    limit p_batas
  )
  update public.berita b
  set deleted_at = now(),
      -- Ditautkan ke artikel aslinya, bukan sekadar dibuang. Kalau nanti ada
      -- yang bertanya "kenapa berita ini hilang", jawabannya ada di barisnya.
      induk_id = coalesce(s.asli_id, b.induk_id),
      catatan = trim(both ' ' from coalesce(b.catatan, '') ||
        ' [rapikan_kembar_google] Alamat pengalih Google News; artikel aslinya sudah tersimpan di arsip.')
  from sasaran s
  where s.id = b.id and s.asli_id is not null;

  get diagnostics v_dirapikan = row_count;

  select count(*) into v_tersisa
  from public.berita
  where domain_media = 'news.google.com' and deleted_at is null;

  return query select v_dirapikan, v_tersisa;
end;
$fn$;

comment on function public.rapikan_kembar_google(int) is
  'Menghapus lunak baris beralamat pengalih Google News yang artikel aslinya sudah ada di arsip, lalu menautkannya ke artikel itu. Hanya menyentuh yang alamat aslinya SUDAH terurai di penjaring_alamat - yang belum terurai dibiarkan agar `perbaiki` masih bisa menyelamatkannya.';

-- Tiap jam pada menit ke-7, menjauh dari menit-menit sibuk penjaring
-- (0,2,5,10,12,15,20,22,25,...). Berjam-jam sekali sudah cukup: yang
-- dirapikannya bukan berita baru melainkan sisa yang tidak akan ke mana-mana.
select cron.schedule(
  'rapikan-kembar-google',
  '7 * * * *',
  $cron$ select public.rapikan_kembar_google(200) $cron$
);
