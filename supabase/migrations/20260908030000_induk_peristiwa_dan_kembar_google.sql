-- ============================================================================
-- Satu peristiwa, banyak baris: `induk_id`
-- ============================================================================
--
-- Diukur 8 September 2026 atas 2.194 baris arsip: 81 peristiwa muncul di lebih
-- dari satu domain, menyisakan 94 baris berlebih. Dua puluh enam di antaranya
-- tercatat dengan TIER BERBEDA untuk peristiwa yang sama, dan tiga belas
-- bersentimen negatif — yang terakhir berarti dua sampai tiga pemberitahuan
-- Telegram untuk satu kejadian.
--
-- Bentuknya tiga macam, dan ketiganya sah sebagai berita:
--
--   sindikasi   satu artikel kawat di antaranews.com (Tier 1) beserta empat
--               biro daerahnya (Tier 2)
--   sosial      artikel portal, lalu diunggah ulang ke TikTok/YouTube/Instagram
--   liputan     beberapa portal meliput peristiwa yang sama
--
-- ----------------------------------------------------------------------------
-- KENAPA TIDAK DIHAPUS SAJA
-- ----------------------------------------------------------------------------
--
-- Unggahan TikTok bukan salinan yang mubazir — ia jangkauan tambahan, dan
-- untuk analisis amplifikasi ia justru harus terhitung sendiri. Yang salah
-- bukan keberadaan barisnya, melainkan memperlakukan tiap baris sebagai
-- peristiwa terpisah saat menghitung dan saat memberitahu.
--
-- Karena itu barisnya TETAP ADA dan ditautkan, bukan dibuang.
--
-- ----------------------------------------------------------------------------
-- KENAPA INDUKNYA YANG TERAWAL, BUKAN YANG TIERNYA TERTINGGI
-- ----------------------------------------------------------------------------
--
-- Ini keputusan yang paling mudah dibuat terbalik, dan salahnya mahal.
--
-- Naluri pertama: jadikan baris ber-tier tertinggi sebagai induk, lalu beritahu
-- hanya induknya. Itu akan **mematikan seluruh matriks eskalasi SOP.**
--
-- Perjalanan sebuah isu justru berbunyi begini:
--
--     hari-1  TikTok (Tier 4)          -> Level 1, unit memvalidasi rumor
--     hari-2  radar lokal (Tier 3)     -> Level 2, unit menyiapkan hak jawab
--     hari-3  Tribun Jatim (Tier 2)    -> Level 3, Kanwil turun tangan
--
-- Kalau kembar disenyapkan begitu saja, kenaikan hari-2 dan hari-3 — yang
-- justru seluruh alasan matriks itu ada — tidak akan pernah terkirim.
--
-- Maka: induk = yang TERAWAL, dan yang menentukan perlu-tidaknya memberitahu
-- bukan "apakah ia induk" melainkan **"apakah tiernya naik dari yang pernah
-- terlihat"**. Lihat `peristiwa_perlu_diberitahukan()`.

-- ------------------------------------------------------------- kolom & kunci

alter table public.berita
  add column if not exists kunci_peristiwa text,
  add column if not exists induk_id uuid references public.berita(id) on delete set null;

comment on column public.berita.induk_id is
  'Menunjuk baris TERAWAL dari peristiwa yang sama. NULL berarti baris ini sendiri kepalanya. Barisnya tidak pernah dihapus: unggahan ulang di kanal lain adalah jangkauan tambahan yang nyata.';

create index if not exists berita_kunci_peristiwa_idx on public.berita (kunci_peristiwa);
create index if not exists berita_induk_idx on public.berita (induk_id);

/**
 * Kunci peristiwa dari judul.
 *
 * Pencocokannya JUDUL PENUH ternormalkan, bukan potongan awalnya. Diuji atas
 * arsip: potongan 60 huruf menemukan 81 kelompok, judul penuh menemukan 66.
 * Yang lebih sedikit dipilih dengan sengaja — menggabungkan dua peristiwa yang
 * berbeda menyembunyikan salah satunya sama sekali, dan kehilangan begitu tidak
 * meninggalkan jejak apa pun. Gagal memisah jauh lebih murah daripada gagal
 * membedakan.
 *
 * Judul yang terlalu pendek tidak pernah dikelompokkan: "Sidak" akan
 * mempertemukan sidak di Aceh dengan sidak di Papua.
 */
