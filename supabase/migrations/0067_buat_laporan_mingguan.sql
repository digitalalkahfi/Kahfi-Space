-- =====================================================================
-- K-Space V2 — Laporan mingguan dibentuk dari data harian
--
-- `weekly_reports` sudah punya trigger yang mengisi keputusan WRM dan
-- hitungan merah beruntun, tetapi tidak ada satu pun jalan yang mengisi
-- tabelnya. Akibatnya riwayat pekan di layar GRD selalu kosong di mode
-- Supabase, dan matriks WRM hanya hidup untuk pekan berjalan.
--
-- Fungsi ini membentuk laporan satu pekan untuk tiap unit, dari sumber
-- yang sama dengan layar harian:
--
--   Hasil : GMV pekan itu (laporan unit + laporan akun-akunnya) diukur
--           terhadap target prorata harian selama tujuh hari. Ambangnya
--           95% — sama dengan `status_wrm`.
--   KRI   : rata-rata capaian lead measure unit itu pada pekan yang sama,
--           ambang 90%.
--
-- Pekan berjalan ditolak: laporan mingguan adalah catatan sejarah, dan
-- separuh pekan selalu terbaca merah tanpa sebab. Membentuk ulang pekan
-- yang sama memperbarui barisnya, bukan menggandakan — angka harian bisa
-- saja dikoreksi setelah pekan berakhir.
-- =====================================================================

create or replace function target_pekan_unit(
  p_pekan date,
  p_sampai date default null
)
returns table (unit_id uuid, target numeric)
language sql
stable
as $$
  -- Target harian tiap unit dijumlahkan hari demi hari, supaya pekan yang
  -- menyeberangi pergantian bulan memakai target bulannya masing-masing.
  -- Pekan yang masih berjalan hanya dihitung sampai hari berjalan, agar
  -- capaiannya tidak dibandingkan dengan target hari yang belum tiba.
  select t.unit_id, sum(t.target)
  from generate_series(
         p_pekan,
         least(coalesce(p_sampai, p_pekan + 6), p_pekan + 6),
         interval '1 day') d
  cross join lateral target_harian_unit(d::date) t
  group by t.unit_id;
$$;

/**
 * Hitungan laporan mingguan tanpa menyimpannya.
 *
 * Dipakai dua-duanya: pembentukan laporan pekan yang sudah lewat, dan
 * tampilan pekan berjalan yang belum boleh dibekukan. Satu rumus, jadi
 * layar dan arsip tidak pernah bercerita berbeda.
 */
create or replace function hitung_laporan_mingguan(
  p_pekan date,
  p_sampai date default current_date
)
returns table (
  unit_id      uuid,
  unit_kode    text,
  target       numeric,
  gmv          numeric,
  rasio_hasil  numeric,
  rasio_kri    numeric,
  status_hasil warna_wrm,
  status_kri   warna_wrm
)
language sql
stable
as $$
  with batas as (
    select least(p_sampai, p_pekan + 6) as sampai
  ),
  baris as (
    select
      u.id, u.kode,
      coalesce(t.target, 0) as target,
      coalesce(g.gmv, 0) as gmv,
      coalesce(k.rasio, 0) as rasio_kri
    from units u
    cross join batas
    left join target_pekan_unit(p_pekan, batas.sampai) t on t.unit_id = u.id
    left join lateral (
      select sum(r.gmv) gmv
      from daily_reports r
      left join accounts a on a.id = r.account_id
      where coalesce(r.unit_id, a.unit_id) = u.id
        and r.tanggal between p_pekan and batas.sampai
    ) g on true
    left join lateral (
      select avg(p.rasio) rasio
      from papan_lead_measure(p_pekan) p
      where p.unit_kode = u.kode
    ) k on true
  )
  select
    id, kode, target, gmv,
    case when target > 0 then round(gmv / target * 100, 1) else 0 end,
    round(rasio_kri, 1),
    -- Ambang 95% dan 90% sama dengan `status_wrm`.
    case when target > 0 and gmv / target * 100 >= 95
      then 'hijau'::warna_wrm else 'merah'::warna_wrm end,
    case when rasio_kri >= 90
      then 'hijau'::warna_wrm else 'merah'::warna_wrm end
  from baris;
$$;

create or replace function buat_laporan_mingguan(p_pekan date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  jumlah integer := 0;
begin
  if extract(isodow from p_pekan) <> 1 then
    raise exception 'Periode laporan mingguan harus hari Senin';
  end if;

  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh membentuk laporan mingguan'
      using errcode = 'insufficient_privilege';
  end if;

  if p_pekan + 6 >= current_date then
    raise exception 'Pekan % belum selesai; laporannya dibentuk setelah pekan berakhir',
      to_char(p_pekan, 'DD Mon YYYY')
      using errcode = 'check_violation';
  end if;

  insert into weekly_reports as w
    (unit_id, periode, target_mingguan, gmv_total,
     rasio_hasil, rasio_kri, status_hasil, status_kri, keputusan, ringkasan)
  select
    h.unit_id,
    p_pekan,
    h.target,
    h.gmv,
    h.rasio_hasil,
    h.rasio_kri,
    h.status_hasil,
    h.status_kri,
    -- Diisi ulang trigger `weekly_lengkapi`; nilai ini sekadar pemenuh
    -- kolom NOT NULL.
    'LANJUT'::keputusan_wrm,
    ''
  from hitung_laporan_mingguan(p_pekan, p_pekan + 6) h
  on conflict (unit_id, periode) where unit_id is not null
  do update set
    target_mingguan = excluded.target_mingguan,
    gmv_total       = excluded.gmv_total,
    rasio_hasil     = excluded.rasio_hasil,
    rasio_kri       = excluded.rasio_kri,
    status_hasil    = excluded.status_hasil,
    status_kri      = excluded.status_kri,
    generated_at    = now()
  where w.periode = excluded.periode;

  get diagnostics jumlah = row_count;
  return jumlah;
end;
$$;

comment on function buat_laporan_mingguan(date) is
  'Membentuk/memperbarui laporan mingguan tiap unit dari data harian.';
