I have everything I need. Here is the functional specification.

---

# SPESIFIKASI FUNGSIONAL CYBER-INTELPAS v6.0.1
### Untuk Penulisan Ulang di Next.js

Aplikasi: Streamlit multi-page, backend Supabase (PostgreSQL + Storage), zona waktu operasional **Asia/Jakarta (WIB)**. Entrypoint: `app.py` (identik dengan `streamlit_app.py`). Master UPT: 492 baris pada `data/master_upt_coordinates.csv`.

---

## 1. DAFTAR HALAMAN

Navigasi disusun dinamis di `app.py` (grup lama) lalu ditambah `services/v6_navigation.py::attach_v6_pages` (grup V6). Grup kosong otomatis dihapus.

### Grup "Eksekutif"

**1.1 Dashboard** — `pages/dashboard.py` · izin `view_dashboard` · default page (semua peran)
- Judul tampil: "SIMBERPAS — Executive Dashboard".
- Peran `executive_decision_maker` hanya melihat berita `status_verifikasi == "Terverifikasi"` ATAU `warning_state == "preliminary"`.
- 9 kartu KPI: Total Berita, Peringatan Awal, Belum Ditelaah, UPT Merah Tua (`marker_status=critical`), UPT Merah (`negative`), UPT Terpantau, Spreadsheet (`source_type=google_sheet`), Input Manual, Hari Ini (+delta vs kemarin).
- Jika data kosong: hanya 3 KPI (Total UPT, Belum Ada Berita, Koordinat) lalu `st.stop()`.
- Panel "Ringkasan Eksekutif" (AI/lokal) + panel "Early Warning" dengan tingkat perhatian RENDAH/SEDANG/TINGGI.
- Grafik: tren harian 14 hari (line), donut sentimen, bar horizontal platform (top 8), bar vertikal kategori (top 8).
- Daftar 8 prioritas dengan badge **AWAL** vs **RESMI**; tabel ringkasan status marker peta.

**1.2 Warning News** — `pages/warning_news.py` · izin `view_warning` (alias → `view_alerts`)
- 4 KPI: Peringatan Awal, Terverifikasi, Kritis, Tinggi.
- Filter: jenis peringatan, urgensi (Kritis/Tinggi), UPT, cari judul/media.
- Menampilkan max 50 kartu, diurutkan Kritis→Tinggi lalu `created_at` desc. Tiap kartu: border kiri `#9B1C1C` (awal) atau `#650000` (terverifikasi), judul, meta, ringkasan 420 karakter, tombol "Buka sumber".
- Read-only, tidak ada aksi ubah status.

**1.3 Peta Indonesia** — `pages/peta_indonesia.py` · izin `view_map`
- Folium `CartoDB positron`, zoom 4.3 (semua provinsi) / 7.0 (provinsi terpilih) / 12.0 (1 UPT).
- Dua layer: `MarkerCluster` (disableClusteringAtZoom=11) untuk UPT reguler, dan `FeatureGroup` prioritas untuk marker critical/negative/peringatan awal.
- Filter: Provinsi, Kanwil, Status marker (6 opsi), Kualitas koordinat, cari UPT, checkbox "Hanya UPT memiliki berita", checkbox "Nonaktifkan animasi".
- 6 metrik: UPT tampil, Merah tua, Merah, Abu-abu, Terverifikasi, Peringatan awal. Legenda 7 item.
- Klik marker → menampilkan tabel berita UPT tersebut. Tabel daftar UPT di bawah peta.

**1.4 AI Assistant** — `pages/ai_assistant.py` · izin `use_ai` (alias → `view_ai_assistant`)
- Antarmuka chat (`st.chat_input`), toggle "Gunakan hanya berita terverifikasi" (default ON).
- Jawaban menampilkan provider dan expander "Sumber data jawaban" berisi tautan sumber `[S1]…[S25]`.

### Grup "Operasional"

**1.5 Input Berita / Input & Analisis** — `pages/input_berita.py` · izin `create_news`
- Judul berubah menjadi "Input & Analisis" jika pengguna juga punya `analyze_news`.
- **Tahap 1 (form `process_news`)**: pilih UPT (dari master aktif, terbatas cakupan pengguna), nama penginput (disabled, auto), link berita (wajib), caption/transkrip. Tombol "PROSES SUMBER & CEK DUPLIKASI" → jalankan `analyze_news()` + `find_duplicate_news()`.
- Anti-duplikasi 3 lapis: (1) normalisasi URL, (2) live warning kuning bila mirip, (3) Smart Upsert — radio 3 opsi: `Batalkan jika duplikat` / `Simpan sebagai sumber tambahan` / `Simpan sebagai perkembangan baru` (default index 1 bila duplikat terdeteksi).
- **Tahap 2 (form `save_news_form`)**: Judul, Media, Platform (7 opsi), Tanggal publikasi, Lokasi kejadian. Kolom kanan hanya editable bila `analyze_news` — daftar 19 kategori, Subkategori, Sentimen (Positif/Netral/Negatif/Campuran), Urgensi (Rendah/Sedang/Tinggi/Kritis), Dampak (UPT/Kanwil/Nasional/Lintas Instansi/Perhatian Publik Luas). Operator hanya melihat hasil klasifikasi (read-only).
- Lampiran: JPG/JPEG/PNG/PDF, maks 5 file, maks 10 MB/file.
- Urgensi Tinggi/Kritis memunculkan banner "PERINGATAN AWAL".
- Simpan selalu dengan `status_verifikasi = "Belum Ditelaah"`, `source_type = "manual"`.
- Expander "Lihat 5 Berita Terakhir".

**1.6 Pusat Telaah** — `pages/pusat_telaah.py` · izin `review_news`
- 5 KPI: Peringatan Awal, Belum Ditelaah, Perlu Koreksi, Terverifikasi, Tidak Valid.
- Antrean 7 opsi: Prioritas Tinggi/Kritis, Belum Ditelaah, Perlu Koreksi, Terverifikasi, Tidak Valid, Diarsipkan, Semua Berita. Filter cari + filter sumber.
- Urutan: rank urgensi (Kritis=0, Tinggi=1, Sedang=2, Rendah=3, lainnya=4) lalu `created_at` desc.
- Form "Koreksi Analisis": Judul, Media, Kategori, Subkategori, Sentimen, Urgensi, **Lokasi UPT** (dropdown master aktif + opsi "Belum Teridentifikasi"), **Nama UPT manual** (menimpa dropdown bila diisi), Dampak, Lokasi kejadian, Ringkasan, Catatan analisis internal.
- Tombol keputusan kontekstual per status (lihat bagian 3). Catatan/alasan wajib untuk "Perlu Koreksi" dan "Tidak Valid".
- Expander "Riwayat Telaah dan Status" dari tabel `berita_status_history`.

**1.7 Pemetaan UPT** — `pages/pemetaan_upt.py` · izin `review_news`
- 3 KPI: Belum Terpetakan, Berita Spreadsheet, Sudah Terpetakan.
- Antrean max 50 berita ber-`nama_upt` kosong/"Tidak diketahui"/"None"/"nan". Per berita: kandidat UPT + persentase confidence + alasan, dropdown pilih UPT, tombol "Simpan Pemetaan".
- Method dicatat sebagai `saran_lokal` (bila memilih kandidat) atau `manual`.

**1.8 Pusat Data Berita** — `pages/data_berita.py` · izin `view_data` (alias → `view_news`)
- 5 metrik status. Filter 2 baris: UPT, Sentimen, Urgensi, Status telaah, Platform, Kategori, Sumber input, Jenis peringatan; plus rentang tanggal (WIB) dan pencarian teks.
- Tombol "Unduh hasil ke Excel" (`SIMBERPAS_Data_Berita.xlsx`) bila punya `export_reports`.
- Detail berita + expander "Koreksi Data Berita" (dikendalikan `can_edit_news`). Operator yang menyimpan koreksi pada status "Perlu Koreksi" otomatis dikembalikan ke "Belum Ditelaah".
- Bagian Lampiran: daftar, signed URL (1 jam), unggah, arsipkan (izin `archive_news`).
- Expander "Riwayat Status".

**1.9 Laporan Operasional** — `pages/laporan.py` · izin `export_reports` (alias → `download_reports`)
- Filter global: rentang tanggal, sentimen, kategori, status verifikasi (default "Terverifikasi"), urgensi, platform, UPT.
- **Tab Harian**: 6 KPI (Total, Negatif, Tinggi/Kritis, UPT Aktif, Positif, Netral), tabel 17 kolom, pengaturan label periode, 3 tombol unduh (PDF resmi, Excel, CSV UTF-8-sig), dan expander "Distribusi Laporan Harian ke Telegram Pimpinan" dengan tombol kirim langsung.
- **Tab Mingguan**: label periode, multiselect Fokus Isu Strategis (5 opsi), 3 metrik, tabel "Risk Heatmap" berita negatif, tombol unduh Excel. **Tombol PDF Lanskap dinonaktifkan (`data=b""`, `disabled=True`).**

### Grup "Briefing & Intelijen" (V6)

**1.10 Briefing Harian** — `pages/briefing_harian.py` · izin `view_executive_brief` (semua peran)
- Konten berbeda per peran (lihat `briefing_service`). Struktur: nama peran, judul, punchline berwarna status, kartu metrik, "Sorotan utama", "Yang perlu dilakukan".
- Juga muncul sebagai dialog modal sekali per sesi setelah login.

