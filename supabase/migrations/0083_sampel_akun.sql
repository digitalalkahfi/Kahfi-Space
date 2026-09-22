-- =====================================================================
-- K-Space V2 — Sampel dikaitkan ke akun yang memakainya
--
-- Sampel dikirim ke kreator untuk dipakai di akun tertentu, tetapi
-- barisnya hanya menyimpan unit. Akibatnya dua pertanyaan yang justru
-- sering muncul tidak terjawab:
--
--   * "sampel ini untuk akun yang mana?" — hanya bisa ditebak dari nama
--     kreator yang diketik bebas, dan ejaannya tidak pernah sama;
--   * PIC akun tidak melihat sampel yang beredar untuk akunnya sendiri,
--     sebab `samples_baca` hanya mengenal unit dan pemegang. Orang yang
--     paling berkepentingan justru yang paling tidak tahu.
--
-- Kolom akun dijaga agar selalu sekerabat dengan unit sampelnya, sejalan
-- penjagaan program (0043) dan co-leader akun (0061).
-- =====================================================================

alter table samples
  add column if not exists account_id uuid references accounts (id) on delete set null;

create index if not exists samples_account_idx on samples (account_id);

comment on column samples.account_id is
  'Akun affiliator yang memakai sampel ini; PIC-nya ikut melihatnya.';

create or replace function jaga_akun_sampel()
returns trigger
language plpgsql
as $$
declare
  unit_akun uuid;
begin
  if new.account_id is null then
    return new;
  end if;

  select unit_id into unit_akun from accounts where id = new.account_id;

  if unit_akun is null then
    raise exception 'Akun sampel tidak ditemukan';
  end if;

  if unit_akun is distinct from new.unit_id then
    raise exception 'Akun itu bukan milik unit sampel ini'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_akun_sampel_trg on samples;

create trigger jaga_akun_sampel_trg
  before insert or update of account_id, unit_id on samples
  for each row execute function jaga_akun_sampel();

-- ---------------------------------------------------------------------
-- PIC dan co-leader akun ikut melihat sampel akunnya.
-- ---------------------------------------------------------------------
drop policy if exists samples_baca on samples;

create policy samples_baca on samples
  for select using (
    auth.uid() is not null
    and (
      lintas_angka()
      or pemegang_id = auth.uid()
      or boleh_unit(unit_id)
      or (account_id is not null and pic_akun(account_id))
    )
  );
