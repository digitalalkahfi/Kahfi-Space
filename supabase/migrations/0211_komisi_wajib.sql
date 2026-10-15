-- =====================================================================
-- K-Space V2 — Komisi wajib di laporan Affiliator; komisi boleh > GMV
-- (docs/KOMISI-DETAIL-AKUN-AFFILIATOR.md §4.2, keputusan K1–K2, T2)
--
-- K1: yang diisi adalah komisi REAL yang masuk hari itu. Komisi itu bisa
-- berasal dari pesanan hari-hari sebelumnya, jadi hari dengan GMV Rp 0
-- tetap bisa menerima komisi Rp 50.000. Aturan "komisi ≤ GMV hari itu"
-- (0125) menolak kenyataan itu dan dicabut (BR-K3). Batas wajar 0–10
-- miliar (`daily_reports_komisi_wajar`) tetap.
--
-- K2/BR-K2: laporan BARU untuk akun Affiliator wajib berisi komisi
-- (boleh 0). Laporan lama tidak diubah (E2), dan jalur migrasi data
-- lama (`migrasi_tulis_laporan`) tidak ikut diwajibkan (E10). Pekerjaan
-- sistem tanpa sesi pengguna (seed, service role) juga tidak.
-- Unit MCN & TAP tidak berubah: komisi mereka tetap null (BR-K4).
-- =====================================================================

alter table daily_reports
  drop constraint if exists daily_reports_komisi_tak_lebih_dari_gmv;

create or replace function wajib_komisi_affiliator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.komisi is null
     and new.account_id is not null
     and auth.uid() is not null
     and coalesce(current_setting('app.laporan_lama', true), '') <> '1'
     and unit_laporan(new.account_id, new.unit_id) = 'affiliator'
  then
    raise exception 'Isi 0 kalau hari ini tidak ada komisi masuk.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function wajib_komisi_affiliator() is
  'Laporan baru akun Affiliator wajib berisi komisi (boleh 0), kecuali jalur migrasi data lama (0211).';

drop trigger if exists daily_reports_wajib_komisi on daily_reports;
create trigger daily_reports_wajib_komisi
  before insert on daily_reports
  for each row execute function wajib_komisi_affiliator();

-- Jalur migrasi data lama (0158): sama persis dengan definisi terbarunya,
-- ditambah penanda `app.laporan_lama` supaya laporan lama tanpa komisi
-- tetap bisa dimasukkan (E10).
create or replace function migrasi_tulis_laporan(
  p_user    uuid,
  p_tanggal date,
  p_account uuid,
  p_unit    uuid,
  p_gmv     numeric,
  p_komisi  numeric default null,
  p_upload  integer default null,
  p_catatan text default '',
  p_dikirim timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh memasukkan laporan lama.'
      using errcode = '42501';
  end if;

  perform set_config('app.laporan_lama', '1', true);

  insert into daily_reports (
    user_id, tanggal, account_id, unit_id, gmv, komisi, jumlah_upload,
    catatan, status, submitted_at
  )
  values (
    p_user, p_tanggal, p_account, p_unit, p_gmv, p_komisi, p_upload,
    coalesce(p_catatan, ''), 'terkirim', coalesce(p_dikirim, now())
  )
  returning id into v_id;

  perform set_config('app.laporan_lama', '', true);
  return v_id;
exception
  -- Laporan untuk sasaran dan tanggal yang sama sudah ada: itu bukan
  -- kegagalan, itu pengulangan yang memang ditahan indeks uniknya.
  when unique_violation then
    perform set_config('app.laporan_lama', '', true);
    return null;
end;
$$;
