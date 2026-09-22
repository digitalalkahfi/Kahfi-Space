-- =====================================================================
-- K-Space V2 — Perbaikan perhitungan KPI: duplikasi indikator & cakupan
--
-- Dua masalah pada 0032:
--
-- 1. `hitung_kpi` menjoin ulang ke kpi_definitions hanya lewat
--    (nama_kpi, bobot) tanpa jabatan. Nama indikator seperti "Kedisiplinan
--    absensi" dipakai beberapa jabatan, jadi satu indikator bisa terhitung
--    dua kali dan total bobot membengkak. Target sekarang dibawa langsung
--    di CTE pertama, tidak ada join kedua.
--
-- 2. Mengecualikan indikator yang tidak berlaku membuat sisa bobot
--    menanggung seluruh nilai — staf yang hanya punya data absensi bisa
--    tampil 1.000 (Istimewa). Skor tetap dinormalkan, tapi sekarang
--    disertai `cakupan`: persentase bobot yang benar-benar dinilai.
--    Angka 1.000 dengan cakupan 25% terbaca apa adanya, bukan prestasi.
-- =====================================================================

drop function if exists hitung_kpi(uuid, date, date);

create function hitung_kpi(
  p_user uuid,
  p_bulan date,
  p_sampai date default current_date
)
returns table (
  skor_total numeric,
  predikat predikat_kpi,
  cakupan numeric,
  detail jsonb
)
language sql
stable
as $$
  with dinilai as (
    select
      k.nama_kpi, k.bobot, k.satuan, k.sumber_data,
      r.realisasi,
      case when r.realisasi is null then null
        else skor_kpi(r.realisasi, k.target_base, k.target_goal, k.target_stretch)
      end as skor
    from users u
    join kpi_definitions k on k.jabatan = u.role::text and k.aktif
    cross join lateral (
      select realisasi_kpi(u.id, k.sumber_data, p_bulan, p_sampai) as realisasi
    ) r
    where u.id = p_user
  ),
  hasil as (
    select
      case when sum(bobot) filter (where skor is not null) > 0
        then round(
          sum(skor * bobot) filter (where skor is not null)
          / sum(bobot) filter (where skor is not null), 1)
        else 0 end as total,
      case when sum(bobot) > 0
        then round(
          coalesce(sum(bobot) filter (where skor is not null), 0)
          / sum(bobot) * 100, 0)
        else 0 end as cakupan,
      jsonb_agg(jsonb_build_object(
        'nama', nama_kpi, 'bobot', bobot, 'satuan', satuan,
        'sumber', sumber_data,
        'realisasi', case when realisasi is null then null else round(realisasi, 1) end,
        'skor', skor,
        'berlaku', skor is not null
      ) order by bobot desc, nama_kpi) as rincian
    from dinilai
  )
  select total, predikat_dari_skor(total), cakupan, coalesce(rincian, '[]'::jsonb)
  from hasil;
$$;

drop function if exists scorecard_tim(date, date);

create function scorecard_tim(p_bulan date, p_sampai date default current_date)
returns table (
  user_id uuid, nama text, inisial text, jabatan text, unit text,
  skor numeric, predikat predikat_kpi, cakupan numeric,
  detail jsonb, terkunci boolean
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
    -- Snapshot terkunci dianggap lengkap: angkanya sudah disahkan.
    case when s.dikunci_pada is not null then 100 else coalesce(h.cakupan, 0) end,
    coalesce(s.detail, h.detail, '[]'::jsonb),
    s.dikunci_pada is not null
  from users u
  left join units un on un.id = u.unit_id
  left join kpi_snapshots s on s.user_id = u.id and s.periode_bulan = p_bulan
  left join lateral hitung_kpi(u.id, p_bulan, p_sampai) h on true
  where u.status = 'aktif'
  order by coalesce(s.skor_total, h.skor_total, 0) desc, u.nama;
$$;
