-- =====================================================================
-- K-Space V2 — Agenda tidak bisa dipindahkan ke unit orang lain
--
-- `agenda_ubah_sendiri` (0060) mengizinkan pembuatnya menyunting agenda
-- yang ia buat. RLS tidak bisa membatasi kolom, jadi izin itu sekaligus
-- membolehkannya memindahkan agenda ke unit lain — atau menjadikannya
-- agenda seluruh perusahaan.
--
-- Akibatnya bukan sekadar salah tempat: agenda unit lain ikut menutup
-- jam tim yang tidak pernah diajak bicara, dan pemimpin unit itu tidak
-- bisa menghapusnya karena bukan ia yang membuatnya.
--
-- Karena itu perpindahan unit hanya boleh dilakukan CEO/Manager, atau
-- pemimpin unit yang bersangkutan — persis batas yang berlaku saat
-- agendanya dibuat.
-- =====================================================================

create or replace function jaga_unit_agenda()
returns trigger
language plpgsql
as $$
begin
  if new.unit_id is not distinct from old.unit_id then
    return new;
  end if;

  if lintas_unit() then
    return new;
  end if;

  -- Pemimpin unit boleh memindahkan agenda antara unitnya sendiri dan
  -- dirinya; selebihnya tidak.
  if memimpin_unit()
     and (new.unit_id is null or new.unit_id = unit_saya())
     and (old.unit_id is null or old.unit_id = unit_saya())
  then
    return new;
  end if;

  raise exception 'Agenda hanya bisa dipindahkan ke unitmu sendiri'
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists jaga_unit_agenda_trg on agenda;

create trigger jaga_unit_agenda_trg
  before update of unit_id on agenda
  for each row execute function jaga_unit_agenda();
