-- =====================================================================
-- K-Space V2 — Lead measure GRD: kode, rentang tanggal, daftar akun
--
-- Pekerjaan HARIAN yang berupa jumlah di GRD Cascade (GAP §4d) menjadi
-- lead measure. Tiga hal belum bisa ditampung modul lead measure lama:
--
--   * target yang berganti menurut tanggal — 1.2.1.3 "5 kontak/hari"
--     8–17 Okt lalu 1.2.1.5 "3/hari" 18–31 Okt. Keduanya menjadi lead
--     measure sendiri dengan rentang `mulai`–`selesai`; papan pekanan
--     memotong targetnya sesuai hari yang masuk rentang;
--   * sumber laporan atas SEBAGIAN akun — 1.1.3.11 "135 video/hari di
--     7 akun utama", bukan seluruh akun unit Affiliator;
--   * kolom laporan baru: GMV LIVE dan jam LIVE (0188, 0191).
--
-- Lead measure dikenali dari (periode GRD goal-nya, kode) supaya impor
-- bisa dijalankan ulang dan lembar KPI bisa menunjuknya (0194).
-- =====================================================================

alter table lead_measures
  add column if not exists kode text,
  add column if not exists mulai date,
  add column if not exists selesai date;

alter table lead_measures drop constraint if exists lead_measures_rentang_sah;
alter table lead_measures
  add constraint lead_measures_rentang_sah check (
    mulai is null or selesai is null or mulai <= selesai
  );

comment on column lead_measures.kode is
  'Kode baris rencana operasional GRD, mis. "1.1.3.11"; unik per goal (0193).';
comment on column lead_measures.mulai is
  'Hari pertama lead measure berlaku; null = sejak awal (0193).';
comment on column lead_measures.selesai is
  'Hari terakhir lead measure berlaku; null = tanpa batas (0193).';

create unique index if not exists lead_measures_kode_unik
  on lead_measures (goal_id, kode) where kode is not null;

alter table lead_measures drop constraint if exists lead_measures_sumber_laporan_check;
alter table lead_measures
  add constraint lead_measures_sumber_laporan_check check (
    sumber_laporan is null
    or sumber_laporan in ('gmv', 'komisi', 'jumlah_upload', 'gmv_live', 'jam_live')
  );

-- ---------------------------------------------------------------------
-- Daftar akun. Kosong = seluruh akun unit goal-nya, seperti sebelumnya.
-- ---------------------------------------------------------------------
create table lead_measure_akun (
  lead_measure_id uuid not null references lead_measures (id) on delete cascade,
  account_id      uuid not null references accounts (id) on delete cascade,
  primary key (lead_measure_id, account_id)
);

comment on table lead_measure_akun is
  'Akun yang laporannya dijumlah lead measure bersumber laporan; kosong = seluruh unit goal (0193).';

create index lead_measure_akun_akun_idx on lead_measure_akun (account_id);

alter table lead_measure_akun enable row level security;

create policy lead_measure_akun_baca on lead_measure_akun
  for select using (
    exists (select 1 from lead_measures lm where lm.id = lead_measure_id)
  );
create policy lead_measure_akun_kelola on lead_measure_akun
  for all using (lintas_unit()) with check (lintas_unit());

