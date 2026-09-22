-- =====================================================================
-- K-Space V2 — Rantai roll-down goal dijaga database
--
-- `parent_goal_id` hanya dipagari "bukan dirinya sendiri" (0006). Semua
-- aturan roll-down PRD lainnya baru ada di kepala penyusun seed:
--
--   * goal company boleh menggantung di bawah goal staf, membalik arah
--     penurunan target — `pohon_goal` lalu menampilkan pohon terbalik;
--   * A menjadi induk B dan B induk A membuat penelusuran pohonnya
--     berputar tanpa ujung;
--   * goal akun unit Affiliator bisa menggantung ke goal unit MCN,
--     sehingga rekap unit menjumlahkan akun yang bukan miliknya.
--
-- Tangga levelnya: company > manager > leader > account > staff. Induk
-- harus berada lebih tinggi di tangga itu, dan bila keduanya terikat
-- unit, unitnya harus sama.
-- =====================================================================

create or replace function tingkat_goal(p_level level_goal)
returns int
language sql
immutable
as $$
  select case p_level
    when 'company' then 1
    when 'manager' then 2
    when 'leader'  then 3
    when 'account' then 4
    when 'staff'   then 5
  end;
$$;

create or replace function unit_goal(p_goal goals)
returns uuid
language sql
stable
as $$
  select coalesce(
    p_goal.unit_id,
    (select a.unit_id from accounts a where a.id = p_goal.account_id));
$$;

create or replace function jaga_roll_down_goal()
returns trigger
language plpgsql
as $$
declare
  induk    goals;
  jejak    uuid[] := array[new.id];
  telusur  uuid := new.parent_goal_id;
  unit_anak uuid;
  unit_induk uuid;
begin
  if new.parent_goal_id is null then
    return new;
  end if;

  select * into induk from goals where id = new.parent_goal_id;
  if induk.id is null then
    raise exception 'Goal induk tidak ditemukan';
  end if;

  if tingkat_goal(induk.level) >= tingkat_goal(new.level) then
    raise exception 'Goal % tidak boleh menginduk ke goal %',
      new.level, induk.level
      using errcode = 'check_violation';
  end if;

  unit_anak := unit_goal(new);
  unit_induk := unit_goal(induk);
  if unit_anak is not null and unit_induk is not null
     and unit_anak <> unit_induk then
    raise exception 'Goal induk harus berada di unit yang sama'
      using errcode = 'check_violation';
  end if;

  -- Rantai ke atas harus berujung, bukan berputar.
  while telusur is not null loop
    if telusur = any (jejak) then
      raise exception 'Rantai roll-down goal tidak boleh berputar'
        using errcode = 'check_violation';
    end if;
    jejak := jejak || telusur;
    select parent_goal_id into telusur from goals where id = telusur;
  end loop;

  return new;
end;
$$;

drop trigger if exists jaga_roll_down_goal_trg on goals;

create trigger jaga_roll_down_goal_trg
  before insert or update of parent_goal_id, level, unit_id, account_id
  on goals
  for each row execute function jaga_roll_down_goal();
