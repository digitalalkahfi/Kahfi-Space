-- =====================================================================
-- K-Space V2 — Selalu tersisa satu pengelola aktif
--
-- Policy `users_kelola` memberi CEO dan Manager kuasa penuh atas tabel
-- users, termasuk atas dirinya sendiri. Satu salah klik — menurunkan
-- peran sendiri atau menonaktifkan diri — bisa menghabiskan seluruh
-- pengelola, dan setelah itu tidak ada lagi yang berhak memulihkannya
-- lewat aplikasi.
--
-- Trigger ini menolak perubahan terakhir yang menyisakan nol pengelola
-- aktif. Aturan lain (siapa boleh mengubah apa) tetap di RLS.
-- =====================================================================

create or replace function jaga_pengelola_terakhir()
returns trigger
language plpgsql
as $$
declare
  sisa integer;
begin
  -- Hanya perlu diperiksa saat seseorang berhenti menjadi pengelola aktif.
  if tg_op = 'UPDATE'
     and old.role in ('CEO', 'Manager')
     and old.status = 'aktif'
     and (new.role not in ('CEO', 'Manager') or new.status <> 'aktif')
  then
    select count(*) into sisa
    from users
    where role in ('CEO', 'Manager')
      and status = 'aktif'
      and id <> old.id;

    if sisa = 0 then
      raise exception
        'Tidak bisa menghapus pengelola terakhir; angkat CEO atau Manager lain lebih dulu'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE'
     and old.role in ('CEO', 'Manager')
     and old.status = 'aktif'
  then
    select count(*) into sisa
    from users
    where role in ('CEO', 'Manager')
      and status = 'aktif'
      and id <> old.id;

    if sisa = 0 then
      raise exception
        'Tidak bisa menghapus pengelola terakhir; angkat CEO atau Manager lain lebih dulu'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_pengelola_terakhir_trg on users;

create trigger jaga_pengelola_terakhir_trg
  before update or delete on users
  for each row execute function jaga_pengelola_terakhir();