-- ---------------------------------------------------------------------
-- Hitung ulang lead measure bersumber laporan untuk satu unit & tanggal.
-- Sama dengan 0130, ditambah: lead measure berdaftar akun ikut dihitung
-- bila salah satu akunnya milik unit itu (jumlahnya tetap atas seluruh
-- daftar), rentang tanggal dihormati, dan dua kolom LIVE.
-- ---------------------------------------------------------------------
create or replace function sinkron_lead_measure_laporan(
  p_unit_id uuid,
  p_tanggal date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lm record;
  total numeric;
begin
  if p_unit_id is null or p_tanggal is null then return; end if;

  perform set_config('app.sinkron_lead', '1', true);

  for lm in
    select m.id, m.sumber_laporan,
           exists (select 1 from lead_measure_akun x where x.lead_measure_id = m.id)
             as berdaftar
    from lead_measures m
    join goals g on g.id = m.goal_id
    where m.aktif
      and m.sumber_laporan is not null
      and (m.mulai is null or p_tanggal >= m.mulai)
      and (m.selesai is null or p_tanggal <= m.selesai)
      and (
        exists (
          select 1 from lead_measure_akun x
          join accounts a on a.id = x.account_id
          where x.lead_measure_id = m.id and a.unit_id = p_unit_id
        )
        or (
          g.unit_id = p_unit_id
          and not exists (select 1 from lead_measure_akun x where x.lead_measure_id = m.id)
        )
      )
  loop
    select coalesce(sum(
             case lm.sumber_laporan
               when 'gmv' then r.gmv
               when 'komisi' then r.komisi
               when 'jumlah_upload' then r.jumlah_upload
               when 'gmv_live' then r.gmv_live
               when 'jam_live' then r.jam_live
             end
           ), 0)
      into total
      from daily_reports r
      left join accounts a on a.id = r.account_id
     where r.tanggal = p_tanggal
       and case
             when lm.berdaftar then r.account_id in (
               select x.account_id from lead_measure_akun x
               where x.lead_measure_id = lm.id
             )
             else coalesce(a.unit_id, r.unit_id) = p_unit_id
           end;

    if total = 0 and not exists (
      select 1 from lead_measure_entries e
      where e.lead_measure_id = lm.id and e.tanggal = p_tanggal
    ) then
      continue;
    end if;

    insert into lead_measure_entries
      (lead_measure_id, user_id, tanggal, nilai, catatan, dari_laporan)
    values (lm.id, null, p_tanggal, total, '', true)
    on conflict (lead_measure_id, tanggal) do update
      set nilai = excluded.nilai, dari_laporan = true;
  end loop;
end;
$$;

drop trigger if exists daily_reports_lead_measure on daily_reports;
create trigger daily_reports_lead_measure
  after insert or update of gmv, komisi, jumlah_upload, gmv_live, jam_live,
    account_id, unit_id, tanggal
  on daily_reports
  for each row execute function lead_measure_ikut_laporan();

-- ---------------------------------------------------------------------
-- Papan pekanan: lead measure di luar rentangnya tidak tampil, dan target
-- pekan yang hanya sebagian masuk rentang dipotong sesuai jumlah harinya
-- (5 kontak/hari × 4 hari = 20, bukan 35).
-- ---------------------------------------------------------------------
create or replace function papan_lead_measure(p_tanggal date)
returns table (
  lead_id     uuid,
  judul       text,
  satuan      text,
  unit_kode   text,
  realisasi   numeric,
  target      numeric,
  rasio       numeric,
  pendukung   numeric,
  label_pendukung text,
  sumber_laporan  text
)
language sql
stable
as $$
  with pekan as (
    select awal_pekan(p_tanggal) as dari, awal_pekan(p_tanggal) + 6 as sampai
  ),
  aktif as (
    select
      lm.*,
      greatest(pekan.dari, coalesce(lm.mulai, pekan.dari)) as dari,
      least(pekan.sampai, coalesce(lm.selesai, pekan.sampai)) as sampai
    from lead_measures lm, pekan
    where lm.aktif
      and (lm.mulai is null or lm.mulai <= pekan.sampai)
      and (lm.selesai is null or lm.selesai >= pekan.dari)
  ),
  baris as (
    select
      a.id, a.judul, a.satuan, u.kode as unit_kode, a.urutan,
      coalesce(sum(e.nilai), 0) as realisasi,
      round(a.target_mingguan * (a.sampai - a.dari + 1) / 7.0, 2) as target,
      sum(e.nilai_pendukung) as pendukung,
      a.label_pendukung, a.sumber_laporan
    from aktif a
    join goals g on g.id = a.goal_id
    left join units u on u.id = g.unit_id
    left join lead_measure_entries e
      on e.lead_measure_id = a.id
     and e.tanggal between a.dari and a.sampai
    group by a.id, a.judul, a.satuan, u.kode, a.urutan, a.target_mingguan,
             a.dari, a.sampai, a.label_pendukung, a.sumber_laporan
  )
  select
    id, judul, satuan, unit_kode, realisasi, target,
    case when target > 0 then round(realisasi / target * 100, 1) else 0 end,
    pendukung, label_pendukung, sumber_laporan
  from baris
  order by urutan, judul;
$$;

comment on function papan_lead_measure(date) is
  'Papan lead measure satu pekan; rentang mulai–selesai dihormati, target dipotong per hari (0193).';

-- ---------------------------------------------------------------------
-- Rollback (manual): kembalikan papan_lead_measure dan
-- sinkron_lead_measure_laporan dari 0130 beserta triggernya; drop table
-- lead_measure_akun; drop kolom kode/mulai/selesai.
-- ---------------------------------------------------------------------
