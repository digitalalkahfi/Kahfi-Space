-- =====================================================================
-- K-Space V2 — Riwayat pemindaian QR sampel
--
-- `sample_events` mencatat perpindahan, bukan pemindaian. Keduanya
-- berbeda, dan selisihnya justru yang menarik:
--
--   * memindai untuk memeriksa keadaan barang tidak memindahkan apa pun,
--     jadi tidak meninggalkan jejak sama sekali — padahal itu bukti
--     barangnya benar-benar dilihat orang pada waktu itu;
--   * kode yang dipindai tetapi tidak dikenali tidak tercatat di mana
--     pun. Justru kode inilah yang menunjukkan label tertukar, stiker
--     lama yang masih beredar, atau barang dari luar yang masuk ke
--     gudang — masalah yang hanya terlihat kalau dihitung.
--
-- Karena itu setiap pemindaian dicatat apa adanya, dikenali atau tidak,
-- beserta perpindahan yang menyusul bila memang ada.
-- =====================================================================

create table sample_scans (
  id          uuid primary key default gen_random_uuid(),
  kode        text not null,
  sample_id   uuid references samples (id) on delete set null,
  oleh_id     uuid not null references users (id) on delete cascade,
  dikenali    boolean not null,
  kejadian_id uuid references sample_events (id) on delete set null,
  pada        timestamptz not null default now()
);

create index sample_scans_pada_idx on sample_scans (pada desc);
create index sample_scans_sampel_idx on sample_scans (sample_id, pada desc);
create index sample_scans_kode_idx on sample_scans (lower(kode));

comment on table sample_scans is
  'Satu baris per pemindaian QR, termasuk kode yang tidak dikenali.';

comment on column sample_scans.kejadian_id is
  'Perpindahan yang menyusul pemindaian ini, bila ada.';

-- Pemindaian adalah catatan pengamatan: sekali terjadi, isinya tidak
-- disunting maupun dihapus — sama seperti perpindahan sampel. Satu
-- pengecualian: perpindahan yang menyusul boleh disambungkan sekali,
-- selama kolomnya memang masih kosong.
create or replace function larang_ubah_scan()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Riwayat pemindaian tidak bisa dihapus'
      using errcode = 'check_violation';
  end if;

  if old.kejadian_id is null
     and new.kejadian_id is not null
     and (new.kode, new.sample_id, new.oleh_id, new.dikenali, new.pada)
         is not distinct from
         (old.kode, old.sample_id, old.oleh_id, old.dikenali, old.pada)
  then
    return new;
  end if;

  raise exception 'Riwayat pemindaian tidak bisa diubah'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists larang_ubah_scan_trg on sample_scans;

create trigger larang_ubah_scan_trg
  before update or delete on sample_scans
  for each row execute function larang_ubah_scan();

-- Kode yang dikenali harus menyebut sampelnya, dan sebaliknya.
alter table sample_scans
  add constraint sample_scans_dikenali_punya_sampel check (
    (dikenali and sample_id is not null)
    or (not dikenali and sample_id is null)
  );

-- ---------------------------------------------------------------------
-- Kode asing yang berulang — bahan tindak lanjut, bukan sekadar daftar.
-- ---------------------------------------------------------------------
create or replace function kode_asing(p_sejak date default null)
returns table (kode text, jumlah integer, terakhir timestamptz)
language sql
stable
as $$
  select s.kode, count(*)::int, max(s.pada)
  from sample_scans s
  where not s.dikenali
    and (p_sejak is null or s.pada >= p_sejak)
  group by s.kode
  order by count(*) desc, max(s.pada) desc;
$$;

-- ---------------------------------------------------------------------
-- RLS — mengikuti sampelnya; kode asing hanya urusan pengelola sampel.
-- ---------------------------------------------------------------------
alter table sample_scans enable row level security;

create policy sample_scans_baca on sample_scans
  for select using (
    oleh_id = auth.uid()
    or lintas_unit()
    or (sample_id is not null
        and exists (select 1 from samples s where s.id = sample_id))
  );

create policy sample_scans_buat on sample_scans
  for insert with check (oleh_id = auth.uid());

-- Hanya untuk menyambungkan perpindahan yang menyusul; isi lainnya
-- tetap ditolak trigger di atas.
create policy sample_scans_sambung on sample_scans
  for update using (oleh_id = auth.uid()) with check (oleh_id = auth.uid());
