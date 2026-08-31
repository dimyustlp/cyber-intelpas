-- Penyusun pesan harian Telegram, beserta penjadwalnya.
--
-- Angkanya diambil dari snapshot_laporan, bukan dihitung ulang di sini. Satu
-- himpunan dasar untuk seluruh angka sudah menjadi aturan yang dipegang layar
-- dan laporan; pesan Telegram tidak boleh menjadi tempat ketiga yang menghitung
-- sendiri, sebab angka yang berbeda antara grup pimpinan dan dasbor akan
-- menghabiskan kepercayaan lebih cepat daripada laporan yang terlambat.
--
-- Bila datanya kosong, yang terkirim adalah kalimat yang menyatakan datanya
-- kosong. Sistem lama membuat baris berita fiktif agar alurnya terlihat
-- berhasil; jalur semacam itu tidak dibuka di sini.

create or replace function public.pesan_harian_telegram(p_tanggal date default null)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  hari       date := coalesce(p_tanggal, ((now() at time zone 'Asia/Jakarta')::date - 1));
  s          jsonb;
  ikh        jsonb;
  bnd        jsonb;
  teks       text;
  baris      text := '';
  n_total    int;
  n_negatif  int;
  n_positif  int;
  n_netral   int;
  n_kritis   int;
  n_tinggi   int;
  n_lalu     int;
  selisih    int;
  arah       text;
  keadaan    text;
  r          record;
  urut       int := 0;
begin
  s   := public.snapshot_laporan(hari, hari);
  ikh := s->'ikhtisar';
  bnd := s->'pembanding';

  n_total   := coalesce((ikh->>'total')::int, 0);
  n_negatif := coalesce((ikh->>'negatif')::int, 0);
  n_positif := coalesce((ikh->>'positif')::int, 0);
  n_netral  := coalesce((ikh->>'netral')::int, 0);
  n_kritis  := coalesce((ikh->>'kritis')::int, 0);
  n_tinggi  := coalesce((ikh->>'tinggi')::int, 0);
  n_lalu    := coalesce((bnd->>'total')::int, 0);

  -- Tidak ada data bukan kegagalan, dan tidak boleh disamarkan sebagai laporan.
  if n_total = 0 then
    return '<b>Laporan Harian Cyber-Intelpas</b>' || chr(10)
        || to_char(hari, 'DD-MM-YYYY') || chr(10) || chr(10)
        || 'Tidak ada publikasi yang tercatat pada tanggal ini. '
        || 'Bila ini di luar dugaan, periksa halaman Sinkronisasi Sumber — '
        || 'kosongnya data lebih sering berarti penarikan terhenti daripada berarti tidak ada berita.';
  end if;

  -- Keadaan ditentukan oleh urgensi lebih dulu, baru oleh proporsi negatif.
  if n_kritis > 0 then
    keadaan := '🔴 <b>PERLU PERHATIAN SEGERA</b>';
  elsif n_tinggi > 0 or (n_negatif::numeric / greatest(n_total,1)) >= 0.35 then
    keadaan := '🟠 <b>PERLU DICERMATI</b>';
  else
    keadaan := '🟢 <b>TERKENDALI</b>';
  end if;

  selisih := n_total - n_lalu;
  arah := case
            when n_lalu = 0 then 'tidak ada pembanding kemarin'
            when selisih > 0 then 'naik ' || selisih || ' dari kemarin'
            when selisih < 0 then 'turun ' || abs(selisih) || ' dari kemarin'
            else 'sama dengan kemarin'
          end;

  teks := '<b>Laporan Harian Cyber-Intelpas</b>' || chr(10)
       || to_char(hari, 'DD-MM-YYYY') || chr(10) || chr(10)
       || keadaan || chr(10) || chr(10)
       || '<b>Publikasi:</b> ' || n_total || ' (' || arah || ')' || chr(10)
       || '• Negatif: ' || n_negatif || chr(10)
       || '• Netral: '  || n_netral  || chr(10)
       || '• Positif: ' || n_positif || chr(10);

  if n_kritis > 0 or n_tinggi > 0 then
    teks := teks || '<b>Urgensi:</b> ' || n_kritis || ' kritis, ' || n_tinggi || ' tinggi' || chr(10);
  end if;

  teks := teks || '<b>UPT tersorot:</b> ' || coalesce(ikh->>'upt_tersorot','0')
               || '  |  <b>Media:</b> ' || coalesce(ikh->>'media_unik','0') || chr(10);

  -- Tiga isu teratas. Judul dilepas tanda HTML-nya karena Telegram menolak
  -- SELURUH pesan bila ada satu tanda yang tidak sah, bukan hanya baris itu.
  for r in
    select
      replace(replace(replace(coalesce(p->>'judul','(tanpa judul)'), '&','&amp;'), '<','&lt;'), '>','&gt;') as judul,
      replace(replace(replace(coalesce(nullif(p->>'upt',''),'Belum terpetakan'), '&','&amp;'), '<','&lt;'), '>','&gt;') as upt,
      coalesce(p->>'urgensi','-') as urgensi
    from jsonb_array_elements(s->'prioritas') p
    limit 3
  loop
    urut := urut + 1;
    baris := baris || urut || '. ' || left(r.judul, 150) || chr(10)
                   || '    <i>' || r.upt || ' — ' || r.urgensi || '</i>' || chr(10);
  end loop;

  if urut > 0 then
    teks := teks || chr(10) || '<b>Perlu dibaca lebih dulu:</b>' || chr(10) || baris;
  end if;

  teks := teks || chr(10) || '<i>Rincian lengkap tersedia pada dasbor Cyber-Intelpas.</i>';

  -- Telegram menolak pesan di atas 4096 karakter secara utuh.
  return left(teks, 3900);
end;
$$;

revoke all on function public.pesan_harian_telegram(date) from public, anon, authenticated;

-- Penjadwal: 06.30 WIB = 23.30 UTC hari sebelumnya.
-- Tokennya diambil dari Vault, mengikuti pola dua cron yang sudah berjalan;
-- tidak ada nilai rahasia yang tertulis di dalam definisi pekerjaan ini.
select cron.unschedule('telegram-laporan-harian')
where exists (select 1 from cron.job where jobname = 'telegram-laporan-harian');

select cron.schedule(
  'telegram-laporan-harian',
  '30 23 * * *',
  $CRON$
  select net.http_post(
      url     := 'https://ffcebfslmnhivravwhvm.supabase.co/functions/v1/telegram-kirim',
      headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-sync-token', (select decrypted_secret
                             from vault.decrypted_secrets
                            where name = 'SHEET_SYNC_TOKEN'
                            limit 1)
      ),
      body    := jsonb_build_object(
          'aksi',   'kirim',
          'jenis',  'laporan',
          'pemicu', 'scheduled',
          'oleh',   'Penjadwal Harian',
          'teks',   public.pesan_harian_telegram()
      ),
      timeout_milliseconds := 60000
  );
  $CRON$
);
