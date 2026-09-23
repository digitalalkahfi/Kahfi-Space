-- =====================================================================
-- K-Space V2 — Kehadiran per bulan, untuk pembanding verifikasi
--
-- Total kehadiran yang cocok belum berarti kehadirannya utuh: seribu
-- baris di V1 dan seribu di V2 bisa saja jatuh di bulan yang
-- berbeda-beda. Yang menangkap itu hanya perbandingan per bulan.
--
-- Dipisah antara yang hadir dan yang izin/sakit karena keduanya datang
-- dari kunci ekspor yang berbeda (`attendance:all` dan
-- `leave-requests:all`), dan selisih pada salah satunya berarti hal yang
-- berbeda.
-- =====================================================================

create or replace function kehadiran_per_bulan()
returns table (bulan text, hadir integer, izin integer, semua integer)
language sql
stable
as $$
  select
    to_char(a.tanggal, 'YYYY-MM'),
    count(*) filter (where a.status in ('hadir', 'terlambat'))::int,
    count(*) filter (where a.status in ('izin', 'sakit'))::int,
    count(*)::int
  from attendance a
  group by to_char(a.tanggal, 'YYYY-MM')
  order by to_char(a.tanggal, 'YYYY-MM');
$$;

comment on function kehadiran_per_bulan() is
  'Jumlah kehadiran per bulan; sisi V2 pada pembanding verifikasi migrasi.';
