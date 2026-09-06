/*
  ============================================================================
  PENJARING MANDIRI — perayap berita yang tidak lagi menumpang Apps Script
  ============================================================================

  KENAPA MIGRASI INI ADA

  Diukur 6 September 2026 malam. Seluruh rantai penyalin sehat: `sheet-sync`
  berjalan tiap lima menit tanpa satu pun galat, membaca 805 baris sumber pusat
  dan 62 baris sumber kanwil, dan `klasifikasi` tidak meninggalkan satu baris
  pun tanpa nilai. Namun yang masuk hari itu hanya delapan berita.

  Sebabnya bukan di sini. Ia di hulu, di tempat yang tidak bisa dilihat sistem
  ini: SKRIP APPS SCRIPT MILIK SPREADSHEET. Yang dikerjakan `sheet-sync` adalah
  menyalin apa yang sudah tertulis di lembar; kalau lembarnya hanya bertambah
  empat baris sehari, empat baris itulah seluruh yang bisa disalin. Diukur dari
  lembar pusat sendiri: 3 baris pada 5 September, 4 pada 6 September — sementara
  satu kueri RSS Google News atas kata "napi kabur" mengembalikan 100 butir.

  Berita negatifnya ada. Ia tidak pernah dijaring.

  Lebih buruk: kesehatan hulu itu TIDAK PERNAH TERBACA dari dalam sistem.
  Penyalin yang menyalin nol baris baru dari lembar yang memang tidak bertambah
  melaporkan "Berhasil" — dan memang berhasil. Halaman Sinkronisasi Sumber
  menampilkan tiga sumber hijau. Kerusakannya sempurna tak terlihat.

  Sumber ketiga `penjaring` yang didaftarkan pagi harinya memperlihatkan bentuk
  kegagalan yang sama sekali lain: lembarnya berisi baris tajuk saja, nol baris
  data, karena skripnya tidak pernah dipasang di Apps Script-nya. Statusnya pun
  "Berhasil — Tidak ada baris data."

  YANG DIKERJAKAN MIGRASI INI

  Memindahkan penjaringan ke dalam sistem. Bukan menambah sumber spreadsheet
  keempat, melainkan membuang perantaranya: Edge Function `penjaring` membaca
  RSS Google News sendiri dan menulis langsung ke `berita`. Tidak ada lembar,
  tidak ada pemicu Apps Script, tidak ada kuota UrlFetchApp, dan — yang paling
  penting — tidak ada lagi mata rantai yang kesehatannya hanya bisa ditebak.

  Tiga tabel:

    penjaring_kueri     apa yang dicari. Baris, bukan konstanta di dalam kode,
                        supaya menambah sasaran isu tidak menuntut penggelaran
                        ulang — persis alasan `sumber_sheet` dibuat begitu.

    penjaring_sasaran   unit mana yang giliran dicari namanya. Urutannya
                        menurut yang PALING LAMA tidak diperiksa, sehingga
                        daftar yang disunting di tengah jalan tidak membuat
                        sebagian unit terlewat selamanya.

    penjaring_log       jurnal tiap jalan. Ini bukan kerapian: perayap yang
                        berhenti bekerja menghasilkan nol baris baru, dan nol
                        baris baru terlihat persis sama dengan "memang tidak
                        ada berita hari ini". Itulah kekeliruan yang baru saja
                        dibayar mahal di hulu. Yang dicatat karena itu bukan
                        hanya berapa yang diterima, melainkan berapa yang
                        DIPERIKSA dan berapa yang ditolak beserta sebabnya.

  Sumber `pusat` dan `kanwil-1` TIDAK disentuh. Keduanya tetap berjalan;
  penjaring menambah, bukan mengganti. Berita kembar antara ketiganya sudah
  ditahan `public.normalkan_tautan()` beserta indeks uniknya sejak migrasi
  20260906020000.
*/

/* ========================================================== penjaring_kueri */

