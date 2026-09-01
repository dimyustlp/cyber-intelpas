# Migrasi Basis Data Cyber-Intelpas

Sebelas berkas migrasi. Empat yang pertama membenahi temuan audit 22 Agustus 2026;
empat terakhir menyiapkan sumber data kantor wilayah, menutup lubang cakupan
yang lahir dari perubahan itu, dan mendelegasikan penerbitan akun penginput
kepada admin kanwil. Tiga terakhir membuka jalur Telegram yang selama ini buntu dan
menutup fungsi tulis yang terbuka bagi seluruh pengguna. Semuanya idempoten —
aman dijalankan berulang.

| Berkas | Isi |
|---|---|
| `20260822010000_auth_bridge.sql` | Jembatan ke Supabase Auth, fungsi identitas, penautan profil lama |
| `20260822020000_rls_policies.sql` | 61 policy RLS untuk 20 tabel, sesuai 6 peran |
| `20260822030000_reports_telegram_ai.sql` | Laporan harian, pengaturan Telegram, jejak klasifikasi AI |
| `20260822040000_hardening_storage.sql` | Pengerasan fungsi, policy storage, indeks, pencarian teks |
| `20260831010000_sumber_ganda_dan_angka.sql` | Daftar sumber spreadsheet, kolom `kanwil_asal`, satu definisi "negatif", penguncian tabel cadangan |
| `20260831020000_cakupan_wilayah.sql` | Dua peran kanwil, `can_access_upt` yang menolak lebih dulu, policy berita per wilayah |
| `20260831030000_tutup_fungsi_terbuka.sql` | Mencabut hak eksekusi anon atas fungsi SECURITY DEFINER, termasuk `snapshot_laporan` |
| `20260831040000_admin_kanwil_kelola_penginput.sql` | Admin kanwil membaca profil di wilayahnya dan menyunting penginputnya sendiri |
| `20260901010000_integrasi_telegram_baku.sql` | Nilai bawaan `integration_id` — sebab sesungguhnya pendaftaran grup Telegram selalu gagal |
| `20260901020000_pesan_harian_telegram.sql` | Penyusun pesan harian dari `snapshot_laporan`, beserta cron 06.30 WIB |
| `20260901030000_tutup_fungsi_tulis_dan_agregat_nasional.sql` | Mencabut hak `authenticated` atas `terapkan_klasifikasi` dan rekap nasional |

## Mengapa migrasi 06 harus ada sebelum akun kanwil pertama

`can_access_upt()` pada migrasi 01 berbunyi: bila `assigned_upt` kosong, izinkan
semuanya. Aturan itu benar selama satu-satunya pengguna tanpa penugasan adalah
petugas pusat. Akun kantor wilayah ditugaskan per *wilayah*, bukan per unit —
dan klausa yang sama akan memberi mereka seluruh arsip nasional. Migrasi 06
membalik urutannya: tolak lebih dulu, lalu izinkan menurut kelas peran. Peran
pusat tanpa penugasan tetap melihat seluruhnya, sehingga tidak ada pengguna yang
sedang bekerja kehilangan aksesnya.

## Yang berubah secara mendasar

Sebelum migrasi ini, RLS menyala pada 20 dari 20 tabel tanpa satu pun policy.
Artinya setiap akses harus lewat `service_role key`, dan pembatasan peran hanya
hidup di lapisan tampilan. Siapa pun yang memegang kunci itu memegang seluruh
basis data.

Sesudahnya, peran ditegakkan oleh PostgreSQL sendiri. Aplikasi cukup memakai
`anon key` ditambah sesi pengguna. `service_role key` hanya dipegang proses latar.

## Hasil pengujian lokal

Diuji pada PostgreSQL 16 dengan tiruan skema produksi dan enam pengguna,
satu untuk tiap peran. Yang diverifikasi:

- Operator hanya melihat berita UPT yang ditugaskan padanya (1 dari 3 baris uji).
- Operator gagal menyunting berita di luar wilayahnya.
- Operator gagal menaikkan perannya sendiri menjadi `super_admin`.
- Operator gagal mencatat keputusan pimpinan.
- Analis melihat seluruh berita hidup, bukan yang sudah dihapus lunak.
- Analis dapat memverifikasi berita, tetapi gagal menghapusnya permanen.
- Pimpinan dapat mencatat keputusan, tetapi gagal menyunting isi berita.
- Petugas lapangan tidak melihat satu baris pun pengaturan integrasi.
- Administrator melihat ketiga berita termasuk yang terhapus.
- Tanpa sesi, seluruh tabel mengembalikan nol baris.
- Migrasi dijalankan tiga kali berturut-turut tanpa perubahan hasil.

## Cara menerapkan

**Jangan** jalankan langsung ke produksi. Urutannya:

1. Buat branch pratinjau di Supabase (`supabase branches create`) atau salin
   proyek ke instance uji.
2. Jalankan keempat berkas berurutan sesuai nama.
3. Buat satu pengguna Supabase Auth untuk tiap peran, lalu uji masuk dari
   aplikasi dengan `anon key`.
4. Pastikan alur lama masih berjalan: sinkronisasi Spreadsheet tiap 5 menit
   tidak terpengaruh karena Edge Function memakai `service_role` yang melewati
   RLS.
5. Baru terapkan ke produksi, di luar jam kerja.

## Yang masih harus dikerjakan manual

