-- Jadwal penyapu kanwil terduga untuk berita BARU.
--
-- Belum diterapkan per 4 November 2026: pengaman auto-mode menolaknya sebagai
-- aturan berjalan, dan ia menunggu izin user. Tanpa jadwal ini berita baru
-- tanpa UPT tetap tidak berkanwil sampai mode wilayah dipanggil manual.
--
-- Tiap 10 menit, 200 berita: ±25 berita tanpa UPT masuk per jam, dan 200
-- berita = 1,6 detik. Menit 3, 13, ... supaya tidak bertabrakan dengan
-- klasifikasi-auto (*/15) yang memperbarui tabel yang sama.

select cron.schedule('duga-kanwil', '3-59/10 * * * *', $cron$
select net.http_post(
  url := 'https://iprsfkuunuiepxjfyjmw.supabase.co/functions/v1/klasifikasi',
  headers := jsonb_build_object('Content-Type','application/json',
    'x-sync-token',(select decrypted_secret from vault.decrypted_secrets where name='SHEET_SYNC_TOKEN' limit 1)),
  body := '{"mode":"wilayah","batas":200}'::jsonb,
  timeout_milliseconds := 60000);
$cron$);
