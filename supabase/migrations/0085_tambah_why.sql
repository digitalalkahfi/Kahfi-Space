-- =====================================================================
-- K-Space V2 — Menambah mata rantai 5-Why dalam satu langkah
--
-- Nomor tingkat berikutnya sebelumnya dihitung aplikasi: baca tingkat
-- tertinggi, tambah satu, lalu sisipkan. Dua orang yang menelusuri
-- masalah yang sama bersamaan — hal biasa dalam rapat — mendapat nomor
-- yang sama, dan yang kalah cepat menerima galat kunci ganda yang tidak
-- berarti apa-apa baginya.
--
-- Di sini penomoran dan penyisipan terjadi sekaligus, dengan percobaan
-- ulang bila ada yang mendahului. Sekalian statusnya ikut bergerak:
-- masalah yang sudah mulai ditelusuri bukan lagi 'baru', dan membiarkan
-- status lama membuat papan masalah bercerita lebih lambat daripada
-- kenyataannya.
-- =====================================================================

create or replace function tambah_why(p_masalah uuid, p_jawaban text)
returns problem_whys
language plpgsql
as $$
declare
  mata problem_whys;
  berikutnya int;
begin
  if length(btrim(p_jawaban)) < 5 then
    raise exception 'Tulis jawabannya sedikit lebih lengkap'
      using errcode = 'check_violation';
  end if;

  for i in 1..5 loop
    select coalesce(max(urutan), 0) + 1 into berikutnya
    from problem_whys where problem_id = p_masalah;

    if berikutnya > 5 then
      raise exception 'Rantai sudah penuh lima tingkat; pecah masalahnya bila akarnya masih terasa belum ketemu'
        using errcode = 'check_violation';
    end if;

    begin
      insert into problem_whys (problem_id, urutan, jawaban, oleh_id)
      values (p_masalah, berikutnya, btrim(p_jawaban), auth.uid())
      returning * into mata;

      return mata;
    exception when unique_violation then
      -- ada yang mendahului; ambil nomor berikutnya
    end;
  end loop;

  raise exception 'Gagal menambahkan mata rantai; coba lagi';
end;
$$;

comment on function tambah_why(uuid, text) is
  'Menambah satu tingkat 5-Why; penomorannya aman dari tabrakan.';

-- ---------------------------------------------------------------------
-- Status ikut bergerak begitu penelusuran dimulai.
--
-- Dikerjakan trigger SECURITY DEFINER, bukan di dalam fungsi di atas:
-- yang menelusuri biasanya Staff, dan `problems_kelola` hanya mengizinkan
-- CEO/Manager menyunting baris masalah. Tanpa ini, statusnya diam di
-- 'baru' tanpa galat apa pun — papan masalah lalu bercerita lebih lambat
-- daripada kenyataannya.
-- ---------------------------------------------------------------------
create or replace function gerakkan_status_masalah()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update problems
     set status = 'dianalisis', updated_at = now()
   where id = new.problem_id and status = 'baru';
  return new;
end;
$$;

drop trigger if exists gerakkan_status_masalah_trg on problem_whys;

create trigger gerakkan_status_masalah_trg
  after insert on problem_whys
  for each row execute function gerakkan_status_masalah();
