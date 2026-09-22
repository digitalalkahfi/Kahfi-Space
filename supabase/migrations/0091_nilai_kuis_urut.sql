-- =====================================================================
-- K-Space V2 — Penilaian kuis membaca jawaban pada posisinya
--
-- CACAT: `nilai_kuis` mencocokkan jawaban dengan `p_jawaban[q.urutan]`,
-- yaitu memakai NOMOR soal sebagai indeks larik jawaban. Selama nomor
-- soal rapat 1..n keduanya kebetulan sama — tetapi menghapus satu soal
-- meninggalkan lubang (mis. tersisa nomor 2 dan 3), sedangkan layar
-- tetap mengirim dua jawaban. Akibatnya jawaban bergeser satu dan soal
-- terakhir membaca indeks di luar larik: selalu dianggap salah, tanpa
-- galat apa pun. Peserta melihat nilainya tak kunjung cukup dan tidak
-- pernah tahu sebabnya.
--
-- Diperbaiki dua sisi:
--
--   1. jawaban dibaca menurut URUTAN PENYAJIAN (posisi ke-1, ke-2, …),
--      persis seperti layar menyusunnya;
--   2. soal yang belum punya kunci jawaban tidak lagi diam-diam dihitung
--      salah, melainkan menghentikan penilaian dengan sebab yang jelas —
--      itu kesalahan penyusun, bukan kesalahan peserta.
--
-- Sekalian nomor soal dirapatkan setelah penghapusan, seperti modul
-- (0055), supaya nomor di layar tidak melompat.
-- =====================================================================

create or replace function nilai_kuis(
  p_module uuid,
  p_jawaban int[]
)
returns table (skor int, lulus boolean, benar int, total int)
language plpgsql
security definer
set search_path = public
as $$
declare
  daftar_ikut uuid;
  jumlah_soal int;
  tanpa_kunci int;
  jumlah_benar int := 0;
  s record;
  nilai int;
begin
  select e.id into daftar_ikut
  from course_enrollments e
  join course_modules m on m.course_id = e.course_id
  where m.id = p_module and e.user_id = auth.uid();

  if daftar_ikut is null then
    raise exception 'Ikuti kursusnya dulu sebelum mengerjakan kuis'
      using errcode = 'check_violation';
  end if;

  select count(*) into jumlah_soal from quiz_questions where module_id = p_module;

  if jumlah_soal = 0 then
    raise exception 'Modul ini belum punya soal kuis'
      using errcode = 'check_violation';
  end if;

  select count(*) into tanpa_kunci
  from quiz_questions q
  where q.module_id = p_module
    and not exists (select 1 from quiz_keys k where k.question_id = q.id);

  if tanpa_kunci > 0 then
    raise exception '% soal pada kuis ini belum punya kunci jawaban; lengkapi dulu',
      tanpa_kunci
      using errcode = 'check_violation';
  end if;

  if coalesce(array_length(p_jawaban, 1), 0) <> jumlah_soal then
    raise exception 'Jumlah jawaban (%) tidak sama dengan jumlah soal (%)',
      coalesce(array_length(p_jawaban, 1), 0), jumlah_soal
      using errcode = 'check_violation';
  end if;

  for s in
    select
      row_number() over (order by q.urutan) as posisi,
      k.jawaban_benar
    from quiz_questions q
    join quiz_keys k on k.question_id = q.id
    where q.module_id = p_module
  loop
    if p_jawaban[s.posisi] = s.jawaban_benar then
      jumlah_benar := jumlah_benar + 1;
    end if;
  end loop;

  nilai := round(jumlah_benar::numeric / jumlah_soal * 100);

  insert into quiz_attempts (enrollment_id, module_id, skor, lulus)
  values (daftar_ikut, p_module, nilai, nilai >= ambang_lulus_kuis());

  -- Lulus kuis sekaligus menuntaskan modulnya.
  if nilai >= ambang_lulus_kuis() then
    insert into module_progress (enrollment_id, module_id)
    values (daftar_ikut, p_module)
    on conflict (enrollment_id, module_id) do nothing;
  end if;

  return query select nilai, nilai >= ambang_lulus_kuis(), jumlah_benar, jumlah_soal;
end;
$$;

-- ---------------------------------------------------------------------
-- Nomor soal dirapatkan setelah penghapusan.
-- ---------------------------------------------------------------------
create or replace function rapatkan_urutan_soal(p_module uuid)
returns void
language plpgsql
as $$
declare
  s record;
  n int := 0;
begin
  -- Dipindahkan dulu ke nomor tinggi supaya tidak bertabrakan dengan
  -- nomor yang masih dipakai saat penomoran ulang berjalan.
  update quiz_questions
     set urutan = urutan + 1000
   where module_id = p_module;

  for s in
    select id from quiz_questions where module_id = p_module order by urutan
  loop
    n := n + 1;
    update quiz_questions set urutan = n where id = s.id;
  end loop;
end;
$$;

create or replace function rapatkan_soal_setelah_hapus()
returns trigger
language plpgsql
as $$
begin
  perform rapatkan_urutan_soal(old.module_id);
  return old;
end;
$$;

drop trigger if exists rapatkan_soal_setelah_hapus_trg on quiz_questions;

create trigger rapatkan_soal_setelah_hapus_trg
  after delete on quiz_questions
  for each row execute function rapatkan_soal_setelah_hapus();
