-- ============================================================================
-- Tier media, dan mengisi kanwil_asal yang selama ini kosong
-- ============================================================================
--
-- Dua lubang yang ditutup sekaligus, sebab keduanya bermuara pada pertanyaan
-- yang sama: "berita ini milik siapa, dan seberapa keras ia berbunyi?"
--
-- LUBANG PERTAMA — tier media tidak pernah ada.
--
-- Seluruh 482 domain yang pernah masuk arsip diperlakukan setara. Akibatnya
-- pemberitahuan negatif dari portal hiperlokal berbunyi sama kerasnya dengan
-- dari Detik, dan pimpinan tidak punya cara membedakan rumor kampung dari
-- krisis nasional selain membaca satu per satu.
--
-- LUBANG KEDUA — `kanwil_asal` kosong pada SELURUH 2.103 baris.
--
-- Kolomnya ada sejak awal dan tidak pernah terisi. Setiap penyaringan
-- per-wilayah karena itu diam-diam mengembalikan kosong; tidak ada galat, dan
-- tidak ada yang tahu. Lembar kanwil yang akan dibuat MUSTAHIL bekerja di atas
-- kolom yang kosong, jadi ia diisi di sini lebih dulu — diturunkan dari
-- `nama_upt` lewat data induk `upt`, bukan diketik ulang oleh siapa pun.
--
-- Kenapa tier disimpan di `berita` dan tidak dihitung saat dibaca: perutean
-- notifikasi memerlukannya pada detik barisnya masuk, sebelum ada yang membaca
-- apa pun. Menghitungnya di halaman berarti setiap pembaca menghitung ulang
-- hal yang sama — dan kaidah yang sama persis mesti ditulis dua kali.

-- ---------------------------------------------------------------- daftar tier

create table if not exists public.media_tier (
  domain text primary key,
  nama_media text not null,
  tier smallint not null check (tier between 1 and 4),

  -- Bobot tidak pernah diketik: ia turunan tier, dan menyimpannya sebagai kolom
  -- biasa membuka peluang tier 1 berbobot 25 tanpa ada yang menahan.
  bobot smallint generated always as (
    case tier when 1 then 100 when 2 then 75 when 3 then 50 else 25 end
  ) stored,

  jangkauan text not null default 'Hiperlokal'
    check (jangkauan in ('Nasional','Provinsi','Karesidenan','Hiperlokal','Kanal Sosial','Resmi')),
  provinsi text,

  -- Subdomain daerah milik jaringan nasional BUKAN media nasional.
  -- 'surabaya.tribunnews.com' berjangkauan provinsi meski induknya Tier 1.
  -- Bendera ini menurunkan satu tingkat ketika pencocokan jatuh ke induknya.
  turunkan_subdomain boolean not null default false,

  -- 'bawaan'  = disemai migrasi ini
  -- 'otomatis'= didaftarkan sendiri oleh pemicu saat domain baru terlihat
  -- 'manual'  = sudah ditetapkan analis; TIDAK BOLEH ditimpa proses otomatis
  tier_sumber text not null default 'otomatis'
    check (tier_sumber in ('bawaan','otomatis','manual')),

  catatan text,
  pertama_terlihat timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now()
);

comment on table public.media_tier is
  'Daftar induk domain media beserta tier 1-4. Kunci pencocokannya DOMAIN dari tautan, bukan kolom `media` pada tabel berita — kolom itu teks bebas yang berisi "Medsos Radar" dan "YouTube [Lapas ...]" sehingga tidak bisa dijadikan kunci apa pun.';

create index if not exists media_tier_tier_idx on public.media_tier (tier);

-- -------------------------------------------------------- domain dari tautan

create or replace function public.domain_dari_tautan(tautan text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      lower(
        split_part(
          split_part(
            regexp_replace(coalesce(tautan, ''), '^[a-zA-Z][a-zA-Z0-9+.-]*://', ''),
            '/', 1),
          '?', 1)
      ),
      '^(www|m|amp)\.', ''
    ),
    ''
  );
