-- Nilai bawaan untuk telegram_targets.integration_id
--
-- Inilah sebab penyiapan Telegram tidak pernah selesai, dan sebabnya bukan
-- kunci bot.
--
-- Kolom integration_id berstatus NOT NULL dan menunjuk ke integration_settings,
-- sementara aksi "daftarkan" pada Edge Function telegram-kirim tidak pernah
-- mengisinya. Setiap upaya mendaftarkan grup karena itu ditolak basis data.
-- Penolakannya sampai ke petugas sebagai kalimat umum "Basis data menolak" —
-- bukan sebagai "ada kolom wajib yang kosong" — sehingga yang terbaca hanyalah
-- bahwa penyimpanan gagal, tanpa satu pun petunjuk ke arah sebabnya. Tabel
-- tujuan tetap kosong meskipun kunci bot sudah benar dan grupnya sudah
-- terdeteksi, dan tidak ada layar yang bisa menjelaskan kenapa.
--
-- Perbaikannya dipasang pada kolomnya, bukan hanya pada satu pemanggil, supaya
-- setiap penulis baris — Edge Function versi mana pun, skrip pemeliharaan, atau
-- perbaikan manual lewat SQL — sama-sama menghasilkan baris yang sah. Perbaikan
-- yang hanya ada di satu pemanggil akan hilang lagi begitu ada pemanggil kedua.
--
-- Idempoten: aman dijalankan berulang.

create or replace function public.integrasi_telegram_baku()
returns uuid
language plpgsql
volatile
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from integration_settings where provider = 'telegram' limit 1;

  if v_id is null then
    insert into integration_settings (provider, label, is_active, secret_vault_name)
    values ('telegram', 'Bot Telegram Cyber-Intelpas', true, 'TELEGRAM_BOT_TOKEN')
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- Fungsi ini hanya dipakai sebagai nilai bawaan kolom, dijalankan oleh proses
-- yang menyisipkan baris. Tidak ada alasan ia bisa dipanggil lewat REST.
revoke all on function public.integrasi_telegram_baku() from public, anon, authenticated;

alter table public.telegram_targets
  alter column integration_id set default public.integrasi_telegram_baku();
