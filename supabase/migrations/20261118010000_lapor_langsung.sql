-- Lapor Langsung — kanal masukan intelijen langsung dari lapangan.
--
-- Berbeda dari halaman Input Berita (yang menyalin publikasi perayap maupun
-- manual). Lapor Langsung dipakai petugas untuk menyetor bukti pemantauan
-- siber: screenshot, foto, atau PDF gabungan, disertai penjelasan singkat
-- mengenai isinya. Setiap peran boleh menyetor — UPT otomatis ter-isi unitnya
-- sendiri, kanwil memilih UPT di wilayahnya, pusat memilih kanwil dan UPT.
--
-- Berkasnya tersimpan di bucket privat `lapor-langsung`; metadata tersimpan
-- di tabel `lapor_langsung`. Nanti mirror ke Google Drive dijahit terpisah
-- (pekerjaan latar belakang), tanpa mengubah bentuk tabel ini.

begin;

create table if not exists public.lapor_langsung (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  pelapor_user_id uuid references auth.users(id) on delete set null,
  pelapor_username text,
  pelapor_nama text,
  pelapor_role text,

  -- Konteks wilayah/unit yang dilaporkan. Untuk UPT: otomatis ter-isi. Untuk
  -- kanwil: hanya nama_upt + kanwil wajib. Untuk pusat: dua-duanya wajib.
  kanwil text,
  nama_upt text,

  judul text,
  keterangan text not null,

  -- Daftar berkas yang menyertai laporan, bentuk:
  --   [{"jalur":"2026/11/<id>/<nama>","nama":"ss1.jpg","mime":"image/jpeg","ukuran":1234}]
  berkas jsonb not null default '[]'::jsonb,

  status text not null default 'baru',  -- baru / ditinjau / selesai
  ditinjau_oleh text,
  ditinjau_pada timestamptz,
  catatan_peninjau text,

  -- Penanda sinkronisasi ke Google Drive. Null = belum dimirror.
  drive_folder_id text,
  drive_url text,
  disinkronkan_pada timestamptz
);

create index if not exists lapor_langsung_created_at_idx on public.lapor_langsung (created_at desc);
create index if not exists lapor_langsung_kanwil_idx on public.lapor_langsung (kanwil);
create index if not exists lapor_langsung_nama_upt_idx on public.lapor_langsung (nama_upt);
create index if not exists lapor_langsung_pelapor_idx on public.lapor_langsung (pelapor_user_id);
create index if not exists lapor_langsung_status_idx on public.lapor_langsung (status);

alter table public.lapor_langsung enable row level security;

-- INSERT: tiap pengguna terotentikasi boleh mengirim laporan atas namanya sendiri.
drop policy if exists lapor_insert_self on public.lapor_langsung;
create policy lapor_insert_self on public.lapor_langsung for insert to authenticated
  with check (pelapor_user_id = auth.uid());

-- SELECT: superadmin/pusat operasional (akses_berita_semua); kanwil melihat
-- kiriman di wilayahnya; UPT melihat kiriman atas unitnya. Semua orang tetap
-- bisa membaca kembali laporannya sendiri.
drop policy if exists lapor_select_scoped on public.lapor_langsung;
create policy lapor_select_scoped on public.lapor_langsung for select to authenticated
  using (
    (select akses_berita_semua())
    or pelapor_user_id = auth.uid()
    or (kanwil is not null and kanwil = (select kanwil_saya()))
    or (nama_upt is not null and nama_upt = (select upt_saya()))
  );

-- UPDATE (tinjauan): hanya peran penelaah pusat dan superadmin.
drop policy if exists lapor_update_peninjau on public.lapor_langsung;
create policy lapor_update_peninjau on public.lapor_langsung for update to authenticated
  using (has_role(variadic array['super_admin','media_intelligence_analyst','evaluation_recommendation_analyst']))
  with check (has_role(variadic array['super_admin','media_intelligence_analyst','evaluation_recommendation_analyst']));

-- DELETE: tidak ada. Riwayat intel disimpan utuh.
drop policy if exists lapor_delete_nobody on public.lapor_langsung;
create policy lapor_delete_nobody on public.lapor_langsung for delete to authenticated
  using (false);

-- Bucket penyimpanan berkas; privat, akses lewat signed URL.
insert into storage.buckets (id, name, public)
values ('lapor-langsung', 'lapor-langsung', false)
on conflict (id) do nothing;

-- INSERT ke bucket: siapa pun yang terotentikasi boleh mengunggah ke bucket
-- ini. Penautan ke baris tabel yang mengikatnya ke pelapor berjalan di tabel
-- lapor_langsung, bukan di sini — kalau unggahan terjadi tanpa baris tabel,
-- berkasnya bersih tidak dapat ditemukan kembali, tetapi juga tidak membocor.
drop policy if exists lapor_storage_insert on storage.objects;
create policy lapor_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'lapor-langsung');

-- SELECT di bucket: pemilik unggahan atau peran pusat yang berakses semua.
drop policy if exists lapor_storage_select on storage.objects;
create policy lapor_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'lapor-langsung'
    and (owner = auth.uid() or (select akses_berita_semua()))
  );

commit;
