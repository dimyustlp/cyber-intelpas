# Tutorial: memasang Lembar Kanwil Jawa Timur

Panduan langkah demi langkah untuk **yang hanya bisa dikerjakan dengan tangan
Anda sendiri**. Selebihnya sudah terpasang di pusat.

Perkiraan waktu: **10 menit**. Tidak perlu bisa memprogram — Anda hanya
menempel satu berkas dan menekan tombol.

Berkas yang dipakai: `kanwil-jawa-timur.gs` (59 KB, 1.783 baris).

---

## Kenapa langkah ini tidak bisa saya kerjakan untuk Anda

Tiga hal menuntut milik Anda sendiri, bukan milik sistem:

| Langkah | Sebabnya harus Anda |
| --- | --- |
| Membuat spreadsheet | Ia lahir di Google Drive Anda, dan Anda yang jadi pemiliknya |
| Memberi izin skrip | Google meminta persetujuan pemilik akun, sekali seumur skrip |
| Membagikan lembar | Hanya pemilik yang boleh mengubah setelan berbagi |

---

## BAGIAN A — Memasang (7 langkah)

### A1. Buat spreadsheet baru

Buka [sheets.new](https://sheets.new), lalu beri nama:

```
Trans-Siber PAS — Kanwil Jawa Timur
```

### A2. Buka editor skrip

Menu **Ekstensi → Apps Script**. Tab baru akan terbuka.

### A3. Tempel berkasnya

1. Di editor, hapus **seluruh** isi `Code.gs` (klik di dalamnya, `Ctrl+A`, `Delete`)
2. Buka `kanwil-jawa-timur.gs`, salin **seluruhnya** (`Ctrl+A`, `Ctrl+C`)
3. Tempel ke `Code.gs` (`Ctrl+V`)
4. Simpan (`Ctrl+S`)

> Berkasnya panjang (1.783 baris) — itu wajar. Sebagian besar isinya keterangan,
> daftar 39 unit Jatim, dan 30 kabupaten/kota.

### A4. Jalankan `siapkanLembar`

Di bagian atas editor ada kotak pilihan fungsi. Pilih **`siapkanLembar`**, lalu
tekan **Jalankan (Run)**.

**Di sinilah Google akan meminta izin.** Yang muncul:

1. "Authorization required" → **Review permissions**
2. Pilih akun Google Anda
3. Muncul layar **"Google hasn't verified this app"** →
   klik **Advanced** → **Go to Trans-Siber PAS (unsafe)**
4. **Allow**

> Peringatan "unsafe" itu wajar dan bukan tanda bahaya. Google menampilkannya
> untuk semua skrip yang belum didaftarkan ke toko publik. Skrip ini milik Anda
> sendiri, berjalan di akun Anda, dan hanya meminta dua hal: membaca/menulis
> spreadsheet ini, dan mengambil halaman dari internet untuk mencari berita.

Setelah selesai, kembali ke spreadsheet. Sekarang sudah ada **6 tab**:

| Tab | Isinya |
| --- | --- |
| **Berita** | tempat hasil jaringan masuk (masih kosong) |
| **Target Unit** | 39 unit Jatim, sudah terisi otomatis |
| **Portal Wilayah** | 24 portal benih, sudah terisi otomatis |
| **Tier Media** | daftar tier untuk perkiraan di layar |
| **Jurnal** | catatan tiap kali penjaring berjalan |
| **Petunjuk** | keterangan untuk petugas |

### A5. Jalankan `pasangPemicu`

Kembali ke editor Apps Script. Pilih fungsi **`pasangPemicu`** → **Jalankan**.

Ini menjadwalkan penjaringan otomatis tiap hari:

| Jam | Kaki | Yang dicari |
| --- | --- | --- |
| 02.00 | portal | RSS portal hiperlokal — **jalan ke Tier 4** |
| 04.00 | unit | nama 39 unit beserta ragam namanya |
| 06.00 | kota | 30 kabupaten/kota |
| 08.00 | isu | 9 isu berat (pelarian, pungli, kematian, dll.) |

> Jamnya sengaja direnggangkan. Apps Script memotong satu jalan pada enam menit,
> dan dua jalan yang berebut kuota akan saling memotong.

### A6. Bagikan lembarnya — **langkah paling sering terlewat**

Di spreadsheet: **Bagikan (Share)** → bagian **Akses umum** →
ubah dari "Dibatasi" menjadi **"Siapa saja yang memiliki link"** →
peran **Pelihat (Viewer)** → **Selesai**.

> **Tanpa langkah ini seluruh sistem tidak akan menerima apa pun.** Penyalin di
> pusat membaca lembar ini tanpa akun Google; kalau lembarnya tertutup, ia
> menerima jawaban 401 dan halaman Sinkronisasi Sumber akan menampilkannya
> **Gagal** — dan status itu benar, bukan kekeliruan yang perlu diperbaiki.

### A7. Kirimkan ID spreadsheet ke saya

Lihat alamat di bilah alamat peramban:

```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit
                                       └────────── ini yang saya perlukan ──────────┘
```

Bagian **antara `/d/` dan `/edit`**. Kirimkan ke saya, dan saya daftarkan ke
pusat. Setelah itu berita mulai mengalir sendiri ke
`trans-siberpas.vercel.app`.

---

## BAGIAN B — Menguji sekarang juga (opsional, 2 menit)

Tidak perlu menunggu sampai jam 02.00 dini hari.

1. **Tutup lalu buka lagi** spreadsheet-nya (menu baru hanya muncul setelah
   dimuat ulang)
2. Akan ada menu baru: **Trans-Siber PAS**
3. Pilih **Jaring per unit** — tunggu 1–3 menit

Lalu buka tab **Berita**. Kalau ada baris masuk, berwarna sesuai tier:

| Warna | Tier | Artinya |
| --- | --- | --- |
| 🔴 merah muda | 1 | media nasional — tingkat krisis |
| 🟠 jingga | 2 | jagoan provinsi — tingkat siaga |
| 🟡 kuning | 3 | media karesidenan/kota — waspada |
| 🟢 hijau | 4 | hiperlokal & media sosial — pantau |

### Kalau tab Berita tetap kosong

Buka tab **Jurnal** dan baca satu baris terakhir:

| Yang Anda lihat | Artinya |
| --- | --- |
| `Panggilan Jaringan` = 0 | penjaring tidak berjalan — ulangi langkah A5 |
| `Panggilan Jaringan` besar, `Baris Baru` = 0 | normal — memang tidak ada berita baru hari itu |
| `Tolak: Tak Relevan` besar (kaki portal) | **sehat**, bukan rusak — lihat catatan di bawah |

> Umpan portal memuat **seluruh** terbitan portalnya: olahraga, pilkada,
> kuliner. Yang menyaring hanya jangkar kata Pemasyarakatan. Jadi angka tolak
> yang besar di kaki portal justru tanda ia bekerja benar.

---

## BAGIAN C — Yang membuat sistem ini jauh lebih tajam (5 menit, berulang)

Dua kolom ini **tidak bisa diisi mesin**, dan justru di sinilah nilai terbesar
petugas daerah.

### C1. Ragam Nama — tab **Target Unit**, kolom D

Mesin sudah menurunkan bentuk yang bisa ditebak:

```
Lapas Kelas IIA Kediri  →  Lapas Kediri ; Penjara Kediri ; LP Kediri
```

Yang **tidak** bisa ditebak mesin adalah nama panggilan setempat. Contoh nyata:
Rutan Kelas I Surabaya hampir selalu ditulis wartawan sebagai **"Rutan
Medaeng"** — nama itu tidak ada di data induk mana pun, jadi mesin tidak akan
pernah menemukannya sendiri.

Tambahkan dengan tanda titik-koma:

```
Rutan Kelas I Surabaya ; Rutan Surabaya ; Rumah Tahanan Surabaya ; Rutan Medaeng
```

> **Satu nama panggilan yang benar sering membuka berita yang bertahun-tahun
> tidak pernah tertangkap.**

⚠️ **Jangan pernah menulis nama daerah sendirian** (`Kediri`, `Malang`).
Kolom ini dipakai sebagai syarat lolos penyaringan, jadi satu entri `Kediri`
akan meloloskan jadwal pertandingan Persik ke arsip intelijen — dan arsipnya
tetap terisi, jurnalnya tetap hijau, tanpa ada yang tahu.

### C2. Portal Wilayah — tab **Portal Wilayah**

**Di sinilah Tier 4 bertambah.** Portal kabupaten kecil sering tidak terindeks
Google sama sekali; selama ia tidak ada di daftar ini, ia tidak akan pernah
tertangkap oleh cara apa pun.

Tambahkan satu baris:

| Kolom | Isi |
| --- | --- |
| Nama Portal | nama portalnya |
| Alamat | boleh beranda saja (`https://portalkediri.com`) — mesin mencoba sendiri `/feed`, `/rss`, `?feed=rss2` |
| Tier (dugaan) | 4 |
| Aktif | ✓ centang |

Kalau alamatnya keliru, tidak ada yang rusak — kolom **Butir Terlihat** di tab
itu akan tetap 0, dan Anda tahu harus mengganti alamatnya.

---

## BAGIAN D — Nanti, kalau eskalasi Telegram mau dinyalakan

Belum perlu sekarang. Sistem berjalan penuh tanpa ini.

Yang saya perlukan dari Anda saat itu: **ID grup Telegram**, tiga tingkat —

- grup **Humas UPT / Kalapas**
- grup **Kakanwil & Kadiv Pemasyarakatan Jatim**
- grup **Ditjenpas Pusat**

Cara mendapatkannya: tambahkan bot ke grup, lalu ID-nya (berawalan `-100…`)
bisa saya ambilkan.

> ⚠️ Sebelum dinyalakan, tunggakan antrean **wajib** dibersihkan lebih dulu.
> Pada 6 September 2026 sakelar serupa dinyalakan tanpa itu, dan grup menerima
> 29 pesan negatif beruntun sebagai sambutan pertama — cara tercepat membuat
> grup dibisukan. Grup yang dibisukan tidak menerima pemberitahuan yang
> benar-benar penting nanti.

---

## Ringkasan: siapa mengerjakan apa

| | Anda | Saya |
| --- | :---: | :---: |
| Buat spreadsheet, tempel skrip, beri izin | ✅ | |
| Bagikan lembar sebagai Pelihat | ✅ | |
| Kirim ID spreadsheet | ✅ | |
| Isi Ragam Nama & Portal Wilayah | ✅ | |
| Sediakan ID grup Telegram (nanti) | ✅ | |
| Daftarkan lembar ke pusat | | ✅ |
| Tier media, dedup, klasifikasi | | ✅ sudah jalan |
| 37 kanwil sisanya | | ✅ satu perintah |

Setelah A1–A7 selesai, sisanya berjalan sendiri.
