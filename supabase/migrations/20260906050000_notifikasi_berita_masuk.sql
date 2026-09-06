/*
  ============================================================================
  NOTIFIKASI BERITA MASUK — antrean, bukan pemicu yang langsung mengirim
  ============================================================================

  Yang diminta: satu pemberitahuan Telegram setiap kali sebuah berita berhasil
  masuk ke sistem, dengan berita negatif didahulukan.

  KENAPA ANTREAN, BUKAN PEMICU YANG LANGSUNG MENGIRIM

  Tiga alasan, dan ketiganya sudah pernah menggigit sistem lain:

  1. **Sentimennya belum ada saat berita masuk.** `sheet-sync` dan `penjaring`
     menulis `sentimen = 'Tidak diketahui'`; yang menilainya `klasifikasi`,
     yang berjalan terpisah setiap sepuluh menit. Pemberitahuan yang dikirim
     pada detik penyisipan karena itu TIDAK MUNGKIN tahu berita itu negatif
     atau bukan — dan "utamakan yang negatif" berhenti punya arti.

     Antrean menunggu sampai barisnya dinilai, atau sampai batas sabar terlewat
     (lihat `tunggu_klasifikasi_menit`). Yang kedua perlu supaya berita tidak
     tertahan selamanya bila mesin klasifikasi berhenti.

  2. **Menulis ke Telegram dari dalam pemicu berarti menahan penyisipannya.**
     Satu grup yang lambat menjawab akan memperlambat seluruh penyalinan, dan
     satu grup yang menolak akan MENGGAGALKAN penyisipan berita. Berita yang
     hilang karena Telegram sedang sibuk adalah harga yang tidak masuk akal.

  3. **Perayap baru menyisipkan berpuluh baris sekaligus.** Tanpa antrean yang
     bisa dibatasi, satu jalan penjaring berarti puluhan pesan beruntun ke grup
     berisi orang sungguhan. Antrean memberi tempat untuk aturan "sekian pesan
     satuan per jalan, sisanya diringkas".

  YANG MENJAMIN TIDAK ADA YANG TERLEWAT

  Pemicunya ada di tabel `berita`, bukan di dalam salah satu penyalin. Semua
  jalan masuk — `sheet-sync`, `penjaring`, borang Input Berita, dan apa pun yang
  ditambahkan nanti — melewati tabel yang sama. Memasang penghitungnya di satu
  penyalin berarti jalan masuk berikutnya diam-diam tidak terpantau.

  YANG MENJAMIN TIDAK ADA YANG DIKIRIM DUA KALI

  `berita_id` adalah kunci utama antrean. Satu berita hanya bisa punya satu
  baris antrean, dan statusnya berpindah sekali.
*/

/* ======================================================= notifikasi_setelan */

/*
  Satu baris, dan hanya boleh satu. Setelan yang tersebar di beberapa baris
  menimbulkan pertanyaan "yang mana yang berlaku" tepat pada saat orang sedang
  panik mencari kenapa pesannya tidak sampai.
*/
create table if not exists public.notifikasi_setelan (
  id                       smallint primary key default 1 check (id = 1),

  /* Sakelar induk. Dimatikan berarti antrean tetap terisi tetapi tidak ada
     yang dikirim — sehingga menyalakannya kembali tidak menumpahkan tunggakan
     berhari-hari sekaligus (lihat `umur_maks_menit`). */
  aktif                    boolean not null default false,

  /* Berita negatif dikirim satu per satu, dengan seluruh keterangannya.
     Selebihnya diringkas. Inilah bentuk "utamakan berita negatif". */
  batas_satuan_per_jalan   integer not null default 8,

  /* Yang tidak negatif tidak layak satu pesan sendiri-sendiri — grup akan
     berhenti dibaca dalam dua hari. Ia dikumpulkan menjadi satu ringkasan. */
  ringkasan_aktif          boolean not null default true,
  jeda_ringkasan_menit     integer not null default 180,
  terakhir_ringkasan_at    timestamptz,

  /* Berapa lama menunggu mesin klasifikasi sebelum mengirim apa adanya. */
  tunggu_klasifikasi_menit integer not null default 25,

  /* Berita yang sudah terlalu lama mengantre tidak dikirim lagi, ia ditandai
     'kedaluwarsa'. Pemberitahuan yang datang enam jam terlambat bukan
     pemberitahuan; ia hanya kebisingan yang menutupi yang sungguhan. */
  umur_maks_menit          integer not null default 360,

  updated_at               timestamptz not null default now()
);

insert into public.notifikasi_setelan (id) values (1) on conflict (id) do nothing;

