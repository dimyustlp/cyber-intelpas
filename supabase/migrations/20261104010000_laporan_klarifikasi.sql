-- ============================================================================
-- Laporan klarifikasi berita: isian terstruktur menurut format resmi
-- ============================================================================
--
-- Permintaan user 4 November 2026: "Format Laporan Klarifikasi Berita.docx"
-- (folder PAM) dimasukkan ke website di tiap peran. UPT menginput
-- klarifikasinya langsung di layar dan bisa mengunduh formatnya; kanwil dan
-- pusat membaca laporan yang sama dalam bentuk yang sama.
--
-- Isian mengikuti tiga lembar format itu yang menyangkut satu isu:
--
--   Berita Acara Verifikasi Isu   waktu konfirmasi, ringkasan isu, sumber,
--                                 waktu ditemukan, pihak yang dikonfirmasi,
--                                 hasil konfirmasi, fakta sebenarnya, dampak,
--                                 tingkat isu, rekomendasi, petugas
--   Laporan Insidental            nomor, sifat, sebaran, tindakan yang telah
--                                 dilakukan, permohonan arahan, Kepala UPT
--   Draft Tanggapan               naskah tanggapan/klarifikasi publik
--
-- Disimpan sebagai satu kolom jsonb, bukan dua puluh kolom: bentuk lembarnya
-- milik format, dan format bisa direvisi tanpa migrasi. Yang DIJAGA peladen
-- hanya tiga butir yang menentukan arti klarifikasi — hasil konfirmasi,
-- fakta sebenarnya, dan tingkat isu — plus batas ukuran.
--
-- Berkas lampiran kini OPSIONAL bila laporannya diisi: UPT yang sudah
-- mengisi seluruh lembar di layar tidak perlu mengunggah ulang hasil
-- unduhannya sendiri. Tanpa laporan, berkas tetap wajib seperti sebelumnya.
-- Nama dan jabatan pengirim tetap WAJIB di kedua cara.
--
-- Fungsi lama (enam argumen) DIHAPUS, bukan dibiarkan berdampingan: PostgREST
-- memilih fungsi menurut nama argumen, dan dua versi yang sama-sama cocok
-- untuk panggilan enam argumen membuatnya menolak dengan "Could not choose
-- the best candidate function". Panggilan lama tetap jalan karena p_laporan
-- punya nilai bawaan.
-- ============================================================================

alter table public.penanganan_berita
  add column if not exists laporan_klarifikasi jsonb;

alter table public.penanganan_berita
  drop constraint if exists penanganan_laporan_bentuk;
alter table public.penanganan_berita
  add constraint penanganan_laporan_bentuk check (
    laporan_klarifikasi is null
    or (jsonb_typeof(laporan_klarifikasi) = 'object' and pg_column_size(laporan_klarifikasi) <= 65536)
  );

drop function if exists public.penanganan_kirim_klarifikasi(uuid, text, text, text, text, text);

create or replace function public.penanganan_kirim_klarifikasi(
  p_id uuid, p_jalur text, p_nama_berkas text, p_pengirim text, p_jabatan text,
  p_ringkasan text default null, p_laporan jsonb default null
)
returns public.penanganan_berita
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.penanganan_berita := public.penanganan_baris(p_id);
        v_saya text := coalesce(public.current_username(), 'sistem');
        v_laporan jsonb := case when jsonb_typeof(p_laporan) = 'object' and p_laporan <> '{}'::jsonb then p_laporan end;
        v_berkas boolean := nullif(trim(coalesce(p_jalur, '')), '') is not null;
