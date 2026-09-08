# Lembar Kanwil — satu spreadsheet per wilayah

Menerjemahkan *Buku Panduan Emas* (Master Blueprint Media Monitoring
Kemenimipas) ke dalam sistem Trans-Siber PAS yang sudah berjalan, **tanpa
melahirkan sistem kedua**.

---

## 1. Keputusan arsitektur, dan kenapa berbeda dari cetak birunya

Cetak biru aslinya merancang tiap kanwil sebagai *node* mandiri: punya mesin
sentimen sendiri, penilai tier sendiri, dan bot Telegram sendiri, lalu
diagregasi ke pusat. Rancangan itu **tidak diikuti**, dan ini alasannya.

| Yang dirancang cetak biru | Yang dikerjakan | Sebabnya |
| --- | --- | --- |
| Lexicon sentimen di tiap kanwil | Mesin `klasifikasi` v4.5 di pusat | 38 salinan akan menyimpang satu per satu. v4.5 sudah dijaga 107 kasus `periksa-lainnya.mjs` dan 47 judul `uji-cakupan.mjs`; salinan di Apps Script tidak dijaga apa pun. |
| Bot Telegram di tiap kanwil | `telegram-kirim` di pusat | Satu berita nasional yang menyebut sepuluh unit akan membangunkan pimpinan sepuluh kali. Token juga tersebar di 38 tempat. |
| Tier ditebak dari `if domain includes` | Daftar induk `media_tier` | Kolom `media` pada tabel berita adalah teks bebas berisi "Medsos Radar" dan "YouTube [Lapas ...]" — ia tidak bisa dijadikan kunci apa pun. Kuncinya domain dari tautan. |
| Google CSE API | Google News RSS + RSS portal langsung | CSE gratis hanya 100 kueri/hari lalu $5 per 1.000. 38 kanwil tidak akan muat. Google News RSS gratis dan sudah terbukti di `penjaring`. |
| Dedup di hilir setelah agregasi | Indeks unik `link_normalized` | Dedup yang baru terjadi setelah agregasi berarti tiap kanwil sudah terlanjur mengirim notifikasinya sendiri. |

Yang **diambil utuh** dari cetak biru: kerangka Tier 1–4 beserta bobotnya,
matriks eskalasi SOP Bab VI, analisis asimetri informasi Bab III, dan
diagnosis *keyword mismatch* — yang terakhir justru menjadi bagian paling
berpengaruh dari seluruh pekerjaan ini.

**Kedudukan lembar kanwil: kaki, bukan otak.** Ia menjaring dan menyetor.

```
  lembar kanwil  ──sheet-sync──>  berita  ──klasifikasi v4.5──>  sentimen/kategori
  (38 spreadsheet)                  │                              urgensi/tema
                                    ├──> media_tier ──> tier + bobot
                                    └──> notifikasi ──> telegram-kirim
```

---

## 2. Empat kaki penjaring

343 dari 531 unit tidak pernah sekali pun muncul di arsip (diukur 6 September
2026). Sebabnya bukan unitnya pasif melainkan tidak pernah dicari: penyapuan
kata kunci umum selalu menemukan yang paling ramai.

| Kaki | Berangkat dari | Menutup kebutaan |
| --- | --- | --- |
| `jaringUnit()` | nama unit + ragam namanya | unit sunyi yang tidak pernah dicari |
| `jaringKota()` | nama kabupaten/kota | judul yang menulis "penjara Kediri", bukan nama resmi |
| `jaringIsu()` | taksonomi negatif | peristiwa berat di unit yang sudah ramai |
| `jaringPortal()` | **RSS portal langsung** | **portal hiperlokal yang tidak terindeks Google sama sekali** |

Kaki keempat satu-satunya yang benar-benar menembus Tier 4. Tiga kaki lain
bertanya kepada Google; selama pertanyaannya diajukan ke Google, portal yang
tidak diindeks Google tidak ada. Kaki ini membaca terbitan portalnya sendiri
lalu menyaring dengan jangkar kata.

