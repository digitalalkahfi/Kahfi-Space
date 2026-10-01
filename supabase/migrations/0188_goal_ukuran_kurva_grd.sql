-- =====================================================================
-- K-Space V2 — Goal GRD: ukuran, satuan non-rupiah, tenggat, kurva Sabtu
--
-- File GRD Oktober 2026 (docs/grd/GAP-GRD-OKTOBER.md §4c, §4e) menuntut
-- hal yang belum bisa ditampung goal lama:
--
--   * goal bersatuan seller, produk, creator, peserta, tahap, SOP, % —
--     realisasinya diisi, bukan dihitung dari GMV;
--   * goal GMV atas SEBAGIAN akun, dan dibedakan GMV LIVE vs di luar
--     LIVE (alkahfihome_ & tokoalkahfi_ punya target keduanya);
--   * tenggat selain akhir bulan (17 Okt, 30 Okt, 4 Nov);
--   * base yang "belum diukur";
--   * kurva kumulatif yang harus tercapai tiap Sabtu (WRM).
--
-- Karena itu setiap goal GRD menunjuk satu UKURAN: cara mengukurnya.
--   gmv   — jumlah GMV laporan harian atas lingkupnya: akun tertentu
--           (semua / LIVE / di luar LIVE), unit, atau ukuran lain
--           (dengan faktor +1 / −1, mis. GMV MCN − creator besar baru);
--   isian — angka kumulatif yang dicatat orang (seller, creator, …).
-- Ukuran juga menampung baris kurva yang bukan goal (klik gabung MCN,
-- pendaftar MMC, total internal/eksternal) persis seperti sheet
-- "Target & Kurva WRM". Titik kurva = target kumulatif per Sabtu.
--
-- Goal yang realisasinya isian tidak lagi ikut ke target GMV mana pun
-- (target harian laporan, ringkasan unit, anak tangga) — sebelumnya
-- semua goal dianggap rupiah.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Goal: kode GRD, tenggat, jenis realisasi, base boleh belum diukur
-- ---------------------------------------------------------------------
alter table goals
  add column if not exists grd_periode date
    check (grd_periode is null or extract(day from grd_periode) = 1),
  add column if not exists kode text,
  add column if not exists tenggat date,
  add column if not exists jenis_realisasi text not null default 'gmv'
    check (jenis_realisasi in ('gmv', 'isian')),
  add column if not exists keterangan text not null default '';

-- Base "belum diukur" (goal staf pendukung) bukan nol: dibiarkan kosong.
alter table goals alter column target_base drop not null;

create unique index if not exists goals_grd_kode_unik
  on goals (grd_periode, kode)
  where grd_periode is not null and kode is not null;

comment on column goals.kode is
  'Kode goal di file GRD, mis. "1.1.3" atau "S.2.1"; unik per periode GRD (0188).';
comment on column goals.tenggat is
  'Tanggal "pada …" di rumusan goal; realisasi dibekukan pada tanggal ini (0188).';
comment on column goals.jenis_realisasi is
  'gmv: dari laporan harian; isian: angka kumulatif yang dicatat. Hanya gmv yang ikut target rupiah (0188).';

-- ---------------------------------------------------------------------
-- Laporan harian: GMV LIVE, bagian dari GMV total hari itu
-- ---------------------------------------------------------------------
alter table daily_reports
  add column if not exists gmv_live numeric(14, 2);

alter table daily_reports
  drop constraint if exists daily_reports_gmv_live_wajar;
alter table daily_reports
  add constraint daily_reports_gmv_live_wajar check (
    gmv_live is null or (gmv_live >= 0 and gmv_live <= gmv)
  );

comment on column daily_reports.gmv_live is
  'Bagian GMV hari itu yang berasal dari LIVE; null untuk laporan tanpa LIVE (0188).';

create or replace function jaga_kolom_departemen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kode text;
begin
  kode := unit_laporan(new.account_id, new.unit_id);

  if kode is distinct from 'affiliator'
     and (new.komisi is not null or new.jumlah_upload is not null
          or new.gmv_live is not null)
  then
    raise exception
      'Departemen % hanya melaporkan GMV dan catatan', coalesce(kode, '?')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists daily_reports_jaga_kolom_departemen on daily_reports;
create trigger daily_reports_jaga_kolom_departemen
  before insert or update of account_id, unit_id, komisi, jumlah_upload, gmv_live
  on daily_reports
  for each row execute function jaga_kolom_departemen();

