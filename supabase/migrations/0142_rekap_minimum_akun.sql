-- =====================================================================
-- K-Space V2 — Rekap status terpenuhi per akun
--
-- Padanan SQL dari `rekapMinimumPerAkun` di `src/lib/rekap-minimum.ts`.
-- Layar menghitungnya dari baris yang sedang ditampilkan — cukup untuk
-- 120 baris riwayat, tapi tidak untuk rekap sebulan penuh seluruh unit.
--
-- Penting: yang dihitung di sini HANYA HARI YANG DILAPORKAN, bukan
-- seluruh hari kerja. Itu pertanyaan yang berbeda dari
-- `kepatuhan_minimum_akun` (migrasi 0138), yang tahu absensi dan
-- menghukum hari kerja yang sunyi. Keduanya sengaja ada:
--   - "dari laporan yang masuk, berapa yang memenuhi?" → fungsi ini
--   - "dari hari kerjanya, berapa yang memenuhi?"      → migrasi 0138
-- Menggabungkannya jadi satu angka akan menjawab dua pertanyaan dengan
-- satu jawaban yang salah untuk keduanya.
-- =====================================================================

create or replace function rekap_minimum_akun(
  p_dari date,
  p_sampai date
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
    -- Kekurangan terdalam dalam satu hari; nol bila tidak pernah kurang.
    greatest(0, max(r.minimum_unggahan - r.jumlah_upload))::int
  from riwayat_laporan_minimum r
  where r.tanggal between p_dari and p_sampai
    -- Laporan tanpa kolom unggahan (MCN & TAP) dan akun tanpa level
    -- tidak ikut sama sekali: tidak ada standar yang bisa dilanggar.
    and r.minimum_unggahan is not null
    and r.jumlah_upload is not null
  group by r.account_id, r.akun_username, r.minimum_unggahan
  -- Yang paling bermasalah lebih dulu: yang dicari Leader saat membuka
  -- rekap adalah akun yang perlu ditindaklanjuti, bukan yang sudah aman.
  order by 6, r.akun_username;
$$;

comment on function rekap_minimum_akun(date, date) is
  'Rekap terpenuhi/kurang per akun dari laporan yang masuk; padanan rekapMinimumPerAkun.';
