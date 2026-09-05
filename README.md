# Trans-Siber PAS v2

> Sistem ini bernama **Cyber-Intelpas** sampai 1 September 2026. Yang berganti
> hanya namanya di layar: nama folder, nama repositori, nama tabel basis data,
> dan ranah surel bayangan akun tetap seperti semula, sebab keempatnya pengenal
> yang sudah tersimpan — bukan tulisan yang dibaca orang.

Sistem manajemen intelijen pemberitaan pemasyarakatan. Menggantikan aplikasi
Streamlit v6 dengan antarmuka web penuh di atas basis data Supabase yang sama.

## Kenapa tanpa proses bangun

Aplikasi ini ditulis sebagai modul ES murni yang dijalankan langsung oleh
peramban. Tidak ada npm, tidak ada bundler, tidak ada langkah kompilasi.
Alasannya bukan kemalasan:

- **Tidak ada bundel yang bisa gagal dibangun.** Menyalin folder `web/` ke mana
  pun sudah menjadikannya aplikasi yang berjalan.
- **Tidak ada satu pun berkas dari peladen orang lain yang ditarik saat halaman
  dibuka.** Sistem intelijen sebaiknya tidak mengumumkan kepada pihak ketiga
  setiap kali seorang petugas membuka dasbornya. Sampai 3 September 2026 kalimat
  ini tidak sepenuhnya benar: hurufnya masih ditarik dari Google Fonts. Sekarang
  hurufnya disimpan sendiri di `web/fonts/` (71 KiB, subset latin, disusun
  `tools/ambil-huruf.mjs`), dan daftar sumber luarnya benar-benar kosong.
- **Umur pakai lebih panjang.** Kode yang tidak bergantung pada versi kerangka
  kerja tertentu tidak akan berhenti bisa dibangun dua tahun lagi.

Tanpa bundler, yang biasa dikerjakan bundler tetap harus dikerjakan — dan
dikerjakan peramban sendiri. Halaman dimuat **saat dibuka**, lewat `import()`
dinamis di `js/main.js`, bukan diimpor seluruhnya di muka. Bedanya terukur: layar
masuk dulu menuntut 65 berkas dan lebih dari satu megabita JavaScript sebelum
kotak nama penggunanya tampil; sekarang 15 berkas dan 145 KiB. Modul halaman
mulai diunduh begitu tetikus menyentuh butir menunya, sehingga perpindahan
halaman tetap terasa seketika.

Konsekuensinya: tidak ada TypeScript dan tidak ada JSX. Sebagai gantinya, setiap
modul diberi anotasi JSDoc dan setiap aturan bisnis diberi penjelasan mengapa ia
ada.

## Susunan