-- Perubahan GMV LIVE ikut berjejak, sama seperti GMV, komisi, dan upload.
alter table daily_report_revisions
  add column if not exists live_lama numeric(14, 2),
  add column if not exists live_baru numeric(14, 2);

alter table daily_report_revisions drop constraint if exists revisi_harus_berubah;
alter table daily_report_revisions
  add constraint revisi_harus_berubah check (
    gmv_lama is distinct from gmv_baru
    or komisi_lama is distinct from komisi_baru
    or upload_lama is distinct from upload_baru
    or live_lama is distinct from live_baru
  );

create or replace function catat_revisi_laporan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gmv_berubah    boolean := new.gmv is distinct from old.gmv;
  komisi_berubah boolean := new.komisi is distinct from old.komisi;
  upload_berubah boolean := new.jumlah_upload is distinct from old.jumlah_upload;
  live_berubah   boolean := new.gmv_live is distinct from old.gmv_live;
begin
  if not (gmv_berubah or komisi_berubah or upload_berubah or live_berubah) then
    return new;
  end if;

  insert into daily_report_revisions
    (report_id, gmv_lama, gmv_baru,
     komisi_lama, komisi_baru, upload_lama, upload_baru,
     live_lama, live_baru,
     alasan, diubah_oleh)
  values (
    old.id,
    old.gmv,
    new.gmv,
    case when komisi_berubah then old.komisi end,
    case when komisi_berubah then new.komisi end,
    case when upload_berubah then old.jumlah_upload end,
    case when upload_berubah then new.jumlah_upload end,
    case when live_berubah then old.gmv_live end,
    case when live_berubah then new.gmv_live end,
    coalesce(
      nullif(btrim(current_setting('app.alasan_revisi', true)), ''),
      'Perbaikan tanpa alasan tercatat'
    ),
    auth.uid()
  );
  new.status := 'revisi';
  return new;
end;
$$;

drop trigger if exists daily_reports_catat_revisi on daily_reports;
create trigger daily_reports_catat_revisi
  before update of gmv, komisi, jumlah_upload, gmv_live on daily_reports
  for each row execute function catat_revisi_laporan();

-- ---------------------------------------------------------------------
-- Ukuran GRD dan lingkupnya
-- ---------------------------------------------------------------------
create table grd_ukuran (
  id          uuid primary key default gen_random_uuid(),
  grd_periode date not null check (extract(day from grd_periode) = 1),
  kode        text not null,
  judul       text not null check (length(btrim(judul)) >= 3),
  satuan      text not null default 'IDR',
  sumber      text not null default 'gmv' check (sumber in ('gmv', 'isian')),
  -- Satu goal punya paling banyak satu ukuran; baris kurva yang bukan
  -- goal (klik, pendaftar, total) tidak bertaut ke goal.
  goal_id     uuid unique references goals (id) on delete set null,
  pic_id      uuid references users (id) on delete set null,
  pic_teks    text not null default '',
  urutan      smallint not null default 0,
  asal        text not null default '',
  created_at  timestamptz not null default now(),
  unique (grd_periode, kode)
);

comment on table grd_ukuran is
  'Cara mengukur sebuah goal atau baris kurva GRD: GMV atas lingkup tertentu, atau angka isian (0188).';

create index grd_ukuran_periode_idx on grd_ukuran (grd_periode, urutan);

create table grd_ukuran_lingkup (
  id               uuid primary key default gen_random_uuid(),
  ukuran_id        uuid not null references grd_ukuran (id) on delete cascade,
  account_id       uuid references accounts (id) on delete cascade,
  unit_id          uuid references units (id) on delete cascade,
  sumber_ukuran_id uuid references grd_ukuran (id) on delete cascade,
  -- semua = GMV laporan; live = GMV LIVE; video = GMV di luar LIVE.
  jenis_gmv        text not null default 'semua'
                     check (jenis_gmv in ('semua', 'live', 'video')),
  faktor           smallint not null default 1 check (faktor in (1, -1)),
  constraint grd_lingkup_satu_sumber
    check (num_nonnulls(account_id, unit_id, sumber_ukuran_id) = 1),
  constraint grd_lingkup_bukan_diri
    check (sumber_ukuran_id is distinct from ukuran_id)
);

create index grd_lingkup_ukuran_idx on grd_ukuran_lingkup (ukuran_id);

