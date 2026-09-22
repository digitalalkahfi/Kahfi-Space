-- =====================================================================
-- K-Space V2 — Kunci jawaban harus menunjuk pilihan yang ada
--
-- `quiz_keys.jawaban_benar` hanya dipagari ">= 0". Kunci yang menunjuk
-- pilihan ke-7 pada soal berpilihan empat membuat soal itu mustahil
-- dijawab benar oleh siapa pun — dan tidak ada tanda apa pun bahwa ada
-- yang salah: pesertanya hanya melihat nilainya tak kunjung cukup,
-- berulang kali, tanpa tahu sebabnya.
--
-- Karena itu kunci diperiksa terhadap jumlah pilihan soalnya, dan
-- perubahan jumlah pilihan ikut memeriksa kunci yang sudah ada.
-- =====================================================================

create or replace function jaga_kunci_kuis()
returns trigger
language plpgsql
as $$
declare
  jumlah int;
begin
  select array_length(pilihan, 1) into jumlah
  from quiz_questions where id = new.question_id;

  if jumlah is null then
    raise exception 'Soal kuis tidak ditemukan';
  end if;

  if new.jawaban_benar > jumlah - 1 then
    raise exception
      'Kunci menunjuk pilihan ke-% padahal soalnya hanya punya % pilihan',
      new.jawaban_benar + 1, jumlah
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_kunci_kuis_trg on quiz_keys;

create trigger jaga_kunci_kuis_trg
  before insert or update on quiz_keys
  for each row execute function jaga_kunci_kuis();

-- Mengurangi pilihan soal bisa membuat kunci yang tadinya sah jadi
-- menunjuk ke luar batas; diperiksa dari sisi soalnya juga.
create or replace function jaga_pilihan_soal()
returns trigger
language plpgsql
as $$
declare
  kunci int;
begin
  select jawaban_benar into kunci from quiz_keys where question_id = new.id;

  if kunci is not null and kunci > array_length(new.pilihan, 1) - 1 then
    raise exception
      'Kunci jawaban soal ini menunjuk pilihan ke-%; perbaiki kuncinya dulu sebelum mengurangi pilihan',
      kunci + 1
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_pilihan_soal_trg on quiz_questions;

create trigger jaga_pilihan_soal_trg
  before update of pilihan on quiz_questions
  for each row execute function jaga_pilihan_soal();
