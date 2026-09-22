-- =====================================================================
-- K-Space V2 — Agregat GMV harian untuk dasbor Analitik (PRD Fase 2)
--
-- Dasbor analitik menggambar satu titik per HARI, bukan per laporan.
-- Tanpa fungsi ini, rentang "Tahunan" berarti menarik seluruh laporan
-- setahun ke aplikasi hanya untuk menjumlahkannya di sana — ratusan
-- baris melewati jaringan untuk menghasilkan beberapa puluh angka.
--
-- Tidak ada tabel ringkasan baru: keduanya membaca `daily_reports`
-- langsung, jadi koreksi pada sebuah laporan langsung terlihat di
-- dasbor tanpa proses penyegaran apa pun.
--
-- `security invoker` (bawaan) dipakai dengan sengaja: RLS pemanggil
-- tetap berlaku, jadi Staff hanya ikut menghitung baris yang memang
-- boleh ia lihat — persis seperti `gmv_unit_tanggal` (0007).
-- =====================================================================

-- Satu baris per tanggal yang punya laporan.
--
-- Hari tanpa laporan sengaja TIDAK dibangkitkan sebagai nol: nol berarti
-- "jualan nihil", sedangkan yang sebenarnya terjadi adalah "tidak ada
-- yang melapor". Membedakan keduanya adalah tugas dasbornya, dan ia
-- hanya bisa melakukannya kalau barisnya memang tidak ada.
create or replace function gmv_harian(p_dari date, p_sampai date)
returns table (
  tanggal        date,
  gmv            numeric,
  jumlah_laporan bigint
)
language sql
stable
as $$
  select
    r.tanggal,
    coalesce(sum(r.gmv), 0),
    count(*)
  from daily_reports r
  where r.tanggal between p_dari and p_sampai
  group by r.tanggal
  order by r.tanggal;
$$;

comment on function gmv_harian(date, date) is
  'GMV per hari pada sebuah rentang; hari tanpa laporan tidak muncul.';

-- Sumbangan tiap unit pada rentang yang sama.
--
-- Unit sebuah laporan bisa datang dari dua arah: laporan tingkat unit
-- menyebutnya langsung, laporan tingkat akun mewarisinya dari akunnya.
-- Keduanya digabung di sini supaya pemanggil tidak perlu tahu bedanya —
-- kalau harus tahu, cepat atau lambat ada pemanggil yang lupa dan
-- seluruh laporan akun terbaca sebagai "tanpa unit".
create or replace function gmv_harian_unit(p_dari date, p_sampai date)
returns table (
  unit_id uuid,
  kode    text,
  nama    text,
  gmv     numeric
)
language sql
stable
as $$
  select
    u.id,
    u.kode,
    u.nama,
    coalesce(sum(r.gmv), 0)
  from daily_reports r
  left join accounts a on a.id = r.account_id
  left join units u on u.id = coalesce(r.unit_id, a.unit_id)
  where r.tanggal between p_dari and p_sampai
  group by u.id, u.kode, u.nama
  having coalesce(sum(r.gmv), 0) <> 0
  order by coalesce(sum(r.gmv), 0) desc;
$$;

comment on function gmv_harian_unit(date, date) is
  'Sumbangan GMV tiap unit pada sebuah rentang; unit laporan akun ikut akunnya.';
