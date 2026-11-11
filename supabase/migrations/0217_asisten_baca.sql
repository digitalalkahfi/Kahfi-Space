-- =====================================================================
-- K-Space V2 — Akses HANYA-BACA untuk "Asisten Manager" (Claude Code)
--
-- Asisten Manager adalah agen Claude Code di Mac Manager yang perlu
-- menjawab: siapa belum lapor, GMV vs target, dan tugas telat. Ia tidak
-- boleh menulis apa pun, dan penjagaannya ada di DATABASE, bukan kode:
--
--   * peran `asisten_baca` (NOLOGIN di sini; LOGIN + sandi dipasang
--     manual oleh Manager di SQL Editor),
--   * setiap transaksinya read-only (`default_transaction_read_only`),
--   * TIDAK punya hak apa pun di skema public/auth/storage — hanya
--     EXECUTE pada fungsi di skema `asisten`.
--
-- Fungsi `asisten.*` hanya MEMBUNGKUS fungsi yang sudah dipakai Beranda
-- (`status_tim_harian`, `ringkasan_gmv_unit`, `gmv_harian_per_unit`,
-- `porsi_bulan_berjalan`, `hari_kerja_absensi`). Tidak ada rumus GMV,
-- target, hari kerja, atau wajib lapor versi baru.
--
-- Cakupan: dipanggil tanpa JWT dengan peran bukan anon/authenticated,
-- jadi `pemanggil_sistem()` (0173) bernilai true → seluruh organisasi,
-- sama dengan yang dilihat Manager.
--
-- Tanggal SELALU parameter eksplisit (WIB). `asisten.hari_ini()` hanya
-- penolong untuk mendapat tanggal WIB hari ini.
--
-- Aman dijalankan ulang. Rollback di bagian paling bawah.
-- =====================================================================

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'asisten_baca') then
    create role asisten_baca nologin noinherit;
  end if;
end $$;
alter role asisten_baca set default_transaction_read_only = on;
alter role asisten_baca set statement_timeout = '15s';
alter role asisten_baca set timezone = 'Asia/Jakarta';

create schema if not exists asisten;
revoke all on schema asisten from public;

-- ---------------------------------------------------------------------
-- Tanggal
-- ---------------------------------------------------------------------
create or replace function asisten.hari_ini()
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;
comment on function asisten.hari_ini() is
  'Tanggal hari ini dalam WIB (Asia/Jakarta), bukan UTC.';

create or replace function asisten.hari_kerja_terakhir(p_tanggal date)
returns date
language sql
stable
security definer
set search_path = public
as $$
  -- Hari kerja = `hari_kerja_absensi` (Senin–Sabtu di luar libur
  -- perusahaan). p_tanggal sendiri dihitung bila hari kerja.
  select max(d::date)
  from generate_series(p_tanggal - 14, p_tanggal, interval '1 day') d
  where hari_kerja_absensi(d::date);
$$;
comment on function asisten.hari_kerja_terakhir(date) is
  'Hari kerja terbesar <= p_tanggal (mundur maksimal 14 hari).';

