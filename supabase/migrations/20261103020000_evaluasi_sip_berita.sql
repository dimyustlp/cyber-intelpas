-- Penilaian SIP 2023 oleh analis: evaluasi sumber (A-E) dan evaluasi kebenaran
-- informasi (1-5), Lampiran I Kepdirjenpas PAS-17.OT.02.02 Tahun 2023.
--
-- Ditaruh di rekomendasi_berita, bukan di tabel berita, karena dua alasan.
-- Pertama, tabel berita diisi mesin dan ditimpa sinkronisasi; penilaian
-- manusia yang ditaruh di sana bisa hilang tanpa jejak. Kedua, penilaian
-- ini lahir bersama keputusan tindak lanjut — orang yang sama, saat yang
-- sama — dan pemicu rekomendasi_berita_cap sudah mencatat siapa dan kapan.
--
-- Kosong berarti analis belum menilai, dan layar memakai saran mesin dari
-- web/js/lib/sip.js. Kolom lama (tindakan, hasil_verifikasi, catatan) tidak
-- disentuh.

alter table public.rekomendasi_berita
  add column if not exists evaluasi_sumber text
    check (evaluasi_sumber is null or evaluasi_sumber in ('A', 'B', 'C', 'D', 'E')),
  add column if not exists evaluasi_informasi text
    check (evaluasi_informasi is null or evaluasi_informasi in ('1', '2', '3', '4', '5'));

comment on column public.rekomendasi_berita.evaluasi_sumber is
  'Evaluasi sumber SIP 2023: A selalu andal, B hampir selalu andal, C terkadang andal, D tidak dapat diandalkan, E belum diuji.';
comment on column public.rekomendasi_berita.evaluasi_informasi is
  'Evaluasi kebenaran informasi SIP 2023: 1 sangat dipercaya dan benar s.d. 5 tidak dapat dipercaya.';
