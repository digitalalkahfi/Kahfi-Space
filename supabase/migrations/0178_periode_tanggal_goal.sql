-- =====================================================================
-- K-Space V2 — Goal bertanggal: tanggal mulai dan tanggal selesai
--
-- Goal yang SMART terikat waktu sampai ke tanggalnya: kapan mulai dan
-- kapan harus tercapai. Sampai sekarang periode goal hanya deretan bulan
-- penuh (anak tangga `goal_months`), jadi goal "15 Okt – 14 Des 2026"
-- tidak bisa ditulis sama sekali.
--
-- Setiap anak tangga kini membawa rentang tanggal yang dicakupnya di
-- bulan itu (`dari` – `sampai`). Bulan penuh berarti tanggal 1 sampai
-- akhir bulan — persis perilaku lama, sehingga data yang sudah ada dan
-- seluruh angka turunannya tidak berubah. Periode sebuah goal adalah
-- `dari` paling awal sampai `sampai` paling akhir anak tangganya.
--
-- Dua kelompok hitungan kini menghormati rentang itu:
-- 1. Target harian (laporan harian, Beranda, capaian pribadi, laporan
--    mingguan, WRM): anak tangga dibagi rata ke hari di DALAM
--    rentangnya; di luar rentang targetnya nol.
-- 2. Capaian (pohon goal, goal perusahaan, anak tangga GRD, KPI GMV):
--    realisasi hanya dihitung di dalam rentang, sampai tanggal acuan.
--
-- Target bulanan (`target_bulanan_*`) tetap anak tangga bulan itu apa
-- adanya: untuk bulan yang terpakai sebagian, angkanya memang sudah
-- bagian bulan itu saja.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Rentang tanggal tiap anak tangga
-- ---------------------------------------------------------------------
alter table goal_months
  add column dari   date,
  add column sampai date;

comment on column goal_months.dari is
  'Tanggal pertama periode goal yang jatuh di bulan ini; bawaannya tanggal 1 (0178).';
comment on column goal_months.sampai is
  'Tanggal terakhir periode goal yang jatuh di bulan ini; bawaannya akhir bulan (0178).';

/**
 * Rentang yang tidak disebut berarti bulan penuh — jadi penyisip lama
 * (seed, impor, `ubahTargetGoal`) tetap sah tanpa diubah. Bulan yang
 * dipindah tanpa rentang baru ikut menjadi bulan penuh di tempat
 * barunya, supaya rentangnya tidak tertinggal di bulan lama.
 */
create or replace function lengkapi_rentang_anak_tangga()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.bulan is distinct from old.bulan
     and new.dari is not distinct from old.dari
     and new.sampai is not distinct from old.sampai then
    new.dari := null;
    new.sampai := null;
  end if;

  new.dari := coalesce(new.dari, new.bulan);
  new.sampai := coalesce(new.sampai, (new.bulan + interval '1 month - 1 day')::date);
  return new;
end;
$$;

create trigger goal_months_rentang
  before insert or update on goal_months
  for each row execute function lengkapi_rentang_anak_tangga();

-- Anak tangga yang sudah ada menjadi bulan penuh — persis yang selama ini
-- dihitung. Pengisian ini ikut tercatat di jejak audit goal.
update goal_months
   set dari = bulan,
       sampai = (bulan + interval '1 month - 1 day')::date;

alter table goal_months
  alter column dari set not null,
  alter column sampai set not null,
  add constraint goal_months_rentang_sah check (
    dari >= bulan
    and dari <= sampai
    and sampai <= (bulan + interval '1 month - 1 day')::date
  );

-- ---------------------------------------------------------------------
-- 1. Target harian: anak tangga dibagi rata ke hari di dalam rentangnya.
--    Bulan penuh tetap dibagi jumlah hari sebulan, persis rumus 0006/0008.
-- ---------------------------------------------------------------------
create or replace function target_harian_unit(p_tanggal date)
returns table (unit_id uuid, target numeric)
language sql
stable
as $$
  select
    g.unit_id,
    sum(gm.target / (gm.sampai - gm.dari + 1)::numeric)
  from goals g
  join goal_months gm on gm.goal_id = g.id
  where g.status = 'aktif'
    and g.unit_id is not null
    and g.account_id is null
    and gm.bulan = date_trunc('month', p_tanggal)::date
    and p_tanggal between gm.dari and gm.sampai
  group by g.unit_id;
