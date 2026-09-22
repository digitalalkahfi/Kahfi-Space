-- =====================================================================
-- K-Space V2 — Lingkup lead measure mengikuti tanggung jawab jabatan
--
-- `realisasi_kpi` sumber 'lead_measure' hanya membaca entri milik orang
-- itu sendiri. Manager dan CEO tidak pernah mengisi entri harian, jadi
-- indikator "Kesehatan matriks WRM" selalu gugur dan cakupan mereka
-- mentok di 60%. Leader pun hanya terhitung bila kebetulan ikut mengisi.
--
-- Aturannya kini sama dengan GMV — lingkup tersempit yang ia pegang:
--   Staff             -> entri miliknya sendiri
--   Leader/Co-Leader  -> seluruh entri lead measure unitnya
--   Manager/CEO       -> seluruh entri lead measure perusahaan
--
-- Target dinormalkan per pekan aktif (target_mingguan x jumlah pekan
-- yang benar-benar terisi), supaya rentang satu bulan tidak dibandingkan
-- dengan target satu pekan.
-- =====================================================================

create or replace function realisasi_lead_measure_kpi(
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
    select p_bulan as dari,
           least(p_sampai, (p_bulan + interval '1 month - 1 day')::date) as sampai
  ),
  entri as (
    select e.lead_measure_id, e.nilai, e.tanggal
    from lead_measure_entries e
    join lead_measures lm on lm.id = e.lead_measure_id and lm.aktif
    left join goals g on g.id = lm.goal_id
    cross join pengguna p
    where e.tanggal between (select dari from rentang) and (select sampai from rentang)
      and (
        (p.role = 'Staff' and e.user_id = p.id)
        or (p.role in ('Leader', 'Co-Leader') and g.unit_id = p.unit_id)
        or (p.role in ('Manager', 'CEO'))
      )
  ),
  sasaran as (
    select
      sum(x.realisasi) as realisasi,
      sum(lm.target_mingguan * x.pekan) as target
    from (
      select lead_measure_id,
             sum(nilai) as realisasi,
             count(distinct awal_pekan(tanggal)) as pekan
      from entri group by lead_measure_id
    ) x
    join lead_measures lm on lm.id = x.lead_measure_id
  )
  -- NULL = tidak ada entri yang menjadi tanggung jawabnya, indikator gugur.
  select case when coalesce(target, 0) > 0 then realisasi / target * 100 else null end
  from sasaran;
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
    select p_bulan as dari,
           least(p_sampai, (p_bulan + interval '1 month - 1 day')::date) as sampai
  )
  select case p_sumber

    when 'gmv' then realisasi_gmv_kpi(p_user, p_bulan, p_sampai)

    when 'lead_measure' then realisasi_lead_measure_kpi(p_user, p_bulan, p_sampai)

    when 'absensi' then (
      select case when count(*) > 0
        then count(*) filter (where status = 'hadir')::numeric / count(*) * 100
        else null end
      from attendance
      where user_id = p_user
        and tanggal between (select dari from rentang) and (select sampai from rentang)
    )

    when 'tiket' then (
      select case when count(*) > 0
        then count(*) filter (where status = 'selesai')::numeric / count(*) * 100
        else null end
      from tasks
      where penerima_id = p_user
        and tipe <> 'pribadi'
        and coalesce(tenggat::date, created_at::date)
            between (select dari from rentang) and (select sampai from rentang)
    )

    else null
  end;
$$;