$$;

comment on function public.domain_dari_tautan(text) is
  'Mengambil nama host dari sebuah tautan. Awalan www/m/amp dibuang supaya "m.detik.com" dan "detik.com" tidak menjadi dua media berbeda.';

-- ------------------------------------------------------------ pencarian tier

/**
 * Mencari tier sebuah domain, dari yang paling khusus ke yang paling umum.
 *
 * 'radarpekalongan.disway.id' dicoba utuh lebih dulu; kalau belum terdaftar,
 * barulah 'disway.id'. Urutan ini yang membuat analis bisa menetapkan satu
 * subdomain tanpa mengganggu induknya.
 *
 * Penelusuran BERHENTI sebelum menyentuh akhiran majemuk. Tanpa itu
 * 'seribuparitnews.co.id' akan berakhir mencari 'co.id' sebagai nama media,
 * dan satu baris salah di sana akan mengubah tier ratusan portal sekaligus.
 */
create or replace function public.cari_tier_media(tautan text)
returns table (domain text, tier smallint, bobot smallint, nama_media text, cocok_persis boolean)
language plpgsql
stable
as $$
declare
  d text := public.domain_dari_tautan(tautan);
  bagian text[];
  n int;
  i int;
  kandidat text;
  baris public.media_tier;
  min_label int := 2;
  akhiran_majemuk text[] := array[
    'co.id','go.id','or.id','ac.id','net.id','web.id','sch.id','my.id','desa.id',
    'biz.id','ponpes.id','mil.id','co.uk','com.au','co.jp'
  ];
begin
  if d is null then return; end if;

  bagian := string_to_array(d, '.');
  n := coalesce(array_length(bagian, 1), 0);
  if n < 2 then return; end if;

  if n >= 3 and array_to_string(bagian[n-1:n], '.') = any(akhiran_majemuk) then
    min_label := 3;
  end if;

  for i in 1 .. (n - min_label + 1) loop
    kandidat := array_to_string(bagian[i:n], '.');

    select * into baris from public.media_tier mt where mt.domain = kandidat;

    if found then
      domain := d;
      nama_media := baris.nama_media;
      cocok_persis := (i = 1);
      tier := baris.tier;

      if i > 1 then
        -- Jaringan Radar selalu tingkat kabupaten/karesidenan, di jaringan mana
        -- pun ia bernaung. Ini kaidah pertama karena paling khas dan paling
        -- sering: 'radarkediri.jawapos.com' induknya Tier 1.
        if bagian[1] like 'radar%' then
          tier := 3;
        elsif baris.turunkan_subdomain then
          tier := least(baris.tier + 1, 4)::smallint;
        end if;
      end if;

      bobot := (case tier when 1 then 100 when 2 then 75 when 3 then 50 else 25 end)::smallint;
      return next;
      return;
    end if;
  end loop;
end;
$$;

-- ------------------------------------------------------------- benih tier 1-2

/**
 * Yang disemai di sini HANYA yang bisa dipertanggungjawabkan.
 *
 * Arsip memuat 482 domain. Menetapkan tier bagi seluruhnya berarti menebak
 * ratusan portal daerah yang tidak seorang pun di sini pernah baca — dan
 * tebakan yang tersimpan sebagai data tidak bisa dibedakan lagi dari
 * pengetahuan. Karena itu yang tidak dikenali TIDAK ditebak: ia mendaftar
 * sendiri sebagai Tier 4 bertanda 'otomatis', lalu menunggu analis.
 *
 * Tier 4 dipilih sebagai bawaan, bukan Tier 1, sebab salah di arah ini hanya
 * membuat sebuah berita kurang berbunyi. Salah di arah sebaliknya membangunkan
 * Dirjen untuk rumor sebuah blog.
 */
