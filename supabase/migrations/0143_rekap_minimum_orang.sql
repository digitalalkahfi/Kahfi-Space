-- =====================================================================
-- K-Space V2 — Rekap status terpenuhi per ORANG
--
-- Padanan SQL dari `rekapMinimumPerOrang`. Satu orang bisa memegang
-- beberapa akun, dan yang ditegur Leader adalah orangnya — jadi rekap
-- per akun saja tidak cukup untuk menjawab "siapa".
--
-- `minimum` sengaja null bila orang itu memegang akun dengan level
-- berbeda: tidak ada satu angka batas yang jujur untuk disebut, dan
-- menyebut salah satunya akan terbaca sebagai batas seluruh akunnya.
-- Layar menampilkan "Beda level" untuk keadaan itu.
--
-- Seperti migrasi 0142, yang dihitung hanya HARI YANG DILAPORKAN.
-- =====================================================================

create or replace function rekap_minimum_orang(
  p_dari date,
  p_sampai date
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
  order by 6, r.pelapor_nama;
$$;

comment on function rekap_minimum_orang(date, date) is
  'Rekap terpenuhi/kurang per orang dari laporan yang masuk; padanan rekapMinimumPerOrang.';
