# Tajuk keamanan — alasan tiap barisnya

Penjelasan untuk `web/vercel.json`. Ia berada di berkas terpisah karena JSON
tidak mengenal komentar, dan **Vercel menolak kunci yang tidak dikenalnya**:
skemanya memakai `additionalProperties: false` di setiap tingkat, sehingga
kunci `"//"` yang biasa dipakai sebagai komentar bukan sekadar diabaikan —
seluruh penggelaran gagal dibangun. Itu sudah pernah terjadi sekali, pada
3 September 2026, dan pesan galatnya hanya muncul di log Vercel.

## Letak berkasnya

`web/vercel.json`, **bukan** di akar repositori.

Root Directory proyek Vercel disetel ke `web/`, dan Vercel hanya membaca
`vercel.json` dari root directory itu. Berkas yang sama di akar repositori
tidak akan pernah dibaca, dan tidak akan ada satu pun pesan yang mengatakannya
— situsnya tetap tergelar dan tampak baik-baik saja, hanya tanpa satu pun tajuk
yang dituliskan di sana.

Cara memastikannya dalam sepuluh detik:

```bash
curl -so /dev/null -w '%{http_code}\n' https://trans-siberpas.vercel.app/README.md   # 404
curl -so /dev/null -w '%{http_code}\n' https://trans-siberpas.vercel.app/css/app.css # 200
```

README ada di akar repositori. Kalau ia 404 sedangkan berkas di dalam `web/`
menjawab 200, akar situsnya memang `web/`.

## Keadaan sebelumnya

Sampai 3 September 2026 situsnya berjalan **tanpa satu pun tajuk keamanan**.
Vercel memasang HSTS dengan sendirinya; selebihnya kosong — tidak ada CSP,
tidak ada perlindungan terhadap penyematan dalam bingkai, tidak ada pembatasan
izin perangkat, dan setiap tautan berita yang dibuka petugas membawa serta
alamat sistem ini sebagai perujuk.

## Content-Security-Policy

| Arahan | Alasan |
| --- | --- |
| `script-src 'self'` | **Tanpa `'unsafe-inline'`, dan itu harus tetap begitu.** Tidak ada satu pun `<script>` sebaris di seluruh aplikasi; satu-satunya skrip adalah modul di `js/main.js`. Menambahkan skrip sebaris kelak akan mematikan halamannya di penggelaran — dan itu memang perilaku yang diinginkan. |
| `style-src … 'unsafe-inline'` | Terpaksa. Atribut `style` dipakai di seluruh halaman, dan `ui/koridor.js` menyusun elemen `<style>` saat berjalan. |
| `style-src`/`font-src` memuat ranah Google Fonts | **Bukan untuk aplikasinya.** Sejak 3 September 2026 aplikasi menyajikan hurufnya sendiri dari `/fonts` dan tidak pernah menghubungi Google. Yang memerlukannya adalah berkas laporan: ia HTML mandiri yang dibagikan dan dicetak di komputer lain, jadi ia menaut hurufnya sendiri — dan pratinjaunya di halaman Laporan Berkala beserta jendela "Buka di tab baru" mewarisi kebijakan ini. Menghapus keduanya tidak memutus apa pun kecuali rupa laporan pada layar analis yang sedang memeriksanya sebelum dikirim. |
| `connect-src` satu peladen Supabase | Bila kelak ada modul yang mencoba mengirim data ke tempat lain, peramban yang menolaknya — bukan pembaca kode yang kebetulan memperhatikan. |
| `frame-ancestors 'none'` | Aplikasi ini tidak pernah perlu disematkan. Perlu diingat saat menguji: ini juga memblokir bingkai **seranah**, sehingga memuat aplikasinya ke dalam `<iframe>` untuk pemeriksaan tidak akan berhasil. Pratinjau laporan tidak terkena, sebab ia `srcdoc` — ia mewarisi kebijakan induknya alih-alih diperiksa terhadap `frame-ancestors`. |
| `frame-src 'self'` | Untuk `srcdoc` pratinjau laporan itu. |
| `img-src … data: blob:` | `data:` untuk favicon sebaris; `blob:` untuk berkas yang disusun di peramban sebelum diunduh. |

