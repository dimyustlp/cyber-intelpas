-- ============================================================================
-- Menyenyapkan gaung, TANPA menyenyapkan eskalasi
-- ============================================================================
--
-- `induk_id` sudah menautkan 81 peristiwa yang muncul di beberapa domain, dan
-- `peristiwa_perlu_diberitahukan()` sudah bisa membedakan gaung dari kenaikan.
-- Sampai migrasi ini keduanya belum tersambung ke apa pun: tiga belas peristiwa
-- negatif berkembar masih mengirim dua sampai tiga pesan untuk satu kejadian.
--
-- ----------------------------------------------------------------------------
-- KENAPA DI PEMICU ANTREAN, BUKAN DI EDGE FUNCTION `notifikasi`
-- ----------------------------------------------------------------------------
--
-- Alasan yang sama dengan alasan pemicu `berita_antrekan_notifikasi` dipasang
-- di tabel `berita` dan bukan di dalam salah satu penyalin: jalan masuk yang
-- ditambahkan nanti ikut terlindungi dengan sendirinya. Menaruhnya di
-- `notifikasi/index.ts` berarti jalur pengiriman yang ditambahkan kelak —
-- WhatsApp, surel, apa pun — diam-diam tidak terlindungi.
--
-- Alasan kedua lebih membumi: menyunting Edge Function menuntut penggelaran
-- ulang, dan `deploy_edge_function` mengganti SELURUH berkas. Pekerjaan ini
-- tidak menuntut satu pun bahan yang tidak ada di basis data.
--
-- ----------------------------------------------------------------------------
-- YANG DISENYAPKAN, DAN YANG TIDAK
-- ----------------------------------------------------------------------------
--
--   gaung      kembaran yang tiernya SAMA atau LEBIH RENDAH  -> dilewati
--   eskalasi   kembaran yang tiernya LEBIH TINGGI            -> tetap dikirim
--   kepala     baris pertama sebuah peristiwa                -> tetap dikirim
--
-- Kalau kembar disenyapkan tanpa membedakan keduanya, seluruh matriks SOP ikut
-- mati: perjalanan sebuah isu justru TikTok (T4) lalu radar lokal (T3) lalu
-- Tribun (T2), dan yang perlu diketahui pimpinan adalah dua kenaikan itu.
--
-- Barisnya tetap MASUK antrean, hanya berstatus `dilewati` beserta alasannya.
-- Tidak dimasukkan sama sekali berarti tidak ada jejak bahwa ia pernah
-- dipertimbangkan — dan pertanyaan "kenapa berita ini tidak diberitahukan"
-- tidak akan punya jawaban di mana pun.

-- --------------------------- perbaikan: akhiran " - Nama Media" di judul
--
-- Google News menempelkan nama penerbit di ujung judul, dan judul itulah yang
-- ikut tersimpan meski alamatnya sudah diuraikan ke portal aslinya. Akibatnya:
--
--   "…Petugas Rutan Gagalkan Penyelundupan - Berita Keadilan"   (lewat Google)
--   "…Petugas Rutan Gagalkan Penyelundupan"                     (portal sendiri)
--
-- dihitung dua peristiwa berbeda — padahal justru inilah kelas kembaran yang
-- paling ingin ditangkap.
--
-- Terukur atas arsip: 62 kelompok menjadi 74, baris ikutan 71 menjadi 86.
-- Kenaikan sekecil itu yang meyakinkan; penggabungan yang serampangan akan
-- menampakkan ratusan. Contoh yang tertangkap sesudahnya: satu unggahan sama
-- di TikTok dan X, satu di Facebook dan Instagram, dan berita ANTARA "Ditjenpas
-- Kemenimipas tinjau kerusakan Rutan Ruteng akibat gempa" yang bersatu dengan
-- versi Instagramnya yang berhuruf besar seluruhnya.
--
-- Akhirannya dibuang HANYA bila sisanya masih >= 20 huruf. Judul pendek yang
-- kebetulan memuat tanda hubung tidak boleh kehilangan separuh dirinya.
create or replace function public.kunci_peristiwa(judul text)
returns text
language sql
immutable
as $fn$
  select case
    when length(coalesce(judul, '')) < 20 then null
    else nullif(trim(regexp_replace(
      lower(regexp_replace(
        case
          when length(regexp_replace(judul, '\s+-\s+[^-]{1,40}$', '')) >= 20
            then regexp_replace(judul, '\s+-\s+[^-]{1,40}$', '')
          else judul
        end,
        '[^a-zA-Z0-9]', ' ', 'g')),
      '\s+', ' ', 'g')), '')
  end;
