-- =====================================================================
-- K-Space V2 — Kuis modul beserta penilaiannya
--
-- Kunci jawaban tidak pernah boleh sampai ke browser. RLS PostgreSQL
-- bekerja per baris, bukan per kolom, jadi menyimpan `jawaban_benar` di
-- tabel soal berarti siapa pun yang boleh membaca soalnya juga bisa
-- membaca kuncinya — cukup dengan satu permintaan API biasa.
--
-- Karena itu kuncinya tinggal di tabel terpisah yang hanya bisa dibaca
-- CEO/Manager, dan penilaian dikerjakan fungsi SECURITY DEFINER: peserta
-- mengirim jawaban, server mengembalikan skor, kuncinya tidak pernah
-- menyeberang.
-- =====================================================================

create table quiz_questions (
  id         uuid primary key default gen_random_uuid(),
  module_id  uuid not null references course_modules (id) on delete cascade,
  urutan     int not null check (urutan > 0),
  pertanyaan text not null check (length(trim(pertanyaan)) >= 5),
  pilihan    text[] not null check (array_length(pilihan, 1) between 2 and 6),
  created_at timestamptz not null default now(),
  unique (module_id, urutan)
);

create index quiz_questions_modul_idx on quiz_questions (module_id, urutan);

-- Tabel terpisah, sengaja tidak pernah dibaca aplikasi peserta.
create table quiz_keys (
  question_id   uuid primary key references quiz_questions (id) on delete cascade,
  jawaban_benar int not null check (jawaban_benar >= 0),
  penjelasan    text not null default ''
);

comment on table quiz_keys is
  'Kunci jawaban; hanya CEO/Manager yang boleh membacanya.';

create table quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references course_enrollments (id) on delete cascade,
  module_id     uuid not null references course_modules (id) on delete cascade,
  skor          int not null check (skor between 0 and 100),
  lulus         boolean not null default false,
  dikerjakan_pada timestamptz not null default now()
);

create index quiz_attempts_daftar_idx
  on quiz_attempts (enrollment_id, module_id, dikerjakan_pada desc);

comment on table quiz_attempts is
  'Riwayat percobaan kuis; percobaan lama tidak pernah dihapus.';

-- Ambang kelulusan kuis; diletakkan di satu tempat agar tidak berbeda
-- antara penilaian dan tampilan.
create or replace function ambang_lulus_kuis()
returns int
language sql
immutable
as $$ select 80; $$;

-- ---------------------------------------------------------------------
-- Penilaian.
--
-- SECURITY DEFINER supaya bisa membaca kunci jawaban yang tertutup bagi
-- peserta. Yang dikembalikan hanya skor dan kelulusan — tidak ada satu
-- pun informasi tentang jawaban yang benar, sehingga menebak lewat
-- percobaan berulang tetap semahal mengerjakannya sungguhan.
-- ---------------------------------------------------------------------
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

  if coalesce(array_length(p_jawaban, 1), 0) <> jumlah_soal then
    raise exception 'Jumlah jawaban (%) tidak sama dengan jumlah soal (%)',
      coalesce(array_length(p_jawaban, 1), 0), jumlah_soal
      using errcode = 'check_violation';
  end if;

  for s in
    select q.urutan, k.jawaban_benar
    from quiz_questions q
    join quiz_keys k on k.question_id = q.id
    where q.module_id = p_module
    order by q.urutan
  loop
    if p_jawaban[s.urutan] = s.jawaban_benar then
      jumlah_benar := jumlah_benar + 1;
    end if;
  end loop;

  nilai := round(jumlah_benar::numeric / jumlah_soal * 100);

  insert into quiz_attempts (enrollment_id, module_id, skor, lulus)
  values (daftar_ikut, p_module, nilai, nilai >= ambang_lulus_kuis());

  -- Lulus kuis sekaligus menuntaskan modulnya; mengharuskan orang
  -- menandai tuntas secara terpisah hanya menambah langkah tanpa arti.
  if nilai >= ambang_lulus_kuis() then
    insert into module_progress (enrollment_id, module_id)
    values (daftar_ikut, p_module)
    on conflict (enrollment_id, module_id) do nothing;
  end if;

  return query select nilai, nilai >= ambang_lulus_kuis(), jumlah_benar, jumlah_soal;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table quiz_questions enable row level security;
alter table quiz_keys enable row level security;
alter table quiz_attempts enable row level security;

create policy quiz_questions_baca on quiz_questions
  for select using (auth.uid() is not null);
create policy quiz_questions_kelola on quiz_questions
  for all using (lintas_unit()) with check (lintas_unit());

-- Tidak ada policy baca bagi peserta: kuncinya memang tidak untuk dibaca.
create policy quiz_keys_kelola on quiz_keys
  for all using (lintas_unit()) with check (lintas_unit());

create policy quiz_attempts_baca on quiz_attempts
  for select using (
    exists (
      select 1 from course_enrollments e
      where e.id = enrollment_id
        and (e.user_id = auth.uid() or boleh_orang(e.user_id))
    )
  );
