-- Tanggal berita lembar kanwil per provinsi tergeser +7 jam.
--
-- Lembar kanwil (gas/lembar-kanwil-v3.template.gs) menulis waktu sebagai
-- 'yyyy-mm-dd hh:mm' jam WIB. sheet-sync sampai v7.1 hanya mengenali
-- 'dd/mm/yyyy' sebagai WIB; bentuk ISO tanpa zona jatuh ke `new Date(teks)`,
-- yang di Edge Function (zona UTC) membacanya sebagai UTC. Diukur 4 November
-- 2026: 312 dari 313 berita lembar kanwil per provinsi tercatat terbit
-- rata-rata 6,7 jam SESUDAH ditangkap; bila digeser −7 jam, nol yang tersisa.
-- Berita yang terbit pukul 17.00–23.59 WIB jatuh ke hari berikutnya di jendela
-- hari WIB (dasbor "hari ini", laporan harian).
--
-- Yang TIDAK terdampak: lembar pusat dan lembar kanwil lama (kanwil-1), yang
-- memakai 'dd/mm/yyyy' — 515 baris kanwil-1 nol yang maju — dan penjaring.
--
-- sheet-sync v7.2 menguraikan bentuk itu sebagai WIB untuk baris BARU; baris
-- lama tidak disentuh sinkron, sebab kunci dan hash isinya sengaja tetap
-- memakai penguraian lama (lihat parseDateLama). Karena itu arsipnya
-- dibetulkan sekali di sini, hanya baris yang masuk SEBELUM v7.2 tergelar —
-- batas waktunya mencegah baris yang sudah benar ikut tergeser dua kali.
-- waktu_respon kosong di seluruh 313 baris, jadi tidak ikut.

alter table public.berita disable trigger trg_berita_updated_at;

update public.berita
   set tanggal_publikasi = tanggal_publikasi - interval '7 hours',
       detected_at       = detected_at - interval '7 hours'
 where source_type = 'google_sheet_kanwil'
   and created_by like 'sheet_sync:kanwil-%'
   and created_by <> 'sheet_sync:kanwil-1'
   -- last_synced_at, bukan created_at: baris lama yang isinya disunting
   -- petugas sesudah v7.2 tergelar sudah ditulis ulang dengan tanggal benar.
   and coalesce(last_synced_at, created_at) < '__BATAS_V72__'::timestamptz
   and tanggal_publikasi is not null;

alter table public.berita enable trigger trg_berita_updated_at;
