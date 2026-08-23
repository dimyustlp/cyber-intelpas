-- =============================================================================
-- Cyber-Intelpas — Migrasi 02: Row Level Security
-- =============================================================================
-- Kondisi sebelum migrasi ini: RLS menyala pada 20 dari 20 tabel, tetapi tidak
-- ada satu pun policy. Efeknya, tabel tertutup rapat bagi siapa pun kecuali
-- pemegang service_role key — dan karena aplikasi memakai kunci itu, setiap
-- sesi berjalan dengan hak penuh. Pembatasan peran hanya hidup di tampilan.
--
-- Migrasi ini memindahkan penegakan peran ke dalam database. Setelah ini,
-- aplikasi cukup memakai anon key + sesi pengguna, dan service_role key hanya
-- dipegang oleh proses latar (Edge Function, penjadwal).
--
-- Prasyarat: migrasi 20260822010000_auth_bridge.sql sudah dijalankan.
-- Sifat: idempoten.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Bersihkan policy lama agar migrasi bisa dijalankan ulang
-- -----------------------------------------------------------------------------

do $$
declare
    r record;
begin
    for r in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
    loop
        execute format('drop policy if exists %I on %I.%I',
                       r.policyname, r.schemaname, r.tablename);
    end loop;
end $$;

-- Pastikan RLS benar-benar menyala dan tidak bisa dilewati pemilik tabel.
do $$
declare
    t text;
begin
    foreach t in array array[
        'app_users','upt','berita','berita_attachments','berita_status_history',
        'audit_log','intelligence_cases','case_news','case_analyses',
        'case_recommendations','case_decisions','action_items',
        'field_assignments','field_reports','field_evidence',
        'weekly_reports','report_exports','briefing_acknowledgements',
        'sheet_sync_log','system_health_events'
    ]
    loop
        execute format('alter table public.%I enable row level security', t);
        execute format('alter table public.%I force row level security', t);
    end loop;
end $$;

-- =============================================================================
-- 1. app_users — profil dan peran
-- =============================================================================
-- Tabel ini masih menyimpan password_hash peninggalan Streamlit, jadi barisnya
-- tidak boleh terbaca bebas. Direktori nama untuk keperluan tampilan dilayani
-- oleh view terpisah di bagian akhir berkas ini.

create policy app_users_select_self on public.app_users
    for select to authenticated
    using (auth_user_id = auth.uid() or public.is_super_admin());

create policy app_users_update_self on public.app_users
    for update to authenticated
    using (auth_user_id = auth.uid())
    with check (
        auth_user_id = auth.uid()
        -- Pengguna biasa tidak boleh menaikkan perannya sendiri.
        and role = (select u.role from public.app_users u where u.auth_user_id = auth.uid())
        and aktif = (select u.aktif from public.app_users u where u.auth_user_id = auth.uid())
    );

create policy app_users_admin_all on public.app_users
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- =============================================================================
-- 2. upt — master 492 unit pelaksana teknis
-- =============================================================================
-- Data referensi. Semua peran perlu membacanya untuk filter dan peta.

create policy upt_select_all on public.upt
    for select to authenticated
    using (true);

create policy upt_write_curator on public.upt
    for all to authenticated
    using (public.has_role('super_admin', 'media_intelligence_analyst'))
    with check (public.has_role('super_admin', 'media_intelligence_analyst'));

-- =============================================================================
-- 3. berita — tabel inti
-- =============================================================================

-- Baca: dibatasi cakupan wilayah untuk operator dan petugas lapangan,
-- terbuka penuh untuk analis dan pimpinan. Berita terhapus disembunyikan.
create policy berita_select_scoped on public.berita
    for select to authenticated
    using (
        deleted_at is null
        and public.can_access_upt(nama_upt)
    );

create policy berita_select_deleted_admin on public.berita
    for select to authenticated
    using (deleted_at is not null and public.is_super_admin());

-- Tulis baru: operator dan analis. Operator wajib menandai dirinya sendiri.
create policy berita_insert_operator on public.berita
    for insert to authenticated
    with check (
        public.has_role('news_data_operator', 'media_intelligence_analyst', 'super_admin')
        and public.can_access_upt(nama_upt)
        and (
            public.has_role('media_intelligence_analyst', 'super_admin')
            or created_by = public.current_username()
        )
    );

