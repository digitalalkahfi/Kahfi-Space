-- =====================================================================
-- K-Space V2 — Logika tenggat & penyaringan tugas di sisi database
--
-- Pengelompokan tenggat sebelumnya hanya ada di komponen. Dipindahkan ke
-- sini supaya daftar panjang bisa disaring dan dihitung tanpa menarik
-- seluruh baris ke browser — dan supaya UI tidak jadi satu-satunya tempat
-- aturannya hidup.
-- =====================================================================

create type kelompok_tenggat as enum
  ('terlambat', 'hari_ini', 'besok', 'nanti', 'tanpa_tenggat');

create or replace function kelompok_tenggat_dari(
  p_tenggat timestamptz,
  p_acuan date
)
returns kelompok_tenggat
language sql
immutable
as $$
  select case
    when p_tenggat is null then 'tanpa_tenggat'::kelompok_tenggat
    when (p_tenggat at time zone 'Asia/Jakarta')::date < p_acuan
      then 'terlambat'::kelompok_tenggat
    when (p_tenggat at time zone 'Asia/Jakarta')::date = p_acuan
      then 'hari_ini'::kelompok_tenggat
    when (p_tenggat at time zone 'Asia/Jakarta')::date = p_acuan + 1
      then 'besok'::kelompok_tenggat
    else 'nanti'::kelompok_tenggat
  end;
$$;

/*
 * Daftar tugas yang sudah tersaring & terurut.
 * `p_saringan`: semua | saya | tiket | komitmen | qc | selesai
 */
create or replace function daftar_tugas(
  p_acuan date,
  p_saringan text default 'semua',
  p_batas int default 100
)
returns table (
  id          uuid,
  tipe        tipe_tugas,
  judul       text,
  deskripsi   text,
  konteks     text,
  tenggat     timestamptz,
  kelompok    kelompok_tenggat,
  prioritas   prioritas_tugas,
  status      status_tugas,
  qc_status   status_qc,
  qc_note     text,
  hasil_kerja text,
  penerima_id uuid,
  pembuat_id  uuid,
  penerima    text,
  pembuat     text,
  goal_judul  text,
  goal_periode text,
  selesai_at  timestamptz
)
language sql
stable
as $$
  select
    t.id, t.tipe, t.judul, t.deskripsi, t.konteks, t.tenggat,
    kelompok_tenggat_dari(t.tenggat, p_acuan),
    t.prioritas, t.status, t.qc_status, t.qc_note, t.hasil_kerja,
    t.penerima_id, t.pembuat_id,
    pn.nama, pb.nama, g.judul, g.periode, t.selesai_at
  from tasks t
  left join users pn on pn.id = t.penerima_id
  left join users pb on pb.id = t.pembuat_id
  left join goals g on g.id = t.goal_id
  where t.status <> 'dibatalkan'
    and case p_saringan
      when 'saya'     then t.tipe = 'pribadi' and t.status <> 'selesai'
      when 'tiket'    then t.tipe = 'tiket' and t.status <> 'selesai'
      when 'komitmen' then t.tipe = 'komitmen_mingguan' and t.status <> 'selesai'
      when 'qc'       then t.status = 'menunggu_qc'
      when 'selesai'  then t.status = 'selesai'
      else t.status <> 'selesai'
    end
  order by
    -- Yang lewat tenggat naik paling atas, lalu prioritas, lalu tenggat.
    (kelompok_tenggat_dari(t.tenggat, p_acuan) = 'terlambat') desc,
    case t.prioritas when 'tinggi' then 0 when 'sedang' then 1 else 2 end,
    t.tenggat nulls last,
    t.created_at
  limit greatest(1, least(p_batas, 500));
$$;

/** Jumlah per kelompok untuk lencana penyaring. */
create or replace function hitung_tugas(p_acuan date)
returns table (
  semua     int,
  saya      int,
  tiket     int,
  komitmen  int,
  qc        int,
  selesai   int,
  terlambat int
)
language sql
stable
as $$
  select
    count(*) filter (where status not in ('selesai', 'dibatalkan'))::int,
    count(*) filter (where tipe = 'pribadi' and status not in ('selesai','dibatalkan'))::int,
    count(*) filter (where tipe = 'tiket' and status not in ('selesai','dibatalkan'))::int,
    count(*) filter (where tipe = 'komitmen_mingguan' and status not in ('selesai','dibatalkan'))::int,
    count(*) filter (where status = 'menunggu_qc')::int,
    count(*) filter (where status = 'selesai')::int,
    count(*) filter (
      where status not in ('selesai', 'dibatalkan')
        and kelompok_tenggat_dari(tenggat, p_acuan) = 'terlambat'
    )::int
  from tasks;
$$;
