-- =====================================================================
-- K-Space V2 — Co-Leader akun harus pimpinan aktif di unit akun itu
--
-- `accounts.co_leader_id` bukan sekadar keterangan di layar: kolom ini
-- ikut membuka akses baca lewat `boleh_lihat_akun()` (0002), kebijakan
-- RLS akun (0004), dan `akun_berhak()` (0014). Selama tidak dijaga,
-- siapa pun yang boleh menyunting akun bisa menunjuk orang dari unit
-- lain sebagai co-leader — dan orang itu langsung melihat GMV serta
-- laporan harian akun tersebut. Pemisahan antar-unit bocor tanpa satu
-- pun galat.
--
-- PIC sudah dijaga sejak 0038; kolom pendampingnya dibiarkan terbuka.
-- Aturannya disamakan: harus aktif, harus se-unit, dan harus memang
-- memegang unit itu — Leader atau Co-Leader.
-- =====================================================================

create or replace function jaga_co_leader_akun()
returns trigger
language plpgsql
as $$
declare
  peran  peran_pengguna;
  unit   uuid;
  keadaan status_aktif;
begin
  if new.co_leader_id is null then
    return new;
  end if;

  select role, unit_id, status into peran, unit, keadaan
  from users where id = new.co_leader_id;

  if peran is null then
    raise exception 'Co-leader akun tidak ditemukan';
  end if;

  if keadaan <> 'aktif' then
    raise exception 'Co-leader akun harus pengguna aktif';
  end if;

  if peran not in ('Leader', 'Co-Leader') then
    raise exception 'Co-leader akun harus Leader atau Co-Leader, bukan %', peran;
  end if;

  if unit is distinct from new.unit_id then
    raise exception 'Co-leader akun harus berasal dari unit akun tersebut';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_co_leader_akun_trg on accounts;

create trigger jaga_co_leader_akun_trg
  before insert or update of co_leader_id, unit_id on accounts
  for each row execute function jaga_co_leader_akun();
