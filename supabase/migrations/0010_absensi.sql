-- =====================================================================
-- K-Space V2 — Absensi (PRD §3)
--
-- Masuk & pulang dengan selfie + GPS. Dua aturan inti dijaga database,
-- bukan aplikasi, supaya tidak bisa dilangkahi lewat API:
--   1. Absen pulang terkunci sampai laporan harian hari itu terkirim.
--   2. Izin/sakit butuh persetujuan atasan.
-- =====================================================================

create type status_kehadiran as enum
  ('hadir', 'terlambat', 'izin', 'sakit', 'alpa');

create type status_persetujuan as enum ('diajukan', 'disetujui', 'ditolak');

-- ---------------------------------------------------------------------
-- Pengaturan operasional — titik kantor, radius, jam masuk.
-- Satu baris saja; disimpan di tabel supaya bisa diubah tanpa deploy.
-- ---------------------------------------------------------------------
create table pengaturan (
  id            boolean primary key default true check (id),
  kantor_lat    numeric(9, 6) not null default -6.260700,
  kantor_lng    numeric(9, 6) not null default 106.810600,
  radius_meter  int not null default 150 check (radius_meter between 20 and 5000),
  jam_masuk     time not null default '08:00',
  toleransi_menit int not null default 15 check (toleransi_menit between 0 and 120),
  updated_at    timestamptz not null default now()
);

insert into pengaturan (id) values (true) on conflict (id) do nothing;

alter table pengaturan enable row level security;
create policy pengaturan_baca on pengaturan
  for select using (auth.uid() is not null);
create policy pengaturan_kelola on pengaturan
  for all using (lintas_unit()) with check (lintas_unit());

-- ---------------------------------------------------------------------
-- Jarak haversine dalam meter — cukup akurat untuk radius kantor.
-- ---------------------------------------------------------------------
create or replace function jarak_meter(
  lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
)
returns numeric
language sql
immutable
as $$
  select round((
    6371000 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2))
        * power(sin(radians(lng2 - lng1) / 2), 2)
    ))
  )::numeric, 1);
$$;

-- ---------------------------------------------------------------------
create table attendance (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users (id) on delete cascade,
  tanggal         date not null,
  jam_masuk       timestamptz,
  jam_pulang      timestamptz,
  foto_masuk_url  text,
  foto_pulang_url text,
  lat_masuk       numeric(9, 6),
  lng_masuk       numeric(9, 6),
  lat_pulang      numeric(9, 6),
  lng_pulang      numeric(9, 6),
  jarak_masuk_m   numeric(8, 1),
  lokasi_valid    boolean not null default false,
  terlambat       boolean not null default false,
  status          status_kehadiran not null default 'hadir',
  -- Izin & sakit melewati persetujuan atasan.
  alasan          text not null default '',
  persetujuan     status_persetujuan,
  disetujui_oleh  uuid references users (id) on delete set null,
  disetujui_pada  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id, tanggal),
  constraint attendance_pulang_setelah_masuk
    check (jam_pulang is null or jam_masuk is null or jam_pulang >= jam_masuk),
  -- Izin/sakit tidak punya jam masuk, tapi wajib beralasan & berstatus ajuan.
  constraint attendance_izin_beralasan check (
    status not in ('izin', 'sakit')
    or (length(btrim(alasan)) >= 5 and persetujuan is not null)
  )
);

create index attendance_tanggal_idx on attendance (tanggal desc);
create index attendance_user_idx on attendance (user_id, tanggal desc);

create trigger attendance_set_updated_at
  before update on attendance
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Hitung otomatis: validitas lokasi, keterlambatan, status.
-- ---------------------------------------------------------------------
create or replace function hitung_absensi()
returns trigger
language plpgsql
as $$
declare
  p record;
  batas timestamptz;
begin
  select * into p from pengaturan where id limit 1;

  if new.lat_masuk is not null and new.lng_masuk is not null then
    new.jarak_masuk_m := jarak_meter(p.kantor_lat, p.kantor_lng,
                                     new.lat_masuk, new.lng_masuk);
    new.lokasi_valid := new.jarak_masuk_m <= p.radius_meter;
  end if;

  if new.jam_masuk is not null then
    batas := (new.tanggal + p.jam_masuk) at time zone 'Asia/Jakarta'
             + make_interval(mins => p.toleransi_menit);
    new.terlambat := new.jam_masuk > batas;

    if new.status in ('hadir', 'terlambat') then
      new.status := case when new.terlambat then 'terlambat' else 'hadir' end;
    end if;
  end if;

  return new;
end;
$$;

create trigger attendance_hitung
  before insert or update on attendance
  for each row execute function hitung_absensi();

-- ---------------------------------------------------------------------
-- Absen pulang terkunci sampai laporan harian terkirim (PRD §2).
-- ---------------------------------------------------------------------
create or replace function sudah_lapor_harian(p_user uuid, p_tanggal date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from daily_reports r
    where r.user_id = p_user and r.tanggal = p_tanggal
  );
$$;

create or replace function jaga_absen_pulang()
returns trigger
language plpgsql
as $$
begin
  if new.jam_pulang is not null and old.jam_pulang is null then
    if not sudah_lapor_harian(new.user_id, new.tanggal) then
      raise exception
        'Absen pulang terkunci: laporan harian hari ini belum terkirim'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger attendance_jaga_pulang
  before update on attendance
  for each row execute function jaga_absen_pulang();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table attendance enable row level security;

create policy attendance_baca on attendance
  for select using (user_id = auth.uid() or boleh_orang(user_id));

-- Absen hanya untuk diri sendiri.
create policy attendance_masuk on attendance
  for insert with check (user_id = auth.uid());

-- Diri sendiri boleh memperbarui absensinya; atasan boleh memutus izin/sakit.
create policy attendance_ubah on attendance
  for update
  using (user_id = auth.uid() or boleh_orang(user_id))
  with check (user_id = auth.uid() or boleh_orang(user_id));

-- ---------------------------------------------------------------------
-- Ringkasan kehadiran + status laporan satu tanggal (untuk Beranda).
-- ---------------------------------------------------------------------
create or replace function status_tim_harian(p_tanggal date)
returns table (
  user_id      uuid,
  nama         text,
  inisial      text,
  unit_nama    text,
  status       status_kehadiran,
  jam_masuk    timestamptz,
  terlambat    boolean,
  lokasi_valid boolean,
  persetujuan  status_persetujuan,
  sudah_lapor  boolean
)
language sql
stable
as $$
  select
    u.id,
    u.nama,
    upper(left(split_part(u.nama, ' ', 1), 1)
          || left(split_part(u.nama, ' ', array_length(string_to_array(u.nama, ' '), 1)), 1)),
    coalesce(split_part(un.nama, ' (', 1), 'Manajemen'),
    coalesce(a.status, 'alpa'::status_kehadiran),
    a.jam_masuk,
    coalesce(a.terlambat, false),
    coalesce(a.lokasi_valid, false),
    a.persetujuan,
    sudah_lapor_harian(u.id, p_tanggal)
  from users u
  left join units un on un.id = u.unit_id
  left join attendance a on a.user_id = u.id and a.tanggal = p_tanggal
  where u.status = 'aktif'
  order by u.nama;
$$;

comment on function status_tim_harian(date) is
  'Dipakai Beranda: siapa sudah absen dan siapa belum kirim laporan hari ini.';
