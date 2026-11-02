-- ============================================================================
-- 33 kanwil, bukan 38
-- ============================================================================
--
-- Data induk memuat 38 "kanwil" karena diturunkan dari 38 provinsi. Struktur
-- organisasi Pemasyarakatan yang sungguh berlaku hanya mengenal 33: lima
-- provinsi pemekaran diampu kanwil induknya.
--
--   Kalimantan Utara                        -> Kanwil Kalimantan Timur
--   Papua Pegunungan, Papua Selatan,
--   Papua Tengah                            -> Kanwil Papua
--   Papua Barat Daya                        -> Kanwil Papua Barat
--
-- Selama kelima nama itu tetap ada, lima "kanwil" yang tidak punya kantor,
-- tidak punya admin, dan tidak akan pernah punya lembar menampung 364 berita
-- yang tidak dibaca siapa pun di wilayah — tanpa satu pun galat.
--
-- Kolom `provinsi` pada `upt` SENGAJA tidak disentuh: peta dan pencocokan
-- wilayah memakainya, dan Nabire memang tetap di Papua Tengah. Yang berubah
-- hanya siapa yang mengampunya.

create table if not exists public.kanwil (
  nama            text primary key,
  wilayah         text not null unique,
  tipe            text not null check (tipe in ('A', 'B')),
  provinsi_ampuan text[] not null,
  urutan          int not null
);

comment on table public.kanwil is
  'Daftar induk 33 kanwil Pemasyarakatan. Tipe A/B menurut beban kerja; provinsi_ampuan memuat provinsi pemekaran yang diampu.';

alter table public.kanwil enable row level security;

drop policy if exists kanwil_baca on public.kanwil;
create policy kanwil_baca on public.kanwil for select to authenticated using (true);

insert into public.kanwil (nama, wilayah, tipe, provinsi_ampuan, urutan) values
  ('Kantor Wilayah Ditjenpas Aceh', 'Aceh', 'A', '{Aceh}', 1),
  ('Kantor Wilayah Ditjenpas Sumatera Utara', 'Sumatera Utara', 'A', '{Sumatera Utara}', 2),
  ('Kantor Wilayah Ditjenpas Riau', 'Riau', 'A', '{Riau}', 3),
  ('Kantor Wilayah Ditjenpas Sumatera Selatan', 'Sumatera Selatan', 'A', '{Sumatera Selatan}', 4),
  ('Kantor Wilayah Ditjenpas Lampung', 'Lampung', 'A', '{Lampung}', 5),
  ('Kantor Wilayah Ditjenpas DKI Jakarta', 'DKI Jakarta', 'A', '{DKI Jakarta}', 6),
  ('Kantor Wilayah Ditjenpas Jawa Barat', 'Jawa Barat', 'A', '{Jawa Barat}', 7),
  ('Kantor Wilayah Ditjenpas Jawa Tengah', 'Jawa Tengah', 'A', '{Jawa Tengah}', 8),
  ('Kantor Wilayah Ditjenpas Jawa Timur', 'Jawa Timur', 'A', '{Jawa Timur}', 9),
  ('Kantor Wilayah Ditjenpas Bali', 'Bali', 'A', '{Bali}', 10),
  ('Kantor Wilayah Ditjenpas Kalimantan Selatan', 'Kalimantan Selatan', 'A', '{Kalimantan Selatan}', 11),
  ('Kantor Wilayah Ditjenpas Kalimantan Timur', 'Kalimantan Timur', 'A', '{Kalimantan Timur,Kalimantan Utara}', 12),
  ('Kantor Wilayah Ditjenpas Sulawesi Selatan', 'Sulawesi Selatan', 'A', '{Sulawesi Selatan}', 13),
  ('Kantor Wilayah Ditjenpas Papua', 'Papua', 'A', '{Papua,Papua Pegunungan,Papua Selatan,Papua Tengah}', 14),
  ('Kantor Wilayah Ditjenpas Sumatera Barat', 'Sumatera Barat', 'B', '{Sumatera Barat}', 15),
  ('Kantor Wilayah Ditjenpas Jambi', 'Jambi', 'B', '{Jambi}', 16),
  ('Kantor Wilayah Ditjenpas Bengkulu', 'Bengkulu', 'B', '{Bengkulu}', 17),
  ('Kantor Wilayah Ditjenpas Kepulauan Riau', 'Kepulauan Riau', 'B', '{Kepulauan Riau}', 18),
  ('Kantor Wilayah Ditjenpas Kepulauan Bangka Belitung', 'Kepulauan Bangka Belitung', 'B', '{Kepulauan Bangka Belitung}', 19),
  ('Kantor Wilayah Ditjenpas Banten', 'Banten', 'B', '{Banten}', 20),
  ('Kantor Wilayah Ditjenpas D.I. Yogyakarta', 'D.I. Yogyakarta', 'B', '{D.I. Yogyakarta}', 21),
  ('Kantor Wilayah Ditjenpas Kalimantan Barat', 'Kalimantan Barat', 'B', '{Kalimantan Barat}', 22),
  ('Kantor Wilayah Ditjenpas Kalimantan Tengah', 'Kalimantan Tengah', 'B', '{Kalimantan Tengah}', 23),
  ('Kantor Wilayah Ditjenpas Sulawesi Utara', 'Sulawesi Utara', 'B', '{Sulawesi Utara}', 24),
  ('Kantor Wilayah Ditjenpas Sulawesi Tengah', 'Sulawesi Tengah', 'B', '{Sulawesi Tengah}', 25),
  ('Kantor Wilayah Ditjenpas Sulawesi Tenggara', 'Sulawesi Tenggara', 'B', '{Sulawesi Tenggara}', 26),
  ('Kantor Wilayah Ditjenpas Gorontalo', 'Gorontalo', 'B', '{Gorontalo}', 27),
  ('Kantor Wilayah Ditjenpas Sulawesi Barat', 'Sulawesi Barat', 'B', '{Sulawesi Barat}', 28),
  ('Kantor Wilayah Ditjenpas Nusa Tenggara Barat', 'Nusa Tenggara Barat', 'B', '{Nusa Tenggara Barat}', 29),
  ('Kantor Wilayah Ditjenpas Nusa Tenggara Timur', 'Nusa Tenggara Timur', 'B', '{Nusa Tenggara Timur}', 30),
  ('Kantor Wilayah Ditjenpas Maluku', 'Maluku', 'B', '{Maluku}', 31),
  ('Kantor Wilayah Ditjenpas Maluku Utara', 'Maluku Utara', 'B', '{Maluku Utara}', 32),
  ('Kantor Wilayah Ditjenpas Papua Barat', 'Papua Barat', 'B', '{Papua Barat,Papua Barat Daya}', 33)
