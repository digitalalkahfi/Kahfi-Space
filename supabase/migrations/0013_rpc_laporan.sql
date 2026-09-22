-- =====================================================================
-- K-Space V2 — RPC perbaikan laporan
--
-- Trigger jejak revisi membaca alasan dari setelan sesi `app.alasan_revisi`.
-- Lewat PostgREST setiap panggilan berjalan di transaksi sendiri, jadi
-- setelan itu harus ditanam di dalam satu fungsi bersama update-nya.
-- Fungsi ini juga memaksa alasan diisi — tidak ada jalan mengubah angka
-- GMV tanpa meninggalkan jejak.
-- =====================================================================

create or replace function perbaiki_laporan_harian(
  p_report_id uuid,
  p_gmv numeric,
  p_alasan text,
  p_catatan text default null
)
returns daily_reports
language plpgsql
security invoker  -- RLS tetap berlaku: hanya pemilik laporan / CEO / Manager
set search_path = public
as $$
declare
  hasil daily_reports;
begin
  if length(btrim(coalesce(p_alasan, ''))) < 10 then
    raise exception 'Alasan perbaikan minimal 10 karakter'
      using errcode = 'check_violation';
  end if;

  if p_gmv is null or p_gmv < 0 then
    raise exception 'Nilai GMV tidak sah' using errcode = 'check_violation';
  end if;

  perform set_config('app.alasan_revisi', btrim(p_alasan), true);

  update daily_reports
     set gmv = p_gmv,
         catatan = coalesce(p_catatan, catatan)
   where id = p_report_id
  returning * into hasil;

  if hasil is null then
    raise exception 'Laporan tidak ditemukan atau bukan milikmu'
      using errcode = 'insufficient_privilege';
  end if;

  return hasil;
end;
$$;

comment on function perbaiki_laporan_harian(uuid, numeric, text, text) is
  'Satu-satunya jalan mengubah angka GMV; alasan wajib dan ikut tercatat.';
