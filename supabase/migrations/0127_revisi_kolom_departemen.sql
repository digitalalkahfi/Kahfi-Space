-- =====================================================================
-- K-Space V2 — Jejak revisi untuk kolom departemen (PRD Fase 1)
--
-- Sejak laporan Affiliator memuat komisi dan jumlah upload, jejak revisi
-- yang hanya menyimpan GMV bocor: angka komisi bisa berubah tanpa bekas.
-- Ketiganya sekarang dicatat dalam satu baris jejak, dengan alasan yang
-- sama — karena memang satu perbaikan, bukan tiga.
-- =====================================================================

alter table daily_report_revisions
  add column komisi_lama  numeric(14, 2),
  add column komisi_baru  numeric(14, 2),
  add column upload_lama  integer,
  add column upload_baru  integer;

comment on column daily_report_revisions.komisi_lama is
  'Komisi sebelum perbaikan; null bila komisi tidak ikut berubah.';
comment on column daily_report_revisions.upload_lama is
  'Jumlah upload sebelum perbaikan; null bila tidak ikut berubah.';

-- Satu baris jejak sah bila ADA yang berubah — tidak harus GMV-nya.
alter table daily_report_revisions
  drop constraint revisi_harus_berubah;

alter table daily_report_revisions
  add constraint revisi_harus_berubah check (
    gmv_lama is distinct from gmv_baru
    or komisi_lama is distinct from komisi_baru
    or upload_lama is distinct from upload_baru
  );

create or replace function catat_revisi_laporan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gmv_berubah    boolean := new.gmv is distinct from old.gmv;
  komisi_berubah boolean := new.komisi is distinct from old.komisi;
  upload_berubah boolean := new.jumlah_upload is distinct from old.jumlah_upload;
begin
  if not (gmv_berubah or komisi_berubah or upload_berubah) then
    return new;
  end if;

  insert into daily_report_revisions
    (report_id, gmv_lama, gmv_baru,
     komisi_lama, komisi_baru, upload_lama, upload_baru,
     alasan, diubah_oleh)
  values (
    old.id,
    old.gmv,
    new.gmv,
    case when komisi_berubah then old.komisi end,
    case when komisi_berubah then new.komisi end,
    case when upload_berubah then old.jumlah_upload end,
    case when upload_berubah then new.jumlah_upload end,
    coalesce(
      nullif(btrim(current_setting('app.alasan_revisi', true)), ''),
      'Perbaikan tanpa alasan tercatat'
    ),
    auth.uid()
  );
  new.status := 'revisi';
  return new;
end;
$$;

drop trigger if exists daily_reports_catat_revisi on daily_reports;

create trigger daily_reports_catat_revisi
  before update of gmv, komisi, jumlah_upload on daily_reports
  for each row execute function catat_revisi_laporan();

-- ---------------------------------------------------------------------
-- Satu jalan memperbaiki laporan, kini lengkap dengan kolom departemen.
--
-- Bentuk lama (4 argumen) sengaja dihapus, bukan dibiarkan berdampingan:
-- pemanggil lama yang tidak tahu kolom baru akan mengosongkan komisi
-- tanpa sadar. Lebih baik panggilannya gagal terang-terangan.
-- ---------------------------------------------------------------------
drop function if exists perbaiki_laporan_harian(uuid, numeric, text, text);

create or replace function perbaiki_laporan_harian(
  p_report_id uuid,
  p_gmv numeric,
  p_alasan text,
  p_catatan text default null,
  p_komisi numeric default null,
  p_jumlah_upload integer default null
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
         komisi = p_komisi,
         jumlah_upload = p_jumlah_upload,
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

comment on function perbaiki_laporan_harian(uuid, numeric, text, text, numeric, integer) is
  'Satu-satunya jalan mengubah angka laporan; alasan wajib dan ikut tercatat.';