-- Sunting oleh operator: hanya berita miliknya sendiri dan hanya selama
-- belum ditelaah. Begitu analis menyentuhnya, operator kehilangan akses tulis.
create policy berita_update_operator_own on public.berita
    for update to authenticated
    using (
        public.has_role('news_data_operator')
        and created_by = public.current_username()
        and coalesce(status_verifikasi, 'Belum Ditelaah') = 'Belum Ditelaah'
        and deleted_at is null
    )
    with check (
        created_by = public.current_username()
        and coalesce(status_verifikasi, 'Belum Ditelaah') = 'Belum Ditelaah'
    );

-- Sunting oleh analis: seluruh berita, termasuk penetapan status verifikasi.
create policy berita_update_analyst on public.berita
    for update to authenticated
    using (
        public.has_role('media_intelligence_analyst', 'evaluation_recommendation_analyst', 'super_admin')
        and deleted_at is null
    )
    with check (
        public.has_role('media_intelligence_analyst', 'evaluation_recommendation_analyst', 'super_admin')
    );

-- Penghapusan permanen tidak diberikan kepada siapa pun. Penghapusan dilakukan
-- lunak lewat kolom deleted_at, agar jejak intelijen tidak pernah hilang.
create policy berita_delete_nobody on public.berita
    for delete to authenticated
    using (false);

-- =============================================================================
-- 4. berita_attachments — lampiran bukti
-- =============================================================================

create policy berita_attachments_select on public.berita_attachments
    for select to authenticated
    using (
        deleted_at is null
        and exists (
            select 1 from public.berita b
            where b.id::text = berita_attachments.berita_id
              and b.deleted_at is null
              and public.can_access_upt(b.nama_upt)
        )
    );

create policy berita_attachments_insert on public.berita_attachments
    for insert to authenticated
    with check (
        uploaded_by = public.current_username()
        and public.has_role('news_data_operator', 'media_intelligence_analyst',
                            'field_verification_officer', 'super_admin')
    );

create policy berita_attachments_update_owner on public.berita_attachments
    for update to authenticated
    using (uploaded_by = public.current_username() or public.is_super_admin())
    with check (uploaded_by = public.current_username() or public.is_super_admin());

-- =============================================================================
-- 5. berita_status_history — riwayat perubahan status (append-only)
-- =============================================================================

create policy berita_status_history_select on public.berita_status_history
    for select to authenticated
    using (
        exists (
            select 1 from public.berita b
            where b.id::text = berita_status_history.berita_id
              and public.can_access_upt(b.nama_upt)
        )
    );

create policy berita_status_history_insert on public.berita_status_history
    for insert to authenticated
    with check (changed_by = public.current_username());

-- =============================================================================
-- 6. audit_log — jejak audit, hanya boleh bertambah
-- =============================================================================

create policy audit_log_select_admin on public.audit_log
    for select to authenticated
    using (
        public.is_super_admin()
        or actor_username = public.current_username()
    );

create policy audit_log_insert_self on public.audit_log
    for insert to authenticated
    with check (actor_username = public.current_username());

-- Tidak ada policy UPDATE maupun DELETE. Jejak audit tidak bisa disunting
-- atau dihapus oleh siapa pun yang lewat jalur aplikasi, termasuk admin.

-- =============================================================================
-- 7. intelligence_cases — kasus intelijen
-- =============================================================================

create policy cases_select_all on public.intelligence_cases
    for select to authenticated
    using (
        public.has_role('super_admin', 'media_intelligence_analyst',
                        'evaluation_recommendation_analyst', 'executive_decision_maker')
        or public.can_access_upt(primary_upt)
    );

create policy cases_insert_analyst on public.intelligence_cases
    for insert to authenticated
    with check (
        public.has_role('media_intelligence_analyst',
                        'evaluation_recommendation_analyst', 'super_admin')
        and created_by = public.current_username()
    );