```
web/                     aplikasi peramban, disajikan apa adanya
  index.html
  vercel.json            tajuk keamanan — HARUS di sini, bukan di akar repo;
                           alasan tiap barisnya di docs/tajuk-keamanan.md
  manifes.webmanifest    nama dan ikon saat dipasang di layar utama telepon
  fonts/                 huruf, disimpan sendiri — dihasilkan tools/ambil-huruf.mjs
  ikon/                  ikon aplikasi — dihasilkan dari kanvas peramban
  css/app.css            sistem desain — seluruh warna sebagai token
  css/huruf.css          @font-face — dihasilkan, jangan disunting
  js/
    lib/
      taksonomi.js       8 kategori, 26 subkategori isu pemasyarakatan
      klasifikasi.js     mesin klasifikasi berbasis aturan (v4)
      penerbit.js        mengenali siapa yang menerbitkan sebuah publikasi
      pencocokan-upt.js  pencocokan nama UPT dari teks berita
      unit-terpetakan.js satu pemeriksaan "unitnya sudah diketahui?" — sengaja dipisah
      pesan-telegram.js  penyusun pesan ringkas untuk grup pimpinan
      peran.js           peran, izin, dan susunan menu
      peta-indonesia.js  garis pantai Indonesia — dihasilkan tools/susun-peta.mjs
      sentimen.js        tiga ember sentimen beserta keterangannya
      hitung.js          satu himpunan dasar untuk seluruh angka di layar
      risiko.js          skor risiko 0–100 beserta rincian penyumbangnya
      peringatan-laju.js empat aturan peringatan dini berbasis pola
      kueri.js           bahasa kueri Boolean — DAN/ATAU/TIDAK, frasa, bidang, jokar
      pantauan.js        pencarian tersimpan dan daftar pantau, satu mekanisme
      aturan.js          mesin aturan peringatan yang disusun petugas sendiri
      narasi.js          peristiwa dikelompokkan menjadi cerita yang berjalan
      jaringan.js        kaitan antara unit, media, tema, wilayah, dan platform
      kpi.js             ukuran kecepatan dan kelengkapan sistem itu sendiri
      klasifikasi-informasi.js  lima tingkat: sejauh mana sebuah berkas boleh berjalan
      ekspor.js          satu jalan keluar berkas, lengkap dengan kepala keterangan
      api.js             pemanggil PostgREST dan GoTrue tanpa SDK
      format.js          tanggal, angka, dan warna semantik
      konfig.js          alamat peladen dan kunci publik
      demo.js            data peragaan
      ikon.js            ikon SVG bawaan
    ui/
      komponen.js        potongan antarmuka yang dipakai berulang
      panel-mesin.js     dasar penilaian mesin — dipakai telaah dan detail berita
      bagan.js           bagan SVG
      palet.js           palet perintah Ctrl+K — cari halaman, unit, dan berita
    pages/               satu berkas per halaman
                           berita-detail.js   satu berita, utuh dengan dasar penilaiannya
                           briefing.js    Executive Brief — situasi dalam satu layar
                           input.js       masukan berita manual, terklasifikasi saat mengetik
                           kanwil.js      ruang kantor wilayah dan ruang unit
                           wilayah-telaah.js  telaah daerah dan tanggapan unit
                           peta.js        peta sebaran kerawanan 531 unit
                           pengguna.js    peran, wilayah penugasan, dan keaktifan akun
                           sinkronisasi.js  keadaan tiap sumber spreadsheet
                           cari.js        Pencarian Lanjutan — satu kotak berbahasa kueri
                           ruang.js       Ruang Analis — antrean, pantauan, temuan aturan
                           aturan.js      penyusun aturan, dengan jangkauan yang terlihat
                           narasi.js      cerita yang sedang berjalan, bukan daftar berita
                           jaringan.js    gambar kaitan, berpusat pada satu simpul
                           komando.js     Pusat Komando — satu layar untuk dinding piket
    main.js              sesi, kerangka layar, penunjuk halaman

data/
  master-upt.csv         data induk 531 UPT — dibaca seluruh alat uji
  sumber/
    daftar-upt-nasional.csv  daftar 613 baris UPT nasional, sumber master di atas

supabase/
  migrations/            berkas migrasi, sudah diuji di PostgreSQL 16
  functions/             Edge Function (klasifikasi, sheet-sync, telegram-kirim,
                           kelola-pengguna — penerbitan akun berjenjang)

tools/
  server-lokal.mjs       peladen statis untuk pengembangan
  susun-master-upt.mjs   menyusun data/master-upt.csv + migrasi dari daftar nasional
  susun-peta.mjs         menyusun garis pantai peta dari GeoJSON Natural Earth
  ambil-huruf.mjs        mengunduh huruf sekali, lalu menyimpannya di web/fonts/
  uji-mesin.mjs          uji perilaku mesin dan pencocokan UPT
  uji-hitung.mjs         uji ember sentimen dan penjumlahan angka dasbor
  uji-peristiwa.mjs      uji pengelompokan publikasi menjadi peristiwa
  uji-risiko.mjs         uji skor risiko — ketertutupan penjumlahan dan urutannya
  uji-laju.mjs           uji empat aturan peringatan: menyala dan diamnya
  uji-tombol.mjs         uji integritas tombol antar fitur: tujuan, izin, penyimak
  periksa-lainnya.mjs    uji 62 kasus nyata yang dulu gagal dikelompokkan
  ringkas-fungsi.mjs     menyalin web/js/lib ke Edge Function dalam bentuk ringkas
  potret.mjs             memotret halaman pada lebar layar yang benar-benar diminta
```

## Data induk UPT

Sistem memantau **531 unit**: 337 Lapas, 162 Rutan, 32 LPKA. Bapas dan Rumah
Sakit Pengayoman sengaja tidak ikut — keduanya di luar lingkup pemberitaan
hunian yang dihitung dasbor.

