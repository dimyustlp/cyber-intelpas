/*
  ============================================================================
  UMPAN PORTAL — tulang punggung yang tidak bergantung pada Google
  ============================================================================

  Diuji langsung dari peladen Edge Function 6 September 2026: RSS pencarian
  Google News berjalan, tetapi halaman artikelnya dibalas 429 dan — setelah
  sepuluh permintaan beruntun — pencariannya sendiri dibalas 503. Alamat IP
  peladen Supabase dipakai bersama banyak orang, dan Google membatasi keduanya.

  Akibatnya bukan "penjaring lambat" melainkan "penjaring berhenti tanpa
  pemberitahuan": jalan yang seluruh penguraiannya ditolak menghasilkan nol
  baris baru, dan nol baris baru terlihat persis sama dengan hari yang memang
  sepi. Itu bentuk kegagalan yang sama yang baru saja ditemukan di hulu.

  Umpan portal menutup lubang itu. Ia membaca RSS milik portalnya sendiri, yang
  memberi ALAMAT ARTIKEL LANGSUNG — tidak ada yang perlu diuraikan, tidak ada
  tanda tangan, tidak ada batchexecute, dan tidak ada Google di tengah jalan.

  Pembagian pekerjaannya jadi begini:

    umpan   pasti, tidak bergantung siapa pun, alamat langsung. Terbatas pada
            portal yang punya RSS — sekitar empat puluh, termasuk 34 kantor
            daerah ANTARA yang justru meliput unit-unit kecil.

    umum    volume terbesar, dari pencarian Google News. Perlu penguraian
            alamat, dan karena itu bisa dipotong Google kapan saja.

    isu     pencarian bertarget taksonomi negatif.

    unit    pencarian per nama unit yang belum pernah diberitakan.

  Yang pertama berjalan sendiri meski tiga sisanya sedang ditolak Google.
*/

create table if not exists public.penjaring_umpan (
  id                uuid primary key default gen_random_uuid(),
  kode              text not null unique,
  nama              text not null,
  url               text not null,
  lingkup           text not null default 'nasional' check (lingkup in ('nasional', 'daerah')),
  provinsi          text,
  aktif             boolean not null default true,
  urutan            integer not null default 100,
  terakhir_jalan_at timestamptz,
  terakhir_status   text,
  terakhir_pesan    text,
  terakhir_temuan   integer,
  gagal_beruntun    integer not null default 0,
  created_at        timestamptz not null default now()
);

comment on table public.penjaring_umpan is
  'Daftar RSS portal yang dibaca langsung. Alamat artikelnya sudah alamat sebenarnya, jadi tidak perlu diuraikan.';

create index if not exists penjaring_umpan_giliran_idx
  on public.penjaring_umpan (terakhir_jalan_at nulls first, urutan)
  where aktif;

alter table public.penjaring_umpan enable row level security;

drop policy if exists penjaring_umpan_admin on public.penjaring_umpan;
create policy penjaring_umpan_admin on public.penjaring_umpan
  for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists penjaring_umpan_baca on public.penjaring_umpan;
create policy penjaring_umpan_baca on public.penjaring_umpan
  for select using (public.has_role(variadic array[
    'super_admin', 'media_intelligence_analyst', 'news_data_operator']));

/*
  Umpan nasional. Seluruhnya diperiksa langsung 6 September 2026; yang membalas
  403, 404, atau nol butir sengaja TIDAK dimasukkan — daftar berisi alamat mati
  membuat jurnal penuh kegagalan yang tidak berarti apa-apa, dan kegagalan yang
  tidak berarti apa-apa adalah cara tercepat membuat orang berhenti membacanya.

  Yang gugur pada pemeriksaan itu: seluruh jaringan Tribun (403), JPNN (403),
  Jawa Pos, Kompas, Liputan6, Suara, Pikiran Rakyat, Solopos (404), dan detik
  (tidak menjawab). Sebagiannya masih terjangkau lewat pencarian Google News.
*/
insert into public.penjaring_umpan (kode, nama, url, lingkup, urutan) values
  ('antara-terkini', 'ANTARA — Terkini',        'https://www.antaranews.com/rss/terkini.xml', 'nasional', 10),
  ('antara-hukum',   'ANTARA — Hukum',          'https://www.antaranews.com/rss/hukum.xml',   'nasional', 11),
  ('cnn-nasional',   'CNN Indonesia — Nasional','https://www.cnnindonesia.com/nasional/rss',  'nasional', 20),
  ('medcom',         'Medcom.id',               'https://www.medcom.id/feed',                 'nasional', 30),
  ('viva',           'VIVA',                    'https://www.viva.co.id/get/all',             'nasional', 40),
  ('inews',          'iNews',                   'https://www.inews.id/feed',                  'nasional', 50),
  ('rri',            'RRI',                     'https://www.rri.co.id/rss',                  'nasional', 60),
  ('tempo-nasional', 'Tempo — Nasional',        'https://rss.tempo.co/nasional',              'nasional', 70),
  ('sindonews',      'SINDOnews',               'https://sindonews.com/feed',                 'nasional', 80),
  ('republika',      'Republika',               'https://www.republika.co.id/rss',            'nasional', 90)
on conflict (kode) do nothing;

/*
  Kantor daerah ANTARA. Inilah bagian yang paling penting bagi masalah yang
  sedang diperbaiki: 343 dari 531 unit belum pernah muncul sekali pun dalam
  arsip, dan hampir seluruhnya unit kecil di daerah. Portal nasional tidak
  meliput mereka; kantor daerah ANTARA meliput.
*/
insert into public.penjaring_umpan (kode, nama, url, lingkup, provinsi, urutan)
select
  'antara-' || p.kode,
  'ANTARA ' || p.nama,
  'https://' || p.kode || '.antaranews.com/rss/terkini.xml',
  'daerah',
  p.nama,
  200
from (values
  ('aceh','Aceh'), ('sumut','Sumatera Utara'), ('sumbar','Sumatera Barat'),
  ('riau','Riau'), ('kepri','Kepulauan Riau'), ('jambi','Jambi'),
  ('sumsel','Sumatera Selatan'), ('babel','Kepulauan Bangka Belitung'),
  ('bengkulu','Bengkulu'), ('lampung','Lampung'), ('banten','Banten'),
  ('megapolitan','DKI Jakarta'), ('jabar','Jawa Barat'), ('jateng','Jawa Tengah'),
  ('jogja','DI Yogyakarta'), ('jatim','Jawa Timur'), ('bali','Bali'),
  ('mataram','Nusa Tenggara Barat'), ('kupang','Nusa Tenggara Timur'),
  ('kalbar','Kalimantan Barat'), ('kalteng','Kalimantan Tengah'),
  ('kalsel','Kalimantan Selatan'), ('kaltim','Kalimantan Timur'),
  ('kaltara','Kalimantan Utara'), ('manado','Sulawesi Utara'),
  ('sulteng','Sulawesi Tengah'), ('makassar','Sulawesi Selatan'),
  ('sultra','Sulawesi Tenggara'), ('gorontalo','Gorontalo'),
  ('sulbar','Sulawesi Barat'), ('ambon','Maluku'), ('malut','Maluku Utara'),
  ('papua','Papua'), ('papuabarat','Papua Barat')
) as p(kode, nama)
on conflict (kode) do nothing;
