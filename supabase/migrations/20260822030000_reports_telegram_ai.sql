-- =============================================================================
-- Cyber-Intelpas — Migrasi 03: Laporan Harian, Telegram, dan Klasifikasi AI
-- =============================================================================
-- Tiga hal yang belum ada di basis data saat audit:
--   1. Laporan harian. Tabel `weekly_reports` hanya mengenal rentang mingguan.
--   2. Integrasi Telegram. Tidak ada tabel pengaturan maupun jejak pengiriman.
--   3. Klasifikasi AI. 635 dari 644 berita berkategori "Lainnya" dan 612
--      bersentimen "Tidak diketahui" karena tidak ada proses yang mengisinya.
--
-- Sifat: idempoten.
-- =============================================================================

begin;

-- =============================================================================
-- 1. Laporan harian di atas struktur yang sudah ada
-- =============================================================================
-- Tabel `weekly_reports` sudah punya semua yang dibutuhkan laporan harian:
-- snapshot_data, ai_narrative, dan alur pengesahan berjenjang. Yang kurang
-- hanya penanda jenis. Menambah kolom jauh lebih aman daripada membuat tabel
-- kembar yang harus dijaga sinkron.

alter table public.weekly_reports
    add column if not exists report_type text not null default 'mingguan',
    add column if not exists title text,
    add column if not exists classification text not null default 'Internal',
    add column if not exists generated_mode text not null default 'otomatis',
    add column if not exists telegram_sent_at timestamptz,
    add column if not exists telegram_message_id text;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'weekly_reports_report_type_check'
    ) then
        alter table public.weekly_reports
            add constraint weekly_reports_report_type_check
            check (report_type in ('harian', 'mingguan', 'bulanan', 'insidentil'));
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'weekly_reports_classification_check'
    ) then
        alter table public.weekly_reports
            add constraint weekly_reports_classification_check
            check (classification in ('Publik', 'Internal', 'Terbatas', 'Rahasia'));
    end if;
end $$;

comment on table public.weekly_reports is
    'Laporan berkala Cyber-Intelpas. Kolom report_type membedakan harian, '
    'mingguan, bulanan, dan insidentil. Nama tabel dipertahankan agar kode '
    'dan data lama tidak putus.';

create index if not exists weekly_reports_type_period_idx
    on public.weekly_reports (report_type, period_start desc);

create index if not exists weekly_reports_status_idx
    on public.weekly_reports (status, published_at desc nulls last);