drop trigger if exists trg_notifikasi_setelan_updated_at on public.notifikasi_setelan;
create trigger trg_notifikasi_setelan_updated_at
  before update on public.notifikasi_setelan
  for each row execute function public.set_updated_at();

/* ======================================================== notifikasi_berita */

create table if not exists public.notifikasi_berita (
  berita_id     uuid primary key references public.berita(id) on delete cascade,
  antre_at      timestamptz not null default now(),
  status        text not null default 'antre'
                  check (status in ('antre', 'terkirim', 'gagal', 'dilewati', 'kedaluwarsa')),
  jalur         text check (jalur in ('satuan', 'ringkasan')),
  percobaan     integer not null default 0,
  terkirim_at   timestamptz,
  message_id    text,
  alasan        text,
  galat         text
);

comment on table public.notifikasi_berita is
  'Antrean pemberitahuan Telegram, satu baris per berita. Diisi pemicu pada tabel berita; dikuras Edge Function notifikasi.';

/* Indeks yang dipakai penguras: yang masih mengantre, terlama lebih dulu. */
create index if not exists notifikasi_berita_antre_idx
  on public.notifikasi_berita (antre_at)
  where status = 'antre';

/* ================================================================= pemicu */

create or replace function public.antrekan_notifikasi_berita()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* Berita yang lahir sudah terhapus tidak pernah tampil di layar mana pun;
     memberitahukannya berarti menunjuk sesuatu yang tidak bisa dibuka. */
  if new.deleted_at is not null then
    return new;
  end if;

  begin
    insert into public.notifikasi_berita (berita_id)
    values (new.id)
    on conflict (berita_id) do nothing;
  exception when others then
    /*
      Kegagalan mengantrekan TIDAK BOLEH menggagalkan penyisipan beritanya.

      Kehilangan satu pemberitahuan bisa diperbaiki menit berikutnya; berita
      yang tidak jadi masuk karena tabel antreannya sedang bermasalah hilang
      untuk seterusnya — perayapnya sudah menandai alamat itu sebagai
      terperiksa dan tidak akan mengunjunginya lagi.
    */
    raise warning 'Gagal mengantrekan notifikasi untuk berita %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists berita_antrekan_notifikasi on public.berita;
create trigger berita_antrekan_notifikasi
  after insert on public.berita
  for each row execute function public.antrekan_notifikasi_berita();

/* ================================================================== bacaan */

/*
  Satu tempat yang menjawab "apa yang siap dikirim, dan mana yang didahulukan".

  Ditaruh di basis data, bukan disusun di dalam Edge Function, karena aturan
  prioritasnya harus sama dengan yang dipakai layar mana pun yang kelak
  menampilkan antrean ini. Aturan yang ditulis dua kali adalah aturan yang
  akan berbeda — pelajaran yang sudah dibayar sistem ini pada aturan tautan.

  Urutannya:
    1  negatif + urgensi tinggi   — yang harus dibaca malam ini juga
    2  negatif lainnya
    5  belum dinilai              — tidak diketahui bisa berarti apa saja
    8  netral/campuran
    9  positif
*/
create or replace view public.notifikasi_antrean_siap as
select
  n.berita_id,
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
  b.tanggal_publikasi,
  case
    when b.sentimen = 'Negatif' and b.urgensi in ('KRITIS', 'TINGGI') then 1
    when b.sentimen = 'Negatif'                                      then 2
    when b.sentimen is null or b.sentimen = 'Tidak diketahui'        then 5
    when b.sentimen = 'Positif'                                      then 9
    else 8
  end as prioritas,
  (b.sentimen = 'Negatif') as negatif
from public.notifikasi_berita n
join public.berita b on b.id = n.berita_id
where n.status = 'antre'
  and b.deleted_at is null;

comment on view public.notifikasi_antrean_siap is
  'Antrean pemberitahuan beserta prioritasnya. Satu-satunya tempat aturan prioritas ditulis.';

/* ==================================================================== RLS */

alter table public.notifikasi_setelan enable row level security;
alter table public.notifikasi_berita  enable row level security;

drop policy if exists notifikasi_setelan_admin on public.notifikasi_setelan;
create policy notifikasi_setelan_admin on public.notifikasi_setelan
  for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists notifikasi_berita_baca on public.notifikasi_berita;
create policy notifikasi_berita_baca on public.notifikasi_berita
  for select using (public.has_role(variadic array[
    'super_admin', 'media_intelligence_analyst', 'news_data_operator']));

/*
  Edge Function penguras memakai kunci peladen (service role), yang melewati
  RLS. Tidak ada kebijakan tulis untuk peran mana pun dengan sengaja: antrean
  yang bisa ditandai "terkirim" dari peramban adalah antrean yang bisa
  dibungkam tanpa jejak.
*/
