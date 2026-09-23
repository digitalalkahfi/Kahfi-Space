-- =====================================================================
-- K-Space V2 — Jam efektif masuk sebagai fungsi tersendiri
--
-- Aturannya cuma satu kalimat — "yang lebih akhir antara batas jam kerja
-- dan jam selesai izin yang sudah disetujui" — tetapi ia menentukan
-- apakah seseorang tercatat telat. Selama ia hanya hidup di dalam
-- `hitung_absensi`, tidak ada tempat untuk menanyakannya: rekap, ekspor,
-- dan layar kehadiran hanya bisa membaca hasilnya, tidak bisa menjelaskan
-- dari mana angkanya.
-- =====================================================================

create or replace function jam_efektif_masuk(
  p_tanggal date,
  p_izin_jenis jenis_izin default null,
  p_izin_selesai time default null,
  p_persetujuan status_persetujuan default null
)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select greatest(
    (p_tanggal + p.jam_masuk) at time zone 'Asia/Jakarta'
      + make_interval(mins => p.toleransi_menit),
    -- Izin yang masih menunggu keputusan tidak menggeser apa pun; kalau
    -- tidak, siapa pun bisa menghapus telatnya sendiri hanya dengan
    -- mengajukan izin dan membiarkannya menggantung.
    case
      when p_izin_jenis = 'jam'
       and p_persetujuan = 'disetujui'
       and p_izin_selesai is not null
      then (p_tanggal + p_izin_selesai) at time zone 'Asia/Jakarta'
    end
  )
  from pengaturan p
  where p.id;
$$;

comment on function jam_efektif_masuk(date, jenis_izin, time, status_persetujuan) is
  'Batas masuk yang berlaku hari itu, sesudah memperhitungkan izin berjam yang disetujui.';

create or replace function hitung_absensi()
returns trigger
language plpgsql
as $$
declare
  p record;
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

  efektif := jam_efektif_masuk(
    new.tanggal, new.izin_jenis, new.izin_selesai, new.persetujuan
  );

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
-- Rekap & ekspor ikut membawa menit telat dan jam izin yang disetujui,
-- supaya "telat 20 menit" bisa dibaca bersama sebabnya.
-- ---------------------------------------------------------------------
drop function if exists rekap_absensi(date, date, uuid);

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
  menit_telat   integer,
  izin_jenis    jenis_izin,
  izin_mulai    time,
  izin_selesai  time,
  lokasi_valid  boolean,
  jarak_masuk_m numeric,
  alasan        text,
  persetujuan   status_persetujuan,
  alasan_keputusan text,
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
    a.menit_telat,
    a.izin_jenis,
    a.izin_mulai,
    a.izin_selesai,
    a.lokasi_valid,
    a.jarak_masuk_m,
    a.alasan,
    a.persetujuan,
    a.alasan_keputusan,
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