Konsekuensinya: **angka "Tolak: Tak Relevan" yang besar pada kaki portal
menandakan SEHAT**, bukan rusak. Umpan portal memuat seluruh terbitannya —
olahraga, pilkada, kuliner. Yang menandakan rusak justru sebaliknya: "Sasaran
Diperiksa" terisi tapi "Panggilan Jaringan" nol.

---

## 3. Menggelar satu kanwil

```bash
node tools/susun-lembar-kanwil.mjs --daftar
node tools/susun-lembar-kanwil.mjs --kanwil "Jawa Timur"
```

Menghasilkan `gas/kanwil-jawa-timur.gs`.

1. Buat spreadsheet baru, beri nama sesuai kanwilnya.
2. **Ekstensi → Apps Script**, hapus isi `Code.gs`, tempel seluruh berkas itu.
3. Jalankan `siapkanLembar` sekali — ia membangun enam lembar beserta
   formatnya, mengisi Target Unit dari data induk, dan menyemai Portal Wilayah.
4. Jalankan `pasangPemicu` sekali.
5. **Bagikan → "Siapa saja yang memiliki link" sebagai Pelihat.** Wajib:
   penyalin pusat membacanya tanpa akun Google.
6. Daftarkan di pusat:

```sql
select * from public.daftarkan_lembar_kanwil(
  'Kantor Wilayah Ditjenpas Jawa Timur',
  '<ID spreadsheet, bagian antara /d/ dan /edit>'
);
```

Fungsi itu **menolak** nama kanwil yang tidak ada di data induk. Salah nama di
sana tidak menimbulkan galat apa pun — hanya berita yang tidak pernah
terpetakan — jadi lebih baik ditolak sekarang.

Menggandakan ke 37 kanwil sisanya: `node tools/susun-lembar-kanwil.mjs --semua`.

---

## 4. Lembar apa saja, dan siapa yang boleh menyunting

| Lembar | Isi | Boleh disunting daerah |
| --- | --- | --- |
| `Berita` | hasil jaringan | Nama UPT, Tingkat Risiko, Hasil Analisis, Status Tindak Lanjut, Petugas Respon, Nama Petugas |
| `Target Unit` | unit + **Ragam Nama** | ya — dan inilah sunting paling berharga |
| `Portal Wilayah` | umpan RSS hiperlokal | ya — di sinilah Tier 4 bertambah |
| `Tier Media` | salinan `media_tier` | tidak — hanya perkiraan layar |
| `Jurnal` | catatan tiap jalan | tidak |
| `Petunjuk` | keterangan | tidak |

**Judul kolom pada lembar `Berita` adalah kontrak**, bukan selera. `sheet-sync`
mencocokkan berdasarkan nama kolom lewat `ALIAS_BAWAAN`; judul yang diubah
membuat kolom itu hilang **tanpa satu pun galat**. Yang wajib ada hanya
`Judul Berita` dan `URL / Link Artikel` — menghapus salah satunya membuat
penyalin menolak seluruh lembar, dan itu memang yang seharusnya terjadi.

### Ragam nama: sunting yang paling berpengaruh

Pabrik menurunkan ragam nama dari data induk:

```
Lapas Kelas IIA Kediri  ->  "Lapas Kelas IIA Kediri", "Lapas Kediri",
                            "Penjara Kediri", "LP Kediri"
```

Yang **tidak** bisa diturunkan mesin adalah nama panggilan setempat —
"Medaeng" untuk Rutan Surabaya, misalnya. Nama begitu hanya diketahui petugas
daerah, dan satu nama panggilan yang benar sering membuka berita yang
bertahun-tahun tidak pernah tertangkap.

Nama daerah **sendirian** tidak pernah dimasukkan, dan `uji-lembar-kanwil.mjs`
menjaganya: penyaring relevansi memakai daftar ini sebagai syarat lolos, jadi
satu entri "Kediri" akan meloloskan jadwal pertandingan Persik ke arsip
intelijen — arsip terisi, jurnal hijau, tidak ada yang tahu.

---

## 5. Tier media

Kunci pencocokannya **domain dari tautan**, bukan kolom `media`.

Pencarian berjalan dari yang paling khusus ke paling umum, dengan dua kaidah:

- subdomain berawalan `radar*` selalu Tier 3, di jaringan mana pun ia bernaung
  (`radarkediri.jawapos.com` induknya Tier 1, hasilnya Tier 3);
