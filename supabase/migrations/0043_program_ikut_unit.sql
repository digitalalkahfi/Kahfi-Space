-- =====================================================================
-- K-Space V2 — Program seseorang harus milik unitnya
--
-- Program adalah atribut yang menempel pada satu unit: Mabit Scholar di
-- Affiliator, MMC di MCN (PRD §1). Tanpa penjaga, seorang Staff MCN bisa
-- ditandai program Mabit Scholar, dan laporan per program jadi salah
-- hitung tanpa gejala apa pun di layar.
-- =====================================================================

create or replace function jaga_program_pengguna()
returns trigger
language plpgsql
as $$
declare
  unit_program uuid;
begin
  if new.program_id is null then
    return new;
  end if;

  if new.unit_id is null then
    raise exception 'Program hanya berlaku bagi anggota yang ditempatkan di satu unit';
  end if;

  select unit_id into unit_program from programs where id = new.program_id;

  if unit_program is distinct from new.unit_id then
    raise exception 'Program tersebut bukan milik unit anggota ini';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_program_pengguna_trg on users;

create trigger jaga_program_pengguna_trg
  before insert or update of program_id, unit_id on users
  for each row execute function jaga_program_pengguna();

-- Program akun pun harus milik unit akun tersebut.
create or replace function jaga_program_akun()
returns trigger
language plpgsql
as $$
declare
  unit_program uuid;
begin
  if new.program_id is null then
    return new;
  end if;

  select unit_id into unit_program from programs where id = new.program_id;

  if unit_program is distinct from new.unit_id then
    raise exception 'Program tersebut bukan milik unit akun ini';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_program_akun_trg on accounts;

create trigger jaga_program_akun_trg
  before insert or update of program_id, unit_id on accounts
  for each row execute function jaga_program_akun();