-- ---------------------------------------------------------------------
-- Lapor harian (sama dengan kartu Status Tim di Beranda)
-- ---------------------------------------------------------------------
create or replace function asisten.status_lapor(p_tanggal date)
returns table (
  nama         text,
  role         peran_pengguna,
  unit         text,
  leader       text,
  wajib_lapor  boolean,
  sudah_lapor  boolean,
  tanggal_gmv  date
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive naik as (
    -- Garis atasan naik sampai ketemu orang ber-role Leader.
    select u.id as asal, u.atasan_id as atas, 1 as langkah
    from users u
    union all
    select n.asal, x.atasan_id, n.langkah + 1
    from naik n
    join users x on x.id = n.atas
    where x.role <> 'Leader' and n.langkah < 10
  ),
  leader as (
    select distinct on (n.asal) n.asal, l.nama
    from naik n
    join users l on l.id = n.atas and l.role = 'Leader'
    order by n.asal, n.langkah
  )
  select
    s.nama,
    u.role,
    s.unit_nama,
    case when u.role = 'Leader' then u.nama
         else coalesce(ld.nama, 'Tanpa Leader') end,
    s.wajib_lapor,
    s.sudah_lapor,
    p_tanggal - 1
  from status_tim_harian(p_tanggal) s
  join users u on u.id = s.user_id
  left join leader ld on ld.asal = s.user_id
  order by s.unit_nama, s.nama;
$$;
comment on function asisten.status_lapor(date) is
  'status_tim_harian(p_tanggal) + Leader. Tagihan p_tanggal = laporan GMV bertanggal p_tanggal - 1 (H-1).';

create or replace function asisten.belum_lapor(p_tanggal date)
returns table (
  nama        text,
  role        peran_pengguna,
  unit        text,
  leader      text,
  tanggal_gmv date
)
language sql
stable
security definer
set search_path = public
as $$
  select s.nama, s.role, s.unit, s.leader, s.tanggal_gmv
  from asisten.status_lapor(p_tanggal) s
  where s.wajib_lapor and not s.sudah_lapor
  order by s.leader, s.nama;
$$;
comment on function asisten.belum_lapor(date) is
  'Orang wajib lapor yang belum lapor pada hari absen p_tanggal (definisi Beranda).';

-- ---------------------------------------------------------------------
-- GMV vs target (ringkasan_gmv_unit + porsi_bulan_berjalan)
-- ---------------------------------------------------------------------
create or replace function asisten.gmv_unit(p_tanggal date)
returns table (
  kode            text,
  nama            text,
  tanggal         date,
  gmv_tanggal     numeric,
  ada_laporan     boolean,
  target_harian   numeric,
  gmv_bulan       numeric,
  target_bulanan  numeric,
  porsi_bulan     numeric,
  target_prorata  numeric,
  rasio_prorata   numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.kode,
    r.nama,
    p_tanggal,
    r.gmv_hari_ini,
    exists (
      select 1 from gmv_harian_per_unit(p_tanggal, p_tanggal) g
      where g.unit_id = r.unit_id
    ),
    round(nullif(r.target_harian, 0)),
    r.gmv_bulan_ini,
    nullif(r.target_bulanan, 0),
    round(porsi_bulan_berjalan(date_trunc('month', p_tanggal)::date, p_tanggal), 4),
    round(nullif(r.target_bulanan, 0)
      * porsi_bulan_berjalan(date_trunc('month', p_tanggal)::date, p_tanggal)),
    round(
      100 * r.gmv_bulan_ini
        / nullif(nullif(r.target_bulanan, 0)
          * porsi_bulan_berjalan(date_trunc('month', p_tanggal)::date, p_tanggal), 0),
      1
    )
  from ringkasan_gmv_unit(p_tanggal) r
  order by r.kode;
$$;
comment on function asisten.gmv_unit(date) is
  'ringkasan_gmv_unit(p_tanggal) + target prorata (target bulan x porsi_bulan_berjalan) dan rasio %. GMV = input manual K-Space.';

create or replace function asisten.gmv_harian(p_dari date, p_sampai date)
returns table (
  tanggal        date,
  kode           text,
  nama           text,
  gmv            numeric,
  jumlah_laporan bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_dari is null or p_sampai is null or p_sampai < p_dari then
    raise exception 'Rentang tanggal tidak valid';
  end if;
  if p_sampai - p_dari > 92 then
    raise exception 'Rentang maksimal 92 hari';
  end if;
  return query
    select g.tanggal, g.kode, g.nama, g.gmv, g.jumlah_laporan
    from gmv_harian_per_unit(p_dari, p_sampai) g
    order by g.tanggal, g.kode;
end;
$$;
comment on function asisten.gmv_harian(date, date) is
  'gmv_harian_per_unit dalam rentang <= 92 hari; tanggal tanpa laporan tidak muncul (bukan nol).';

-- ---------------------------------------------------------------------
-- Tugas lewat tenggat
-- ---------------------------------------------------------------------
create or replace function asisten.tugas_telat(p_waktu timestamptz)
returns table (
  penerima    text,
  role        peran_pengguna,
  unit        text,
  leader      text,
  pembuat     text,
  tipe        text,
  judul       text,
  tenggat_wib text,
  hari_telat  integer,
  status      status_tugas,
  kelompok    text
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive naik as (
    select u.id as asal, u.atasan_id as atas, 1 as langkah
    from users u
    union all
    select n.asal, x.atasan_id, n.langkah + 1
    from naik n
    join users x on x.id = n.atas
    where x.role <> 'Leader' and n.langkah < 10
  ),
  leader as (
    select distinct on (n.asal) n.asal, l.nama
    from naik n
    join users l on l.id = n.atas and l.role = 'Leader'
    order by n.asal, n.langkah
  )
  select
    pe.nama,
    pe.role,
    coalesce(split_part(un.nama, ' (', 1), 'Manajemen'),
    case when pe.role = 'Leader' then pe.nama
         else coalesce(ld.nama, 'Tanpa Leader') end,
    pb.nama,
    case t.tipe when 'pribadi' then 'To-do'
                when 'tiket' then 'Tiket'
                else 'Komitmen' end,
    t.judul,
    to_char(t.tenggat at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI'),
    ((p_waktu at time zone 'Asia/Jakarta')::date
      - (t.tenggat at time zone 'Asia/Jakarta')::date)::int,
    t.status,
    case when t.status = 'menunggu_qc' then 'menunggu_qc' else 'telat' end
  from tasks t
  join users pe on pe.id = t.penerima_id
  join users pb on pb.id = t.pembuat_id
  left join units un on un.id = pe.unit_id
  left join leader ld on ld.asal = pe.id
  where t.tenggat is not null
    and t.tenggat < p_waktu
    and t.status in ('todo', 'berjalan', 'revisi', 'menunggu_qc')
    and pe.status = 'aktif'
  order by t.tenggat;
$$;
comment on function asisten.tugas_telat(timestamptz) is
  'Tugas bertenggat < p_waktu yang belum selesai. kelompok: telat (todo/berjalan/revisi) atau menunggu_qc (dipisah).';

-- ---------------------------------------------------------------------
-- Hak: hanya asisten_baca, hanya EXECUTE di skema asisten.
-- ---------------------------------------------------------------------
revoke all on all functions in schema asisten from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all functions in schema asisten from anon';
    execute 'revoke all on schema asisten from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all functions in schema asisten from authenticated';
    execute 'revoke all on schema asisten from authenticated';
  end if;
end $$;
grant usage on schema asisten to asisten_baca;
grant execute on all functions in schema asisten to asisten_baca;

-- ---------------------------------------------------------------------
-- Dijalankan MANUAL oleh Manager di SQL Editor (bukan bagian migration):
--   alter role asisten_baca with login password '<sandi kuat 32+ karakter>';
--
-- Rollback (manual):
--   alter role asisten_baca nologin;
--   drop schema asisten cascade;
--   drop role asisten_baca;
-- ---------------------------------------------------------------------
