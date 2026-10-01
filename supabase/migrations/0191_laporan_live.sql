-- =====================================================================
-- K-Space V2 — Laporan harian Affiliator: GMV LIVE dan jam LIVE
--
-- File GRD Oktober 2026 memisahkan GMV LIVE dari GMV video (goal 1.1.1 vs
-- 1.1.3) dan menilai "LIVE 4 jam setiap hari" (1.1.1.5, KPI Co-Leader &
-- Host LIVE). Operational plan 1.1.0.1 meminta laporan harian memuat jam
-- LIVE. GMV LIVE sudah ada sejak 0188; di sini jam LIVE menyusul, dan
-- keduanya bisa diisi serta diperbaiki lewat jalur yang sama dengan
-- angka laporan lainnya.
-- =====================================================================

alter table daily_reports
  add column if not exists jam_live numeric(4, 2);

alter table daily_reports drop constraint if exists daily_reports_jam_live_wajar;
alter table daily_reports
  add constraint daily_reports_jam_live_wajar check (
    jam_live is null or (jam_live >= 0 and jam_live <= 24)
  );

comment on column daily_reports.jam_live is
  'Lama LIVE hari itu dalam jam; null untuk laporan tanpa LIVE (0191).';

create or replace function jaga_kolom_departemen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kode text;
begin
  kode := unit_laporan(new.account_id, new.unit_id);

  if kode is distinct from 'affiliator'
     and (new.komisi is not null or new.jumlah_upload is not null
          or new.gmv_live is not null or new.jam_live is not null)
  then
    raise exception
      'Departemen % hanya melaporkan GMV dan catatan', coalesce(kode, '?')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists daily_reports_jaga_kolom_departemen on daily_reports;
create trigger daily_reports_jaga_kolom_departemen
  before insert or update of account_id, unit_id, komisi, jumlah_upload,
    gmv_live, jam_live
  on daily_reports
  for each row execute function jaga_kolom_departemen();

-- ---------------------------------------------------------------------
-- Jejak revisi ikut mencatat jam LIVE.
-- ---------------------------------------------------------------------
alter table daily_report_revisions
  add column if not exists jam_lama numeric(4, 2),
  add column if not exists jam_baru numeric(4, 2);

alter table daily_report_revisions drop constraint if exists revisi_harus_berubah;
alter table daily_report_revisions
  add constraint revisi_harus_berubah check (
    gmv_lama is distinct from gmv_baru
    or komisi_lama is distinct from komisi_baru
    or upload_lama is distinct from upload_baru
    or live_lama is distinct from live_baru
    or jam_lama is distinct from jam_baru
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
  live_berubah   boolean := new.gmv_live is distinct from old.gmv_live;
  jam_berubah    boolean := new.jam_live is distinct from old.jam_live;
begin
  if not (gmv_berubah or komisi_berubah or upload_berubah or live_berubah
          or jam_berubah) then
    return new;
  end if;

  insert into daily_report_revisions
    (report_id, gmv_lama, gmv_baru,
     komisi_lama, komisi_baru, upload_lama, upload_baru,
     live_lama, live_baru, jam_lama, jam_baru,
     alasan, diubah_oleh)
  values (
    old.id,
    old.gmv,
    new.gmv,
    case when komisi_berubah then old.komisi end,
    case when komisi_berubah then new.komisi end,
    case when upload_berubah then old.jumlah_upload end,
    case when upload_berubah then new.jumlah_upload end,
    case when live_berubah then old.gmv_live end,
    case when live_berubah then new.gmv_live end,
    case when jam_berubah then old.jam_live end,
    case when jam_berubah then new.jam_live end,
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
  before update of gmv, komisi, jumlah_upload, gmv_live, jam_live on daily_reports
  for each row execute function catat_revisi_laporan();

-- ---------------------------------------------------------------------
-- Perbaikan laporan: dua kolom LIVE ikut. Null pada keduanya berarti
-- "tidak diubah", supaya pemanggil yang tidak menyebutnya tidak
-- menghapus angka LIVE yang sudah ada.
-- ---------------------------------------------------------------------
drop function if exists perbaiki_laporan_harian(uuid, numeric, text, text, numeric, integer);

create function perbaiki_laporan_harian(
  p_report_id uuid,
  p_gmv numeric,
  p_alasan text,
  p_catatan text default null,
  p_komisi numeric default null,
  p_jumlah_upload integer default null,
  p_gmv_live numeric default null,
  p_jam_live numeric default null
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
         gmv_live = coalesce(p_gmv_live, gmv_live),
         jam_live = coalesce(p_jam_live, jam_live),
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

comment on function perbaiki_laporan_harian(uuid, numeric, text, text, numeric, integer, numeric, numeric) is
  'Satu-satunya jalan mengubah angka laporan; alasan wajib dan ikut tercatat. LIVE null = tidak diubah (0191).';

-- ---------------------------------------------------------------------
-- Acuan kolom per departemen (0149) mengikuti KOLOM_PER_UNIT.
-- ---------------------------------------------------------------------
alter table metrik_departemen drop constraint if exists metrik_departemen_metrik_check;
alter table metrik_departemen
  add constraint metrik_departemen_metrik_check check (
    metrik in ('gmv', 'komisi', 'jumlahUpload', 'gmvLive', 'jamLive', 'coSampel', 'catatan')
  );

update metrik_departemen set urutan = 6 where unit_kode = 'affiliator' and metrik = 'coSampel';
update metrik_departemen set urutan = 7 where unit_kode = 'affiliator' and metrik = 'catatan';
insert into metrik_departemen (unit_kode, metrik, urutan, wajib) values
  ('affiliator', 'gmvLive', 4, false),
  ('affiliator', 'jamLive', 5, false)
on conflict (unit_kode, metrik) do update set urutan = excluded.urutan;

-- ---------------------------------------------------------------------
-- Riwayat laporan (0141) ikut membawa kedua kolom LIVE, supaya layar
-- riwayat bisa menampilkan dan memperbaikinya. Kolom baru di ujung:
-- `create or replace view` hanya boleh menambah, bukan menyisipkan.
-- ---------------------------------------------------------------------
create or replace view riwayat_laporan_minimum
with (security_invoker = true)
as
  select
    l.id,
    l.tanggal,
    l.account_id,
    l.unit_id,
    l.gmv,
    l.komisi,
    l.jumlah_upload,
    l.catatan,
    l.status,
    l.submitted_at,
    a.username           as akun_username,
    a.level              as akun_level,
    batas_minimum(a.level) as minimum_unggahan,
    au.kode              as akun_unit_kode,
    u.kode               as unit_kode,
    u.nama               as unit_nama,
    p.nama               as pelapor_nama,
    l.gmv_live,
    l.jam_live
  from daily_reports l
  left join accounts a on a.id = l.account_id
  left join units au on au.id = a.unit_id
  left join units u on u.id = l.unit_id
  left join users p on p.id = l.user_id
  where auth.uid() is not null;