create or replace function public.kunci_peristiwa(judul text)
returns text
language sql
immutable
as $fn$
  select case
    when length(coalesce(judul, '')) < 20 then null
    else nullif(trim(regexp_replace(
      lower(regexp_replace(judul, '[^a-zA-Z0-9]', ' ', 'g')),
      '\s+', ' ', 'g')), '')
  end;
$fn$;

-- --------------------------------------------------------- penautan otomatis

/**
 * Ditanam ke dalam `tandai_tier_berita()` yang sudah ada, bukan pemicu baru.
 *
 * Satu pemicu lebih sedikit berarti satu urutan-abjad lebih sedikit yang bisa
 * salah. Pemicu ini sudah berjalan pada saat yang tepat: sesudah tautan
 * diseragamkan, sebelum kembar ditolak.
 */
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
  /* ---- tier media ---- */
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

  /* ---- kanwil dari data induk ---- */
  if new.nama_upt is not null and new.nama_upt <> '' then
    select u.kanwil into kanwil_induk
    from public.upt u where u.nama_upt = new.nama_upt limit 1;

    if kanwil_induk is not null then
      new.kanwil_asal := kanwil_induk;
    end if;
  end if;

  /* ---- peristiwa yang sama ---- */
  kunci := public.kunci_peristiwa(new.judul);
  new.kunci_peristiwa := kunci;

  if kunci is not null then
    -- Jendela tujuh hari. Tanpa batas waktu, "Lapas X Gelar Upacara HUT RI"
    -- tahun ini akan menempel pada yang tahun lalu.
    --
    -- Yang diambil induknya-induk bila ada, supaya rantainya tidak pernah lebih
    -- dalam dari satu tingkat: kepala kelompok harus bisa ditemukan dengan satu
    -- lompatan, bukan ditelusuri.
    select coalesce(b.induk_id, b.id) into induk
    from public.berita b
    where b.kunci_peristiwa = kunci
      and b.id is distinct from new.id
      and b.deleted_at is null
      and b.created_at > now() - interval '7 days'
    order by b.created_at asc
    limit 1;

    new.induk_id := induk;
  else
    new.induk_id := null;
  end if;

  return new;
end;
$fn$;

drop trigger if exists berita_tandai_tier on public.berita;
create trigger berita_tandai_tier
  before insert or update of link, link_normalized, nama_upt, judul on public.berita
  for each row execute function public.tandai_tier_berita();

-- ------------------------------------------------- eskalasi, bukan pembungkam

/**
 * Perlukah baris ini diberitahukan?
 *
 * Bukan "apakah ia induk". Yang ditanyakan: apakah peristiwa ini pernah
 * terlihat di media SEBESAR ini atau lebih besar?
 *
 *   - baris pertama sebuah peristiwa          -> ya
 *   - tiernya lebih tinggi dari yang pernah   -> ya (INI eskalasinya)
 *   - tiernya sama atau lebih rendah          -> tidak (cuma gaung)
 *
 * Ingat tier kecil = jangkauan besar: Tier 1 nasional, Tier 4 hiperlokal.
 */
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
    and x.created_at < b.created_at
    and x.created_at > b.created_at - interval '7 days';

  if tier_terbaik_sebelumnya is null then return true; end if;

  return b.tier_media < tier_terbaik_sebelumnya;
end;
$fn$;

comment on function public.peristiwa_perlu_diberitahukan(uuid) is
  'Menjawab perlukah sebuah baris diberitahukan. Kembaran yang tiernya NAIK tetap diberitahukan - itulah eskalasi yang jadi seluruh alasan matriks SOP ada. Hanya gaung setier atau lebih rendah yang disenyapkan.';

-- ---------------------------------------------------------- menghitung peristiwa

/**
 * Satu baris per peristiwa, untuk laporan pimpinan.
 *
 * Angka "berapa berita Tier 1 pekan ini" yang dihitung per BARIS akan melar
 * oleh sindikasi: satu artikel ANTARA tercatat lima kali. Di sini satu
 * peristiwa satu baris, dengan tier terbaik yang pernah dicapainya.
 */
