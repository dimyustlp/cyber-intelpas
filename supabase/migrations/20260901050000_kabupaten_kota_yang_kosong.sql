-- Mengisi kabupaten/kota tujuh belas unit yang kolomnya kosong sejak awal.
--
-- Lubang ini tidak pernah terlihat di layar, tetapi ia mematikan satu lapisan
-- mesin pencocokan. Lapisan terakhir mesin memetakan berita lewat nama
-- kabupaten ketika nama unitnya tidak disebut sama sekali — "napi kabur dari
-- Rutan Lampung Timur" hanya bisa sampai ke Rutan Sukadana lewat jalan itu.
-- Selama kolomnya kosong, tujuh belas unit kehilangan lapisan tersebut, dan
-- penyaringan per kabupaten di layar juga tidak pernah menemukan mereka.
--
-- Nilainya ditulis tangan karena `location_hint` ketujuh belas unit itu pun
-- kosong: tidak ada apa pun di dalam data yang bisa diturunkan. Yang dipakai
-- adalah kabupaten/kota tempat gedungnya berdiri menurut penamaan wilayah
-- resmi. Daftar yang sama ada di tools/susun-master-upt.mjs sebagai
-- KABKOTA_TAMBALAN, sehingga data/master-upt.csv dan tabel ini tidak berselisih.
--
-- Hanya baris yang kolomnya benar-benar kosong yang disentuh. Bila seseorang
-- sudah mengisinya lebih dulu, isian itulah yang menang.

begin;

update public.upt as t set kabupaten_kota = b.kabkota, updated_at = now()
from (values
  ('Lapas Kelas IIB Pahuwato',                 'Pohuwato'),
  ('Lapas Perempuan Kelas IIA Martapura',      'Banjar'),
  ('Lapas Kelas IIA Palangkaraya',             'Kota Palangka Raya'),
  ('Lapas Perempuan Kelas IIA Palangkaraya',   'Kota Palangka Raya'),
  ('Rutan Kelas IIA Palangkaraya',             'Kota Palangka Raya'),
  ('Lapas Kelas IIA Pangkal Pinang',           'Kota Pangkalpinang'),
  ('Lapas Narkotika Kelas IIA Pangkal Pinang', 'Kota Pangkalpinang'),
  ('Lapas Perempuan Kelas III Pangkalpinang',  'Kota Pangkalpinang'),
  ('Lapas Kelas IIA Tanjung Pinang',           'Kota Tanjungpinang'),
  ('Lapas Narkotika Kelas IIA Tanjung Pinang', 'Kota Tanjungpinang'),
  ('Rutan Kelas I Tanjung Pinang',             'Kota Tanjungpinang'),
  ('Lapas Kelas IIB Fakfak',                   'Fakfak'),
  ('Lapas Kelas IIA Pare-Pare',                'Kota Parepare'),
  ('Lapas Kelas IIB Ulu Siau',                 'Kepulauan Siau Tagulandang Biaro'),
  ('Lapas Kelas III Tagulandang',              'Kepulauan Siau Tagulandang Biaro'),
  ('Lapas Kelas III Labuhan Bilik',            'Labuhanbatu'),
  ('Rutan Kelas I Labuhan Deli',               'Kota Medan')
) as b(nama, kabkota)
where t.nama_upt = b.nama
  and (t.kabupaten_kota is null or btrim(t.kabupaten_kota) = '');

commit;
