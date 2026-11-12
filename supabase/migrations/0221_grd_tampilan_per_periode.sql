-- =====================================================================
-- K-Space V2 — Halaman GRD membaca GRD bulan yang berlaku, dan cukup ringan
--
-- Sejak GRD November diimpor (0220), goal GRD Oktober sengaja tetap
-- 'aktif' supaya angka Oktober yang belum dikunci tidak berubah. Halaman
-- GRD lalu membaca dua bulan sekaligus:
--
--   * kartu "Anak tangga target" (/grd, `anak_tangga_target`) memuat goal
--     Oktober dengan target November Rp 0;
--   * pohon goal (/grd/goal) memanggil `kurva_grd` untuk SETIAP periode
--     (menghitung aktual setiap titik kurva, padahal yang dipakai hanya
--     pasangan goal → ukuran) dan `progres_goal` untuk goal dua bulan.
--     Bagi pengguna yang masuk, setiap baris laporan juga diperiksa RLS,
--     sehingga ketiga panggilan itu melewati batas waktu PostgREST dan
--     capaian tampil "Rp 0 dari Rp 0";
--   * kartu "Anak tangga bulanan" menghitung goal perusahaan dengan
--     `gmv_goal_rentang` tanpa lingkup (seluruh laporan) — bukan aturan
--     ukurannya — sehingga GMV MCN dan akun internal di dalamnya
--     terhitung dobel.
--
-- Perubahan (rumus GMV, target, dan KPI TIDAK berubah):
--
--   1. `periode_grd_berlaku(tanggal)`: periode GRD terbaru yang sudah
--      dimulai pada bulan tanggal itu. GRD bulan lalu tetap tampil sampai
--      GRD bulan ini diimpor.
--   2. `progres_goal` dan `anak_tangga_target` hanya memuat goal di luar
--      GRD dan goal GRD periode yang berlaku.
--   3. `realisasi_goal_rentang(goal, dari, sampai)`: aturan yang sama
--      dengan `progres_goal` untuk satu goal dalam satu rentang — goal GRD
--      lewat ukurannya, goal lain lewat `gmv_goal_rentang`.
--   4. `ukuran_goal_grd(periode)`: pasangan goal → ukuran dan hak
--      mengisinya tanpa menghitung kurva; penyaring staf sama dengan
--      `kurva_grd` (0198).
--   5. `realisasi_ukuran` (0198): lingkup satu akun dihitung lewat indeks
--      `daily_reports_akun_unik (account_id, tanggal)`, bukan memindai
--      semua laporan sebulan. Rumus dan hasilnya sama persis.
--   6. Policy baca `daily_reports`, `accounts`, `goals`, `grd_ukuran`:
--      fungsi peran tanpa argumen dibungkus `(select …)` supaya dihitung
--      sekali per kueri, bukan per baris. Isi aturannya sama persis
--      dengan 0173 dan 0188.
--
-- Diukur lokal (PGlite, data cadangan produksi 13 Nov 2026, auth.uid()
-- seperti Supabase), sebagai Manager: pohon goal 1,30 → 0,06 detik;
-- kartu anak tangga 0,12 → 0,02 detik; kurva November 0,33 → 0,07 detik;
-- semua angka identik untuk Manager, Leader, dan Staff.
--
-- Aman dijalankan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Periode GRD yang berlaku
-- ---------------------------------------------------------------------
create or replace function periode_grd_berlaku(p_tanggal date)
returns date
language sql
stable
security definer
set search_path = public
as $$
  -- Hanya tanggal periode yang dikembalikan; sama bagi semua pengguna.
  select max(g.grd_periode)
  from goals g
  where g.grd_periode is not null
    and g.grd_periode <= date_trunc('month', p_tanggal)::date;
$$;

comment on function periode_grd_berlaku(date) is
  'Periode GRD terbaru yang sudah dimulai pada bulan p_tanggal; null bila belum ada GRD (0221).';

-- ---------------------------------------------------------------------
-- 2. Progres goal dan anak tangga target: periode yang berlaku saja
-- ---------------------------------------------------------------------
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
  with dasar as (
    select
      g.id,
      case when u.id is not null then g.target_goal
           else coalesce(gm.target, 0) end as target,
      case
        when u.id is not null then coalesce(realisasi_goal(g.id, p_sampai), 0)
        else gmv_goal_rentang(
          g.account_id,
          g.unit_id,
          coalesce(gm.dari, p_bulan),
          least(
            p_sampai,
            coalesce(gm.sampai, (p_bulan + interval '1 month - 1 day')::date)
          )
        )
      end as realisasi
    from goals g
    left join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    left join grd_ukuran u on u.goal_id = g.id
    where g.status in ('aktif', 'draft')
      and (g.grd_periode is null
           or g.grd_periode = (select periode_grd_berlaku(p_bulan)))
  )
  select
    d.id,
    d.target,
    d.realisasi,
    case when d.target > 0 then round(d.realisasi / d.target * 100, 1) else 0 end
  from dasar d;