create or replace view public.peristiwa as
select
  coalesce(b.induk_id, b.id)                as peristiwa_id,
  min(b.created_at)                         as pertama_terlihat,
  max(b.created_at)                         as terakhir_terlihat,
  count(*)                                  as jumlah_baris,
  count(distinct b.domain_media)            as jumlah_media,
  min(b.tier_media)                         as tier_terbaik,
  max(b.bobot_media)                        as bobot_terbaik,
  (array_agg(b.judul order by b.created_at asc))[1]        as judul,
  (array_agg(b.nama_upt order by b.created_at asc))[1]     as nama_upt,
  (array_agg(b.kanwil_asal order by b.created_at asc))[1]  as kanwil_asal,
  bool_or(b.sentimen = 'Negatif')           as ada_negatif
from public.berita b
where b.deleted_at is null
group by coalesce(b.induk_id, b.id);

comment on view public.peristiwa is
  'Satu baris per peristiwa, bukan per publikasi. Dipakai laporan pimpinan supaya sindikasi ANTARA tidak menghitung satu artikel lima kali.';

-- ------------------------------------------------- penyemaian arsip yang ada

-- Menautkan arsip lama. Dikerjakan dengan window function, bukan satu per satu,
-- supaya 2.194 baris selesai dalam satu jalan.
with kelompok as (
  select id,
         public.kunci_peristiwa(judul) as kunci,
         created_at
  from public.berita
  where deleted_at is null and public.kunci_peristiwa(judul) is not null
),
kepala as (
  -- Dikelompokkan menurut kunci DAN ember tujuh harian, bukan kunci saja.
  -- Tanpa ember itu, "Lapas X Gelar Apel Pagi" bulan Januari akan menempel
  -- pada yang bulan Agustus. Ember yang memotong satu peristiwa di
  -- perbatasannya memang mungkin — dan itu arah gagal yang benar: gagal
  -- memisah jauh lebih murah daripada gagal membedakan.
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

-- ============================================================================
-- Membersihkan 24 baris beralamat Google News
-- ============================================================================
--
-- Bukan berita yang hilang. Diperiksa satu per satu: KEDUA PULUH EMPATNYA sudah
-- punya alamat asli yang terurai di `penjaring_alamat`, dan keduapuluh empatnya
-- BENTROK dengan baris yang sudah ada begitu alamat itu dinormalkan. Artinya
-- artikelnya sudah tersimpan di arsip di bawah alamat sungguhannya.
--
-- Kenapa mereka tertinggal: `perbaikiAlamat()` menolak memaksakan alamat yang
-- sudah dipakai — dan itu benar — lalu mencatatnya `kembar` dan meninggalkan
-- barisnya apa adanya. Komentarnya sendiri menyebut rapikan-oleh-analis sebagai
-- jalan keluarnya. Ini pelaksanaannya.
--
-- Akibat sampingan yang ikut berhenti: pemilih `perbaiki` menyaring
-- `link_normalized`, jadi baris-baris ini terpilih ULANG setiap sepuluh menit
-- sejak 6 Agustus — masing-masing berharga permintaan ke Google, selamanya,
-- untuk pekerjaan yang tidak akan pernah bisa selesai.
--
-- DIHAPUS LUNAK, bukan keras. `deleted_at` sudah dihormati seluruh pemilih di
-- sistem ini, dan baris yang salah dinilai masih bisa dikembalikan.

with sasaran as (
  select b.id,
         (select a.id from public.berita a
           where a.link_normalized = public.normalkan_tautan(pa.url)
             and a.id <> b.id and a.deleted_at is null
           order by a.created_at asc limit 1) as asli_id
  from public.berita b
  join public.penjaring_alamat pa
    on pa.gnews_id = split_part(split_part(coalesce(b.link_normalized, b.link), '/articles/', 2), '?', 1)
  where b.domain_media = 'news.google.com'
    and b.deleted_at is null
    and pa.url is not null
)
update public.berita b
set deleted_at = now(),
    induk_id = coalesce(s.asli_id, b.induk_id),
    catatan = trim(both ' ' from coalesce(b.catatan, '') ||
      ' [8 Sep 2026] Dihapus lunak: alamat pengalih Google News yang artikel aslinya sudah tersimpan di arsip. Bukan berita hilang.')
from sasaran s
where s.id = b.id and s.asli_id is not null;
