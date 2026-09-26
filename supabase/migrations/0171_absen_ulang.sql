-- =====================================================================
-- K-Space V2 — Absen ulang
--
-- GPS ponsel kadang meleset: orang yang berdiri di kantor tercatat
-- "di luar radius", dan catatan itu terkunci selamanya karena satu
-- orang hanya boleh punya satu baris absensi per hari. Sekarang ia boleh
-- mengulang absennya di hari yang sama: catatan lama dikosongkan, absen
-- berikutnya mengisinya lagi.
--
-- Waktu hanya berjalan maju, jadi absen ulang tidak pernah membuat
-- seseorang tercatat lebih pagi — yang bisa diperbaiki hanya lokasinya.
-- Jumlahnya dibatasi dan dihitung supaya atasan tetap tahu.
-- =====================================================================

alter table attendance
  add column ulang_masuk smallint not null default 0
    check (ulang_masuk between 0 and 3),
  add column ulang_pulang smallint not null default 0
    check (ulang_pulang between 0 and 3),
  add column ulang_terakhir timestamptz;

comment on column attendance.ulang_masuk is
  'Berapa kali absen masuk hari itu diulang (maksimal 3).';
comment on column attendance.ulang_pulang is
  'Berapa kali absen pulang hari itu diulang (maksimal 3).';
comment on column attendance.ulang_terakhir is
  'Kapan terakhir kali absen hari itu diulang.';

-- ---------------------------------------------------------------------
-- Kosongkan catatan masuk atau pulang hari ini milik pemanggil sendiri.
-- Berjalan sebagai pemanggil: RLS `attendance_ubah` yang membatasi ke
-- barisnya sendiri, dan trigger perhitungan tetap bekerja seperti biasa.
-- ---------------------------------------------------------------------
create or replace function absen_ulang(p_tahap text)
returns table (jam_lama timestamptz, sisa integer)
language plpgsql
as $$
declare
  hari_ini date := (now() at time zone 'Asia/Jakarta')::date;
  a attendance%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Harus masuk dulu'
      using errcode = 'insufficient_privilege';
  end if;

  if p_tahap not in ('masuk', 'pulang') then
    raise exception 'Tahap absen ulang tidak dikenal: %', p_tahap
      using errcode = 'check_violation';
  end if;

  select * into a
  from attendance
  where user_id = auth.uid() and tanggal = hari_ini;

  if not found then
    raise exception 'Belum ada catatan absen hari ini'
      using errcode = 'no_data_found';
  end if;

  if a.status not in ('hadir', 'terlambat', 'alpa') then
    raise exception 'Izin atau sakit tidak bisa diabsen ulang'
      using errcode = 'check_violation';
  end if;

  if p_tahap = 'masuk' then
    if a.jam_masuk is null then
      raise exception 'Absen masuk belum tercatat; langsung absen saja'
        using errcode = 'check_violation';
    end if;
    if a.jam_pulang is not null then
      raise exception
        'Absen masuk tidak bisa diulang setelah absen pulang; ulangi absen pulangnya dulu'
        using errcode = 'check_violation';
    end if;
    if a.ulang_masuk >= 3 then
      raise exception 'Batas absen ulang masuk hari ini (3 kali) sudah habis'
        using errcode = 'check_violation';
    end if;

    -- Status 'alpa' selama menunggu absen berikutnya: Beranda dan rekap
    -- membacanya sebagai "belum absen", bukan "hadir tanpa jam".
    update attendance
       set jam_masuk = null,
           foto_masuk_url = null,
           lat_masuk = null,
           lng_masuk = null,
           jarak_masuk_m = null,
           lokasi_valid = false,
           terlambat = false,
           menit_telat = 0,
           status = 'alpa',
           ulang_masuk = a.ulang_masuk + 1,
           ulang_terakhir = now()
     where id = a.id;

    return query select a.jam_masuk, 3 - a.ulang_masuk - 1;
    return;
  end if;

  if a.jam_pulang is null then
    raise exception 'Absen pulang belum tercatat; langsung absen saja'
      using errcode = 'check_violation';
  end if;
  if a.ulang_pulang >= 3 then
    raise exception 'Batas absen ulang pulang hari ini (3 kali) sudah habis'
      using errcode = 'check_violation';
  end if;

  update attendance
     set jam_pulang = null,
         foto_pulang_url = null,
         lat_pulang = null,
         lng_pulang = null,
         ulang_pulang = a.ulang_pulang + 1,
         ulang_terakhir = now()
   where id = a.id;

  return query select a.jam_pulang, 3 - a.ulang_pulang - 1;
end;
$$;

comment on function absen_ulang(text) is
  'Kosongkan absen masuk/pulang hari ini milik sendiri supaya bisa diabsen lagi; maksimal 3 kali per tahap.';

-- ---------------------------------------------------------------------
-- Rekap rincian ikut menyebut berapa kali absen diulang, supaya atasan
-- tahu catatan yang dilihatnya bukan catatan pertama hari itu.
-- ---------------------------------------------------------------------
drop function if exists rekap_absensi(date, date, uuid);

create function rekap_absensi(
  p_dari date,
  p_sampai date,
  p_user uuid default null
)
returns table (
  user_id       uuid,
  nama          text,
  unit_nama     text,
  tanggal       date,
  status        status_kehadiran,
  jam_masuk     timestamptz,
  jam_pulang    timestamptz,
  terlambat     boolean,
  menit_telat   integer,
  izin_jenis    jenis_izin,
  izin_mulai    time,
  izin_selesai  time,
  lokasi_valid  boolean,
  jarak_masuk_m numeric,
  alasan        text,
  persetujuan   status_persetujuan,
  alasan_keputusan text,
  sudah_lapor   boolean,
  ulang_masuk   integer,
  ulang_pulang  integer
)
language sql
stable
as $$
  select
    a.user_id,
    u.nama,
    coalesce(split_part(un.nama, ' (', 1), 'Manajemen'),
    a.tanggal,
    a.status,
    a.jam_masuk,
    a.jam_pulang,
    a.terlambat,
    a.menit_telat,
    a.izin_jenis,
    a.izin_mulai,
    a.izin_selesai,
    a.lokasi_valid,
    a.jarak_masuk_m,
    a.alasan,
    a.persetujuan,
    a.alasan_keputusan,
    sudah_lapor_harian(a.user_id, a.tanggal),
    a.ulang_masuk::int,
    a.ulang_pulang::int
  from attendance a
  join users u on u.id = a.user_id
  left join units un on un.id = u.unit_id
  where a.tanggal between p_dari and p_sampai
    and (p_user is null or a.user_id = p_user)
  order by a.tanggal desc, u.nama;
$$;

comment on function rekap_absensi(date, date, uuid) is
  'Rekap kehadiran untuk ekspor Excel; p_user null = seluruh tim yang terlihat. Menyebut berapa kali absen diulang (0171).';
