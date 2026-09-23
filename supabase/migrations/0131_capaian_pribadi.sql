-- =====================================================================
-- K-Space V2 — Capaian pribadi di Beranda (PRD Fase 2)
--
-- Satu panggilan untuk seluruh kartu: deret harian target-vs-realisasi
-- sepanjang jendela, lengkap dengan kolom departemen dan CO sampel.
-- Beranda dibuka setiap pagi oleh semua orang sekaligus; menariknya
-- sebagai empat kueri terpisah berarti empat kali beban itu.
--
-- "Milik saya" di sini berarti sasaran yang memang dipegang sendiri:
-- akun yang ia jadi PIC-nya, atau unit yang ia pimpin dan melapor di
-- tingkat unit. CEO & Manager tidak ikut melihat seluruh perusahaan di
-- kartu ini — untuk itu sudah ada kartu GMV lintas unit.
-- =====================================================================

create or replace function capaian_pribadi_saya(
  p_dari date,
  p_sampai date
)
returns table (
  tanggal       date,
  target        numeric,
  gmv           numeric,
  komisi        numeric,
  jumlah_upload integer,
  co_sampel     integer,
  -- Dua kolom terakhir sama di setiap baris. Sengaja ikut di sini, bukan
  -- lewat panggilan kedua: Beranda dibuka semua orang setiap pagi, dan
  -- satu kolom teks yang berulang jauh lebih murah daripada satu RPC
  -- tambahan per pembukaan halaman.
  lingkup       text,
  departemen    text
)
language sql
stable
set search_path = public
as $$
  with akun_saya as (
    select a.id
    from accounts a
    where a.status = 'aktif' and a.pic_user_id = auth.uid()
  ),
  unit_saya as (
    select u.id
    from units u
    where not exists (
        select 1 from accounts a
        where a.unit_id = u.id and a.status = 'aktif'
      )
      and exists (
        select 1 from users me
        where me.id = auth.uid()
          and me.role = 'Leader'
          and me.unit_id = u.id
      )
  ),
  hari as (
    select d::date as tanggal
    from generate_series(p_dari, p_sampai, interval '1 day') d
  ),
  lapor as (
    select
      r.tanggal,
      sum(r.gmv) as gmv,
      sum(r.komisi) as komisi,
      sum(r.jumlah_upload)::int as jumlah_upload
    from daily_reports r
    where r.tanggal between p_dari and p_sampai
      and (
        r.account_id in (select id from akun_saya)
        or r.unit_id in (select id from unit_saya)
      )
    group by r.tanggal
  ),
  sebutan as (
    select
      string_agg(nama, ', ' order by nama) as daftar,
      count(*)::int as jumlah,
      min(nama) as pertama,
      case when count(distinct kode) = 1 then min(kode) end as unit
    from (
      select a.username as nama, u.kode
      from accounts a join units u on u.id = a.unit_id
      where a.id in (select id from akun_saya)
      union all
      select u.nama, u.kode
      from units u where u.id in (select id from unit_saya)
    ) s
  ),
  scan as (
    select
      (sc.pada at time zone 'Asia/Jakarta')::date as tanggal,
      count(*)::int as jumlah
    from sample_scans sc
    join samples s on s.id = sc.sample_id
    where sc.dikenali
      and s.account_id in (select id from akun_saya)
      and (sc.pada at time zone 'Asia/Jakarta')::date between p_dari and p_sampai
    group by 1
  )
  select
    h.tanggal,
    coalesce(
      (select sum(t.target) from target_harian_akun(h.tanggal) t
        where t.account_id in (select id from akun_saya)), 0)
    + coalesce(
      (select sum(t.target) from target_harian_unit(h.tanggal) t
        where t.unit_id in (select id from unit_saya)), 0),
    coalesce(l.gmv, 0),
    l.komisi,
    l.jumlah_upload,
    coalesce(sc.jumlah, 0),
    case
      when sb.jumlah = 0 then null
      when sb.jumlah = 1 then sb.pertama
      else sb.pertama || ' & ' || (sb.jumlah - 1) || ' lainnya'
    end,
    sb.unit
  from hari h
  cross join sebutan sb
  left join lapor l on l.tanggal = h.tanggal
  left join scan sc on sc.tanggal = h.tanggal
  order by h.tanggal;
$$;

comment on function capaian_pribadi_saya(date, date) is
  'Deret harian target & realisasi sasaran milik pengguna aktif; dasar kartu capaian Beranda.';
