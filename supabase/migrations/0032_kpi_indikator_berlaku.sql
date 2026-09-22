-- =====================================================================
-- K-Space V2 — Indikator KPI yang tidak berlaku tidak dinilai nol
--
-- Sebelumnya `realisasi_kpi` mengembalikan 0 untuk dua hal yang berbeda:
--   (a) orangnya punya target tapi belum mencapai apa pun, dan
--   (b) orangnya memang tidak punya target itu sama sekali.
--
-- Akibatnya staf tanpa akun affiliator selalu mendapat 0 pada "Capaian GMV
-- akun", dan rata-rata tim jatuh ke 273 walau tidak ada yang bermasalah.
-- Menilai orang atas sesuatu yang bukan tanggung jawabnya membuat seluruh
-- KPI kehilangan makna.
--
-- Sekarang fungsi mengembalikan NULL untuk kasus (b). Indikator ber-NULL
-- dikeluarkan dari perhitungan, dan bobotnya dinormalkan ulang.
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
  sasaran as (
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
  -- NULL = tidak punya target GMV sama sekali, jadi indikator ini tidak berlaku.
  select case when coalesce(sum(target), 0) > 0
    then sum(realisasi) / (sum(target) * (select porsi from rentang)) * 100
    else null end
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

    -- Tidak ada catatan absensi sama sekali → indikator tidak berlaku.
    when 'absensi' then (
      select case when count(*) > 0
        then count(*) filter (where status = 'hadir')::numeric / count(*) * 100
        else null end
      from attendance
      where user_id = p_user
        and tanggal between (select dari from rentang) and (select sampai from rentang)
    )

    -- Tidak pernah ditugasi → indikator tidak berlaku.
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

    -- Bukan pengisi lead measure → indikator tidak berlaku.
    when 'lead_measure' then (
      select case when sum(x.target) > 0
        then sum(x.realisasi) / sum(x.target) * 100 else null end
      from (
        select lm.target_mingguan as target, coalesce(sum(e.nilai), 0) as realisasi
        from lead_measures lm
        join lead_measure_entries e on e.lead_measure_id = lm.id
        where e.user_id = p_user
          and e.tanggal between (select dari from rentang) and (select sampai from rentang)
        group by lm.id, lm.target_mingguan
      ) x
    )

    else null
  end;
$$;

drop function if exists hitung_kpi(uuid, date, date);

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
      realisasi_kpi(u.id, k.sumber_data, p_bulan, p_sampai) as realisasi
    from users u
    join kpi_definitions k on k.jabatan = u.role::text and k.aktif
    where u.id = p_user
  ),
  dinilai as (
    select
      d.*,
      case when d.realisasi is null then null
        else skor_kpi(d.realisasi, k.target_base, k.target_goal, k.target_stretch)
      end as skor
    from dasar d
    join kpi_definitions k
      on k.nama_kpi = d.nama_kpi and k.bobot = d.bobot and k.aktif
  ),
  hasil as (
    select
      -- Hanya indikator yang berlaku yang menimbang; bobot dinormalkan ulang.
      case when sum(bobot) filter (where skor is not null) > 0
        then round(
          sum(skor * bobot) filter (where skor is not null)
          / sum(bobot) filter (where skor is not null), 1)
        else 0 end as total,
      jsonb_agg(jsonb_build_object(
        'nama', nama_kpi, 'bobot', bobot, 'satuan', satuan,
        'sumber', sumber_data,
        'realisasi', case when realisasi is null then null else round(realisasi, 1) end,
        'skor', skor,
        'berlaku', skor is not null
      ) order by bobot desc) as rincian
    from dinilai
  )
  select total, predikat_dari_skor(total), coalesce(rincian, '[]'::jsonb)
  from hasil;
$$;

drop function if exists scorecard_tim(date, date);

create function scorecard_tim(p_bulan date, p_sampai date default current_date)
returns table (
  user_id uuid, nama text, inisial text, jabatan text, unit text,
  skor numeric, predikat predikat_kpi, detail jsonb, terkunci boolean
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