**1.11 Tren Mingguan** — `pages/tren_mingguan.py` · izin `view_weekly_trends`
- Pilih rentang tanggal (default 7 hari terakhir). 6 metrik snapshot. Peringatan bila ada publikasi negatif belum terpetakan UPT. Notifikasi perubahan persen.
- Grafik: line tren harian, bar horizontal peringkat UPT (top 10), pie sentimen, bar urgensi.

**1.12 Kasus Intelijen** — `pages/kasus_intelijen.py` · izin `view_cases` ATAU `manage_cases`
- Tabel kasus (11 kolom). Pemilik `manage_cases` mendapat: form buat kasus baru + 3 tab — Perbarui Kasus, Hubungkan Berita (multiselect publikasi belum terhubung), Penugasan Lapangan (pilih petugas berperan `field_verification_officer`, instruksi, daftar pertanyaan verifikasi, batas waktu tanggal+jam default 17:00 WIB, prioritas default "Tinggi").

**1.13 Laporan Intelijen** — `pages/laporan_intelijen.py` · izin `view_reports`
- Pilih periode, toggle "Gunakan AI", tombol "Buat Laporan Sekarang" (aktif bila `generate_reports` atau `download_reports`).
- 6 metrik. Lima textarea narasi yang **dapat diedit** sebelum diekspor. Tabel rekap UPT.
- Tombol "Simpan sebagai Draf Sistem" (izin `generate_reports`). Tiga tombol unduh: PDF, Word, PowerPoint.
- Arsip laporan + dropdown "Status baru" yang isinya bergantung izin: `edit_report_drafts` → Draf Sistem/Ditelaah Analis/Diverifikasi; `approve_reports` → Disetujui; `publish_reports` → Dipublikasikan.

**1.14 Keputusan Pimpinan** — `pages/keputusan_pimpinan.py` · izin `decide_cases` (hanya pimpinan + super admin)
- Prioritaskan kasus berstatus: Menunggu Keputusan Tindak Lanjut, Menunggu Keputusan Pimpinan, Dalam Tindak Lanjut UPT, Dalam Pemantauan.
- Menampilkan analisis akhir + fakta lapangan + tabel rekomendasi. Multiselect rekomendasi (default semua), dropdown keputusan (5 opsi), catatan arahan, **checkbox konfirmasi wajib** sebelum tombol aktif.
- Riwayat keputusan. Form "Buat Disposisi atau Tugas Tindak Lanjut" (peran penanggung jawab tidak boleh `executive_decision_maker`).

### Grup "Tindak Lanjut" (V6)

**1.15 Verifikasi Lapangan** — `pages/verifikasi_lapangan.py` · izin `view_field_assignments`
- Petugas hanya melihat penugasan miliknya; pemilik `manage_cases`/`view_system_health` melihat semua.
- Dropdown status penugasan (12 opsi FIELD_STATUSES). Radio jenis laporan (Laporan Cepat/Lengkap).
- Form laporan lapangan 15 field: tanggal+waktu mulai/selesai, petugas pelaksana, pihak ditemui, ringkasan kegiatan, fakta ditemukan, keterangan UPT, dokumen diperiksa, hambatan, tindakan langsung, komitmen UPT, tenggat komitmen, klasifikasi temuan (7 opsi), kesimpulan awal.
- Unggah bukti ke bucket `field-evidence`, path `{case_id}/{report_id}/{uuid}.{ext}` — **hanya aktif setelah laporan dikirim** (bergantung `st.session_state["last_field_report_id"]`).

**1.16 Evaluasi & Rekomendasi** — `pages/analisis_evaluasi.py` · izin `analyze_cases`
- Dua kolom: narasi media vs fakta lapangan. **Matriks perbandingan** 5 baris editable (Waktu kejadian, Lokasi dan pihak terkait, Kronologi, Tindak lanjut, Kondisi terkini) × kolom (Narasi Media, Temuan Lapangan, Penilaian).
- **Penilaian lima dimensi**: Validitas informasi (4 opsi), Dampak reputasi (5), Dampak operasional (5), Dampak hukum/kepatuhan (5), Risiko eskalasi media (5), Kualitas tindak lanjut UPT (5).
- Multiselect akar masalah (11 opsi). Analisis akhir. Tombol simpan (versi bertambah otomatis).
- Form rekomendasi bertingkat: Tindakan Segera / Jangka Pendek / Tindakan Struktural + penanggung jawab + tenggat + prioritas.

**1.17 Tindak Lanjut** — `pages/tindak_lanjut.py` · izin `view_action_items`
- Pemilik `manage_action_items` melihat semua tugas; lainnya hanya tugas milik username atau perannya.
- Kolom turunan **Tenggat** (format `DD-MM-YYYY HH:MM WIB`) dan **Kondisi** (Selesai / Terlambat / Aktif). 3 metrik.
- Update status (6 opsi) + slider progres 0–100 step 5. Hanya bila `update_action_items`/`manage_action_items` DAN (melihat semua ATAU tugas miliknya).

### Grup "Administrasi Sistem"

**1.18 Manajemen Pengguna** — `pages/manajemen_pengguna.py` · izin `manage_users`
- Form tambah pengguna (username, nama lengkap, peran, kata sandi ≥8 karakter, cakupan Kanwil, cakupan UPT).
- Tabel pengguna + checkbox tampilkan arsip. Aksi: ubah profil/peran, reset kata sandi, aktif/nonaktif, arsip (konfirmasi ketik username), pulihkan.
- Proteksi: super admin terakhir tidak bisa dinonaktifkan/diarsipkan; akun sendiri tidak bisa dinonaktifkan/diarsipkan.

**1.19 Manajemen Peran** — `pages/manajemen_peran.py` · izin `manage_users` (grup V6)
- Tabel katalog 6 peran (Kode, Nama, Tupoksi, Fokus). Ubah peran satu pengguna. Blokir bila mengubah super admin aktif terakhir.

**1.20 Koordinat UPT** — `pages/koordinat_upt.py` · izin `manage_coordinates` (alias → `manage_settings`)
- 4 metrik. Impor CSV/XLSX (upsert, tidak menghapus). Unduh master koordinat.
- Edit per UPT: jenis, kelas, provinsi, kanwil, kab/kota, alamat, lat/lon (8 desimal), kualitas koordinat (6 opsi), sumber, catatan. Dua tombol: "SIMPAN PERUBAHAN" dan "SIMPAN & VERIFIKASI TITIK".

**1.21 Sinkronisasi Spreadsheet** — `pages/sinkronisasi_spreadsheet.py` · izin `manage_sync` (alias → `run_sync`)
- 6 metrik kesehatan sinkron. Tabel arsitektur. Tombol "SINKRONKAN SEKARANG" (aktif hanya bila `SHEET_SYNC_TOKEN` terisi). Riwayat log. Tabel pemetaan kolom.

**1.22 Audit Aktivitas** — `pages/audit_aktivitas.py` · izin `view_audit` (alias → `view_audit_logs`)
- 4 metrik (Total aktivitas, Pengguna aktif di log, Perubahan berita, Login gagal). Filter pengguna/aksi/objek/peran + pencarian metadata. 2 tab: Aktivitas Pengguna (dengan unduh Excel), Sinkronisasi Spreadsheet.

**1.23 Pengaturan** — `pages/pengaturan.py` · izin `manage_settings`
- 6 metrik status koneksi. Pemeriksaan 5 tabel wajib. Tabel kesehatan data. Cek bucket `berita-bukti`. Daftar berkas penting paket.

**1.24 Kesehatan Sistem** — `pages/kesehatan_sistem.py` · izin `view_system_health` (super admin)
- Tombol "Periksa Ulang". 4 metrik (Normal/Peringatan/Kritis/Total). 20 pemeriksaan komponen.

---

## 2. MATRIKS HAK AKSES

### Nama peran kanonis (`role_catalog.py`)
| Kode | Nama tampil |
|---|---|
| `executive_decision_maker` | Pimpinan Pengambil Keputusan |
| `media_intelligence_analyst` | Analis Intelijen Pemberitaan |
| `news_data_operator` | Operator Akuisisi dan Validasi Data |
| `field_verification_officer` | Petugas Verifikasi Lapangan |
| `evaluation_recommendation_analyst` | Analis Evaluasi dan Rekomendasi |
| `super_admin` | Administrator Utama CYBER-INTELPAS |

**Alias peran lama** (19 entri, dinormalisasi via `canonical_role`): `pimpinan`/`executive_viewer`/`pimpinan_eksekutif`/`viewer` → executive; `analis`/`news_analyst`/`analis_pemberitaan_strategis`/`admin_pusat`/`admin_kanwil` → media analyst; `operator`/`news_intake`/`operator_akuisisi_data_berita`/`operator_upt` → operator; `tim_lapangan`/`petugas_verifikasi_lapangan` → field; `tim_analisis`/`analis_evaluasi_dan_rekomendasi` → evaluation; `administrator_utama_sistem`/`admin` → super_admin.

### Konstanta izin per peran (`ROLE_PERMISSIONS`)

**executive_decision_maker (18)**: `view_dashboard, view_executive_brief, view_news, view_verified_news, view_map, view_ai_assistant, view_weekly_trends, view_cases, view_field_reports, view_recommendations, decide_cases, download_reports, view_reports, approve_reports, publish_reports, view_alerts, view_action_items, manage_action_items`

