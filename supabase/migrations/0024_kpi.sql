-- =====================================================================
-- K-Space V2 — KPI skala 1.000 & snapshot bulanan (PRD §3 GRD)
--
-- KPI lama berskala 0–100 sehingga tidak sebanding dengan target GRD.
-- Di sini skalanya 1.000, dengan ambang base/goal/stretch per indikator
-- dan bobot yang menjumlah jadi skor total.
-- =====================================================================

create type sumber_kpi as enum
  ('gmv', 'lead_measure', 'absensi', 'tiket', 'manual');

create type predikat_kpi as enum
  ('Istimewa', 'Baik', 'Cukup', 'Perlu Perbaikan');

create table kpi_definitions (
  id             uuid primary key default gen_random_uuid(),
  jabatan        text not null,
  nama_kpi       text not null,
  periode        text not null default 'bulanan',
  bobot          numeric(5, 2) not null check (bobot > 0),
  satuan         text not null default 'unit',
  skala          int not null default 1000 check (skala = 1000),
  target_base    numeric(16, 2) not null,
  target_goal    numeric(16, 2) not null,
  target_stretch numeric(16, 2) not null,
  sumber_data    sumber_kpi not null default 'manual',
  aktif          boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (jabatan, nama_kpi),
  constraint kpi_tangga_naik check (
    target_base <= target_goal and target_goal <= target_stretch
  )
);

comment on column kpi_definitions.skala is
  'Selalu 1.000 (PRD §2 melarang KPI skala 100).';

-- ---------------------------------------------------------------------
-- Predikat dari skor (PRD §3).
-- ---------------------------------------------------------------------
create or replace function predikat_dari_skor(p_skor numeric)
returns predikat_kpi
language sql
immutable
as $$
  select case
    when p_skor >= 800 then 'Istimewa'::predikat_kpi
    when p_skor >= 650 then 'Baik'::predikat_kpi
    when p_skor >= 500 then 'Cukup'::predikat_kpi
    else 'Perlu Perbaikan'::predikat_kpi
  end;
$$;

/*
 * Skor satu indikator pada skala 1.000.
 *
 * base   → 500  (ambang minimum yang bisa diterima)
 * goal   → 800  (target yang disepakati)
 * stretch→ 1000 (pencapaian luar biasa)
 * Di antaranya diinterpolasi lurus; di bawah base diskalakan proporsional.
 */
create or replace function skor_kpi(
  p_realisasi numeric,
  p_base numeric,
  p_goal numeric,
  p_stretch numeric
)
returns numeric
language sql
immutable
as $$
  select round(least(1000, greatest(0,
    case
      when p_realisasi <= 0 then 0
      when p_base <= 0 then least(1000, p_realisasi / nullif(p_goal, 0) * 800)
      when p_realisasi < p_base then p_realisasi / p_base * 500
      when p_realisasi < p_goal then
        500 + (p_realisasi - p_base) / nullif(p_goal - p_base, 0) * 300
      when p_realisasi < p_stretch then
        800 + (p_realisasi - p_goal) / nullif(p_stretch - p_goal, 0) * 200
      else 1000
    end
  )), 1);
$$;

-- ---------------------------------------------------------------------
-- Snapshot bulanan — dipicu MANUAL oleh Manager (PRD §2: tanpa cron).
-- ---------------------------------------------------------------------
create table kpi_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  periode_bulan date not null check (extract(day from periode_bulan) = 1),
  skor_total    numeric(6, 1) not null check (skor_total between 0 and 1000),
  predikat      predikat_kpi not null,
  detail        jsonb not null default '[]'::jsonb,
  dikunci_oleh  uuid references users (id) on delete set null,
  dikunci_pada  timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, periode_bulan)
);

create index kpi_snapshots_periode_idx on kpi_snapshots (periode_bulan desc);

comment on table kpi_snapshots is
  'Riwayat KPI bulanan; setelah dikunci tidak boleh berubah.';

-- Snapshot yang sudah dikunci bersifat final.
create or replace function jaga_snapshot_terkunci()
returns trigger
language plpgsql
as $$
begin
  if old.dikunci_pada is not null then
    raise exception 'Snapshot KPI % sudah dikunci dan tidak bisa diubah',
      to_char(old.periode_bulan, 'Mon YYYY')
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger kpi_snapshots_jaga_kunci
  before update or delete on kpi_snapshots
  for each row execute function jaga_snapshot_terkunci();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table kpi_definitions enable row level security;
alter table kpi_snapshots enable row level security;

create policy kpi_def_baca on kpi_definitions
  for select using (auth.uid() is not null);
create policy kpi_def_kelola on kpi_definitions
  for all using (lintas_unit()) with check (lintas_unit());

create policy kpi_snap_baca on kpi_snapshots
  for select using (user_id = auth.uid() or boleh_orang(user_id));
create policy kpi_snap_kelola on kpi_snapshots
  for all using (lintas_unit()) with check (lintas_unit());
