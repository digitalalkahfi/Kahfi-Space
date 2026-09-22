-- =====================================================================
-- K-Space V2 — Tindakan menunjuk sebab yang ditanganinya
--
-- Rantai 5-Why sudah dijaga runtut (0052) dan status masalah sudah
-- menuntut adanya tindakan sebelum dinyatakan selesai (0053). Yang belum
-- terjawab justru inti metodenya: tindakan ini menangani sebab yang
-- mana?
--
-- Tanpa tautan itu, sebuah masalah bisa punya lima tingkat sebab dan
-- sederet tindakan yang semuanya menambal sebab tingkat satu — persis
-- kebiasaan yang hendak dihentikan 5-Why, dan tidak ada satu pun cara
-- melihatnya dari data.
--
-- Kolomnya dibiarkan boleh kosong: sebagian tindakan memang pengamanan
-- sementara yang tidak menyasar sebab tertentu. Yang dijaga adalah
-- sebab yang ditunjuk harus milik masalah yang sama.
-- =====================================================================

alter table problem_actions
  add column if not exists why_id uuid references problem_whys (id) on delete set null;

create index if not exists problem_actions_why_idx on problem_actions (why_id);

comment on column problem_actions.why_id is
  'Sebab yang ditangani tindakan ini; kosong berarti pengamanan sementara.';

create or replace function jaga_sebab_tindakan()
returns trigger
language plpgsql
as $$
declare
  masalah_sebab uuid;
begin
  if new.why_id is null then
    return new;
  end if;

  select problem_id into masalah_sebab from problem_whys where id = new.why_id;

  if masalah_sebab is null then
    raise exception 'Sebab yang ditunjuk tidak ditemukan';
  end if;

  if masalah_sebab is distinct from new.problem_id then
    raise exception 'Sebab itu milik masalah lain'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_sebab_tindakan_trg on problem_actions;

create trigger jaga_sebab_tindakan_trg
  before insert or update of why_id, problem_id on problem_actions
  for each row execute function jaga_sebab_tindakan();

-- ---------------------------------------------------------------------
-- Apakah akar masalahnya benar-benar ditangani?
--
-- Dipakai layar detail masalah untuk menandai masalah yang tindakannya
-- hanya menyentuh sebab permukaan.
-- ---------------------------------------------------------------------
create or replace function akar_ditangani(p_masalah uuid)
returns boolean
language sql
stable
as $$
  select case
    when not exists (select 1 from problem_whys where problem_id = p_masalah)
      then false
    else exists (
      select 1
      from problem_actions a
      join problem_whys w on w.id = a.why_id
      where a.problem_id = p_masalah
        and w.urutan = (
          select max(urutan) from problem_whys where problem_id = p_masalah
        )
    )
  end;
$$;