$fn$;

-- ------------------------------------- perbaikan: waktu masuk yang seri
--
-- Ditemukan saat uji kering sebelum pemasangan: dari 12 baris kembar yang
-- mengantre, NOL yang dikenali gaung. Sebabnya bukan pada kaidahnya melainkan
-- pada pembandingnya.
--
-- Berita masuk bergelombang, dan satu gelombang menerima `created_at` yang
-- SAMA PERSIS — dua belas baris itu semuanya 06:15:07. Penetapan induk memakai
-- urutan `(created_at, id)` sehingga di antara yang seri tetap ada yang jadi
-- kepala; pemeriksaan eskalasi memakai `created_at <` saja, sehingga bagi baris
-- yang seri **tidak ada satu pun yang dianggap lebih awal**. Hasilnya fungsi
-- ini selalu menjawab "kirim", dan penyenyapnya mati tanpa satu pun galat.
--
-- Keduanya kini memakai perbandingan baris `(created_at, id)` yang sama.
create or replace function public.peristiwa_perlu_diberitahukan(p_id uuid)
returns boolean
language plpgsql
stable
as $fn$
declare
  b record;
  tier_terbaik_sebelumnya smallint;
begin
  select id, kunci_peristiwa, induk_id, tier_media, created_at
    into b from public.berita where id = p_id;

  if not found then return false; end if;
  if b.kunci_peristiwa is null or b.induk_id is null then return true; end if;
  if b.tier_media is null then return true; end if;

  select min(x.tier_media) into tier_terbaik_sebelumnya
  from public.berita x
  where x.kunci_peristiwa = b.kunci_peristiwa
    and x.deleted_at is null
    and (x.created_at, x.id) < (b.created_at, b.id)
    and x.created_at > b.created_at - interval '7 days';

  if tier_terbaik_sebelumnya is null then return true; end if;

  return b.tier_media < tier_terbaik_sebelumnya;
end;
$fn$;

-- Penetapan induk diberi pemutus seri yang sama, supaya kepala kelompok tidak
-- berpindah-pindah di antara baris yang waktunya identik.
create or replace function public.tandai_tier_berita()
returns trigger
language plpgsql
as $fn$
declare
  d text;
  hasil record;
  kanwil_induk text;
  kunci text;
  induk uuid;
begin
  d := public.domain_dari_tautan(coalesce(new.link_normalized, new.link));
  new.domain_media := d;

  if d is not null and d like '%.%' then
    select * into hasil from public.cari_tier_media('https://' || d) limit 1;

    if not found then
      insert into public.media_tier (domain, nama_media, tier, jangkauan, tier_sumber, catatan)
      values (d, d, 4, 'Hiperlokal', 'otomatis',
              'Terlihat pertama kali dari sebuah berita. Tier 4 adalah bawaan yang aman, bukan hasil telaah.')
      on conflict (domain) do nothing;

      new.tier_media := 4;
      new.bobot_media := 25;
    else
      new.tier_media := hasil.tier;
      new.bobot_media := hasil.bobot;
    end if;
  end if;

  if new.nama_upt is not null and new.nama_upt <> '' then
    select u.kanwil into kanwil_induk
    from public.upt u where u.nama_upt = new.nama_upt limit 1;

    if kanwil_induk is not null then
      new.kanwil_asal := kanwil_induk;
    end if;
  end if;

  kunci := public.kunci_peristiwa(new.judul);
  new.kunci_peristiwa := kunci;

  if kunci is not null then
    select coalesce(b.induk_id, b.id) into induk
    from public.berita b
    where b.kunci_peristiwa = kunci
      and b.id is distinct from new.id
      and b.deleted_at is null
      and b.created_at > now() - interval '7 days'
    order by b.created_at asc, b.id asc
    limit 1;

    new.induk_id := induk;
  else
    new.induk_id := null;
  end if;

  return new;
end;
$fn$;

