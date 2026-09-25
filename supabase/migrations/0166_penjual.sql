-- =====================================================================
-- K-Space V2 — Penjual: mitra seller & brand yang digarap unit
--
-- Sistem lama punya daftar seller (nama toko, kontak, kategori, komisi,
-- status prospek/aktif) yang dipegang leader TAP. V2 belum punya
-- tempatnya, padahal itulah inti pekerjaan unit TAP: mencari dan menjaga
-- mitra brand. Tabel ini milik unit — tiap unit hanya melihat mitranya
-- sendiri, CEO/Manager/Finance melihat semuanya — dan setiap mitra boleh
-- punya satu PIC, orang di unit itu yang menjadi penghubungnya.
-- =====================================================================

create type status_penjual as enum (
  'prospek',   -- masih dijajaki, belum ada kesepakatan
  'aktif',     -- sudah bekerja sama
  'nonaktif'   -- berhenti atau tidak dilanjutkan
);

create table sellers (
  id            uuid primary key default gen_random_uuid(),
  nama_toko     text not null check (length(trim(nama_toko)) >= 2),
  nama_kontak   text not null default '',
  -- Nomor apa adanya; sistem lama menyimpan beragam bentuk, termasuk nama
  -- aplikasi pesan. Pembakuan ke +62 dikerjakan aplikasi bila bisa.
  telepon       text not null default '',
  kategori      text not null default '',
  status        status_penjual not null default 'prospek',
  -- Komisi dalam persen; kosong bila belum disepakati.
  komisi_persen numeric(5, 2)
    check (komisi_persen is null or (komisi_persen >= 0 and komisi_persen <= 100)),
  catatan       text not null default '',
  unit_id       uuid not null references units (id) on delete restrict,
  pic_user_id   uuid references users (id) on delete set null,
  dibuat_oleh   uuid references users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index sellers_unit_status_idx on sellers (unit_id, status);
create index sellers_pic_idx on sellers (pic_user_id);

comment on table sellers is
  'Mitra penjual/brand yang dijajaki atau digarap sebuah unit; dulu daftar seller di K-Space lama.';
comment on column sellers.komisi_persen is
  'Komisi yang disepakati, dalam persen (0–100); null bila belum ada.';

create trigger sellers_set_updated_at
  before update on sellers
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- PIC harus anggota aktif dari unit mitra itu. RLS tidak bisa memeriksa
-- baris lain, jadi aturannya di trigger.
-- ---------------------------------------------------------------------
create or replace function jaga_pic_penjual()
returns trigger
language plpgsql
as $$
declare
  p record;
begin
  if new.pic_user_id is null then
    return new;
  end if;

  select status, unit_id into p from users where id = new.pic_user_id;
  if p is null or p.status <> 'aktif' then
    raise exception 'PIC penjual harus anggota aktif'
      using errcode = 'check_violation';
  end if;
  -- CEO/Manager/Finance tidak punya unit dan boleh memegang mitra mana pun.
  if p.unit_id is not null and p.unit_id <> new.unit_id then
    raise exception 'PIC penjual harus berasal dari unit mitra itu'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger jaga_pic_penjual_trg
  before insert or update of pic_user_id, unit_id on sellers
  for each row execute function jaga_pic_penjual();

-- ---------------------------------------------------------------------
-- RLS — mitra dilihat unitnya sendiri; CEO/Manager/Finance lintas unit.
-- Yang mengelola: CEO/Manager, Leader/Co-Leader unitnya, dan PIC-nya
-- (untuk memperbarui catatan dan status mitra yang ia pegang).
-- ---------------------------------------------------------------------
alter table sellers enable row level security;

create policy sellers_baca on sellers
  for select using (
    auth.uid() is not null
    and (lintas_angka() or boleh_unit(unit_id))
  );

create policy sellers_kelola on sellers
  for all using (lintas_unit()) with check (lintas_unit());

create policy sellers_unit_kelola on sellers
  for all
  using (memimpin_unit() and unit_id = unit_saya())
  with check (memimpin_unit() and unit_id = unit_saya());

create policy sellers_pic_ubah on sellers
  for update
  using (pic_user_id = auth.uid())
  with check (pic_user_id = auth.uid() and unit_id = unit_saya());
