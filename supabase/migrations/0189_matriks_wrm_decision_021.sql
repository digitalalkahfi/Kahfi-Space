-- =====================================================================
-- K-Space V2 — Matriks WRM mengikuti DECISION-021 di file GRD
--
-- Sheet "Target & Kurva WRM" file GRD Oktober 2026 menetapkan:
--
--   Hasil HIJAU + kegiatan HIJAU = LANJUT
--   Hasil HIJAU + kegiatan MERAH = ALARM
--   Hasil MERAH + kegiatan HIJAU = SABAR  (faktor luar: tanggal tua,
--                                          menunggu Pay Day)
--   Hasil MERAH + kegiatan MERAH = UBAH CARA
--   Pemicu UBAH CARA: merah 2 pekan berturut-turut.
--   HIJAU = aktual ≥ target.
--
-- Aplikasi sebelumnya (0025) menukar SABAR dan ALARM, memakai ambang
-- hasil 95% dan KRI 90%, dan tidak menegakkan pemicu dua pekan merah.
-- File GRD adalah sumber kebenarannya, jadi aplikasi yang menyesuaikan
-- (matriks keputusan di sheet Target & Kurva WRM, docs/GRD-OKTOBER-2026.xlsx).
-- =====================================================================

create or replace function keputusan_wrm(p_hasil warna_wrm, p_kri warna_wrm)
returns keputusan_wrm
language sql
immutable
as $$
  select case
    when p_hasil = 'hijau' and p_kri = 'hijau' then 'LANJUT'::keputusan_wrm
    when p_hasil = 'hijau' and p_kri = 'merah' then 'ALARM'::keputusan_wrm
    when p_hasil = 'merah' and p_kri = 'hijau' then 'SABAR'::keputusan_wrm
    else 'UBAH CARA'::keputusan_wrm
  end;
$$;

comment on function keputusan_wrm(warna_wrm, warna_wrm) is
  'Matriks WRM DECISION-021: hijau/hijau LANJUT, hijau/merah ALARM, merah/hijau SABAR, merah/merah UBAH CARA (0189).';

-- Hasil merah dua pekan berturut-turut selalu UBAH CARA, apa pun
-- kegiatannya: "gagal → ubah cara, bukan ganti target".
create or replace function lengkapi_laporan_mingguan()
returns trigger
language plpgsql
as $$
declare
  sebelumnya weekly_reports;
begin
  select * into sebelumnya
  from weekly_reports w
  where w.periode = new.periode - 7
    and w.unit_id is not distinct from new.unit_id
    and w.user_id is not distinct from new.user_id;

  new.merah_beruntun := case
    when new.status_hasil = 'merah'
      then coalesce(sebelumnya.merah_beruntun, 0) + 1
    else 0
  end;

  new.keputusan := case
    when new.merah_beruntun >= 2 then 'UBAH CARA'::keputusan_wrm
    else keputusan_wrm(new.status_hasil, new.status_kri)
  end;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- HIJAU = aktual ≥ target (100%), untuk hasil maupun kegiatan.
-- ---------------------------------------------------------------------
create or replace function status_wrm(p_tanggal date)
returns table (
  rasio_hasil  numeric,
  rasio_kri    numeric,
  status_hasil warna_wrm,
  status_kri   warna_wrm,
  keputusan    keputusan_wrm
)
language sql
stable
as $$
  with pekan as (
    select awal_pekan(p_tanggal) as mulai, p_tanggal as sampai
  ),
  hasil as (
    select
      coalesce(sum(r.gmv), 0) as gmv,
      coalesce((
        select sum(t.target) from target_harian_unit(p_tanggal) t
      ), 0) * (select (sampai - mulai + 1) from pekan) as target
    from daily_reports r, pekan
    where r.tanggal between pekan.mulai and pekan.sampai
  ),
  kri as (
    select coalesce(avg(p.rasio), 0) as rasio from papan_lead_measure(p_tanggal) p
  ),
  warna as (
    select
      hasil.gmv, hasil.target, kri.rasio,
      case when hasil.target > 0 and hasil.gmv >= hasil.target
        then 'hijau'::warna_wrm else 'merah'::warna_wrm end as w_hasil,
      case when kri.rasio >= 100
        then 'hijau'::warna_wrm else 'merah'::warna_wrm end as w_kri
    from hasil, kri
  )
  select
    case when target > 0 then round(gmv / target * 100, 1) else 0 end,
    round(rasio, 1),
    w_hasil,
    w_kri,
    keputusan_wrm(w_hasil, w_kri)
  from warna;
$$;

create or replace function hitung_laporan_mingguan(
  p_pekan date,
  p_sampai date default current_date
)
returns table (
  unit_id      uuid,
  unit_kode    text,
  target       numeric,
  gmv          numeric,
  rasio_hasil  numeric,
  rasio_kri    numeric,
  status_hasil warna_wrm,
  status_kri   warna_wrm
)
language sql
stable
as $$
  with batas as (
    select least(p_sampai, p_pekan + 6) as sampai
  ),
  baris as (
    select
      u.id, u.kode,
      coalesce(t.target, 0) as target,
      coalesce(g.gmv, 0) as gmv,
      coalesce(k.rasio, 0) as rasio_kri
    from units u
    cross join batas
    left join target_pekan_unit(p_pekan, batas.sampai) t on t.unit_id = u.id
    left join lateral (
      select sum(r.gmv) gmv
      from daily_reports r
      left join accounts a on a.id = r.account_id
      where coalesce(r.unit_id, a.unit_id) = u.id
        and r.tanggal between p_pekan and batas.sampai
    ) g on true
    left join lateral (
      select avg(p.rasio) rasio
      from papan_lead_measure(p_pekan) p
      where p.unit_kode = u.kode
    ) k on true
  )
  select
    id, kode, target, gmv,
    case when target > 0 then round(gmv / target * 100, 1) else 0 end,
    round(rasio_kri, 1),
    case when target > 0 and gmv >= target
      then 'hijau'::warna_wrm else 'merah'::warna_wrm end,
    case when rasio_kri >= 100
      then 'hijau'::warna_wrm else 'merah'::warna_wrm end
  from baris;
$$;
