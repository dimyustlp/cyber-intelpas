/*
  ============================================================================
  PENERUS JARINGAN DAN PENJADWALNYA
  ============================================================================

  KENAPA GOOGLE DIHUBUNGI LEWAT BASIS DATA, BUKAN LEWAT EDGE FUNCTION

  Diukur langsung 6 September 2026, dengan permintaan yang sama persis ke alamat
  yang sama pada menit yang sama:

    dari Edge Function   news.google.com  ->  503
    dari basis data      news.google.com  ->  200, 100 butir

  Keduanya milik proyek yang sama. Yang berbeda alamat IP keluarnya: Edge
  Function berjalan di jaringan Deno Deploy yang dipakai bersama ribuan proyek
  lain, dan Google menolak seluruh julat itu. Basis datanya punya alamat sendiri.

  Diuji berulang selama satu jam dengan jeda: hasilnya tetap. Tanpa penerus ini,
  tiga dari empat mode penjaring — umum, isu, unit — tidak akan pernah
  mengembalikan satu butir pun, dan yang terlihat di jurnal adalah "0 butir
  terlihat" yang mudah dibaca sebagai "tidak ada beritanya".

  Umpan portal (ANTARA dan kawan-kawan) TIDAK lewat sini. Portal-portal itu
  menjawab Edge Function dengan baik, dan melewatkannya ke basis data hanya
  menambah satu mata rantai yang bisa patah.

  KENAPA ALAMATNYA DIBATASI

  `jaring_minta` berjalan SECURITY DEFINER — ia menembus RLS dan memakai hak
  pemilik fungsinya. Fungsi semacam itu yang menerima alamat apa pun adalah
  lubang SSRF: siapa pun yang bisa memanggilnya bisa menyuruh basis data
  menghubungi alamat internal, termasuk yang hanya terjangkau dari dalam.

  Karena itu hanya `https://news.google.com/` yang dilewatkan, dan haknya hanya
  diberikan kepada service_role. Peran anon dan authenticated dicabut secara
  tegas, bukan sekadar tidak diberikan.
*/

/* ================================================== simpanan alamat Google */

/*
  RSS Google News tidak pernah memberi alamat artikelnya; yang diberikan alamat
  pengalihan miliknya sendiri (news.google.com/rss/articles/AU_yqL...). Alamat
  itu TIDAK BOLEH ditulis ke tabel berita — ia berbeda untuk artikel yang sama
  dilihat dari sumber lain, sehingga menembus seluruh lapis penyaringan kembar.

  Menguraikannya mahal: satu unduhan halaman ±600 KB untuk mengambil tanda
  tangan artikel, lalu satu POST ke titik batchexecute Google. Tanda tangannya
  terikat pada artikel itu sendiri — dicoba dengan tanda tangan artikel lain,
  Google membalas kosong — jadi tidak ada jalan memotongnya.

  Yang bisa dipotong adalah PENGULANGANNYA. Satu artikel bertahan berminggu-
  minggu di dalam umpan, dan muncul di beberapa kueri sekaligus.
*/
create table if not exists public.penjaring_alamat (
  gnews_id   text primary key,
  url        text,
  dibuat_at  timestamptz not null default now(),
  percobaan  integer not null default 1
);

comment on table public.penjaring_alamat is
  'Simpanan hasil penguraian alamat Google News. url NULL berarti pernah dicoba dan gagal.';

create index if not exists penjaring_alamat_umur_idx on public.penjaring_alamat (dibuat_at);

alter table public.penjaring_alamat enable row level security;

drop policy if exists penjaring_alamat_baca on public.penjaring_alamat;
create policy penjaring_alamat_baca on public.penjaring_alamat
  for select using (public.has_role(variadic array[
    'super_admin', 'media_intelligence_analyst', 'news_data_operator']));

/* ============================================================ penerus HTTP */