create policy cases_update_analyst on public.intelligence_cases
    for update to authenticated
    using (
        public.has_role('media_intelligence_analyst',
                        'evaluation_recommendation_analyst', 'super_admin')
        and (closed_at is null or public.is_super_admin())
    )
    with check (
        public.has_role('media_intelligence_analyst',
                        'evaluation_recommendation_analyst', 'super_admin')
    );

-- =============================================================================
-- 8. case_news — relasi berita ke kasus
-- =============================================================================

create policy case_news_select on public.case_news
    for select to authenticated
    using (
        exists (select 1 from public.intelligence_cases c where c.id = case_news.case_id)
    );

create policy case_news_write_analyst on public.case_news
    for all to authenticated
    using (public.has_role('media_intelligence_analyst',
                           'evaluation_recommendation_analyst', 'super_admin'))
    with check (
        public.has_role('media_intelligence_analyst',
                        'evaluation_recommendation_analyst', 'super_admin')
        and linked_by = public.current_username()
    );

-- =============================================================================
-- 9. case_analyses — telaah mendalam
-- =============================================================================

create policy case_analyses_select on public.case_analyses
    for select to authenticated
    using (
        public.has_role('super_admin', 'media_intelligence_analyst',
                        'evaluation_recommendation_analyst', 'executive_decision_maker')
    );

create policy case_analyses_insert on public.case_analyses
    for insert to authenticated
    with check (
        public.has_role('media_intelligence_analyst',
                        'evaluation_recommendation_analyst', 'super_admin')
        and created_by = public.current_username()
    );

-- Telaah yang sudah diverifikasi tidak boleh disunting lagi. Versi baru dibuat
-- lewat kolom analysis_version, bukan dengan menimpa versi lama.
create policy case_analyses_update on public.case_analyses
    for update to authenticated
    using (
        verified_at is null
        and (created_by = public.current_username() or public.is_super_admin())
    )
    with check (
        public.has_role('media_intelligence_analyst',
                        'evaluation_recommendation_analyst', 'super_admin')
    );

-- =============================================================================
-- 10. case_recommendations — rekomendasi tindak lanjut
-- =============================================================================

create policy case_recommendations_select on public.case_recommendations
    for select to authenticated
    using (
        public.has_role('super_admin', 'media_intelligence_analyst',
                        'evaluation_recommendation_analyst', 'executive_decision_maker')
    );

create policy case_recommendations_insert on public.case_recommendations
    for insert to authenticated
    with check (
        public.has_role('evaluation_recommendation_analyst',
                        'media_intelligence_analyst', 'super_admin')
        and created_by = public.current_username()
    );

create policy case_recommendations_update on public.case_recommendations
    for update to authenticated
    using (
        (decided_at is null
         and public.has_role('evaluation_recommendation_analyst',
                             'media_intelligence_analyst', 'super_admin'))
        -- Setelah diputus, hanya kolom progres yang praktis berubah, dan itu
        -- dilakukan oleh pemilik tindak lanjut atau pimpinan.
        or public.has_role('executive_decision_maker', 'super_admin')
    )
    with check (true);

-- =============================================================================
-- 11. case_decisions — keputusan pimpinan
-- =============================================================================
-- Ini titik kendali paling penting dalam sistem. Hanya pimpinan yang boleh
-- membuat keputusan, dan keputusan yang sudah tercatat tidak bisa disunting
-- maupun dihapus oleh siapa pun.

create policy case_decisions_select on public.case_decisions
    for select to authenticated
    using (
        public.has_role('super_admin', 'media_intelligence_analyst',
                        'evaluation_recommendation_analyst', 'executive_decision_maker')
    );

create policy case_decisions_insert_executive on public.case_decisions
    for insert to authenticated
    with check (
        public.has_role('executive_decision_maker', 'super_admin')
        and decided_by = public.current_username()
    );

-- =============================================================================
-- 12. action_items — butir tindak lanjut
-- =============================================================================

create policy action_items_select on public.action_items
    for select to authenticated
    using (
        public.has_role('super_admin', 'media_intelligence_analyst',
                        'evaluation_recommendation_analyst', 'executive_decision_maker')
        or assigned_to = public.current_username()
        or assigned_role = public.current_role_name()
    );