$$;

create or replace function target_harian_akun(p_tanggal date)
returns table (account_id uuid, target numeric)
language sql
stable
as $$
  select
    g.account_id,
    sum(gm.target / (gm.sampai - gm.dari + 1)::numeric)
  from goals g
  join goal_months gm on gm.goal_id = g.id
  where g.status = 'aktif'
    and g.account_id is not null
    and gm.bulan = date_trunc('month', p_tanggal)::date
    and p_tanggal between gm.dari and gm.sampai
  group by g.account_id;
$$;

create or replace function target_harian_akun_unit(p_unit uuid, p_tanggal date)
returns numeric
language sql
stable
as $$
  select coalesce(sum(gm.target / (gm.sampai - gm.dari + 1)::numeric), 0)
  from goals g
  join goal_months gm on gm.goal_id = g.id
  join accounts a on a.id = g.account_id
  where g.status = 'aktif'
    and g.account_id is not null
    and a.unit_id = p_unit
    and gm.bulan = date_trunc('month', p_tanggal)::date
    and p_tanggal between gm.dari and gm.sampai;
$$;

comment on function target_harian_unit(date) is
  'Target harian tiap unit: anak tangga dibagi rata ke hari di dalam rentang tanggalnya; nol di luar rentang (0178).';
comment on function target_harian_akun(date) is
  'Target harian tiap akun: anak tangga dibagi rata ke hari di dalam rentang tanggalnya; nol di luar rentang (0178).';
comment on function target_harian_akun_unit(uuid, date) is
  'Jumlah target harian akun-akun sebuah unit pada satu tanggal, menurut rentang anak tangganya (0178).';

-- ---------------------------------------------------------------------
-- 2. Capaian: realisasi hanya di dalam rentang anak tangganya.
-- ---------------------------------------------------------------------

/**
 * GMV Laporan Harian dalam rentang tanggal untuk lingkup sebuah goal:
 * satu akun, satu unit beserta akun-akunnya, atau — bila keduanya kosong
 * — seluruh perusahaan (goal perusahaan dan Manager). Satu aturan lingkup
 * untuk pohon goal, goal perusahaan, anak tangga GRD, dan KPI GMV.
 *
 * Security invoker: RLS pemanggil tetap berlaku.
 */
create or replace function gmv_goal_rentang(
  p_akun   uuid,
  p_unit   uuid,
  p_dari   date,
  p_sampai date
)
returns numeric
language sql
stable
as $$
  select coalesce(sum(r.gmv), 0)
  from daily_reports r
  left join accounts a on a.id = r.account_id
  where r.tanggal between p_dari and p_sampai
    and case
      when p_akun is not null then r.account_id = p_akun
      when p_unit is not null then coalesce(r.unit_id, a.unit_id) = p_unit
      else true
    end;
$$;

comment on function gmv_goal_rentang(uuid, uuid, date, date) is
  'GMV dalam rentang tanggal untuk lingkup goal: akun, unit beserta akunnya, atau seluruh perusahaan bila keduanya null (0178).';

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
      coalesce(gm.target, 0) as target,
      -- Goal tanpa anak tangga bulan ini tetap dihitung sebulan penuh,
      -- seperti sebelumnya; rasionya nol karena targetnya nol.
      gmv_goal_rentang(
        g.account_id,
        g.unit_id,
        coalesce(gm.dari, p_bulan),
        least(
          p_sampai,
          coalesce(gm.sampai, (p_bulan + interval '1 month - 1 day')::date)
        )
      ) as realisasi
    from goals g
    left join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where g.status = 'aktif'
  )
  select
    d.id,
    d.target,
    d.realisasi,
    case when d.target > 0 then round(d.realisasi / d.target * 100, 1) else 0 end
  from dasar d;
$$;

comment on function progres_goal(date, date) is
  'Realisasi & rasio tiap goal aktif pada satu bulan, dihitung di dalam rentang tanggal anak tangganya (0178).';