create or replace function public.jaring_minta(
  p_url     text,
  p_headers jsonb default '{}'::jsonb,
  p_metode  text  default 'GET'
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_url !~ '^https://news\.google\.com/' then
    raise exception 'Alamat tidak diizinkan penerus penjaring: %', left(p_url, 120);
  end if;

  if upper(coalesce(p_metode, 'GET')) = 'POST' then
    /*
      Badannya sengaja kosong dan f.req dititipkan di query string.

      pg_net menolak Content-Type selain application/json, sedangkan
      batchexecute Google menuntut form-urlencoded pada badan permintaan —
      jalan buntu. Diuji 6 September 2026: Google MENERIMA f.req sebagai
      parameter query pada permintaan POST berbadan JSON, dan membalas alamat
      artikelnya dengan benar. (Dengan metode GET ia membalas 405.)
    */
    select net.http_post(
      url                  := p_url,
      body                 := '{}'::jsonb,
      headers              := p_headers || jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 45000
    ) into v_id;
  else
    select net.http_get(
      url                  := p_url,
      headers              := p_headers,
      timeout_milliseconds := 45000
    ) into v_id;
  end if;

  return v_id;
end;
$$;

comment on function public.jaring_minta(text, jsonb, text) is
  'Meneruskan satu permintaan ke news.google.com lewat pg_net. Hanya alamat itu yang diizinkan.';

create or replace function public.jaring_hasil(p_ids bigint[])
returns table (id bigint, status_code integer, isi text, galat text)
language sql
security definer
set search_path = public
as $$
  select r.id, r.status_code, r.content, r.error_msg
  from net._http_response r
  where r.id = any(p_ids);
$$;

comment on function public.jaring_hasil(bigint[]) is
  'Membaca jawaban permintaan yang dititipkan lewat jaring_minta. Baris yang belum ada berarti permintaannya masih berjalan.';

revoke all on function public.jaring_minta(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.jaring_hasil(bigint[])          from public, anon, authenticated;
grant execute on function public.jaring_minta(text, jsonb, text) to service_role;
grant execute on function public.jaring_hasil(bigint[])          to service_role;

/* ====================================================== pemanggil penjadwal */

/*
  Batas waktunya sengaja PENDEK — 15 detik untuk pekerjaan yang memakan satu
  menit. Itu bukan kekeliruan.

  Penjadwal memanggil fungsi ini lewat pg_net, dan permintaan Google-nya juga
  lewat pg_net. Antreannya satu dan dikerjakan per gelombang. Selama panggilan
  penjadwal masih menunggu jawaban, permintaan yang ditunggu fungsi itu berada
  DI BELAKANGNYA di antrean yang sama — terukur 6 September 2026: permintaan
  yang biasanya dijawab dalam hitungan detik baru dijawab 110 detik kemudian,
  sesudah fungsinya menyerah dan pulang dengan tangan kosong.

  Fungsi penjaring karena itu menjawab seketika lalu bekerja di latar
  (EdgeRuntime.waitUntil). Hasilnya dibaca dari `penjaring_log`, bukan dari
  jawaban panggilan ini — dan memang di situlah tempatnya, sebab panggilan
  terjadwal tidak punya siapa pun yang membaca jawabannya.
*/
create or replace function public.panggil_penjaring(p_badan jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  select net.http_post(
    url     := 'https://ffcebfslmnhivravwhvm.supabase.co/functions/v1/penjaring',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-sync-token', (select decrypted_secret from vault.decrypted_secrets
                        where name = 'SHEET_SYNC_TOKEN' limit 1)),
    body    := p_badan,
    timeout_milliseconds := 15000
  ) into v_id;
  return v_id;
end $$;

create or replace function public.panggil_notifikasi(p_badan jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  select net.http_post(
    url     := 'https://ffcebfslmnhivravwhvm.supabase.co/functions/v1/notifikasi',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-sync-token', (select decrypted_secret from vault.decrypted_secrets
                        where name = 'SHEET_SYNC_TOKEN' limit 1)),
    body    := p_badan,
    timeout_milliseconds := 60000
  ) into v_id;
  return v_id;
