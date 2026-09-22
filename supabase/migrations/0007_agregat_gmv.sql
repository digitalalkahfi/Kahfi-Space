-- =====================================================================
-- K-Space V2 — Agregat GMV vs target (PRD §3 Beranda)
--
-- GMV sebuah unit = laporan tingkat unit + laporan akun-akun di unit itu.
-- Fungsi memakai security invoker (bawaan) supaya RLS pemanggil tetap
-- berlaku: Staff hanya ikut menghitung baris yang boleh ia lihat.
-- =====================================================================

-- GMV satu unit pada satu tanggal.
create or replace function gmv_unit_tanggal(p_unit uuid, p_tanggal date)
returns numeric
language sql
stable
as $$
  select coalesce(sum(r.gmv), 0)
  from daily_reports r
  left join accounts a on a.id = r.account_id
  where r.tanggal = p_tanggal
    and (r.unit_id = p_unit or a.unit_id = p_unit);
$$;

-- Akumulasi GMV unit sepanjang bulan berjalan sampai tanggal tersebut.
create or replace function gmv_unit_bulan(p_unit uuid, p_tanggal date)
returns numeric
language sql
stable
as $$
  select coalesce(sum(r.gmv), 0)
  from daily_reports r
  left join accounts a on a.id = r.account_id
  where r.tanggal between date_trunc('month', p_tanggal)::date and p_tanggal
    and (r.unit_id = p_unit or a.unit_id = p_unit);
$$;

-- Target bulanan satu unit (anak tangga bulan berjalan).
create or replace function target_bulanan_unit(p_unit uuid, p_tanggal date)
returns numeric
language sql
stable
as $$
  select coalesce(sum(gm.target), 0)
  from goals g
  join goal_months gm on gm.goal_id = g.id
  where g.status = 'aktif'
    and g.unit_id = p_unit
    and g.account_id is null
    and gm.bulan = date_trunc('month', p_tanggal)::date;
$$;

-- ---------------------------------------------------------------------
-- Satu baris per unit: hari ini, kemarin, target harian, akumulasi bulan.
-- Inilah sumber kartu "GMV vs Target per Unit" dan donut target bulanan.
-- ---------------------------------------------------------------------
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
  select
    u.id,
    u.kode,
    u.nama,
    u.deskripsi,
    gmv_unit_tanggal(u.id, p_tanggal),
    gmv_unit_tanggal(u.id, p_tanggal - 1),
    coalesce(th.target, 0),
    gmv_unit_bulan(u.id, p_tanggal),
    target_bulanan_unit(u.id, p_tanggal)
  from units u
  left join target_harian_unit(p_tanggal) th on th.unit_id = u.id
  order by u.kode;
$$;

comment on function ringkasan_gmv_unit(date) is
  'Dipakai Beranda: GMV hari ini & kemarin vs target per unit pelaporan.';
