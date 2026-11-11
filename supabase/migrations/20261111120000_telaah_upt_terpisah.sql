-- Putusan telaah unit dipisahkan dari putusan telaah kantor wilayah.
--
-- Masalah yang dilaporkan pada uji coba 11 November 2026: begitu kantor wilayah
-- menelaah sebuah berita, berita itu hilang dari antrean petugas UPT. Sebabnya,
-- kanwil dan UPT menulis putusannya ke kolom yang sama, telaah_wilayah_status,
-- sementara antrean kedua ruang hanya menampilkan berita yang kolom itu masih
-- kosong. Putusan siapa pun menutup antrean keduanya.
--
-- Maksud rancangan sejak migrasi 20260901080000 sebenarnya lain: unit memeriksa
-- beritanya sendiri, kanwil memeriksa seluruh wilayahnya, dan putusan keduanya
-- tercatat masing-masing. Migrasi ini mewujudkannya:
--
--   telaah_wilayah_*  milik kantor wilayah (dan pusat)
--   telaah_upt_*      milik petugas UPT yang bersangkutan
--
-- Putusan lama yang dibuat akun UPT dipindahkan ke kolom UPT, sehingga berita
-- yang sudah ditelaah UPT kembali muncul di antrean kanwil, dan sebaliknya.
-- Idempoten: aman dijalankan berulang.

begin;

-- -----------------------------------------------------------------------------
-- 1. Kolom putusan unit
-- -----------------------------------------------------------------------------

alter table public.berita
    add column if not exists telaah_upt_status           text,
    add column if not exists telaah_upt_catatan          text,
    add column if not exists telaah_upt_oleh             text,
    add column if not exists telaah_upt_pada             timestamptz,
    add column if not exists telaah_upt_putusan_pertama  timestamptz;

alter table public.berita drop constraint if exists berita_telaah_upt_status_check;
alter table public.berita add constraint berita_telaah_upt_status_check
    check (telaah_upt_status is null or telaah_upt_status in (
        'Belum Ditelaah', 'Sesuai', 'Direvisi', 'Bukan Unit Kami', 'Perlu Perhatian'
    ));

comment on column public.berita.telaah_upt_status is
    'Putusan petugas UPT atas berita unitnya. Terpisah dari telaah_wilayah_status '
    '(kantor wilayah) dan status_verifikasi (analis pusat).';
comment on column public.berita.telaah_wilayah_status is
    'Putusan penelaah kantor wilayah. Putusan unit ada di telaah_upt_status. '
    'Keduanya berdiri sendiri dari status_verifikasi milik analis pusat.';

create index if not exists berita_telaah_upt_idx
    on public.berita (nama_upt, telaah_upt_status)
    where deleted_at is null;

-- Riwayat kini mencatat lapis putusannya.
alter table public.telaah_riwayat
    add column if not exists lapis text not null default 'wilayah';

-- -----------------------------------------------------------------------------
-- 2. Memindahkan putusan lama yang dibuat akun UPT
-- -----------------------------------------------------------------------------
-- Pemicu dimatikan sebentar supaya pemindahan ini tidak tercatat sebagai
-- revisi baru dan tidak tertolak jendela 24 jam.

alter table public.berita disable trigger berita_a_jaga_revisi_telaah;
alter table public.berita disable trigger berita_catat_riwayat_telaah;
alter table public.berita disable trigger berita_jaga_sunting_wilayah;

with akun_upt as (
    select username as nama from public.app_users
     where role in ('upt_penelaah', 'upt_petugas') and username is not null
    union
    select full_name from public.app_users
     where role in ('upt_penelaah', 'upt_petugas') and full_name is not null
)
update public.berita b
   set telaah_upt_status          = b.telaah_wilayah_status,
       telaah_upt_catatan         = b.telaah_wilayah_catatan,
       telaah_upt_oleh            = b.telaah_wilayah_oleh,
       telaah_upt_pada            = b.telaah_wilayah_pada,
       telaah_upt_putusan_pertama = b.telaah_wilayah_putusan_pertama,
       telaah_wilayah_status          = null,
       telaah_wilayah_catatan         = null,
       telaah_wilayah_oleh            = null,
       telaah_wilayah_pada            = null,
       telaah_wilayah_putusan_pertama = null
 where b.telaah_upt_status is null
   and b.telaah_wilayah_status is not null
   and b.telaah_wilayah_oleh in (select nama from akun_upt);

