-- =====================================================================
-- K-Space V2 — Unit Sosial Impact (unit tanpa laporan GMV)
--
-- Departemen Sosial Impact (Blok Imarah, GRD SP 1.3: kajian, kebersihan
-- dan pemeliharaan masjid, media) belum punya unit. Padahal aplikasi
-- mewajibkan Leader ditempatkan di satu unit, dan Staff hanya boleh
-- melapor kepada Leader seunit — jadi Leader Sosial Impact dan timnya
-- tidak bisa disusun. Migrasi ini menambah unit `sosial` beserta
-- departemennya.
--
-- Berbeda dengan Affiliator, MCN, dan TAP, unit ini TIDAK melaporkan GMV.
-- Tandanya kolom baru `units.lapor_harian` (false). Tanpa tanda itu,
-- aturan lama menganggap setiap Leader unit tanpa akun wajib melapor GMV
-- untuk unitnya: Leader Sosial Impact akan ditagih laporan setiap hari
-- dan absen pulangnya terkunci. Yang menghormati tanda itu:
--   * wajib_lapor_harian, sudah_lapor_harian — tidak ada tagihan unit;
--   * sasaran_laporan_saya — unit ini tidak muncul di form laporan;
--   * ringkasan_gmv_unit — tidak muncul di GMV per unit (Beranda);
--   * hitung_laporan_mingguan — tidak dinilai di laporan mingguan WRM;
--   * jaga_kolom_departemen — laporan harian untuk unit ini ditolak;
--   * jaga_unit_akun (baru) — akun TikTok tidak bisa ditempatkan di sini.
-- Selain syarat `lapor_harian`, isi setiap fungsi sama persis dengan
-- definisi terakhirnya (0173, 0214, 0139, 0008, 0207, 0191).
--
-- Unit lain tidak berubah: kolomnya bernilai bawaan true.
--
-- Aman dijalankan ulang. Rollback di bagian paling bawah.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kode unit dan pilihan divisi pendaftaran
-- ---------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'units'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kode%'
  loop
    execute format('alter table units drop constraint %I', c.conname);
  end loop;

  for c in
    select conname from pg_constraint
    where conrelid = 'pendaftaran_akun'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%unit_diajukan%'
  loop
    execute format('alter table pendaftaran_akun drop constraint %I', c.conname);
  end loop;
end $$;

alter table units
  add constraint units_kode_check
  check (kode in ('affiliator', 'mcn', 'tap', 'sosial'));

alter table pendaftaran_akun
  add constraint pendaftaran_akun_unit_diajukan_check
  check (unit_diajukan in ('affiliator', 'mcn', 'tap', 'sosial'));

-- ---------------------------------------------------------------------
-- 2. Tanda unit yang melaporkan GMV harian
-- ---------------------------------------------------------------------
alter table units
  add column if not exists lapor_harian boolean not null default true;

comment on column units.lapor_harian is
  'false = unit tanpa laporan GMV harian (mis. Sosial Impact): tidak ada tagihan laporan, tidak muncul di GMV per unit dan laporan mingguan, tidak bisa memegang akun TikTok (0223).';

-- ---------------------------------------------------------------------
-- 3. Departemen dan unit Sosial Impact
-- ---------------------------------------------------------------------
insert into departments (nama) values ('Sosial Impact')
on conflict (nama) do nothing;

insert into units (kode, nama, deskripsi, department_id, lapor_harian)
select
  'sosial',
  'Sosial Impact',
  'Imarah masjid: kajian, kebersihan dan pemeliharaan, media. Tidak melaporkan GMV.',
  d.id,
  false
from departments d
where d.nama = 'Sosial Impact'
on conflict (kode) do update
  set lapor_harian = false,
      department_id = coalesce(units.department_id, excluded.department_id);

-- Seperti unit lain, unit ini punya program bawaan "Reguler".
insert into programs (nama, unit_id)
select 'Reguler', u.id from units u where u.kode = 'sosial'
on conflict (unit_id, nama) do nothing;

