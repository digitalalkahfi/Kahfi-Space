-- =====================================================================
-- K-Space V2 — Anggota dinonaktifkan, tidak dihapus
--
-- `users_kelola` (0004) berlaku FOR ALL, jadi CEO/Manager juga boleh
-- menghapus baris pengguna. Padahal riwayat orang menggantung padanya
-- dengan dua cara yang sama-sama buruk:
--
--   * `attendance`, `kpi_snapshots`, `weekly_reports`, progres LMS, dan
--     masukan bug memakai ON DELETE CASCADE — sekali hapus, riwayat
--     absensi dan skor KPI orang itu lenyap tanpa jejak;
--   * `daily_reports` memakai ON DELETE RESTRICT — penghapusan gagal di
--     tengah jalan dengan galat kunci asing yang tidak berarti apa-apa
--     bagi pemakai.
--
-- Seluruh aplikasi sudah memakai penonaktifan (status 'nonaktif') yang
-- menyimpan riwayat dan melepas tugas PIC serta bawahannya. Penghapusan
-- karena itu ditutup di sini, dengan pesan yang menyebut jalan benarnya.
--
-- Dijaga trigger, bukan policy: `service_role` Supabase melewati RLS,
-- sedangkan trigger tetap berlaku untuknya. Lewat klien biasa, RLS lebih
-- dulu menyaring barisnya sehingga penghapusan tidak mengenai apa pun;
-- karena itu test memeriksa barisnya tetap ada, bukan bunyi galatnya.
-- =====================================================================

create or replace function tolak_hapus_anggota()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Anggota tidak dihapus, melainkan dinonaktifkan supaya riwayat absensi, laporan, dan KPI-nya utuh'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists tolak_hapus_anggota_trg on users;

create trigger tolak_hapus_anggota_trg
  before delete on users
  for each row execute function tolak_hapus_anggota();