update public.telaah_riwayat r
   set lapis = 'upt'
 where r.lapis = 'wilayah'
   and r.oleh in (
       select username from public.app_users
        where role in ('upt_penelaah', 'upt_petugas') and username is not null
       union
       select full_name from public.app_users
        where role in ('upt_penelaah', 'upt_petugas') and full_name is not null
   );

alter table public.berita enable trigger berita_a_jaga_revisi_telaah;
alter table public.berita enable trigger berita_catat_riwayat_telaah;
alter table public.berita enable trigger berita_jaga_sunting_wilayah;

-- -----------------------------------------------------------------------------
-- 3. Pagar kolom: masing-masing hanya menulis lapisnya sendiri
-- -----------------------------------------------------------------------------

create or replace function public.jaga_sunting_wilayah()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    -- Peran pusat tidak dibatasi pemicu ini; batasnya sudah pada policy.
    if public.peran_pusat() then
        return new;
    end if;

    if not public.peran_wilayah() then
        return new;
    end if;

    if new.id is distinct from old.id
       or new.kanwil_asal is distinct from old.kanwil_asal
       or new.created_by  is distinct from old.created_by
       or new.deleted_at  is distinct from old.deleted_at then
        raise exception 'Asal berita dan penandanya tidak dapat diubah dari ruang wilayah.'
            using errcode = '42501';
    end if;

    -- Putusan pusat tetap milik pusat.
    if new.status_verifikasi is distinct from old.status_verifikasi then
        raise exception 'Status verifikasi pusat hanya dapat diubah analis pusat. '
                        'Pakailah telaah wilayah untuk menyatakan putusan Anda.'
            using errcode = '42501';
    end if;

    if public.peran_upt() then
        -- Unit tidak boleh memindahkan berita ke unit lain.
        if new.nama_upt is distinct from old.nama_upt then
            raise exception 'Petugas unit tidak dapat memindahkan berita ke unit lain.'
                using errcode = '42501';
        end if;
        -- Putusan kantor wilayah milik kantor wilayah.
        if new.telaah_wilayah_status  is distinct from old.telaah_wilayah_status
           or new.telaah_wilayah_catatan is distinct from old.telaah_wilayah_catatan
           or new.telaah_wilayah_oleh    is distinct from old.telaah_wilayah_oleh
           or new.telaah_wilayah_pada    is distinct from old.telaah_wilayah_pada then
            raise exception 'Putusan telaah kantor wilayah tidak dapat diubah dari ruang unit.'
                using errcode = '42501';
        end if;
    else
        -- Tanggapan resmi unit hanya ditulis unit yang bersangkutan.
        if new.tanggapan_upt   is distinct from old.tanggapan_upt
           or new.tanggapan_sikap is distinct from old.tanggapan_sikap
           or new.tanggapan_oleh  is distinct from old.tanggapan_oleh
           or new.tanggapan_pada  is distinct from old.tanggapan_pada then
            raise exception 'Tanggapan unit hanya dapat ditulis petugas unit yang bersangkutan.'
                using errcode = '42501';
        end if;
        -- Putusan telaah unit milik unit.
        if new.telaah_upt_status  is distinct from old.telaah_upt_status
           or new.telaah_upt_catatan is distinct from old.telaah_upt_catatan
           or new.telaah_upt_oleh    is distinct from old.telaah_upt_oleh
           or new.telaah_upt_pada    is distinct from old.telaah_upt_pada then
            raise exception 'Putusan telaah unit hanya dapat ditulis petugas unit yang bersangkutan.'
                using errcode = '42501';
        end if;
    end if;

    return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Jendela revisi 24 jam, kini untuk kedua lapis
-- -----------------------------------------------------------------------------