Angka itu tidak ditulis tangan di halaman mana pun. Halaman yang punya sesi
menghitungnya dari tabelnya sendiri; halaman masuk dan kartu fitur yang belum
siap memakai satu tetapan, `INDUK_UPT` di `lib/konfig.js`.

Bila daftar nasionalnya berubah, perbarui `data/sumber/daftar-upt-nasional.csv`
lalu jalankan:

```bash
node tools/susun-master-upt.mjs
```

Alat itu menerbitkan ulang `data/master-upt.csv` beserta migrasi selisihnya, dan
berhenti dengan galat bila ada unit tanpa koordinat, nama kembar, provinsi yang
tidak sejalan dengan kanwilnya, atau unit lama yang kehilangan padanan.
Keputusan yang tidak bisa disimpulkan mesin — 23 unit yang tertulis dengan nama
berbeda di kedua daftar — ada di tabel `PADANAN` pada alat itu, satu per satu,
dengan alasannya.

## Menjalankan di komputer sendiri

```bash
node tools/server-lokal.mjs
```

Lalu buka `http://localhost:4173`.

Untuk melihat tampilan tanpa menyentuh data sungguhan:

```
http://localhost:4173/?mode=demo
http://localhost:4173/?mode=demo&peran=executive_decision_maker
http://localhost:4173/?mode=demo&tema=gelap
```

Parameter `peran` menerima salah satu dari: `super_admin`, `news_data_operator`,
`media_intelligence_analyst`, `field_verification_officer`,
`evaluation_recommendation_analyst`, `executive_decision_maker`,
`kanwil_admin`, `upt_penelaah`.

Dua peran terakhir membuka ruang daerah — menu, warna aksen, dan halaman yang
berbeda di dalam aplikasi yang sama:

| Peran | Cakupan | Boleh |
| --- | --- | --- |
| `kanwil_admin` | seluruh unit di wilayahnya | memasukkan berita untuk tiap unit, menelaah, menerbitkan akun penelaah unit, memantau dasbor wilayah beserta seluruh unitnya |
| `upt_penelaah` | satu unit saja | menelaah berita unitnya, menuliskan tanggapan resmi unit, memantau dasbor unitnya |

Pembagiannya menurut **cakupan**, bukan menurut jenis pekerjaan. Sejak 1
September 2026 **hanya `kanwil_admin` yang memasukkan berita dari daerah**,
supaya setiap kiriman punya satu penanggung jawab yang jelas.

Tiga nama peran yang sudah dihapus — `kanwil_penginput`, `kanwil_penelaah`,
dan `upt_petugas` — masih diterjemahkan menjadi `upt_penelaah` oleh halaman web
dan Edge Function selama masa peralihan, sebab penggelaran tidak pernah serentak.
Basis data sendiri sudah tidak menerimanya.

Putusan telaah daerah TIDAK menyentuh `status_verifikasi` — kolom itu tetap
milik analis pusat dan menentukan sebuah berita ikut dihitung atau tidak.
Putusan daerah punya kolomnya sendiri, dan keduanya terbaca berdampingan.

Dalam mode peragaan, arsipnya ikut dipotong supaya layarnya menunjukkan apa yang
benar-benar dilihat petugas daerah — bukan angka nasional.

## Menguji mesin

```bash
node tools/uji-mesin.mjs
```

Menjalankan 23 kasus uji perilaku yang diturunkan langsung dari matriks panduan
Dirpamintel, lalu mengukur liputan klasifikasi dan pencocokan UPT terhadap data
sungguhan dari Spreadsheet crawler.

## Menggelar

Folder `web/` adalah situs statis. Bisa digelar ke Vercel, Netlify, Cloudflare
Pages, atau peladen web instansi, tanpa langkah bangun.

Tajuk keamanannya ada di `web/vercel.json` dan hanya dibaca Vercel. **Bila
kelak digelar ke tempat lain, tajuk itu harus dipindahkan ke bentuk yang
dimengerti peladen barunya** — `_headers` untuk Netlify dan Cloudflare Pages,
blok `add_header` untuk nginx. Situs yang berpindah rumah dan meninggalkan
berkas itu akan berjalan seperti biasa, tanpa satu pun tanda bahwa seluruh
lapisan tajuknya baru saja hilang.

Yang perlu disiapkan sebelum dipakai sungguhan:

1. Jalankan keempat berkas di `supabase/migrations/` berurutan — sebaiknya di
   branch pratinjau lebih dulu.
