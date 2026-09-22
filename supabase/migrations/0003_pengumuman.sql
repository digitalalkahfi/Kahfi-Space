-- =====================================================================
-- K-Space V2 — Pengumuman ber-targeting (PRD §3 Beranda)
--
-- Satu pengumuman bisa ditujukan ke semua orang, ke peran tertentu,
-- atau ke satu unit. Kombinasi keduanya berarti irisan: peran X di unit Y.
-- =====================================================================

create table announcements (
  id             uuid primary key default gen_random_uuid(),
  -- Kunci alami yang dipakai di URL detail: /pengumuman/<slug>.
  slug           text not null unique
                   check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  judul          text not null check (length(btrim(judul)) between 3 and 160),
  ringkasan      text not null default '',
  -- Isi lengkap disimpan per paragraf supaya halaman detail tinggal memetakan.
  isi            text[] not null default '{}',
  -- null = semua peran.
  target_role    peran_pengguna,
  -- null = semua unit.
  target_unit_id uuid references units (id) on delete cascade,
  disematkan     boolean not null default false,
  dibuat_oleh    uuid references users (id) on delete set null,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint announcements_isi_tidak_kosong check (cardinality(isi) > 0)
);

comment on column announcements.slug is
  'Dipakai sebagai alamat halaman detail; stabil walau judul berubah.';
comment on table announcements is
  'Pengumuman manajemen; target_role/target_unit_id null berarti tanpa batas.';
comment on column announcements.published_at is
  'Null berarti draf — belum tampil di beranda siapa pun.';

create index announcements_tayang_idx
  on announcements (published_at desc nulls last);
create index announcements_target_idx
  on announcements (target_role, target_unit_id);

create trigger announcements_set_updated_at
  before update on announcements
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Apakah pengumuman ini untuk saya?
-- ---------------------------------------------------------------------
create or replace function pengumuman_untuk_saya(
  p_target_role peran_pengguna,
  p_target_unit uuid
)
returns boolean
language sql
stable
as $$
  select (p_target_role is null or p_target_role = peran_saya())
     and (p_target_unit is null or p_target_unit = unit_saya() or lintas_unit());
$$;

-- ---------------------------------------------------------------------
-- RLS: semua orang membaca yang ditujukan padanya; hanya CEO/Manager menulis
-- ---------------------------------------------------------------------
alter table announcements enable row level security;

create policy announcements_baca on announcements
  for select
  using (
    published_at is not null
    and published_at <= now()
    and pengumuman_untuk_saya(target_role, target_unit_id)
    or dibuat_oleh = auth.uid()
    or lintas_unit()
  );

create policy announcements_tulis on announcements
  for insert
  with check (lintas_unit() and dibuat_oleh = auth.uid());

create policy announcements_ubah on announcements
  for update
  using (lintas_unit())
  with check (lintas_unit());

create policy announcements_hapus on announcements
  for delete
  using (lintas_unit());