begin
  if r.tujuan <> 'klarifikasi_upt' then raise exception 'Bukan permintaan klarifikasi.'; end if;
  if not ((public.has_role('upt_penelaah') and r.nama_upt = public.upt_saya())
          or (public.has_role('kanwil_admin') and r.kanwil = public.kanwil_saya())
          or public.has_role('super_admin')) then
    raise exception 'Klarifikasi ini bukan untuk unit Anda.' using errcode = '42501';
  end if;
  if r.status not in ('menunggu_upt', 'perlu_perbaikan') then
    raise exception 'Klarifikasi tidak sedang ditunggu (status: %).', r.status;
  end if;
  if char_length(trim(coalesce(p_pengirim, ''))) < 3 then
    raise exception 'Nama pengirim wajib diisi.';
  end if;
  if char_length(trim(coalesce(p_jabatan, ''))) < 2 then
    raise exception 'Jabatan pengirim wajib diisi.';
  end if;

  if v_laporan is null and not v_berkas then
    raise exception 'Isi laporan klarifikasi atau unggah berkas klarifikasi.';
  end if;
  if v_laporan is not null then
    if coalesce(v_laporan->>'hasil_konfirmasi', '') not in ('benar', 'sebagian_benar', 'tidak_benar') then
      raise exception 'Hasil konfirmasi wajib dipilih: benar, sebagian benar, atau tidak benar.';
    end if;
    if char_length(trim(coalesce(v_laporan->>'fakta', ''))) < 10 then
      raise exception 'Fakta sebenarnya wajib diisi.';
    end if;
    if coalesce(v_laporan->>'tingkat', '') not in ('rendah', 'sedang', 'tinggi', 'kritis') then
      raise exception 'Tingkat isu wajib dipilih: rendah, sedang, tinggi, atau kritis.';
    end if;
  end if;
  if v_berkas then
    if p_jalur not like ('%/' || p_id::text || '/%') then
      raise exception 'Berkas klarifikasi belum terunggah untuk permintaan ini.';
    end if;
    if lower(coalesce(p_nama_berkas, '')) !~ '\.(pdf|docx)$' then
      raise exception 'Berkas klarifikasi harus PDF atau DOCX.';
    end if;
  end if;

  update public.penanganan_berita
     set status = 'klarifikasi_masuk',
         berkas_jalur = case when v_berkas then p_jalur end,
         berkas_nama = case when v_berkas then p_nama_berkas end,
         laporan_klarifikasi = v_laporan,
         pengirim_nama = trim(p_pengirim), pengirim_jabatan = trim(p_jabatan),
         ringkasan_klarifikasi = left(nullif(trim(coalesce(p_ringkasan, v_laporan->>'fakta')), ''), 2000),
         diunggah_oleh = v_saya, diunggah_pada = now(),
         diperbarui_oleh = v_saya, diperbarui_pada = now()
   where id = p_id returning * into r;
  return r;
end $$;

grant execute on function public.penanganan_kirim_klarifikasi(uuid, text, text, text, text, text, jsonb) to authenticated;

-- ------------------------------------------- pemberitahuan: hasil konfirmasi

/**
 * Pesan "SUDAH menginput" kini menyebut hasil konfirmasi dan tingkat isunya
 * bila laporannya diisi — dua hal yang paling ingin diketahui pembaca grup —
 * dan tidak lagi menulis "Berkas: " kosong ketika tidak ada lampiran.
 * Cabang lain sama persis dengan 20261103040000.
 */