**media_intelligence_analyst (21)**: `view_dashboard, view_executive_brief, view_news, create_news, review_news, verify_news, map_upt, view_map, view_ai_assistant, view_weekly_trends, manage_cases, link_news_to_cases, generate_reports, edit_report_drafts, view_reports, download_reports, view_alerts, view_action_items, upload_attachments`

**news_data_operator (10)**: `view_dashboard, view_executive_brief, view_news, create_news, edit_own_news, validate_news_metadata, view_sync, run_sync, view_duplicate_news, upload_attachments`

**field_verification_officer (10)**: `view_dashboard, view_executive_brief, view_assigned_cases, view_field_assignments, submit_field_reports, upload_field_evidence, update_field_assignment, view_own_field_reports, view_action_items, update_action_items`

**evaluation_recommendation_analyst (16)**: `view_dashboard, view_executive_brief, view_news, view_cases, view_field_reports, analyze_cases, manage_recommendations, assess_follow_up, generate_reports, edit_report_drafts, view_reports, download_reports, view_weekly_trends, view_action_items, manage_action_items, update_action_items`

**super_admin**: `{"*"}` — `has_permission()` selalu `True`; `permissions_for()` menambahkan `ADMIN_ONLY`.

**ADMIN_ONLY (8)**: `manage_users, manage_settings, view_audit_logs, view_system_health, manage_system_health, manage_integrations, manage_backups, manage_roles`

### Alias izin lama → izin V6 (`PERMISSION_ALIASES`, 20 entri)
`view_warning`→`view_alerts` · `use_ai`→`view_ai_assistant` · `view_data`→`view_news` · `export_reports`→`download_reports` · `analyze_news`→`review_news` · `edit_news`→`review_news` · `delete_news`→`verify_news` · `archive_news`→`verify_news` · `manage_coordinates`→`manage_settings` · `manage_sync`→`run_sync` · `view_audit`→`view_audit_logs` · `manage_scoped_users`→`manage_users` · `view_analytics`→`view_weekly_trends` · `manage_follow_up`→`manage_recommendations` · `manage_master_data`→`manage_settings` · `manage_roles`→`manage_users` · `manage_watchlist`→`view_alerts` · `view_all`/`view_kanwil`/`view_upt`→`view_news`

### Matriks Peran × Halaman

| Halaman | Pimpinan | Analis Media | Operator | Petugas Lapangan | Analis Evaluasi | Super Admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Dashboard | Baca (filter verified) | Baca | Baca (hanya miliknya) | Baca | Baca | Penuh |
| Warning News | Baca | Baca | — | — | — | Penuh |
| Peta Indonesia | Baca | Baca | — | — | — | Penuh |
| AI Assistant | Baca | Baca | — | — | — | Penuh |
| Input Berita | — | Tulis + klasifikasi | Tulis (klasifikasi read-only) | — | — | Penuh |
| Pusat Telaah | — | **Tulis + Setuju** | — | — | — | Penuh |
| Pemetaan UPT | — | Tulis | — | — | — | Penuh |
| Pusat Data Berita | Baca (filter) | Baca + Tulis | Baca+Tulis (miliknya, status pending) | — | Baca | Penuh |
| Laporan Operasional | Baca + Unduh + Kirim TG | Baca + Unduh | — | — | Baca + Unduh | Penuh |
| Briefing Harian | Baca | Baca | Baca | Baca | Baca | Penuh |
| Tren Mingguan | Baca | Baca | — | — | Baca | Penuh |
| Kasus Intelijen | Baca | **Kelola penuh** | — | — | Baca | Penuh |
| Laporan Intelijen | Baca + **Setuju** + **Publikasi** | Buat + Edit draf | — | — | Buat + Edit draf | Penuh |
| Keputusan Pimpinan | **Putuskan** | — | — | — | — | Penuh |
| Verifikasi Lapangan | — | (semua, via manage_cases) | — | **Tulis (miliknya)** | — | Penuh |
| Evaluasi & Rekomendasi | — | — | — | — | **Tulis** | Penuh |
| Tindak Lanjut | Baca + Kelola | Baca | — | Baca + Update | Baca + Kelola + Update | Penuh |
| Manajemen Pengguna | — | — | — | — | — | **Penuh** |
| Manajemen Peran | — | — | — | — | — | **Penuh** |
| Koordinat UPT | — | — | — | — | — | **Penuh** |
| Sinkronisasi Spreadsheet | — | — | **Baca + Jalankan** | — | — | Penuh |
| Audit Aktivitas | — | — | — | — | — | **Baca** |
| Pengaturan | — | — | — | — | — | **Penuh** |
| Kesehatan Sistem | — | — | — | — | — | **Baca** |

**Catatan penting: tidak ada izin hapus permanen.** `delete_rows()` di `services/database.py` selalu melempar `RuntimeError`. Semua penghapusan berupa soft-delete/arsip.

### Pembatasan data baris (row-level scoping)

`scope_news(data, user, all_upt)`:
1. Tanpa `view_news` → dataframe kosong.
2. `assigned_upt` terisi → filter `nama_upt` (case-insensitive).
3. Selain itu `assigned_kanwil` terisi → filter kolom `kanwil`; bila tidak ada, resolve daftar UPT dari master lalu filter `nama_upt`.
4. Peran `news_data_operator` tambahan: hanya baris dengan `created_by == username` ATAU `nama_petugas == full_name`. Bila kedua kolom tidak ada → hasil kosong.

`can_edit_news(user, row)`: super_admin → True; media analyst → cek `review_news`; operator → harus pemilik **dan** status ∈ `{Belum Ditelaah, Perlu Koreksi, Draft, Diajukan, Perlu Perbaikan}`; peran lain → False.

---

## 3. ALUR STATUS

### 3.1 Status Berita (`status_verifikasi`)

**WORKFLOW_STATUSES**: `Belum Ditelaah`, `Perlu Koreksi`, `Terverifikasi`, `Tidak Valid`, `Diarsipkan`

**STATUS_ALIASES** (data lama): `Draft`→Belum Ditelaah · `Diajukan`→Belum Ditelaah · `Sedang Diperiksa`→Belum Ditelaah · `Perlu Perbaikan`→Perlu Koreksi · `Ditolak`→Tidak Valid

**ALLOWED_TRANSITIONS**:
| Dari | Ke |
|---|---|
| Belum Ditelaah | Terverifikasi, Perlu Koreksi, Tidak Valid, Diarsipkan |
| Perlu Koreksi | Belum Ditelaah, Terverifikasi, Tidak Valid, Diarsipkan |
| Terverifikasi | Perlu Koreksi, Tidak Valid, Diarsipkan |
| Tidak Valid | Belum Ditelaah, Diarsipkan |
| Diarsipkan | Belum Ditelaah |

**Aturan aktor** (`change_news_status`):
- `REVIEWER_ROLES = {super_admin, media_intelligence_analyst}` wajib untuk semua transisi menuju Terverifikasi/Perlu Koreksi/Tidak Valid/Diarsipkan, dan untuk pemulihan dari Tidak Valid/Diarsipkan → Belum Ditelaah.
- Pengajuan ulang Perlu Koreksi → Belum Ditelaah boleh oleh `{super_admin, media_intelligence_analyst, news_data_operator}`.
- Status tujuan sama dengan status saat ini → `ValueError`.
- `Perlu Koreksi` dan `Tidak Valid` wajib punya `reason` atau `note` non-kosong.

**Efek samping per status** (semua timestamp UTC ISO):
- → **Belum Ditelaah**: set `submitted_by`, `submitted_at`; null-kan `reviewed_by/at`, `verified_by/at`, `archived_by/at`; kosongkan `rejection_reason`.
- → **Perlu Koreksi**: set `reviewed_by/at`; null-kan `verified_by/at`; isi `rejection_reason`.
- → **Terverifikasi**: set `reviewed_by/at` DAN `verified_by/at` (aktor sama); kosongkan `rejection_reason`, `archived_by/at`.
- → **Tidak Valid**: set `reviewed_by/at`; null-kan `verified_by/at`; isi `rejection_reason`.
- → **Diarsipkan**: set `archived_by`, `archived_at`.
- Selalu: `status_sebelumnya` = status lama, `review_note` disimpan.
- Insert ke `berita_status_history` (jika tabel ada; kegagalan diabaikan diam-diam).
- `log_action("status_change", "berita", …)`.

**Derived state `warning_state(row)`**: `none` bila urgensi ∉ {tinggi, kritis} ATAU status ∈ {Tidak Valid, Diarsipkan}; `verified` bila status == Terverifikasi; selain itu `preliminary`.

### 3.2 Status Kasus (`CASE_STATUSES`, 12)
`Terdeteksi` → `Dalam Telaah Media` → `Menunggu Keputusan Tindak Lanjut` → `Ditugaskan ke Tim Lapangan` → `Verifikasi Lapangan Berlangsung` → `Menunggu Laporan Lapangan` → `Dalam Analisis` → `Menunggu Keputusan Pimpinan` → `Dalam Tindak Lanjut UPT` → `Dalam Pemantauan` → `Selesai` → `Dibuka Kembali`