end $$;

revoke all on function public.panggil_penjaring(jsonb)  from public, anon, authenticated;
revoke all on function public.panggil_notifikasi(jsonb) from public, anon, authenticated;

/* =============================================================== penjadwal */

/*
  Empat mode dijalankan pada menit yang berbeda, bukan bersamaan.

  Tiga di antaranya menghubungi Google lewat antrean pg_net yang sama; menaruh
  ketiganya pada menit yang sama berarti mereka saling menunggu, dan yang
  terakhir selalu yang paling sering kehabisan waktu. Selisih lima menit
  membuat tiap mode mendapat antrean yang lapang.
*/
select cron.schedule('penjaring-umpan',   '*/30 * * * *',
  $$select public.panggil_penjaring('{"aksi":"jaring","mode":"umpan","batas_umpan":44}'::jsonb)$$);

select cron.schedule('penjaring-umum',    '5,25,45 * * * *',
  $$select public.panggil_penjaring('{"aksi":"jaring","mode":"umum","batas_kueri":4,"batas_uraikan":30}'::jsonb)$$);

select cron.schedule('penjaring-isu',     '10,30,50 * * * *',
  $$select public.panggil_penjaring('{"aksi":"jaring","mode":"isu","batas_kueri":6,"batas_uraikan":30}'::jsonb)$$);

select cron.schedule('penjaring-unit',    '15,35,55 * * * *',
  $$select public.panggil_penjaring('{"aksi":"jaring","mode":"unit","batas_kueri":10,"batas_uraikan":25}'::jsonb)$$);

/* Membereskan 605 alamat pengalihan Google yang terlanjur tersimpan sejak
   sebelum sistem ini ada. Empat puluh sekali jalan, enam kali sejam. */
select cron.schedule('penjaring-perbaiki', '2,12,22,32,42,52 * * * *',
  $$select public.panggil_penjaring('{"aksi":"perbaiki","batas":40}'::jsonb)$$);

select cron.schedule('notifikasi-kirim',   '*/5 * * * *',
  $$select public.panggil_notifikasi('{"aksi":"kirim"}'::jsonb)$$);

/*
  Dua penjadwal lama disetel ulang.

  sheet-sync membaca 869 baris dan menyisipkan nol hampir setiap kali; lembarnya
  hanya bertambah beberapa baris sehari. Lima menit sekali berarti menahan
  antrean pg_net 38 detik setiap 300 detik — antrean yang kini dipakai penjaring
  untuk menghubungi Google.

  klasifikasi justru dipercepat, karena notifikasi menunggunya: berita yang
  belum dinilai tidak bisa diketahui negatif atau bukan, dan karena itu ditahan
  di antrean pemberitahuan sampai dinilai.
*/
select cron.alter_job((select jobid from cron.job where jobname = 'sheet-sync-auto'),  schedule := '*/15 * * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'klasifikasi-auto'), schedule := '*/5 * * * *');

/*
  Sumber spreadsheet "penjaring" digantikan Edge Function penjaring, yang tidak
  menumpang Apps Script sama sekali. Lembarnya tidak pernah dibagikan dan
  membalas 401 setiap kali dicoba — satu galat setiap lima menit, seharian,
  untuk sumber yang sudah tidak dibutuhkan. Dinonaktifkan, bukan dihapus:
  barisnya menyimpan riwayat dan alasan sumber ketiga itu pernah ada.
*/
update public.sumber_sheet
   set aktif = false,
       terakhir_status = 'Nonaktif',
       terakhir_pesan = 'Digantikan Edge Function penjaring (6 September 2026). '
                     || 'Perayapan kini berjalan langsung dari sistem, tanpa spreadsheet.'
 where kode = 'penjaring';
