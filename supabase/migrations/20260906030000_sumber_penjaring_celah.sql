-- =============================================================================
-- Sumber ketiga: Penjaring Celah
-- =============================================================================
--
-- Dua sumber yang sudah ada bekerja dengan cara yang sama-sama pasif: keduanya
-- menyapu kata kunci umum ("lapas", "rutan", "pemasyarakatan") dan memungut apa
-- pun yang lewat. Penyapuan semacam itu selalu menemukan yang paling ramai, dan
-- yang paling ramai selalu unit besar di pulau yang sama.
--
-- Akibatnya terukur pada 6 September 2026: dari 531 unit yang aktif, 343
-- BELUM PERNAH muncul satu kali pun dalam 858 publikasi terkumpul. Enam puluh
-- empat persen. Kantor Wilayah Maluku Utara nol dari sepuluh unit; Sulawesi
-- Utara satu dari empat belas. Unit-unit itu tidak kalah beritanya — mereka
-- tidak pernah dicari.
--
-- Penjaring ini berangkat dari DAFTAR UNIT, bukan dari kata kunci: setiap unit
-- yang sunyi dicari namanya satu per satu lewat RSS Google News, dua belas unit
-- per hari secara berputar. Skripnya ada di tools/penjaring-celah.gs, dan
-- alasan tiap keputusannya ditulis di kepala berkas itu.
--
-- Ia SENGAJA mencari di wilayah yang bertumpang tindih dengan dua sumber lain,
-- jadi berita kembar adalah kepastian, bukan kemungkinan. Yang menahannya
-- adalah pemicu `berita_seragamkan_tautan` dan indeks unik
-- `berita_link_normalized_unik_idx` dari migrasi 20260906020000 — bukan
-- kehati-hatian skripnya. Skrip yang berhati-hati menghemat pekerjaan; hanya
-- basis data yang benar-benar menolak.
--
-- Didaftarkan AKTIF meski berkasnya belum dibagikan. Selama belum, halaman
-- Sinkronisasi Sumber akan menampilkannya berstatus Gagal — dan itu keadaan
-- yang benar, bukan kekeliruan yang perlu diperbaiki di kode. Begitu pemiliknya
-- menyetel "Siapa saja yang memiliki link" sebagai Pelihat, ia mulai bekerja
-- sendiri tanpa ada yang perlu ditekan.
-- =============================================================================

insert into public.sumber_sheet
    (kode, nama, lingkup, kanwil, sheet_id, sheet_nama, csv_url, aktif, urutan,
     terakhir_status, terakhir_pesan)
values (
    'penjaring',
    'Penjaring Celah — unit yang belum pernah diberitakan',
    'pusat',
    null,
    '1I_8aDhMxAKZQ-uBHoJaS-RYHj45FOmPXSKj9GXXe5GU',
    'Sheet1',
    'https://docs.google.com/spreadsheets/d/1I_8aDhMxAKZQ-uBHoJaS-RYHj45FOmPXSKj9GXXe5GU/gviz/tq?tqx=out:csv&gid=0',
    true,
    30,
    'Menunggu',
    'Berkasnya belum dibagikan. Buka spreadsheet, tekan Bagikan, setel akses '
      || 'menjadi "Siapa saja yang memiliki link" sebagai Pelihat. Sesudah itu '
      || 'tidak ada yang perlu ditekan; penyalin memanggilnya tiap lima menit.'
)
on conflict (kode) do update set
    nama            = excluded.nama,
    sheet_id        = excluded.sheet_id,
    csv_url         = excluded.csv_url,
    aktif           = excluded.aktif,
    urutan          = excluded.urutan,
    terakhir_pesan  = excluded.terakhir_pesan;