**Transisi otomatis** (tidak ada validasi transisi eksplisit — status diubah sebagai efek samping):
| Aksi | Fungsi | Status kasus menjadi | Aktor |
|---|---|---|---|
| Kasus dibuat | `create_case` | `Dalam Telaah Media` | manage_cases |
| Penugasan lapangan dibuat | `create_field_assignment` | `Ditugaskan ke Tim Lapangan` | manage_cases |
| Laporan lapangan dikirim | `submit_field_report` | `Dalam Analisis` | field officer |
| Analisis disimpan | `save_case_analysis` | `Menunggu Keputusan Pimpinan` | analyze_cases |
| Keputusan pimpinan | `decide_case` | sesuai peta di bawah | decide_cases |

**Peta keputusan (`decision_map`)** — `(status_rekomendasi, status_kasus)`:
| Keputusan | Rekomendasi → | Kasus → |
|---|---|---|
| Disetujui | Disetujui | Dalam Tindak Lanjut UPT |
| Perlu Penyempurnaan | Perlu Penyempurnaan | Dalam Analisis |
| Ditolak | Ditolak | Dalam Analisis |
| Dipantau | Disetujui | Dalam Pemantauan |
| Selesai | Selesai | Selesai |

Efek samping `decide_case`: update rekomendasi terpilih (`decided_by`, `decided_at`, `decision_note`), insert `case_decisions`, update kasus, audit `case.decision`.

### 3.3 Status Penugasan Lapangan (`FIELD_STATUSES`, 12)
`Belum Ditugaskan`, `Ditugaskan`, `Diterima Tim`, `Persiapan`, `Perjalanan`, `Pemeriksaan Berlangsung`, `Menunggu Dokumen UPT`, `Draf Laporan`, `Laporan Dikirim`, `Perlu Perbaikan`, `Selesai`, `Dibatalkan`. Awal selalu `Ditugaskan`; otomatis `Laporan Dikirim` saat laporan dikirim. Transisi lain bebas via dropdown.

### 3.4 Status lain
- **Laporan mingguan**: `Draf Sistem` → `Ditelaah Analis` → `Diverifikasi` → `Disetujui` → `Dipublikasikan`. Efek: Diverifikasi set `verified_by/at`; Disetujui set `approved_by/at`; Dipublikasikan set `published_by/at` + `locked_at`.
- **Rekomendasi**: awal `Diusulkan` → Disetujui / Perlu Penyempurnaan / Ditolak / Selesai.
- **Action item**: `Belum Dimulai`, `Dalam Proses`, `Menunggu Pihak Lain`, `Tertunda`, `Selesai`, `Dibatalkan`. Progres di-clamp 0–100; status `Selesai` atau progres ≥100 memaksa `progress_percent=100` + `completed_at`.
- **Klasifikasi temuan** (7): Berita sesuai fakta / sebagian sesuai fakta / tidak sesuai fakta / Kejadian benar tetapi konteks media keliru / Kejadian lama kembali diberitakan / Belum dapat disimpulkan / Memerlukan pemeriksaan tambahan.
- **Aktualitas kasus** (4): Kejadian Baru, Perkembangan Kasus Lama, Konten Lama Kembali Viral, Tidak Dapat Dipastikan.

**Penghitung kasus otomatis** (`refresh_case_counters`): `article_count`, `media_count` (distinct media case-insensitive), `negative_count`, `highest_urgency` (rank Rendah=1…Kritis=4). Dipanggil setiap `link_news_to_case`.

---

## 4. MESIN LAPORAN

Ada **dua mesin laporan terpisah dan tidak terhubung**.

### 4.1 Mesin Mingguan/Intelijen (`report_service.py` + `trend_service.py`)

**Sumber data**: `fetch_news_for_analysis()` → tabel `berita`, max 20.000 baris, 17 kolom (`id, created_at, detected_at, tanggal_publikasi, judul, nama_upt, media, sentimen, urgensi, link, link_normalized, kategori, ringkasan, raw_analysis, status_verifikasi, case_id, issue_group_key`).

**Pipeline `build_weekly_snapshot(rows, start, end)`**:
1. `normalize_news_frame` — isi default, normalisasi URL, hitung `_event_at` dari prioritas `detected_at` → `tanggal_publikasi` → `created_at`, konversi ke tanggal WIB, buat `_title_key` (huruf kecil, hapus non-alfanumerik, buang token ≤3 huruf dan 24 stopword termasuk `lapas`, `rutan`, `pemasyarakatan`).
2. `filter_period` untuk periode berjalan **dan** periode sebelumnya (panjang sama, berakhir sehari sebelum `start`).
3. `deduplicate_publications` — dedup `link_normalized`; baris tanpa link dedup by `(judul, media, _event_date)`.
4. `_cluster_issue_keys` — pengelompokan isu per UPT: pakai `case_id`/`issue_group_key` bila ada (`explicit:`), selain itu klaster greedy dengan ambang **SequenceMatcher ≥ 0.58 ATAU token overlap ≥ 0.62**.
5. Pisahkan negatif → terpetakan vs belum terpetakan (`UNMAPPED_UPT_VALUES = {"", "belum teridentifikasi", "tidak diketahui", "null", "none"}`).
6. `aggregate_upt(mapped_negative)` menghasilkan kolom: **UPT, Jumlah Publikasi, Jumlah Media, Jumlah Isu, Berita Negatif, Urgensi Tertinggi, Isu Utama**. Diurutkan Berita Negatif → Jumlah Publikasi → Jumlah Media (desc).

**11 metrik snapshot**: `total_publications, negative_publications, mapped_negative_publications, unmapped_negative_publications, unique_media, negative_upt_count, issue_count, high_critical_count, previous_negative_publications, negative_change_percent, top_two_concentration_percent`.
`negative_change_percent` = `None` bila periode sebelumnya nol dan sekarang >0; `0.0` bila keduanya nol.

**Narasi**: `build_ai_narrative` → jika `OPENAI_API_KEY` ada, kirim payload ringkas (period, previous_period, metrics, top_upt, upt_table[:15], urgency_distribution, daily_trend) ke model default **`gpt-5-mini`**. Coba `client.responses.create` dulu, fallback `chat.completions.create` (temperature 0.2). Instruksi mewajibkan JSON valid dengan kunci `executive_summary, trend_analysis, priority_analysis, recommendations (array 3–5), limitations` dan melarang mengubah jumlah publikasi menjadi jumlah kejadian. Sumber dicatat sebagai `openai`. Gagal apapun → `build_local_narrative` dengan sumber `local_fallback_after_ai_error`.

`build_local_narrative` menyusun kalimat template deterministik. Tiga rekomendasi baku, plus rekomendasi tambahan di posisi pertama bila ada berita tinggi/kritis: *"Tetapkan penanggung jawab dan tenggat tindak lanjut untuk seluruh berita tinggi atau kritis."*

**Struktur PDF (`generate_pdf`, reportlab, A4 portrait, margin 1.5/1.5/1.4/1.4 cm)** — urutan:
1. Judul terpusat "Laporan Intelijen Pemberitaan Mingguan"
2. "Periode {start} sampai {end}"
3. Ringkasan Eksekutif
4. Analisis Tren
5. Analisis Prioritas
6. Tabel Indikator (9 baris, header `#E8E8E8`)
7. *Page break*
8. Rekap Publikasi Negatif per UPT (max **30** baris, 7 kolom)
9. Rekomendasi (bernomor)
10. Catatan Batasan

**Struktur DOCX (`generate_docx`, python-docx)** — sama, dengan perbedaan: tabel UPT max **50** baris, ditambah bagian **"Lampiran Publikasi Prioritas"** (max 20 berita: judul bold, UPT/Media/Urgensi, Link). Header setiap section: `"CYBER-INTELPAS"`; footer: `"Dokumen otomatis, wajib diverifikasi sebelum digunakan sebagai laporan resmi."`

**Struktur PPTX (`generate_pptx`, 13.333×7.5 inci / 16:9)** — 8 slide: Cover, Executive Summary, KPI (6 kotak grid 3×2), Tren Publikasi Harian (LINE_MARKERS), UPT Eksposur Negatif Tertinggi (BAR_CLUSTERED, top 10, label dipotong 35 karakter), Analisis Tren, Isu Prioritas, Rekomendasi, Catatan Validasi.

**Penamaan berkas**: `Laporan_Intelijen_{start}_{end}.pdf` / `.docx`, `Bahan_Paparan_{start}_{end}.pptx` (format tanggal ISO).

### 4.2 Mesin Harian (`pdf_report_service.py`)

Jinja2 + WeasyPrint, A4 portrait margin 15mm, font `Helvetica Neue/Arial` 10pt. Fungsi `create_daily_pdf_bytes(df_news, periode_label)`.

Struktur berurutan:
1. **Kop**: "Direktorat Jenderal Pemasyarakatan" / "LAPORAN HARIAN MONITORING PEMBERITAAN UPT PEMASYARAKATAN" / "Periode: {label} | Sumber Data: Command Center Cyber-Intelpas"
2. **Tabel statistik 5 sel**: Total Berita, Sentimen Positif, Sentimen Negatif, % Positif, % Negatif (2 desimal)
3. **Sebaran Pemberitaan Bersentimen Negatif** — group by `nama_upt`
4. *Page break* → **LAMPIRAN TEMUAN PEMBERITAAN HARIAN** (No, Media, Judul berhyperlink, Sentimen badge, UPT)
5. *Page break* → **DETAIL KLIPING & RINGKASAN EKSEKUTIF ISU NEGATIF** — kartu per berita negatif

