-- =====================================================================
-- K-Space V2 — Laporan mingguan (Matriks WRM) & jejak audit (PRD §3, §6)
--
-- Matriks WRM menyilangkan dua sumbu:
--   Hasil  = capaian GMV terhadap target mingguan   (lagging)
--   KRI    = capaian lead measure terhadap targetnya (leading)
-- Kombinasinya menghasilkan satu keputusan yang bisa ditindaklanjuti.
-- =====================================================================

create type warna_wrm as enum ('hijau', 'merah');
create type keputusan_wrm as enum ('LANJUT', 'SABAR', 'ALARM', 'UBAH CARA');

/*
 * Matriks keputusan:
 *   Hasil hijau + KRI hijau → LANJUT     (cara jalan, hasil datang)
 *   Hasil hijau + KRI merah → SABAR      (hasil bagus tapi langkahnya rapuh)
 *   Hasil merah + KRI hijau → ALARM      (langkah jalan, asumsinya salah)
 *   Hasil merah + KRI merah → UBAH CARA  (eksekusi dan rencana dua-duanya)
 */
create or replace function keputusan_wrm(p_hasil warna_wrm, p_kri warna_wrm)
returns keputusan_wrm
language sql
immutable
as $$
  select case
    when p_hasil = 'hijau' and p_kri = 'hijau' then 'LANJUT'::keputusan_wrm
    when p_hasil = 'hijau' and p_kri = 'merah' then 'SABAR'::keputusan_wrm
    when p_hasil = 'merah' and p_kri = 'hijau' then 'ALARM'::keputusan_wrm
    else 'UBAH CARA'::keputusan_wrm
  end;
$$;

create table weekly_reports (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users (id) on delete cascade,
  unit_id         uuid references units (id) on delete cascade,
  periode         date not null check (extract(isodow from periode) = 1),
  target_mingguan numeric(16, 2) not null default 0,
  gmv_total       numeric(16, 2) not null default 0,
  rasio_hasil     numeric(6, 1) not null default 0,
  rasio_kri       numeric(6, 1) not null default 0,
  status_hasil    warna_wrm not null,
  status_kri      warna_wrm not null,
  keputusan       keputusan_wrm not null,
  merah_beruntun  int not null default 0 check (merah_beruntun >= 0),
  ringkasan       text not null default '',
  skor_kpi        numeric(6, 1),
  generated_at    timestamptz not null default now(),

  -- Laporan menyasar satu orang ATAU satu unit, tidak keduanya.
  constraint weekly_satu_sasaran check (
    (user_id is not null and unit_id is null)
    or (user_id is null and unit_id is not null)
  )
);

create unique index weekly_unit_unik
  on weekly_reports (unit_id, periode) where unit_id is not null;
create unique index weekly_user_unik
  on weekly_reports (user_id, periode) where user_id is not null;

comment on column weekly_reports.merah_beruntun is
  'Berapa pekan berturut-turut hasilnya merah; 2+ perlu perhatian khusus.';

-- Keputusan & penandaan merah beruntun diisi otomatis, bukan diketik.
create or replace function lengkapi_laporan_mingguan()
returns trigger
language plpgsql
as $$
declare
  sebelumnya weekly_reports;
begin
  new.keputusan := keputusan_wrm(new.status_hasil, new.status_kri);

  select * into sebelumnya
  from weekly_reports w
  where w.periode = new.periode - 7
    and w.unit_id is not distinct from new.unit_id
    and w.user_id is not distinct from new.user_id;

  new.merah_beruntun := case
    when new.status_hasil = 'merah'
      then coalesce(sebelumnya.merah_beruntun, 0) + 1
    else 0
  end;

  return new;
end;
$$;

create trigger weekly_lengkapi
  before insert or update on weekly_reports
  for each row execute function lengkapi_laporan_mingguan();

-- ---------------------------------------------------------------------
-- Jejak audit perubahan target/goal (PRD §2: tidak boleh diubah surut
-- tanpa jejak).
-- ---------------------------------------------------------------------
create table audit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users (id) on delete set null,
  aksi       text not null,
  entitas    text not null,
  entitas_id uuid,
  nilai_lama jsonb,
  nilai_baru jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entitas_idx on audit_logs (entitas, entitas_id, created_at desc);

create or replace function catat_audit_goal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_logs (user_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger goals_audit
  after insert or update or delete on goals
  for each row execute function catat_audit_goal();

create trigger goal_months_audit
  after insert or update or delete on goal_months
  for each row execute function catat_audit_goal();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table weekly_reports enable row level security;
alter table audit_logs enable row level security;

create policy weekly_baca on weekly_reports
  for select
  using (
    lintas_angka()
    or (user_id is not null and boleh_orang(user_id))
    or (unit_id is not null and boleh_unit(unit_id))
  );

create policy weekly_kelola on weekly_reports
  for all using (lintas_unit()) with check (lintas_unit());

-- Jejak audit hanya dibaca CEO/Manager; ditulis trigger, bukan pengguna.
create policy audit_baca on audit_logs
  for select using (lintas_unit());
