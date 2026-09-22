-- =====================================================================
-- K-Space V2 — Nomor modul rapat kembali setelah ada yang dihapus
--
-- `unique (course_id, urutan)` membuat penghapusan modul di tengah
-- meninggalkan lubang: modul 1, 2, 4, 5. Di layar itu terbaca sebagai
-- ada modul yang hilang, dan alamat "modul 3" menjadi buntu.
--
-- Penomoran dirapatkan tepat setelah penghapusan. Dikerjakan menaik
-- supaya tidak pernah ada dua modul yang sesaat bernomor sama —
-- unique constraint di PostgreSQL diperiksa per baris, bukan di akhir
-- pernyataan.
-- =====================================================================

create or replace function rapatkan_urutan_modul(p_course uuid)
returns void
language plpgsql
as $$
declare
  m record;
  nomor int := 0;
begin
  for m in
    select id from course_modules
    where course_id = p_course
    order by urutan
  loop
    nomor := nomor + 1;
    update course_modules set urutan = nomor
    where id = m.id and urutan <> nomor;
  end loop;
end;
$$;

create or replace function rapatkan_setelah_hapus()
returns trigger
language plpgsql
as $$
begin
  perform rapatkan_urutan_modul(old.course_id);
  return old;
end;
$$;

drop trigger if exists rapatkan_setelah_hapus_trg on course_modules;

create trigger rapatkan_setelah_hapus_trg
  after delete on course_modules
  for each row execute function rapatkan_setelah_hapus();
