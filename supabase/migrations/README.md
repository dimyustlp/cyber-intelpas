# Migrasi Basis Data Cyber-Intelpas

Delapan berkas migrasi. Empat yang pertama membenahi temuan audit 22 Agustus 2026;
empat terakhir menyiapkan sumber data kantor wilayah, menutup lubang cakupan
yang lahir dari perubahan itu, dan mendelegasikan penerbitan akun penginput
kepada admin kanwil. Semuanya idempoten — aman dijalankan berulang.

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

- **Rotasi token sinkronisasi.** Token `x-sync-token` saat ini tertulis polos di
  dalam perintah `cron.job`. Pindahkan ke Supabase Vault dan ganti nilainya.
- **Penautan pengguna lama.** Lima profil di `app_users` masih memakai
  `password_hash` peninggalan Streamlit. Buat undangan Supabase Auth dengan
  `username` yang sama pada metadata, dan trigger `on_auth_user_created` akan
  menautkannya otomatis.
- **Pengosongan `password_hash`.** Setelah semua pengguna berpindah, kosongkan
  kolom itu. Kolomnya sengaja belum dihapus supaya masih bisa dikembalikan.
