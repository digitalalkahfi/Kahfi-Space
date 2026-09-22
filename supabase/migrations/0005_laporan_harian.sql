-- =====================================================================
-- K-Space V2 — Laporan harian (PRD §6)
--
-- Satu-satunya tempat GMV masuk ke sistem. Affiliator melapor per akun
-- (oleh PIC), MCN & TAP melapor per unit (oleh Leader).
-- =====================================================================

create type status_laporan as enum ('terkirim', 'revisi');

create table daily_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete restrict,
  tanggal      date not null,
  account_id   uuid references accounts (id) on delete restrict,
  unit_id      uuid references units (id) on delete restrict,
  gmv          numeric(14, 2) not null check (gmv >= 0),
  catatan      text not null default '',
  status       status_laporan not null default 'terkirim',
  submitted_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Tepat satu sasaran: per akun ATAU per unit, tidak boleh dua-duanya.
  constraint daily_reports_satu_sasaran check (
    (account_id is not null and unit_id is null)
    or (account_id is null and unit_id is not null)
  ),
  -- Pagar kewarasan supaya salah ketik nol tidak merusak rekap.
  constraint daily_reports_gmv_wajar check (gmv <= 100000000000)
);

comment on table daily_reports is
  'GMV diketik manual sambil melihat Partner Center; tidak ada integrasi API.';

-- Unik per sasaran + tanggal (PRD §6) — dua indeks parsial karena
-- sasarannya salah satu dari dua kolom.
create unique index daily_reports_akun_unik
  on daily_reports (account_id, tanggal) where account_id is not null;
create unique index daily_reports_unit_unik
  on daily_reports (unit_id, tanggal) where unit_id is not null;

create index daily_reports_tanggal_idx on daily_reports (tanggal desc);
create index daily_reports_user_idx on daily_reports (user_id, tanggal desc);

create trigger daily_reports_set_updated_at
  before update on daily_reports
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Jejak revisi — angka GMV tidak boleh berubah diam-diam (PRD §2)
-- ---------------------------------------------------------------------
create table daily_report_revisions (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references daily_reports (id) on delete cascade,
  gmv_lama     numeric(14, 2) not null,
  gmv_baru     numeric(14, 2) not null,
  alasan       text not null check (length(btrim(alasan)) >= 10),
  diubah_oleh  uuid references users (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint revisi_harus_berubah check (gmv_lama is distinct from gmv_baru)
);

create index daily_report_revisions_report_idx
  on daily_report_revisions (report_id, created_at);

-- Setiap perubahan gmv otomatis menulis jejak; tidak bisa dilewati aplikasi.
create or replace function catat_revisi_laporan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.gmv is distinct from old.gmv then
    insert into daily_report_revisions
      (report_id, gmv_lama, gmv_baru, alasan, diubah_oleh)
    values (
      old.id,
      old.gmv,
      new.gmv,
      coalesce(
        nullif(btrim(current_setting('app.alasan_revisi', true)), ''),
        'Perbaikan tanpa alasan tercatat'
      ),
      auth.uid()
    );
    new.status := 'revisi';
  end if;
  return new;
end;
$$;

create trigger daily_reports_catat_revisi
  before update of gmv on daily_reports
  for each row execute function catat_revisi_laporan();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table daily_reports enable row level security;
alter table daily_report_revisions enable row level security;

create policy daily_reports_baca on daily_reports
  for select
  using (
    lintas_angka()
    or user_id = auth.uid()
    or boleh_orang(user_id)
    or (account_id is not null and pic_akun(account_id))
    or (unit_id is not null and boleh_unit(unit_id))
  );

-- Melapor hanya untuk sasaran yang memang dipegang.
create policy daily_reports_kirim on daily_reports
  for insert
  with check (
    user_id = auth.uid()
    and (
      (account_id is not null and (pic_akun(account_id) or lintas_unit()))
      or (unit_id is not null and (
            (memimpin_unit() and unit_id = unit_saya()) or lintas_unit()
          ))
    )
  );

create policy daily_reports_perbaiki on daily_reports
  for update
  using (user_id = auth.uid() or lintas_unit())
  with check (user_id = auth.uid() or lintas_unit());

create policy revisi_baca on daily_report_revisions
  for select
  using (
    exists (
      select 1 from daily_reports r
      where r.id = report_id
        and (lintas_angka() or r.user_id = auth.uid() or boleh_orang(r.user_id))
    )
  );

-- Jejak revisi hanya boleh lahir dari trigger; tidak ada policy insert/update/delete.