$$;

create or replace function anak_tangga_target(p_tanggal date)
returns table (
  goal_id    uuid,
  judul      text,
  level      level_goal,
  pemilik    text,
  jabatan    text,
  unit_kode  text,
  target     numeric,
  realisasi  numeric,
  rasio      numeric
)
language sql
stable
as $$
  select
    g.id, g.judul, g.level, u.nama, u.jabatan, un.kode,
    coalesce(gm.target, 0),
    r.realisasi,
    case when coalesce(gm.target, 0) > 0
      then round(r.realisasi / gm.target * 100, 1) else 0 end
  from goals g
  left join users u on u.id = g.pemilik_id
  left join units un on un.id = g.unit_id
  left join goal_months gm
    on gm.goal_id = g.id and gm.bulan = date_trunc('month', p_tanggal)::date
  cross join lateral (
    select case
      when exists (select 1 from grd_ukuran x where x.goal_id = g.id)
        then coalesce(realisasi_goal(g.id, p_tanggal), 0)
      else gmv_goal_rentang(
        null,
        g.unit_id,
        coalesce(gm.dari, date_trunc('month', p_tanggal)::date),
        least(p_tanggal, coalesce(gm.sampai, p_tanggal))
      )
    end as realisasi
  ) r
  where g.status = 'aktif'
    and g.jenis_realisasi = 'gmv'
    and g.level in ('manager', 'leader')
    and (g.grd_periode is null
         or g.grd_periode = (select periode_grd_berlaku(p_tanggal)))
  order by
    case g.level when 'manager' then 0 else 1 end,
    g.kode nulls last,
    un.kode;
$$;

-- ---------------------------------------------------------------------
-- 3. Realisasi satu goal dalam satu rentang (anak tangga bulanan)
-- ---------------------------------------------------------------------
create or replace function realisasi_goal_rentang(
  p_goal   uuid,
  p_dari   date,
  p_sampai date
)
returns numeric
language sql
stable
as $$
  -- Aturan yang sama dengan progres_goal: goal GRD lewat ukurannya
  -- (dibekukan pada tenggat, berhenti di akhir periodenya), goal lain
  -- lewat lingkup akun/unitnya. Security invoker: RLS pemanggil berlaku.
  select case
    when exists (select 1 from grd_ukuran u where u.goal_id = g.id)
      then coalesce(realisasi_goal(g.id, p_sampai), 0)
    else gmv_goal_rentang(g.account_id, g.unit_id, p_dari, p_sampai)
  end
  from goals g
  where g.id = p_goal;
$$;

comment on function realisasi_goal_rentang(uuid, date, date) is
  'Realisasi satu goal dalam rentang: goal GRD lewat ukurannya, goal lain lewat gmv_goal_rentang — aturan progres_goal (0221).';

-- ---------------------------------------------------------------------
-- 4. Goal → ukuran GRD tanpa menghitung kurva (pohon goal)
-- ---------------------------------------------------------------------
create or replace function ukuran_goal_grd(p_periode date)
returns table (
  goal_id   uuid,
  ukuran_id uuid,
  sumber    text,
  boleh_isi boolean
)
language sql
stable
as $$
  select u.goal_id, u.id, u.sumber, boleh_isi_ukuran(u.id)
  from grd_ukuran u
  left join goals g on g.id = u.goal_id
  where u.grd_periode = p_periode
    and u.goal_id is not null
    -- Penyaring staf sama dengan kurva_grd (0198).
    and (
      peran_saya() is distinct from 'Staff'
      or u.pic_id = auth.uid()
      or g.pemilik_id = auth.uid()
    );
$$;

comment on function ukuran_goal_grd(date) is
  'Pasangan goal → ukuran GRD satu periode beserta boleh_isi, tanpa menghitung kurva; staf hanya barisnya sendiri seperti kurva_grd (0221).';

-- ---------------------------------------------------------------------
-- 5. realisasi_ukuran: lingkup akun lewat indeks (rumus sama dengan 0198)
-- ---------------------------------------------------------------------
create or replace function realisasi_ukuran(
  p_ukuran uuid,
  p_sampai date,
  p_kedalaman integer default 0
)
returns numeric
language plpgsql
stable
as $$
declare
  u grd_ukuran;
  l grd_ukuran_lingkup;
  dari date;
  akhir date;
  jumlah numeric := 0;
