-- =====================================================================
-- K-Space V2 — Ringkasan GRD untuk satu layar (PRD §3)
--
-- Menggabungkan empat hal yang ditanyakan Manager tiap pekan:
-- goal korporasi, matriks WRM, papan skor lead measure, dan anak tangga
-- per unit.
-- =====================================================================

/** Goal korporasi bulan berjalan beserta capaiannya. */
create or replace function goal_korporasi(p_tanggal date)
returns table (
  goal_id        uuid,
  judul          text,
  periode        text,
  target_base    numeric,
  target_goal    numeric,
  target_stretch numeric,
  target_bulan   numeric,
  realisasi      numeric,
  rasio          numeric
)
language sql
stable
as $$
  select
    g.id, g.judul, g.periode,
    g.target_base, g.target_goal, g.target_stretch,
    coalesce(gm.target, 0),
    coalesce((
      select sum(r.gmv) from daily_reports r
      where r.tanggal between date_trunc('month', p_tanggal)::date and p_tanggal
    ), 0),
    case when coalesce(gm.target, 0) > 0 then round(coalesce((
      select sum(r.gmv) from daily_reports r
      where r.tanggal between date_trunc('month', p_tanggal)::date and p_tanggal
    ), 0) / gm.target * 100, 1) else 0 end
  from goals g
  left join goal_months gm
    on gm.goal_id = g.id and gm.bulan = date_trunc('month', p_tanggal)::date
  where g.level = 'company' and g.status = 'aktif'
  order by g.created_at
  limit 1;
$$;

/** Papan skor lead measure pekan berjalan. */
create or replace function papan_lead_measure(p_tanggal date)
returns table (
  lead_id     uuid,
  judul       text,
  satuan      text,
  unit_kode   text,
  realisasi   numeric,
  target      numeric,
  rasio       numeric,
  pendukung   numeric,
  label_pendukung text
)
language sql
stable
as $$
  select
    lm.id, lm.judul, lm.satuan, u.kode,
    coalesce(sum(e.nilai), 0),
    lm.target_mingguan,
    case when lm.target_mingguan > 0
      then round(coalesce(sum(e.nilai), 0) / lm.target_mingguan * 100, 1)
      else 0 end,
    sum(e.nilai_pendukung),
    lm.label_pendukung
  from lead_measures lm
  join goals g on g.id = lm.goal_id
  left join units u on u.id = g.unit_id
  left join lead_measure_entries e
    on e.lead_measure_id = lm.id
   and e.tanggal between awal_pekan(p_tanggal) and awal_pekan(p_tanggal) + 6
  where lm.aktif
  group by lm.id, lm.judul, lm.satuan, u.kode, lm.target_mingguan, lm.label_pendukung
  order by lm.urutan, lm.judul;
$$;

/**
 * Anak tangga: goal per level dengan capaiannya.
 * Manager di urutan pertama, lalu tiap unit.
 */
create or replace function anak_tangga_target(p_tanggal date)
returns table (
  goal_id    uuid,
  judul      text,
  level      level_goal,
  pemilik    text,
  jabatan    text,
  unit_kode  text,
  target     numeric,
  realisasi  numeric,
  rasio      numeric
)
language sql
stable
as $$
  select
    g.id, g.judul, g.level, u.nama, u.jabatan, un.kode,
    coalesce(gm.target, 0),
    case
      when g.unit_id is not null then gmv_unit_bulan(g.unit_id, p_tanggal)
      else coalesce((
        select sum(r.gmv) from daily_reports r
        where r.tanggal between date_trunc('month', p_tanggal)::date and p_tanggal
      ), 0)
    end,
    case when coalesce(gm.target, 0) > 0 then round(
      (case
        when g.unit_id is not null then gmv_unit_bulan(g.unit_id, p_tanggal)
        else coalesce((
          select sum(r.gmv) from daily_reports r
          where r.tanggal between date_trunc('month', p_tanggal)::date and p_tanggal
        ), 0)
      end) / gm.target * 100, 1) else 0 end
  from goals g
  left join users u on u.id = g.pemilik_id
  left join units un on un.id = g.unit_id
  left join goal_months gm
    on gm.goal_id = g.id and gm.bulan = date_trunc('month', p_tanggal)::date
  where g.status = 'aktif'
    and g.level in ('manager', 'leader')
  order by
    case g.level when 'manager' then 0 else 1 end,
    un.kode;
$$;

/**
 * Status matriks WRM pekan berjalan, dihitung langsung dari data:
 * Hasil = GMV pekan ini vs target prorata pekan; KRI = rata-rata lead measure.
 */
create or replace function status_wrm(p_tanggal date)
returns table (
  rasio_hasil  numeric,
  rasio_kri    numeric,
  status_hasil warna_wrm,
  status_kri   warna_wrm,
  keputusan    keputusan_wrm
)
language sql
stable
as $$
  with pekan as (
    select awal_pekan(p_tanggal) as mulai, p_tanggal as sampai
  ),
  hasil as (
    select
      coalesce(sum(r.gmv), 0) as gmv,
      -- Target prorata: target harian gabungan × jumlah hari berjalan.
      coalesce((
        select sum(t.target) from target_harian_unit(p_tanggal) t
      ), 0) * (select (sampai - mulai + 1) from pekan) as target
    from daily_reports r, pekan
    where r.tanggal between pekan.mulai and pekan.sampai
  ),
  kri as (
    select coalesce(avg(p.rasio), 0) as rasio from papan_lead_measure(p_tanggal) p
  )
  select
    case when hasil.target > 0
      then round(hasil.gmv / hasil.target * 100, 1) else 0 end,
    round(kri.rasio, 1),
    case when hasil.target > 0 and hasil.gmv / hasil.target * 100 >= 95
      then 'hijau'::warna_wrm else 'merah'::warna_wrm end,
    case when kri.rasio >= 90 then 'hijau'::warna_wrm else 'merah'::warna_wrm end,
    keputusan_wrm(
      case when hasil.target > 0 and hasil.gmv / hasil.target * 100 >= 95
        then 'hijau'::warna_wrm else 'merah'::warna_wrm end,
      case when kri.rasio >= 90 then 'hijau'::warna_wrm else 'merah'::warna_wrm end
    )
  from hasil, kri;
$$;

comment on function status_wrm(date) is
  'Matriks WRM pekan berjalan: Hasil (GMV) × KRI (lead measure).';
