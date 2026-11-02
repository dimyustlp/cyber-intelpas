# Memasang lembar induk kanwil (sekali, ±5 menit)

Satu tempel, satu tombol. Lembar induk lalu membuat 32 lembar kanwil
sendiri — lengkap dengan skripnya, dibagikan, dan dijaring bergilir — dan
pusat mendaftarkan semuanya ke website tanpa ada ID yang disalin tangan.

Berkas yang ditempel: `gas/induk-lembar-kanwil.gs` (±178 KB). Buat ulang
kapan saja dengan `node tools/susun-induk-kanwil.mjs`.

## Langkah

1. Buka spreadsheet **Trans-Siber PAS — Lembar Induk Kanwil** di Drive
   (sudah dibuat, masih kosong).
2. **Ekstensi → Apps Script**. Hapus seluruh isi `Code.gs`, tempel seluruh
   `induk-lembar-kanwil.gs`, simpan (`Ctrl+S`).
3. Di kotak pilihan fungsi pilih **`pasangSemua`**, tekan **Jalankan**.
4. Beri izin: *Review permissions* → pilih akun → *Advanced* →
   *Go to … (unsafe)* → *Allow*. Peringatan "unsafe" muncul untuk setiap skrip
   pribadi yang tidak didaftarkan ke toko Google; skrip ini berjalan di akun
   Anda sendiri.

Selesai. Tutup editornya.

## Yang terjadi sesudahnya (tanpa tangan Anda)

| Kapan | Apa |
| --- | --- |
| menit pertama | lembar Daftar Lembar terisi 33 baris; pemicu penjaring dua jam sekali terpasang |
| beberapa menit | lembar kanwil dibuat bertahap (batas enam menit Google), statusnya berubah menjadi **Siap** |
| 10–20 menit sesudah Siap | pusat membaca Daftar Lembar dan mendaftarkan lembar itu (`tarik_daftar_induk`) |
| tiap 30 menit | `sheet-sync` menarik baris Berita setiap lembar ke website |

Lembar kanwil terkumpul di folder Drive **Trans-Siber PAS — Lembar Kanwil**.
Jawa Timur tidak dibuat ulang: lembar v2.1-nya tetap berjalan dengan
pemicunya sendiri.

## Kalau ada yang tidak beres

| Yang terlihat | Artinya |
| --- | --- |
| Status **Gagal** di Daftar Lembar | baca kolom Pesan; jalankan menu *Trans-Siber PAS → Lanjutkan membangun* |
| Status **Dibangun, BELUM dibagikan** | bagikan lembar itu manual: Siapa saja yang memiliki link → Pelihat |
| Jurnal Induk: "Dilewati: batas 60 menit" | normal — kuota harian sudah dipakai, berlanjut besok |
| Lembar Siap tapi tidak muncul di website | menu *Periksa kesehatan semua lembar*; lalu halaman Sinkronisasi Sumber di website |

Jangan menghapus baris di Daftar Lembar: ID di sana satu-satunya ingatan
tentang lembar yang sudah dibuat. Untuk berhenti menjaring satu kanwil,
hapus centang **Dikelola Induk**.
