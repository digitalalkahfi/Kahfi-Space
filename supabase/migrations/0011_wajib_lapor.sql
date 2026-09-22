-- =====================================================================
-- K-Space V2 — Siapa yang wajib mengirim laporan harian
--
-- Sebelumnya "Laporan GMV 7/25" membandingkan pelapor dengan SELURUH tim,
-- padahal sebagian besar anggota memang tidak punya sasaran laporan.
-- Mengikuti PRD §2 — "Affiliator mengisi per akun, oleh PIC akun; MCN dan
-- TAP mengisi per unit, oleh Leader". Jadi yang wajib lapor hanya:
--   · PIC akun affiliator yang aktif          → lapor per akun
--   · Leader unit yang tidak punya akun aktif → lapor per unit
-- Co-leader adalah cadangan, bukan penanggung jawab laporan.
-- =====================================================================

create or replace function wajib_lapor_harian(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from accounts a
      where a.status = 'aktif' and a.pic_user_id = p_user
    )
    or exists (
      -- Unit yang tidak punya akun aktif melapor di tingkat unit,
      -- dan itu tugas Leader/Co-Leader unit tersebut.
      select 1
      from users u
      join units un on un.id = u.unit_id
      where u.id = p_user
        and u.role = 'Leader' 
        and not exists (
          select 1 from accounts a
          where a.unit_id = un.id and a.status = 'aktif'
        )
    );
$$;

comment on function wajib_lapor_harian(uuid) is
  'Penyebut metrik "Laporan GMV" — hanya orang yang memang punya sasaran lapor.';

-- Ringkasan status tim dibangun ulang dengan kolom wajib_lapor.
-- Bentuk kembaliannya berubah, jadi fungsi lama harus dilepas dulu.
drop function if exists status_tim_harian(date);

create function status_tim_harian(p_tanggal date)
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