-- ---------------------------------------------------------------------
-- 4. Tagihan laporan harian (salinan 0173 dan 0214 + syarat lapor_harian)
-- ---------------------------------------------------------------------
create or replace function wajib_lapor_harian(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select boleh_orang(p_user)
     and (
       exists (
         select 1 from accounts a
         where a.status = 'aktif' and a.pic_user_id = p_user
       )
       or exists (
         select 1
         from users u
         join units un on un.id = u.unit_id
         where u.id = p_user
           and u.role = 'Leader'
           -- 0223: unit tanpa laporan GMV tidak ditagih laporan unit.
           and un.lapor_harian
           and not exists (
             select 1 from accounts a
             where a.unit_id = un.id and a.status = 'aktif'
           )
       )
     );
$$;

create or replace function sudah_lapor_harian(p_user uuid, p_tanggal date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- H-1: `p_tanggal` = hari absen; laporan yang ditagih hari itu memuat
  -- GMV hari sebelumnya.
  select boleh_orang(p_user)
     and (
       -- Melapor sendiri.
       exists (
         select 1 from daily_reports r
         where r.user_id = p_user and r.tanggal = p_tanggal - 1
       )
       -- Leader unit tanpa akun: unitnya sudah dilaporkan, siapa pun
       -- pengirimnya. Syaratnya sama dengan `wajib_lapor_harian`.
       or exists (
         select 1
         from daily_reports r
         join users u on u.unit_id = r.unit_id
         join units un on un.id = u.unit_id
         where u.id = p_user
           and u.role = 'Leader'
           and un.lapor_harian
           and r.tanggal = p_tanggal - 1
           and not exists (
             select 1 from accounts a
             where a.unit_id = u.unit_id and a.status = 'aktif'
           )
       )
       -- PIC: sudah memegang akun aktif pada hari itu, dan tidak ada yang
       -- tersisa untuk dilapor. Akun yang terdaftar persis pada hari absen
       -- belum bisa dilapor untuk kemarin, jadi belum ditagih.
       or (
         exists (
           select 1 from accounts a
           where a.pic_user_id = p_user
             and a.status = 'aktif'
             and (a.created_at at time zone 'Asia/Jakarta')::date <= p_tanggal
         )
         and not exists (
           select 1 from accounts a
           where a.pic_user_id = p_user
             and a.status = 'aktif'
             and (a.created_at at time zone 'Asia/Jakarta')::date < p_tanggal
             and not exists (
               select 1 from daily_reports r
               where r.account_id = a.id and r.tanggal = p_tanggal - 1
             )
         )
       )
     );
$$;

-- ---------------------------------------------------------------------
-- 5. Sasaran form laporan (salinan 0139 + syarat lapor_harian)
-- ---------------------------------------------------------------------
create or replace function sasaran_laporan_saya(p_tanggal date)
returns table (
  jenis          text,
  akun_id        uuid,
  unit_kode      text,
  label          text,
  program        text,
  pic_nama       text,
  target_harian  numeric,
  level          smallint,
  sudah_lapor    boolean
)
language sql
stable
as $$
  select
    'akun'::text,
    a.id,
    u.kode,
    a.username,
    nullif(p.nama, 'Reguler'),
    pic.nama,
    coalesce(t.target, 0),
    a.level,
    exists (
      select 1 from daily_reports r
      where r.account_id = a.id and r.tanggal = p_tanggal
    )
  from accounts a
  join units u on u.id = a.unit_id
  left join programs p on p.id = a.program_id
  left join users pic on pic.id = a.pic_user_id
  left join target_harian_akun(p_tanggal) t on t.account_id = a.id
  where a.status = 'aktif'
    and (lintas_unit() or a.pic_user_id = auth.uid())

  union all

  -- Sasaran tingkat unit tidak punya level: batas minimum menempel pada
  -- akun, bukan pada unit.
  select
    'unit'::text,
    null::uuid,
    u.kode,
    u.nama,
    null,
    null,
    coalesce(t.target, 0),
    null::smallint,
    exists (
      select 1 from daily_reports r
      where r.unit_id = u.id and r.tanggal = p_tanggal
    )
  from units u
  left join target_harian_unit(p_tanggal) t on t.unit_id = u.id
  where u.lapor_harian
    and not exists (
      select 1 from accounts a where a.unit_id = u.id and a.status = 'aktif'
    )
    and (
      lintas_unit()
      or exists (
        select 1 from users me
        where me.id = auth.uid() and me.role = 'Leader' and me.unit_id = u.id
      )
    );
$$;

-- ---------------------------------------------------------------------
-- 6. GMV per unit dan laporan mingguan (salinan 0008, 0207 + syarat)
-- ---------------------------------------------------------------------
create or replace function ringkasan_gmv_unit(p_tanggal date)
returns table (
  unit_id         uuid,
  kode            text,
  nama            text,
  deskripsi       text,
  gmv_hari_ini    numeric,
  gmv_kemarin     numeric,
  target_harian   numeric,
  gmv_bulan_ini   numeric,
  target_bulanan  numeric
)
language sql
stable
as $$
  with dasar as (
    select
      u.id,
      u.kode,
      u.nama,
      u.deskripsi,
      target_harian_akun_unit(u.id, p_tanggal)   as harian_akun,
      target_bulanan_akun_unit(u.id, p_tanggal)  as bulanan_akun,
      coalesce(th.target, 0)                     as harian_unit,
      target_bulanan_unit(u.id, p_tanggal)       as bulanan_unit
    from units u
    left join target_harian_unit(p_tanggal) th on th.unit_id = u.id
    where u.lapor_harian
  )
  select
    d.id,
    d.kode,
    d.nama,
    d.deskripsi,
    gmv_unit_tanggal(d.id, p_tanggal),
    gmv_unit_tanggal(d.id, p_tanggal - 1),
    case when d.harian_akun > 0 then d.harian_akun else d.harian_unit end,
    gmv_unit_bulan(d.id, p_tanggal),
    case when d.bulanan_akun > 0 then d.bulanan_akun else d.bulanan_unit end
  from dasar d
  order by d.kode;
$$;

create or replace function hitung_laporan_mingguan(
  p_pekan date,
  p_sampai date default current_date
)
returns table (
  unit_id      uuid,
  unit_kode    text,
  target       numeric,
  gmv          numeric,
  rasio_hasil  numeric,
  rasio_kri    numeric,
  status_hasil warna_wrm,
  status_kri   warna_wrm
)
language sql
stable
as $$
  with batas as (
    -- H-1: GMV paling jauh ada sampai kemarin.
    select least(p_sampai, p_pekan + 6, tanggal_data_terakhir()) as sampai
  ),
  baris as (
    select
      u.id, u.kode,
      coalesce(t.target, 0) as target,
      coalesce(g.gmv, 0) as gmv,
      coalesce(k.rasio, 0) as rasio_kri
    from units u
    cross join batas
    left join target_pekan_unit(p_pekan, batas.sampai) t on t.unit_id = u.id
    left join lateral (
      select sum(r.gmv) gmv
      from daily_reports r
      left join accounts a on a.id = r.account_id
      where coalesce(r.unit_id, a.unit_id) = u.id
        and r.tanggal between p_pekan and batas.sampai
    ) g on true
    left join lateral (
      select avg(p.rasio) rasio
      from papan_lead_measure(p_pekan) p
      where p.unit_kode = u.kode
    ) k on true
    -- 0223: unit tanpa laporan GMV tidak dinilai di matriks WRM mingguan.
    where u.lapor_harian
  )
  select
    id, kode, target, gmv,
    case when target > 0 then round(gmv / target * 100, 1) else 0 end,
    round(rasio_kri, 1),
    case when target > 0 and gmv >= target
      then 'hijau'::warna_wrm else 'merah'::warna_wrm end,
    case when rasio_kri >= 100
      then 'hijau'::warna_wrm else 'merah'::warna_wrm end
  from baris;
$$;

-- ---------------------------------------------------------------------
-- 7. Penjaga: laporan harian dan akun TikTok
-- ---------------------------------------------------------------------
create or replace function jaga_kolom_departemen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kode text;
begin
  v_kode := unit_laporan(new.account_id, new.unit_id);

  -- 0223: unit tanpa laporan GMV (mis. Sosial Impact) tidak menerima
  -- laporan harian sama sekali.
  if exists (
    select 1 from units u where u.kode = v_kode and not u.lapor_harian
  ) then
    raise exception 'Unit % tidak melaporkan GMV harian', v_kode
      using errcode = 'check_violation';
  end if;

  if v_kode is distinct from 'affiliator'
     and (new.komisi is not null or new.jumlah_upload is not null
          or new.gmv_live is not null or new.jam_live is not null)
  then
    raise exception
      'Departemen % hanya melaporkan GMV dan catatan', coalesce(v_kode, '?')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function jaga_unit_akun()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nama text;
begin
  select u.nama into v_nama
  from units u
  where u.id = new.unit_id and not u.lapor_harian;

  if v_nama is not null then
    raise exception 'Unit % tidak melaporkan GMV, jadi tidak bisa memegang akun TikTok', v_nama
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists accounts_jaga_unit on accounts;
create trigger accounts_jaga_unit
  before insert or update of unit_id on accounts
  for each row execute function jaga_unit_akun();

-- ---------------------------------------------------------------------
-- Rollback (manual), bila belum ada anggota di unit `sosial`:
--   drop trigger if exists accounts_jaga_unit on accounts;
--   drop function if exists jaga_unit_akun();
--   jalankan lagi definisi fungsi dari 0173 (wajib_lapor_harian),
--     0214 (sudah_lapor_harian), 0139 (sasaran_laporan_saya),
--     0008 (ringkasan_gmv_unit), 0207 (hitung_laporan_mingguan),
--     0191 (jaga_kolom_departemen);
--   delete from programs where unit_id = (select id from units where kode = 'sosial');
--   delete from units where kode = 'sosial';
--   delete from departments where nama = 'Sosial Impact';
--   alter table units drop column lapor_harian;
--   kembalikan check units.kode dan pendaftaran_akun.unit_diajukan ke
--     ('affiliator', 'mcn', 'tap').
-- ---------------------------------------------------------------------
