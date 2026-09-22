-- =====================================================================
-- K-Space V2 — Jejak perubahan status masalah
--
-- Status masalah sudah dijaga tidak melompat tanpa syarat (0053), tetapi
-- perjalanannya tidak tersimpan: kolom `updated_at` hanya berkata "ada
-- yang berubah". Padahal yang paling perlu ditelusuri justru riwayatnya —
-- masalah yang ditutup lalu dibuka lagi, atau dinyatakan selesai dua kali
-- dengan tindakan berbeda, tidak meninggalkan bekas apa pun sekarang.
--
-- Jejaknya terbuka bagi siapa pun yang boleh melihat masalahnya, bukan
-- hanya pengelola: pelapor berhak tahu apa yang terjadi pada masalah yang
-- ia angkat, termasuk kalau masalahnya ditutup tanpa ditindak.
-- =====================================================================

create table problem_events (
  id         uuid primary key default gen_random_uuid(),
  problem_id uuid not null references problems (id) on delete cascade,
  dari       status_masalah,
  ke         status_masalah not null,
  oleh_id    uuid references users (id) on delete set null,
  catatan    text not null default '',
  pada       timestamptz not null default now()
);

create index problem_events_masalah_idx on problem_events (problem_id, pada desc);

comment on table problem_events is
  'Riwayat status masalah; ditulis trigger, tidak pernah diketik langsung.';

-- Ditulis trigger SECURITY DEFINER dengan alasan yang sama seperti 0058:
-- tabel jejak hanya punya policy baca, dan tanpa ini setiap perubahan
-- status akan gagal seluruhnya.
create or replace function catat_status_masalah()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  insert into problem_events (problem_id, dari, ke, oleh_id, catatan)
  values (
    new.id, old.status, new.status, auth.uid(),
    case when new.status = 'ditutup' then new.ditutup_alasan else '' end
  );

  return new;
end;
$$;

drop trigger if exists catat_status_masalah_trg on problems;

create trigger catat_status_masalah_trg
  after update of status on problems
  for each row execute function catat_status_masalah();

-- Jejak tidak disunting maupun dihapus; itulah gunanya.
create or replace function larang_ubah_jejak_masalah()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Jejak status masalah tidak bisa diubah'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists larang_ubah_jejak_masalah_trg on problem_events;

create trigger larang_ubah_jejak_masalah_trg
  before update or delete on problem_events
  for each row execute function larang_ubah_jejak_masalah();

alter table problem_events enable row level security;

create policy problem_events_baca on problem_events
  for select using (exists (select 1 from problems p where p.id = problem_id));
