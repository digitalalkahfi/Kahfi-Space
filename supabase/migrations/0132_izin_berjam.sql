-- =====================================================================
-- K-Space V2 — Izin berjam & izin terencana (PRD Fase 3)
--
-- Pengajuan izin tinggal di tabel `attendance` yang sudah ada — satu
-- baris per orang per hari — bukan di tabel baru. Alasannya: seluruh
-- aplikasi membaca kehadiran dari sana, dan izin yang hidup di tabel
-- terpisah berarti setiap pembaca harus ingat menggabungkan keduanya.
-- Yang lupa akan menampilkan orang yang sedang izin sebagai alpa.
--
-- Tiga bentuk yang dibedakan:
--   * sakit     — hari berjalan, status 'sakit' (perilaku lama);
--   * terencana — sehari atau lebih, minimal H-1, satu baris per hari
--                 yang disatukan lewat `izin_induk_id`;
--   * jam       — beberapa jam pada hari berjalan. Orangnya TETAP masuk,
--                 jadi statusnya tetap hadir/terlambat; yang berubah
--                 hanya jam efektif masuknya.
-- =====================================================================

create type jenis_izin as enum ('terencana', 'jam');

alter table attendance
  add column izin_jenis    jenis_izin,
  add column izin_mulai    time,
  add column izin_selesai  time,
  add column izin_induk_id uuid references attendance (id) on delete cascade,
  add column menit_telat   integer not null default 0
    check (menit_telat >= 0);

comment on column attendance.izin_jenis is
  'Bentuk izin; null berarti kehadiran biasa atau sakit hari berjalan.';
comment on column attendance.izin_induk_id is
  'Hari pertama sebuah izin terencana; baris hari pertama sendiri bernilai null.';
comment on column attendance.menit_telat is
  'Selisih menit terhadap jam efektif masuk — 0 bila tidak telat (migrasi 0132).';

create index attendance_izin_induk_idx on attendance (izin_induk_id)
  where izin_induk_id is not null;

-- Jam hanya berarti bagi izin berjam, dan izin berjam tanpa jam tidak
-- bisa dihitung sama sekali.
alter table attendance
  add constraint attendance_jam_izin_lengkap check (
    case
      when izin_jenis = 'jam'
        then izin_mulai is not null
             and izin_selesai is not null
             and izin_selesai > izin_mulai
      else izin_mulai is null and izin_selesai is null
    end
  ),
  -- Izin berjam berarti orangnya masuk, hanya terlambat resmi.
  add constraint attendance_jam_izin_tetap_hadir check (
    izin_jenis is distinct from 'jam' or status not in ('izin', 'sakit')
  ),
  -- Sama seperti izin harian: harus beralasan dan melewati persetujuan.
  add constraint attendance_jam_izin_beralasan check (
    izin_jenis is distinct from 'jam'
    or (length(btrim(alasan)) >= 5 and persetujuan is not null)
  ),
  -- Baris lanjutan izin terencana hanya boleh menunjuk hari pertama.
  add constraint attendance_izin_induk_terencana check (
    izin_induk_id is null or izin_jenis = 'terencana'
  );

-- ---------------------------------------------------------------------
-- Jam efektif masuk & menit telat
--
-- Yang lebih akhir antara batas jam kerja normal dan jam selesai izin
-- yang SUDAH DISETUJUI. Izin yang masih menunggu keputusan tidak
-- menggeser apa pun — kalau tidak, siapa pun bisa menghapus telatnya
-- sendiri hanya dengan mengajukan izin dan membiarkannya menggantung.
-- ---------------------------------------------------------------------
create or replace function hitung_absensi()
returns trigger
language plpgsql
as $$
declare
  p record;
  batas timestamptz;
  efektif timestamptz;
