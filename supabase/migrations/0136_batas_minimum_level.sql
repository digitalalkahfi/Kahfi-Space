-- =====================================================================
-- K-Space V2 — Tabel referensi batas minimum unggahan per level
--
-- Tiap akun affiliator punya level 0–8, dan tiap level menuntut sejumlah
-- unggahan minimum per hari kerja. Angkanya ditaruh di tabel, bukan
-- ditanam di dalam fungsi: standar seperti ini berubah lewat keputusan
-- manajemen, dan perubahan yang menuntut migrasi baru selalu berakhir
-- sebagai angka yang tidak pernah diperbarui.
--
-- Deretnya sengaja tidak menaik rata. Level 3 dan 4 sama (10), begitu
-- pula 7 dan 8 (20): kenaikan level di sana menambah tanggung jawab
-- lain, bukan menambah jumlah unggahan.
-- =====================================================================

create table batas_minimum_level (
  level            smallint primary key check (level between 0 and 8),
  minimum_unggahan integer not null check (minimum_unggahan > 0),
  updated_at       timestamptz not null default now()
);

comment on table batas_minimum_level is
  'Acuan batas minimum unggahan harian tiap level akun (0–8).';
comment on column batas_minimum_level.minimum_unggahan is
  'Jumlah unggahan minimum per hari kerja; dipakai layar dan rekap massal.';

create trigger batas_minimum_level_set_updated_at
  before update on batas_minimum_level
  for each row execute function set_updated_at();

insert into batas_minimum_level (level, minimum_unggahan) values
  (0, 3), (1, 5), (2, 7), (3, 10), (4, 10),
  (5, 12), (6, 15), (7, 20), (8, 20)
on conflict (level) do update
  set minimum_unggahan = excluded.minimum_unggahan;

-- ---------------------------------------------------------------------
-- Pembacaan sebuah level. Mengembalikan null untuk level yang belum
-- ditetapkan — bukan nol, karena "tanpa level" dan "minimumnya nol"
-- adalah dua hal berbeda, dan yang kedua tidak pernah terjadi.
-- ---------------------------------------------------------------------
create or replace function batas_minimum(p_level smallint)
returns integer
language sql
stable
set search_path = public
as $$
  select b.minimum_unggahan
  from batas_minimum_level b
  where b.level = p_level;
$$;

comment on function batas_minimum(smallint) is
  'Batas minimum unggahan sebuah level; null bila levelnya tidak dikenal.';

-- ---------------------------------------------------------------------
-- RLS — acuan yang dibaca semua orang, diubah manajemen.
-- ---------------------------------------------------------------------
alter table batas_minimum_level enable row level security;

create policy batas_minimum_baca on batas_minimum_level
  for select using (auth.uid() is not null);

create policy batas_minimum_kelola on batas_minimum_level
  for all using (lintas_unit()) with check (lintas_unit());
