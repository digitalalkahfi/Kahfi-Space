-- =====================================================================
-- K-Space V2 — Lead measure / papan skor mingguan (PRD §3 GRD)
--
-- Goal mengukur HASIL (lagging). Lead measure mengukur LANGKAH yang
-- diyakini menghasilkan hasil itu — jam live, kreator yang di-bind,
-- video yang tayang. Realisasinya dicatat harian.
-- =====================================================================

create table lead_measures (
  id              uuid primary key default gen_random_uuid(),
  goal_id         uuid not null references goals (id) on delete cascade,
  judul           text not null check (length(btrim(judul)) >= 3),
  satuan          text not null default 'unit',
  target_mingguan numeric(14, 2) not null check (target_mingguan > 0),
  -- Sebagian lead measure punya angka pendukung, mis. peserta hadir MMC.
  label_pendukung text,
  aktif           boolean not null default true,
  urutan          int not null default 0,
  created_at      timestamptz not null default now()
);

create index lead_measures_goal_idx on lead_measures (goal_id) where aktif;

comment on table lead_measures is
  'Papan skor langkah kunci; maksimal 1–3 per goal sesuai PRD.';

-- PRD §3: 1–3 lead measure per goal.
create or replace function batasi_lead_measure()
returns trigger
language plpgsql
as $$
declare
  jumlah int;
begin
  if not new.aktif then return new; end if;

  select count(*) into jumlah
  from lead_measures
  where goal_id = new.goal_id and aktif and id is distinct from new.id;

  if jumlah >= 3 then
    raise exception 'Maksimal 3 lead measure aktif per goal'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger lead_measures_batasi
  before insert or update on lead_measures
  for each row execute function batasi_lead_measure();

-- ---------------------------------------------------------------------
-- Entri harian
-- ---------------------------------------------------------------------
create table lead_measure_entries (
  id              uuid primary key default gen_random_uuid(),
  lead_measure_id uuid not null references lead_measures (id) on delete cascade,
  user_id         uuid references users (id) on delete set null,
  tanggal         date not null,
  nilai           numeric(14, 2) not null check (nilai >= 0),
  nilai_pendukung numeric(14, 2) check (nilai_pendukung >= 0),
  catatan         text not null default '',
  created_at      timestamptz not null default now(),
  unique (lead_measure_id, tanggal)
);

create index lme_tanggal_idx on lead_measure_entries (tanggal desc);

comment on column lead_measure_entries.nilai_pendukung is
  'Angka pendamping, mis. peserta hadir MMC pada tanggal acara.';

-- ---------------------------------------------------------------------
-- Capaian mingguan sebuah lead measure (Senin–Minggu).
-- ---------------------------------------------------------------------
create or replace function awal_pekan(p_tanggal date)
returns date
language sql
immutable
as $$
  -- ISO: Senin sebagai hari pertama.
  select (p_tanggal - ((extract(isodow from p_tanggal)::int - 1)))::date;
$$;

create or replace function capaian_lead_measure(
  p_lead uuid,
  p_tanggal date
)
returns table (realisasi numeric, target numeric, rasio numeric)
language sql
stable
as $$
  select
    coalesce(sum(e.nilai), 0),
    lm.target_mingguan,
    case when lm.target_mingguan > 0
      then round(coalesce(sum(e.nilai), 0) / lm.target_mingguan * 100, 1)
      else 0 end
  from lead_measures lm
  left join lead_measure_entries e
    on e.lead_measure_id = lm.id
   and e.tanggal between awal_pekan(p_tanggal) and awal_pekan(p_tanggal) + 6
  where lm.id = p_lead
  group by lm.target_mingguan;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table lead_measures enable row level security;
alter table lead_measure_entries enable row level security;

create policy lead_measures_baca on lead_measures
  for select
  using (exists (select 1 from goals g where g.id = goal_id));

create policy lead_measures_kelola on lead_measures
  for all using (lintas_unit()) with check (lintas_unit());

create policy lme_baca on lead_measure_entries
  for select
  using (
    exists (select 1 from lead_measures lm where lm.id = lead_measure_id)
  );

-- Siapa pun yang bisa melihat lead measure-nya boleh mengisi realisasi harian;
-- itu memang pekerjaan lapangan, bukan wewenang manajerial.
create policy lme_isi on lead_measure_entries
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from lead_measures lm where lm.id = lead_measure_id)
  );

create policy lme_ubah on lead_measure_entries
  for update
  using (user_id = auth.uid() or lintas_unit())
  with check (user_id = auth.uid() or lintas_unit());