begin
  select * into u from grd_ukuran where id = p_ukuran;
  if u.id is null then
    return null;
  end if;

  if u.sumber = 'isian' then
    return (
      select i.nilai from grd_ukuran_isian i
      where i.ukuran_id = u.id and i.tanggal <= p_sampai
      order by i.tanggal desc
      limit 1
    );
  end if;

  dari := u.grd_periode;
  akhir := least(p_sampai, (u.grd_periode + interval '1 month - 1 day')::date);
  if akhir < dari then
    return 0;
  end if;

  if not ukuran_turunan(u.id) and not laporan_ada_ukuran(u.id, akhir) then
    return coalesce((
      select i.nilai from grd_ukuran_isian i
      where i.ukuran_id = u.id and i.tanggal <= akhir
      order by i.tanggal desc
      limit 1
    ), 0);
  end if;

  for l in select * from grd_ukuran_lingkup where ukuran_id = u.id loop
    if l.sumber_ukuran_id is not null then
      if p_kedalaman < 3 then
        jumlah := jumlah + l.faktor * coalesce(
          realisasi_ukuran(l.sumber_ukuran_id, p_sampai, p_kedalaman + 1), 0);
      end if;
    elsif l.account_id is not null then
      -- Satu akun: indeks daily_reports_akun_unik (account_id, tanggal).
      jumlah := jumlah + l.faktor * coalesce((
        select sum(case l.jenis_gmv
                     when 'live' then coalesce(r.gmv_live, 0)
                     when 'video' then r.gmv - coalesce(r.gmv_live, 0)
                     else r.gmv
                   end)
        from daily_reports r
        where r.account_id = l.account_id
          and r.tanggal between dari and akhir
      ), 0);
    else
      -- Satu unit beserta akun-akunnya, seperti 0198.
      jumlah := jumlah + l.faktor * coalesce((
        select sum(case l.jenis_gmv
                     when 'live' then coalesce(r.gmv_live, 0)
                     when 'video' then r.gmv - coalesce(r.gmv_live, 0)
                     else r.gmv
                   end)
        from daily_reports r
        left join accounts a on a.id = r.account_id
        where r.tanggal between dari and akhir
          and coalesce(r.unit_id, a.unit_id) = l.unit_id
      ), 0);
    end if;
  end loop;

  return jumlah;
end;
$$;

comment on function realisasi_ukuran(uuid, date, integer) is
  'Realisasi kumulatif ukuran GRD: GMV laporan harian atas lingkupnya, atau isian (ukuran isian, atau GMV yang belum ada di laporan harian) (0198; lingkup akun lewat indeks sejak 0221).';

-- ---------------------------------------------------------------------
-- 6. Policy baca: fungsi peran dihitung sekali per kueri
--
-- "(select f())" menjadi initPlan: nilainya sama untuk seluruh kueri
-- (peran pemanggil tidak berubah di tengah kueri), jadi aturannya tetap
-- sama persis — yang berubah hanya berapa kali Postgres menghitungnya.
-- Fungsi yang membaca kolom baris (boleh_orang, boleh_unit) tetap per
-- baris seperti semula.
-- ---------------------------------------------------------------------
drop policy if exists daily_reports_baca on daily_reports;
create policy daily_reports_baca on daily_reports
  for select
  using (
    (select lintas_angka())
    or user_id = (select auth.uid())
    or boleh_orang(user_id)
    or (account_id is not null
        and exists (select 1 from accounts a where a.id = account_id))
    or (unit_id is not null and boleh_unit(unit_id))
  );

drop policy if exists accounts_baca on accounts;
create policy accounts_baca on accounts
  for select
  using (
    (select lintas_angka())
    or pic_user_id = (select auth.uid())
    or co_leader_id = (select auth.uid())
    or boleh_orang(pic_user_id)
    or ((select memimpin_unit()) and pic_user_id is null
        and unit_id = (select unit_saya()))
  );

drop policy if exists goals_baca on goals;
create policy goals_baca on goals
  for select
  using (
    (select lintas_angka())
    or pemilik_id = (select auth.uid())
    or boleh_orang(pemilik_id)
    or (account_id is not null
        and exists (select 1 from accounts a where a.id = account_id))
    or (level = 'leader' and boleh_unit(unit_id))
    or (account_id is null and pemilik_id is null and boleh_unit(unit_id))
  );

drop policy if exists grd_ukuran_baca on grd_ukuran;
create policy grd_ukuran_baca on grd_ukuran
  for select using (
    (select lintas_angka())
    or (goal_id is not null and exists (select 1 from goals g where g.id = goal_id))
    or (pic_id is not null and boleh_orang(pic_id))
  );

-- ---------------------------------------------------------------------
-- Rollback (manual): jalankan ulang definisi progres_goal dan
-- anak_tangga_target dari 0188, realisasi_ukuran dari 0198, keempat
-- policy dari 0173/0188, lalu
--   drop function ukuran_goal_grd(date);
--   drop function realisasi_goal_rentang(uuid, date, date);
--   drop function periode_grd_berlaku(date);
-- ---------------------------------------------------------------------
