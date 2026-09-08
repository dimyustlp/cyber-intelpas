-- ============================================================================
-- Tier 4 hening, dan rute Kanwil Jawa Timur yang belum dinyalakan
-- ============================================================================
--
-- KEKELIRUAN YANG DIPERBAIKI
--
-- Kaidah pertama `rute_notifikasi()` memetakan Tier 4 ke tingkat 'unit'.
-- Buku Panduan Emas menetapkan sebaliknya, dan menetapkannya dengan tegas:
--
--   "Muncul di TIER 4 -> Level 1: Pantau -> Tidak ada (Hening).
--    Data masuk Log Dashboard."
--
-- Angka membenarkan Buku Panduan. Diukur tujuh hari, berita negatif per hari:
--
--   Tier 1  2,3      Tier 3  0,3
--   Tier 2  2,7      Tier 4  9,1   <- dua pertiga seluruh lalu lintas
--
-- Menegakkan kaidah hening memangkas 9 dari 14 pesan harian, dan yang
-- dipangkas justru yang paling tidak dapat ditindaklanjuti: rumor hiperlokal
-- yang belum divalidasi siapa pun. Tier 4 tetap tercatat, tetap terhitung,
-- tetap terlihat di dasbor — ia hanya tidak membunyikan telepon pimpinan.

create or replace function public.rute_notifikasi(
  p_tier smallint,
  p_kanwil text,
  p_nama_upt text
)
returns table (chat_id text, tingkat text, keterangan text)
language sql
stable
as $fn$
  with tingkat_wajib as (
    select unnest(
      case
        when p_tier = 1 then array['pusat','kanwil','unit']
        when p_tier = 2 then array['kanwil','unit']
        when p_tier = 3 then array['unit']
        else array[]::text[]     -- Tier 4: hening. Dasbor saja.
      end
    ) as tingkat
  )
  select distinct r.chat_id, r.tingkat, r.keterangan
  from public.notifikasi_rute r
  join tingkat_wajib w on w.tingkat = r.tingkat
  where r.aktif
    and (r.tier is null or r.tier = p_tier)
    and (r.kanwil is null or r.kanwil = p_kanwil)
    and (r.nama_upt is null or r.nama_upt = p_nama_upt);
$fn$;

comment on function public.rute_notifikasi(smallint, text, text) is
  'Daftar grup tujuan sebuah berita negatif menurut tier. Tingkatnya menumpuk. Tier 4 sengaja tidak menghasilkan tujuan apa pun - Buku Panduan menetapkannya hening, dan ia menyumbang 9 dari 14 berita negatif harian.';

-- ------------------------------------------------- rute Kanwil Jawa Timur

/**
 * Dicatat, tetapi TIDAK DINYALAKAN.
 *
 * Chat id boleh disimpan: ia pengenal, bukan kunci — memilikinya saja tidak
 * memberi siapa pun kemampuan mengirim apa pun.
 *
 * Yang menahan penyalaannya adalah tokennya. Token bot pertama untuk grup ini
 * dikirimkan sebagai teks biasa lewat percakapan, sehingga ia harus dianggap
 * sudah diketahui pihak lain. Bot yang tokennya dipegang orang lain bisa
 * mengirim kabar palsu yang tampak resmi ke grup Kanwil — bentuk kerusakan yang
 * jauh lebih mahal daripada sekadar bocornya data, sebab yang dirusak adalah
 * kepercayaan pada salurannya sendiri.
 *
 * Urutan yang benar: cabut di BotFather, terbitkan yang baru, simpan yang baru
 * ke Vault, baru `aktif = true`.
 */
insert into public.notifikasi_rute (tier, kanwil, tingkat, chat_id, keterangan, aktif)
values (
  null,
  'Kantor Wilayah Ditjenpas Jawa Timur',
  'kanwil',
  '-5409449489',
  'Berita Kanwil JATIM. Bot terpisah dari bot pusat. MENUNGGU token pengganti: token pertama terkirim sebagai teks biasa dan harus dicabut lewat BotFather lebih dulu.',
  false
)
on conflict do nothing;
