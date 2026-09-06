-- =============================================================================
-- Batas waktu sheet-sync dinaikkan dari 5 detik menjadi 120 detik
-- =============================================================================
--
-- APA YANG SEDANG TERJADI
--
-- Sejak jadwalnya dipasang, `sheet-sync-auto` memanggil Edge Function dengan
-- `timeout_milliseconds := 5000`. Fungsinya membutuhkan lebih lama dari itu,
-- sehingga pg_net menyerah sebelum jawabannya datang — setiap lima menit, 288
-- kali sehari, tanpa satu kali pun berhasil. Diperiksa pada 6 September 2026:
-- SELURUH baris sheet-sync di `net._http_response` berisi
--
--     Timeout of 5000 ms reached. Total time: 5000.918000 ms
--
-- sedangkan `klasifikasi-auto`, yang memakai 120000, mengembalikan 200 lengkap
-- dengan ringkasan hasilnya.
--
-- KENAPA TIDAK ADA YANG MENYADARINYA
--
-- `cron.job_run_details` melaporkan `succeeded` untuk seluruh 864 kali jalan
-- dalam tiga hari terakhir. Laporan itu benar dan menyesatkan sekaligus: yang
-- dinilai berhasil adalah PENGIRIMAN permintaannya, bukan jawabannya. Dari
-- tabel itu, jalur yang setiap kali gagal terbaca persis sama dengan jalur yang
-- setiap kali berhasil.
--
-- Datanya sendiri tetap masuk, sebab Edge Function terus berjalan di sisi
-- peladen sesudah pg_net melepasnya. Itu justru bagian yang berbahaya:
-- keadaan sehat dan keadaan rusak menghasilkan jejak yang identik. Bila
-- sinkronisasi benar-benar berhenti besok — token kedaluwarsa, spreadsheet
-- dipindah, kuota habis — yang tercatat tetap `succeeded` di cron dan tetap
-- `Timeout of 5000 ms reached` di pg_net, dan tidak ada satu pun yang berubah
-- untuk dilihat siapa pun.
--
-- Yang diperbaiki migrasi ini karena itu bukan kecepatan sinkronisasi,
-- melainkan KEMAMPUAN MELIHATNYA. Sesudah ini, jawaban sungguhan tersimpan di
-- `net._http_response`, dan galat yang sungguhan akan terlihat berbeda dari
-- hari biasa.
--
-- Angkanya disamakan dengan `klasifikasi-auto` (120 detik), bukan dikira-kira:
-- itu satu-satunya jadwal di proyek ini yang terbukti mengembalikan jawaban
-- utuh. Nilainya tetap jauh di bawah jarak antar-jalan (5 menit), sehingga dua
-- pemanggilan tidak akan pernah bertumpuk.
--
-- Isi perintahnya TIDAK diubah sama sekali selain baris batas waktu.
-- =============================================================================

select cron.schedule(
    'sheet-sync-auto',
    '*/5 * * * *',
    $$
select net.http_post(
    url     := 'https://ffcebfslmnhivravwhvm.supabase.co/functions/v1/sheet-sync',
    headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-sync-token',  (select decrypted_secret
                            from vault.decrypted_secrets
                           where name = 'SHEET_SYNC_TOKEN'
                           limit 1)
    ),
    body    := '{"source":"supabase-cron"}'::jsonb,
    timeout_milliseconds := 120000
);
    $$
);

-- Cara memastikannya berhasil, sepuluh menit sesudah migrasi ini dijalankan:
--
--   select status_code, left(coalesce(content, error_msg), 120) as jawaban, created
--     from net._http_response
--    where created > now() - interval '15 minutes'
--    order by created desc;
--
-- Yang diharapkan: baris ber-status 200 yang datang tiap lima menit. Bila yang
-- muncul tetap "Timeout of 120000 ms reached", masalahnya bukan lagi batas
-- waktu melainkan fungsinya sendiri — dan itu keterangan yang selama ini tidak
-- pernah bisa didapat.