insert into public.media_tier (domain, nama_media, tier, jangkauan, turunkan_subdomain, tier_sumber, catatan) values
  -- Tier 1 — arus utama nasional
  ('detik.com','detikcom',1,'Nasional',true,'bawaan',null),
  ('kompas.com','Kompas.com',1,'Nasional',true,'bawaan',null),
  ('tribunnews.com','Tribunnews',1,'Nasional',true,'bawaan','Jaringan daerahnya sangat besar; subdomain diturunkan ke Provinsi.'),
  ('cnnindonesia.com','CNN Indonesia',1,'Nasional',false,'bawaan',null),
  ('liputan6.com','Liputan6',1,'Nasional',false,'bawaan',null),
  ('tempo.co','Tempo',1,'Nasional',false,'bawaan',null),
  ('antaranews.com','ANTARA News',1,'Nasional',true,'bawaan','Kantor berita negara. Biro daerah diturunkan ke Provinsi.'),
  ('jawapos.com','Jawa Pos',1,'Nasional',true,'bawaan','Induk jaringan Radar; subdomain radar* jatuh ke Tier 3.'),
  ('okezone.com','Okezone',1,'Nasional',true,'bawaan',null),
  ('sindonews.com','SINDOnews',1,'Nasional',true,'bawaan',null),
  ('republika.co.id','Republika',1,'Nasional',false,'bawaan',null),
  ('suara.com','Suara.com',1,'Nasional',true,'bawaan',null),
  ('kumparan.com','kumparan',1,'Nasional',false,'bawaan',null),
  ('viva.co.id','VIVA',1,'Nasional',false,'bawaan',null),
  ('merdeka.com','Merdeka.com',1,'Nasional',false,'bawaan',null),
  ('tvonenews.com','tvOne News',1,'Nasional',false,'bawaan',null),
  ('kompas.tv','Kompas TV',1,'Nasional',false,'bawaan',null),
  ('inews.id','iNews',1,'Nasional',true,'bawaan',null),
  ('cnbcindonesia.com','CNBC Indonesia',1,'Nasional',false,'bawaan',null),
  ('rri.co.id','RRI',1,'Nasional',true,'bawaan','Lembaga penyiaran publik; kanal daerahnya diturunkan ke Provinsi.'),
  ('medcom.id','Medcom.id',1,'Nasional',false,'bawaan',null),
  ('beritasatu.com','BeritaSatu',1,'Nasional',false,'bawaan',null),
  ('jpnn.com','JPNN',1,'Nasional',false,'bawaan',null),
  ('idntimes.com','IDN Times',1,'Nasional',true,'bawaan',null),
  ('tirto.id','Tirto.id',1,'Nasional',false,'bawaan',null),
  ('bisnis.com','Bisnis.com',1,'Nasional',true,'bawaan',null),
  ('kontan.co.id','Kontan',1,'Nasional',false,'bawaan',null),
  ('katadata.co.id','Katadata',1,'Nasional',false,'bawaan',null),
  ('metrotvnews.com','Metro TV',1,'Nasional',false,'bawaan',null),
  ('rmol.id','RMOL',1,'Nasional',true,'bawaan',null),

  -- Tier 2 — jagoan regional Jawa Timur (ekosistem yang disebut Buku Panduan)
  ('suarasurabaya.net','Suara Surabaya',2,'Provinsi',false,'bawaan',null),
  ('beritajatim.com','Beritajatim.com',2,'Provinsi',false,'bawaan',null),
  ('timesindonesia.co.id','TIMES Indonesia',2,'Provinsi',true,'bawaan',null),
  ('harianbhirawa.co.id','Harian Bhirawa',2,'Provinsi',false,'bawaan',null),
  ('memorandum.co.id','Memorandum',2,'Provinsi',false,'bawaan',null),
  ('surya.co.id','Harian Surya',2,'Provinsi',false,'bawaan',null),
  ('bangsaonline.com','BangsaOnline',2,'Provinsi',false,'bawaan',null),
  ('jatimnow.com','JatimNow',2,'Provinsi',false,'bawaan',null),
  ('faktualnews.co','FaktualNews',2,'Provinsi',false,'bawaan',null),
  ('tugujatim.id','Tugu Jatim',2,'Provinsi',false,'bawaan',null),
  ('ngopibareng.id','Ngopibareng.id',2,'Provinsi',false,'bawaan',null),
  ('harianbangsa.net','Harian Bangsa',2,'Provinsi',false,'bawaan',null),
  ('surabayapagi.com','Surabaya Pagi',2,'Provinsi',false,'bawaan',null),
  ('lensaindonesia.com','Lensa Indonesia',2,'Provinsi',false,'bawaan',null),
  ('disway.id','Jaringan Disway',2,'Provinsi',true,'bawaan','Induk jaringan; subdomain radar* jatuh ke Tier 3.'),

  -- Tier 3 — kanal resmi instansi
  ('ditjenpas.go.id','Ditjen Pemasyarakatan',3,'Resmi',true,'bawaan',
    'Sengaja BUKAN Tier 1-2. Tier memicu eskalasi, dan berita negatif di situs sendiri adalah klarifikasi — menaikkannya ke Kakanwil hanya menambah bising.'),
  ('kemenimipas.go.id','Kementerian Imipas',3,'Resmi',true,'bawaan',null),
  ('imigrasi.go.id','Ditjen Imigrasi',3,'Resmi',true,'bawaan',null),

  -- Tier 4 — kanal sosial dan tulisan warga
  ('instagram.com','Instagram',4,'Kanal Sosial',false,'bawaan',null),
  ('youtube.com','YouTube',4,'Kanal Sosial',false,'bawaan',null),
  ('facebook.com','Facebook',4,'Kanal Sosial',false,'bawaan',null),
  ('tiktok.com','TikTok',4,'Kanal Sosial',false,'bawaan',null),
  ('x.com','X (Twitter)',4,'Kanal Sosial',false,'bawaan',null),
  ('twitter.com','X (Twitter)',4,'Kanal Sosial',false,'bawaan',null),
  ('threads.net','Threads',4,'Kanal Sosial',false,'bawaan',null),
  ('kompasiana.com','Kompasiana',4,'Kanal Sosial',false,'bawaan',
    'Blog warga, bukan redaksi. Penyumbang terbesar arsip (348 baris) dan justru karena itu tidak boleh berbobot penuh.'),
  ('news.google.com','Google News (pengalih)',4,'Kanal Sosial',false,'bawaan',
    'Tidak boleh tersimpan sebagai tautan berita. Terdaftar di sini hanya agar terlihat bila lolos.')
