-- =============================================================================
-- "Tidak Sesuai" untuk telaah wilayah, dan UPT boleh mengajukan klarifikasi
-- sendiri (permintaan user 10 November 2026)
-- =============================================================================
--
-- Dua perubahan kecil, keduanya menyentuh kontrak basis data, jadi keduanya di
-- sini — bukan di peramban:
--
--   1. Kanwil (di Analisis Berita) boleh menandai sebuah berita "Tidak Sesuai"
--      disertai analisisnya, ketika berita itu dianggap tidak layak/keliru dan
--      tidak diteruskan sebagai klarifikasi. Putusan itu tinggal di
--      telaah_wilayah_status, sejajar dengan 'Bukan Unit Kami' dan 'Perlu
--      Perhatian', dengan alasannya di telaah_wilayah_catatan. Hanya satu nilai
--      baru yang perlu ditambahkan ke aturan kolomnya.
--
--   2. Penelaah Berita UPT boleh MENGAJUKAN klarifikasi atas berita unitnya
--      sendiri, tanpa menunggu kanwil meneruskannya. Sampai kini `penanganan_buat`
--      hanya mengizinkan super admin dan admin kanwil. Fungsi itu diperluas:
--      upt_penelaah boleh membuat — HANYA tujuan Klarifikasi UPT (bukan disposisi
--      pimpinan), dan HANYA untuk berita yang nama_upt-nya unitnya sendiri.
--      Statusnya langsung 'menunggu_upt' supaya butirnya muncul di tab
--      Klarifikasi UPT miliknya untuk diisi.
--
-- Keduanya tetap ditegakkan di sini, bukan di menu: upt_saya()/kanwil_saya()
-- dibaca dari profil pemohon, tidak pernah dari badan permintaan.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Nilai telaah wilayah baru: 'Tidak Sesuai'
-- -----------------------------------------------------------------------------
alter table public.berita drop constraint if exists berita_telaah_wilayah_status_check;
alter table public.berita add constraint berita_telaah_wilayah_status_check
    check (telaah_wilayah_status is null or telaah_wilayah_status in (
        'Belum Ditelaah',
        'Sesuai',           -- penilaian mesin dibenarkan penelaah wilayah/unit
        'Direvisi',         -- penilaian mesin diperbaiki, alasannya wajib
        'Bukan Unit Kami',  -- berita tidak menyangkut unit/wilayah ini
        'Perlu Perhatian',  -- benar, dan menuntut tindakan di luar telaah
        'Tidak Sesuai'      -- dianggap keliru/tidak layak; analisis kanwil wajib
    ));

-- -----------------------------------------------------------------------------
-- 2. penanganan_buat: tambah jalur Penelaah Berita UPT
-- -----------------------------------------------------------------------------
create or replace function public.penanganan_buat(
  p_berita uuid,
  p_klarifikasi boolean,
  p_disposisi boolean,
  p_analisis jsonb,
  p_instruksi text default null,
  p_batas timestamptz default null,
  p_pimpinan text default null,
  p_isi_disposisi text default null
)
returns setof public.penanganan_berita
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_kanwil text := public.kanwil_berita(p_berita);
  v_upt text;
  v_saya text := coalesce(public.current_username(), 'sistem');
  v_peran text := public.current_role_name();
  v_kanwil_pembuat boolean := public.has_role('kanwil_admin');
  v_upt_pembuat boolean := public.has_role('upt_penelaah');
  v_status text;
