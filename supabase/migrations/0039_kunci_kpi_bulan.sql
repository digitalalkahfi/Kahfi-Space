-- =====================================================================
-- K-Space V2 — Snapshot KPI bulanan & penguncian
--
-- `kpi_snapshots` sudah final begitu dikunci (trigger 0024 menolak update
-- maupun delete). Karena tak bisa dibatalkan, penguncian dijaga dua hal:
--
--   1. hanya CEO/Manager, sejalan policy `kpi_snap_kelola`;
--   2. hanya bulan yang sudah tuntas — membekukan skor setengah bulan
--      akan mengabadikan angka yang belum utuh.
--
-- Orang yang sudah punya snapshot dilewati, sehingga fungsinya aman
-- dipanggil ulang tanpa menggandakan atau menimpa apa pun.
--
-- Cakupan penilaian ikut disimpan. Tanpa itu, skor 0 dari bulan yang
-- memang belum berdata akan terbaca sebagai "0 dan terukur penuh" —
-- persis angka menyesatkan yang dihindari 0032–0034.
-- =====================================================================

alter table kpi_snapshots
  add column if not exists cakupan numeric(5, 1) not null default 0
    check (cakupan between 0 and 100);

comment on column kpi_snapshots.cakupan is
  'Persentase bobot indikator yang benar-benar dinilai saat dikunci.';

create or replace function status_kunci_kpi(p_bulan date)
returns table (
  terkunci     integer,
  belum        integer,
  dikunci_oleh text,
  dikunci_pada timestamptz,
  bulan_tuntas boolean
)
language sql
stable
as $$
  with orang as (
    select count(*)::int n from users where status = 'aktif'
  ),
  snap as (
    select
      count(*) filter (where s.dikunci_pada is not null)::int terkunci,
      max(s.dikunci_pada) pada,
      (array_agg(u.nama order by s.dikunci_pada desc nulls last))[1] oleh
    from kpi_snapshots s
    left join users u on u.id = s.dikunci_oleh
    where s.periode_bulan = p_bulan
  )
  select
    snap.terkunci,
    greatest(orang.n - snap.terkunci, 0),
    snap.oleh,
    snap.pada,
    (p_bulan + interval '1 month')::date <= current_date
  from orang, snap;
$$;

create or replace function kunci_kpi_bulan(p_bulan date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  akhir_bulan date := (p_bulan + interval '1 month - 1 day')::date;
  jumlah integer := 0;
begin
  if extract(day from p_bulan) <> 1 then
    raise exception 'Periode harus tanggal 1 sebuah bulan';
  end if;

  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh mengunci KPI'
      using errcode = 'insufficient_privilege';
  end if;

  -- Penguncian tidak bisa dibatalkan, jadi bulan berjalan ditolak:
  -- skor separuh bulan akan terlanjur jadi angka resmi.
  if akhir_bulan >= current_date then
    raise exception 'Bulan % belum selesai; KPI baru bisa dikunci setelah bulan berakhir',
      to_char(p_bulan, 'Mon YYYY')
      using errcode = 'check_violation';
  end if;

  -- Bulan tanpa data sama sekali tidak boleh dikunci: nolnya akan
  -- terlanjur menjadi skor resmi yang tak bisa diperbaiki lagi.
  if not exists (
    select 1
    from users u
    cross join lateral hitung_kpi(u.id, p_bulan, akhir_bulan) h
    where u.status = 'aktif' and h.cakupan > 0
  ) then
    raise exception 'Tidak ada data KPI pada %; tidak ada yang bisa dikunci',
      to_char(p_bulan, 'Mon YYYY')
      using errcode = 'check_violation';
  end if;

  insert into kpi_snapshots
    (user_id, periode_bulan, skor_total, predikat, cakupan, detail,
     dikunci_oleh, dikunci_pada)
  select
    u.id, p_bulan, h.skor_total, h.predikat, h.cakupan, h.detail,
    auth.uid(), now()
  from users u
  cross join lateral hitung_kpi(u.id, p_bulan, akhir_bulan) h
  where u.status = 'aktif'
    and not exists (
      select 1 from kpi_snapshots s
      where s.user_id = u.id and s.periode_bulan = p_bulan
    );

  get diagnostics jumlah = row_count;
  return jumlah;
end;
$$;

-- ---------------------------------------------------------------------
-- Scorecard membaca cakupan yang tersimpan, bukan mengandaikan 100.
-- ---------------------------------------------------------------------
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
  with baris as (
    select
      u.id as user_id, u.nama,
      upper(left(split_part(u.nama, ' ', 1), 1)
            || left(split_part(u.nama, ' ', array_length(string_to_array(u.nama, ' '), 1)), 1)) as inisial,
      u.jabatan,
      coalesce(split_part(un.nama, ' (', 1), 'Manajemen') as unit,
      coalesce(s.skor_total, h.skor_total, 0) as skor,
      coalesce(s.predikat, h.predikat, 'Perlu Perbaikan'::predikat_kpi) as predikat,
      coalesce(s.cakupan, h.cakupan, 0) as cakupan,
      coalesce(s.detail, h.detail, '[]'::jsonb) as detail,
      s.dikunci_pada is not null as terkunci
    from users u
    left join units un on un.id = u.unit_id
    left join kpi_snapshots s on s.user_id = u.id and s.periode_bulan = p_bulan
    left join lateral hitung_kpi(u.id, p_bulan, p_sampai) h on true
    where u.status = 'aktif'
  )
  select user_id, nama, inisial, jabatan, unit, skor, predikat, cakupan, detail, terkunci
  from baris
  order by (cakupan >= 100) desc, skor desc, nama;
$$;
