-- =====================================================================
-- K-Space V2 — Rekap kehadiran per orang & kewajiban absen
--
-- Dua keputusan yang sebelumnya tidak tertulis di mana pun:
--   1. Yang wajib absen hanya Leader ke bawah. CEO, Manager, dan
--      Finance memantau, bukan dipantau.
--   2. Hari kerja adalah Senin–Sabtu di luar libur perusahaan yang
--      dicatat di kalender (agenda berjenis 'libur' tanpa unit).
--
-- Rekap lama (`rekap_absensi`) hanya membaca baris absensi yang ada,
-- sehingga orang yang tidak absen sama sekali justru tidak pernah
-- muncul — padahal dialah yang paling perlu terlihat. Fungsi baru
-- melengkapi hari kerja yang kosong bagi setiap orang yang wajib absen.
-- =====================================================================

create or replace function peran_wajib_absen(p_role peran_pengguna)
returns boolean
language sql
immutable
as $$
  select p_role in ('Leader', 'Co-Leader', 'Staff');
$$;

comment on function peran_wajib_absen(peran_pengguna) is
  'Leader ke bawah wajib absen; CEO, Manager, dan Finance tidak.';

-- Agenda terbaca semua pengguna masuk (policy agenda_baca), jadi fungsi
-- ini cukup berjalan sebagai pemanggilnya.
create or replace function hari_kerja_absensi(p_tanggal date)
returns boolean
language sql
stable
as $$
  select extract(isodow from p_tanggal) <> 7
     and not exists (
       select 1 from agenda g
       where g.jenis = 'libur'
         and g.unit_id is null
         and g.tanggal = p_tanggal
     );
$$;

comment on function hari_kerja_absensi(date) is
  'Senin–Sabtu di luar libur perusahaan di kalender; hari yang ditagih absensinya.';

-- ---------------------------------------------------------------------
-- Satu baris per orang per hari kerja, termasuk hari tanpa catatan
-- (status null). Cakupannya sama dengan RLS attendance: `boleh_orang`.
-- ---------------------------------------------------------------------
create or replace function rekap_kehadiran_orang(
  p_dari date,
  p_sampai date,
  p_user uuid default null
)
returns table (
  user_id      uuid,
  nama         text,
  unit_nama    text,
  role         peran_pengguna,
  wajib_absen  boolean,
  tanggal      date,
  status       status_kehadiran,
  jam_masuk    timestamptz,
  jam_pulang   timestamptz,
  menit_telat  integer,
  izin_jenis   jenis_izin,
  izin_selesai time,
  lokasi_valid boolean,
  alasan       text,
  persetujuan  status_persetujuan
)
language sql
stable
as $$
  with orang as (
    select
      u.id,
      u.nama,
      coalesce(split_part(un.nama, ' (', 1), 'Manajemen') as unit_nama,
      u.role,
      peran_wajib_absen(u.role) as wajib,
      -- Hari kerja seseorang dihitung sejak ia terdaftar atau absen
      -- pertama kali, mana yang lebih dulu: orang pindahan dari K-Space
      -- lama terdaftar jauh setelah absen pertamanya.
      least(
        (u.created_at at time zone 'Asia/Jakarta')::date,
        (select min(a.tanggal) from attendance a where a.user_id = u.id)
      ) as mulai
    from users u
    left join units un on un.id = u.unit_id
    where u.status = 'aktif'
      and boleh_orang(u.id)
      and (p_user is null or u.id = p_user)
  ),
  hari as (
    -- Hari yang belum datang tidak bisa ditagih.
    select d::date as tanggal
    from generate_series(
      p_dari,
      least(p_sampai, (now() at time zone 'Asia/Jakarta')::date),
      interval '1 day'
    ) d
    where hari_kerja_absensi(d::date)
  ),
  hari_orang as (
    -- Hari kerja yang seharusnya diisi: hanya bagi yang wajib absen.
    select o.id as user_id, h.tanggal
    from orang o
    cross join hari h
    where o.wajib and h.tanggal >= o.mulai
    union
    -- Hari yang benar-benar tercatat, siapa pun orangnya: absen
    -- sukarela CEO tetap tampil, hanya tidak pernah ditagih.
    select a.user_id, a.tanggal
    from attendance a
    join orang o on o.id = a.user_id
    where a.tanggal between p_dari and p_sampai
  )
  select
    o.id,
    o.nama,
    o.unit_nama,
    o.role,
    o.wajib,
    ho.tanggal,
    a.status,
    a.jam_masuk,
    a.jam_pulang,
    coalesce(a.menit_telat, 0),
    a.izin_jenis,
    a.izin_selesai,
    coalesce(a.lokasi_valid, false),
    coalesce(a.alasan, ''),
    a.persetujuan
  from hari_orang ho
  join orang o on o.id = ho.user_id
  left join attendance a on a.user_id = ho.user_id and a.tanggal = ho.tanggal
  order by o.nama, ho.tanggal desc;
$$;

comment on function rekap_kehadiran_orang(date, date, uuid) is
  'Rekap kehadiran per orang per hari kerja; status null = tidak ada catatan. p_user null = seluruh orang yang terlihat.';

-- ---------------------------------------------------------------------
-- Beranda: siapa yang wajib absen ikut disebut, supaya CEO tidak muncul
-- sebagai "belum absen" setiap pagi. Bentuk kembaliannya bertambah satu
-- kolom, jadi fungsi lama harus dilepas dulu.
-- ---------------------------------------------------------------------
drop function if exists status_tim_harian(date);

create function status_tim_harian(p_tanggal date)
returns table (
  user_id           uuid,
  nama              text,
  inisial           text,
  unit_nama         text,
  status            status_kehadiran,
  jam_masuk         timestamptz,
  terlambat         boolean,
  menit_telat       integer,
  izin_jenis        jenis_izin,
  izin_selesai      time,
  lokasi_valid      boolean,
  persetujuan       status_persetujuan,
  wajib_lapor       boolean,
  sudah_lapor       boolean,
  unggahan_hari_ini integer,
  minimum_unggahan  integer,
  wajib_absen       boolean
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
    sudah_lapor_harian(u.id, p_tanggal),
    (
      select sum(r.jumlah_upload)::int
      from daily_reports r
      join accounts ak on ak.id = r.account_id
      where ak.pic_user_id = u.id
        and r.tanggal = p_tanggal
        and r.jumlah_upload is not null
    ),
    (
      select sum(batas_minimum(ak.level))::int
      from accounts ak
      where ak.pic_user_id = u.id
        and ak.status = 'aktif'
        and ak.level is not null
    ),
    peran_wajib_absen(u.role)
  from users u
  left join units un on un.id = u.unit_id
  left join attendance a on a.user_id = u.id and a.tanggal = p_tanggal
  where u.status = 'aktif'
  order by u.nama;
$$;

comment on function status_tim_harian(date) is
  'Dipakai Beranda: siapa sudah absen, berapa menit telat, siapa belum lapor, unggahannya, dan siapa yang memang wajib absen.';