-- Target kumulatif yang harus sudah tercapai pada tanggal titik (Sabtu WRM).
create table grd_ukuran_titik (
  ukuran_id uuid not null references grd_ukuran (id) on delete cascade,
  tanggal   date not null,
  target    numeric not null check (target >= 0),
  primary key (ukuran_id, tanggal)
);

-- Angka kumulatif yang dicatat untuk ukuran isian, per tanggal.
create table grd_ukuran_isian (
  id         uuid primary key default gen_random_uuid(),
  ukuran_id  uuid not null references grd_ukuran (id) on delete cascade,
  tanggal    date not null,
  nilai      numeric not null check (nilai >= 0),
  catatan    text not null default '',
  diisi_oleh uuid references users (id) on delete set null,
  diisi_pada timestamptz not null default now(),
  unique (ukuran_id, tanggal)
);

comment on table grd_ukuran_isian is
  'Capaian kumulatif ukuran isian per tanggal; kurva membaca isian pada tanggal titiknya (0188).';

-- ---------------------------------------------------------------------
-- Siapa yang boleh mencatat isian: CEO/Manager, PIC ukurannya, pemilik
-- goalnya, dan atasan mereka.
-- ---------------------------------------------------------------------
create or replace function boleh_isi_ukuran(p_ukuran uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from grd_ukuran u
       left join goals g on g.id = u.goal_id
       where u.id = p_ukuran
         and u.sumber = 'isian'
         and (
           lintas_unit()
           or u.pic_id = auth.uid()
           or g.pemilik_id = auth.uid()
           or exists (
             select 1 from bawahan_saya() b
             where b in (u.pic_id, g.pemilik_id)
           )
         )
     );
$$;

create or replace function jaga_isian_ukuran()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;
  if not exists (
    select 1 from grd_ukuran where id = new.ukuran_id and sumber = 'isian'
  ) then
    raise exception 'Ukuran ini dihitung dari laporan harian, bukan diisi'
      using errcode = 'check_violation';
  end if;
  new.diisi_oleh := auth.uid();
  new.diisi_pada := now();
  return new;
end;
$$;

create trigger grd_isian_jaga
  before insert or update or delete on grd_ukuran_isian
  for each row execute function jaga_isian_ukuran();

create trigger grd_isian_audit
  after insert or update or delete on grd_ukuran_isian
  for each row execute function catat_audit_goal();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table grd_ukuran enable row level security;
alter table grd_ukuran_lingkup enable row level security;
alter table grd_ukuran_titik enable row level security;
alter table grd_ukuran_isian enable row level security;

create policy grd_ukuran_baca on grd_ukuran
  for select using (
    lintas_angka()
    or (goal_id is not null and exists (select 1 from goals g where g.id = goal_id))
    or (pic_id is not null and boleh_orang(pic_id))
  );
create policy grd_ukuran_kelola on grd_ukuran
  for all using (lintas_unit()) with check (lintas_unit());

create policy grd_lingkup_baca on grd_ukuran_lingkup
  for select using (exists (select 1 from grd_ukuran u where u.id = ukuran_id));
create policy grd_lingkup_kelola on grd_ukuran_lingkup
  for all using (lintas_unit()) with check (lintas_unit());

create policy grd_titik_baca on grd_ukuran_titik
  for select using (exists (select 1 from grd_ukuran u where u.id = ukuran_id));
create policy grd_titik_kelola on grd_ukuran_titik
  for all using (lintas_unit()) with check (lintas_unit());

create policy grd_isian_baca on grd_ukuran_isian
  for select using (exists (select 1 from grd_ukuran u where u.id = ukuran_id));
create policy grd_isian_isi on grd_ukuran_isian
  for insert with check (boleh_isi_ukuran(ukuran_id));
create policy grd_isian_ubah on grd_ukuran_isian
  for update using (boleh_isi_ukuran(ukuran_id))
  with check (boleh_isi_ukuran(ukuran_id));
create policy grd_isian_hapus on grd_ukuran_isian
  for delete using (boleh_isi_ukuran(ukuran_id));

-- ---------------------------------------------------------------------
-- Realisasi
-- ---------------------------------------------------------------------

