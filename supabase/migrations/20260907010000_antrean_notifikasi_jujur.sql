/*
  Antrean pemberitahuan yang jujur tentang tiga hal.

  Ditulis 7 September 2026, bersama mesin klasifikasi v4.3, sesudah lima
  pemberitahuan "BERITA NEGATIF MASUK" terkirim ke grup pimpinan untuk lima
  kegiatan positif. Mesinnya sudah diperbaiki di tempat lain; yang diperbaiki
  di sini adalah tiga hal pada antreannya sendiri yang membuat kekeliruan mesin
  lebih berisik daripada seharusnya.

  ---------------------------------------------------------------------------
  1. PRIORITAS TERTINGGI TIDAK PERNAH MENYALA
  ---------------------------------------------------------------------------

  Syaratnya berbunyi `b.urgensi in ('KRITIS', 'TINGGI')`, sedangkan mesin
  klasifikasi menulis 'Kritis' dan 'Tinggi'. Tidak ada satu baris pun di dalam
  1.589 baris arsip yang cocok, jadi cabang pertama itu tidak pernah dipakai
  sejak hari ia ditulis — seluruh berita negatif jatuh ke prioritas 2, dan
  kerusuhan berurgensi Kritis mengantre di belakang keluhan menu makanan yang
  kebetulan masuk lebih dulu.

  Perbandingannya kini memakai upper(), bukan daftar yang diperbaiki hurufnya.
  Perayap menulis 'SEDANG' huruf besar pada saat penyisipan dan mesin menimpanya
  dengan 'Sedang' beberapa menit kemudian; keduanya sah, dan view ini tidak
  boleh ikut menebak yang mana yang sedang berlaku.

  ---------------------------------------------------------------------------
  2. BERITA DI LUAR LINGKUP IKUT DIKIRIM SEBAGAI PERINGATAN SATUAN
  ---------------------------------------------------------------------------

  Kategori 9 berarti mesin sudah memutuskan beritanya BUKAN urusan Ditjen
  Pemasyarakatan — rutan milik lembaga lain, atau penjara negara lain. Sampai
  hari ini ia tetap bisa berangkat sebagai pesan tersendiri kalau sentimennya
  negatif, dan itulah yang terjadi pada berita penjara di Gaza.

  Sekarang ia tidak pernah menjadi pesan satuan. Ia tidak dibuang — tetap
  terhitung di ringkasan berkala, sebab keputusan "di luar lingkup" adalah
  keputusan mesin yang berhak ditinjau analis, dan yang tidak pernah terlihat
  tidak pernah bisa ditinjau.

  ---------------------------------------------------------------------------
  3. PEMBACA PESAN TIDAK PERNAH TAHU SEBERAPA YAKIN MESINNYA
  ---------------------------------------------------------------------------

  Sebuah pesan berlencana merah dengan urgensi Tinggi terbaca sama persis, baik
  ketika mesin yakin 97 persen maupun ketika ia menebak dengan 30 persen. Dua
  kolom ditambahkan supaya pesannya bisa mengatakan yang sebenarnya:
  `ai_confidence` dan `kata_kunci` — angka keyakinan, dan kata apa yang
  membuatnya berkesimpulan begitu.

  Keduanya sudah lama ada di tabel `berita`; yang belum ada hanyalah jalannya
  sampai ke pembaca.
*/

/*
  Catatan penggelaran: view ini DIBUANG lalu dibuat ulang, bukan diganti dengan
  `create or replace view`. PostgreSQL menolak penggantian yang menyisipkan
  kolom di tengah daftar; ia hanya menerima penambahan di ujung. Menaruh
  `ai_confidence` dan `kata_kunci` di ujung memang bisa, tetapi urutan kolom
  view ini mengikuti urutan bacaannya — identitas, isi, penilaian, prioritas —
  dan urutan itulah yang membuatnya bisa dibaca orang berikutnya.

  Karena `drop view` menghapus hak akses bersama viewnya, keduanya dipasang
  kembali di bawah, termasuk pencabutan hak `anon` yang memang tidak pernah
  punya akses ke antrean ini.
*/

drop view if exists public.notifikasi_antrean_siap;

create view public.notifikasi_antrean_siap
with (security_invoker = on) as
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
  b.ai_confidence,
  b.kata_kunci,
  b.tanggal_publikasi,
  (b.subkategori_kode like '9.%') as luar_lingkup,
  case
    /* Di luar lingkup lebih dulu, mendahului seluruh cabang sentimen: sebuah
       berita bisa sekaligus negatif DAN bukan urusan kita, dan urutan cabang
       inilah satu-satunya yang menentukan mana yang menang. */
    when b.subkategori_kode like '9.%'                                      then 7
    when b.sentimen = 'Negatif' and upper(b.urgensi) in ('KRITIS','TINGGI') then 1
    when b.sentimen = 'Negatif'                                             then 2
    when b.sentimen is null or b.sentimen = 'Tidak diketahui'               then 5
    when b.sentimen = 'Positif'                                             then 9
    else 8
  end as prioritas,
  (b.sentimen = 'Negatif' and b.subkategori_kode not like '9.%') as negatif
from public.notifikasi_berita n
join public.berita b on b.id = n.berita_id
where n.status = 'antre'
  and b.deleted_at is null;

revoke all on public.notifikasi_antrean_siap from anon;
grant select, insert, update, delete, truncate, references, trigger
  on public.notifikasi_antrean_siap to authenticated, service_role;

comment on view public.notifikasi_antrean_siap is
  'Antrean pemberitahuan beserta prioritasnya. Satu-satunya tempat aturan prioritas ditulis. '
  'Perbandingan urgensi memakai upper() karena perayap dan mesin klasifikasi menulisnya '
  'dengan huruf yang berbeda; kategori 9 tidak pernah menjadi pesan satuan.';
