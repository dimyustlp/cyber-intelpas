-- Revisi putusan telaah wilayah dalam 24 jam, dengan riwayat perubahan.
--
-- Putusan telaah yang sudah tersimpan semula tidak bisa diubah. Sekarang
-- penelaah wilayah boleh merevisinya selama 24 jam sejak putusan pertama.
-- Jendela itu dihitung dari putusan pertama, bukan dari revisi terakhir, supaya
-- tidak bisa diperpanjang dengan terus-menerus merevisi.
--
-- Setiap perubahan putusan atau catatan dicatat di telaah_riwayat, sehingga
-- penelaahan yang dibatalkan tetap terlihat jejaknya.

begin;

-- -----------------------------------------------------------------------------
-- 1. Waktu putusan pertama
-- -----------------------------------------------------------------------------

alter table public.berita
    add column if not exists telaah_wilayah_putusan_pertama timestamptz;

-- Berita yang sudah punya putusan sebelum migrasi ini dianggap putusannya
-- sudah tetap: diisi dari waktu penelaahan terakhir yang tercatat.
update public.berita
   set telaah_wilayah_putusan_pertama = telaah_wilayah_pada
 where telaah_wilayah_putusan_pertama is null
   and telaah_wilayah_status is not null
   and telaah_wilayah_status <> 'Belum Ditelaah'
   and telaah_wilayah_pada is not null;

-- -----------------------------------------------------------------------------
-- 2. Riwayat putusan
-- -----------------------------------------------------------------------------

create table if not exists public.telaah_riwayat (
    id               bigserial primary key,
    berita_id        uuid not null references public.berita (id) on delete cascade,
    status_lama      text,
    status_baru      text,
    catatan_lama     text,
    catatan_baru     text,
    subkategori_lama text,
    subkategori_baru text,
    oleh             text,
    pada             timestamptz not null default now()
);

create index if not exists telaah_riwayat_berita_idx
    on public.telaah_riwayat (berita_id, pada desc);

alter table public.telaah_riwayat enable row level security;

-- Riwayat terlihat oleh siapa pun yang boleh melihat beritanya. Subkueri ke
-- berita dijalankan dengan hak pemanggil, jadi RLS berita ikut berlaku.
drop policy if exists telaah_riwayat_select on public.telaah_riwayat;
create policy telaah_riwayat_select on public.telaah_riwayat
    for select to authenticated
    using (
        exists (select 1 from public.berita b where b.id = telaah_riwayat.berita_id)
    );

-- Tidak ada policy tulis. Hanya pemicu di bawah yang menulis riwayat.
grant select on public.telaah_riwayat to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Penjagaan 24 jam
-- -----------------------------------------------------------------------------
-- Dijalankan sebelum pemicu jaga_sunting_wilayah (urutan nama), sehingga
-- penulisan telaah_wilayah_putusan_pertama di sini tidak bisa dipalsukan dari
-- peramban.

create or replace function public.jaga_revisi_telaah()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_sudah_putus boolean;
begin
    v_sudah_putus := old.telaah_wilayah_status is not null
                     and old.telaah_wilayah_status <> 'Belum Ditelaah';

    -- Waktu putusan pertama tidak pernah ditulis langsung oleh peramban.
    if new.telaah_wilayah_status is not distinct from old.telaah_wilayah_status then
        new.telaah_wilayah_putusan_pertama := old.telaah_wilayah_putusan_pertama;
        return new;
    end if;

    if v_sudah_putus then
        -- Revisi hanya boleh dalam 24 jam sejak putusan pertama. Pusat tidak
        -- dibatasi, sesuai pemicu jaga_sunting_wilayah.
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

    return new;
end;
$$;

drop trigger if exists berita_a_jaga_revisi_telaah on public.berita;
create trigger berita_a_jaga_revisi_telaah
    before update on public.berita
    for each row execute function public.jaga_revisi_telaah();

-- -----------------------------------------------------------------------------
-- 4. Pencatatan riwayat
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
       or new.subkategori            is distinct from old.subkategori then
        insert into public.telaah_riwayat (
            berita_id, status_lama, status_baru, catatan_lama, catatan_baru,
            subkategori_lama, subkategori_baru, oleh, pada
        ) values (
            new.id, old.telaah_wilayah_status, new.telaah_wilayah_status,
            old.telaah_wilayah_catatan, new.telaah_wilayah_catatan,
            old.subkategori, new.subkategori,
            new.telaah_wilayah_oleh, coalesce(new.telaah_wilayah_pada, now())
        );
    end if;
    return null;
end;
$$;

drop trigger if exists berita_catat_riwayat_telaah on public.berita;
create trigger berita_catat_riwayat_telaah
    after update on public.berita
    for each row execute function public.catat_riwayat_telaah();

commit;
