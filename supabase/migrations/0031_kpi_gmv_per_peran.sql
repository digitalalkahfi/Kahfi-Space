-- =====================================================================
-- K-Space V2 — Sumber GMV pada KPI mengikuti peran
--
-- Cabang 'gmv' sebelumnya selalu mencari akun yang di-PIC-i pengguna.
-- Untuk Leader, Co-Leader, dan Manager itu selalu kosong: mereka tidak
-- memegang akun, mereka memimpin unit. Akibatnya skor mereka nyaris nol
-- padahal unitnya berjalan baik.
--
-- Sekarang sumbernya menyesuaikan:
--   Staff             → akun yang ia pegang
--   Leader/Co-Leader  → unit yang ia pimpin
--   Manager/CEO       → seluruh perusahaan
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
  with pengguna as (
    select id, role, unit_id from users where id = p_user
  ),
  rentang as (
    select
      p_bulan as dari,
      least(p_sampai, (p_bulan + interval '1 month - 1 day')::date) as sampai,
      greatest(porsi_bulan_berjalan(p_bulan, p_sampai), 0.01) as porsi
  ),
  -- Target & realisasi disiapkan terpisah agar join tidak menggandakan target.
  sasaran as (
    -- Staff: akun yang ia pegang.
    select
      gm.target,
      coalesce((
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

    -- Leader & Co-Leader: unit yang ia pimpin.
    select
      gm.target,
      gmv_unit_bulan(p.unit_id, (select sampai from rentang))
    from pengguna p
    join goals g on g.unit_id = p.unit_id and g.account_id is null and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role in ('Leader', 'Co-Leader') and p.unit_id is not null

    union all

    -- Manager & CEO: seluruh perusahaan.
    select
      gm.target,
      coalesce((
        select sum(r.gmv) from daily_reports r
        where r.tanggal between (select dari from rentang) and (select sampai from rentang)
      ), 0)
    from pengguna p
    join goals g on g.level in ('company', 'manager') and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role in ('Manager', 'CEO')
      and g.pemilik_id = p.id
  )
  select coalesce((
    select case when sum(target) > 0
      then sum(realisasi) / (sum(target) * (select porsi from rentang)) * 100
      else 0 end
    from sasaran
  ), 0);
$$;

create or replace function realisasi_kpi(
  p_user uuid,
  p_sumber sumber_kpi,
  p_bulan date,
  p_sampai date default current_date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with rentang as (
    select
      p_bulan as dari,
      least(p_sampai, (p_bulan + interval '1 month - 1 day')::date) as sampai
  )
  select case p_sumber

    when 'gmv' then realisasi_gmv_kpi(p_user, p_bulan, p_sampai)

    when 'absensi' then coalesce((
      select case when count(*) > 0
        then count(*) filter (where status = 'hadir')::numeric / count(*) * 100
        else 0 end
      from attendance
      where user_id = p_user
        and tanggal between (select dari from rentang) and (select sampai from rentang)
    ), 0)

    when 'tiket' then coalesce((
      select case when count(*) > 0
        then count(*) filter (where status = 'selesai')::numeric / count(*) * 100
        else 0 end
      from tasks
      where penerima_id = p_user
        and tipe <> 'pribadi'
        and coalesce(tenggat::date, created_at::date)
            between (select dari from rentang) and (select sampai from rentang)
    ), 0)

    when 'lead_measure' then coalesce((
      select case when sum(x.target) > 0
        then sum(x.realisasi) / sum(x.target) * 100 else 0 end
      from (
        select lm.target_mingguan as target, coalesce(sum(e.nilai), 0) as realisasi
        from lead_measures lm
        join lead_measure_entries e on e.lead_measure_id = lm.id
        where e.user_id = p_user
          and e.tanggal between (select dari from rentang) and (select sampai from rentang)
        group by lm.id, lm.target_mingguan
      ) x
    ), 0)

    else 0
  end;
$$;
