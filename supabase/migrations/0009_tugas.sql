-- =====================================================================
-- K-Space V2 — Tugas (PRD §3)
--
-- Satu tabel menampung to-do pribadi, tiket dari atasan, dan tiket
-- komitmen mingguan yang terhubung ke goal — supaya daftar kerja
-- seseorang benar-benar berkumpul di satu tempat.
-- =====================================================================

create type tipe_tugas as enum ('pribadi', 'tiket', 'komitmen_mingguan');
create type status_tugas as enum
  ('todo', 'berjalan', 'menunggu_qc', 'revisi', 'selesai', 'dibatalkan');
create type prioritas_tugas as enum ('rendah', 'sedang', 'tinggi');
create type status_qc as enum ('belum', 'lolos', 'revisi');

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  tipe        tipe_tugas not null default 'pribadi',
  goal_id     uuid references goals (id) on delete set null,
  judul       text not null check (length(btrim(judul)) between 3 and 200),
  deskripsi   text not null default '',
  konteks     text not null default '',
  pembuat_id  uuid not null references users (id) on delete restrict,
  penerima_id uuid not null references users (id) on delete restrict,
  tenggat     timestamptz,
  prioritas   prioritas_tugas not null default 'sedang',
  status      status_tugas not null default 'todo',
  qc_status   status_qc not null default 'belum',
  qc_by       uuid references users (id) on delete set null,
  qc_note     text not null default '',
  qc_at       timestamptz,
  selesai_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- To-do pribadi selalu milik pembuatnya sendiri.
  constraint tasks_pribadi_milik_sendiri check (
    tipe <> 'pribadi' or pembuat_id = penerima_id
  ),
  -- Komitmen mingguan harus menempel pada sebuah goal.
  constraint tasks_komitmen_punya_goal check (
    tipe <> 'komitmen_mingguan' or goal_id is not null
  )
);

comment on table tasks is
  'To-do pribadi + tiket atasan + komitmen mingguan dalam satu daftar.';

create index tasks_penerima_idx on tasks (penerima_id, status, tenggat);
create index tasks_pembuat_idx on tasks (pembuat_id, created_at desc);
create index tasks_tenggat_idx on tasks (tenggat) where status <> 'selesai';

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- Menjaga konsistensi status ↔ QC tanpa mengandalkan aplikasi.
create or replace function jaga_status_tugas()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'selesai' and old.status is distinct from 'selesai' then
    new.selesai_at := now();
  elsif new.status <> 'selesai' then
    new.selesai_at := null;
  end if;

  if new.qc_status is distinct from old.qc_status and new.qc_status <> 'belum' then
    new.qc_at := now();
    new.qc_by := coalesce(new.qc_by, auth.uid());
    -- QC lolos menutup tugas; minta revisi mengembalikannya ke pengerjaan.
    new.status := case new.qc_status
                    when 'lolos' then 'selesai'::status_tugas
                    when 'revisi' then 'revisi'::status_tugas
                    else new.status
                  end;
    if new.status = 'selesai' then
      new.selesai_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_jaga_status
  before update on tasks
  for each row execute function jaga_status_tugas();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table tasks enable row level security;

create policy tasks_baca on tasks
  for select
  using (
    penerima_id = auth.uid()
    or pembuat_id = auth.uid()
    or lintas_unit()
    or boleh_orang(penerima_id)
  );

-- To-do untuk diri sendiri boleh siapa saja; menugasi orang lain hanya
-- boleh dilakukan atasannya (atau CEO/Manager).
create policy tasks_buat on tasks
  for insert
  with check (
    pembuat_id = auth.uid()
    and (
      penerima_id = auth.uid()
      or lintas_unit()
      or atasan_dari(penerima_id) = auth.uid()
      or (memimpin_unit() and boleh_orang(penerima_id))
    )
  );

create policy tasks_ubah on tasks
  for update
  using (
    penerima_id = auth.uid()
    or pembuat_id = auth.uid()
    or lintas_unit()
    or boleh_orang(penerima_id)
  )
  with check (
    penerima_id = auth.uid()
    or pembuat_id = auth.uid()
    or lintas_unit()
    or boleh_orang(penerima_id)
  );

-- Hanya pembuat (atau CEO/Manager) yang boleh menghapus.
create policy tasks_hapus on tasks
  for delete using (pembuat_id = auth.uid() or lintas_unit());

-- ---------------------------------------------------------------------
-- QC tidak boleh dilakukan sendiri.
--
-- Policy update sengaja longgar supaya penerima bisa menggeser statusnya
-- sendiri (todo → berjalan → menunggu_qc). Tapi memutuskan lolos/revisi
-- adalah wewenang pemberi tugas atau atasan — dijaga di sini, bukan di
-- aplikasi, supaya tidak bisa dilangkahi lewat API.
-- ---------------------------------------------------------------------
create or replace function larang_qc_sendiri()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.qc_status is distinct from old.qc_status
     and new.qc_status <> 'belum'
     and old.tipe <> 'pribadi'
     and auth.uid() = old.penerima_id
     and auth.uid() is distinct from old.pembuat_id then
    raise exception 'Pemeriksaan (QC) harus dilakukan pemberi tugas atau atasan'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- Dijalankan sebelum jaga_status_tugas (urut abjad nama trigger).
create trigger tasks_a_larang_qc_sendiri
  before update on tasks
  for each row execute function larang_qc_sendiri();
