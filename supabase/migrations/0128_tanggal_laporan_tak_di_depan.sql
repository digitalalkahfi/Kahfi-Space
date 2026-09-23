-- =====================================================================
-- K-Space V2 — Laporan harian tidak boleh bertanggal masa depan
--
-- Tanggal laporan selama ini datang apa adanya dari pemanggil. Melapor
-- mundur memang wajar (GMV kemarin baru sempat dicatat pagi ini), tetapi
-- melapor MAJU tidak: satu baris bertanggal bulan depan langsung masuk
-- rekap dan KPI sebagai realisasi yang belum pernah terjadi.
--
-- Seed dan skrip migrasi berjalan tanpa `auth.uid()`; keduanya memang
-- perlu menulis tanggal apa pun, jadi hanya kiriman pengguna yang dijaga.
-- =====================================================================

create or replace function jaga_tanggal_laporan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.tanggal > (now() at time zone 'Asia/Jakarta')::date
  then
    raise exception 'Laporan tidak bisa bertanggal masa depan (%)', new.tanggal
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger daily_reports_jaga_tanggal
  before insert or update of tanggal on daily_reports
  for each row execute function jaga_tanggal_laporan();
