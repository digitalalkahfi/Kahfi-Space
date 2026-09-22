-- =====================================================================
-- K-Space V2 — Kursus yang sudah diikuti orang tidak dihapus
--
-- `courses_kelola` berlaku FOR ALL, sedangkan `course_enrollments` dan
-- `module_progress` memakai ON DELETE CASCADE. Menghapus satu kursus
-- karena itu ikut menghapus catatan belajar semua pesertanya: tanggal
-- mulai, modul yang sudah tuntas, dan tanggal kelulusannya — tanpa satu
-- pun galat, dan tanpa cara memulihkannya.
--
-- Padahal kursus sudah punya kolom `aktif`: yang tidak dipakai lagi
-- tinggal dinonaktifkan, dan riwayat orang yang pernah mengikutinya
-- tetap utuh. Penghapusan hanya masuk akal untuk kursus yang belum
-- pernah diikuti siapa pun — biasanya salah buat.
-- =====================================================================

create or replace function jaga_hapus_kursus()
returns trigger
language plpgsql
as $$
declare
  peserta integer;
begin
  select count(*) into peserta
  from course_enrollments where course_id = old.id;

  if peserta > 0 then
    raise exception
      'Kursus "%" sudah diikuti % orang; nonaktifkan saja supaya riwayat belajar mereka utuh',
      old.judul, peserta
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists jaga_hapus_kursus_trg on courses;

create trigger jaga_hapus_kursus_trg
  before delete on courses
  for each row execute function jaga_hapus_kursus();
