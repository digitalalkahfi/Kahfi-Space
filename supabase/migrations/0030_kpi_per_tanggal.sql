-- =====================================================================
-- K-Space V2 — KPI dihitung "per tanggal", bukan selalu hari ini
--
-- Versi sebelumnya memakai current_date sebagai batas evaluasi. Itu membuat
-- dua hal mustahil: menghitung ulang KPI bulan lampau apa adanya, dan
-- menampilkan data contoh yang tanggal acuannya bukan hari ini.
--
-- Sekarang batas evaluasi jadi parameter; bawaannya tetap hari ini.
-- =====================================================================

create or replace function porsi_bulan_berjalan(p_bulan date, p_sampai date)
returns numeric
language sql
immutable
as $$
  select case
    when p_sampai >= (p_bulan + interval '1 month')::date then 1
    when p_sampai < p_bulan then 0
    else extract(day from p_sampai)::numeric
         / extract(day from (p_bulan + interval '1 month - 1 day'))::numeric
  end;
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
      least(p_sampai, (p_bulan + interval '1 month - 1 day')::date) as sampai,
      greatest(porsi_bulan_berjalan(p_bulan, p_sampai), 0.01) as porsi
  )
  select case p_sumber

    when 'gmv' then coalesce((
      select case when sum(x.target) > 0
        then sum(x.realisasi) / (sum(x.target) * (select porsi from rentang)) * 100
        else 0 end
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

drop function if exists hitung_kpi(uuid, date);

create function hitung_kpi(
  p_user uuid,
  p_bulan date,
  p_sampai date default current_date
)
returns table (skor_total numeric, predikat predikat_kpi, detail jsonb)
language sql
stable
as $$
  with dasar as (
    select
      k.nama_kpi, k.bobot, k.satuan, k.sumber_data,
      realisasi_kpi(u.id, k.sumber_data, p_bulan, p_sampai) as realisasi,
      skor_kpi(
        realisasi_kpi(u.id, k.sumber_data, p_bulan, p_sampai),
        k.target_base, k.target_goal, k.target_stretch
      ) as skor
    from users u
    join kpi_definitions k on k.jabatan = u.role::text and k.aktif
    where u.id = p_user
  ),
  hasil as (
    select
      case when sum(bobot) > 0
        then round(sum(skor * bobot) / sum(bobot), 1) else 0 end as total,
      jsonb_agg(jsonb_build_object(
        'nama', nama_kpi, 'bobot', bobot, 'satuan', satuan,
        'sumber', sumber_data, 'realisasi', round(realisasi, 1), 'skor', skor
      ) order by bobot desc) as rincian
    from dasar
  )
  select total, predikat_dari_skor(total), coalesce(rincian, '[]'::jsonb)
  from hasil;
$$;

drop function if exists scorecard_tim(date);

create function scorecard_tim(p_bulan date, p_sampai date default current_date)
returns table (
  user_id  uuid,
  nama     text,
  inisial  text,
  jabatan  text,
  unit     text,
  skor     numeric,
  predikat predikat_kpi,
  detail   jsonb,
  terkunci boolean
)
language sql
stable
as $$
  select
    u.id, u.nama,
    upper(left(split_part(u.nama, ' ', 1), 1)
          || left(split_part(u.nama, ' ', array_length(string_to_array(u.nama, ' '), 1)), 1)),
    u.jabatan,
    coalesce(split_part(un.nama, ' (', 1), 'Manajemen'),
    coalesce(s.skor_total, h.skor_total, 0),
    coalesce(s.predikat, h.predikat, 'Perlu Perbaikan'::predikat_kpi),
    coalesce(s.detail, h.detail, '[]'::jsonb),
    s.dikunci_pada is not null
  from users u
  left join units un on un.id = u.unit_id
  left join kpi_snapshots s on s.user_id = u.id and s.periode_bulan = p_bulan
  left join lateral hitung_kpi(u.id, p_bulan, p_sampai) h on true
  where u.status = 'aktif'
  order by coalesce(s.skor_total, h.skor_total, 0) desc, u.nama;
$$;