on conflict (domain) do nothing;

-- ------------------------------------------------------- kolom baru di berita

alter table public.berita
  add column if not exists domain_media text,
  add column if not exists tier_media smallint,
  add column if not exists bobot_media smallint;

comment on column public.berita.tier_media is
  'Tier 1-4 media penerbit, disalin saat baris masuk. Disimpan dan tidak dihitung saat dibaca karena perutean notifikasi memerlukannya sebelum ada manusia yang membuka halaman.';

create index if not exists berita_tier_media_idx on public.berita (tier_media);
create index if not exists berita_kanwil_asal_idx on public.berita (kanwil_asal);

-- ------------------------------------------------------------------- pemicu

/**
 * Menandai tier, dan mengisi kanwil dari data induk.
 *
 * Namanya `berita_tandai_tier` bukan kebetulan. PostgreSQL menjalankan pemicu
 * BEFORE menurut abjad, dan urutannya di sini menentukan benar-salahnya:
 *
 *   berita_seragamkan_tautan       -> link_normalized dibersihkan
 *   berita_tandai_tier             -> (ini) membaca link_normalized yang bersih
 *   trg_prevent_duplicate_news_link-> menolak kembar
 *
 * Diberi nama yang jatuh sebelum 'berita_s', pemicu ini akan membaca tautan
 * yang belum ternormalkan dan mencatat domain yang salah, tanpa satu pun galat.
 */
