-- =====================================================================
-- K-Space V2 — Asisten Manager: GMV goal GRD dan lead measure pekan
--
-- Dua fungsi baru di skema `asisten` (pola 0217) untuk MCP kspace.
-- Keduanya hanya MEMBUNGKUS fungsi yang sudah dipakai halaman GRD.
-- Tidak ada rumus GMV, target, kurva, atau lead measure versi baru;
-- yang dikerjakan di sini hanya memilih baris dan kolom.
--
--   asisten.gmv_grd(tanggal)
--     Goal GRD tingkat perusahaan dan Manager yang ukurannya GMV
--     (goal 1, 1.1, 1.2) dari GRD periode yang berlaku
--     (`periode_grd_berlaku`, 0221).
--       * realisasi dan rasio = `progres_goal`, sama dengan pohon
--         Goal & roll-down; untuk goal 1 sama dengan kartu Goal
--         korporasi (`goal_korporasi`);
--       * titik kurva = `kurva_grd`, sama dengan halaman Kurva: titik
--         terakhir <= tanggal (target, aktual, status) dan titik
--         berikutnya (target).
--     Goal 1 mengikuti aturan pemilik: GMV MCN + GMV akun internal yang
--     belum masuk MCN, tanpa hitung dobel. Aturan itu tinggal di lingkup
--     ukuran GRD (impor GRD November 2026), jadi tidak ditulis ulang di
--     sini.
--
--   asisten.lead_measure_pekan(tanggal)
--     `papan_lead_measure` (papan di halaman GRD): realisasi pekan
--     Senin–Minggu yang memuat tanggal itu dibanding target pekan.
--     Lead measure bersumber komisi TIDAK ikut, karena komisi di luar
--     cakupan asisten (sama seperti kas dan gaji).
--
-- Cakupan sama dengan 0217: dipanggil tanpa JWT dengan peran bukan
-- anon/authenticated, jadi seluruh organisasi, sama dengan yang dilihat
-- Manager.
--
-- Aman dijalankan ulang. Rollback di bagian paling bawah.
-- =====================================================================

create or replace function asisten.gmv_grd(p_tanggal date)
returns table (
  periode_grd        date,
  kode               text,
  judul              text,
  level              text,
  pemilik            text,
  target_base        numeric,
  target_goal        numeric,
  target_stretch     numeric,
  realisasi          numeric,
  rasio              numeric,
  titik_lalu         date,
  target_titik_lalu  numeric,
  aktual_titik_lalu  numeric,
  status_titik_lalu  text,
  titik_depan        date,
  target_titik_depan numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with periode as (
    select periode_grd_berlaku(p_tanggal) as p
  ),
  progres as (
    select * from progres_goal(date_trunc('month', p_tanggal)::date, p_tanggal)
  )
  select
    pe.p,
    k.kode,
    g.judul,
    g.level::text,
    coalesce(o.nama, '—'),
    g.target_base,
    g.target_goal,
    g.target_stretch,
    pr.realisasi,
    pr.rasio,
    lalu.tanggal,
    lalu.target,
    lalu.aktual,
    lalu.status,
    depan.tanggal,
    depan.target
  from periode pe
  cross join lateral kurva_grd(pe.p, p_tanggal) k
  join goals g on g.id = k.goal_id
  -- Hanya goal yang juga tampil di pohon Goal & roll-down.
  join progres pr on pr.goal_id = g.id
  left join users o on o.id = g.pemilik_id
  left join lateral (
    select (t ->> 'tanggal')::date    as tanggal,
           (t ->> 'target')::numeric  as target,
           (t ->> 'aktual')::numeric  as aktual,
           t ->> 'status'             as status
    from jsonb_array_elements(k.titik) t
    where (t ->> 'tanggal')::date <= p_tanggal
    order by (t ->> 'tanggal')::date desc
    limit 1
  ) lalu on true
  left join lateral (
    select (t ->> 'tanggal')::date    as tanggal,
           (t ->> 'target')::numeric  as target
    from jsonb_array_elements(k.titik) t
    where (t ->> 'tanggal')::date > p_tanggal
    order by (t ->> 'tanggal')::date
    limit 1
  ) depan on true
  where pe.p is not null
    and k.sumber = 'gmv'
    and g.level in ('company', 'manager')
  order by g.level, k.kode;
$$;
comment on function asisten.gmv_grd(date) is
  'Goal GRD perusahaan & Manager berukuran GMV (goal 1, 1.1, 1.2): progres_goal + titik kurva_grd, GRD periode_grd_berlaku. Goal 1 = GMV MCN + akun internal belum MCN. GMV = input manual K-Space.';

create or replace function asisten.lead_measure_pekan(p_tanggal date)
returns table (
  pekan_dari      date,
  pekan_sampai    date,
  judul           text,
  satuan          text,
  unit_kode       text,
  unit            text,
  goal_kode       text,
  goal_judul      text,
  realisasi       numeric,
  target          numeric,
  rasio           numeric,
  pendukung       numeric,
  label_pendukung text,
  sumber_laporan  text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    awal_pekan(p_tanggal),
    awal_pekan(p_tanggal) + 6,
    p.judul,
    p.satuan,
    p.unit_kode,
    split_part(un.nama, ' (', 1),
    g.kode,
    g.judul,
    p.realisasi,
    p.target,
    p.rasio,
    p.pendukung,
    p.label_pendukung,
    p.sumber_laporan
  from papan_lead_measure(p_tanggal) p
  join lead_measures lm on lm.id = p.lead_id
  left join goals g on g.id = lm.goal_id
  left join units un on un.kode = p.unit_kode
  -- Komisi di luar cakupan asisten: baris bersumber komisi tidak ikut.
  where p.sumber_laporan is distinct from 'komisi'
  order by lm.urutan, p.judul;
$$;
comment on function asisten.lead_measure_pekan(date) is
  'papan_lead_measure(p_tanggal): realisasi pekan Senin–Minggu vs target pekan, tanpa lead measure bersumber komisi.';

-- ---------------------------------------------------------------------
-- Hak: hanya asisten_baca (pola 0217/0219).
-- ---------------------------------------------------------------------
revoke all on function asisten.gmv_grd(date) from public;
revoke all on function asisten.lead_measure_pekan(date) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function asisten.gmv_grd(date) from anon';
    execute 'revoke all on function asisten.lead_measure_pekan(date) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function asisten.gmv_grd(date) from authenticated';
    execute 'revoke all on function asisten.lead_measure_pekan(date) from authenticated';
  end if;
end $$;
grant execute on function asisten.gmv_grd(date) to asisten_baca;
grant execute on function asisten.lead_measure_pekan(date) to asisten_baca;

-- ---------------------------------------------------------------------
-- Rollback (manual):
--   drop function asisten.gmv_grd(date);
--   drop function asisten.lead_measure_pekan(date);
-- ---------------------------------------------------------------------
