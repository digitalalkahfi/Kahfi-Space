-- =====================================================================
-- K-Space V2 — Tempat mendarat ekspor kv_store lama
--
-- PRD menuntut "Ekspor kv_store — tarik data lama sebagai bahan migrasi",
-- tetapi sampai sekarang satu-satunya sumber adalah berkas contoh yang
-- ikut dibundel aplikasi. Akibatnya migrasi sungguhan tidak punya jalan
-- masuk sama sekali: data asli tidak pernah sampai ke basis data baru.
--
-- Tabel ini jalan masuknya. Isinya disalin apa adanya dari sistem lama —
-- satu baris per pasangan kunci-nilai, tanpa ditafsirkan lebih dulu —
-- supaya pemetaan dan penghitungan dikerjakan di sini, bukan di sistem
-- lama yang sudah dibekukan.
--
-- Entitasnya diturunkan dari awalan kunci (`user:123` → `user`) sebagai
-- kolom tersimpan, sehingga penghitungan per entitas tidak perlu memindai
-- ulang seluruh baris setiap kali layar dibuka.
-- =====================================================================

create table kv_store_lama (
  key        text primary key,
  value      jsonb not null,
  entitas    text generated always as (split_part(key, ':', 1)) stored,
  dimuat_pada timestamptz not null default now()
);

create index kv_store_lama_entitas_idx on kv_store_lama (entitas);

comment on table kv_store_lama is
  'Salinan mentah kv_store sistem lama; sumber tunggal migrasi sungguhan.';

-- ---------------------------------------------------------------------
-- Hitungan per entitas — dipakai layar Ekspor dan verifikasi jumlah baris.
-- ---------------------------------------------------------------------
create or replace function ringkas_kv_lama()
returns table (entitas text, jumlah integer)
language sql
stable
as $$
  select k.entitas, count(*)::int
  from kv_store_lama k
  group by k.entitas
  order by k.entitas;
$$;

-- ---------------------------------------------------------------------
-- RLS — isinya memuat data pribadi seluruh karyawan lama.
-- ---------------------------------------------------------------------
alter table kv_store_lama enable row level security;

create policy kv_store_lama_kelola on kv_store_lama
  for all using (lintas_unit()) with check (lintas_unit());
