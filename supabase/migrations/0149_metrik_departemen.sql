-- =====================================================================
-- K-Space V2 — Acuan metrik laporan per departemen
--
-- Kolom mana yang diisi tiap departemen selama ini hidup di dua tempat:
-- konstanta `KOLOM_PER_UNIT` di `src/lib/laporan.ts`, dan trigger
-- `jaga_kolom_departemen` (migrasi 0125) yang menolak kolom Affiliator
-- pada laporan unit lain. Keduanya benar hari ini karena kebetulan
-- ditulis bersamaan — bukan karena ada yang menjaganya tetap sama.
--
-- Tabel ini menjadikannya data: satu baris per (unit, metrik). Yang
-- menegakkan aturannya tetap trigger — tabel ini acuan yang bisa dibaca
-- layar dan dibandingkan tes, bukan pengganti penjagaan.
-- =====================================================================

create table metrik_departemen (
  unit_kode text not null check (unit_kode in ('affiliator', 'mcn', 'tap')),
  -- Nama metrik memakai ejaan kode aplikasi (camelCase), bukan nama
  -- kolom database: yang dibandingkan dengan tabel ini adalah
  -- `KolomLaporan`, dan menerjemahkannya dua kali hanya menambah satu
  -- tempat lagi yang bisa salah.
  metrik    text not null check (
    metrik in ('gmv', 'komisi', 'jumlahUpload', 'coSampel', 'catatan')
  ),
  -- Urutan tampil di form; GMV selalu lebih dulu.
  urutan    smallint not null check (urutan > 0),
  wajib     boolean not null default false,

  primary key (unit_kode, metrik)
);

comment on table metrik_departemen is
  'Acuan kolom laporan harian tiap departemen; padanan KOLOM_PER_UNIT di kode aplikasi.';

insert into metrik_departemen (unit_kode, metrik, urutan, wajib) values
  -- Affiliator melapor angka turunan; CO sampel dihitung, tidak diketik.
  ('affiliator', 'gmv',          1, true),
  ('affiliator', 'komisi',       2, false),
  ('affiliator', 'jumlahUpload', 3, false),
  ('affiliator', 'coSampel',     4, false),
  ('affiliator', 'catatan',      5, false),
  -- MCN & TAP melapor di tingkat unit: cukup GMV dan catatan.
  ('mcn',        'gmv',          1, true),
  ('mcn',        'catatan',      2, false),
  ('tap',        'gmv',          1, true),
  ('tap',        'catatan',      2, false);

-- ---------------------------------------------------------------------
-- Kolom yang berlaku bagi sebuah unit, urut seperti di form.
-- ---------------------------------------------------------------------
create or replace function metrik_unit(p_unit text)
returns table (metrik text, urutan smallint, wajib boolean)
language sql
stable
set search_path = public
as $$
  select m.metrik, m.urutan, m.wajib
  from metrik_departemen m
  where m.unit_kode = p_unit
  order by m.urutan;
$$;

comment on function metrik_unit(text) is
  'Kolom laporan harian yang berlaku bagi sebuah unit, urut tampil.';

-- ---------------------------------------------------------------------
-- RLS — acuan yang dibaca semua orang, diubah manajemen.
-- ---------------------------------------------------------------------
alter table metrik_departemen enable row level security;

create policy metrik_departemen_baca on metrik_departemen
  for select using (auth.uid() is not null);

create policy metrik_departemen_kelola on metrik_departemen
  for all using (lintas_unit()) with check (lintas_unit());
