-- =====================================================================
-- K-Space V2 — Target efektif sesuai cakupan pembaca
--
-- Masalah yang diperbaiki: seorang Staff hanya melihat GMV akun yang ia
-- pegang, tapi sebelumnya dibandingkan dengan target SELURUH unit — seolah
-- ia tertinggal jauh. Target harus dihitung dari sasaran yang sama dengan
-- GMV-nya.
--
-- Aturannya: bila unit punya goal tingkat akun, target unit = jumlah target
-- akun yang boleh dilihat pemanggil (RLS yang menyaring). Bila tidak ada
-- goal akun (MCN & TAP melapor per unit), pakai goal tingkat unit.
-- =====================================================================

-- Jumlah target harian akun-akun sebuah unit yang terlihat oleh pemanggil.
create or replace function target_harian_akun_unit(p_unit uuid, p_tanggal date)
returns numeric
language sql
stable
as $$
  select coalesce(sum(
    gm.target / extract(day from (date_trunc('month', gm.bulan)
                                  + interval '1 month - 1 day'))::numeric
  ), 0)
  from goals g
  join goal_months gm on gm.goal_id = g.id
  join accounts a on a.id = g.account_id
  where g.status = 'aktif'
    and g.account_id is not null
    and a.unit_id = p_unit
    and gm.bulan = date_trunc('month', p_tanggal)::date;
$$;

create or replace function target_bulanan_akun_unit(p_unit uuid, p_tanggal date)
returns numeric
language sql
stable
as $$
  select coalesce(sum(gm.target), 0)
  from goals g
  join goal_months gm on gm.goal_id = g.id
  join accounts a on a.id = g.account_id
  where g.status = 'aktif'
    and g.account_id is not null
    and a.unit_id = p_unit
    and gm.bulan = date_trunc('month', p_tanggal)::date;
$$;

-- Ringkasan dibangun ulang memakai target efektif.
create or replace function ringkasan_gmv_unit(p_tanggal date)
returns table (
  unit_id         uuid,
  kode            text,
  nama            text,
  deskripsi       text,
  gmv_hari_ini    numeric,
  gmv_kemarin     numeric,
  target_harian   numeric,
  gmv_bulan_ini   numeric,
  target_bulanan  numeric
)
language sql
stable
as $$
  with dasar as (
    select
      u.id,
      u.kode,
      u.nama,
      u.deskripsi,
      target_harian_akun_unit(u.id, p_tanggal)   as harian_akun,
      target_bulanan_akun_unit(u.id, p_tanggal)  as bulanan_akun,
      coalesce(th.target, 0)                     as harian_unit,
      target_bulanan_unit(u.id, p_tanggal)       as bulanan_unit
    from units u
    left join target_harian_unit(p_tanggal) th on th.unit_id = u.id
  )
  select
    d.id,
    d.kode,
    d.nama,
    d.deskripsi,
    gmv_unit_tanggal(d.id, p_tanggal),
    gmv_unit_tanggal(d.id, p_tanggal - 1),
    case when d.harian_akun > 0 then d.harian_akun else d.harian_unit end,
    gmv_unit_bulan(d.id, p_tanggal),
    case when d.bulanan_akun > 0 then d.bulanan_akun else d.bulanan_unit end
  from dasar d
  order by d.kode;
$$;

comment on function ringkasan_gmv_unit(date) is
  'GMV hari ini & kemarin vs target per unit; target menyesuaikan cakupan pembaca.';