/**
 * Realisasi kumulatif sebuah ukuran sampai tanggal tertentu.
 *
 * gmv  : Σ faktor × GMV laporan harian atas tiap lingkupnya, sejak awal
 *        periode GRD sampai `p_sampai` (paling jauh akhir bulannya).
 *        Lingkup ukuran lain dihitung berjenjang, paling dalam 3 tingkat.
 * isian: angka isian terakhir pada atau sebelum `p_sampai`; null bila
 *        belum pernah diisi.
 *
 * Security invoker: RLS laporan harian pemanggil tetap berlaku, sama
 * dengan `gmv_goal_rentang` (0178).
 */
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

  for l in select * from grd_ukuran_lingkup where ukuran_id = u.id loop
    if l.sumber_ukuran_id is not null then
      if p_kedalaman < 3 then
        jumlah := jumlah + l.faktor * coalesce(
          realisasi_ukuran(l.sumber_ukuran_id, p_sampai, p_kedalaman + 1), 0);
      end if;
    else
      jumlah := jumlah + l.faktor * coalesce((
        select sum(case l.jenis_gmv
                     when 'live' then coalesce(r.gmv_live, 0)
                     when 'video' then r.gmv - coalesce(r.gmv_live, 0)
                     else r.gmv
                   end)
        from daily_reports r
        left join accounts a on a.id = r.account_id
        where r.tanggal between dari and akhir
          and case
                when l.account_id is not null then r.account_id = l.account_id
                else coalesce(r.unit_id, a.unit_id) = l.unit_id
              end
      ), 0);
    end if;
  end loop;

  return jumlah;
end;
$$;

comment on function realisasi_ukuran(uuid, date, integer) is
  'Realisasi kumulatif ukuran GRD sampai tanggal: GMV atas lingkupnya, atau isian terakhir (0188).';

/** Realisasi goal GRD lewat ukurannya; dibekukan pada tenggat goal. */
create or replace function realisasi_goal(p_goal uuid, p_sampai date)
returns numeric
language sql
stable
as $$
  select realisasi_ukuran(u.id, least(p_sampai, coalesce(g.tenggat, p_sampai)))
  from goals g
  join grd_ukuran u on u.goal_id = g.id
  where g.id = p_goal;
$$;

-- ---------------------------------------------------------------------
-- Target rupiah hanya dari goal GMV
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
    and g.jenis_realisasi = 'gmv'
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
    and g.jenis_realisasi = 'gmv'
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
    and g.jenis_realisasi = 'gmv'
    and g.account_id is not null
    and a.unit_id = p_unit
    and gm.bulan = date_trunc('month', p_tanggal)::date
    and p_tanggal between gm.dari and gm.sampai;
$$;

create or replace function target_bulanan_unit(p_unit uuid, p_tanggal date)
returns numeric
language sql
stable
as $$
  select coalesce(sum(gm.target), 0)
  from goals g
  join goal_months gm on gm.goal_id = g.id
  where g.status = 'aktif'
    and g.jenis_realisasi = 'gmv'
    and g.unit_id = p_unit
    and g.account_id is null
    and gm.bulan = date_trunc('month', p_tanggal)::date;
$$;

create or replace function target_bulanan_akun_unit(p_unit uuid, p_tanggal date)
returns numeric
language sql
stable
as $$
  select coalesce(sum(gm.target), 0)
  from goals g
  join goal_months gm on gm.goal_id = g.id
  join accounts a on a.id = g.account_id
  where g.status = 'aktif'
    and g.jenis_realisasi = 'gmv'
    and g.account_id is not null
    and a.unit_id = p_unit
    and gm.bulan = date_trunc('month', p_tanggal)::date;
$$;

-- ---------------------------------------------------------------------
-- Progres goal: goal berukuran membaca ukurannya, targetnya target goal
-- itu sendiri; goal lama tetap seperti 0178. Draft ikut dihitung supaya
-- usulan bisa dinilai sebelum disahkan.
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
  )
  select
    d.id,
    d.target,
    d.realisasi,
    case when d.target > 0 then round(d.realisasi / d.target * 100, 1) else 0 end
  from dasar d;
$$;

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
      case
        when exists (select 1 from grd_ukuran u where u.goal_id = g.id)
          then coalesce(realisasi_goal(g.id, p_tanggal), 0)
        else gmv_goal_rentang(
          null,
          null,
          coalesce(gm.dari, date_trunc('month', p_tanggal)::date),
          least(p_tanggal, coalesce(gm.sampai, p_tanggal))
        )
      end as realisasi
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

-- Anak tangga rupiah: hanya goal GMV; goal berukuran membaca ukurannya.
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
  order by
    case g.level when 'manager' then 0 else 1 end,
    g.kode nulls last,
    un.kode;
