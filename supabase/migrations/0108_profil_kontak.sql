-- =====================================================================
-- K-Space V2 — Nomor kontak pada profil (PRD Fase 1)
--
-- Kanal WhatsApp butuh satu hal yang belum pernah disimpan sistem ini:
-- nomor yang bisa dituju. Kolomnya ditaruh di `users` dan bukan di tabel
-- tersendiri karena ia memang bagian dari identitas orangnya, bukan
-- kejadian yang berulang.
--
-- Yang disimpan hanya bentuk bakunya (+62…). Aplikasi menerima 08…, 62…,
-- maupun +62… lalu menormalkannya sebelum menyimpan; CHECK di bawah
-- memastikan tidak ada jalan lain yang melewatkannya. Alasannya
-- sederhana: gateway WhatsApp mencari nomor secara persis, dan dua
-- tulisan untuk nomor yang sama berarti salah satunya tidak akan pernah
-- ketemu.
--
-- Sekalian menutup celah yang tersisa dari 0041: `program_id` dan
-- `department_id` disebut PRD sebagai milik pengelola, tetapi trigger
-- `jaga_ubah_diri` belum menjaganya — sehingga sampai sekarang seseorang
-- masih bisa memindahkan dirinya sendiri ke program lain.
-- =====================================================================

alter table users
  add column kontak text;

comment on column users.kontak is
  'Nomor WhatsApp dalam bentuk baku +62…; null bila belum diisi.';

-- 62 lalu 8, total 11–15 angka — rentang nomor seluler Indonesia.
-- Nomor rumah (021…) dan nomor luar negeri ditolak di sini, bukan
-- diam-diam disimpan lalu gagal saat dikirimi pesan.
alter table users
  add constraint users_kontak_baku check (
    kontak is null or kontak ~ '^\+628[0-9]{8,12}$'
  );

-- ---------------------------------------------------------------------
-- Penjagaan kolom milik pengelola — melanjutkan 0041
-- ---------------------------------------------------------------------
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

  -- Baru di 0108: program dan departemen adalah penempatan, sama seperti
  -- unit. Tanpa ini, halaman profil menampilkan gemboknya tapi basis
  -- data tetap menerima perubahannya.
  if new.program_id is distinct from old.program_id then
    raise exception 'Program hanya bisa diubah CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  if new.department_id is distinct from old.department_id then
    raise exception 'Departemen hanya bisa diubah CEO atau Manager'
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

  -- Sisanya — nama, foto_url, dan kontak — memang milik orangnya
  -- sendiri untuk dirapikan kapan saja.
  return new;
end;
$$;
