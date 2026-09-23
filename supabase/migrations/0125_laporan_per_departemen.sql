-- =====================================================================
-- K-Space V2 — Laporan harian per departemen (PRD Fase 1)
--
-- Affiliator melaporkan lebih dari GMV: komisi yang diterima dan berapa
-- konten yang tayang hari itu. MCN & TAP tidak punya kedua angka itu.
--
-- Kolomnya nullable, bukan default 0, supaya "departemen ini memang tidak
-- melaporkannya" tidak tertukar dengan "hari ini nol" saat direkap. Yang
-- menjaga bedanya sebuah trigger, bukan CHECK: aturannya bergantung pada
-- unit akun di tabel lain, dan CHECK tidak boleh membaca tabel lain.
-- =====================================================================

alter table daily_reports
  add column komisi        numeric(14, 2),
  add column jumlah_upload integer;

comment on column daily_reports.komisi is
  'Komisi yang diterima hari itu; null untuk departemen yang tidak melaporkannya.';
comment on column daily_reports.jumlah_upload is
  'Jumlah konten tayang hari itu; null untuk departemen yang tidak melaporkannya.';

alter table daily_reports
  add constraint daily_reports_komisi_wajar check (
    komisi is null or (komisi >= 0 and komisi <= 10000000000)
  ),
  -- Komisi lahir dari transaksi yang sama dengan GMV-nya, jadi tidak
  -- mungkin lebih besar. Salah ketak begini lolos kalau tidak dijaga.
  add constraint daily_reports_komisi_tak_lebih_dari_gmv check (
    komisi is null or komisi <= gmv
  ),
  add constraint daily_reports_upload_wajar check (
    jumlah_upload is null or (jumlah_upload >= 0 and jumlah_upload <= 500)
  );

-- ---------------------------------------------------------------------
-- Departemen sebuah laporan: unit akunnya, atau unit yang dilaporkan.
-- ---------------------------------------------------------------------
create or replace function unit_laporan(
  p_account_id uuid,
  p_unit_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.kode from accounts a join units u on u.id = a.unit_id
      where a.id = p_account_id),
    (select u.kode from units u where u.id = p_unit_id)
  );
$$;

comment on function unit_laporan(uuid, uuid) is
  'Kode unit sebuah laporan harian, dari akunnya atau dari unitnya sendiri.';

create or replace function jaga_kolom_departemen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kode text;
begin
  kode := unit_laporan(new.account_id, new.unit_id);

  if kode is distinct from 'affiliator'
     and (new.komisi is not null or new.jumlah_upload is not null)
  then
    raise exception
      'Departemen % hanya melaporkan GMV dan catatan', coalesce(kode, '?')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger daily_reports_jaga_kolom_departemen
  before insert or update of account_id, unit_id, komisi, jumlah_upload
  on daily_reports
  for each row execute function jaga_kolom_departemen();