2. Buat akun Supabase Auth untuk tiap petugas, dengan `username` dan `role` pada
   metadata pengguna.
3. Rotasi token sinkronisasi Spreadsheet dan simpan yang baru di Supabase Vault.

## Skor risiko

Sejak 3 September 2026 setiap peristiwa punya skor 0–100, dihitung
`web/js/lib/risiko.js` dari enam faktor berbobot tetap: dampak kejadian (30),
jangkauan media (20), kredibilitas penerbit (15), laju pemberitaan (15),
pengulangan (10), dan tanggapan resmi (10). Hasilnya disebut **tekanan
pemberitaan**, lalu dikalikan **gerbang sentimen** — dan hasil kali itulah skor
risikonya.

Gerbang itu yang menjaga pasal terpenting: sentimen bukan risiko. Peresmian
yang diliput sembilan media punya tekanan besar dan risiko kelembagaan nyaris
nol, dan kedua angka itu tampil berdampingan alih-alih dilebur. Versi pertama
berkas ini keliru di sini — pengalinya hanya dikenakan pada satu faktor,
sehingga kegiatan positif berskor 68 — dan `tools/uji-risiko.mjs` yang
menangkapnya.

Tiga syarat yang mengikat berkas itu, dan wajib tetap berlaku:

1. **Skor tidak pernah berdiri sendiri.** `skorRisiko()` selalu mengembalikan
   keenam faktornya lengkap dengan bobot, poin, dan kalimat dasarnya. Halaman
   yang menampilkan angkanya saja sedang melanggar maksud berkas itu.
2. **Bobotnya terbaca** — tetapan `BOBOT`, satu tempat, lengkap dengan alasan
   tiap besarannya.
3. **Perubahan bobot tercatat.** Bobot tinggal di dalam kode, bukan di basis
   data, sehingga mengubahnya menuntut commit dan penggelaran — dan keduanya
   meninggalkan jejak bernama dengan tanggal.

Skornya **tidak disimpan**. Faktor laju dan tanggapan berubah setiap hari;
kolom tersimpan yang tidak dihitung ulang akan menyebut angka kemarin
selamanya. Bila kelak ia perlu disimpan — dan pada arsip yang jauh lebih besar
itu akan perlu — yang disimpan harus disertai waktu hitungnya, dan layar harus
menyebut umurnya.

## Peringatan dini berbasis pola

`web/js/lib/peringatan-laju.js` menjalankan empat aturan atas arsip yang
termuat, dan hasilnya muncul di puncak halaman Peringatan Dini:

| Aturan | Menyala ketika |
| --- | --- |
| Lonjakan | terbitan negatif sebuah unit naik lebih dari 100% dibanding 24 jam sebelumnya |
| Menyebar ke banyak sumber | satu peristiwa diangkat 3 media atau lebih yang saling bebas, dengan skor di atas 60 |
| Membesar tanpa tanggapan | peristiwa berskor di atas 65 yang masih berjalan dan belum mendapat sikap resmi |
| Penumpukan pelan | 5 peristiwa negatif atau lebih di satu unit dalam 30 hari, tanpa satu pun yang berat |

Aturan terakhir yang paling sulit dilihat manusia: sepuluh berita "Sedang"
tentang satu unit tidak pernah memicu penyaringan urgensi mana pun, dan
bersama-sama mereka adalah unit yang sedang bermasalah.

Angka penyetelnya ada di tetapan `ATUR`, satu tempat. **Peringatan ini tidak
punya ingatan** — ia dihitung ulang tiap kali halaman dibuka dan tidak menyimpan
apakah seseorang sudah membacanya. Itu disebutkan di layar, dan itu pula yang
membedakannya dari peringatan yang lengkap: nomor, status, dan pemilik menuntut
tabel `alerts` yang belum ada.

## Bahasa kueri

Sejak 5 September 2026 satu kotak menjawab pertanyaan berlapis, dan bahasanya
tinggal di `web/js/lib/kueri.js` seorang diri:

```text
(narkoba ATAU sabu) DAN upt:Cilegon TIDAK status:"Tidak Valid"
"warga binaan"          frasa utuh, harus berurutan
"sipir narkoba"~6       dua kata dalam jarak enam kata
selundup*               jokar; mematikan pencocokan imbuhan
sejak:2026-09-01        rentang tanggal terbit
```

