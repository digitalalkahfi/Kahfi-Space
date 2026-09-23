-- =====================================================================
-- K-Space V2 — Level akun 0–8 beserta riwayat perubahannya
--
-- Level menentukan batas minimum unggahan sebuah akun, dan batas itu
-- dipakai menilai kepatuhan orang yang memegangnya. Karena itu ia bukan
-- keterangan biasa: menaikkan atau menurunkan level mengubah standar
-- yang dipakai menilai kerja seseorang.
--
-- Perubahan seperti itu harus bisa ditelusuri — kapan, dari berapa ke
-- berapa, oleh siapa — jadi jejaknya ditulis trigger, bukan aplikasi.
-- Yang ditulis aplikasi bisa terlewat lewat jalur lain.
-- =====================================================================

alter table accounts
  add column level smallint
    references batas_minimum_level (level) on update cascade;

comment on column accounts.level is
  'Level akun 0–8; menentukan batas minimum unggahan hariannya. Null berarti belum ditetapkan.';

create index accounts_level_idx on accounts (level) where level is not null;

-- ---------------------------------------------------------------------
-- Riwayat perubahan level
-- ---------------------------------------------------------------------
create table account_level_events (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts (id) on delete cascade,
  dari        smallint,
  ke          smallint,
  oleh_id     uuid references users (id) on delete set null,
  alasan      text not null default '',
  created_at  timestamptz not null default now(),
  constraint level_harus_berubah check (dari is distinct from ke)
);

create index account_level_events_akun_idx
  on account_level_events (account_id, created_at desc);

comment on table account_level_events is
  'Jejak tiap perubahan level akun; tidak bisa disunting maupun dihapus.';

create or replace function catat_level_akun()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.level is distinct from old.level then
    insert into account_level_events (account_id, dari, ke, oleh_id, alasan)
    values (
      old.id,
      old.level,
      new.level,
      auth.uid(),
      coalesce(
        nullif(btrim(current_setting('app.alasan_level', true)), ''),
        ''
      )
    );
  end if;
  return new;
end;
$$;

create trigger accounts_catat_level
  after update of level on accounts
  for each row execute function catat_level_akun();

-- Level pertama sebuah akun juga peristiwa: tanpa ini, akun yang lahir
-- langsung berlevel tidak punya baris awal di riwayatnya.
create or replace function catat_level_akun_baru()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.level is not null then
    insert into account_level_events (account_id, dari, ke, oleh_id)
    values (new.id, null, new.level, auth.uid());
  end if;
  return new;
end;
$$;

create trigger accounts_catat_level_baru
  after insert on accounts
  for each row execute function catat_level_akun_baru();

-- Jejak lahir dari trigger; tidak ada jalan menyuntingnya.
--
-- Yang dijaga trigger hanya UPDATE. DELETE sengaja dibiarkan lewat,
-- karena yang memakainya adalah cascade saat akunnya sendiri dihapus —
-- riwayat level tanpa akunnya tidak menjelaskan apa pun. Penghapusan
-- langsung oleh orang tetap tertutup: tabel ini tidak punya policy
-- delete sama sekali, jadi RLS menolaknya.
create or replace function larang_ubah_jejak_level()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Riwayat level akun tidak bisa diubah'
    using errcode = 'check_violation';
end;
$$;

create trigger account_level_events_larang_ubah
  before update on account_level_events
  for each row execute function larang_ubah_jejak_level();

-- ---------------------------------------------------------------------
-- RLS — riwayat level mengikuti akunnya.
-- ---------------------------------------------------------------------
alter table account_level_events enable row level security;

create policy account_level_events_baca on account_level_events
  for select using (
    exists (select 1 from accounts a where a.id = account_id)
  );

-- Tidak ada policy insert/update/delete: barisnya hanya lahir dari trigger.
