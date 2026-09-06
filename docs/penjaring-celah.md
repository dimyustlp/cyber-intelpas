# Penjaring Celah — sumber ketiga

Dokumen ini menjelaskan sumber ketiga Trans-Siber PAS: kenapa ia ada, apa yang
menahan berita kembar, dan dua langkah yang hanya bisa dikerjakan pemilik
berkasnya.

---

## Kenapa ia ada

Diukur pada 6 September 2026, dari **531 unit pelaksana teknis yang aktif,
343 belum pernah muncul satu kali pun** dalam 858 publikasi yang terkumpul.
Enam puluh empat persen.

| Kantor Wilayah | Unit | Pernah diberitakan | Sunyi |
|---|---:|---:|---:|
| Maluku Utara | 10 | 0 | **10** |
| Sulawesi Utara | 14 | 1 | **13** |
| Kalimantan Tengah | 12 | 2 | **10** |
| Sumatera Barat | 23 | 5 | **18** |
| Riau | 16 | 4 | **12** |
| Jawa Tengah | 51 | 21 | **30** |

Angka itu bukan berarti unit-unit tersebut tidak ada beritanya. Dua sumber
yang sudah ada bekerja dengan cara yang sama-sama **pasif**: keduanya menyapu
kata kunci umum — "lapas", "rutan", "pemasyarakatan" — lalu memungut apa pun
yang lewat. Penyapuan semacam itu selalu menemukan yang paling ramai, dan yang
paling ramai selalu unit besar di pulau yang sama.

Unit kecil di Halmahera tidak pernah kalah beritanya. **Ia tidak pernah
dicari.**

Penjaring ini bekerja terbalik: ia berangkat dari **daftar unit**, bukan dari
kata kunci. Setiap unit yang sunyi dicari namanya satu per satu, dua belas unit
per hari secara berputar — seluruh 343 unit selesai dalam sekitar 29 hari, lalu
mengulang dari awal.

Yang ditemukan mungkin sedikit, dan memang seharusnya sedikit. Tetapi yang
sedikit itu berasal dari tempat yang selama ini tidak terlihat sama sekali.

---

## Berita kembar: tiga lapis, dan hanya satu yang benar-benar menolak

Penjaring ini **sengaja** mencari di wilayah yang bertumpang tindih dengan dua
sumber lain. Berita kembar karena itu bukan kemungkinan melainkan kepastian.

| Lapis | Di mana | Yang dikerjakan | Bisa dilewati? |
|---|---|---|---|
| 1 | `tools/penjaring-celah.gs` | Alamat yang sudah ada di lembar itu tidak ditulis lagi | Ya |
| 2 | `sheet-sync.ts` | Baris yang tautannya sudah ada di basis data dilewati | Ya |
| 3 | **Basis data** | Pemicu `berita_seragamkan_tautan` + indeks unik `berita_link_normalized_unik_idx` | **Tidak** |

Dua lapis pertama menghemat pekerjaan. **Hanya lapis ketiga yang menolak.**

Sejak migrasi `20260906020000_satu_aturan_tautan.sql`, kolom `link_normalized`
tidak lagi dikirim pemanggil melainkan **dihitung pemicu** dari `link`, apa pun
yang dikirim. Aturannya satu, di `public.normalkan_tautan()`.

Sebelum itu aturan yang sama ditulis dua kali dalam dua bahasa, dan pemicu
pemeriksa kembarnya menyerah begitu `link_normalized` kosong — sehingga
pemanggil yang tidak mengisinya melewati seluruh pemeriksaan tanpa satu pun
peringatan.

Diperiksa saat migrasi dijalankan: **239 dari 858 baris** ternyata menormal
berbeda dari tautan mentahnya. Sebanyak itulah yang selama ini rawan tembus.

### Bukti bahwa ia menolak

```
asli    : https://instagram.com/p/Dbuh-8cyaEa
variasi : http://www.instagram.com/p/Dbuh-8cyaEa/?utm_source=uji
normal  : https://instagram.com/p/Dbuh-8cyaEa
hasil   : DITOLAK — Link berita sudah pernah disimpan.
```

Skema berbeda, `www` berbeda, garis miring berbeda, penanda iklan berbeda.
Satu berita.

### Alamat Google News harus diuraikan lebih dulu

RSS Google News tidak memberikan alamat artikelnya, melainkan alamat pengalihan
miliknya sendiri (`news.google.com/rss/articles/CBMi…`).

Kalau alamat itu yang ditulis, **seluruh penyaringan kembar akan lolos**: satu
artikel tersimpan dua kali — sekali sebagai alamat portalnya dari sumber lain,
sekali sebagai alamat pengalihan dari sini. Ketiga lapis di atas tidak akan
menangkapnya, sebab keduanya memang alamat yang berbeda.

Skripnya karena itu menguraikan setiap alamat lebih dulu, dengan tiga cara
berurutan dari yang termurah, dan **membuang butir yang gagal diuraikan**.
Lebih baik kehilangan satu berita daripada menanam satu kembaran yang tidak
bisa dikenali siapa pun sesudahnya.

---

## Dua langkah yang hanya bisa dikerjakan pemiliknya

Berkasnya sudah dibuat dan sudah terdaftar sebagai sumber aktif. Dua hal
tersisa, dan keduanya menuntut akun pemilik:

**1. Tempelkan skripnya**

- Buka [spreadsheetnya](https://docs.google.com/spreadsheets/d/1I_8aDhMxAKZQ-uBHoJaS-RYHj45FOmPXSKj9GXXe5GU/edit)
- Menu **Ekstensi → Apps Script**
- Hapus isi `Code.gs`, tempel seluruh isi `tools/penjaring-celah.gs`, simpan
- Jalankan fungsi `pasangPemicu` sekali (Apps Script akan meminta izin)

**2. Bagikan berkasnya**

- Kembali ke spreadsheet → **Bagikan**
- Setel **"Siapa saja yang memiliki link"** sebagai **Pelihat**

Langkah kedua wajib: penyalin membacanya tanpa akun Google, persis seperti dua
sumber lainnya. Selama belum, halaman Sinkronisasi Sumber menampilkannya
berstatus Gagal — dan itu **keadaan yang benar**, bukan kekeliruan yang perlu
diperbaiki di kode.

Sesudah langkah kedua tidak ada lagi yang perlu ditekan. `pg_cron` memanggil
penyalin tiap lima menit.

---

## Menyusun ulang daftar sasaran

Daftar 343 unit di dalam skrip hanya dipakai **sekali**, saat lembar `Target`
dibuat. Sesudah itu yang dibaca adalah lembarnya — jadi unit yang sudah ramai
diberitakan bisa dicoret dan urutannya bisa diubah tanpa menyentuh kode.

Untuk menyusun ulang daftarnya kelak:

```sql
select u.nama_upt
  from public.upt u
 where coalesce(u.aktif, true)
   and not exists (select 1 from public.berita b where b.nama_upt = u.nama_upt)
 order by count(*) over (partition by u.kanwil) desc, u.kanwil, u.nama_upt;
```

Urutannya menurut beratnya celah — kantor wilayah dengan unit sunyi terbanyak
lebih dulu — bukan menurut abjad. Dengan penunjuk berputar, urutan itulah yang
menentukan siapa tersentuh pada hari-hari pertama.

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

Angka awal pada 6 September 2026: **188 pernah diberitakan, 343 masih sunyi.**