create table if not exists public.penjaring_kueri (
  id                uuid primary key default gen_random_uuid(),
  kode              text not null unique,
  mode              text not null check (mode in ('umum', 'isu')),
  kueri             text not null,
  /* Hanya keterangan bagi pembaca tabel. Yang menentukan subkategori sebuah
     berita tetap mesin klasifikasi, yang membaca seluruh teksnya — bukan kueri
     yang kebetulan menemukannya. Menyimpan tebakan di sini lalu memakainya
     berarti menanam label yang tidak bisa dibedakan dari penilaian sungguhan. */
  subkategori_kode  text,
  aktif             boolean not null default true,
  urutan            integer not null default 100,
  terakhir_jalan_at timestamptz,
  terakhir_temuan   integer,
  catatan           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.penjaring_kueri is
  'Daftar kueri RSS yang dijalankan Edge Function penjaring. Baris, bukan konstanta, supaya sasaran baru tidak menuntut penggelaran ulang.';

create index if not exists penjaring_kueri_giliran_idx
  on public.penjaring_kueri (mode, terakhir_jalan_at nulls first, urutan)
  where aktif;

drop trigger if exists trg_penjaring_kueri_updated_at on public.penjaring_kueri;
create trigger trg_penjaring_kueri_updated_at
  before update on public.penjaring_kueri
  for each row execute function public.set_updated_at();

/* ======================================================= penjaring_sasaran */

create table if not exists public.penjaring_sasaran (
  id                    uuid primary key default gen_random_uuid(),
  nama_upt              text not null unique,
  kanwil                text,
  aktif                 boolean not null default true,
  /* NULL berarti belum pernah diperiksa, dan NULL didahulukan. Unit yang belum
     pernah diberitakan karena itu naik ke depan antrean tanpa perlu penanda
     terpisah yang bisa basi. */
  terakhir_diperiksa_at timestamptz,
  temuan_total          integer not null default 0,
  created_at            timestamptz not null default now()
);

comment on table public.penjaring_sasaran is
  'Unit yang dicari namanya satu per satu. Urut menurut yang paling lama tidak diperiksa.';

create index if not exists penjaring_sasaran_giliran_idx
  on public.penjaring_sasaran (terakhir_diperiksa_at nulls first)
  where aktif;

/* =========================================================== penjaring_log */

create table if not exists public.penjaring_log (
  id                  uuid primary key default gen_random_uuid(),
  mulai_at            timestamptz not null default now(),
  selesai_at          timestamptz,
  mode                text,
  status              text,
  kueri_diperiksa     integer not null default 0,
  butir_terlihat      integer not null default 0,
  diterima            integer not null default 0,
  tolak_tak_relevan   integer not null default 0,
  tolak_alamat        integer not null default 0,
  tolak_kembar        integer not null default 0,
  tolak_usia          integer not null default 0,
  panggilan_jaringan  integer not null default 0,
  durasi_ms           integer,
  pesan               text,
  galat               text,
  rincian             jsonb
);

comment on table public.penjaring_log is
  'Jurnal tiap jalan penjaring. Membedakan "tidak menemukan apa-apa" dari "tidak memeriksa apa pun" — dua keadaan yang tampak sama dari luar.';

create index if not exists penjaring_log_waktu_idx on public.penjaring_log (mulai_at desc);

/* ==================================================================== RLS */

alter table public.penjaring_kueri    enable row level security;
alter table public.penjaring_sasaran  enable row level security;
alter table public.penjaring_log      enable row level security;

/* Menyunting sasaran perayap berarti menentukan apa yang masuk arsip nasional.
   Itu wewenang super admin, sama seperti sumber_sheet. */
drop policy if exists penjaring_kueri_admin on public.penjaring_kueri;
create policy penjaring_kueri_admin on public.penjaring_kueri
  for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists penjaring_sasaran_admin on public.penjaring_sasaran;
create policy penjaring_sasaran_admin on public.penjaring_sasaran
  for all using (public.is_super_admin()) with check (public.is_super_admin());

/* Jurnalnya boleh dibaca siapa pun yang mengurus data berita — tanpa itu,
   yang bisa melihat perayap berhenti bekerja hanya satu orang. */
drop policy if exists penjaring_kueri_baca on public.penjaring_kueri;
create policy penjaring_kueri_baca on public.penjaring_kueri
  for select using (public.has_role(variadic array[
    'super_admin', 'media_intelligence_analyst', 'news_data_operator']));

drop policy if exists penjaring_sasaran_baca on public.penjaring_sasaran;
create policy penjaring_sasaran_baca on public.penjaring_sasaran
  for select using (public.has_role(variadic array[
    'super_admin', 'media_intelligence_analyst', 'news_data_operator']));

drop policy if exists penjaring_log_baca on public.penjaring_log;
create policy penjaring_log_baca on public.penjaring_log
  for select using (public.has_role(variadic array[
    'super_admin', 'media_intelligence_analyst', 'news_data_operator']));

/* ============================================================ isi bawaan */

/*
  Kueri umum — inilah yang menentukan VOLUME.

  Sengaja luas dan sengaja saling bertumpang tindih. Google News membalas paling
  banyak 100 butir per kueri, dan 100 butir teratas atas "lapas OR rutan" hampir
  seluruhnya berita besar hari itu. Kueri yang lebih sempit mengembalikan 100
  butir yang berbeda. Tumpang tindihnya bukan pemborosan melainkan cara
  menembus batas 100 itu; yang kembar ditolak indeks unik, bukan oleh kita.
*/
insert into public.penjaring_kueri (kode, mode, kueri, urutan, catatan) values
  ('umum-inti',      'umum', 'lapas OR rutan OR "warga binaan"',                                          10, 'Sapuan terluas. Sebagian besar volume harian datang dari sini.'),
  ('umum-lembaga',   'umum', '"lembaga pemasyarakatan" OR "rumah tahanan negara"',                        20, 'Bentuk resmi, dipakai media yang menghindari singkatan.'),
  ('umum-penghuni',  'umum', '(napi OR narapidana OR tahanan) (lapas OR rutan)',                          30, 'Berangkat dari penghuninya, bukan dari bangunannya.'),
  ('umum-ditjen',    'umum', 'ditjenpas OR "ditjen pemasyarakatan" OR kemenimipas OR "imigrasi dan pemasyarakatan"', 40, 'Kebijakan dan berita tingkat pusat.'),
  ('umum-bapas',     'umum', 'bapas OR "balai pemasyarakatan" OR lpka OR "lembaga pembinaan khusus anak"', 50, 'Dua jenis unit yang hampir tidak pernah memakai kata "lapas".'),
  ('umum-petugas',   'umum', 'sipir OR "petugas lapas" OR "petugas rutan" OR "kepala lapas" OR kalapas OR karutan', 60, 'Berita yang menyebut petugasnya, bukan unitnya.'),
  ('umum-program',   'umum', '(remisi OR "pembebasan bersyarat" OR asimilasi OR "integrasi sosial") (lapas OR rutan OR pemasyarakatan)', 70, 'Program pembinaan — sisi positif yang jarang tertangkap kueri isu.')
on conflict (kode) do nothing;

/*
  Kueri isu — inilah yang menentukan BERAPA BANYAK YANG NEGATIF.

  Mengikuti taksonomi negatif sistem, dan diurutkan menurut berat akibatnya bila
  terlewat, bukan menurut seberapa sering ia muncul. Pada jalan yang terpotong
  batas waktu, yang di atas tetap terperiksa.

  Tiap kueri MENGIKAT kata isunya pada kata Pemasyarakatan. Tanpa ikatan itu,
  "pungli" mengembalikan seluruh pungli di republik ini, dan yang masuk ke arsip
  intelijen pemasyarakatan adalah berita dinas perhubungan.
*/
insert into public.penjaring_kueri (kode, mode, kueri, subkategori_kode, urutan, catatan) values
  ('isu-kematian',  'isu', '(lapas OR rutan) (tewas OR meninggal OR "gantung diri" OR "bunuh diri")',            '4.1',  10, null),
  ('isu-pelarian',  'isu', '(lapas OR rutan) ("napi kabur" OR "melarikan diri" OR pelarian OR kabur)',           '1.1',  20, null),
  ('isu-kerusuhan', 'isu', '(lapas OR rutan) (kerusuhan OR ricuh OR pemberontakan OR bentrok)',                  '1.2',  30, null),
  ('isu-kekerasan', 'isu', '(sipir OR "petugas lapas" OR "oknum petugas") (menganiaya OR memukuli OR penganiayaan OR kekerasan)', '3.3', 40, null),
  ('isu-korupsi',   'isu', '(kalapas OR karutan OR "kepala lapas" OR "kepala rutan") (korupsi OR tersangka OR OTT OR suap)', '3.5', 50, null),
  ('isu-bencana',   'isu', '(lapas OR rutan) (kebakaran OR terbakar OR banjir OR dievakuasi OR gempa)',          '4.3',  60, null),
  ('isu-narkoba',   'isu', '(lapas OR rutan) (narkoba OR sabu) (dikendalikan OR peredaran OR jaringan)',         '2.1',  70, null),
  ('isu-selundup',  'isu', '(lapas OR rutan) (penyelundupan OR diselundupkan OR handphone OR "telepon genggam")', '6.1', 80, null),
  ('isu-pungli',    'isu', '(lapas OR rutan) (pungli OR "pungutan liar" OR "dimintai uang" OR gratifikasi)',     '3.1',  90, null),
  ('isu-teroris',   'isu', '(napiter OR "narapidana terorisme" OR pembaiatan OR radikalisasi) (lapas OR rutan)', '5.1', 100, null),
  ('isu-kapasitas', 'isu', '(lapas OR rutan) (overkapasitas OR "melebihi kapasitas" OR "kelebihan penghuni")',   '4.2', 110, null),
  ('isu-unjukrasa', 'isu', '(lapas OR rutan) ("unjuk rasa" OR demo OR penyerangan)',                             '6.2', 120, null),
  ('isu-asusila',   'isu', '("oknum petugas lapas" OR "kepala lapas" OR sipir) (asusila OR digerebek OR pelecehan OR mesum)', '3.6', 130, null),
  ('isu-residivis', 'isu', '(residivis OR "baru bebas" OR "mantan napi") ("kembali ditangkap" OR berulah OR "ditangkap lagi")', '7.2', 140, null),
  ('isu-selmewah',  'isu', '(lapas OR rutan) ("sel mewah" OR "kamar mewah" OR "fasilitas mewah" OR "bilik asmara")', '3.2', 150, null),
  ('isu-bantahan',  'isu', '(lapas OR rutan OR pemasyarakatan) (bantah OR klarifikasi OR hoaks OR "tidak benar")', '7.1', 160, 'Bantahan resmi. Mesin yang memutuskan apakah ia klarifikasi atau justru peristiwanya.')
on conflict (kode) do nothing;

/*
  Sasaran per unit — seluruh unit aktif, bukan hanya yang sunyi.

  Yang sudah pernah muncul ditandai sudah-diperiksa sekarang sehingga jatuh ke
  belakang antrean; yang belum pernah muncul dibiarkan NULL dan karena itu naik
  ke depan. Menyimpan SELURUHNYA, bukan hanya yang sunyi, membuat daftar ini
  tidak pernah perlu disusun ulang ketika sebuah unit berpindah golongan.
*/
insert into public.penjaring_sasaran (nama_upt, kanwil, terakhir_diperiksa_at)
select
  u.nama_upt,
  u.kanwil,
  case when exists (
    select 1 from public.berita b
     where b.nama_upt = u.nama_upt and b.deleted_at is null
  ) then now() else null end
from public.upt u
where u.aktif
on conflict (nama_upt) do nothing;