- induk berbendera `turunkan_subdomain` menurunkan satu tingkat
  (`surabaya.tribunnews.com` → Tier 2).

Penelusuran berhenti sebelum akhiran majemuk, supaya `seribuparitnews.co.id`
tidak berakhir mencari `co.id` sebagai nama media.

**Domain yang belum dikenal mendaftarkan dirinya sendiri sebagai Tier 4**
bertanda `tier_sumber = 'otomatis'`. Tier 4 dipilih sebagai bawaan karena salah
di arah ini hanya membuat berita kurang berbunyi; salah di arah sebaliknya
membangunkan Dirjen untuk rumor sebuah blog.

Antrean telaahnya:

```sql
select * from public.media_tier_perlu_telaah limit 20;
```

Menelaah dua puluh baris teratas menutup sebagian besar bobot arsip. Setelah
ditelaah, setel `tier_sumber = 'manual'` supaya tidak pernah ditimpa proses
otomatis.

---

## 6. Eskalasi SOP — **belum menyala**

`notifikasi_rute` dan `rute_notifikasi()` sudah ada, dan **sengaja dibiarkan
kosong**. Selama kosong tidak ada perilaku yang berubah.

Tingkatnya menumpuk, bukan bergantian:

| Tier | Tingkat | Tujuan |
| --- | --- | --- |
| 4 | Level 1 Pantau | unit |
| 3 | Level 2 Waspada | unit |
| 2 | Level 3 Siaga | kanwil + unit |
| 1 | Level 4 Krisis | pusat + kanwil + unit |

Mengisinya menuntut ID grup Telegram yang sungguhan:

```sql
insert into public.notifikasi_rute (tier, kanwil, tingkat, chat_id, keterangan)
values (null, 'Kantor Wilayah Ditjenpas Jawa Timur', 'kanwil', '-100...', 'Grup Kakanwil Jatim');
```

Sesudah terisi, `notifikasi/index.ts` masih perlu disunting untuk memanggil
`rute_notifikasi()`. **Jangan menyalakannya tanpa membersihkan tunggakan
antrean lebih dulu** — pengalaman 6 September 2026: grup menerima 29 pesan
negatif beruntun sebagai sambutan pertama, cara tercepat membuat grup
dibisukan, dan grup yang dibisukan tidak menerima pemberitahuan yang
benar-benar penting nanti.

---

## 7. Uji

```bash
node tools/uji-lembar-kanwil.mjs
```

53 pemeriksaan atas seluruh 38 kanwil: berkasnya sah sebagai JavaScript, nama
kanwilnya persis data induk, ragam namanya tidak berupa nama daerah sendirian,
kolom wajibnya utuh, dan studi kasus Lapas Kediri memuat "Penjara Kediri".

---

## 7b. Satu peristiwa, banyak baris — `induk_id`

Diukur atas 2.194 baris: **81 peristiwa muncul di lebih dari satu domain**,
menyisakan 94 baris berlebih; 26 di antaranya tercatat dengan **tier berbeda**
untuk peristiwa yang sama, dan 13 bersentimen negatif — yang terakhir berarti
dua sampai tiga pemberitahuan Telegram untuk satu kejadian.

Tiga bentuknya, ketiganya sah:

| Bentuk | Contoh dari arsip |
| --- | --- |
| sindikasi | satu artikel ANTARA di `antaranews.com` (T1) + empat biro daerah (T2) |
| sosial | artikel portal, lalu diunggah ulang ke TikTok/YouTube/Instagram |
| liputan | `depok.tribunnews.com` (T2) + `youtube.com` (T4) untuk satu peristiwa |

Barisnya **tidak dihapus** — unggahan TikTok bukan salinan mubazir melainkan
jangkauan tambahan. Yang diperbaiki adalah cara menghitung dan cara memberitahu.

### Kaidah yang paling mudah dibuat terbalik

Naluri pertama: jadikan baris ber-tier tertinggi sebagai induk, lalu beritahu
induknya saja. Itu akan **mematikan seluruh matriks eskalasi SOP**, sebab
perjalanan sebuah isu justru berbunyi:

