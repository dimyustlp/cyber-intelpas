-- =============================================================================
-- Satu aturan penyeragaman tautan, dan basis data yang memegangnya
-- =============================================================================
--
-- MASALAHNYA
--
-- Aturan penyeragaman tautan sampai hari ini ditulis DUA KALI, dalam dua bahasa
-- yang berbeda:
--
--   supabase/functions/sheet-sync/sheet-sync.ts  → normalizeUrl()
--   web/js/pages/input.js                        → normalkanTautan()
--
-- Komentar di berkas kedua sudah menyebut akibatnya sendiri: "Kalau keduanya
-- berbeda, satu berita yang sama akan tersimpan dua kali: sekali dengan penanda
-- iklan di ekor alamatnya, sekali tanpa." Hari ini keduanya memang masih sama —
-- tetapi tidak ada satu pun yang menahannya tetap sama, dan yang menyunting
-- salah satunya tidak akan pernah tahu ia baru saja membuka celah.
--
-- Celah kedua lebih besar dan sudah terbuka sekarang: pemicu
-- `prevent_duplicate_news_link` MENYERAH bila `link_normalized` kosong
-- (baris pertamanya: "if new.link_normalized is null ... then return new"),
-- sehingga pemanggil mana pun yang tidak mengisi kolom itu melewati seluruh
-- pemeriksaan tanpa satu pun peringatan.
--
-- Keduanya menjadi mahal justru sekarang: sumber spreadsheet bertambah menjadi
-- TIGA, dan sumber ketiga adalah penjaring celah yang sengaja mencari berita
-- yang mungkin sudah ditemukan dua sumber lainnya.
--
-- YANG DIPERBAIKI
--
-- Aturannya dipindahkan ke basis data dan dijadikan turunan: `link_normalized`
-- tidak lagi DIKIRIM pemanggil melainkan DIHITUNG oleh pemicu dari `link`,
-- apa pun yang dikirim. Sesudah ini kedua salinan di sisi klien tinggal
-- kemudahan tampilan — kalau keduanya berbeda, yang tersimpan tetap satu bentuk
-- yang sama, dan berita kembar tidak lagi bisa masuk lewat perbedaan itu.
--
-- Tiga lapis, dari yang paling mudah dilewati ke yang tidak bisa:
--
--   1. Klien menyeragamkan  → pesan ramah sebelum menyimpan
--   2. Pemicu menghitung ulang → pengirim yang lalai tidak bisa melewatinya
--   3. Indeks unik           → bahkan pemicu yang dinonaktifkan tidak menembusnya
--
-- Diperiksa sebelum dijalankan: 858 baris, 858 tautan unik, dan nol tabrakan
-- bahkan di bawah aturan yang lebih ketat ini. Indeks uniknya karena itu bisa
-- dipasang tanpa membuang satu baris pun.
-- =============================================================================


-- ------------------------------------------------------------------ 1. Aturan

create or replace function public.normalkan_tautan(nilai text)
returns text
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $fungsi$
declare
    t     text;
    sisa  text;
    inang text;
    jalur text;
