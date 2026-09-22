-- =====================================================================
-- K-Space V2 — Goal & target (GRD, PRD §3)
--
-- Goal perusahaan diturunkan bertahap: company → manager → leader (unit)
-- → account/staff. Tiap goal dipecah jadi anak tangga bulanan.
-- =====================================================================

create type level_goal as enum
  ('company', 'manager', 'leader', 'account', 'staff');

create type status_goal as enum ('draft', 'aktif', 'selesai', 'dibatalkan');

create table goals (
  id             uuid primary key default gen_random_uuid(),
  judul          text not null check (length(btrim(judul)) >= 3),
  level          level_goal not null,
  pemilik_id     uuid references users (id) on delete set null,
  -- Sasaran struktural: goal unit menempel ke unit, goal akun ke akun.
  unit_id        uuid references units (id) on delete cascade,
  account_id     uuid references accounts (id) on delete cascade,
  parent_goal_id uuid references goals (id) on delete set null,
  satuan         text not null default 'IDR',
  target_base    numeric(16, 2) not null check (target_base >= 0),
  target_goal    numeric(16, 2) not null check (target_goal >= 0),
  target_stretch numeric(16, 2) not null check (target_stretch >= 0),
  bobot          numeric(5, 2) not null default 1 check (bobot > 0),
  periode        text not null,
  dibuat_oleh    uuid references users (id) on delete set null,
  status         status_goal not null default 'aktif',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint goals_tangga_naik check (
    target_base <= target_goal and target_goal <= target_stretch
  ),
  constraint goals_bukan_induk_diri_sendiri
    check (parent_goal_id is distinct from id)
);

comment on column goals.periode is
  'Label periode, mis. "2024" atau "2024-Q4".';

create index goals_pemilik_idx on goals (pemilik_id);
create index goals_unit_idx on goals (unit_id);
create index goals_parent_idx on goals (parent_goal_id);

create trigger goals_set_updated_at
  before update on goals
  for each row execute function set_updated_at();

-- Aturan bisnis PRD §2: maksimal 3 goal aktif per orang.
create or replace function batasi_goal_per_orang()
returns trigger
language plpgsql
as $$
declare
  jumlah int;
begin
  if new.pemilik_id is null or new.status <> 'aktif' then
    return new;
  end if;

  select count(*) into jumlah
  from goals
  where pemilik_id = new.pemilik_id
    and status = 'aktif'
    and id is distinct from new.id;

  if jumlah >= 3 then
    raise exception
      'Maksimal 3 goal aktif per orang; % sudah punya %', new.pemilik_id, jumlah
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger goals_batasi_jumlah
  before insert or update on goals
  for each row execute function batasi_goal_per_orang();

-- ---------------------------------------------------------------------
-- Anak tangga bulanan
-- ---------------------------------------------------------------------
create table goal_months (
  id      uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals (id) on delete cascade,
  -- Selalu tanggal 1; dipagari constraint agar tidak ada bulan kembar.
  bulan   date not null check (extract(day from bulan) = 1),
  target  numeric(16, 2) not null check (target >= 0),
  unique (goal_id, bulan)
);

create index goal_months_bulan_idx on goal_months (bulan);

-- ---------------------------------------------------------------------
-- Target harian = anak tangga bulanan dibagi rata jumlah hari di bulan itu.
-- Inilah "target prorata" yang dipakai matriks WRM.
-- ---------------------------------------------------------------------
create or replace function target_harian_unit(p_tanggal date)
returns table (unit_id uuid, target numeric)
language sql
stable
as $$
  select
    g.unit_id,
    sum(gm.target / extract(day from (date_trunc('month', gm.bulan)
                                      + interval '1 month - 1 day'))::numeric)
  from goals g
  join goal_months gm on gm.goal_id = g.id
  where g.status = 'aktif'
    and g.unit_id is not null
    and g.account_id is null
    and gm.bulan = date_trunc('month', p_tanggal)::date
  group by g.unit_id;
$$;

create or replace function target_harian_akun(p_tanggal date)
returns table (account_id uuid, target numeric)
language sql
stable
as $$
  select
    g.account_id,
    sum(gm.target / extract(day from (date_trunc('month', gm.bulan)
                                      + interval '1 month - 1 day'))::numeric)
  from goals g
  join goal_months gm on gm.goal_id = g.id
  where g.status = 'aktif'
    and g.account_id is not null
    and gm.bulan = date_trunc('month', p_tanggal)::date
  group by g.account_id;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table goals enable row level security;
alter table goal_months enable row level security;

create policy goals_baca on goals
  for select
  using (
    lintas_angka()
    or pemilik_id = auth.uid()
    or boleh_unit(unit_id)
    or (account_id is not null and pic_akun(account_id))
  );

-- PRD §2: goal hanya boleh dibuat CEO/Manager.
create policy goals_buat on goals
  for insert with check (lintas_unit());

create policy goals_ubah on goals
  for update using (lintas_unit()) with check (lintas_unit());

create policy goals_hapus on goals
  for delete using (lintas_unit());

create policy goal_months_baca on goal_months
  for select
  using (exists (select 1 from goals g where g.id = goal_id));

create policy goal_months_kelola on goal_months
  for all using (lintas_unit()) with check (lintas_unit());
