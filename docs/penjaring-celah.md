# Penjaring Celah — sumber ketiga

Sumber ketiga Trans-Siber PAS: kenapa ia ada, bagaimana ia mencari, apa yang
menahan berita kembar, dan dua langkah yang hanya bisa dikerjakan pemilik
berkasnya.

Spreadsheet: [Trans-Siber PAS — Penjaring Celah (Sumber 3)](https://docs.google.com/spreadsheets/d/1I_8aDhMxAKZQ-uBHoJaS-RYHj45FOmPXSKj9GXXe5GU/edit)
Skrip: [`tools/penjaring-celah.gs`](../tools/penjaring-celah.gs) · Uji: [`tools/uji-penjaring.mjs`](../tools/uji-penjaring.mjs)

---

## Kenapa ia ada

Diukur 6 September 2026: dari **531 unit pelaksana teknis yang aktif, 343
belum pernah muncul satu kali pun** dalam 858 publikasi terkumpul. Enam puluh
empat persen.

| Kantor Wilayah | Unit | Pernah diberitakan | Sunyi |
|---|---:|---:|---:|
| Maluku Utara | 10 | 0 | **10** |
| Sulawesi Utara | 14 | 1 | **13** |
| Kalimantan Tengah | 12 | 2 | **10** |
| Sumatera Barat | 23 | 5 | **18** |
| Riau | 16 | 4 | **12** |
| Jawa Tengah | 51 | 21 | **30** |

Angka itu bukan berarti unit-unit tersebut tidak ada beritanya. Dua sumber yang
sudah ada bekerja sama-sama **pasif**: keduanya menyapu kata kunci umum lalu
memungut apa pun yang lewat. Penyapuan semacam itu selalu menemukan yang paling
ramai, dan yang paling ramai selalu unit besar di pulau yang sama.

Unit kecil di Halmahera tidak pernah kalah beritanya. **Ia tidak pernah
dicari.**

---

## Dua cara menjaring, dan kenapa dua

| | Berangkat dari | Menjawab | Jadwal |
|---|---|---|---|
| `jaringCelah()` | **Daftar unit** — 343 UPT sunyi, 10 per jalan | "Apa yang terjadi di tempat yang tidak pernah kita lihat?" | 03.00 harian |
| `jaringIsu()` | **Daftar isu** — 14 kueri mengikuti taksonomi negatif | "Apa yang berat, di mana pun ia terjadi?" | 05.00 harian |

Keduanya menutupi kelemahan yang berbeda, dan itu sebabnya keduanya ada.

Penjaringan **per unit** tidak akan pernah menemukan peristiwa berat di unit
yang *sudah* sering diberitakan — unit itu tidak ada di daftar sasaran.
Penjaringan **per isu** tidak akan pernah menemukan kegiatan biasa di unit yang
sunyi — kegiatan biasa tidak memakai kata kunci berat.

Sasaran dipilih dari yang **paling lama tidak diperiksa**, bukan urutan tetap.
Penunjuk berputar yang disimpan terpisah menjadi salah begitu daftarnya
disunting: menghapus satu baris di tengah menggeser seluruh sisanya, dan
sebagian unit terlewat selamanya tanpa ada yang menyadarinya. Kolom
*Terakhir diperiksa* di lembar `Target` menggantikannya.

### Ragam nama

`"Lapas Kelas IIB Tobello"` hampir tidak pernah ditulis lengkap oleh wartawan.
Yang ditulis `"Lapas Tobello"`. Bentuk resmi hanya dipakai siaran pers unit itu
sendiri — yang justru **sudah** tertangkap dua sumber lain.

Penjaring karena itu mencari beberapa ragam sekaligus:

```
"Lapas Kelas IIB Tobello" OR "Lapas Tobello"
"Lapas Perempuan Kelas IIA Semarang" OR "Lapas Perempuan Semarang"
```

Keterangan **Perempuan / Narkotika / Terbuka tidak pernah dibuang**. "Lapas
Perempuan Kelas IIA Semarang" yang diringkas menjadi "Lapas Semarang" akan
menarik berita Lapas Kelas I Semarang — unit yang berbeda, di kota yang sama.
Ringkasan yang menabrak unit lain lebih buruk daripada tidak meringkas.

### Saringan relevansi

Kueri untuk `"Lapas Kelas IIB Ende"` mengembalikan berita tentang **kota**
Ende. Dua syarat menahannya, dan keduanya perlu:

1. **Jangkar Pemasyarakatan** — teksnya harus memuat salah satu dari lapas,
   rutan, warga binaan, napi, sipir, bapas, LPKA, dan seterusnya.
2. **Penanda tempat** — nama tempat unitnya harus benar-benar muncul, bukan
   hanya kata jenis dan kelasnya.

Syarat kedua menahan hal yang lebih halus: berita Lapas Bandung yang kebetulan
memuat kata "kelas" tidak lagi dicatat sebagai berita Lapas Tobello.

---

## Berita kembar: tiga lapis, dan hanya satu yang benar-benar menolak

Penjaring ini **sengaja** mencari di wilayah yang bertumpang tindih dengan dua
sumber lain. Berita kembar karena itu kepastian, bukan kemungkinan.

| Lapis | Di mana | Bisa dilewati? |
|---|---|---|
| 1 | Skrip — alamat yang sudah ada di lembarnya tidak ditulis lagi | Ya |
| 2 | Penyalin — baris yang tautannya sudah ada di basis data dilewati | Ya |
| 3 | **Basis data** — pemicu `berita_seragamkan_tautan` + indeks unik | **Tidak** |

Dua lapis pertama menghemat pekerjaan. **Hanya lapis ketiga yang menolak.**

```
asli    : https://instagram.com/p/Dbuh-8cyaEa
variasi : http://www.instagram.com/p/Dbuh-8cyaEa/?utm_source=uji
hasil   : DITOLAK — Link berita sudah pernah disimpan.
```

### Alamat Google News harus diuraikan

RSS Google News memberi alamat pengalihan miliknya sendiri
(`news.google.com/rss/articles/CBMi…`), bukan alamat artikelnya.

Kalau alamat itu yang ditulis, **seluruh penyaringan kembar lolos** — satu
artikel tersimpan dua kali karena keduanya memang alamat yang berbeda. Ketiga
lapis di atas tidak akan menangkapnya.

Skripnya menguraikan setiap alamat lebih dulu (jangkar `<description>` → alamat
langsung → membuka halamannya dan membaca `canonical`), menyimpan hasilnya di
`CacheService` selama enam jam, dan **membuang butir yang gagal diuraikan**.
Lebih baik kehilangan satu berita daripada menanam satu kembaran yang tidak
bisa dikenali siapa pun sesudahnya.

---

## Lembar Jurnal

Setiap jalan mencatat: berapa diperiksa, berapa diterima, berapa ditolak dan
**karena apa**, berapa panggilan jaringan terpakai, dan berapa lama.

Ini bukan kerapian. Penjaring yang berhenti bekerja — kuota habis, Google
mengubah bentuk RSS-nya, pemicunya terhapus — menghasilkan **nol baris baru**,
dan nol baris baru terlihat persis sama dengan "memang tidak ada berita baru
hari ini". Tanpa jurnal, kerusakan itu bisa berbulan-bulan tidak terlihat.

Baris yang berbunyi `60 diperiksa, 0 diterima, 60 ditolak: tak relevan`
menerangkan keadaan yang sama sekali berbeda dari `0 diperiksa`.

> Sistem ini baru saja membayar mahal untuk pelajaran yang sama: `sheet-sync`
> habis waktu pada **setiap** kali jalan selama berminggu-minggu sementara
> `cron.job_run_details` melaporkan `succeeded` untuk semuanya.

---

## Dua langkah yang hanya bisa dikerjakan pemiliknya

Berkasnya sudah dibuat dan sudah terdaftar sebagai sumber aktif.

**1. Tempel skripnya**

- Buka spreadsheetnya → **Ekstensi → Apps Script**
- Hapus isi `Code.gs`, tempel seluruh isi [`tools/penjaring-celah.gs`](../tools/penjaring-celah.gs), simpan
- Jalankan fungsi `pasangPemicu` sekali (Apps Script akan meminta izin)

**2. Bagikan berkasnya**

- Kembali ke spreadsheet → **Bagikan**
- Setel **"Siapa saja yang memiliki link"** sebagai **Pelihat**

Langkah kedua wajib: penyalin membacanya tanpa akun Google, persis seperti dua
sumber lainnya. Selama belum, halaman Sinkronisasi Sumber menampilkannya
berstatus **Gagal** — dan itu **keadaan yang benar**, bukan kekeliruan. Pesan
galatnya sudah menyebut langkah perbaikannya.

Sesudah langkah kedua tidak ada lagi yang perlu ditekan. `pg_cron` memanggil
penyalin tiap lima menit.

Skripnya juga memasang menu **Penjaring Celah** di spreadsheet, untuk
menjalankan penjaringan sekarang juga tanpa menunggu jadwal.

---

## Menguji skripnya tanpa menempelnya

```bash
node tools/uji-penjaring.mjs
```

Berkas `.gs` berjalan di komputer Google dan tidak bisa dijalankan alat uji
mana pun di repositori ini. Yang bisa diuji adalah bagian yang **tidak
menyentuh Apps Script sama sekali** — pembangun kueri, saringan relevansi,
penyeragam tautan — dan justru di sanalah seluruh regexnya berada.

Regex yang salah di sana tidak menghasilkan galat. Ia menghasilkan nol baris,
dan nol baris terlihat sama dengan "tidak ada berita baru". Uji ini sudah
menangkap satu: penyusun ragam sempat menghasilkan `"Lapas IIB Tobello"` —
bentuk yang tidak pernah ditulis satu wartawan pun, dan yang memakan satu dari
tiga slot kueri yang tersedia.

---

## Menyusun ulang daftar sasaran

Daftar 343 unit di dalam skrip hanya dipakai **sekali**, saat lembar `Target`
dibuat. Sesudah itu yang dibaca adalah lembarnya — unit yang sudah ramai
diberitakan bisa dicoret, urutannya bisa diubah, tanpa menyentuh kode.

```sql
select u.nama_upt
  from public.upt u
 where coalesce(u.aktif, true)
   and not exists (select 1 from public.berita b where b.nama_upt = u.nama_upt)
 order by count(*) over (partition by u.kanwil) desc, u.kanwil, u.nama_upt;
```

---

## Memantau hasilnya

```sql
-- Berapa unit yang keluar dari kesunyian sejak penjaring dipasang
select count(*) filter (where ada) as pernah_diberitakan,
       count(*) filter (where not ada) as masih_sunyi
  from (select exists (select 1 from public.berita b where b.nama_upt = u.nama_upt) as ada
          from public.upt u where coalesce(u.aktif, true)) t;

-- Berapa baris yang datang dari penjaring
select count(*) from public.berita where source_record_key like 'gs:penjaring:%';
```

Angka awal 6 September 2026: **188 pernah diberitakan, 343 masih sunyi.**
