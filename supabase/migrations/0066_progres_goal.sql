-- =====================================================================
-- K-Space V2 — Progres goal dihitung satu tempat, dari Laporan Harian
--
-- Realisasi tiap goal sebelumnya dijumlahkan di aplikasi: seluruh laporan
-- sebulan ditarik, lalu disaring di memori. Selain boros, aturannya jadi
-- ada dua salinan — dan keduanya sempat berbeda.
--
-- `daily_reports` menyasar akun ATAU unit (constraint 0005). Goal unit
-- karena itu harus menjumlahkan dua-duanya: laporan unit itu sendiri
-- maupun laporan akun-akun di bawahnya. Penjumlahan di aplikasi hanya
-- membaca `unit_id`, sehingga goal unit Affiliator — yang seluruh
-- laporannya masuk lewat akun — terbaca nyaris nol sementara goal
-- akun-akunnya penuh.
--
-- Fungsi ini menjadi satu-satunya sumber angka progres: dipakai layar
-- pohon goal, dan bisa dipakai rekap mana pun berikutnya.
-- =====================================================================

create or replace function progres_goal(
  p_bulan date,
  p_sampai date default current_date
)
returns table (
  goal_id      uuid,
  target_bulan numeric,
  realisasi    numeric,
  rasio        numeric
)
language sql
stable
as $$
  with rentang as (
    select
      p_bulan as dari,
      least(p_sampai, (p_bulan + interval '1 month - 1 day')::date) as sampai
  ),
  laporan as (
    select r.gmv, r.account_id, coalesce(r.unit_id, a.unit_id) as unit_id
    from daily_reports r
    left join accounts a on a.id = r.account_id, rentang
    where r.tanggal between rentang.dari and rentang.sampai
  )
  select
    g.id,
    coalesce(gm.target, 0),
    coalesce((
      select sum(l.gmv) from laporan l
      where case
        -- Goal akun: hanya laporan akun itu.
        when g.account_id is not null then l.account_id = g.account_id
        -- Goal unit: laporan unit itu beserta akun-akun di bawahnya.
        when g.unit_id is not null then l.unit_id = g.unit_id
        -- Goal perusahaan/manager: seluruh laporan.
        else true
      end
    ), 0),
    case when coalesce(gm.target, 0) > 0 then round(coalesce((
      select sum(l.gmv) from laporan l
      where case
        when g.account_id is not null then l.account_id = g.account_id
        when g.unit_id is not null then l.unit_id = g.unit_id
        else true
      end
    ), 0) / gm.target * 100, 1) else 0 end
  from goals g
  left join goal_months gm
    on gm.goal_id = g.id and gm.bulan = p_bulan
  where g.status = 'aktif';
$$;

comment on function progres_goal(date, date) is
  'Realisasi & rasio tiap goal aktif pada satu bulan, dari Laporan Harian.';
