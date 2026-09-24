-- =====================================================================
-- K-Space V2 — Tim manajemen: Staff langsung di bawah CEO atau Manager
--
-- 0068 mewajibkan setiap Staff aktif ditempatkan pada salah satu unit,
-- dengan alasan yang benar: staf tanpa unit tidak terjaring lingkup unit
-- mana pun. Tetapi ada staf yang memang bekerja langsung di bawah
-- Manager — administrasi, tata kelola, sekretariat — dan bukan bagian
-- dari unit pelaporan mana pun. Memaksanya masuk ke salah satu unit
-- membuatnya tertagih laporan harian unit itu dan terhitung dalam
-- lingkup GMV-nya, padahal pekerjaannya bukan itu.
--
-- Jadi Staff boleh tanpa unit dengan satu syarat: atasan langsungnya CEO
-- atau Manager. Syarat itulah yang menjadikannya tim manajemen, dan
-- itulah yang menjaga ia tetap berada di bawah seseorang yang berwenang
-- menugasi dan menyetujui izinnya. Leader dan Co-Leader tetap wajib
-- punya unit: tanpa unit, mereka tidak memimpin siapa pun.
-- =====================================================================

create or replace function jaga_penempatan_anggota()
returns trigger
language plpgsql
as $$
declare
  dept_unit uuid;
  punya_unit boolean;
  peran_atasan peran_pengguna;
begin
  if new.status = 'aktif'
     and new.role in ('Leader', 'Co-Leader', 'Staff')
     and new.unit_id is null then
    if new.role = 'Staff' and new.atasan_id is not null then
      select role into peran_atasan from users where id = new.atasan_id;
    end if;

    if peran_atasan is null or peran_atasan not in ('CEO', 'Manager') then
      raise exception
        '% aktif harus ditempatkan pada salah satu unit; hanya Staff tim manajemen — yang atasan langsungnya CEO atau Manager — yang boleh tanpa unit',
        new.role
        using errcode = 'check_violation';
    end if;
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

comment on function jaga_penempatan_anggota() is
  'Leader/Co-Leader/Staff aktif wajib punya unit; kecuali Staff tim manajemen yang langsung di bawah CEO atau Manager.';