create or replace function public.antrekan_notifikasi_berita()
returns trigger
language plpgsql
as $fn$
declare
  v_status text := 'antre';
  v_alasan text := null;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  -- Sentimen belum dinilai mesin pada saat ini, dan memang tidak diperlukan:
  -- yang diperiksa hanya tier dan induk, dan keduanya sudah ditetapkan pemicu
  -- `berita_tandai_tier` yang berjalan lebih dulu (BEFORE, dan ini AFTER).
  if new.induk_id is not null and not public.peristiwa_perlu_diberitahukan(new.id) then
    v_status := 'dilewati';
    v_alasan := 'Gaung peristiwa yang sudah diberitahukan di media setier atau lebih besar.';
  end if;

  begin
    insert into public.notifikasi_berita (berita_id, status, alasan)
    values (new.id, v_status, v_alasan)
    on conflict (berita_id) do nothing;
  exception when others then
    raise warning 'Gagal mengantrekan notifikasi untuk berita %: %', new.id, sqlerrm;
  end;

  return new;
end;
$fn$;

-- ------------------------------------------------------- tier di antrean siap

-- Ditambahkan di ujung supaya CREATE OR REPLACE diterima, dan supaya
-- `select('*')` di Edge Function membawanya tanpa satu baris pun disunting.
-- Tiga kolom ini bahan mentah perutean eskalasi berikutnya.
create or replace view public.notifikasi_antrean_siap as
 SELECT n.berita_id,
    n.antre_at,
    b.judul,
    b.link,
    b.media,
    b.nama_upt,
    b.kanwil_asal,
    b.kategori,
    b.subkategori,
    b.subkategori_kode,
    b.sentimen,
    b.urgensi,
    b.tingkat_perhatian,
    b.ringkasan,
    b.source_type,
    b.ai_classified_at,
    b.ai_confidence,
    b.kata_kunci,
    b.tanggal_publikasi,
    (b.subkategori_kode ~~ '9.%'::text) AS luar_lingkup,
        CASE
            WHEN (b.subkategori_kode ~~ '9.%'::text) THEN 7
            WHEN ((b.sentimen = 'Negatif'::text) AND (upper(b.urgensi) = ANY (ARRAY['KRITIS'::text, 'TINGGI'::text]))) THEN 1
            WHEN (b.sentimen = 'Negatif'::text) THEN 2
            WHEN ((b.sentimen IS NULL) OR (b.sentimen = 'Tidak diketahui'::text)) THEN 5
            WHEN (b.sentimen = 'Positif'::text) THEN 9
            ELSE 8
        END AS prioritas,
    ((b.sentimen = 'Negatif'::text) AND (b.subkategori_kode !~~ '9.%'::text)) AS negatif,
    b.tier_media,
    b.bobot_media,
    b.induk_id
   FROM (notifikasi_berita n
     JOIN berita b ON ((b.id = n.berita_id)))
  WHERE ((n.status = 'antre'::text) AND (b.deleted_at IS NULL));

-- ------------------------------------------- penyemaian ulang kunci & induk

-- Kunci berubah, jadi pengelompokannya harus disusun ulang. Baris yang sudah
-- dihapus lunak sengaja TIDAK disentuh: `induk_id` mereka menunjuk artikel
-- aslinya, dan itu jawaban atas "kenapa berita ini tidak ada" yang tidak boleh
-- hilang.
with kelompok as (
  select id, public.kunci_peristiwa(judul) as kunci, created_at
  from public.berita
  where deleted_at is null and public.kunci_peristiwa(judul) is not null
),
kepala as (
  select k.id, k.kunci,
         first_value(k.id) over (
           partition by k.kunci, floor(extract(epoch from k.created_at) / 604800)
           order by k.created_at asc, k.id asc
         ) as induk
  from kelompok k
)
update public.berita b
set kunci_peristiwa = kp.kunci,
    induk_id = nullif(kp.induk, b.id)
from kepala kp
where kp.id = b.id;

-- ------------------------------------------------------------ tunggakan lama

-- Dijalankan PALING AKHIR, sesudah kunci dan induk disusun ulang — kalau
-- sebelumnya, ia menilai dengan pengelompokan yang sudah basi.
--
-- Baris yang sudah terlanjur mengantre dan ternyata gaung ikut ditandai.
-- Arahnya hanya MENGURANGI pesan, jadi ia tidak mungkin membanjiri grup —
-- kebalikan dari kekeliruan 6 September yang mengirim 29 pesan negatif
-- beruntun sebagai sambutan pertama.
update public.notifikasi_berita n
set status = 'dilewati',
    alasan = 'Gaung peristiwa yang sudah diberitahukan di media setier atau lebih besar. Ditandai surut saat penyenyap gaung dipasang.'
from public.berita b
where b.id = n.berita_id
  and n.status = 'antre'
  and b.deleted_at is null
  and b.induk_id is not null
  and not public.peristiwa_perlu_diberitahukan(b.id);
