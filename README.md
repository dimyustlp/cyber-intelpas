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
- **Tidak ada kode pihak ketiga yang ditarik saat halaman dibuka.** Sistem
  intelijen sebaiknya tidak mengunduh berkas dari peladen orang lain setiap kali
  seorang petugas membuka dasbor. Satu-satunya sumber luar adalah berkas huruf
  Google Fonts, dan itu pun punya cadangan huruf sistem.
- **Umur pakai lebih panjang.** Kode yang tidak bergantung pada versi kerangka
  kerja tertentu tidak akan berhenti bisa dibangun dua tahun lagi.

Konsekuensinya: tidak ada TypeScript dan tidak ada JSX. Sebagai gantinya, setiap
modul diberi anotasi JSDoc dan setiap aturan bisnis diberi penjelasan mengapa ia
ada.

## Susunan

```
web/                     aplikasi peramban, disajikan apa adanya
  index.html
  css/app.css            sistem desain — seluruh warna sebagai token
  js/
    lib/
      taksonomi.js       8 kategori, 26 subkategori isu pemasyarakatan
      klasifikasi.js     mesin klasifikasi berbasis aturan (v4)
      penerbit.js        mengenali siapa yang menerbitkan sebuah publikasi
      pencocokan-upt.js  pencocokan nama UPT dari teks berita
      pesan-telegram.js  penyusun pesan ringkas untuk grup pimpinan
      peran.js           peran, izin, dan susunan menu
      peta-indonesia.js  garis pantai Indonesia — dihasilkan tools/susun-peta.mjs
      sentimen.js        tiga ember sentimen beserta keterangannya
      hitung.js          satu himpunan dasar untuk seluruh angka di layar
      risiko.js          skor risiko 0–100 beserta rincian penyumbangnya
      peringatan-laju.js empat aturan peringatan dini berbasis pola
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
  uji-mesin.mjs          uji perilaku mesin dan pencocokan UPT
  uji-hitung.mjs         uji ember sentimen dan penjumlahan angka dasbor
  uji-peristiwa.mjs      uji pengelompokan publikasi menjadi peristiwa
  uji-risiko.mjs         uji skor risiko — ketertutupan penjumlahan dan urutannya
  uji-laju.mjs           uji empat aturan peringatan: menyala dan diamnya
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

## Keamanan

- Kunci yang tertanam di `konfig.js` adalah publishable key. Kunci itu tidak
  memberi hak apa pun dengan sendirinya; yang menentukan adalah policy RLS.
- **Tidak ada service role key di dalam folder `web/`, dan tidak boleh pernah
  ada.** Kunci itu hanya dipegang Edge Function yang berjalan di peladen.
- Daftar izin di `peran.js` hanya menyembunyikan tombol yang akan ditolak.
  Penegakan sebenarnya ada di 61 policy RLS pada basis data.

## Menguji

```bash
node tools/uji-mesin.mjs        # 14 uji perilaku + 9 uji pencocokan UPT
node tools/uji-hitung.mjs       # 37 uji ember sentimen dan penjumlahan angka
node tools/uji-risiko.mjs       # 63 uji skor risiko
node tools/uji-laju.mjs         # 26 uji aturan peringatan dini
node tools/periksa-lainnya.mjs  # 62 kasus nyata dari arsip
```

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
