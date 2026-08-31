# Cyber-Intelpas v2

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
      sentimen.js        tiga ember sentimen beserta keterangannya
      hitung.js          satu himpunan dasar untuk seluruh angka di layar
      api.js             pemanggil PostgREST dan GoTrue tanpa SDK
      format.js          tanggal, angka, dan warna semantik
      konfig.js          alamat peladen dan kunci publik
      demo.js            data peragaan
      ikon.js            ikon SVG bawaan
    ui/
      komponen.js        potongan antarmuka yang dipakai berulang
      bagan.js           bagan SVG
      palet.js           palet perintah Ctrl+K — cari halaman, unit, dan berita
    pages/               satu berkas per halaman
                           input.js       masukan berita manual, terklasifikasi saat mengetik
                           kanwil.js      ruang kantor wilayah — ringkasan dan riwayat kiriman
                           pengguna.js    peran, wilayah penugasan, dan keaktifan akun
                           sinkronisasi.js  keadaan tiap sumber spreadsheet
    main.js              sesi, kerangka layar, penunjuk halaman

supabase/
  migrations/            6 berkas migrasi, sudah diuji di PostgreSQL 16
  functions/             Edge Function (klasifikasi, sheet-sync, telegram-kirim,
                           kelola-pengguna — penerbitan akun berjenjang)

tools/
  server-lokal.mjs       peladen statis untuk pengembangan
  uji-mesin.mjs          uji perilaku mesin dan pencocokan UPT
  uji-hitung.mjs         uji ember sentimen dan penjumlahan angka dasbor
  uji-peristiwa.mjs      uji pengelompokan publikasi menjadi peristiwa
  periksa-lainnya.mjs    uji 62 kasus nyata yang dulu gagal dikelompokkan
  ringkas-fungsi.mjs     menyalin web/js/lib ke Edge Function dalam bentuk ringkas
  potret.mjs             memotret halaman pada lebar layar yang benar-benar diminta
```

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
`kanwil_admin`, `kanwil_penginput`.

Dua peran terakhir membuka **ruang kantor wilayah**: menu, warna aksen, dan
halaman yang berbeda di dalam aplikasi yang sama. Dalam mode peragaan, arsipnya
ikut dipotong supaya layarnya menunjukkan apa yang benar-benar dilihat petugas
wilayah — bukan angka nasional.

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
node tools/periksa-lainnya.mjs  # 62 kasus nyata dari arsip
```

`uji-mesin.mjs` membutuhkan salinan CSV induk UPT. Bila tidak ada di jalur
bawaannya, sebutkan sendiri:

```bash
JALUR_UPT=./sumber-lama/cyberintelpas-main/data/master_upt_coordinates.csv node tools/uji-mesin.mjs
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
