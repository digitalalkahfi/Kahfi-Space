-- =====================================================================
-- K-Space V2 — Penguncian melewati orang yang tak punya data bulan itu
--
-- 0039 menolak mengunci bulan yang sama sekali kosong, tapi penjagaan
-- itu berlaku untuk bulan, bukan per orang. Begitu satu orang berdata,
-- seluruh anggota aktif ikut dibekukan — termasuk yang cakupannya 0:
--
--   * orang yang baru bergabung setelah bulan itu lewat mendapat skor 0
--     permanen untuk bulan saat ia belum bekerja di sini;
--   * snapshot bersifat final (0024 menolak update dan delete), jadi
--     angka itu tidak bisa diperbaiki selamanya.
--
-- Cakupan 0 berarti tidak ada satu pun indikator yang bisa dinilai —
-- bukan "bekerja tapi hasilnya nol". Orang seperti itu dilewati: ia
-- tampil belum dinilai, bukan dinilai nol. Kalau datanya menyusul,
-- bulan itu tinggal dikunci ulang — yang sudah terkunci tetap utuh.
--
-- `status_kunci_kpi` ikut disesuaikan supaya "belum" hanya menghitung
-- orang yang memang bisa dikunci; kalau tidak, layar akan selamanya
-- menampilkan sisa yang tak akan pernah habis.
-- =====================================================================

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

  if akhir_bulan >= current_date then
    raise exception 'Bulan % belum selesai; KPI baru bisa dikunci setelah bulan berakhir',
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
    and h.cakupan > 0
    and not exists (
      select 1 from kpi_snapshots s
      where s.user_id = u.id and s.periode_bulan = p_bulan
    );

  get diagnostics jumlah = row_count;

  -- Bulan tanpa data sama sekali: nolnya akan terlanjur menjadi skor
  -- resmi yang tak bisa diperbaiki lagi, jadi penguncian dibatalkan.
  if jumlah = 0 and not exists (
    select 1 from kpi_snapshots s where s.periode_bulan = p_bulan
  ) then
    raise exception 'Tidak ada data KPI pada %; tidak ada yang bisa dikunci',
      to_char(p_bulan, 'Mon YYYY')
      using errcode = 'check_violation';
  end if;

  return jumlah;
end;
$$;

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
  with bisa as (
    select count(*)::int n
    from users u
    cross join lateral hitung_kpi(
      u.id, p_bulan, (p_bulan + interval '1 month - 1 day')::date) h
    where u.status = 'aktif' and h.cakupan > 0
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
    greatest(bisa.n - snap.terkunci, 0),
    snap.oleh,
    snap.pada,
    (p_bulan + interval '1 month')::date <= current_date
  from bisa, snap;
$$;
