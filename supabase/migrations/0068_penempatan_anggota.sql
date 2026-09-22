-- =====================================================================
-- K-Space V2 — Penempatan anggota: unit wajib, departemen ikut unitnya
--
-- Dua lubang pada data kepegawaian:
--
-- 1. `unit_id` boleh kosong untuk siapa saja. Staf tanpa unit tidak
--    terjaring `boleh_unit()` maupun lingkup GMV KPI: ia tidak muncul di
--    layar unit mana pun, tidak tertagih laporan harian, dan skornya
--    dihitung dari indikator yang tersisa saja — semuanya diam-diam.
--    Peran yang memang bekerja di satu unit (Leader, Co-Leader, Staff)
--    karena itu wajib punya unit; CEO, Manager, dan Finance memang
--    lintas unit.
--
-- 2. `department_id` tidak pernah terisi sama sekali, padahal PRD
--    menuntut penempatan departemen tiap anggota. Nilainya bukan
--    informasi baru untuk peran unit — unit sudah menyimpan
--    departemennya — jadi diisikan otomatis, bukan diminta dua kali.
--
-- Departemen yang tidak memiliki unit (MMC, Mabit Scholar) tetap boleh
-- dipilih manual: orangnya tetap melapor lewat unit tempat ia bekerja,
-- tetapi departemennya memang bukan departemen unit itu.
--
-- Pindah unit membawa serta departemennya. Kalau tidak, orang yang
-- dipindahkan akan tertinggal di departemen unit lamanya — dan setiap
-- penyuntingan berikutnya ditolak tanpa sebab yang kelihatan.
-- =====================================================================

create or replace function jaga_penempatan_anggota()
returns trigger
language plpgsql
as $$
declare
  dept_unit uuid;
  punya_unit boolean;
begin
  -- Profil nonaktif boleh belum ditempatkan: orang yang baru mendaftar
  -- lewat Auth masuk sebagai 'Staff' nonaktif tanpa unit (supabase/auth.sql)
  -- sampai pengelola menempatkannya. Yang dijaga adalah anggota aktif —
  -- merekalah yang muncul di lingkup unit dan ditagih laporan harian.
  if new.status = 'aktif'
     and new.role in ('Leader', 'Co-Leader', 'Staff')
     and new.unit_id is null then
    raise exception '% aktif harus ditempatkan pada salah satu unit', new.role
      using errcode = 'check_violation';
  end if;

  if new.unit_id is not null then
    select department_id into dept_unit from units where id = new.unit_id;

    if new.department_id is null then
      new.department_id := dept_unit;
    elsif new.department_id is distinct from dept_unit then
      select exists (
        select 1 from units where department_id = new.department_id
      ) into punya_unit;

      if punya_unit then
        if tg_op = 'UPDATE'
           and new.unit_id is distinct from old.unit_id
           and new.department_id is not distinct from old.department_id then
          -- Unitnya yang berpindah, bukan departemennya yang dipilih ulang.
          new.department_id := dept_unit;
        else
          raise exception 'Departemen itu bukan departemen unit yang dipilih'
            using errcode = 'check_violation';
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_penempatan_anggota_trg on users;

create trigger jaga_penempatan_anggota_trg
  before insert or update of role, unit_id, department_id, status on users
  for each row execute function jaga_penempatan_anggota();

-- Backfill: departemen anggota lama diisi dari unitnya.
update users u
   set department_id = un.department_id
  from units un
 where un.id = u.unit_id
   and u.department_id is null;