**Penamaan**: `Laporan_Harian_CyberIntelpas_{YYYY-MM-DD}.pdf` (halaman) / `{YYYYMMDD}.pdf` (cron job). Excel: `laporan_simberpas_{ISO}.xlsx`, CSV: `laporan_simberpas_{ISO}.csv`, mingguan Excel: `Rekap_Mingguan_{ISO}.xlsx`.

### 4.3 Ekspor Excel (`export_service.py`)
`excel_bytes(df, sheet_name)` — openpyxl, nama sheet dipotong 31 karakter, `freeze_panes="A2"`, auto-filter penuh, lebar kolom = min(maks panjang+2, 45) dengan minimum 10. Semua datetime tz-aware dikonversi ke Asia/Jakarta lalu di-*naive*-kan (Excel tidak mendukung tz). Kolom yang dipaksa diperiksa: `created_at, updated_at, tanggal_publikasi, last_login`.

### 4.4 Penjadwalan
| Workflow | Cron (UTC) | Waktu WIB | Skrip |
|---|---|---|---|
| `daily_report.yml` | `15 22 * * *` | 05:15 setiap hari | `scripts/auto_daily_job.py` |
| `cyberintelpas_weekly_report.yml` | `0 23 * * 0` | Senin 06:00 | `scripts/generate_weekly_report.py` |
| `cyberintelpas_sheet_sync.yml` | `0 * * * *` | tiap jam | curl → Edge Function |

`generate_weekly_report.py`: periode = 7 hari berakhir **kemarin** (WIB). Idempoten — jika sudah ada laporan periode sama berstatus `Draf Sistem`/`Ditelaah Analis`, snapshot & narasi diperbarui (audit `weekly_report.scheduled_refresh`); jika sudah lewat tahap draf, tidak diubah; jika belum ada, buat baru. User sistem: `weekly-report-scheduler` dengan role `super_admin`.

`auto_daily_job.py`: label periode `"{kemarin} (17.00 WIB) - {hari ini} (07.00 WIB)"`. Render PDF, kirim ke Telegram. Bila render gagal → kirim pesan `❌ [SYSTEM ERROR]` ke Telegram lalu `return`.

---

## 5. TELEGRAM

`services/telegram_service.py` — satu arah (kirim saja), tidak ada webhook/bot listener.

**Konfigurasi** (`get_telegram_config`), urutan prioritas:
1. Env var `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`
2. Env var `STREAMLIT_SECRETS_TELEGRAM_BOT_TOKEN` / `..._CHAT_ID`
3. `st.secrets["telegram"]["bot_token"]` / `["chat_id"]`

**Endpoint**:
| Fungsi | Endpoint | Timeout | Payload |
|---|---|---|---|
| `send_telegram_message` | `POST https://api.telegram.org/bot{token}/sendMessage` | 10 s | JSON: `chat_id, text, parse_mode` (default `HTML`), `disable_web_page_preview: false` |
| `send_telegram_document` | `POST https://api.telegram.org/bot{token}/sendDocument` | 30 s | multipart: `data={chat_id, caption, parse_mode}`, `files={"document": (filename, bytes, "application/pdf")}` |

**Format caption laporan harian** (HTML):
```
🔴 <b>[LAPORAN HARIAN MONITORING PEMBERITAAN]</b>
📅 <b>Periode:</b> {periode}
🏛️ <b>Instansi:</b> Ditjen Pemasyarakatan

📊 <b>RINGKASAN STATISTIK:</b>
🔹 <b>Total Berita:</b> {n} Berita
✅ <b>Sentimen Positif:</b> {n} Berita
🔻 <b>Sentimen Negatif:</b> {n} Berita

📎 <i>Dokumen PDF resmi (Dashboard, Tabel Temuan, & Kliping) terlampir di atas.</i>
```

**Format critical alert** (`send_breaking_alert_telegram`, menerima dict berita):
```
🚨 <b>[CRITICAL INTEL ALERT — CYBER-INTELPAS]</b>
🏛️ <b>UPT:</b> … 📰 <b>Media:</b> … ⚡ <b>Sentimen / Urgensi:</b> …
📝 <b>Judul Berita:</b> <i>…</i>
💡 <b>Ringkasan Kronologi & Bukti:</b> …
🔗 <a href="{link}">Baca Sumber Asli</a>
```

**Penanganan galat**: token/chat_id kosong → `logger.warning` + `return False` (senyap bagi pengguna). HTTP ≠ 200 → `logger.error(response.text)` + `return False`. Exception → `logger.error` + `return False`. **Tidak ada retry, tidak ada backoff, tidak ada dead-letter queue.**

**Titik pemanggilan**: halaman Laporan Operasional (tombol manual) dan `auto_daily_job.py` (cron). `send_breaking_alert_telegram` **tidak pernah dipanggil dari mana pun** — kode mati.

---

## 6. KLASIFIKASI

### 6.1 Aturan berbasis kata kunci (`services/classification.py::classify_rule_based`)

Input di-`casefold()`, dicocokkan sebagai substring sederhana. Pencocokan **berhenti pada kategori pertama yang cocok** (urutan dict penting).

**Peta kategori → subkategori → kata kunci** (urutan evaluasi):
1. **Keamanan dan Ketertiban**: Pelarian [`kabur`, `melarikan diri`, `pelarian`] · Kerusuhan [`kerusuhan`, `rusuh`, `bentrok`, `penyanderaan`] · Narkotika [`narkoba`, `narkotika`, `sabu`, `ganja`] · Barang Terlarang [`barang terlarang`, `handphone`, `ponsel`, `senjata`] · Penggeledahan/Razia [`penggeledahan`, `razia`]
2. **Pembinaan**: Kemandirian [`keterampilan`, `pelatihan kerja`, `produksi`, `umkm`] · Kepribadian [`keagamaan`, `kerohanian`, `pendidikan`, `konseling`]
3. **Pelayanan**: Kunjungan [`kunjungan`] · Integrasi [`pembebasan bersyarat`, `cuti bersyarat`, `integrasi`] · Remisi [`remisi`] · Kesehatan [`kesehatan`, `rumah sakit`, `sakit`]
4. **SDM**: Kepegawaian [`pegawai`, `petugas`, `mutasi`, `promosi`, `disiplin`]
5. **Sarana dan Prasarana**: Bangunan/Fasilitas [`renovasi`, `pembangunan`, `fasilitas`, `sarana`]

Default: `("Lainnya", "Umum")`.

**Sentimen** (prioritas negatif → positif → netral):
- Negatif [13]: `kabur, meninggal, kerusuhan, kebakaran, narkoba, narkotika, penyelundupan, pungli, kekerasan, pelanggaran, korupsi, pemerasan, suap`
- Positif [9]: `berhasil, prestasi, penghargaan, inovasi, produktif, pelatihan, pembinaan, kerja sama, peningkatan`
- Selain itu: `Netral`

**Urgensi**:
- Tinggi [7]: `kabur, kerusuhan, kebakaran, meninggal, penyanderaan, penembakan, darurat`
- Sedang [8]: `narkoba, narkotika, penyelundupan, pungli, kekerasan, penggeledahan, razia, pelanggaran`
- Selain itu: `Rendah` — **nilai `Kritis` tidak pernah dihasilkan oleh mesin aturan.**

**Tingkat perhatian**: `Tinggi` bila urgensi Tinggi; `Sedang` bila sentimen Negatif atau urgensi Sedang; selain itu `Rendah`.

Output selalu: `kategori, subkategori, sentimen, urgensi, tingkat_perhatian, kata_kunci` (maks 8), `ai_provider="rules"`, `ai_confidence=0.62` (nilai konstan, bukan skor sebenarnya).

### 6.2 Pipeline analisis (`news_service.analyze_news`)
1. `read_public_page(url)` — deteksi platform. Instagram/Facebook/TikTok langsung dikembalikan dengan `status_baca = "PERLU CEK MANUAL"` (tidak di-scrape). Selain itu HTTP GET 20 s dengan User-Agent Chrome, parse BeautifulSoup: judul dari `og:title` → `twitter:title` → `<title>`; media dari `og:site_name` → hostname; tanggal dari `article:published_time` → `date` → `pubdate`; ringkasan dari `og:description` → `description` → `twitter:description`. Status baca: `BERHASIL` / `GAGAL MEMBACA`.
2. Gabungkan judul + ringkasan + teks manual → `classify_rule_based`.
3. Panggil `ai_service.analyze_news_with_ai` di dalam `try/except: pass` — hasil AI **menimpa** hasil aturan.

### 6.3 Integrasi AI (`services/ai_service.py`)
Client OpenAI dibuat hanya bila `cfg.has_openai` (API key **dan** model terisi dan model tidak mengandung `"YOUR_"`). Semua panggilan memakai `client.responses.create(model, instructions, input)`.

