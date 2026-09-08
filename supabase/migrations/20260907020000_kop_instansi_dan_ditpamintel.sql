-- Kop instansi pada pesan harian, dan pembetulan singkatan direktorat.
--
-- DUA HAL, SATU SEBAB.
--
-- Singkatan satuan kerja ini DITPAMINTEL, bukan "Dirpamintel": yang disingkat
-- direktoratnya, bukan direkturnya. Kekeliruan itu tersebar di beberapa tempat
-- dan sudah dibetulkan di sisi aplikasi; dua yang tersisa ada di dalam basis
-- data, dan hanya migrasi yang bisa menjangkaunya.
--
-- Yang kedua bukan pembetulan melainkan penambahan. Pesan harian yang dikirim
-- penjadwal pukul setengah enam pagi selama ini hanya menyebut nama sistem.
-- Di grup yang berisi banyak kanal, pertanyaan pertama pembacanya justru
-- "laporan ini dari siapa" — dan Telegram tidak menggambarkan lambang apa pun
-- di dalam pesan, sehingga satu baris nama lembaga adalah satu-satunya bentuk
-- kop yang tersedia di ragam itu. Baris yang sama sudah lebih dulu dipasang
-- pada pesan yang disusun halaman Distribusi (web/js/lib/pesan-telegram.js);
-- migrasi ini menyamakan jalur otomatisnya.
--
-- Definisi fungsi di bawah disalin utuh dari yang sedang berjalan, dengan
-- SATU baris tambahan pada masing-masing dari dua jalur keluarnya — jalur
-- "tidak ada publikasi" dan jalur biasa. Disalin utuh, bukan ditambal, sebab
-- Postgres tidak punya cara mengganti sebagian isi sebuah fungsi.

begin;

-- 1. Nama sumber pemantauan pusat.
update public.sumber_sheet
   set nama = 'Pemantauan Pusat — Ditpamintel'
 where kode = 'pusat'
   and nama = 'Pemantauan Pusat — Dirpamintel';

-- 2. Kop instansi pada pesan harian otomatis.
create or replace function public.pesan_harian_telegram(p_tanggal date default null::date)
returns text
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  hari       date := coalesce(p_tanggal, ((now() at time zone 'Asia/Jakarta')::date - 1));
  s          jsonb;
  ikh        jsonb;
  bnd        jsonb;
  teks       text;
  baris      text := '';
  batang     text := '';
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
  puncak     int := 0;
  -- Kop, satu tempat. Ditulis sekali supaya kedua jalur keluar di bawah tidak
  -- bisa perlahan menyebut lembaga yang berbeda.
  kop        text := '<b>Laporan Harian Trans-Siber PAS</b>' || chr(10)
                  || '<i>DITPAMINTEL · Direktorat Jenderal Pemasyarakatan</i>' || chr(10);
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

  if n_total = 0 then
    return kop
        || to_char(hari, 'DD-MM-YYYY') || chr(10) || chr(10)
        || 'Tidak ada publikasi yang tercatat pada tanggal ini. '
        || 'Bila ini di luar dugaan, periksa halaman Sinkronisasi Sumber — '
        || 'kosongnya data lebih sering berarti penarikan terhenti daripada berarti tidak ada berita.';
  end if;

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

  teks := kop
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

  select max(j) into puncak from (
    select count(*)::int as j
    from public.berita b
    where b.deleted_at is null
      and coalesce(b.kategori, '') <> 'Di Luar Lingkup'
      and coalesce(b.status_verifikasi, '') not in ('Tidak Valid', 'Diarsipkan')
      and b.sentimen = 'Negatif'
      and coalesce(b.nama_upt, '') <> ''
      and b.nama_upt not ilike 'belum%'
      and b.nama_upt not ilike 'tidak%'
      and coalesce(b.tanggal_publikasi, b.created_at)::date between hari - 6 and hari
    group by b.nama_upt
  ) t;

  if coalesce(puncak, 0) > 0 then
    for r in
      with pekan as (
        select b.nama_upt, count(*)::int as jumlah
        from public.berita b
        where b.deleted_at is null
          and coalesce(b.kategori, '') <> 'Di Luar Lingkup'
          and coalesce(b.status_verifikasi, '') not in ('Tidak Valid', 'Diarsipkan')
          and b.sentimen = 'Negatif'
          and coalesce(b.nama_upt, '') <> ''
          and b.nama_upt not ilike 'belum%'
          and b.nama_upt not ilike 'tidak%'
          and coalesce(b.tanggal_publikasi, b.created_at)::date between hari - 6 and hari
        group by b.nama_upt
      ),
      pekan_lalu as (
        select b.nama_upt, count(*)::int as jumlah
        from public.berita b
        where b.deleted_at is null
          and coalesce(b.kategori, '') <> 'Di Luar Lingkup'
          and coalesce(b.status_verifikasi, '') not in ('Tidak Valid', 'Diarsipkan')
          and b.sentimen = 'Negatif'
          and coalesce(b.nama_upt, '') <> ''
          and coalesce(b.tanggal_publikasi, b.created_at)::date between hari - 13 and hari - 7
        group by b.nama_upt
      )
      select
        replace(replace(replace(p.nama_upt, '&','&amp;'), '<','&lt;'), '>','&gt;') as nama,
        p.jumlah,
        coalesce(l.jumlah, 0) as sebelum,
        p.jumlah - coalesce(l.jumlah, 0) as delta
      from pekan p left join pekan_lalu l on l.nama_upt = p.nama_upt
      order by p.jumlah desc, delta desc, p.nama_upt asc
      limit 5
    loop
      batang := batang
        || '• ' || left(r.nama, 60) || chr(10)
        || '   <code>'
        || repeat('█', greatest(1, round(r.jumlah::numeric / puncak * 12)::int))
        || '</code> ' || r.jumlah
        || case
             when r.sebelum = 0 then ' — <b>baru muncul</b>'
             when r.delta > 0  then ' — naik ' || r.delta
             when r.delta < 0  then ' — turun ' || abs(r.delta)
             else ' — tetap'
           end
        || chr(10);
    end loop;

    teks := teks || chr(10)
         || '<b>UPT naik ke permukaan — 7 hari terakhir</b>' || chr(10)
         || '<i>Publikasi negatif, dibandingkan tujuh hari sebelumnya.</i>' || chr(10)
         || batang;
  end if;

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

  teks := teks || chr(10) || '<i>Rincian lengkap tersedia pada dasbor Trans-Siber PAS.</i>';

  return left(teks, 3900);
end;
$function$;

commit;