## Tajuk lainnya

- **`X-Frame-Options: DENY`** — berlebihan di samping `frame-ancestors`, dan
  sengaja: peramban lama tidak mengenal `frame-ancestors`, dan justru peramban
  lamalah yang masih terpasang di banyak komputer kantor.
- **`Referrer-Policy: no-referrer`** — bukan `strict-origin-when-cross-origin`.
  Halaman Verifikasi Lapangan membuka tautan berita ke situs luar; tanpa baris
  ini, setiap situs yang dibuka petugas menerima catatan bahwa ia dibuka dari
  alamat sistem intelijen ini. Yang hilang karenanya tidak ada — tidak satu pun
  bagian aplikasi membaca `Referer`.
- **`Permissions-Policy`** — seluruhnya ditutup. Aplikasi ini tidak meminta satu
  pun izin perangkat, dan daftar yang menutup semuanya lebih mudah ditinjau
  daripada daftar yang menutup sebagian.
- **`Cross-Origin-Opener-Policy: same-origin-allow-popups`** — `allow-popups`,
  bukan `same-origin`. `pages/laporan.js` membuka jendela baru lalu menulis
  laporannya ke sana lewat rujukan jendela itu; `same-origin` memutus
  rujukannya, dan tombol "Buka di tab baru" berhenti bekerja tanpa pesan apa pun.
- **`X-Robots-Tag`** — meta robots di `index.html` hanya menjaga halaman itu.
  Tajuk ini menjaga setiap berkas, termasuk laporan PDF.

## Cache-Control

`Cache-Control` untuk JS dan CSS **sengaja dibiarkan** pada bawaan Vercel
(`max-age=0, must-revalidate`). Nama berkasnya tidak memuat sidik isi — tanpa
langkah bangun, tidak ada yang bisa memberinya — sehingga menyimpan lama berarti
sebuah peramban bisa menjalankan modul lama bersama modul baru. Pada sistem yang
seluruh angkanya diturunkan `lib/hitung.js`, campuran itu menampilkan angka yang
salah tanpa satu pun pesan galat.

Jumlah perjalanan bolak-baliknya ditekan dengan cara lain: pemuatan halaman
secara malas di `js/main.js` memangkas berkas pada layar masuk dari 65 menjadi
15.

Yang disimpan setahun hanya `/fonts/`: isinya tidak pernah berubah, dan namanya
menyebut versinya.

## Menguji tanpa menggelar

`tools/server-lokal.mjs` membaca `web/vercel.json` dan mengirimkan tajuk yang
sama. Itu bukan kemewahan: CSP hanya berlaku di penggelaran, sehingga kebijakan
yang memblokir sesuatu yang dipakai aplikasi akan berjalan mulus di komputer
pengembang dan baru gagal di layar petugas. Sekarang ia gagal lebih dulu di
komputer sendiri.

Cara memeriksa bahwa tidak ada yang terblokir:

```js
// Tempel di konsol peramban, lalu jelajahi seluruh halaman.
window.__csp = []
document.addEventListener('securitypolicyviolation',
  (e) => __csp.push(e.violatedDirective + ' ← ' + e.blockedURI))
```

## Bila digelar ke tempat selain Vercel

Tajuk di berkas ini hanya dibaca Vercel. Situs yang berpindah ke Netlify,
Cloudflare Pages, atau peladen instansi akan berjalan seperti biasa — tanpa satu
pun tanda bahwa seluruh lapisan tajuknya baru saja hilang. Bentuk padanannya:
`_headers` untuk Netlify dan Cloudflare Pages, blok `add_header` untuk nginx.
