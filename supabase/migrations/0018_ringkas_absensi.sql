-- =====================================================================
-- K-Space V2 — Ringkasan kehadiran per periode
--
-- Kartu statistik di halaman rekap sebelumnya menghitung dari seluruh baris
-- yang sudah diunduh. Untuk periode panjang itu boros. Fungsi ini menghitung
-- di database, dengan cakupan yang sama (RLS security invoker).
-- =====================================================================

create or replace function ringkas_absensi(
  p_dari date,
  p_sampai date,
  p_user uuid default null
)
returns table (
  jumlah_baris   int,
  hadir          int,
  terlambat      int,
  izin           int,
  sakit          int,
  luar_radius    int,
  sudah_lapor    int,
  orang          int
)
language sql
stable
as $$
  select
    count(*)::int,
    count(*) filter (where a.status in ('hadir', 'terlambat'))::int,
    count(*) filter (where a.terlambat)::int,
    count(*) filter (where a.status = 'izin')::int,
    count(*) filter (where a.status = 'sakit')::int,
    count(*) filter (where a.jam_masuk is not null and not a.lokasi_valid)::int,
    count(*) filter (where sudah_lapor_harian(a.user_id, a.tanggal))::int,
    count(distinct a.user_id)::int
  from attendance a
  where a.tanggal between p_dari and p_sampai
    and (p_user is null or a.user_id = p_user);
$$;

comment on function ringkas_absensi(date, date, uuid) is
  'Angka ringkas rekap kehadiran; cakupannya mengikuti RLS pemanggil.';
