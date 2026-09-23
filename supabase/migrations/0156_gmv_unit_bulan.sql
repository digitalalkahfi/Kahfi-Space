-- =====================================================================
-- K-Space V2 — GMV per unit per bulan, dihitung di basis data
--
-- Layar verifikasi membandingkan GMV V1 dengan GMV V2 per unit per
-- bulan. Sisi V1 dihitung dari ekspor; sisi V2 sampai sekarang tidak
-- dihitung sama sekali — kolomnya kosong dan orang hanya bisa percaya
-- bahwa angkanya cocok.
--
-- Dikerjakan di sini, bukan di aplikasi, karena menariknya berarti
-- memindahkan seluruh laporan harian ke aplikasi hanya untuk
-- menjumlahkannya.
--
-- Unit sebuah laporan datang dari akunnya bila laporannya per akun, dan
-- dari laporannya sendiri bila per unit — dua jalur yang harus disatukan
-- di satu tempat, kalau tidak setiap pemanggil akan menyatukannya dengan
-- caranya sendiri.
-- =====================================================================

create or replace function gmv_unit_bulan()
returns table (unit text, bulan text, gmv numeric, laporan integer)
language sql
stable
as $$
  select
    u.kode,
    to_char(d.tanggal, 'YYYY-MM'),
    coalesce(sum(d.gmv), 0)::numeric,
    count(*)::int
  from daily_reports d
  left join accounts a on a.id = d.account_id
  join units u on u.id = coalesce(a.unit_id, d.unit_id)
  group by u.kode, to_char(d.tanggal, 'YYYY-MM')
  order by to_char(d.tanggal, 'YYYY-MM'), u.kode;
$$;

comment on function gmv_unit_bulan() is
  'GMV dan jumlah laporan per unit per bulan; sisi V2 pada layar verifikasi migrasi.';