$$;

-- ---------------------------------------------------------------------
-- Kurva WRM: target kumulatif tiap Sabtu, aktual, dan statusnya.
--
-- Aktual ukuran gmv = realisasi sampai tanggal titik (hanya untuk titik
-- yang sudah lewat atau hari ini). Aktual ukuran isian = isian yang
-- dicatat PADA tanggal titik itu — "diisi tiap Sabtu" di file; titik
-- yang belum diisi tetap kosong, bukan memakai angka pekan lalu.
-- HIJAU = aktual ≥ target, persis aturan file.
-- ---------------------------------------------------------------------
create or replace function kurva_grd(p_periode date, p_acuan date)
returns table (
  ukuran_id uuid,
  kode      text,
  judul     text,
  satuan    text,
  sumber    text,
  goal_id   uuid,
  pic       text,
  urutan    smallint,
  boleh_isi boolean,
  titik     jsonb
)
language sql
stable
as $$
  select
    u.id, u.kode, u.judul, u.satuan, u.sumber, u.goal_id,
    coalesce(nullif(p.nama, ''), u.pic_teks),
    u.urutan,
    boleh_isi_ukuran(u.id),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'tanggal', t.tanggal,
        'target', t.target,
        'aktual', a.aktual,
        'status', case
          when a.aktual is null then null
          when a.aktual >= t.target then 'hijau'
          else 'merah'
        end
      ) order by t.tanggal)
      from grd_ukuran_titik t
      cross join lateral (
        select case
          when t.tanggal > p_acuan then null
          when u.sumber = 'isian' then (
            select i.nilai from grd_ukuran_isian i
            where i.ukuran_id = u.id and i.tanggal = t.tanggal
          )
          else realisasi_ukuran(u.id, t.tanggal)
        end as aktual
      ) a
      where t.ukuran_id = u.id
    ), '[]'::jsonb)
  from grd_ukuran u
  left join users p on p.id = u.pic_id
  where u.grd_periode = p_periode
  order by u.urutan, u.kode;
$$;

comment on function kurva_grd(date, date) is
  'Kurva WRM GRD: target kumulatif tiap titik (Sabtu), aktual, dan status HIJAU/MERAH (0188).';

-- ---------------------------------------------------------------------
-- Rumus KPI per jabatan (bulan non-GRD) ikut menyaring goal GMV saja;
-- isi fungsi selain saringan itu sama dengan 0178.
-- ---------------------------------------------------------------------
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
                  and g.jenis_realisasi = 'gmv'
      join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
      where a.status = 'aktif'
    ) as ada
  ),
  sasaran as (
    select gm.target, gm.dari, gm.sampai, a.id as akun, null::uuid as unit
    from pengguna p
    join accounts a on a.pic_user_id = p.id and a.status = 'aktif'
    join goals g on g.account_id = a.id and g.status = 'aktif'
                and g.jenis_realisasi = 'gmv'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role = 'Staff'

    union all

    select gm.target, gm.dari, gm.sampai, null, p.unit_id
    from pengguna p
    join goals g on g.unit_id = p.unit_id and g.account_id is null
                and g.status = 'aktif' and g.jenis_realisasi = 'gmv'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role = 'Staff'
      and p.unit_id is not null
      and not (select ada from punya_akun)

    union all

    select gm.target, gm.dari, gm.sampai, null, p.unit_id
    from pengguna p
    join goals g on g.unit_id = p.unit_id and g.account_id is null
                and g.status = 'aktif' and g.jenis_realisasi = 'gmv'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role in ('Leader', 'Co-Leader') and p.unit_id is not null

    union all

    select gm.target, gm.dari, gm.sampai, null, null
    from pengguna p
    join goals g on g.level in ('company', 'manager') and g.status = 'aktif'
                and g.jenis_realisasi = 'gmv'
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
-- Rollback (manual): drop kurva_grd, realisasi_goal, realisasi_ukuran,
-- boleh_isi_ukuran, jaga_isian_ukuran, tabel grd_ukuran_* & grd_ukuran;
-- jalankan ulang fungsi target/progres dari 0007/0008/0178 dan
-- catat_revisi_laporan & jaga_kolom_departemen dari 0127/0125; drop kolom
-- goals.grd_periode/kode/tenggat/jenis_realisasi/keterangan,
-- daily_reports.gmv_live, daily_report_revisions.live_lama/live_baru.
-- ---------------------------------------------------------------------