begin
  if not coalesce(p_klarifikasi, false) and not coalesce(p_disposisi, false) then
    raise exception 'Pilih paling sedikit satu tujuan: Klarifikasi UPT atau Disposisi Pimpinan.';
  end if;

  -- Unit berita dibaca lebih dulu: jalur UPT menilainya sebelum apa pun.
  select nullif(b.nama_upt, '') into v_upt from public.berita b where b.id = p_berita;

  if v_upt_pembuat then
    -- UPT hanya boleh Klarifikasi UPT untuk beritanya sendiri; tidak disposisi.
    if coalesce(p_disposisi, false) then
      raise exception 'Penelaah UPT hanya dapat mengajukan Klarifikasi UPT, bukan disposisi pimpinan.'
        using errcode = '42501';
    end if;
    if v_upt is null or v_upt is distinct from public.upt_saya() then
      raise exception 'Berita ini bukan unit Anda, atau belum terpetakan ke unit mana pun.'
        using errcode = '42501';
    end if;
  elsif not public.boleh_kelola_kanwil(v_kanwil) then
    raise exception 'Berita ini di luar wilayah Anda, atau peran Anda tidak berhak menganalisisnya.'
      using errcode = '42501';
  end if;

  if coalesce(p_klarifikasi, false) then
    if v_upt is null or lower(v_upt) in ('belum teridentifikasi', 'tidak diketahui') then
      raise exception 'Berita ini belum terpetakan ke UPT mana pun, jadi belum bisa dimintakan klarifikasi UPT. Petakan UPT-nya lebih dulu.';
    end if;
    -- Kanwil atau UPT yang mengajukan: langsung menjadi tugas UPT untuk diisi.
    v_status := case when v_kanwil_pembuat or v_upt_pembuat then 'menunggu_upt' else 'menunggu_kanwil' end;

    insert into public.penanganan_berita as p
      (berita_id, tujuan, status, kanwil, nama_upt, analisis, instruksi, batas_waktu,
       dibuat_oleh, dibuat_peran, diteruskan_oleh, diteruskan_pada, diperbarui_oleh)
    values
      (p_berita, 'klarifikasi_upt', v_status, v_kanwil, v_upt, coalesce(p_analisis, '{}'::jsonb),
       nullif(trim(p_instruksi), ''), coalesce(p_batas, now() + interval '2 days'),
       v_saya, v_peran,
       -- "diteruskan" hanya benar bila kanwil yang meneruskan. UPT yang
       -- mengajukan sendiri tidak diteruskan siapa pun.
       case when v_kanwil_pembuat then v_saya end, case when v_kanwil_pembuat then now() end, v_saya)
    on conflict (berita_id, tujuan) do update
      set analisis = excluded.analisis,
          instruksi = coalesce(excluded.instruksi, p.instruksi),
          batas_waktu = coalesce(p_batas, p.batas_waktu),
          diperbarui_oleh = v_saya, diperbarui_pada = now();
  end if;

  if coalesce(p_disposisi, false) then
    v_status := case when nullif(trim(p_isi_disposisi), '') is not null then 'dalam_proses' else 'menunggu_disposisi' end;
    insert into public.penanganan_berita as p
      (berita_id, tujuan, status, kanwil, nama_upt, analisis, batas_waktu, pimpinan, isi_disposisi,
       dibuat_oleh, dibuat_peran, diperbarui_oleh)
    values
      (p_berita, 'disposisi_pimpinan', v_status, v_kanwil, v_upt, coalesce(p_analisis, '{}'::jsonb),
       p_batas, nullif(trim(p_pimpinan), ''), nullif(trim(p_isi_disposisi), ''),
       v_saya, v_peran, v_saya)
    on conflict (berita_id, tujuan) do update
      set analisis = excluded.analisis,
          pimpinan = coalesce(excluded.pimpinan, p.pimpinan),
          isi_disposisi = coalesce(excluded.isi_disposisi, p.isi_disposisi),
          status = case when p.status = 'menunggu_disposisi' and excluded.isi_disposisi is not null
                        then 'dalam_proses' else p.status end,
          diperbarui_oleh = v_saya, diperbarui_pada = now();
  end if;

  insert into public.audit_log (actor_username, actor_role, action, entity, entity_id, metadata)
  values (v_saya, v_peran, 'penanganan_analisis', 'berita', p_berita::text,
          jsonb_build_object('klarifikasi', p_klarifikasi, 'disposisi', p_disposisi, 'kanwil', v_kanwil, 'upt', v_upt,
                             'oleh_upt', v_upt_pembuat));

  return query select * from public.penanganan_berita where berita_id = p_berita order by tujuan;
end $$;
