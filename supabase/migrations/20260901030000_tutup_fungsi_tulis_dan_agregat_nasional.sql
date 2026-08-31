-- Menutup fungsi SECURITY DEFINER yang tidak pernah dipanggil dari peramban.
--
-- Yang paling mendesak adalah terapkan_klasifikasi. Fungsi itu MENULIS —
-- kategori, sentimen, urgensi, dan nama UPT — dan karena SECURITY DEFINER ia
-- berjalan melewati seluruh policy RLS. Selama hak jalannya masih melekat pada
-- peran `authenticated`, setiap orang yang bisa masuk ke aplikasi — termasuk
-- penginput kantor wilayah — dapat memanggilnya langsung lewat
-- /rest/v1/rpc/terapkan_klasifikasi dan menulis ulang penilaian seluruh arsip
-- nasional dalam satu permintaan. Tidak ada satu pun layar yang memerlukannya:
-- pemanggilnya hanya Edge Function klasifikasi, yang memakai service_role.
--
-- snapshot_laporan berbeda beratnya tetapi searah: ia mengembalikan rekapitulasi
-- nasional tanpa memandang wilayah penugasan pemanggilnya, sehingga akun kanwil
-- dapat membaca angka di luar wilayahnya. Peramban memanggil snapshot_negatif
-- dan kesehatan_asupan, bukan fungsi ini.
--
-- Yang TIDAK dicabut, dan alasannya:
--   can_access_upt, can_access_berita, has_role, current_app_user,
--   current_role_name, current_username, is_super_admin, kanwil_saya,
--   peran_pusat, peran_wilayah — dipanggil dari dalam ekspresi policy RLS.
--   Ekspresi policy dijalankan dengan hak pemanggil, sehingga mencabut
--   EXECUTE-nya akan membuat setiap kueri pengguna gagal dengan "permission
--   denied for function" — yaitu mematikan seluruh aplikasi demi menutup fungsi
--   yang hanya mengembalikan identitas pemanggil itu sendiri.
--   kesehatan_asupan — dipakai layar Kesehatan Sistem lewat main.js.
--
-- Peringatan advisor untuk kesepuluh fungsi di atas karena itu memang tinggal;
-- membiarkannya adalah keputusan, bukan kelalaian.

revoke execute on function public.terapkan_klasifikasi(jsonb) from public, anon, authenticated;
revoke execute on function public.snapshot_laporan(date, date) from public, anon, authenticated;
revoke execute on function public.user_directory() from public, anon, authenticated;
revoke execute on function public.cyberintelpas_system_health() from public, anon, authenticated;
revoke execute on function public.next_report_number(text) from public, anon, authenticated;

-- Penyusun pesan Telegram memanggil snapshot_laporan di dalamnya dan hanya
-- dijalankan penjadwal, jadi ia ikut ditutup dari peran pengguna.
revoke execute on function public.pesan_harian_telegram(date) from public, anon, authenticated;
