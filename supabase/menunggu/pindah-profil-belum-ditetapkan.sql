-- =====================================================================
-- K-Space V2 — Pindahkan profil "Belum ditetapkan" ke pendaftaran_akun
-- (docs/DAFTAR-GOOGLE-PERSETUJUAN.md §7 "Data lama")
--
-- Sebelum 0209, trigger `auth_ke_users` membuat profil Staff NONAKTIF
-- berjabatan "Belum ditetapkan" untuk setiap email login yang tidak
-- dikenal. Profil seperti itu sekarang seharusnya menjadi pendaftaran
-- yang menunggu persetujuan.
--
-- BUKAN migrasi otomatis. Urutannya:
--   1. Jalankan BAGIAN 1 (baca-saja) di SQL Editor Supabase.
--   2. Tunjukkan daftarnya ke Manager.
--   3. Setelah Manager setuju, jalankan BAGIAN 2 — boleh dipersempit
--      dengan daftar id yang disetujui.
--
-- Hanya profil TANPA baris anak apa pun (tidak punya absensi, tugas,
-- laporan, dsb.) yang dipindahkan. Profil yang sudah punya riwayat
-- tetap di `users` dan diurus manual.
-- =====================================================================

-- ---------------------------------------------------------------------
-- BAGIAN 1 — pratinjau (baca-saja)
-- ---------------------------------------------------------------------
with calon as (
  select u.id, u.nama, u.email, u.created_at
  from users u
  where u.jabatan = 'Belum ditetapkan'
    and u.status = 'nonaktif'
    and u.role = 'Staff'
)
select c.id, c.nama, c.email, c.created_at,
       exists (select 1 from auth.users a where a.id = c.id) as punya_akun_login
from calon c
order by c.created_at;

-- ---------------------------------------------------------------------
-- BAGIAN 2 — pindahkan (jalankan HANYA setelah disetujui Manager)
--
-- Ganti `null` di `disetujui` dengan daftar id yang disetujui, mis.
--   array['…'::uuid, '…'::uuid]
-- Biarkan null untuk memindahkan semua calon dari BAGIAN 1.
-- ---------------------------------------------------------------------
/*
do $$
declare
  disetujui uuid[] := null;
  r record;
  ada_anak boolean;
  con record;
  dipindah int := 0;
  dilewati int := 0;
begin
  for r in
    select u.* from users u
    where u.jabatan = 'Belum ditetapkan'
      and u.status = 'nonaktif'
      and u.role = 'Staff'
      and (disetujui is null or u.id = any (disetujui))
  loop
    -- Baris anak di tabel mana pun → jangan disentuh.
    ada_anak := false;
    for con in
      select con.conrelid::regclass as tabel, a.attname as kolom
      from pg_constraint con
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
      where con.contype = 'f' and con.confrelid = 'public.users'::regclass
    loop
      execute format('select exists (select 1 from %s where %I = $1)', con.tabel, con.kolom)
        into ada_anak using r.id;
      exit when ada_anak;
    end loop;

    if ada_anak then
      dilewati := dilewati + 1;
      raise notice 'Dilewati (punya riwayat): % <%>', r.nama, r.email;
      continue;
    end if;

    insert into pendaftaran_akun (id, email, nama_google, dibuat_pada)
    values (r.id, lower(r.email), r.nama, r.created_at)
    on conflict (id) do nothing;

    delete from users where id = r.id;
    dipindah := dipindah + 1;
  end loop;

  raise notice 'Dipindah: %, dilewati: %', dipindah, dilewati;
end;
$$;
*/