Kata biasa dicocokkan dengan kesadaran imbuhan — `selundup` menemukan
`penyelundupan` — lewat pengakar yang sama yang dipakai mesin klasifikasi.
Bidang berkosakata tertutup (`upt:`, `status:`, `sentimen:`) dicocokkan
harfiah, sebab yang mengetiknya sedang menyalin tulisan yang barusan ia lihat.

Tiga hal yang mengikat berkas itu:

1. **Kueri yang belum selesai diketik bukan galat.** Kurung yang belum ditutup
   dan kutip yang baru dibuka adalah keadaan normal sebuah kotak pencarian.
   `uraiKueri()` tidak pernah melempar; ia mengembalikan pohon terbaik beserta
   catatan, dan halaman menampilkan catatannya sebagai keterangan.
2. **Kueri bisa dibaca ulang sebagai kalimat.** `jelaskan()` menerjemahkan
   pohonnya kembali ke bahasa Indonesia, dan kalimat itu tampil di bawah
   kotaknya. Kueri berkurung tiga lapis tidak pernah salah menurut mesin; yang
   keliru adalah anggapan penulisnya, dan hanya kalimat biasa yang bisa
   menunjukkannya.
3. **Saringan yang dipasang lewat tombol ditulis ke dalam kotaknya.** Menekan
   "Negatif" pada panel Persempit menambahkan `sentimen:Negatif` ke teks yang
   terbaca — tidak ada keadaan tersembunyi. Akibatnya kotak itu selalu menjadi
   keterangan lengkap tentang apa yang sedang ditampilkan: bisa disalin ke
   rekan, disimpan sebagai pantauan, dan dibaca ulang tiga bulan kemudian.

## Pantauan, dan mengapa ia bukan dua fitur

Daftar periksa memisahkan "pencarian tersimpan" dari "daftar pantau".
`web/js/lib/pantauan.js` menyatukannya: **sebuah daftar pantau unit adalah
pencarian tersimpan yang kuerinya `upt:"…"`**, dan yang membedakan keduanya di
layar tinggal satu bidang `jenis` yang menentukan ikon.

Kalau keduanya dibangun sebagai dua mekanisme, keduanya akan menyaring dengan
aturan yang perlahan berbeda — dan petugas yang memantau Cilegon lewat daftar
pantau akan melihat angka yang berbeda dari yang memantaunya lewat pencarian
tersimpan, tanpa satu pun cara menjelaskan selisihnya. Ujinya memeriksa persis
itu.

Setiap pantauan boleh diberi **ambang**: berapa publikasi baru sebelum ia
disebut menyala. Yang dihitung terhadap ambang adalah yang BARU, bukan
seluruhnya — pantauan yang menyala karena arsip lamanya besar akan menyala
selamanya, dan itu sama tidak berartinya dengan yang tidak pernah menyala.

**Pantauan tinggal di peramban, bukan di basis data.** Ia tidak berpindah ke
komputer lain dan tidak dibagi ke rekan setim. Batas itu disebutkan di layar,
bukan disembunyikan. Ketika tabelnya kelak dibuat, yang perlu berubah hanya dua
fungsi `baca()` dan `tulis()`.

## Aturan peringatan yang disusun sendiri

Empat aturan pola di `peringatan-laju.js` menjawab pertanyaan yang sama bagi
seluruh Indonesia dan tetap di sana. `web/js/lib/aturan.js` menambahkan yang
menjawab pertanyaan satu kantor: *bila peristiwa di wilayah saya berskor di atas
65 dan diangkat tiga media, kabari saya.*

Aturan disusun dari **daftar sinyal tertutup** — skor risiko, jumlah media,
jumlah platform, usia, sunyi sejak terbitan terakhir, urgensi, sentimen,
kategori, unit, wilayah, sudah ditanggapi, sudah ditelaah. Kotak isian bebas
akan menghasilkan aturan yang menyebut nama kolom salah ketik: tersimpan,
tampil di daftar, tidak pernah menyala, dan tidak pernah mengeluh.

Tiga hal yang membedakannya dari borang biasa:

- **Jangkauan tampil sebelum disimpan.** Setiap perubahan syarat menghitung
  ulang berapa peristiwa akan dinyalakannya, sekarang juga. Aturan yang
  menghasilkan empat ratus temuan tidak dimatikan orang, melainkan diabaikan —
  beserta seluruh aturan lain di sebelahnya.
