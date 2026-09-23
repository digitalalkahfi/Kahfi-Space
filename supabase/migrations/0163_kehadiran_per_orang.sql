-- =====================================================================
-- K-Space V2 — Kehadiran per orang, untuk menemukan siapa yang datanya
-- tidak sampai
--
-- Total dan per bulan menjawab "berapa yang hilang". Yang belum terjawab:
-- "milik siapa". Tanpa itu, satu-satunya cara menemukannya adalah
-- memeriksa satu per satu — dan pada organisasi dua puluhan orang dengan
-- ribuan baris kehadiran, itu berarti tidak diperiksa sama sekali.
-- =====================================================================

create or replace function kehadiran_per_orang()
returns table (user_id uuid, nama text, hadir integer, izin integer)
language sql
stable
as $$
  select
    u.id,
    u.nama,
    count(*) filter (where a.status in ('hadir', 'terlambat'))::int,
    count(*) filter (where a.status in ('izin', 'sakit'))::int
  from users u
  left join attendance a on a.user_id = u.id
  group by u.id, u.nama
  order by u.nama;
$$;

comment on function kehadiran_per_orang() is
  'Jumlah kehadiran tiap orang; dipakai menemukan milik siapa data yang tidak sampai.';
