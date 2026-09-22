-- =====================================================================
-- K-Space V2 — Perbaikan perhitungan realisasi KPI
--
-- Dua kekeliruan pada versi sebelumnya:
--
-- 1. Cabang 'gmv' menjumlahkan target bulanan SETELAH join ke daily_reports.
--    Karena satu goal punya banyak laporan harian, target ikut tergandakan
--    sebanyak jumlah laporan — capaian 64% terbaca 3%.
--    Perbaikan: laporan diringkas dulu di subquery, baru dijodohkan.
--
-- 2. Cabang 'tiket' menyaring memakai created_at. Tugas yang dibuat di luar
--    bulan penilaian jadi tidak terhitung walau tenggatnya di bulan itu.
--    Perbaikan: pakai tenggat bila ada, baru jatuh ke created_at.
-- =====================================================================

create or replace function realisasi_kpi(
  p_user uuid,
  p_sumber sumber_kpi,
  p_bulan date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with rentang as (
    select p_bulan as dari,
           least(current_date, (p_bulan + interval '1 month - 1 day')::date) as sampai
  )
  select case p_sumber

    when 'gmv' then coalesce((
      select case when sum(x.target) > 0
        then sum(x.realisasi) / sum(x.target) * 100 else 0 end
      from (
        select
          gm.target,
          coalesce((
            select sum(r.gmv) from daily_reports r
            where r.account_id = a.id
              and r.tanggal between (select dari from rentang)
                                and (select sampai from rentang)
          ), 0) as realisasi
        from accounts a
        join goals g on g.account_id = a.id and g.status = 'aktif'
        join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
        where a.pic_user_id = p_user
      ) x
    ), 0)

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
        select
          lm.target_mingguan as target,
          coalesce(sum(e.nilai), 0) as realisasi
        from lead_measures lm
        join lead_measure_entries e on e.lead_measure_id = lm.id
        where e.user_id = p_user
          and e.tanggal between (select dari from rentang)
                            and (select sampai from rentang)
        group by lm.id, lm.target_mingguan
      ) x
    ), 0)

    else 0
  end;
$$;