-- Penomoran laporan yang membedakan jenis: LAP-H/0001/VIII/2026
create or replace function public.next_report_number(p_report_type text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    prefix       text;
    urutan       integer;
    bulan_romawi text;
    tahun        integer := extract(year from now() at time zone 'Asia/Jakarta');
begin
    prefix := case p_report_type
        when 'harian'     then 'LAP-H'
        when 'mingguan'   then 'LAP-M'
        when 'bulanan'    then 'LAP-B'
        else 'LAP-I'
    end;

    bulan_romawi := (array[
        'I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'
    ])[extract(month from now() at time zone 'Asia/Jakarta')::int];

    select coalesce(max(
        nullif(regexp_replace(split_part(report_number, '/', 2), '\D', '', 'g'), '')::integer
    ), 0) + 1
      into urutan
      from public.weekly_reports
     where report_type = p_report_type
       and extract(year from created_at at time zone 'Asia/Jakarta') = tahun;

    return format('%s/%s/%s/%s', prefix, lpad(urutan::text, 4, '0'), bulan_romawi, tahun);
end;
$$;

grant execute on function public.next_report_number(text) to authenticated;

-- =============================================================================
-- 2. Pengaturan integrasi — Telegram dan lainnya
-- =============================================================================
-- Nilai rahasia (bot token) tidak disimpan di sini. Yang tersimpan hanya
-- referensi ke Supabase Vault, sehingga tabel ini boleh dibaca admin tanpa
-- membocorkan kredensial.

create table if not exists public.integration_settings (
    id                 uuid primary key default gen_random_uuid(),
    provider           text not null,
    label              text not null,
    is_active          boolean not null default true,
    config             jsonb not null default '{}'::jsonb,
    secret_vault_name  text,
    created_by         text,
    created_at         timestamptz not null default now(),
    updated_by         text,
    updated_at         timestamptz not null default now(),
    constraint integration_settings_provider_check
        check (provider in ('telegram', 'gemini', 'google_sheet', 'smtp', 'whatsapp'))
);

create unique index if not exists integration_settings_provider_label_idx
    on public.integration_settings (provider, label);

comment on column public.integration_settings.secret_vault_name is
    'Nama secret di Supabase Vault. Nilai rahasianya sendiri tidak pernah '
    'disimpan di tabel ini dan tidak pernah dikirim ke browser.';

comment on column public.integration_settings.config is
    'Konfigurasi tidak rahasia. Untuk Telegram berisi chat_id tujuan, '
    'thread_id, format caption, dan daftar jenis laporan yang dikirim.';

-- -----------------------------------------------------------------------------
-- Tujuan pengiriman Telegram — satu integrasi bisa punya banyak grup
-- -----------------------------------------------------------------------------

create table if not exists public.telegram_targets (
    id                  uuid primary key default gen_random_uuid(),
    integration_id      uuid not null references public.integration_settings (id) on delete cascade,
    label               text not null,
    chat_id             text not null,
    message_thread_id   text,
    min_classification  text not null default 'Internal',
    report_types        text[] not null default array['harian', 'mingguan'],
    send_urgent_alert   boolean not null default true,
    is_active           boolean not null default true,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    constraint telegram_targets_classification_check
        check (min_classification in ('Publik', 'Internal', 'Terbatas', 'Rahasia'))
);

create unique index if not exists telegram_targets_chat_idx
    on public.telegram_targets (integration_id, chat_id, coalesce(message_thread_id, ''));

comment on column public.telegram_targets.min_classification is
    'Batas klasifikasi tertinggi yang boleh dikirim ke grup ini. Grup dengan '
    'nilai "Internal" tidak akan pernah menerima laporan berklasifikasi '
    '"Terbatas" atau "Rahasia".';

-- -----------------------------------------------------------------------------
-- Jejak pengiriman — tanpa ini tidak ada bukti laporan sampai atau tidak
-- -----------------------------------------------------------------------------

create table if not exists public.telegram_deliveries (
    id                uuid primary key default gen_random_uuid(),
    target_id         uuid references public.telegram_targets (id) on delete set null,
    report_id         uuid references public.weekly_reports (id) on delete set null,
    berita_id         uuid,
    case_id           uuid references public.intelligence_cases (id) on delete set null,
    delivery_type     text not null default 'report',
    trigger_type      text not null default 'scheduled',
    status            text not null default 'pending',
    attempt           integer not null default 1,
    chat_id           text,
    message_id        text,
    caption           text,
    documents         jsonb not null default '[]'::jsonb,
    requested_by      text,
    requested_at      timestamptz not null default now(),
    delivered_at      timestamptz,
    error_detail      text,
    constraint telegram_deliveries_status_check
        check (status in ('pending', 'sent', 'failed', 'skipped')),
    constraint telegram_deliveries_type_check
        check (delivery_type in ('report', 'urgent_alert', 'case_update', 'test'))
);

create index if not exists telegram_deliveries_status_idx
    on public.telegram_deliveries (status, requested_at desc);

create index if not exists telegram_deliveries_report_idx
    on public.telegram_deliveries (report_id);

-- =============================================================================
-- 3. Penjadwalan laporan yang bisa diatur dari dashboard
-- =============================================================================
-- Jadwal tidak dikeraskan di dalam kode. Admin mengubahnya lewat antarmuka,
-- dan penjadwal membaca tabel ini setiap kali berjalan.

create table if not exists public.report_schedules (
    id                uuid primary key default gen_random_uuid(),
    report_type       text not null,
    label             text not null,
    cron_expression   text not null,
    timezone          text not null default 'Asia/Jakarta',
    is_active         boolean not null default true,
    auto_publish      boolean not null default false,
    auto_send_telegram boolean not null default true,
    export_formats    text[] not null default array['pdf', 'docx'],
    last_run_at       timestamptz,
    last_status       text,
    last_error        text,
    next_run_at       timestamptz,
    created_by        text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    constraint report_schedules_type_check
        check (report_type in ('harian', 'mingguan', 'bulanan'))
);

comment on column public.report_schedules.auto_publish is
    'Bila false, laporan berhenti di status draft dan menunggu pengesahan '
    'analis sebelum bisa dikirim. Ini bawaan yang dipilih, karena laporan '
    'intelijen tidak seharusnya terkirim ke pimpinan tanpa dibaca manusia.';

-- Tanpa indeks unik, ON CONFLICT DO NOTHING tidak menahan apa pun dan migrasi
-- yang dijalankan ulang akan menggandakan jadwal.
create unique index if not exists report_schedules_type_label_idx
    on public.report_schedules (report_type, label);

insert into public.report_schedules (report_type, label, cron_expression, auto_publish, auto_send_telegram)
values
    ('harian',   'Laporan Harian Cyber-Intelpas',   '50 16 * * *', false, true),
    ('mingguan', 'Laporan Mingguan Cyber-Intelpas', '50 16 * * 0', false, true)
on conflict (report_type, label) do nothing;

-- Catatan zona waktu: cron di Supabase berjalan dalam UTC. Pukul 23.50 WIB
-- sama dengan 16.50 UTC pada hari yang sama.

-- =============================================================================
-- 4. Jejak klasifikasi AI
-- =============================================================================

create table if not exists public.ai_classification_log (
    id              uuid primary key default gen_random_uuid(),
    berita_id       uuid,
    case_id         uuid references public.intelligence_cases (id) on delete set null,
    task_type       text not null default 'klasifikasi_berita',
    provider        text not null,
    model           text,
    prompt_version  text,
    input_tokens    integer,
    output_tokens   integer,
    latency_ms      integer,
    confidence      numeric,
    result          jsonb,
    accepted        boolean,
    reviewed_by     text,
    reviewed_at     timestamptz,
    error_detail    text,
    created_at      timestamptz not null default now()
);

create index if not exists ai_classification_log_berita_idx
    on public.ai_classification_log (berita_id, created_at desc);

comment on table public.ai_classification_log is
    'Setiap keluaran model dicatat beserta tingkat keyakinannya. Hasil AI '
    'tidak pernah langsung dianggap benar: kolom accepted diisi ketika analis '
    'menyetujuinya, dan itulah yang menaikkan status berita.';

-- Kolom pendukung pada tabel berita
alter table public.berita
    add column if not exists ai_model text,
    add column if not exists ai_classified_at timestamptz,
    add column if not exists ai_reviewed_by text,
    add column if not exists ai_reviewed_at timestamptz;

create index if not exists berita_needs_classification_idx
    on public.berita (created_at desc)
    where deleted_at is null
      and (ai_classified_at is null or coalesce(kategori, 'Lainnya') = 'Lainnya');

-- =============================================================================
-- 5. Hak akses dan RLS untuk tabel baru
-- =============================================================================
-- Supabase memasang default privileges yang memberi hak baca kepada peran anon
-- pada setiap tabel baru di schema public. Untuk sistem ini hak itu dicabut
-- secara eksplisit, dan tabel baru hanya dibuka bagi pengguna yang sudah masuk.

do $$
declare
    t text;
begin
    foreach t in array array[
        'integration_settings', 'telegram_targets', 'telegram_deliveries',
        'report_schedules', 'ai_classification_log'
    ]
    loop
        execute format('revoke all on public.%I from anon', t);
        execute format('grant select, insert, update, delete on public.%I to authenticated', t);
        execute format('grant all on public.%I to service_role', t);
    end loop;
end $$;

alter table public.integration_settings    enable row level security;
alter table public.telegram_targets        enable row level security;
alter table public.telegram_deliveries     enable row level security;
alter table public.report_schedules        enable row level security;
alter table public.ai_classification_log   enable row level security;

alter table public.integration_settings    force row level security;
alter table public.telegram_targets        force row level security;
alter table public.telegram_deliveries     force row level security;
alter table public.report_schedules        force row level security;
alter table public.ai_classification_log   force row level security;

-- Pengaturan integrasi adalah wilayah administrator utama saja.
create policy integration_settings_admin on public.integration_settings
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

create policy telegram_targets_admin on public.telegram_targets
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- Jejak pengiriman boleh dibaca analis agar bisa memastikan laporannya sampai.
create policy telegram_deliveries_select on public.telegram_deliveries
    for select to authenticated
    using (public.has_role('super_admin', 'media_intelligence_analyst'));

create policy telegram_deliveries_insert on public.telegram_deliveries
    for insert to authenticated
    with check (
        public.has_role('super_admin', 'media_intelligence_analyst')
        and requested_by = public.current_username()
    );

create policy report_schedules_select on public.report_schedules
    for select to authenticated
    using (public.has_role('super_admin', 'media_intelligence_analyst'));

create policy report_schedules_admin on public.report_schedules
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

create policy ai_classification_log_select on public.ai_classification_log
    for select to authenticated
    using (public.has_role('super_admin', 'media_intelligence_analyst',
                           'evaluation_recommendation_analyst'));

create policy ai_classification_log_review on public.ai_classification_log
    for update to authenticated
    using (public.has_role('super_admin', 'media_intelligence_analyst'))
    with check (reviewed_by = public.current_username());

-- =============================================================================
-- 6. Pemicu updated_at untuk tabel baru
-- =============================================================================

do $$
declare
    t text;
begin
    foreach t in array array[
        'integration_settings', 'telegram_targets', 'report_schedules'
    ]
    loop
        execute format(
            'drop trigger if exists set_updated_at_%1$s on public.%1$I', t);
        execute format(
            'create trigger set_updated_at_%1$s before update on public.%1$I '
            'for each row execute function public.set_updated_at()', t);
    end loop;
end $$;

commit;
