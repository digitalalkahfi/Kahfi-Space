-- =====================================================================
-- K-Space V2 — Batasi apa yang boleh diubah seseorang pada dirinya
--
-- CACAT KEAMANAN yang ditutup di sini: policy `users_ubah_diri` (0004)
-- mengizinkan UPDATE pada baris sendiri tanpa membatasi kolom. RLS
-- memang tidak bisa membatasi kolom. Akibatnya siapa pun bisa
-- menjalankan
--
--     update users set role = 'Manager' where id = auth.uid();
--
-- dan seketika memperoleh wewenang penuh — termasuk melihat seluruh
-- angka perusahaan, mengunci KPI, dan mengubah goal. Hal yang sama
-- berlaku untuk `unit_id` (berpindah unit sendiri), `status`
-- (mengaktifkan diri kembali), dan `atasan_id`.
--
-- Kolom yang menentukan wewenang kini hanya boleh diubah CEO/Manager.
-- Pengguna biasa tetap boleh merapikan nama dan fotonya sendiri.
-- =====================================================================

create or replace function jaga_ubah_diri()
returns trigger
language plpgsql
as $$
begin
  -- CEO dan Manager memang berwenang; biarkan lewat.
  if lintas_unit() then
    return new;
  end if;

  -- Yang dibatasi hanya perubahan pada baris diri sendiri — itulah satu-
  -- satunya yang bisa dilakukan pengguna biasa lewat `users_ubah_diri`.
  -- Baris orang lain sudah dijaga RLS, dan perubahan oleh sistem (seed,
  -- service role) tidak membawa identitas pengguna sama sekali.
  if auth.uid() is null or auth.uid() is distinct from old.id then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Peran hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  if new.unit_id is distinct from old.unit_id then
    raise exception 'Penempatan unit hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Status keaktifan hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  if new.atasan_id is distinct from old.atasan_id then
    raise exception 'Atasan hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  if new.jabatan is distinct from old.jabatan then
    raise exception 'Jabatan hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  -- Email adalah kunci yang menghubungkan profil ke akun Auth.
  if new.email is distinct from old.email then
    raise exception 'Email hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  if new.id is distinct from old.id then
    raise exception 'Id pengguna tidak boleh diubah'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_ubah_diri_trg on users;

create trigger jaga_ubah_diri_trg
  before update on users
  for each row execute function jaga_ubah_diri();
