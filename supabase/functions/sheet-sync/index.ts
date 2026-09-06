/**
 * Titik masuk yang dicari CLI.
 *
 * Isi fungsinya ada di `sheet-sync.ts` di sebelah berkas ini, dan sengaja tetap
 * di sana.
 *
 * Sebabnya sejarah penggelaran, bukan selera. Fungsi ini dulu digelar lewat
 * `deploy_edge_function` MCP, yang menerima daftar berkas beserta titik
 * masuknya secara eksplisit — sehingga titik masuknya tercatat sebagai
 * `sheet-sync.ts`. Supabase CLI tidak menerima pilihan itu: ia selalu mencari
 * `index.ts` di dalam folder fungsinya, dan menolak dengan pesan yang
 * menyesatkan bila tidak menemukannya:
 *
 *     Entrypoint path does not exist - .../sheet-sync/index.ts
 *
 * Pesan itu mudah dibaca sebagai "berkasnya hilang", padahal berkasnya ada dan
 * hanya bernama lain.
 *
 * Berkasnya tidak diganti nama karena namanya sudah tertulis di README, di
 * catatan penggelaran, dan di `tools/uji-tautan.mjs` yang membacanya untuk
 * memeriksa keselarasan aturan tautan. Satu baris di sini jauh lebih murah
 * daripada memburu seluruh penyebutannya — dan penghubung ini menjelaskan
 * dirinya sendiri, sedangkan nama berkas yang berubah tidak.
 *
 * Impor tanpa nama memang yang dimaksud: `sheet-sync.ts` memanggil
 * `Deno.serve()` saat modulnya dimuat, jadi mengimpornya sudah menyalakan
 * peladennya. Tidak ada yang perlu diambil dari sana.
 */

import './sheet-sync.ts'