create policy action_items_insert on public.action_items
    for insert to authenticated
    with check (
        public.has_role('evaluation_recommendation_analyst',
                        'media_intelligence_analyst', 'super_admin')
        and created_by = public.current_username()
    );

-- Penerima tugas boleh memperbarui progres pekerjaannya sendiri.
create policy action_items_update_assignee on public.action_items
    for update to authenticated
    using (
        assigned_to = public.current_username()
        or assigned_role = public.current_role_name()
        or public.has_role('evaluation_recommendation_analyst',
                           'media_intelligence_analyst', 'super_admin')
    )
    with check (true);

-- =============================================================================
-- 13. field_assignments — surat tugas verifikasi lapangan
-- =============================================================================

create policy field_assignments_select on public.field_assignments
    for select to authenticated
    using (
        assigned_to = public.current_username()
        or public.has_role('super_admin', 'media_intelligence_analyst',
                           'evaluation_recommendation_analyst', 'executive_decision_maker')
    );

create policy field_assignments_insert on public.field_assignments
    for insert to authenticated
    with check (
        public.has_role('media_intelligence_analyst', 'super_admin')
        and assigned_by = public.current_username()
    );

-- Petugas hanya boleh mengubah status penugasannya (terima, kerjakan, selesai),
-- bukan isi instruksi atau tenggatnya.
create policy field_assignments_update_officer on public.field_assignments
    for update to authenticated
    using (
        assigned_to = public.current_username()
        or public.has_role('media_intelligence_analyst', 'super_admin')
    )
    with check (
        public.has_role('media_intelligence_analyst', 'super_admin')
        or (
            assigned_to = public.current_username()
            and instruction = (
                select a.instruction from public.field_assignments a
                where a.id = field_assignments.id
            )
            and due_at is not distinct from (
                select a.due_at from public.field_assignments a
                where a.id = field_assignments.id
            )
        )
    );

-- =============================================================================
-- 14. field_reports — laporan hasil verifikasi
-- =============================================================================

create policy field_reports_select on public.field_reports
    for select to authenticated
    using (
        submitted_by = public.current_username()
        or public.has_role('super_admin', 'media_intelligence_analyst',
                           'evaluation_recommendation_analyst', 'executive_decision_maker')
    );

create policy field_reports_insert on public.field_reports
    for insert to authenticated
    with check (
        public.has_role('field_verification_officer', 'super_admin')
        and submitted_by = public.current_username()
        and exists (
            select 1 from public.field_assignments a
            where a.id = field_reports.assignment_id
              and (a.assigned_to = public.current_username() or public.is_super_admin())
        )
    );

-- Laporan yang sudah dikirim terkunci bagi penyusunnya. Analis boleh menelaah.
create policy field_reports_update on public.field_reports
    for update to authenticated
    using (
        (submitted_by = public.current_username()
         and coalesce(status, 'draft') in ('draft', 'dikembalikan'))
        or public.has_role('media_intelligence_analyst', 'super_admin')
    )
    with check (true);

-- =============================================================================
-- 15. field_evidence — bukti lapangan
-- =============================================================================

create policy field_evidence_select on public.field_evidence
    for select to authenticated
    using (
        deleted_at is null
        and (
            uploaded_by = public.current_username()
            or public.has_role('super_admin', 'media_intelligence_analyst',
                               'evaluation_recommendation_analyst', 'executive_decision_maker')
        )
    );

create policy field_evidence_insert on public.field_evidence
    for insert to authenticated
    with check (
        uploaded_by = public.current_username()
        and public.has_role('field_verification_officer', 'media_intelligence_analyst', 'super_admin')
    );

create policy field_evidence_update on public.field_evidence
    for update to authenticated
    using (
        uploaded_by = public.current_username()
        or public.has_role('media_intelligence_analyst', 'super_admin')
    )
    with check (true);

-- =============================================================================
-- 16. weekly_reports — laporan berkala berjenjang
-- =============================================================================
-- Alur status: draft → diverifikasi → disetujui → dipublikasi → dikunci.
-- Laporan yang belum dipublikasi tidak boleh terlihat oleh peran di luar
-- penyusun dan pemeriksanya.

