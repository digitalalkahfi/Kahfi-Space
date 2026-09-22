-- =====================================================================
-- K-Space V2 — PIC akun wajib staf aktif di unit akun itu
--
-- Aturannya sebelumnya hanya dijaga server action, jadi pemanggilan API
-- langsung oleh Manager masih bisa menunjuk siapa saja — termasuk orang
-- dari unit lain atau yang sudah nonaktif. Akibatnya kewajiban Laporan
-- Harian akun itu jatuh ke orang yang tidak memegang unitnya, dan
-- `wajib_lapor_harian()` ikut salah menagih.
--
-- Dijadikan aturan database supaya berlaku lewat jalur mana pun.
-- =====================================================================

create or replace function jaga_pic_akun()
returns trigger
language plpgsql
as $$
declare
  peran_pic peran_pengguna;
  unit_pic  uuid;
  status_pic status_aktif;
begin
  if new.pic_user_id is null then
    return new;
  end if;

  select role, unit_id, status into peran_pic, unit_pic, status_pic
  from users where id = new.pic_user_id;

  if peran_pic is null then
    raise exception 'PIC akun tidak ditemukan';
  end if;

  if status_pic <> 'aktif' then
    raise exception 'PIC akun harus pengguna aktif';
  end if;

  if peran_pic <> 'Staff' then
    raise exception 'PIC akun harus berperan Staff, bukan %', peran_pic;
  end if;

  if unit_pic is distinct from new.unit_id then
    raise exception 'PIC akun harus berasal dari unit akun tersebut';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_pic_akun_trg on accounts;

create trigger jaga_pic_akun_trg
  before insert or update of pic_user_id, unit_id on accounts
  for each row execute function jaga_pic_akun();
