-- =====================================================================
-- K-Space V2 — KPI tiket dihitung per tanggal WIB
--
-- `realisasi_kpi` (0173) memasukkan tiket ke periode menurut
-- `tenggat::date`. `tenggat` bertipe timestamptz dan sesi basis data
-- berjalan dalam UTC, jadi tanggalnya tanggal UTC: tiket bertenggat
-- 00.00–06.59 WIB terhitung di hari sebelumnya — tenggat 1 Oktober
-- 06.00 WIB ikut periode September. Tanggal lain di aplikasi (papan
-- tugas, kalender, pengingat) sudah tanggal WIB.
--
-- Hanya cabang `tiket` yang berubah; isi fungsi lainnya sama persis
-- dengan 0173. Bulan yang sudah dikunci tidak ikut berubah: nilainya
-- tersimpan di `kpi_snapshots` (0024, 0039) dan scorecard membacanya
-- dari sana.
--
-- Aman dijalankan ulang.
-- =====================================================================

create or replace function realisasi_kpi(
  p_user uuid,
  p_sumber sumber_kpi,
  p_bulan date,
  p_sampai date default current_date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with rentang as (
    select p_bulan as dari,
           least(p_sampai, (p_bulan + interval '1 month - 1 day')::date) as sampai
  )
  select case
    when not boleh_orang(p_user) then null

    when p_sumber = 'gmv' then realisasi_gmv_kpi(p_user, p_bulan, p_sampai)

    when p_sumber = 'lead_measure' then realisasi_lead_measure_kpi(p_user, p_bulan, p_sampai)

    when p_sumber = 'absensi' then (
      select case when count(*) > 0
        then count(*) filter (where status = 'hadir')::numeric / count(*) * 100
        else null end
      from attendance
      where user_id = p_user
        and tanggal between (select dari from rentang) and (select sampai from rentang)
    )

    -- Tanggal tenggat (atau tanggal dibuat, untuk tiket lama tanpa
    -- tenggat) dibaca di WIB, bukan dipotong dari waktu UTC-nya.
    when p_sumber = 'tiket' then (
      select case when count(*) > 0
        then count(*) filter (where status = 'selesai')::numeric / count(*) * 100
        else null end
      from tasks
      where penerima_id = p_user
        and tipe <> 'pribadi'
        and coalesce((tenggat at time zone 'Asia/Jakarta')::date,
                     (created_at at time zone 'Asia/Jakarta')::date)
            between (select dari from rentang) and (select sampai from rentang)
    )

    else null
  end;
$$;

comment on function realisasi_kpi(uuid, sumber_kpi, date, date) is
  'Realisasi satu indikator KPI seseorang pada rentang bulan; tiket dipetakan ke periode menurut tanggal WIB (0173, 0185).';

-- ---------------------------------------------------------------------
-- Rollback (manual): jalankan ulang definisi realisasi_kpi dari 0173.
-- ---------------------------------------------------------------------
