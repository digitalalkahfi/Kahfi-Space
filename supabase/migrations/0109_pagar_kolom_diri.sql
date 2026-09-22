-- =====================================================================
-- K-Space V2 — Menutup sisa kolom yang bukan milik penggunanya
--
-- 0041 dan 0108 sudah menjaga kolom yang menentukan wewenang dan
-- penempatan. Yang tersisa adalah `created_at`: tidak menentukan
-- wewenang apa pun, tetapi ia menjawab "sejak kapan orang ini di sini",
-- dan jawaban itu dipakai manusia saat menimbang senioritas. Kolom yang
-- bisa diubah sendiri berarti jawabannya tidak bisa dipercaya.
--
-- Daftar lengkap yang boleh diubah seseorang pada dirinya sendiri kini
-- tinggal tiga: nama, foto_url, dan kontak. `updated_at` diisi trigger
-- `users_set_updated_at` (0001), bukan oleh pemanggil.
--
-- Trigger ditulis ulang utuh — bukan ditambal — supaya membacanya tidak
-- perlu merangkai tiga migrasi dalam kepala.
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

  -- Menentukan wewenang -----------------------------------------------
  if new.role is distinct from old.role then
    raise exception 'Peran hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  if new.unit_id is distinct from old.unit_id then
    raise exception 'Penempatan unit hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  if new.program_id is distinct from old.program_id then
    raise exception 'Program hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  if new.atasan_id is distinct from old.atasan_id then
    raise exception 'Atasan hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  -- Mengikuti penempatan ----------------------------------------------
  if new.department_id is distinct from old.department_id then
    raise exception 'Departemen hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  if new.jabatan is distinct from old.jabatan then
    raise exception 'Jabatan hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Status keaktifan hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  -- Identitas akun ----------------------------------------------------
  -- Email adalah kunci yang menghubungkan profil ke akun Auth.
  if new.email is distinct from old.email then
    raise exception 'Email hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  if new.id is distinct from old.id then
    raise exception 'Id pengguna tidak boleh diubah'
      using errcode = 'insufficient_privilege';
  end if;

  -- Baru di 0109: waktu bergabung menjawab "sejak kapan orang ini di
  -- sini", dan itu dipakai manusia saat menimbang senioritas.
  if new.created_at is distinct from old.created_at then
    raise exception 'Waktu bergabung tidak boleh diubah sendiri'
      using errcode = 'insufficient_privilege';
  end if;

  -- Sisanya — nama, foto_url, dan kontak — memang milik orangnya
  -- sendiri untuk dirapikan kapan saja. `updated_at` diisi trigger
  -- users_set_updated_at (0001), bukan oleh pemanggil.
  return new;
end;
$$;
