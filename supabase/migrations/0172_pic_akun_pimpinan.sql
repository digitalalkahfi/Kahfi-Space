-- =====================================================================
-- K-Space V2 — Leader dan Co-Leader boleh menjadi PIC akun
--
-- Aturan lama (0038) hanya mengizinkan Staff. Padahal di lapangan
-- Leader Affiliator juga memegang akun dan melaporkannya sendiri —
-- tiga akun hasil migrasi bahkan tidak punya PIC karena satu-satunya
-- pelapornya Leader atau Co-Leader. Sekarang siapa pun anggota aktif
-- unit itu — Staff, Leader, atau Co-Leader — boleh ditunjuk; yang
-- ditolak tetap orang dari unit lain, yang nonaktif, dan jajaran
-- lintas unit (CEO, Manager, Finance) yang tidak memegang unit mana pun.
-- =====================================================================

create or replace function jaga_pic_akun()
returns trigger
language plpgsql
as $$
declare
  peran_pic  peran_pengguna;
  unit_pic   uuid;
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

  if peran_pic not in ('Staff', 'Leader', 'Co-Leader') then
    raise exception
      'PIC akun harus Staff, Leader, atau Co-Leader unit itu, bukan %',
      peran_pic;
  end if;

  if unit_pic is distinct from new.unit_id then
    raise exception 'PIC akun harus berasal dari unit akun tersebut';
  end if;

  return new;
end;
$$;

comment on function jaga_pic_akun() is
  'PIC akun: anggota aktif unit akun itu — Staff, Leader, atau Co-Leader (0172).';