create or replace function public.tandai_tier_berita()
returns trigger
language plpgsql
as $$
declare
  d text;
  hasil record;
  kanwil_induk text;
begin
  d := public.domain_dari_tautan(coalesce(new.link_normalized, new.link));
  new.domain_media := d;

  if d is not null and d like '%.%' then
    select * into hasil from public.cari_tier_media('https://' || d) limit 1;

    if not found then
      -- Domain yang belum pernah terlihat mendaftarkan dirinya sendiri.
      --
      -- Tanpa ini, daftar tier hanya bertambah ketika seseorang ingat untuk
      -- menambahkannya — dan yang tidak diingat tetap tak bertier selamanya,
      -- persis seperti 482 domain yang menumpuk sebelum migrasi ini ada.
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

  -- Kanwil TIDAK PERNAH diambil dari apa yang diketik pengirim. Ia diturunkan
  -- dari nama unit lewat data induk, sebab satu unit hanya bisa berada di satu
  -- wilayah dan pengirim yang salah ketik wilayah akan membuat berita hilang
  -- dari lembar kanwil yang seharusnya menanganinya.
  if new.nama_upt is not null and new.nama_upt <> '' then
    select u.kanwil into kanwil_induk
    from public.upt u
    where u.nama_upt = new.nama_upt
    limit 1;

    if kanwil_induk is not null then
      new.kanwil_asal := kanwil_induk;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists berita_tandai_tier on public.berita;
create trigger berita_tandai_tier
  before insert or update of link, link_normalized, nama_upt on public.berita
  for each row execute function public.tandai_tier_berita();

-- -------------------------------------------------------------- antrean telaah

create or replace view public.media_tier_perlu_telaah as
select
  mt.domain,
  mt.nama_media,
  mt.tier,
  mt.jangkauan,
  count(b.id) as jumlah_berita,
  max(b.created_at) as terakhir_terlihat
from public.media_tier mt
left join public.berita b on b.domain_media = mt.domain
where mt.tier_sumber = 'otomatis'
group by mt.domain, mt.nama_media, mt.tier, mt.jangkauan
order by count(b.id) desc, mt.domain;

comment on view public.media_tier_perlu_telaah is
  'Domain yang mendaftar sendiri dan tiernya belum pernah ditelaah manusia, terbanyak dulu. Menelaah dua puluh baris teratas menutup sebagian besar bobot arsip.';

-- ------------------------------------------------------------------ penyemaian

-- Domain lama yang belum terdaftar didaftarkan dulu, supaya pembaruan di bawah
-- tidak meninggalkan baris tanpa tier.
insert into public.media_tier (domain, nama_media, tier, jangkauan, tier_sumber, catatan)
select d.domain, d.domain, 4, 'Hiperlokal', 'otomatis',
       'Didaftarkan saat penyemaian dari arsip yang sudah ada; tier belum ditelaah analis.'
from (
  select distinct public.domain_dari_tautan(coalesce(link_normalized, link)) as domain
  from public.berita
  where coalesce(link_normalized, link) is not null
) d
where d.domain is not null
  and d.domain like '%.%'
  and not exists (select 1 from public.cari_tier_media('https://' || d.domain))
on conflict (domain) do nothing;

-- Tier untuk seluruh arsip.
update public.berita b
set domain_media = t.domain,
    tier_media   = t.tier,
    bobot_media  = t.bobot
from (
  select b2.id, c.domain, c.tier, c.bobot
  from public.berita b2
  cross join lateral public.cari_tier_media(coalesce(b2.link_normalized, b2.link)) c
) t
where t.id = b.id;

-- Kanwil untuk seluruh arsip. Inilah yang menghidupkan penyaringan per-wilayah
-- yang selama ini mengembalikan kosong pada 2.103 baris tanpa satu pun galat.
update public.berita b
set kanwil_asal = u.kanwil
from public.upt u
where b.nama_upt = u.nama_upt
  and u.kanwil is not null
  and coalesce(b.kanwil_asal, '') = '';