create or replace function goal_korporasi(p_tanggal date)
returns table (
  goal_id        uuid,
  judul          text,
  periode        text,
  target_base    numeric,
  target_goal    numeric,
  target_stretch numeric,
  target_bulan   numeric,
  realisasi      numeric,
  rasio          numeric
)
language sql
stable
as $$
  with korporasi as (
    select
      g.id, g.judul, g.periode,
      g.target_base, g.target_goal, g.target_stretch,
      coalesce(gm.target, 0) as target_bulan,
      gmv_goal_rentang(
        null,
        null,
        coalesce(gm.dari, date_trunc('month', p_tanggal)::date),
        least(p_tanggal, coalesce(gm.sampai, p_tanggal))
      ) as realisasi
    from goals g
    left join goal_months gm
      on gm.goal_id = g.id and gm.bulan = date_trunc('month', p_tanggal)::date
    where g.level = 'company' and g.status = 'aktif'
    order by g.created_at
    limit 1
  )
  select
    k.id, k.judul, k.periode,
    k.target_base, k.target_goal, k.target_stretch,
    k.target_bulan,
    k.realisasi,
    case when k.target_bulan > 0
      then round(k.realisasi / k.target_bulan * 100, 1) else 0 end
  from korporasi k;
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
    select gmv_goal_rentang(
      null,
      g.unit_id,
      coalesce(gm.dari, date_trunc('month', p_tanggal)::date),
      least(p_tanggal, coalesce(gm.sampai, p_tanggal))
    ) as realisasi
  ) r
  where g.status = 'aktif'
    and g.level in ('manager', 'leader')
  order by
    case g.level when 'manager' then 0 else 1 end,
    un.kode;
$$;

/**
 * Realisasi KPI GMV: capaian terhadap target yang SUDAH berjalan.
 *
 * Tiap anak tangga ditagih sebesar porsi rentangnya yang sudah dilalui
 * sampai `p_sampai` — goal yang baru mulai tanggal 15 tidak ditagih untuk
 * tanggal 1–14, dan goal yang belum mulai sama sekali tidak ikut
 * dihitung. Untuk bulan penuh porsinya sama dengan porsi bulan berjalan
 * (0029/0030), jadi skor lama tidak berubah. Pagar `boleh_orang` (0173)
 * dipertahankan.
 */