create or replace function public.jaga_revisi_telaah()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    -- Lapis kantor wilayah.
    if new.telaah_wilayah_status is not distinct from old.telaah_wilayah_status then
        new.telaah_wilayah_putusan_pertama := old.telaah_wilayah_putusan_pertama;
    elsif old.telaah_wilayah_status is not null
          and old.telaah_wilayah_status <> 'Belum Ditelaah' then
        if public.peran_wilayah()
           and (old.telaah_wilayah_putusan_pertama is null
                or now() - old.telaah_wilayah_putusan_pertama > interval '24 hours') then
            raise exception 'Putusan telaah hanya dapat diubah dalam 24 jam sejak ditetapkan.'
                using errcode = '42501';
        end if;
        new.telaah_wilayah_putusan_pertama := old.telaah_wilayah_putusan_pertama;
    elsif new.telaah_wilayah_status is not null
          and new.telaah_wilayah_status <> 'Belum Ditelaah' then
        new.telaah_wilayah_putusan_pertama := now();
    end if;

    -- Lapis unit.
    if new.telaah_upt_status is not distinct from old.telaah_upt_status then
        new.telaah_upt_putusan_pertama := old.telaah_upt_putusan_pertama;
    elsif old.telaah_upt_status is not null
          and old.telaah_upt_status <> 'Belum Ditelaah' then
        if public.peran_wilayah()
           and (old.telaah_upt_putusan_pertama is null
                or now() - old.telaah_upt_putusan_pertama > interval '24 hours') then
            raise exception 'Putusan telaah hanya dapat diubah dalam 24 jam sejak ditetapkan.'
                using errcode = '42501';
        end if;
        new.telaah_upt_putusan_pertama := old.telaah_upt_putusan_pertama;
    elsif new.telaah_upt_status is not null
          and new.telaah_upt_status <> 'Belum Ditelaah' then
        new.telaah_upt_putusan_pertama := now();
    end if;

    return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Riwayat untuk kedua lapis
-- -----------------------------------------------------------------------------

create or replace function public.catat_riwayat_telaah()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if new.telaah_wilayah_status   is distinct from old.telaah_wilayah_status
       or new.telaah_wilayah_catatan is distinct from old.telaah_wilayah_catatan
       or (new.subkategori is distinct from old.subkategori
           and new.telaah_wilayah_pada is distinct from old.telaah_wilayah_pada) then
        insert into public.telaah_riwayat (
            berita_id, lapis, status_lama, status_baru, catatan_lama, catatan_baru,
            subkategori_lama, subkategori_baru, oleh, pada
        ) values (
            new.id, 'wilayah', old.telaah_wilayah_status, new.telaah_wilayah_status,
            old.telaah_wilayah_catatan, new.telaah_wilayah_catatan,
            old.subkategori, new.subkategori,
            new.telaah_wilayah_oleh, coalesce(new.telaah_wilayah_pada, now())
        );
    end if;

    if new.telaah_upt_status   is distinct from old.telaah_upt_status
       or new.telaah_upt_catatan is distinct from old.telaah_upt_catatan
       or (new.subkategori is distinct from old.subkategori
           and new.telaah_upt_pada is distinct from old.telaah_upt_pada) then
        insert into public.telaah_riwayat (
            berita_id, lapis, status_lama, status_baru, catatan_lama, catatan_baru,
            subkategori_lama, subkategori_baru, oleh, pada
        ) values (
            new.id, 'upt', old.telaah_upt_status, new.telaah_upt_status,
            old.telaah_upt_catatan, new.telaah_upt_catatan,
            old.subkategori, new.subkategori,
            new.telaah_upt_oleh, coalesce(new.telaah_upt_pada, now())
        );
    end if;

    -- Perubahan subkategori oleh pusat (tanpa jejak telaah daerah) tetap tercatat.
    if new.subkategori is distinct from old.subkategori
       and new.telaah_wilayah_pada is not distinct from old.telaah_wilayah_pada
       and new.telaah_upt_pada     is not distinct from old.telaah_upt_pada then
        insert into public.telaah_riwayat (
            berita_id, lapis, status_lama, status_baru, catatan_lama, catatan_baru,
            subkategori_lama, subkategori_baru, oleh, pada
        ) values (
            new.id, 'wilayah', old.telaah_wilayah_status, new.telaah_wilayah_status,
            old.telaah_wilayah_catatan, new.telaah_wilayah_catatan,
            old.subkategori, new.subkategori,
            new.telaah_wilayah_oleh, now()
        );
    end if;
    return null;
end;
$$;

commit;