- **Bekerja pada peristiwa, bukan publikasi.** Sebelas peringatan tentang satu
  pelarian adalah cara tercepat membuat orang berhenti membaca peringatan.
- **Tidak ada eskalasi otomatis.** Bidang eskalasi dan saluran adalah
  keterangan bagi manusia yang menekan kirim di halaman Distribusi. Sistem
  intelijen yang mengirim sendiri ke grup pimpinan atas dasar ambang angka akan
  salah kirim pada hari pertama ambangnya keliru, dan pesan yang sudah terkirim
  tidak bisa ditarik.

Lima aturan bawaan dikirim bersama sistem. Keduanya bisa dimatikan dan
ambangnya bisa disunting; yang tidak bisa adalah menghapusnya — tombolnya
karena itu berbunyi "Pulihkan", bukan "Hapus".

## Narasi dan kaitan

`lib/peristiwa.js` menjawab "berapa kejadian di balik seratus artikel ini".
`lib/narasi.js` menjawab pertanyaan berikutnya: **cerita apa yang sedang
berjalan.** Tiga pelarian di tiga lapas dalam dua pekan adalah tiga peristiwa
terpisah dan satu narasi — dan narasi itulah yang dibaca publik.

Lima bentuk narasi, dan urutan pemeriksaannya disengaja: **berulang diperiksa
lebih dulu daripada menanjak dan mereda**, sebab dua letupan yang dipisahkan
sepekan sunyi tampak seperti dua kejadian yang sudah selesai. Setiap narasi
negatif juga diperiksa apakah ia **berjalan sendirian** — tanpa satu pun
publikasi penyeimbang maupun sikap resmi pada tema dan unit yang sama.

`lib/jaringan.js` menyusun kaitan antara unit, media, tema, wilayah, dan
platform dari data yang sudah ada, tanpa satu kolom baru. **Tidak ada simpul
orang di dalamnya**, dan penambahannya menuntut dasar kewenangan, bukan
menuntut kode. Tata letaknya melingkar dan deterministik: masukan yang sama
selalu menghasilkan gambar yang sama, supaya yang terlihat berubah adalah
datanya.

## Klasifikasi informasi pada berkas keluaran

Seluruh isi sistem ini internal; yang belum ada sampai sekarang adalah
pembedaan di dalam "internal" itu. `lib/klasifikasi-informasi.js` menurunkan
lima tingkat dari dua hal yang sudah tercatat pada tiap baris — seberapa
merugikan isinya, dan apakah sudah pernah diperiksa manusia:

| Keadaan baris | Tingkat |
| --- | --- |
| sudah diperiksa, tidak merugikan | Internal |
| sudah diperiksa, merugikan | Terbatas |
| belum diperiksa, merugikan | Rahasia |
| mendesak (Tinggi/Kritis) | Rahasia |
| bahan siklus intelijen | Sangat Terbatas |

Urutan ketiga dan keempat yang paling mudah dibalik dan paling mahal bila
terbalik: **tuduhan yang belum diperiksa berjalan lebih sempit daripada tuduhan
yang sudah terbukti.** Berkas yang beredar berisi dugaan yang kemudian ternyata
keliru tidak bisa ditarik kembali dari percakapan yang sudah membacanya.

Tingkat sebuah kumpulan adalah yang TERTINGGI di antara isinya, tidak pernah
rata-rata: satu baris rahasia di dalam seribu baris internal menjadikan seluruh
berkas rahasia, sebab berkas itu berpindah tangan sebagai satu benda.

`lib/ekspor.js` adalah satu-satunya jalan keluar berkas. Setiap keluaran diawali
blok keterangan — klasifikasi, kalimat perlakuannya, nomor berkas, nama dan
peran pengunduh, waktu, saringan yang menghasilkannya, dan jumlah baris — dan
haknya diperiksa sebelum berkasnya disusun.

## KPI sistem

`lib/kpi.js` mengukur sistemnya sendiri, dan hasilnya tampil di Kesehatan
Sistem: waktu deteksi, waktu telaah pusat dan daerah, waktu sikap resmi, usia
antrean, kesegaran data, liputan unit, bagian yang belum terpetakan, dan bagian
yang dinyatakan tidak valid.

Dua aturan yang mengikat berkas itu:

- **Median dan persentil, tidak pernah rata-rata.** Satu berita lama yang baru
  masuk hari ini menghasilkan selisih empat puluh hari, dan satu angka semacam
  itu menggeser rata-rata jauh dari apa pun yang benar-benar terjadi.
