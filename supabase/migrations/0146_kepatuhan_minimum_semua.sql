-- =====================================================================
-- K-Space V2 — Kepatuhan seluruh akun sekaligus
--
-- Halaman Kelola Akun menampilkan kepatuhan bulan berjalan di tiap
-- baris. Memanggil `kepatuhan_minimum_akun` satu per satu berarti satu
-- perjalanan jaringan per akun — dan halaman itu memang dibuka justru
-- ketika akunnya banyak.
--
-- Rumusnya tidak diulang di sini: fungsi ini memanggil fungsi yang sama,
-- jadi tidak ada kemungkinan keduanya menjawab berbeda.
-- =====================================================================

create or replace function kepatuhan_minimum_semua(
  p_dari date,
  p_sampai date
)
returns table (
  account_id uuid,
  hari_kerja integer,
  terpenuhi  integer,
  rasio      numeric,
  minimum    integer
)
language sql
stable
set search_path = public
as $$
  select a.id, k.hari_kerja, k.terpenuhi, k.rasio, k.minimum
  from accounts a
  cross join lateral kepatuhan_minimum_akun(a.id, p_dari, p_sampai) k
  where a.status = 'aktif';
$$;

comment on function kepatuhan_minimum_semua(date, date) is
  'Kepatuhan batas minimum seluruh akun aktif yang terlihat pemanggil, satu panggilan.';