begin
  select * into p from pengaturan where id limit 1;

  if new.lat_masuk is not null and new.lng_masuk is not null then
    new.jarak_masuk_m := jarak_meter(p.kantor_lat, p.kantor_lng,
                                     new.lat_masuk, new.lng_masuk);
    new.lokasi_valid := new.jarak_masuk_m <= p.radius_meter;
  end if;

  if new.jam_masuk is null then
    new.menit_telat := 0;
    return new;
  end if;

  batas := (new.tanggal + p.jam_masuk) at time zone 'Asia/Jakarta'
           + make_interval(mins => p.toleransi_menit);
  efektif := batas;

  if new.izin_jenis = 'jam'
     and new.persetujuan = 'disetujui'
     and new.izin_selesai is not null then
    efektif := greatest(
      batas,
      (new.tanggal + new.izin_selesai) at time zone 'Asia/Jakarta'
    );
  end if;

  new.terlambat := new.jam_masuk > efektif;
  new.menit_telat := greatest(
    0,
    ceil(extract(epoch from (new.jam_masuk - efektif)) / 60)
  )::int;

  if new.status in ('hadir', 'terlambat') then
    new.status := case when new.terlambat then 'terlambat' else 'hadir' end;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Izin terencana: minimal H-1
--
-- Hanya berlaku bagi kiriman pengguna. Seed dan migrasi berjalan tanpa
-- `auth.uid()` dan memang perlu menulis riwayat apa adanya.
-- ---------------------------------------------------------------------
create or replace function jaga_izin_terencana()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.izin_jenis = 'terencana'
     and new.tanggal <= (now() at time zone 'Asia/Jakarta')::date
  then
    raise exception
      'Izin terencana diajukan paling lambat H-1; untuk hari ini pakai sakit atau izin berjam'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger attendance_jaga_izin_terencana
  before insert on attendance
  for each row execute function jaga_izin_terencana();

-- ---------------------------------------------------------------------
-- Satu keputusan untuk satu pengajuan
--
-- Izin tiga hari adalah satu permintaan, bukan tiga. Atasan memutuskan
-- barisnya yang pertama; hari-hari lanjutan mengikuti dalam transaksi
-- yang sama, supaya tidak pernah ada izin yang setengah disetujui.
-- ---------------------------------------------------------------------
create or replace function sebar_keputusan_izin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.persetujuan is distinct from old.persetujuan
     and new.izin_induk_id is null
  then
    update attendance
       set persetujuan = new.persetujuan,
           disetujui_oleh = new.disetujui_oleh,
           disetujui_pada = new.disetujui_pada
     where izin_induk_id = new.id
       and persetujuan is distinct from new.persetujuan;
  end if;
  return null;
end;
$$;

create trigger attendance_sebar_keputusan
  after update of persetujuan on attendance
  for each row execute function sebar_keputusan_izin();

-- ---------------------------------------------------------------------
-- Rekap kehadiran ikut membawa menit telat hasil perhitungan baru.
-- ---------------------------------------------------------------------
drop function if exists status_tim_harian(date);

create or replace function status_tim_harian(p_tanggal date)
returns table (
  user_id      uuid,
  nama         text,
  inisial      text,
  unit_nama    text,
  status       status_kehadiran,
  jam_masuk    timestamptz,
  terlambat    boolean,
  menit_telat  integer,
  izin_jenis   jenis_izin,
  izin_selesai time,
  lokasi_valid boolean,
  persetujuan  status_persetujuan,
  wajib_lapor  boolean,
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
    coalesce(a.menit_telat, 0),
    a.izin_jenis,
    a.izin_selesai,
    coalesce(a.lokasi_valid, false),
    a.persetujuan,
    wajib_lapor_harian(u.id),
    sudah_lapor_harian(u.id, p_tanggal)
  from users u
  left join units un on un.id = u.unit_id
  left join attendance a on a.user_id = u.id and a.tanggal = p_tanggal
  where u.status = 'aktif'
  order by u.nama;
$$;

comment on function status_tim_harian(date) is
  'Dipakai Beranda: siapa sudah absen, berapa menit telat, dan siapa belum kirim laporan.';