- **"Belum terukur" bukan nol.** Ukuran tanpa satu pun data berkata belum
  terukur; nol pada ukuran waktu berarti sempurna.

Bagian yang dinyatakan tidak valid **bukan ukuran ketepatan mesin**, dan
disebutkan begitu di layar: sebuah baris dinyatakan tidak valid karena mesinnya
keliru, karena medianya menarik beritanya, atau karena unitnya sudah
mengklarifikasi — ketiganya terhitung sama.

## Keamanan

- Kunci yang tertanam di `konfig.js` adalah publishable key. Kunci itu tidak
  memberi hak apa pun dengan sendirinya; yang menentukan adalah policy RLS.
- **Tidak ada service role key di dalam folder `web/`, dan tidak boleh pernah
  ada.** Kunci itu hanya dipegang Edge Function yang berjalan di peladen.
- Daftar izin di `peran.js` hanya menyembunyikan tombol yang akan ditolak.
  Penegakan sebenarnya ada di 61 policy RLS pada basis data.

### Tajuk yang dikirim peladen

Sampai 3 September 2026 situsnya berjalan **tanpa satu pun tajuk keamanan**;
Vercel memasang HSTS dengan sendirinya, dan selebihnya kosong. Sekarang
`web/vercel.json` memasang Content-Security-Policy, `X-Frame-Options: DENY`,
`nosniff`, `Referrer-Policy: no-referrer`, Permissions-Policy yang menutup
seluruh izin perangkat, dan `X-Robots-Tag`.

**Alasan tiap barisnya ada di [`docs/tajuk-keamanan.md`](docs/tajuk-keamanan.md)**,
bukan di dalam `vercel.json` sendiri: JSON tidak mengenal komentar, dan skema
Vercel memakai `additionalProperties: false` di setiap tingkat — kunci `"//"`
yang biasa dipakai sebagai komentar bukan diabaikan melainkan menggagalkan
seluruh penggelaran.

Tiga hal yang paling mudah salah, selengkapnya di berkas itu:

1. **`vercel.json` harus berada di dalam `web/`, bukan di akar repositori.**
   Root Directory proyek Vercel disetel ke `web/`, dan Vercel hanya membaca
   `vercel.json` dari sana. Berkas yang sama di akar tidak akan pernah dibaca,
   dan tidak akan ada satu pun pesan yang mengatakannya.
2. **`tools/server-lokal.mjs` membaca berkas yang sama** dan mengirimkan tajuk
   yang sama, sehingga CSP yang memblokir sesuatu gagal di komputer sendiri
   lebih dulu — bukan di layar petugas.
3. **`Cache-Control` JS dan CSS sengaja dibiarkan pada bawaan Vercel.** Tanpa
   sidik isi di nama berkas, menyimpan lama berarti modul lama bisa berjalan
   bersama modul baru — dan pada sistem yang seluruh angkanya diturunkan
   `lib/hitung.js`, campuran itu menampilkan angka salah tanpa pesan galat.

## Menguji

```bash
node tools/uji-mesin.mjs        # 14 uji perilaku + 9 uji pencocokan UPT
node tools/uji-hitung.mjs       # 37 uji ember sentimen dan penjumlahan angka
node tools/uji-risiko.mjs       # 63 uji skor risiko
node tools/uji-laju.mjs         # 26 uji aturan peringatan dini
node tools/uji-infografis.mjs   # 38 uji lembar infografis
node tools/uji-kueri.mjs        # 103 uji bahasa kueri
node tools/uji-pantauan.mjs     # 59 uji pencarian tersimpan dan daftar pantau
node tools/uji-ekspor.mjs       # 69 uji klasifikasi informasi dan ekspor
node tools/uji-narasi.mjs       # 57 uji pengelompokan narasi
node tools/uji-jaringan.mjs     # 49 uji jaringan kaitan
node tools/uji-aturan.mjs       # 61 uji mesin aturan peringatan
node tools/uji-kpi.mjs          # 60 uji ukuran kinerja
node tools/uji-tombol.mjs       # integritas tombol antar fitur
node tools/periksa-lainnya.mjs  # 62 kasus nyata dari arsip
```

### Uji integritas tombol