create or replace function public.kabar_penanganan_pemicu()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_judul text;
  v_teks text;
  v_jenis text;
  v_pusat boolean := false;
  v_hasil text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  select left(regexp_replace(coalesce(judul, ''), '\s+', ' ', 'g'), 160) into v_judul from public.berita where id = new.berita_id;

  if new.tujuan = 'klarifikasi_upt' then
    if new.status = 'menunggu_kanwil' then
      v_jenis := 'perlu_diteruskan';
      v_teks := format(E'📨 <b>Klarifikasi UPT perlu diteruskan</b>\nPusat meminta klarifikasi dari <b>%s</b>.\n%s\n\nMohon admin kanwil meneruskannya ke UPT lewat Trans-Siber PAS › Tindak Lanjut.',
        esc_html(new.nama_upt), esc_html(v_judul));
    elsif new.status = 'menunggu_upt' then
      v_jenis := 'diteruskan';
      v_teks := format(E'📌 <b>Permintaan klarifikasi ke %s</b>\n%s\nBatas: %s\n%s\nStatus: <b>BELUM</b> ada berkas klarifikasi.',
        esc_html(new.nama_upt), esc_html(v_judul), coalesce(jam_wib(new.batas_waktu), '-'),
        coalesce('Instruksi: ' || esc_html(new.instruksi), ''));
    elsif new.status = 'klarifikasi_masuk' then
      v_jenis := 'sudah';
      v_pusat := true;
      v_hasil := case new.laporan_klarifikasi->>'hasil_konfirmasi'
        when 'benar' then 'BENAR' when 'sebagian_benar' then 'SEBAGIAN BENAR' when 'tidak_benar' then 'TIDAK BENAR' end;
      v_teks := format(E'✅ <b>%s SUDAH menginput klarifikasi</b>\n%s\nDikirim oleh: <b>%s</b> (%s)\n%s%sWaktu: %s\n\nSilakan dinilai di Tindak Lanjut.',
        esc_html(new.nama_upt), esc_html(v_judul), esc_html(new.pengirim_nama), esc_html(new.pengirim_jabatan),
        coalesce('Hasil konfirmasi: <b>' || v_hasil || '</b> · tingkat ' || esc_html(new.laporan_klarifikasi->>'tingkat') || E'\n', ''),
        -- esc_html(null) mengembalikan '' (bukan null), jadi diperiksa di sini.
        case when new.berkas_nama is not null then 'Berkas: ' || esc_html(new.berkas_nama) || E'\n' else '' end,
        jam_wib(new.diunggah_pada));
    elsif new.status = 'perlu_perbaikan' then
      v_jenis := 'perbaikan';
      v_teks := format(E'↩️ <b>Klarifikasi %s dikembalikan untuk diperbaiki</b>\n%s\nCatatan: %s\nBatas baru: %s',
        esc_html(new.nama_upt), esc_html(v_judul), esc_html(new.catatan_penilaian), coalesce(jam_wib(new.batas_waktu), '-'));
    elsif new.status = 'diterima' then
      v_jenis := 'diterima';
      v_teks := format(E'☑️ <b>Klarifikasi %s diterima</b>\n%s', esc_html(new.nama_upt), esc_html(v_judul));
    end if;
  else
    if new.status = 'menunggu_disposisi' then
      v_jenis := 'disposisi_baru'; v_pusat := true;
      v_teks := format(E'🗂️ <b>Berita menunggu disposisi pimpinan</b>\n%s\nUPT: %s', esc_html(v_judul), esc_html(coalesce(new.nama_upt, '-')));
    elsif new.status = 'dalam_proses' then
      v_jenis := 'disposisi_jalan';
      v_teks := format(E'🗂️ <b>Disposisi pimpinan dicatat</b>\n%s\nDari: %s\nIsi: %s\nBatas: %s',
        esc_html(v_judul), esc_html(coalesce(new.pimpinan, '-')), esc_html(new.isi_disposisi), coalesce(jam_wib(new.batas_waktu), '-'));
    elsif new.status = 'selesai' then
      v_jenis := 'disposisi_selesai'; v_pusat := true;
      v_teks := format(E'☑️ <b>Disposisi pimpinan selesai ditindaklanjuti</b>\n%s\nHasil: %s', esc_html(v_judul), esc_html(new.hasil_tindak));
    end if;
  end if;

  if v_teks is not null then
    insert into public.kabar_penanganan (penanganan_id, kanwil, jenis, teks, ke_pusat)
    values (new.id, new.kanwil, v_jenis, v_teks || E'\n\n<i>Trans-Siber PAS · ' || esc_html(coalesce(new.kanwil, 'tanpa kanwil')) || '</i>', v_pusat);
  end if;
  return new;
end $$;
