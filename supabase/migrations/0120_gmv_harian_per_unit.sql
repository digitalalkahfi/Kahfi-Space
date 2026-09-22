-- =====================================================================
-- K-Space V2 — GMV harian DIPECAH PER UNIT (PRD Fase 2)
--
-- `gmv_harian` (0110) menjawab "berapa totalnya hari itu", dan
-- `gmv_harian_unit` menjawab "berapa sumbangan tiap lini sepanjang
-- periode". Yang belum terjawab adalah pertanyaan yang justru paling
-- sering muncul saat garis totalnya turun: LINI MANA yang turun.
--
-- Satu baris per (tanggal, unit) yang punya laporan. Kombinasi tanpa
-- laporan tidak dibangkitkan sebagai nol — alasan yang sama seperti
-- 0110: nol berarti "tidak ada penjualan", sedangkan yang terjadi
-- adalah "tidak ada yang melapor", dan grafik tidak boleh mengarang
-- bedanya.
-- =====================================================================

create or replace function gmv_harian_per_unit(p_dari date, p_sampai date)
returns table (
  tanggal        date,
  unit_id        uuid,
  kode           text,
  nama           text,
  gmv            numeric,
  jumlah_laporan bigint
)
language sql
stable
as $$
  select
    r.tanggal,
    u.id,
    u.kode,
    u.nama,
    coalesce(sum(r.gmv), 0),
    count(*)
  from daily_reports r
  -- Unit sebuah laporan datang dari dua arah: laporan tingkat unit
  -- menyebutnya langsung, laporan tingkat akun mewarisinya dari
  -- akunnya. Digabung di sini supaya pemanggil tidak perlu tahu
  -- bedanya — dan tidak ada yang lupa lalu membaca seluruh laporan
  -- akun sebagai "tanpa unit".
  left join accounts a on a.id = r.account_id
  left join units u on u.id = coalesce(r.unit_id, a.unit_id)
  where r.tanggal between p_dari and p_sampai
    and u.id is not null
  group by r.tanggal, u.id, u.kode, u.nama
  order by r.tanggal, u.kode;
$$;

comment on function gmv_harian_per_unit(date, date) is
  'GMV per hari per unit pada sebuah rentang; kombinasi tanpa laporan tidak muncul.';
