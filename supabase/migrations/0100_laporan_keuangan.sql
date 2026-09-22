-- =====================================================================
-- K-Space V2 — Laporan keuangan sebagai layanan basis data (PRD §4)
--
-- Arus kas, laba rugi, dan waterfall manajemen dibangun dari ringkasan
-- yang sama (migrasi 0099), jadi ketiganya tidak akan pernah berselisih
-- satu sama lain.
--
-- Yang paling sering disalahpahami ditulis sebagai keterangan di dalam
-- barisnya sendiri, bukan sebagai catatan kaki di layar: pembelian aset
-- mengurangi kas tetapi bukan biaya, dan dividen adalah pemakaian laba
-- yang sudah jadi — bukan beban yang mengurangi laba.
--
-- Urutan barisnya sengaja sama persis dengan `laporanCashFlow`,
-- `laporanLabaRugi`, dan `waterfallManajemen` di src/lib/keuangan.ts:
-- laporan yang dibaca di layar dan yang diunduh dari basis data harus
-- terbaca sebagai laporan yang sama.
-- =====================================================================

create or replace function laporan_cash_flow(
  p_dari date default null,
  p_sampai date default null
)
returns table (
  urutan int,
  label text,
  nilai numeric,
  total boolean,
  catatan text
)
language sql
stable
set search_path = public
as $$
  with r as (select * from ringkas_keuangan(p_dari, p_sampai)),
  awal as (
    select r.saldo_kas - (
      r.pendapatan - r.direct_cost - r.creator_share
        - r.beban - r.aset - r.dividen
    ) as saldo
    from r
  )
  select 1, 'Saldo kas awal', awal.saldo, true, '' from r, awal
  union all select 2, 'Penerimaan usaha', r.pendapatan, false, '' from r
  union all select 3, 'Direct cost akun', -r.direct_cost, false, '' from r
  union all select 4, 'Creator share', -r.creator_share, false, '' from r
  union all select 5, 'Beban operasional', -r.beban, false, '' from r
  union all
    select 6, 'Arus kas operasi',
      r.pendapatan - r.direct_cost - r.creator_share - r.beban, true, ''
    from r
  union all
    select 7, 'Pembelian aset', -r.aset, false,
      'Arus investasi; tidak mengurangi laba.'
    from r
  union all
    select 8, 'Dividen dibayar', -r.dividen, false,
      'Arus pendanaan; pemakaian laba yang sudah jadi.'
    from r
  union all select 9, 'Saldo kas akhir', r.saldo_kas, true, '' from r
  order by 1;
$$;

comment on function laporan_cash_flow is
  'Arus kas satu periode: operasi, investasi, pendanaan, lalu saldo akhir.';

create or replace function laporan_laba_rugi(
  p_dari date default null,
  p_sampai date default null
)
returns table (
  urutan int,
  label text,
  nilai numeric,
  total boolean,
  catatan text
)
language sql
stable
set search_path = public
as $$
  with r as (select * from ringkas_keuangan(p_dari, p_sampai))
  select 1, 'Pendapatan', r.pendapatan, false, '' from r
  union all select 2, 'Direct cost akun', -r.direct_cost, false, '' from r
  union all select 3, 'Creator share', -r.creator_share, false, '' from r
  union all
    select 4, 'Net revenue', r.net_revenue, true, 'Dasar perhitungan NPM.'
    from r
  union all select 5, 'Beban operasional', -r.beban, false, '' from r
  union all select 6, 'Laba bersih', r.laba_bersih, true, '' from r
  order by 1;
$$;

comment on function laporan_laba_rugi is
  'Laba rugi satu periode; aset dan dividen sengaja tidak muncul — keduanya bukan biaya.';

create or replace function waterfall_manajemen(
  p_dari date default null,
  p_sampai date default null
)
returns table (
  urutan int,
  label text,
  nilai numeric,
  total boolean
)
language sql
stable
set search_path = public
as $$
  with r as (select * from ringkas_keuangan(p_dari, p_sampai))
  select 1, 'Pendapatan', r.pendapatan, false from r
  union all select 2, 'Direct cost akun', -r.direct_cost, false from r
  union all select 3, 'Creator share', -r.creator_share, false from r
  union all select 4, 'Net revenue', r.net_revenue, true from r
  union all select 5, 'Beban', -r.beban, false from r
  union all select 6, 'Laba bersih', r.laba_bersih, true from r
  order by 1;
$$;

comment on function waterfall_manajemen is
  'Langkah dari pendapatan ke laba bersih; baris total adalah hasil, bukan komponen.';
