-- =====================================================================
-- K-Space V2 — Mengubah goal beserta periodenya
--
-- Goal yang sudah dibuat sebelumnya tidak bisa dibetulkan dari layar:
-- hanya ada jalur ubah target, tanpa judul, pemilik, induk, atau
-- periode. Fungsi ini mengubah semuanya dalam SATU transaksi — data goal
-- dan anak tangga bulanannya — supaya goal tidak pernah tertinggal
-- dengan periode baru tetapi bulan lama, atau tanpa bulan sama sekali.
--
-- `p_bulan` null berarti anak tangga dipertahankan apa adanya (mis.
-- hanya judul yang diperbaiki); selain itu seluruh anak tangga diganti
-- dengan isi `p_bulan`: [{"bulan": "2026-10-01", "target": 32000000000}].
--
-- Berjalan sebagai pemanggil: RLS `goals_ubah` & `goal_months_kelola`
-- (CEO/Manager), batas 3 goal aktif per orang, aturan roll-down, dan
-- jejak audit tetap bekerja seperti biasa.
-- =====================================================================

create or replace function ubah_goal(
  p_goal    uuid,
  p_judul   text,
  p_level   level_goal,
  p_pemilik uuid,
  p_induk   uuid,
  p_unit    uuid,
  p_akun    uuid,
  p_base    numeric,
  p_target  numeric,
  p_stretch numeric,
  p_periode text,
  p_bulan   jsonb default null
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_unit uuid;
begin
  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh mengubah goal'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from goals where id = p_goal) then
    raise exception 'Goal tidak ditemukan' using errcode = 'no_data_found';
  end if;

  if p_bulan is not null and (
    jsonb_typeof(p_bulan) <> 'array'
    or jsonb_array_length(p_bulan) not between 1 and 12
  ) then
    raise exception 'Periode goal harus antara 1 sampai 12 bulan'
      using errcode = 'check_violation';
  end if;

  update goals
     set judul          = btrim(p_judul),
         level          = p_level,
         pemilik_id     = p_pemilik,
         parent_goal_id = p_induk,
         unit_id        = p_unit,
         account_id     = p_akun,
         target_base    = p_base,
         target_goal    = p_target,
         target_stretch = p_stretch,
         periode        = p_periode
   where id = p_goal;

  -- Turunan goal ini tetap harus sah terhadapnya: trigger roll-down hanya
  -- memeriksa baris yang diubah, bukan anak-anaknya.
  if exists (
    select 1 from goals c
    where c.parent_goal_id = p_goal
      and tingkat_goal(c.level) <= tingkat_goal(p_level)
  ) then
    raise exception
      'Goal ini punya turunan setingkat atau lebih tinggi dari level %; pindahkan turunannya dulu',
      p_level
      using errcode = 'check_violation';
  end if;

  v_unit := coalesce(p_unit, (select a.unit_id from accounts a where a.id = p_akun));
  if v_unit is not null and exists (
    select 1 from goals c
    where c.parent_goal_id = p_goal
      and unit_goal(c) is not null
      and unit_goal(c) <> v_unit
  ) then
    raise exception 'Goal ini punya turunan di unit lain; unitnya tidak bisa diubah'
      using errcode = 'check_violation';
  end if;

  if p_bulan is not null then
    delete from goal_months where goal_id = p_goal;
    insert into goal_months (goal_id, bulan, target)
    select p_goal, (b ->> 'bulan')::date, (b ->> 'target')::numeric
    from jsonb_array_elements(p_bulan) b;
  end if;
end;
$$;

comment on function ubah_goal(uuid, text, level_goal, uuid, uuid, uuid, uuid,
  numeric, numeric, numeric, text, jsonb) is
  'Mengubah goal dan (bila diberikan) seluruh anak tangga bulanannya dalam satu transaksi; hanya CEO/Manager (0177).';

revoke execute on function ubah_goal(uuid, text, level_goal, uuid, uuid, uuid,
  uuid, numeric, numeric, numeric, text, jsonb) from public, anon;
grant execute on function ubah_goal(uuid, text, level_goal, uuid, uuid, uuid,
  uuid, numeric, numeric, numeric, text, jsonb) to authenticated;