begin
    t := btrim(coalesce(nilai, ''));
    if t = '' then
        return '';
    end if;

    -- Fragmen dibuang lebih dulu. "#komentar" tidak pernah menunjuk artikel
    -- yang berbeda, tetapi selalu membuat teksnya berbeda.
    t := regexp_replace(t, '#.*$', '');

    -- Alamat tanpa skema dianggap https. Tanpa baris ini "kompas.com/x" dan
    -- "https://kompas.com/x" adalah dua berita.
    if t !~* '^https?://' then
        t := 'https://' || t;
    end if;

    -- Inang dikecilkan hurufnya, jalurnya TIDAK. Nama inang memang tidak peka
    -- besar-kecil huruf; jalur di sebagian peladen peka, dan mengecilkannya
    -- akan menghasilkan alamat yang tidak bisa dibuka.
    sisa  := regexp_replace(t, '^https?://', '', 'i');
    inang := split_part(split_part(sisa, '/', 1), '?', 1);
    jalur := substr(sisa, length(inang) + 1);
    inang := regexp_replace(lower(inang), '^www\.', '');

    -- http dan https selalu disamakan menjadi https. Portal yang sama disebut
    -- dengan dua skema oleh dua perayap adalah kejadian sehari-hari.
    t := 'https://' || inang || jalur;

    -- Penanda pelacakan iklan dan rujukan. Daftarnya diperluas dari empat
    -- menjadi lima belas: perayap yang berbeda menempelkan penanda yang
    -- berbeda pada alamat artikel yang sama persis.
    t := regexp_replace(
             t,
             '([?&])(utm_[^=&]*|fbclid|gclid|dclid|msclkid|igsh|igshid|mibextid'
             || '|ref|ref_src|refsrc|source|src|spm|scm|mc_cid|mc_eid|_ga|_gl'
             || '|ncid|cmpid|campaign_id|at_medium|at_campaign|share_id|si)=[^&]*',
             '\1', 'gi');

    -- Sisa tanda sambung yang menggantung sesudah pembuangan di atas.
    t := regexp_replace(t, '\?&+', '?');
    t := regexp_replace(t, '&&+', '&');
    t := regexp_replace(t, '[?&]+$', '');

    -- Ekor AMP menunjuk artikel yang sama dengan tampilan yang berbeda.
    t := regexp_replace(t, '/amp/?$', '', 'i');
    t := regexp_replace(t, '\?outputType=amp$', '', 'i');

    -- Garis miring di ujung.
    t := regexp_replace(t, '/+$', '');

    return t;
end;
$fungsi$;

comment on function public.normalkan_tautan(text) is
    'Satu-satunya aturan penyeragaman tautan. Salinan di sheet-sync.ts dan '
    'input.js hanya untuk tampilan; yang tersimpan selalu hasil fungsi ini.';


-- ------------------------------------------------------------------ 2. Pemicu

create or replace function public.seragamkan_tautan_berita()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $fungsi$
begin
    -- Nilai yang dikirim pemanggil sengaja DIABAIKAN, bukan dipakai kalau ada.
    -- Itulah keseluruhan gunanya: pengirim yang memakai aturan lain, aturan
    -- lama, atau tidak memakai aturan sama sekali tetap menghasilkan bentuk
    -- yang sama dengan pengirim lainnya.
    new.link_normalized := public.normalkan_tautan(new.link);
    return new;
end;
$fungsi$;

drop trigger if exists berita_seragamkan_tautan on public.berita;

-- Namanya diawali "berita_" dan bukan "trg_" dengan sengaja. PostgreSQL
-- menjalankan pemicu BEFORE menurut urutan abjad namanya, dan pemicu ini HARUS
-- berjalan sebelum trg_prevent_duplicate_news_link — yang memeriksa kembaran
-- justru pada kolom yang baru diisi di sini. Dibalik urutannya, pemeriksaan
-- kembarannya membaca nilai lama.
create trigger berita_seragamkan_tautan
    before insert or update of link, link_normalized on public.berita
    for each row
    execute function public.seragamkan_tautan_berita();


-- --------------------------------------------------------------- 3. Penyeragaman

-- Baris lama ikut diseragamkan supaya aturan barunya berlaku atas seluruh
-- arsip, bukan hanya atas berita yang datang sesudah hari ini.
update public.berita
   set link_normalized = public.normalkan_tautan(link)
 where link is not null
   and link_normalized is distinct from public.normalkan_tautan(link);


-- --------------------------------------------------------------- 4. Indeks unik

-- Lapis terakhir. Pemicu bisa dinonaktifkan, dilewati oleh COPY, atau hilang
-- pada pemulihan cadangan yang tidak lengkap; indeks unik tidak.
--
-- Baris terhapus (deleted_at) dikecualikan supaya berita yang pernah dihapus
-- tidak menghalangi berita yang sama dimasukkan kembali dengan sengaja.
create unique index if not exists berita_link_normalized_unik_idx
    on public.berita (link_normalized)
    where deleted_at is null and link_normalized <> '';


-- ------------------------------------------------------------------ 5. Periksa
--
--   select count(*) as total,
--          count(distinct link_normalized) as unik,
--          count(*) filter (where link_normalized <> public.normalkan_tautan(link)) as belum_seragam
--     from public.berita where deleted_at is null;
--
-- Yang diharapkan: total = unik, dan belum_seragam = 0.