`uji-tombol.mjs` memeriksa empat cara sebuah tombol berbohong, dan keempatnya
pernah ada di sini: tujuan yang tidak terdaftar di penunjuk halaman, tujuan
yang penekannya tidak berhak membukanya, aksi yang tidak pernah disimak
siapa pun, dan saringan titipan yang tidak dikenali halaman tujuan.

Yang ketiga adalah yang paling lama tidak terdeteksi. Tombol tanpa penyimak
tetap tampil, tetap bisa ditekan, dan tidak meninggalkan satu pun galat di
konsol — tidak ada yang terlihat rusak. Tiga di antaranya hidup berbulan-bulan
di Dasbor Eksekutif dan Peringatan Dini sebelum alat ini menemukannya.

Alat ini membaca berkas sebagai teks, bukan menjalankannya, dan itu memang
batasnya: isi yang disusun saat program berjalan tidak terlihat dari sini.
Yang menutup celah itu bukan alat ini melainkan `saringTombolTakBerhak()` di
`main.js` — penyapu yang berjalan sesudah setiap halaman digambar, beserta
pengamat yang menyusulnya untuk kartu yang mengisi dirinya belakangan.

Keluarannya menyebut "tombol yang disapu penyaring". Itu bukan daftar cacat,
melainkan daftar tempat yang tampil berbeda bagi peran yang berbeda — dan
justru itu yang layak diperiksa dengan mata sebelum rilis: apakah halaman yang
kehilangan tombolnya masih masuk akal tanpa tombol itu.

Uji pencocokan UPT membaca data induk dari `data/master-upt.csv`. Berkas itu
dihasilkan `tools/susun-master-upt.mjs`; bila hilang, jalankan alat itu lebih
dulu. Untuk menguji terhadap data induk lain:

```bash
JALUR_UPT=./berkas-lain.csv node tools/uji-mesin.mjs
```

Bagian liputan arsip dilewati bila dump beritanya tidak tersedia; uji perilaku
dan pencocokan UPT tetap berjalan, dan dua bagian itulah yang wajib hijau
sebelum apa pun digelar.

## Memotret halaman

```bash
node tools/potret.mjs http://localhost:4173/?mode=demo potret/dasbor.png 1440 1800
node tools/potret.mjs http://localhost:4173/?mode=demo potret/telepon.png 390 1600
```

Alat ini mengatur lebar lewat protokol DevTools, bukan lewat `--window-size`.
Bedanya bukan sepele: di Windows, jendela peramban punya lebar minimum, dan
permintaan 390 piksel diam-diam menjadi 491. Setiap gambar yang keluar dari alat
ini menyebutkan lebar CSS yang sungguh dipakai, dan berhenti dengan kode 3 bila
halaman meluber ke samping — sehingga tata letak yang rusak di telepon tidak
bisa lolos hanya karena gambarnya tidak pernah dibuat pada lebar telepon.

Untuk memotret keadaan yang hanya muncul setelah ditekan — palet perintah, laci
menu, sembul konfirmasi — sertakan pemicunya:

```bash
JALANKAN="document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))" \
  node tools/potret.mjs http://localhost:4173/?mode=demo potret/palet.png 1280 860
```

## Menggelar Edge Function

Mesin klasifikasi hidup di dua tempat: `web/js/lib/` untuk peramban, dan salinan
ringkasnya di `supabase/functions/klasifikasi/`. Salinan itu **dihasilkan, bukan
disunting**:

```bash
node tools/ringkas-fungsi.mjs
npx supabase functions deploy klasifikasi --project-ref <ref>
```

Menyunting berkas di `supabase/functions/klasifikasi/` secara langsung akan
tertimpa tanpa peringatan pada penyalinan berikutnya, dan sejak saat itu mesin
di peramban dan mesin di peladen memberi jawaban yang berbeda untuk berita yang
sama — kesalahan yang tidak akan terlihat sampai seseorang membandingkan laporan
dengan layar.

## Pintasan papan tik

| Pintasan | Guna |
|----------|------|
| `Ctrl`/`Cmd` + `K` | Palet perintah — cari halaman, unit, atau judul berita |
| `Esc` | Menutup palet, laci menu, atau sembul |
| `S` | Antrean Telaah: setujui penilaian mesin |
| `K` | Antrean Telaah: buka formulir koreksi |
| `X` | Antrean Telaah: tandai tidak valid |
| `→` | Antrean Telaah: lewati |
