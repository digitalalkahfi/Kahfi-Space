-- =====================================================================
-- K-Space V2 — Lead measure yang bersumber dari laporan harian
--
-- Sebagian langkah kunci sudah dilaporkan setiap hari di form laporan
-- (mis. jumlah upload). Menyuruh orang mengetiknya lagi di papan lead
-- measure bukan sekadar merepotkan: dua angka yang diketik terpisah pasti
-- berbeda suatu saat, dan tidak ada cara tahu mana yang benar.
--
-- Karena itu lead measure boleh menyatakan kolom laporan mana yang
-- menjadi sumbernya. Sejak itu angkanya dihitung ulang dari laporan —
-- di dalam transaksi yang sama dengan laporannya, lewat trigger, bukan
-- lewat panggilan kedua dari aplikasi yang bisa gagal di tengah jalan.
-- =====================================================================

alter table lead_measures
  add column sumber_laporan text
    check (sumber_laporan is null
           or sumber_laporan in ('gmv', 'komisi', 'jumlah_upload'));

comment on column lead_measures.sumber_laporan is
  'Kolom daily_reports yang menjadi sumber angka ini; null berarti diisi manual.';

alter table lead_measure_entries
  add column dari_laporan boolean not null default false;

comment on column lead_measure_entries.dari_laporan is
  'Baris hasil hitung ulang dari laporan harian, bukan ketikan orang.';

-- ---------------------------------------------------------------------
-- Hitung ulang seluruh lead measure sebuah unit pada satu tanggal.
--
-- Dihitung ulang dari nol, bukan ditambahkan: dengan begitu perbaikan
-- laporan (revisi) menghasilkan angka yang benar tanpa perlakuan khusus,
-- dan menjalankan fungsi ini dua kali tidak menggandakan apa pun.
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

  -- Penanda bahwa tulisan ke lead_measure_entries memang datang dari sini;
  -- `larang_isi_lead_bersumber` menolak tulisan tanpa penanda ini.
  perform set_config('app.sinkron_lead', '1', true);

  for lm in
    select m.id, m.sumber_laporan
    from lead_measures m
    join goals g on g.id = m.goal_id
    where m.aktif and m.sumber_laporan is not null and g.unit_id = p_unit_id
  loop
    select coalesce(sum(
             case lm.sumber_laporan
               when 'gmv' then r.gmv
               when 'komisi' then r.komisi
               when 'jumlah_upload' then r.jumlah_upload
             end
           ), 0)
      into total
      from daily_reports r
      left join accounts a on a.id = r.account_id
     where r.tanggal = p_tanggal
       and coalesce(a.unit_id, r.unit_id) = p_unit_id;

    -- Nol yang belum pernah tercatat tidak dibuatkan baris. Migrasi
    -- laporan lama — yang tidak punya kolom ini sama sekali — kalau tidak
    -- akan menaburi papan dengan entri nol untuk tiap tanggal lampau.
    -- Yang sudah pernah tercatat tetap diperbarui, termasuk turun ke nol.
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

comment on function sinkron_lead_measure_laporan(uuid, date) is
  'Menghitung ulang realisasi lead measure bersumber laporan untuk satu unit & tanggal.';

create or replace function lead_measure_ikut_laporan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  unit uuid;
begin
  select coalesce(a.unit_id, new.unit_id) into unit
  from (select 1) s
  left join accounts a on a.id = new.account_id;

  perform sinkron_lead_measure_laporan(unit, new.tanggal);

  -- Laporan yang berpindah sasaran meninggalkan unit lamanya; unit itu
  -- harus ikut dihitung ulang, kalau tidak angkanya tertinggal tinggi.
  if tg_op = 'UPDATE' then
    declare
      unit_lama uuid;
    begin
      select coalesce(a.unit_id, old.unit_id) into unit_lama
      from (select 1) s
      left join accounts a on a.id = old.account_id;

      if unit_lama is distinct from unit or old.tanggal <> new.tanggal then
        perform sinkron_lead_measure_laporan(unit_lama, old.tanggal);
      end if;
    end;
  end if;

  return null;
end;
$$;

create trigger daily_reports_lead_measure
  after insert or update of gmv, komisi, jumlah_upload, account_id, unit_id,
    tanggal
  on daily_reports
  for each row execute function lead_measure_ikut_laporan();

-- ---------------------------------------------------------------------
-- Angkanya milik laporan, jadi tidak boleh diketik dua kali.
-- ---------------------------------------------------------------------
create or replace function larang_isi_lead_bersumber()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Penandanya setelan transaksi, bukan kolom `dari_laporan`: pada jalur
  -- upsert, kolom yang tidak ikut dikirim mempertahankan nilai lamanya,
  -- jadi baris otomatis akan lolos memeriksa dirinya sendiri.
  if coalesce(current_setting('app.sinkron_lead', true), '') = '1' then
    return new;
  end if;

  if exists (
    select 1 from lead_measures m
    where m.id = new.lead_measure_id and m.sumber_laporan is not null
  ) then
    raise exception
      'Lead measure ini terisi otomatis dari laporan harian; perbaiki laporannya'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger lme_larang_isi_bersumber
  before insert or update on lead_measure_entries
  for each row execute function larang_isi_lead_bersumber();

-- ---------------------------------------------------------------------
-- Papan lead measure ikut menyebut sumbernya, supaya layar tahu kapan
-- harus menyembunyikan kotak isian alih-alih menawarkan isian yang
-- nanti ditolak trigger.
-- ---------------------------------------------------------------------
drop function if exists papan_lead_measure(date);

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
  select
    lm.id, lm.judul, lm.satuan, u.kode,
    coalesce(sum(e.nilai), 0),
    lm.target_mingguan,
    case when lm.target_mingguan > 0
      then round(coalesce(sum(e.nilai), 0) / lm.target_mingguan * 100, 1)
      else 0 end,
    sum(e.nilai_pendukung),
    lm.label_pendukung,
    lm.sumber_laporan
  from lead_measures lm
  join goals g on g.id = lm.goal_id
  left join units u on u.id = g.unit_id
  left join lead_measure_entries e
    on e.lead_measure_id = lm.id
   and e.tanggal between awal_pekan(p_tanggal) and awal_pekan(p_tanggal) + 6
  where lm.aktif
  group by lm.id, lm.judul, lm.satuan, u.kode, lm.target_mingguan,
           lm.label_pendukung, lm.sumber_laporan
  order by lm.urutan, lm.judul;
$$;
