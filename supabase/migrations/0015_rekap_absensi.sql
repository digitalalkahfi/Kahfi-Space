-- =====================================================================
-- K-Space V2 — Rekap absensi untuk ekspor Excel (PRD §3 Absensi)
--
-- Satu fungsi melayani dua kebutuhan: rekap pribadi dan rekap tim.
-- RLS yang menentukan baris mana yang ikut, jadi seorang Staff yang
-- meminta rekap tim tetap hanya mendapat miliknya sendiri.
-- =====================================================================

create or replace function rekap_absensi(
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
  lokasi_valid  boolean,
  jarak_masuk_m numeric,
  alasan        text,
  persetujuan   status_persetujuan,
  sudah_lapor   boolean
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
    a.lokasi_valid,
    a.jarak_masuk_m,
    a.alasan,
    a.persetujuan,
    sudah_lapor_harian(a.user_id, a.tanggal)
  from attendance a
  join users u on u.id = a.user_id
  left join units un on un.id = u.unit_id
  where a.tanggal between p_dari and p_sampai
    and (p_user is null or a.user_id = p_user)
  order by a.tanggal desc, u.nama;
$$;

comment on function rekap_absensi(date, date, uuid) is
  'Rekap kehadiran untuk ekspor Excel; p_user null = seluruh tim yang terlihat.';