Diperiksa langsung ke proyek pada 1 September 2026; yang tertulis di bawah adalah
keadaan sesungguhnya, bukan rencana.

- **Kunci bot Telegram.** `TELEGRAM_BOT_TOKEN` dipasang sebagai secret Edge
  Function lewat Dashboard, bukan lewat SQL dan bukan lewat aplikasi. Kunci yang
  pernah melewati percakapan, surel, atau tangkapan layar harus dicabut dulu di
  BotFather dan diganti yang baru — nilai yang sudah keluar dari tempatnya tidak
  bisa ditarik kembali.
- **Penautan pengguna lama.** Baru 2 dari 6 profil `app_users` yang tertaut ke
  Supabase Auth. Empat sisanya belum bisa masuk lewat Auth. Buat undangan dengan
  `username` yang sama pada metadata; trigger `on_auth_user_created`
  menautkannya otomatis.
- **Pengosongan `password_hash`.** Keenam profil masih menyimpan hash sandi
  peninggalan Streamlit. Kosongkan setelah keempat akun di atas berpindah.
- **Proteksi sandi bocor.** Pemeriksaan HaveIBeenPwned masih mati. Dinyalakan di
  Dashboard → Authentication → Policies; tidak ada jalur SQL untuk ini.
- **Fungsi uji `uji-berkas-sementara`.** Masih tergelar dan aktif. Hapus lewat
  Dashboard → Edge Functions; ia tidak dipakai apa pun.

## Data induk UPT

Tabel `upt` berisi 531 unit: 337 Lapas, 162 Rutan, dan 32 LPKA. Potretnya ada di
`data/master-upt.csv`, disusun `tools/susun-master-upt.mjs` dari daftar UPT
nasional di `data/sumber/daftar-upt-nasional.csv`.

Sampai 1 September 2026 tabel ini berisi 492 unit — 327 Lapas dan 165 Rutan —
tanpa satu pun LPKA. Akibatnya bukan sekadar kolom kosong: mesin pencocokan
mencari kandidat yang jenisnya sama dengan yang disebut teks, sehingga berita
yang menulis "LPKA Kutoarjo" tidak punya satu pun kandidat untuk dibandingkan
dan selalu berakhir "Belum Teridentifikasi". Migrasi
`20260901040000_master_upt_nasional.sql` menutup lubang itu: 39 unit
ditambahkan, 32 di antaranya seluruh LPKA di Indonesia, dan empat unit yang naik
status dari Rutan menjadi Lapas diganti namanya berikut berita dan penugasan
pengguna yang menunjuk nama lama.

### Kabupaten/kota yang kosong

Tujuh belas unit masuk ke data induk tanpa kabupaten/kota — seluruh unit
Palangkaraya, Pangkal Pinang, dan Tanjung Pinang di antaranya. Lubang itu tidak
terlihat di layar, tetapi ia mematikan lapisan terakhir mesin pencocokan:
berita yang menyebut kabupaten tanpa menyebut nama unitnya hanya bisa sampai
lewat kolom tersebut. Migrasi `20260901050000_kabupaten_kota_yang_kosong.sql`
mengisinya; daftar yang sama ada di `tools/susun-master-upt.mjs` sebagai
`KABKOTA_TAMBALAN`, sehingga tabel dan `data/master-upt.csv` tidak berselisih.

### Yang masih terbuka

**Bapas tetap tidak ada di tabel ini, dan itu keputusan, bukan kelalaian.**
Daftar nasional memuat 80 Bapas serta satu Rumah Sakit Pengayoman; seluruhnya
sengaja dilewati karena sistem ini memantau pemberitaan hunian pemasyarakatan,
bukan pembinaan klien di luar tembok. Konsekuensinya tetap ada dan tetap harus
dibaca apa adanya: berita yang menulis "Bapas Palembang" akan terus berakhir
"Belum Teridentifikasi" — 16 berita pada arsip saat ini.

Kelonggaran lintas jenis pada mesin sengaja TIDAK menambal ini. Bapas adalah
lembaga dengan tugas yang berbeda dari Lapas, dan memetakan berita Bapas
Balikpapan ke Lapas Balikpapan hanya karena nama kotanya sama akan membebankan
catatan sebuah unit kepada unit lain yang tidak ada hubungannya. Bila kelak
Bapas ikut dipantau, jalannya sudah ada: hapus `'Bapas'` dari `JENIS_DILEWATI`
pada `tools/susun-master-upt.mjs` dan jalankan ulang alat itu.

**Selisih satu unit terhadap angka Ditjenpas.** Papan angka Ditjenpas menyebut
627 UPT, yang setelah dikurangi 94 Bapas dan 1 rumah sakit menjadi 532. Daftar
nasional yang dipakai di sini menghasilkan 531 — ia memuat "LAPAS KELAS IIA
BUKITTINGGI" dua kali, dan setelah baris kembar itu dibuang ia mencatat 32 LPKA
sementara papan Ditjenpas menyebut 33. Satu LPKA memang tidak ada pada daftar
sumbernya. Ia tidak dikarang; ia diminta.

**Koordinat.** 530 dari 531 unit masih memakai titik pusat kota atau kabupaten,
bukan alamat gedungnya — termasuk seluruh 39 unit baru, yang mewarisi titik unit
terdekat dan ditandai `Titik wilayah—warisan unit terdekat`. Setiap barisnya
memuat catatan verifikasi yang mengatakan persis itu.