on conflict (nama) do update set
  wilayah = excluded.wilayah, tipe = excluded.tipe,
  provinsi_ampuan = excluded.provinsi_ampuan, urutan = excluded.urutan;

-- Pemetaan lama -> induk, dipakai sekali di bawah.
create temporary table _gabung (lama text primary key, baru text not null) on commit drop;
insert into _gabung values
  ('Kantor Wilayah Ditjenpas Kalimantan Utara', 'Kantor Wilayah Ditjenpas Kalimantan Timur'),
  ('Kantor Wilayah Ditjenpas Papua Pegunungan', 'Kantor Wilayah Ditjenpas Papua'),
  ('Kantor Wilayah Ditjenpas Papua Selatan',    'Kantor Wilayah Ditjenpas Papua'),
  ('Kantor Wilayah Ditjenpas Papua Tengah',     'Kantor Wilayah Ditjenpas Papua'),
  ('Kantor Wilayah Ditjenpas Papua Barat Daya', 'Kantor Wilayah Ditjenpas Papua Barat');

update public.upt u set kanwil = g.baru from _gabung g where u.kanwil = g.lama;
update public.penjaring_sasaran s set kanwil = g.baru from _gabung g where s.kanwil = g.lama;
update public.notifikasi_rute r set kanwil = g.baru from _gabung g where r.kanwil = g.lama;
update public.app_users a set assigned_kanwil = g.baru from _gabung g where a.assigned_kanwil = g.lama;

-- Berita dipindah tanpa menyentuh `updated_at`: yang berubah hanya pembagian
-- wilayah, bukan beritanya, dan tampilan "baru diperbarui" tidak boleh
-- tiba-tiba dibanjiri 364 berita lama.
alter table public.berita disable trigger trg_berita_updated_at;
update public.berita b set kanwil_asal = g.baru from _gabung g where b.kanwil_asal = g.lama;
alter table public.berita enable trigger trg_berita_updated_at;

-- Penjaga: setiap kanwil di data induk upt harus ada di daftar 33. Kanwil baru
-- yang lahir dari salah ketik akan berhenti di sini, bukan di layar.
do $$
declare v_sisa text;
begin
  select string_agg(distinct u.kanwil, ', ') into v_sisa
  from public.upt u left join public.kanwil k on k.nama = u.kanwil
  where k.nama is null;
  if v_sisa is not null then
    raise exception 'Kanwil di upt yang tidak ada di daftar 33: %', v_sisa;
  end if;
end $$;