create policy weekly_reports_select_published on public.weekly_reports
    for select to authenticated
    using (
        published_at is not null
        or public.has_role('super_admin', 'media_intelligence_analyst',
                           'evaluation_recommendation_analyst')
        or created_by = public.current_username()
    );

create policy weekly_reports_insert on public.weekly_reports
    for insert to authenticated
    with check (
        public.has_role('media_intelligence_analyst', 'super_admin')
        and created_by = public.current_username()
    );

-- Laporan yang sudah dikunci tidak bisa disentuh lagi oleh siapa pun.
create policy weekly_reports_update on public.weekly_reports
    for update to authenticated
    using (
        locked_at is null
        and (
            public.has_role('media_intelligence_analyst', 'super_admin')
            or public.has_role('executive_decision_maker')
        )
    )
    with check (
        -- Pengesahan adalah hak pimpinan. Analis tidak boleh menyetujui
        -- laporannya sendiri.
        approved_by is null
        or public.has_role('executive_decision_maker', 'super_admin')
    );

-- =============================================================================
-- 17. report_exports — jejak berkas PDF dan DOCX
-- =============================================================================

create policy report_exports_select on public.report_exports
    for select to authenticated
    using (
        exists (
            select 1 from public.weekly_reports w
            where w.id = report_exports.report_id
        )
    );

create policy report_exports_insert on public.report_exports
    for insert to authenticated
    with check (
        public.has_role('media_intelligence_analyst', 'super_admin')
        and generated_by = public.current_username()
    );

-- =============================================================================
-- 18. briefing_acknowledgements — bukti pimpinan membaca briefing
-- =============================================================================

create policy briefing_ack_select on public.briefing_acknowledgements
    for select to authenticated
    using (
        username = public.current_username()
        or public.has_role('super_admin', 'media_intelligence_analyst')
    );

create policy briefing_ack_insert_self on public.briefing_acknowledgements
    for insert to authenticated
    with check (username = public.current_username());

-- =============================================================================
-- 19. sheet_sync_log — log sinkronisasi Spreadsheet
-- =============================================================================
-- Ditulis oleh Edge Function memakai service_role, yang melewati RLS.
-- Dari sisi aplikasi, tabel ini hanya dibaca.

create policy sheet_sync_log_select on public.sheet_sync_log
    for select to authenticated
    using (public.has_role('super_admin', 'media_intelligence_analyst'));

-- =============================================================================
-- 20. system_health_events — pemantauan komponen
-- =============================================================================

create policy system_health_select on public.system_health_events
    for select to authenticated
    using (public.has_role('super_admin', 'media_intelligence_analyst'));

create policy system_health_resolve on public.system_health_events
    for update to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- =============================================================================
-- 21. Direktori pengguna tanpa membuka password_hash
-- =============================================================================

create or replace view public.app_users_directory
with (security_invoker = true) as
    select
        u.id,
        u.username,
        u.full_name,
        u.role,
        public.role_label(u.role) as role_label,
        u.jabatan,
        u.assigned_kanwil,
        u.assigned_upt,
        u.aktif,
        u.last_login
    from public.app_users u
    where u.deleted_at is null;

-- View di atas memakai security_invoker sehingga tetap tunduk pada policy
-- app_users. Untuk direktori yang boleh dibaca semua peran, dipakai fungsi
-- terkontrol berikut, yang hanya mengembalikan kolom tidak sensitif.

create or replace function public.user_directory()
returns table (
    username    text,
    full_name   text,
    role        text,
    role_label  text,
    assigned_upt text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select u.username, u.full_name, u.role,
           public.role_label(u.role), u.assigned_upt
    from public.app_users u
    where u.deleted_at is null
      and u.aktif is true
      and auth.uid() is not null;
$$;

revoke execute on function public.user_directory() from anon, public;
grant execute on function public.user_directory() to authenticated;

-- =============================================================================
-- 22. Cabut hak baca peran anon dari seluruh schema public
-- =============================================================================
-- Tidak ada satu pun tabel di sistem ini yang boleh dibaca tanpa masuk.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

commit;
