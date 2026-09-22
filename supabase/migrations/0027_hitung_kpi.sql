-- =====================================================================
-- K-Space V2 — Perhitungan KPI otomatis (PRD §3)
--
-- Skor KPI tidak diketik manual: tiap indikator menarik realisasinya dari
-- sumber yang sudah tercatat (GMV, lead measure, absensi, tugas), lalu
-- diubah ke skala 1.000 dan ditimbang.
-- =====================================================================

/** Realisasi satu indikator KPI untuk satu orang pada satu bulan. */
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

    -- Persentase capaian GMV terhadap target sasaran yang ia pegang.
    when 'gmv' then coalesce((
      select case when sum(gm.target) > 0
        then sum(r.gmv) / sum(gm.target) * 100 else 0 end
      from accounts a
      join goals g on g.account_id = a.id and g.status = 'aktif'
      join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
      left join daily_reports r
        on r.account_id = a.id
       and r.tanggal between (select dari from rentang) and (select sampai from rentang)
      where a.pic_user_id = p_user
    ), 0)

    -- Persentase hari kerja yang hadir tepat waktu.
    when 'absensi' then coalesce((
      select case when count(*) > 0
        then count(*) filter (where status = 'hadir')::numeric / count(*) * 100
        else 0 end
      from attendance
      where user_id = p_user
        and tanggal between (select dari from rentang) and (select sampai from rentang)
    ), 0)

    -- Persentase tugas yang selesai dari yang ditugaskan.
    when 'tiket' then coalesce((
      select case when count(*) > 0
        then count(*) filter (where status = 'selesai')::numeric / count(*) * 100
        else 0 end
      from tasks
      where penerima_id = p_user
        and tipe <> 'pribadi'
        and created_at::date between (select dari from rentang) and (select sampai from rentang)
    ), 0)

    -- Rata-rata capaian lead measure yang ia isi.
    when 'lead_measure' then coalesce((
      select case when sum(lm.target_mingguan) > 0
        then sum(e.nilai) / sum(lm.target_mingguan) * 100 else 0 end
      from lead_measure_entries e
      join lead_measures lm on lm.id = e.lead_measure_id
      where e.user_id = p_user
        and e.tanggal between (select dari from rentang) and (select sampai from rentang)
    ), 0)

    else 0
  end;
$$;

/** Skor KPI seseorang pada satu bulan, lengkap dengan rincian indikatornya. */
create or replace function hitung_kpi(p_user uuid, p_bulan date)
returns table (skor_total numeric, predikat predikat_kpi, detail jsonb)
language sql
stable
as $$
  with dasar as (
    select
      u.id,
      k.nama_kpi,
      k.bobot,
      k.satuan,
      k.sumber_data,
      realisasi_kpi(u.id, k.sumber_data, p_bulan) as realisasi,
      skor_kpi(
        realisasi_kpi(u.id, k.sumber_data, p_bulan),
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
        'nama', nama_kpi,
        'bobot', bobot,
        'satuan', satuan,
        'sumber', sumber_data,
        'realisasi', round(realisasi, 1),
        'skor', skor
      ) order by bobot desc) as rincian
    from dasar
  )
  select total, predikat_dari_skor(total), coalesce(rincian, '[]'::jsonb)
  from hasil;
$$;

/** Scorecard seluruh tim yang terlihat pemanggil. */
create or replace function scorecard_tim(p_bulan date)
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
    u.id,
    u.nama,
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
  left join lateral hitung_kpi(u.id, p_bulan) h on true
  where u.status = 'aktif'
  order by coalesce(s.skor_total, h.skor_total, 0) desc, u.nama;
$$;

comment on function scorecard_tim(date) is
  'Skor KPI tiap orang; memakai snapshot bila bulan itu sudah dikunci.';
