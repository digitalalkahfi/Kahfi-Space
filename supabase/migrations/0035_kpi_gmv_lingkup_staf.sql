-- =====================================================================
-- K-Space V2 — Lingkup GMV staf: akun bila PIC, selain itu unit
--
-- Definisi KPI dikunci per jabatan ('Staff'), sedangkan hanya sebagian
-- staf memegang akun. Staf MCN/TAP dan staf Affiliator non-PIC jadi
-- tidak punya sumber GMV sama sekali, sehingga indikator berbobot 50
-- gugur dan cakupan penilaian mereka tinggal 25%.
--
-- Padahal mereka tetap bagian dari hasil unitnya. Sesuai 4DX di PRD,
-- lag measure ditanggung bersama satu tim. Jadi lingkup GMV seorang
-- staf adalah lingkup tersempit yang benar-benar ia pegang:
--   punya akun aktif  -> capaian akun itu
--   tidak punya akun  -> capaian unitnya
-- Indikator baru gugur bila unitnya pun tak bertarget.
-- =====================================================================

create or replace function realisasi_gmv_kpi(
  p_user uuid,
  p_bulan date,
  p_sampai date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with pengguna as (select id, role, unit_id from users where id = p_user),
  rentang as (
    select
      p_bulan as dari,
      least(p_sampai, (p_bulan + interval '1 month - 1 day')::date) as sampai,
      greatest(porsi_bulan_berjalan(p_bulan, p_sampai), 0.01) as porsi
  ),
  punya_akun as (
    select exists (
      select 1 from accounts a
      join pengguna p on a.pic_user_id = p.id
      join goals g on g.account_id = a.id and g.status = 'aktif'
      join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
      where a.status = 'aktif'
    ) as ada
  ),
  sasaran as (
    -- Staf pemegang akun: dinilai atas akunnya sendiri.
    select gm.target, coalesce((
      select sum(r.gmv) from daily_reports r
      where r.account_id = a.id
        and r.tanggal between (select dari from rentang) and (select sampai from rentang)
    ), 0) as realisasi
    from pengguna p
    join accounts a on a.pic_user_id = p.id and a.status = 'aktif'
    join goals g on g.account_id = a.id and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role = 'Staff'

    union all

    -- Staf tanpa akun: ikut capaian unitnya.
    select gm.target, gmv_unit_bulan(p.unit_id, (select sampai from rentang))
    from pengguna p
    join goals g on g.unit_id = p.unit_id and g.account_id is null and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role = 'Staff'
      and p.unit_id is not null
      and not (select ada from punya_akun)

    union all

    select gm.target, gmv_unit_bulan(p.unit_id, (select sampai from rentang))
    from pengguna p
    join goals g on g.unit_id = p.unit_id and g.account_id is null and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role in ('Leader', 'Co-Leader') and p.unit_id is not null

    union all

    select gm.target, coalesce((
      select sum(r.gmv) from daily_reports r
      where r.tanggal between (select dari from rentang) and (select sampai from rentang)
    ), 0)
    from pengguna p
    join goals g on g.level in ('company', 'manager') and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role in ('Manager', 'CEO') and g.pemilik_id = p.id
  )
  select case when coalesce(sum(target), 0) > 0
    then sum(realisasi) / (sum(target) * (select porsi from rentang)) * 100
    else null end
  from sasaran;
$$;
