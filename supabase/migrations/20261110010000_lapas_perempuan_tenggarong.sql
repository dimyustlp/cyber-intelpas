-- Tambah unit: Lapas Perempuan Kelas IIA Tenggarong (Kalimantan Timur).
--
-- Permintaan user 10 November 2026: Lapas Perempuan Kutai Kartanegara kini
-- bernama Lapas Perempuan Tenggarong sesuai nomenklatur terbaru. Unit perempuan
-- ini belum ada di data induk (yang ada baru Lapas Kelas IIA Tenggarong dan
-- LPKA Kelas II Tenggarong), sehingga berita tentangnya selalu berakhir
-- "Belum Teridentifikasi".
--
-- kabupaten_kota diisi "Kutai Kartanegara" dan nama memakai "Tenggarong",
-- sehingga pencocokan menangkap kedua penyebutan media. Titik diwarisi dari
-- Lapas Kelas IIA Tenggarong — titik wilayah, BUKAN lokasi gedung. Kelas dan
-- nomenklatur resmi (IIA vs "Khusus Perempuan dan Anak") wajib diperiksa
-- Super Admin. "on conflict do nothing" membuat migrasi aman dijalankan ulang.

insert into public.upt (
  nama_upt, jenis_upt, kelas_upt, subjenis_upt, provinsi, kanwil, kabupaten_kota,
  latitude, longitude, coordinate_quality, coordinate_source, coordinate_score,
  location_hint, catatan_verifikasi, aktif
)
values
  ('Lapas Perempuan Kelas IIA Tenggarong', 'Lapas', 'IIA', 'Perempuan',
   'Kalimantan Timur', 'Kantor Wilayah Ditjenpas Kalimantan Timur', 'Kutai Kartanegara',
   0.19563304999999998, 116.20041670228474,
   'Titik wilayah-warisan unit terdekat',
   'Diwarisi dari Lapas Kelas IIA Tenggarong, nama tempat yang sama', 0.5,
   'KUTAI KARTANEGARA',
   'Unit baru: nomenklatur terbaru Lapas Perempuan Tenggarong (dulu disebut Kutai Kartanegara). Kelas/nomenklatur resmi dan titik gedung wajib diperiksa Super Admin.',
   true)
on conflict do nothing;