| Fungsi | Instruksi sistem | Output | Fallback |
|---|---|---|---|
| `analyze_news_with_ai` | "Anda adalah analis media Pemasyarakatan Indonesia. Jawab akurat dan hanya berdasarkan teks yang diberikan." Minta JSON murni dengan 9 kunci; sentimen ∈ Positif\|Netral\|Negatif\|Campuran; urgensi ∈ Rendah\|Sedang\|Tinggi\|Kritis; `ai_confidence` 0–1 | dict + `ai_provider = "openai:{model}"` | `{}` |
| `executive_summary` | Briefing Bahasa Indonesia maks 120 kata, sertakan tingkat perhatian RENDAH/SEDANG/TINGGI + satu rekomendasi | (teks, attention, recommendation, provider) | `deterministic_summary()` |
| `assistant_answer` | "Jawab sebagai AI Assistant SIMBERPAS… cantumkan ID sumber seperti [S1]. Jangan mengarang sumber atau fakta." Konteks: 25 record sumber | (jawaban, provider, sumber terpakai) | `rule_based_answer()` |

`_extract_json` membersihkan pagar markdown lalu regex `\{.*\}` (greedy, DOTALL). `rule_based_answer` mendeteksi kata kunci pertanyaan: `minggu`/`7 hari`, `hari ini`, `negatif`, `urgensi`/`prioritas`, `upt`+`terbanyak|paling|aktif`, `platform`, `kategori`/`isu`.

---

## 7. PEMETAAN UPT

### 7.1 `upt_mapping_service.suggest_upt(text, upt_df, limit=5)`

**Normalisasi** (`_normalize`): casefold, ekspansi singkatan via regex word-boundary — `lapas`→"lembaga pemasyarakatan", `rutan`→"rumah tahanan negara", `lpka`→"lembaga pembinaan khusus anak", `bapas`→"balai pemasyarakatan", `karutan`→"rumah tahanan negara", `kalapas`→"lembaga pemasyarakatan". Lalu hapus non-alfanumerik, ringkas spasi.

**Tokenisasi** (`_tokens`): token panjang >2 dan bukan `_GENERIC_WORDS` (18 kata: `kelas, i, ii, iia, iib, iii, negara, lembaga, pemasyarakatan, rumah, tahanan, khusus, anak, perempuan, narkotika, terbuka, balai, pembinaan, penempatan, sementara`).

**Rumus skor**:
```
exact       = nama_ternormalisasi ada sebagai substring di haystack
overlap     = |token_haystack ∩ token_nama| / max(|token_nama|, 1)
sequence    = SequenceMatcher(nama_ternormalisasi, haystack).ratio()
location_hit= ada token lokasi yang match \btoken\b di haystack
score       = 1.0 jika exact
              else min(0.99, overlap*0.72 + sequence*0.18 + (0.10 jika location_hit))
```
Ambang buang: `score < 0.35`. Alasan: `"Nama UPT ditemukan utuh dalam teks"` atau `"Kemiripan nama, jenis UPT, dan lokasi"`.

**Teks sumber** (`news_text`): gabungan `judul + ringkasan + raw_analysis + caption_manual + catatan + media`.

**Penerapan** (`apply_mapping`): update `nama_upt` + tulis `catatan` = `"UPT dipetakan melalui {method}. Confidence {n}%."`, audit `map_upt`.

### 7.2 Pencocokan di crawler (`matchUpt_` di .gs / Edge Function)
Sangat berbeda dan jauh lebih primitif: normalisasi ke huruf kecil + hapus non-alfanumerik, lalu **substring exact dengan padding spasi**. Daftar UPT diurut panjang key desc (longest-match-first). Tidak ada fuzzy, tidak ada ekspansi singkatan.

### 7.3 Layanan geo (`geo_service.py`)
- `PROVINCE_CENTROIDS`: 38 provinsi (termasuk 4 provinsi Papua baru).
- `ALIASES`: 5 entri (`Bangka Belitung`, `DI Yogyakarta`, `D.I Yogyakarta`, `DIY`, `Jakarta`).
- `enrich_province_coordinates`: UPT tanpa lat/lon mendapat centroid provinsi + `coordinate_quality = "Pusat provinsi—perlu verifikasi"`.
- `build_upt_status`: hitung 11 counter per UPT, tentukan `marker_status` dengan prioritas **critical → negative → neutral → positive → draft → none** (hanya berita **Terverifikasi** menentukan warna; status Tidak Valid & Diarsipkan dikecualikan dari `jumlah_berita`).
- `MARKER_META`: critical `#650000` (pulse 0.55s) · negative `#D00000` (pulse 0.9s) · draft `#808080` (pulse 2.4s) · neutral `#D8C3A5` · positive `#16A34A` · none `#2563EB`. Badge peringatan awal `#650000`.

### 7.4 Kelemahan yang teridentifikasi
1. **Dua algoritma berbeda dan tidak konsisten** — crawler pakai substring exact, aplikasi pakai fuzzy. Berita hasil crawl yang tidak match masuk dengan `nama_upt = null` dan catatan "perlu dipetakan oleh analis", padahal `suggest_upt` mungkin bisa menemukannya.
2. **Kompleksitas O(n) per berita** — `suggest_upt` menjalankan `SequenceMatcher` terhadap **semua 492 UPT** untuk setiap berita; halaman Pemetaan UPT memproses hingga 50 berita = ~24.600 perbandingan per render.
3. **Bobot skor tidak dinormalisasi** — `overlap*0.72 + sequence*0.18 + 0.10` maksimum hanya 1.00 bila semua sempurna; `sequence` selalu kecil karena membandingkan nama UPT pendek dengan haystack panjang (artikel penuh), sehingga komponen ini praktis tidak berkontribusi. Skor efektif ≈ `overlap*0.72 + 0.10`.
4. **Ambang 0.35 rapuh** — dengan rumus di atas, butuh overlap ≥ 0.35 tanpa location hit; nama UPT satu-token setelah pembuangan generic words (misalnya "Lapas Kelas IIA Banda Aceh" → token efektif `{banda, aceh}`) mudah salah cocok dengan artikel yang menyebut kota tanpa menyebut UPT.
5. **Tidak memakai kolom `location_hint`** yang tersedia di `master_upt_coordinates.csv`.
6. **Tidak ada penanganan homonim** — "Lapas Kelas IIA Jakarta" vs "Rutan Kelas I Jakarta Pusat" hanya dibedakan oleh token yang sebagian besar sudah dibuang sebagai generic.
7. **Nilai UPT tak terpetakan tidak konsisten** antar modul: `pemetaan_upt.py` memakai `{"", "Tidak diketahui", "None", "nan"}`, `trend_service` memakai `{"", "belum teridentifikasi", "tidak diketahui", "null", "none"}`, `pusat_telaah.py` memakai `{"", "tidak diketahui", "belum teridentifikasi", "none", "nan", "-"}`. Akibatnya berita ber-`nama_upt = "Belum Teridentifikasi"` **tidak muncul** di antrean Pemetaan UPT tetapi dihitung sebagai belum terpetakan di laporan.
8. **`apply_mapping` menimpa kolom `catatan`** — catatan analis sebelumnya hilang.
9. **Merge master + database** (`_merge_upt_with_master`) berbasis nama, bukan ID — pergantian nama UPT membuat baris ganda.

---

## 8. CRAWLER

**Penting: `CyberIntelPAS_Sync.gs` bukan crawler.** Ia adalah **sinkronisator Google Spreadsheet → Supabase**. Crawler berita yang sebenarnya berada di luar repositori dan hanya menulis ke Spreadsheet — dinyatakan eksplisit di halaman Sinkronisasi Spreadsheet: *"Crawler lama: Tetap aktif dan tidak diubah"*. **Tidak ada daftar RSS maupun daftar kata kunci pencarian di dalam repositori ini.**

### 8.1 Sumber data
- Spreadsheet ID default: `1uAA7KfJVnsgUbhKDKfsnYwDYtOEkN1rgsXahbnxPy54`, tab `Sheet1`.
- Jalur aktif saat ini (V5.6): **Edge Function `sheet-sync`** membaca CSV publik `https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0-o2qi5vHXxjnwxPAB4wxtAo8ZdmmVjG-wMvOLSXKjNWXOLCyyR0-1F4aOUn9SnFY8NtFvZeSzaft/pub?output=csv` (read-only), dengan parser CSV RFC-4180 sendiri.
- Jalur lama (Apps Script) memakai `SpreadsheetApp.openById` dengan Service Role Key.

### 8.2 Penjadwalan
| Mekanisme | Interval |
|---|---|
| Apps Script trigger (`setupCyberIntelPasSync`) | tiap **5 menit** |
| GitHub Actions `cyberintelpas_sheet_sync.yml` | tiap **jam** (`0 * * * *`) |
| Health check `_check_sheet_sync` | menganggap "Peringatan" bila sinkron terakhir >20 menit |
| pg_cron (`sql/setup_v5_6_public_csv_cron.sql`, job `sheet-sync-auto`) | opsional |
| Webhook `doPost` | manual, dilindungi `SYNC_TOKEN` |

*(Ketiga angka ini saling bertentangan — lihat bagian 10.)*

