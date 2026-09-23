-- =====================================================================
-- K-Space V2 — Penyaring "di bawah minimum" pada rekap
--
-- Layar sudah bisa menyembunyikan akun/orang yang tidak pernah kurang,
-- tapi penyaringan itu terjadi SETELAH seluruh baris dikirim. Untuk
-- rekap satu bulan lintas unit, yang dikirim justru didominasi baris
-- yang akan langsung dibuang.
--
-- Penyaringnya dipasang sebagai parameter, bukan fungsi terpisah:
-- pertanyaannya sama persis, hanya sebagian jawabannya yang disembunyikan.
-- Dua fungsi berarti dua tempat yang harus ikut berubah setiap kali
-- rumusnya disentuh.
--
-- Bentuk parameter fungsinya berubah, jadi yang lama dibuang lebih dulu:
-- membiarkan keduanya hidup membuat panggilan dua argumen jadi ambigu.
-- =====================================================================

drop function if exists rekap_minimum_akun(date, date);
drop function if exists rekap_minimum_orang(date, date);

create function rekap_minimum_akun(
  p_dari date,
  p_sampai date,
  -- Default false supaya pemanggil yang tidak peduli tetap menerima
  -- rekap utuh; yang dihilangkan hanya akun yang SELALU memenuhi.
  p_hanya_kurang boolean default false
)
returns table (
  account_id      uuid,
  username        text,
  minimum         integer,
  laporan         integer,
  terpenuhi       integer,
  rasio           numeric,
  kurang_terdalam integer
)
language sql
stable
set search_path = public
as $$
  select
    r.account_id,
    r.akun_username,
    r.minimum_unggahan,
    count(*)::int,
    count(*) filter (where r.jumlah_upload >= r.minimum_unggahan)::int,
    round(
      count(*) filter (where r.jumlah_upload >= r.minimum_unggahan) * 100.0
        / count(*),
      1
    ),
    greatest(0, max(r.minimum_unggahan - r.jumlah_upload))::int
  from riwayat_laporan_minimum r
  where r.tanggal between p_dari and p_sampai
    and r.minimum_unggahan is not null
    and r.jumlah_upload is not null
  group by r.account_id, r.akun_username, r.minimum_unggahan
  -- Disaring di HAVING, bukan di WHERE: yang dinilai "pernah kurang"
  -- adalah akunnya sepanjang rentang, bukan barisnya satu per satu.
  -- Menyaringnya per baris akan membuat penyebutnya ikut menyusut dan
  -- setiap akun terbaca 0% patuh.
  having not p_hanya_kurang
      or count(*) filter (where r.jumlah_upload < r.minimum_unggahan) > 0
  order by 6, r.akun_username;
$$;

comment on function rekap_minimum_akun(date, date, boolean) is
  'Rekap terpenuhi/kurang per akun dari laporan yang masuk; padanan rekapMinimumPerAkun.';

create function rekap_minimum_orang(
  p_dari date,
  p_sampai date,
  p_hanya_kurang boolean default false
)
returns table (
  pelapor_nama    text,
  minimum         integer,
  akun            integer,
  laporan         integer,
  terpenuhi       integer,
  rasio           numeric,
  kurang_terdalam integer
)
language sql
stable
set search_path = public
as $$
  select
    r.pelapor_nama,
    case
      when count(distinct r.minimum_unggahan) = 1
        then min(r.minimum_unggahan)::int
      else null
    end,
    count(distinct r.account_id)::int,
    count(*)::int,
    count(*) filter (where r.jumlah_upload >= r.minimum_unggahan)::int,
    round(
      count(*) filter (where r.jumlah_upload >= r.minimum_unggahan) * 100.0
        / count(*),
      1
    ),
    greatest(0, max(r.minimum_unggahan - r.jumlah_upload))::int
  from riwayat_laporan_minimum r
  where r.tanggal between p_dari and p_sampai
    and r.minimum_unggahan is not null
    and r.jumlah_upload is not null
    and r.pelapor_nama is not null
  group by r.pelapor_nama
  having not p_hanya_kurang
      or count(*) filter (where r.jumlah_upload < r.minimum_unggahan) > 0
  order by 6, r.pelapor_nama;
$$;

comment on function rekap_minimum_orang(date, date, boolean) is
  'Rekap terpenuhi/kurang per orang dari laporan yang masuk; padanan rekapMinimumPerOrang.';