create or replace function realisasi_gmv_kpi(
  p_user uuid,
  p_bulan date,
  p_sampai date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with pengguna as (
    select id, role, unit_id from users
    where id = p_user and boleh_orang(p_user)
  ),
  punya_akun as (
    select exists (
      select 1 from accounts a
      join pengguna p on a.pic_user_id = p.id
      join goals g on g.account_id = a.id and g.status = 'aktif'
      join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
      where a.status = 'aktif'
    ) as ada
  ),
  -- Anak tangga bulan itu yang menjadi sasaran orang ini, beserta lingkup
  -- GMV-nya: akun yang ia pegang, unitnya, atau seluruh perusahaan.
  sasaran as (
    select gm.target, gm.dari, gm.sampai, a.id as akun, null::uuid as unit
    from pengguna p
    join accounts a on a.pic_user_id = p.id and a.status = 'aktif'
    join goals g on g.account_id = a.id and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role = 'Staff'

    union all

    select gm.target, gm.dari, gm.sampai, null, p.unit_id
    from pengguna p
    join goals g on g.unit_id = p.unit_id and g.account_id is null and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role = 'Staff'
      and p.unit_id is not null
      and not (select ada from punya_akun)

    union all

    select gm.target, gm.dari, gm.sampai, null, p.unit_id
    from pengguna p
    join goals g on g.unit_id = p.unit_id and g.account_id is null and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role in ('Leader', 'Co-Leader') and p.unit_id is not null

    union all

    select gm.target, gm.dari, gm.sampai, null, null
    from pengguna p
    join goals g on g.level in ('company', 'manager') and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role in ('Manager', 'CEO') and g.pemilik_id = p.id
  ),
  berjalan as (
    select
      s.target,
      greatest(least(
        (least(p_sampai, s.sampai) - s.dari + 1)::numeric
          / (s.sampai - s.dari + 1),
        1), 0) as porsi,
      gmv_goal_rentang(s.akun, s.unit, s.dari, least(p_sampai, s.sampai)) as realisasi
    from sasaran s
  )
  select case when coalesce(sum(target * porsi), 0) > 0
    then sum(realisasi) / sum(target * porsi) * 100
    else null end
  from berjalan;
$$;

-- ---------------------------------------------------------------------
-- Ubah goal: anak tangga membawa rentang tanggalnya
-- ---------------------------------------------------------------------

/**
 * Sama dengan 0177, kecuali anak tangga kini boleh membawa `dari` dan
 * `sampai`: [{"bulan": "2026-10-01", "dari": "2026-10-15",
 * "sampai": "2026-10-31", "target": 1000000}]. Rentang yang tidak
 * disebut berarti bulan penuh.
 *
 * Periode paling lama 12 bulan dihitung dari tanggalnya, bukan dari
 * jumlah anak tangga: goal 15 Okt 2026 – 14 Okt 2027 menyentuh 13 bulan
 * kalender tetapi lamanya tetap setahun.
 */
create or replace function ubah_goal(
  p_goal    uuid,
  p_judul   text,
  p_level   level_goal,
  p_pemilik uuid,
  p_induk   uuid,
  p_unit    uuid,
  p_akun    uuid,
  p_base    numeric,
  p_target  numeric,
  p_stretch numeric,
  p_periode text,
  p_bulan   jsonb default null
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_unit uuid;
begin
  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh mengubah goal'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from goals where id = p_goal) then
    raise exception 'Goal tidak ditemukan' using errcode = 'no_data_found';
  end if;

  if p_bulan is not null and (
    jsonb_typeof(p_bulan) <> 'array'
    or jsonb_array_length(p_bulan) not between 1 and 13
  ) then
    raise exception 'Periode goal harus antara 1 hari sampai 12 bulan'
      using errcode = 'check_violation';
  end if;

  update goals
     set judul          = btrim(p_judul),
         level          = p_level,
         pemilik_id     = p_pemilik,
         parent_goal_id = p_induk,
         unit_id        = p_unit,
         account_id     = p_akun,
         target_base    = p_base,
         target_goal    = p_target,
         target_stretch = p_stretch,
         periode        = p_periode
   where id = p_goal;

  -- Turunan goal ini tetap harus sah terhadapnya: trigger roll-down hanya
  -- memeriksa baris yang diubah, bukan anak-anaknya.
  if exists (
    select 1 from goals c
    where c.parent_goal_id = p_goal
      and tingkat_goal(c.level) <= tingkat_goal(p_level)
  ) then
    raise exception
      'Goal ini punya turunan setingkat atau lebih tinggi dari level %; pindahkan turunannya dulu',
      p_level
      using errcode = 'check_violation';
  end if;

  v_unit := coalesce(p_unit, (select a.unit_id from accounts a where a.id = p_akun));
  if v_unit is not null and exists (
    select 1 from goals c
    where c.parent_goal_id = p_goal
      and unit_goal(c) is not null
      and unit_goal(c) <> v_unit
  ) then
    raise exception 'Goal ini punya turunan di unit lain; unitnya tidak bisa diubah'
      using errcode = 'check_violation';
  end if;

  if p_bulan is not null then
    delete from goal_months where goal_id = p_goal;
    insert into goal_months (goal_id, bulan, target, dari, sampai)
    select
      p_goal,
      (b ->> 'bulan')::date,
      (b ->> 'target')::numeric,
      (b ->> 'dari')::date,
      (b ->> 'sampai')::date
    from jsonb_array_elements(p_bulan) b;

    if (
      select max(sampai) >= (min(dari) + interval '12 months')::date
      from goal_months where goal_id = p_goal
    ) then
      raise exception 'Periode goal paling lama 12 bulan'
        using errcode = 'check_violation';
    end if;
  end if;
end;
$$;

comment on function ubah_goal(uuid, text, level_goal, uuid, uuid, uuid, uuid,
  numeric, numeric, numeric, text, jsonb) is
  'Mengubah goal dan (bila diberikan) seluruh anak tangga beserta rentang tanggalnya dalam satu transaksi; hanya CEO/Manager (0177, 0178).';