### 8.3 Pemetaan kolom Spreadsheet (alias, case-insensitive, cocok exact atau prefix)
| Kunci | Alias header |
|---|---|
| `detected` | "waktu terdeteksi", "tanggal terdeteksi", "waktu deteksi" |
| `title` **(wajib)** | "judul berita", "judul" |
| `media` | "sumber / portal", "sumber/portal", "sumber", "portal", "media" |
| `risk` | "tingkat risiko", "risiko", "urgensi" |
| `analysis` | "hasil analisis & rekomendasi", "hasil analisis", "analisis & rekomendasi", "analisis" |
| `url` **(wajib)** | "url / link artikel", "url/link artikel", "link artikel", "url", "link" |
| `followup` | "status tindak lanjut", "status tindak lanjut lc", "status tindak lanjut berita" |
| `officer` | "petugas respon", "petugas respons", "petugas" |
| `responseTime` | "waktu respon", "waktu respons" |

Kolom `title` atau `url` hilang → seluruh sinkronisasi gagal. Baris tanpa judul **dan** tanpa url → dilewati.

### 8.4 Kolom yang ditulis ke tabel `berita` (37 kolom)
`nama_upt` (hasil matchUpt, boleh null) · `nama_petugas = "Sinkronisasi Google Spreadsheet"` · `created_by = "google_sheet_sync"` · `link`, `link_normalized` · `judul` (fallback "Tanpa judul") · `media` (fallback hostname → "Tidak diketahui") · `platform` · `tanggal_publikasi = detected` · `detected_at` · `kategori = "Lainnya"` · `subkategori = "Umum"` · **`sentimen = "Tidak diketahui"`** · `urgensi = risk` · `dampak = "UPT"` · `ringkasan` · `rekomendasi` · `raw_analysis` · `caption_manual = raw_analysis` · `status_baca = "SINKRONISASI OTOMATIS"` · `catatan` (pesan bila UPT tidak dikenali) · **`status_verifikasi = "Belum Ditelaah"`** · `tingkat_perhatian = risk` · `ai_provider = "spreadsheet_source"` · `source_type = "google_sheet"` · `source_external_id` · `source_sheet_id`, `source_sheet_name`, `source_row_number` · `source_updated_at`, `last_synced_at` · `sync_status = "synced"`, `sync_error = ""` · `content_hash` · `status_tindak_lanjut`, `petugas_respon`, `waktu_respon` · `updated_at`.

### 8.5 Logika penilaian risiko
```
normalizeRisk_(value):
  teks.toLowerCase() mengandung "kritis"  → "Kritis"
  mengandung "tinggi"                     → "Tinggi"
  mengandung "sedang"                     → "Sedang"
  selain itu                              → "Rendah"
```
Nilai risiko diambil **apa adanya dari Spreadsheet** (dihasilkan crawler eksternal) dan disalin ke `urgensi` **dan** `tingkat_perhatian`. Tidak ada penilaian risiko independen di sisi Supabase.

`parseAnalysis_` memisahkan blok teks dengan regex:
- `/ANALISIS\s*:\s*([\s\S]*?)(?:REKOMENDASI\s*:|$)/i` → `ringkasan`
- `/REKOMENDASI\s*:\s*([\s\S]*)$/i` → `rekomendasi`

### 8.6 Identitas & dedup
- `source_external_id = "gs:" + SHA256(lower(normalizedUrl || "detected|title|media"))`
- `content_hash = SHA256(detected|title|media|risk|rawAnalysis|url|followup|officer|responseTime)`
- Upsert: `POST /rest/v1/berita?on_conflict=source_type,source_external_id` dengan `Prefer: resolution=merge-duplicates,return=minimal`, batch 100 baris.
- Normalisasi URL menghapus `utm_*`, `fbclid`, `gclid`, `igsh`, `igshid`, trailing slash.

### 8.7 Logging (`sheet_sync_log`)
Insert saat mulai (`status = "Berjalan"`), patch saat selesai dengan `finished_at, status (Berhasil|Sebagian|Gagal), rows_seen, rows_inserted, rows_updated, rows_skipped, rows_failed, duration_ms, message, error_detail`. `Sebagian` bila ada baris gagal.

---

## 9. TEMA VISUAL

### Palet warna (`styles/executive.css`, CSS custom properties)
| Variabel | Nilai | Peran |
|---|---|---|
| `--sim-navy-950` | `#06182c` | latar tergelap, sidebar atas, hero |
| `--sim-navy-900` | `#0a2441` | logo login |
| `--sim-navy-800` | `#113a66` | sidebar bawah, tombol primary |
| `--sim-blue` | `#1769aa` | aksen utama |
| `--sim-gold` | `#d4a72c` | kicker panel, aksen dekoratif |
| `--sim-green` | `#16845b` | status baik / perhatian rendah |
| `--sim-amber` | `#cf7f0a` | perhatian sedang |
| `--sim-red` | `#c53a43` | perhatian tinggi |
| `--sim-muted` | `#667085` | teks sekunder |

Emas terang sidebar: `#f3d477`. Dot online: `#35d18b` dengan halo `rgba(53,209,139,.12)`.

**Warna marker peta** (`geo_service.MARKER_META`): `#650000` (critical), `#D00000` (negative), `#808080` (draft), `#D8C3A5` (neutral), `#16A34A` (positive), `#2563EB` (none).

**Warna PDF harian** (`pdf_report_service`): header `#1a365d`, header tabel `#2b6cb0`, positif `#2f855a`/badge `#c6f6d5` + `#22543d`, negatif `#c53030`/badge `#fed7d7` + `#742a2a`, judul kliping `#9b2c2c`, latar kartu `#fff5f5`, zebra `#f7fafc`.

### Tipografi
- Aplikasi: **Inter**, fallback `"Segoe UI", Arial, sans-serif`.
- PDF harian: `'Helvetica Neue', Arial, sans-serif` — base 10pt, h2 14pt, h3 11pt, tabel 8.5pt, meta 8pt.
- PDF mingguan: Helvetica / Helvetica-Bold (reportlab), tabel UPT 8pt.
- Bobot yang dipakai sangat tebal: 650, 750, 780, 800, 850, 900.

### Gaya visual
- **Sidebar**: gradien vertikal `#06182c → #113a66`, min-width 280px, semua teks putih, item nav `border-radius: 10px` dengan hover `rgba(255,255,255,.08)`.
- **Hero (`.sim-hero`)**: gradien 135° navy + radial highlight; `border-radius: 20px`; padding 1.45rem 1.65rem; shadow `0 16px 40px rgba(6,24,44,.18)`; ornamen lingkaran `::after` 250px dengan border emas 42px; judul `clamp(1.65rem, 3vw, 2.45rem)` letter-spacing `-.035em`.
- **KPI (`.sim-kpi`)**: grid 6 kolom, `border-radius: 15px`, min-height 115px, garis aksen kiri 4px berwarna `--accent`, nilai 1.62rem/850.
- **Panel (`.sim-panel`)**: `border-radius: 16px`, shadow halus, kicker emas uppercase letter-spacing `.085em`.
- **Kontrol**: tombol `border-radius: 10px`, min-height 41px (dinaikkan ke 44px untuk target sentuh), input/select/textarea `border-radius: 10px`.
- **Header aplikasi**: `backdrop-filter: blur(14px)`.
- **Responsif**: 6 kolom KPI → 3 (≤1200px) → 2 (≤800px) → 1 (≤520px).
- **Aksesibilitas**: `@media (prefers-reduced-motion: reduce)` mematikan animasi di CSS utama dan di `marker_css()`.
- **Mode gelap**: mengikuti tema bawaan Streamlit melalui `var(--st-background-color)`, `var(--st-text-color)`, `var(--st-secondary-background-color)`, dan `color-mix()`. Footer disembunyikan.

`styles/theme.py::inject_global_styles()` hanya membaca `executive.css` dan menyuntikkannya via `st.markdown(..., unsafe_allow_html=True)`. **Tidak ada objek tema Python; semua token warna hanya ada di CSS.**

---

## 10. DAFTAR HAL YANG RUSAK ATAU SETENGAH JADI

### Kritis (data salah / fitur tidak berfungsi)

**10.1 `auto_daily_job.py` menyuntikkan data palsu ke laporan resmi Telegram** (baris 38–59). Jika `fetch_news_df()` kosong atau gagal, skrip **membuat dua baris berita fiktif hardcoded** — "Lapas Perempuan Ambon Tunjukkan Tata Kelola Dapur Mahina" (Positif) dan "Polres Bintan Amankan Dua Tersangka Penyelundupan Sabu ke Lapas Tanjungpinang" (Negatif, lengkap dengan ringkasan detail) — lalu mengirimkannya sebagai laporan resmi ke Grup Telegram Pimpinan. Komentar di kode menyatakan tujuannya "agar workflow sukses berjalan & terkirim". **Ini adalah cacat paling serius dalam sistem.**

**10.2 Cron harian tidak akan pernah punya data.** `auto_daily_job.py` memanggil `services.database.fetch_news_df()` yang bergantung pada `st.secrets` (`services/config.py::get_secret`). Di GitHub Actions tidak ada `st.secrets`, dan workflow `daily_report.yml` **tidak menyediakan `SUPABASE_URL`/`SUPABASE_KEY` sama sekali** (hanya `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID`). Konsekuensi: jalur data selalu gagal → selalu jatuh ke data palsu 10.1.

**10.3 Laporan harian tidak memfilter berdasarkan tanggal.** `auto_daily_job.py` mengambil `fetch_news_df()` **seluruhnya** lalu memberi label periode "kemarin 17:00 – hari ini 07:00". Isi laporan adalah seluruh database, bukan periode tersebut.

