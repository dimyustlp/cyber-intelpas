-- =============================================================================
-- Cyber-Intelpas — Migrasi 04: Pengerasan Fungsi dan Storage
-- =============================================================================
-- Menutup temuan linter Supabase yang tersisa dan memasang policy untuk tiga
-- bucket penyimpanan yang selama ini terbuka bagi siapa pun pemegang kunci.
--
-- Sifat: idempoten.
-- =============================================================================

begin;

-- =============================================================================
-- 1. search_path yang bisa dibelokkan
-- =============================================================================
-- Enam fungsi lama dibuat tanpa SET search_path. Pada fungsi SECURITY DEFINER
-- ini membuka jalan bagi pemanggil untuk menyisipkan schema tiruan dan
-- membelokkan fungsi ke tabel palsu. Perbaikannya cukup mengunci search_path
-- tanpa menyentuh isi fungsinya.

do $$
declare
    r record;
begin
    for r in
        select p.oid::regprocedure as sig
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
              'prevent_duplicate_news_link',
              'normalize_cyberintelpas_role',
              'next_intelligence_case_number',
              'next_field_assignment_number',
              'next_weekly_report_number',
              'set_updated_at'
          )
    loop
        execute format('alter function %s set search_path = public, pg_temp', r.sig);
    end loop;
end $$;

-- =============================================================================
-- 2. Fungsi SECURITY DEFINER yang terbuka untuk anon
-- =============================================================================
-- cyberintelpas_system_health() memaparkan kondisi penjadwal lewat
-- /rest/v1/rpc/ tanpa perlu masuk. Informasi itu tidak seharusnya publik.

do $$
begin
    if exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'cyberintelpas_system_health'
    ) then
        revoke execute on function public.cyberintelpas_system_health() from anon, public;
        grant  execute on function public.cyberintelpas_system_health() to authenticated;
    end if;
end $$;

-- =============================================================================
-- 3. Policy penyimpanan berkas
-- =============================================================================
-- Tiga bucket sudah ada dan bersifat privat, tetapi tanpa policy storage
-- seluruh akses bergantung pada service_role key. Setelah blok ini, berkas
-- diambil lewat sesi pengguna dan signed URL berumur pendek.
--
-- Konvensi jalur berkas: <bucket>/<tahun>/<bulan>/<id-entitas>/<nama-berkas>

do $$
declare
    p record;
begin
    for p in
        select policyname from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and policyname like 'cip_%'
    loop
        execute format('drop policy if exists %I on storage.objects', p.policyname);
    end loop;
end $$;

-- --- berita-bukti: lampiran berita -------------------------------------------

create policy cip_berita_bukti_read on storage.objects
    for select to authenticated
    using (
        bucket_id = 'berita-bukti'
        and public.has_role('super_admin', 'media_intelligence_analyst',
                            'evaluation_recommendation_analyst',
                            'news_data_operator', 'executive_decision_maker')
    );

create policy cip_berita_bukti_write on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'berita-bukti'
        and public.has_role('super_admin', 'media_intelligence_analyst', 'news_data_operator')
    );

create policy cip_berita_bukti_update on storage.objects
    for update to authenticated
    using (bucket_id = 'berita-bukti' and owner_id = auth.uid()::text)
    with check (bucket_id = 'berita-bukti');

-- --- field-evidence: bukti verifikasi lapangan -------------------------------
-- Petugas hanya melihat berkas yang diunggahnya sendiri. Analis dan pimpinan
-- melihat semuanya karena merekalah yang menilai.

create policy cip_field_evidence_read on storage.objects
    for select to authenticated
    using (
        bucket_id = 'field-evidence'
        and (
            owner_id = auth.uid()::text
            or public.has_role('super_admin', 'media_intelligence_analyst',
                               'evaluation_recommendation_analyst',
                               'executive_decision_maker')
        )
    );

create policy cip_field_evidence_write on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'field-evidence'
        and public.has_role('field_verification_officer',
                            'media_intelligence_analyst', 'super_admin')
    );

-- --- intel-reports: berkas laporan PDF dan DOCX ------------------------------
-- Ditulis oleh proses latar memakai service_role. Dari aplikasi hanya dibaca,
-- dan hanya oleh peran yang berhak menerima laporan.

create policy cip_intel_reports_read on storage.objects
    for select to authenticated
    using (
        bucket_id = 'intel-reports'
        and public.has_role('super_admin', 'media_intelligence_analyst',
                            'evaluation_recommendation_analyst',
                            'executive_decision_maker')
    );

create policy cip_intel_reports_write on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'intel-reports'
        and public.has_role('super_admin', 'media_intelligence_analyst')
    );

-- Tidak ada policy DELETE untuk ketiga bucket. Berkas bukti dan laporan yang
-- sudah terunggah tidak bisa dihapus lewat aplikasi.

-- =============================================================================
-- 4. Indeks yang menopang kueri dashboard
-- =============================================================================
-- Tanpa indeks berikut, dashboard membaca seluruh tabel berita setiap kali
-- ada penyaringan. Sekarang masih ringan pada 644 baris, tetapi tidak akan
-- tetap begitu.

create index if not exists berita_created_at_idx
    on public.berita (created_at desc)
    where deleted_at is null;

create index if not exists berita_upt_created_idx
    on public.berita (nama_upt, created_at desc)
    where deleted_at is null;

create index if not exists berita_urgensi_idx
    on public.berita (urgensi, created_at desc)
    where deleted_at is null;

create index if not exists berita_status_verifikasi_idx
    on public.berita (status_verifikasi, created_at desc)
    where deleted_at is null;

create index if not exists berita_case_idx
    on public.berita (case_id)
    where case_id is not null;

create index if not exists berita_link_normalized_idx
    on public.berita (link_normalized)
    where deleted_at is null;

create index if not exists upt_kanwil_idx        on public.upt (kanwil, nama_upt);
create index if not exists upt_koordinat_idx     on public.upt (latitude, longitude)
    where latitude is not null and longitude is not null;

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_actor_idx   on public.audit_log (actor_username, created_at desc);

create index if not exists cases_status_idx
    on public.intelligence_cases (status, priority, last_media_at desc nulls last);

create index if not exists field_assignments_officer_idx
    on public.field_assignments (assigned_to, status, due_at);

create index if not exists action_items_assignee_idx
    on public.action_items (assigned_to, status, due_at);

create index if not exists sheet_sync_log_started_idx
    on public.sheet_sync_log (started_at desc);

-- =============================================================================
-- 5. Pencarian teks Bahasa Indonesia pada berita
-- =============================================================================
-- Kolom tsvector yang dihitung otomatis, supaya pencarian judul dan ringkasan
-- tidak lagi memakai ILIKE '%kata%' yang tidak bisa memakai indeks.

alter table public.berita
    add column if not exists search_vector tsvector
    generated always as (
        setweight(to_tsvector('simple', coalesce(judul, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(nama_upt, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(ringkasan, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(media, '')), 'D')
    ) stored;

create index if not exists berita_search_idx
    on public.berita using gin (search_vector);

comment on column public.berita.search_vector is
    'Dihitung otomatis dari judul, nama UPT, ringkasan, dan media. Memakai '
    'konfigurasi "simple" karena PostgreSQL tidak menyertakan stemmer Bahasa '
    'Indonesia, dan stemmer bahasa lain justru merusak kata dasar.';

commit;
