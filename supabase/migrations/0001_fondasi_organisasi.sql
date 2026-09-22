-- =====================================================================
-- K-Space V2 — Fondasi organisasi & pengguna (PRD §6)
-- departments, units, programs, users, accounts + helper peran/unit.
-- =====================================================================

-- gen_random_uuid() sudah bawaan PostgreSQL 13+, tidak perlu ekstensi pgcrypto.

-- ---------------------------------------------------------------------
-- Enum domain
-- ---------------------------------------------------------------------
create type peran_pengguna as enum (
  'CEO', 'Manager', 'Leader', 'Co-Leader', 'Staff', 'Finance'
);

create type status_aktif as enum ('aktif', 'nonaktif');

-- ---------------------------------------------------------------------
-- Struktur organisasi
-- ---------------------------------------------------------------------
create table departments (
  id         uuid primary key default gen_random_uuid(),
  nama       text not null unique,
  created_at timestamptz not null default now()
);

comment on table departments is
  'Lima departemen perusahaan: MCN, TAP, Affiliator, MMC, Mabit Scholar.';

-- Unit pelaporan hanya 3 (Affiliator, MCN, TAP). Kode dipakai di kode aplikasi
-- supaya tidak perlu menebak uuid.
create table units (
  id            uuid primary key default gen_random_uuid(),
  kode          text not null unique
                  check (kode in ('affiliator', 'mcn', 'tap')),
  nama          text not null,
  department_id uuid references departments (id) on delete set null,
  deskripsi     text not null default '',
  created_at    timestamptz not null default now()
);

comment on table units is
  'Tiga unit pelaporan. MCN menampung MMC sebagai pendukung.';

-- Program adalah atribut pada akun (mis. Mabit Scholar), bukan unit terpisah.
create table programs (
  id         uuid primary key default gen_random_uuid(),
  nama       text not null,
  unit_id    uuid not null references units (id) on delete cascade,
  aktif      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (unit_id, nama)
);

-- ---------------------------------------------------------------------
-- Pengguna — satu baris per anggota tim, id mengikuti auth.users
-- ---------------------------------------------------------------------
create table users (
  id            uuid primary key,
  nama          text not null,
  email         text,
  role          peran_pengguna not null,
  jabatan       text not null default '',
  department_id uuid references departments (id) on delete set null,
  unit_id       uuid references units (id) on delete set null,
  program_id    uuid references programs (id) on delete set null,
  atasan_id     uuid references users (id) on delete set null,
  foto_url      text,
  status        status_aktif not null default 'aktif',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Atasan tidak boleh dirinya sendiri; rantai lebih dalam dijaga aplikasi.
  constraint users_atasan_bukan_diri_sendiri check (atasan_id is distinct from id)
);

comment on column users.id is
  'Sama dengan auth.users.id — profil ini yang dibaca RLS.';

-- Email dibandingkan tanpa peduli huruf besar/kecil, tanpa perlu ekstensi citext.
create unique index users_email_unik on users (lower(email)) where email is not null;

create index users_unit_idx on users (unit_id);
create index users_atasan_idx on users (atasan_id);

-- ---------------------------------------------------------------------
-- Akun affiliator — dasar target GRD dan sasaran laporan harian
-- ---------------------------------------------------------------------
create table accounts (
  id           uuid primary key default gen_random_uuid(),
  platform     text not null default 'TikTok Shop',
  username     text not null,
  pic_user_id  uuid references users (id) on delete set null,
  co_leader_id uuid references users (id) on delete set null,
  unit_id      uuid not null references units (id) on delete restrict,
  program_id   uuid references programs (id) on delete set null,
  status       status_aktif not null default 'aktif',
  created_at   timestamptz not null default now(),
  unique (platform, username)
);

create index accounts_pic_idx on accounts (pic_user_id);
create index accounts_unit_idx on accounts (unit_id);

-- ---------------------------------------------------------------------
-- updated_at otomatis
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();