**10.4 Tombol PDF Mingguan mati.** `pages/laporan.py:256–263` — `data=b""`, `disabled=True`, dengan komentar "Siap dihubungkan dengan template WeasyPrint A4 landscape Anda". Fitur yang diiklankan di judul tab tidak ada.

**10.5 Bug penulisan Supabase.** `services/database.py:236` dan `:245` memanggil `.insert(payload).select("*")` dan `.update(payload).eq(...).select("*")`. Pada supabase-py, `select()` tidak dapat dirantai setelah `insert()`/`update()` seperti itu — ini akan `AttributeError` atau menghasilkan query tidak valid. `save_news()` menutupinya dengan `except` yang mencoba ulang dengan kolom legacy, lalu mengembalikan pesan galat generik.

**10.6 Dua lapisan database yang tidak kompatibel.** `services/database.py` (`update_rows(table, payload, key, value)`) dan `services/cyber_db.py` (`update_rows(table, payload, *, filters=[...])`) punya nama identik tetapi signature berbeda. `database.py::get_db()` mengembalikan `None` bila secret kosong; `cyber_db.py::get_db()` melempar `RuntimeError`. Modul V5 dan V6 memakai lapisan berbeda — sumber bug yang tersembunyi.

**10.7 `services/database.py::fetch_all` tidak menerima parameter `filters`,** tetapi `pages/pusat_telaah.py:281` dan `pages/data_berita.py:246` memanggilnya lalu memfilter `berita_status_history` **di sisi Python setelah menarik SELURUH tabel riwayat**. Skalabilitas buruk dan mahal.

**10.8 `send_breaking_alert_telegram` adalah kode mati.** Fungsi lengkap dan siap pakai, tetapi tidak pernah dipanggil dari mana pun. Alert kritis real-time yang tercantum sebagai tujuan proyek tidak pernah terkirim.

**10.9 Tidak ada Telegram di mesin laporan mingguan.** `generate_weekly_report.py` hanya membuat draf di database dan `print()` ke stdout. Tujuan proyek "PDF dan Word langsung dikirim ke Grup Telegram" hanya terpenuhi untuk laporan harian, dan hanya PDF (Word tidak pernah dikirim ke Telegram sama sekali).

**10.10 `pdf_report_service.py` hardcode `"Wilayah Terdampak"`** sebagai nilai kolom Kanwil (baris 150) meskipun tabel PDF berjudul "Kantor Wilayah / UPT Terdampak". Data kanwil sebenarnya tersedia di master UPT tetapi tidak di-join.

**10.11 `pdf_report_service.create_daily_pdf_bytes` akan crash pada DataFrame tanpa kolom `sentimen`.** Tidak ada `ensure_columns`; `df_news["sentimen"]` diakses langsung.

### Menengah

**10.12 Jadwal sinkronisasi tidak konsisten** — Apps Script 5 menit, GitHub Actions 1 jam, health check menandai "Peringatan" bila >20 menit. Konfigurasi manapun yang aktif, health check akan sering memberi peringatan palsu.

**10.13 Duplikasi total `app.py` dan `streamlit_app.py`** (117 baris identik). Dua entrypoint yang harus dijaga sinkron secara manual.

**10.14 Briefing dirender dua kali.** `app.py:41–47` menampilkan `st.info` + `render_role_briefing(user)` (yang membuka dialog modal) **dan** tombol "Saya Mengerti & Tutup Briefing" dengan state `briefing_selesai`. Namun `render_role_briefing` punya state sendiri (`cyberintelpas_briefing_dismissed::{user}::{role}`). Dua mekanisme dismiss yang tidak sinkron. Komentar "PERBAIKAN BUG BRIEFING" menandai ini sebagai tambalan.

**10.15 `services/access_control.py.backup_sebelum_v6_0_1`** — file backup 4 KB masih ada di direktori `services/`.

**10.16 Konstanta izin didefinisikan tetapi tidak pernah diperiksa** di kode manapun: `view_verified_news`, `verify_news`, `map_upt`, `link_news_to_cases`, `validate_news_metadata`, `view_sync`, `view_duplicate_news`, `view_assigned_cases`, `submit_field_reports`, `upload_field_evidence`, `update_field_assignment`, `view_own_field_reports`, `manage_recommendations`, `assess_follow_up`, `view_recommendations`, `view_field_reports`, `manage_system_health`, `manage_integrations`, `manage_backups`. Sebagian besar peran ternyata bergantung pada segelintir izin saja.

**10.17 `ai_confidence = 0.62` konstan** untuk semua hasil klasifikasi aturan — angka kepercayaan palsu yang tidak mencerminkan kualitas pencocokan apapun.

**10.18 Klasifikasi aturan tidak pernah menghasilkan `Kritis`.** Nilai maksimum `classify_rule_based` adalah `Tinggi`. Level Kritis hanya bisa berasal dari AI, Spreadsheet, atau input manual analis.

**10.19 Upload bukti lapangan bergantung pada session state yang rapuh.** `verifikasi_lapangan.py:126` menggunakan `st.session_state["last_field_report_id"]`. Jika halaman di-refresh atau pengguna berpindah penugasan setelah mengirim laporan, bukti bisa terhubung ke laporan yang salah, atau tidak bisa diunggah sama sekali.

**10.20 Sinkronisasi Spreadsheet mengizinkan `news_data_operator`** (izin `run_sync`) tetapi tabel arsitektur di halaman itu menyebutkan operasi yang sifatnya administratif. Halaman juga menampilkan URL CSV publik lengkap kepada operator.

**10.21 URL CSV publik dan Spreadsheet ID di-hardcode** sebagai fallback default di tiga tempat: `pages/sinkronisasi_spreadsheet.py:19`, `supabase/functions/sheet-sync/index.ts`, dan `CyberIntelPAS_Sync.gs`. Rahasia infrastruktur di dalam source code.

**10.22 `fetch_action_items` memfilter di Python, bukan di database** — komentar di `case_service.py:360` mengakui ini sebagai kompromi kompatibilitas supabase-py. Menarik hingga 3.000 baris untuk setiap pengguna.

**10.23 Matriks perbandingan di halaman Evaluasi selalu dimulai kosong.** `analisis_evaluasi.py:64–71` membuat DataFrame baru setiap render; analisis yang tersimpan tidak pernah dimuat kembali ke editor. Analis harus mengetik ulang seluruh matriks untuk setiap versi.

**10.24 Nama merek tidak konsisten.** Header aplikasi mengatakan "CYBER-INTELPAS", sidebar dan halaman login mengatakan "SIMBERPAS", dashboard mengatakan "SIMBERPAS — Executive Dashboard", instruksi AI Assistant mengatakan "AI Assistant SIMBERPAS", nama berkas ekspor memakai `SIMBERPAS_` dan `Laporan_Harian_CyberIntelpas_`.

**10.25 Bootstrap super admin lewat `ACCESS_CODE`** (`auth_service.py:140–148`) — login sebagai `admin` dengan kode akses memberikan `super_admin` penuh selama belum ada super admin aktif di database. Berguna saat instalasi, berisiko bila `ACCESS_CODE` bocor atau semua super admin dinonaktifkan sementara.

**10.26 `services/geo_service.py` menduplikasi `STATUS_ALIASES`** yang sudah ada di `news_service.py` dan `database.py` — tiga salinan konstanta yang sama.

**10.27 `pages/laporan.py` mengasumsikan `date_range` selalu tuple 2 elemen** pada baris 216 (tab mingguan) tanpa pengecekan, padahal `st.date_input` bisa mengembalikan satu tanggal saat pengguna baru memilih tanggal awal → `IndexError`.

**10.28 Import tidak terpakai** di banyak halaman (`current_user` di `dashboard.py`, `laporan.py`, `pemetaan_upt.py`, `koordinat_upt.py`; `datetime`/`timezone` di `tindak_lanjut.py`; `Pt` di `report_service.py`; `date`/`ROLE_DEFINITIONS` di beberapa halaman).

**10.29 Tidak ada rate limit / kontrol biaya AI.** Setiap render Dashboard memanggil `executive_summary()` yang memanggil OpenAI. Streamlit me-rerun halaman pada setiap interaksi widget — biaya API bisa membengkak tak terkendali.

---

### Berkas yang relevan untuk penulisan ulang

- `/home/claude/sumber-lama/cyberintelpas-main/services/access_control.py` — sumber kebenaran RBAC
- `/home/claude/sumber-lama/cyberintelpas-main/services/news_service.py` — state machine berita
- `/home/claude/sumber-lama/cyberintelpas-main/services/case_service.py` — state machine kasus
- `/home/claude/sumber-lama/cyberintelpas-main/services/trend_service.py` — mesin agregasi & klasterisasi isu
- `/home/claude/sumber-lama/cyberintelpas-main/services/report_service.py` — generator PDF/DOCX/PPTX mingguan
- `/home/claude/sumber-lama/cyberintelpas-main/services/pdf_report_service.py` — template HTML laporan harian
- `/home/claude/sumber-lama/cyberintelpas-main/supabase/functions/sheet-sync/index.ts` — jalur sinkronisasi aktif
- `/home/claude/sumber-lama/cyberintelpas-main/sql/migration_v6_role_intelligence.sql` — skema tabel V6
- `/home/claude/sumber-lama/cyberintelpas-main/data/master_upt_coordinates.csv` — 492 UPT, 16 kolom