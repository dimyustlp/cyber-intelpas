-- ============================================================================
-- Lembar induk kanwil: pendaftaran otomatis 32 lembar ke sheet-sync
-- ============================================================================
--
-- Lembar induk (gas/induk-lembar-kanwil.gs) menyalin dirinya menjadi lembar
-- kanwil dan mencatat ID tiap salinan di lembar "Daftar Lembar". Sebelum ini,
-- setiap ID harus disalin tangan ke `daftarkan_lembar_kanwil()` — 32 kali,
-- dan lembar yang terlewat tidak menimbulkan galat apa pun: lembarnya
-- menjaring, Jurnalnya hijau, dan beritanya tidak pernah sampai ke website.
--
-- Di sini pusat membaca Daftar Lembar sendiri lewat gviz CSV (lembar induk
-- dibagikan sebagai Pelihat oleh skripnya) dan mendaftarkan yang Siap.
--
-- DUA FASE, sebab pg_net asinkron: satu panggilan fungsi tidak bisa meminta
-- lalu membaca jawabannya. Setiap jalan membaca jawaban permintaan jalan
-- SEBELUMNYA, lalu mengirim permintaan baru. Akibatnya lembar yang baru Siap
-- terdaftar 10–20 menit kemudian, bukan seketika — dan itu disengaja.

create table if not exists public.lembar_induk (
  id              int primary key default 1 check (id = 1),
  sheet_id        text not null,
  permintaan_id   bigint,
  terakhir_tarik  timestamptz,
  terakhir_pesan  text,
  terdaftar_total int not null default 0
);

comment on table public.lembar_induk is
  'Satu baris: spreadsheet lembar induk kanwil yang dibaca tarik_daftar_induk() tiap 10 menit.';

-- Tanpa policy: hanya fungsi SECURITY DEFINER dan super admin lewat SQL.
alter table public.lembar_induk enable row level security;

insert into public.lembar_induk (id, sheet_id)
values (1, '1PUFyO107VZRqtb9h1N6mirUWnxJLVoo6nNDQY68XmDs')
on conflict (id) do update set sheet_id = excluded.sheet_id;

create or replace function public.tarik_daftar_induk()
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v      public.lembar_induk;
  j      record;
  baris  text;
  f      text[];
  n      int := 0;
  pesan  text;
begin
  select * into v from public.lembar_induk where id = 1;
  if not found then return 'Lembar induk belum dicatat.'; end if;

  -- Fase 1: jawaban permintaan jalan sebelumnya.
  if v.permintaan_id is not null then
    select status_code, content into j from net._http_response where id = v.permintaan_id;

    if not found then
      pesan := 'Jawaban permintaan sebelumnya belum tiba.';
    elsif j.status_code <> 200 or left(coalesce(j.content, ''), 1) <> '"' then
      -- gviz membalas halaman masuk Google (HTML) bila lembar tertutup.
      -- Tanpa pemeriksaan bentuk isi, halaman itu terbaca sebagai CSV kosong
      -- dan "tidak ada lembar baru" — keadaan yang benar-benar tidak bisa
      -- dibedakan dari lembar induk yang memang belum membangun apa pun.
      pesan := 'Lembar induk tidak terbaca (HTTP ' || coalesce(j.status_code::text, '-')
        || '). Pastikan dibagikan: Siapa saja yang memiliki link, Pelihat.';
    else
      foreach baris in array string_to_array(j.content, E'\n') loop
        -- Kolom: 1 No, 2 Wilayah, 3 Tipe, 4 Kanwil, 5 ID, 6 Tautan, 7 Status.
        -- Kolom sesudah ke-7 (Pesan) boleh memuat koma; yang dipakai hanya
        -- tujuh pertama, jadi pemisahan '","' aman.
        f := string_to_array(trim(both E'"\r' from baris), '","');
        continue when coalesce(array_length(f, 1), 0) < 7;
        continue when f[5] !~ '^[A-Za-z0-9_-]{25,}$';
        continue when not (f[7] like 'Siap%' or f[7] like 'Dibangun%');
        continue when not exists (select 1 from public.kanwil k where k.nama = f[4]);
        continue when exists (
          select 1 from public.sumber_sheet s where s.kanwil = f[4] and s.sheet_id = f[5]);

        perform public.daftarkan_lembar_kanwil(f[4], f[5]);
        n := n + 1;
      end loop;
      pesan := case when n = 0 then 'Terbaca; tidak ada lembar baru.'
                    else n || ' lembar baru didaftarkan.' end;
    end if;
  end if;

  -- Fase 2: permintaan untuk jalan berikutnya.
  update public.lembar_induk set
    permintaan_id = net.http_get(
      'https://docs.google.com/spreadsheets/d/' || v.sheet_id
        || '/gviz/tq?tqx=out:csv&sheet=Daftar%20Lembar',
      timeout_milliseconds := 30000),
    terakhir_tarik = now(),
    terakhir_pesan = coalesce(pesan, 'Permintaan pertama dikirim.'),
    terdaftar_total = terdaftar_total + n
  where id = 1;

  return coalesce(pesan, 'Permintaan pertama dikirim.');
end;
$$;

revoke all on function public.tarik_daftar_induk() from public, anon, authenticated;

-- Tiap 10 menit, BUKAN 15: penjadwal 'bersihkan-jawaban-http' menghapus
-- net._http_response yang lebih tua dari 15 menit. Dengan selang 15 menit,
-- jawaban fase 1 sering sudah terhapus saat hendak dibaca, dan fungsi ini
-- melapor "belum tiba" selamanya — tanpa satu pun galat.
-- Menit ke-4 supaya tidak berbarengan dengan penjaring (5, 35, 50) dan
-- sheet-sync (0, 30).
select cron.unschedule(jobid) from cron.job where jobname = 'tarik-daftar-induk';
select cron.schedule('tarik-daftar-induk', '4-59/10 * * * *', 'select public.tarik_daftar_induk()');