```
hari-1   TikTok (Tier 4)        -> Level 1, unit memvalidasi rumor
hari-2   radar lokal (Tier 3)   -> Level 2, unit menyiapkan hak jawab
hari-3   Tribun Jatim (Tier 2)  -> Level 3, Kanwil turun tangan
```

Maka: **induk = yang terawal**, dan yang menentukan perlu-tidaknya memberitahu
bukan "apakah ia induk" melainkan **"apakah tiernya naik dari yang pernah
terlihat"** — `peristiwa_perlu_diberitahukan()`. Terbukti di arsip:

| Peristiwa | Media | Tier | Diberitahukan |
| --- | --- | --- | --- |
| Jumat Bersih Lapas Madiun | harianbangsa.net *(induk)* | 2 | ya |
| | kompasiana.com | 4 | **tidak** — gaung |
| Bantuan Kemenimipas | times.co.id *(induk)* | 4 | ya |
| | timesindonesia.co.id | 2 | **ya** — eskalasi |

Menghitung peristiwa, bukan baris: `select * from public.peristiwa`.

Pengelompokannya memakai **judul penuh** ternormalkan dalam jendela tujuh hari.
Diuji: potongan 60 huruf menemukan 81 kelompok, judul penuh 66 — yang lebih
sedikit dipilih dengan sengaja, sebab menggabungkan dua peristiwa berbeda
menyembunyikan salah satunya tanpa jejak. **Gagal memisah jauh lebih murah
daripada gagal membedakan.**

---

## 7c. Alamat pengalih Google News

24 baris beralamat `news.google.com` dibersihkan 8 September 2026. Bukan berita
hilang: keduapuluh empatnya sudah punya alamat asli terurai di
`penjaring_alamat`, dan keduapuluh empatnya bentrok dengan baris yang sudah ada
begitu dinormalkan — artikelnya memang sudah tersimpan.

Kenapa tertinggal: `perbaikiAlamat()` menolak memaksakan alamat yang sudah
dipakai (benar — indeks unik sedang bekerja), mencatatnya `kembar`, lalu
menyerahkannya kepada analis. Selama enam pekan tidak ada analis yang tahu ia
diminta, dan pemilihnya menyaring `link_normalized` sehingga baris yang sama
terpilih ulang **tiap sepuluh menit sejak 6 Agustus** — masing-masing berharga
permintaan ke Google, untuk pekerjaan yang tidak akan pernah bisa selesai.

Ditutup oleh `rapikan_kembar_google()`, terjadwal tiap jam (jobid 12). Ia hanya
menyentuh baris yang alamat aslinya **sudah** terurai; yang belum dibiarkan agar
`perbaiki` masih bisa menyelamatkannya. Penghapusannya lunak (`deleted_at`) dan
ditautkan ke artikel aslinya lewat `induk_id`.

---

## 8. Yang belum dikerjakan

- **Menyalakan `peristiwa_perlu_diberitahukan()` di `notifikasi`.** Fungsinya
  ada dan terbukti benar, tetapi `notifikasi/index.ts` belum memanggilnya —
  jadi kembaran masih bisa mengirim pesan kedua. Ini pekerjaan berikutnya yang
  paling berdampak.
- **Cermin pusat di lembar kanwil.** Lembar masih satu arah: menyetor, belum
  membaca balik hasil penilaian mesin. Menutupnya menuntut Edge Function
  `ruang-kanwil` beserta token per wilayah.
- **Tier di layar website.** Kolomnya sudah mengalir ke peramban (`api.js`
  memilih `*`), tetapi belum ditampilkan atau dijadikan penyaring.
- **Penyalaan eskalasi rute** — lihat bagian 6; menunggu ID grup Telegram.
- **438 berita masih tanpa kanwil**, sebab `nama_upt`-nya belum terpetakan ke
  data induk. Itu lubang data, bukan lubang mesin ini; lihat
  `trans-siber-pas-bapas-belum-terdata`.
- **Lembar pusat Ditpamintel masih memuat alamat pengalih Google News.**
  Pembersihannya kini otomatis, tetapi sumbernya di hulu belum diperbaiki —
  yang menempel alamat itu ke lembar perlu diberi tahu.
