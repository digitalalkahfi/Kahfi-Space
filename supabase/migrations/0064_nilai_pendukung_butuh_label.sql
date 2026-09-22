-- =====================================================================
-- K-Space V2 — Angka pendukung hanya untuk lead measure yang punya label
--
-- `nilai_pendukung` baru berarti kalau lead measure-nya menamainya lewat
-- `label_pendukung` — mis. "Peserta hadir MMC" pada Creator Binding MMC
-- unit MCN. Tanpa label, `ringkasan_lead_measure` (0026) tetap
-- menjumlahkan angkanya tetapi layar tidak punya sebutan untuk itu,
-- jadi angkanya hilang begitu saja: terisi, tersimpan, tak pernah
-- terlihat.
--
-- Karena itu entri dengan angka pendukung ditolak bila lead measure-nya
-- tidak menyebut label. Sebaliknya label tidak mewajibkan angka: MMC
-- hanya digelar pada hari tertentu, hari lain memang kosong.
-- =====================================================================

create or replace function jaga_nilai_pendukung()
returns trigger
language plpgsql
as $$
declare
  label text;
begin
  if new.nilai_pendukung is null then
    return new;
  end if;

  select label_pendukung into label
  from lead_measures where id = new.lead_measure_id;

  if label is null or btrim(label) = '' then
    raise exception 'Lead measure ini tidak punya angka pendukung';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_nilai_pendukung_trg on lead_measure_entries;

create trigger jaga_nilai_pendukung_trg
  before insert or update of nilai_pendukung, lead_measure_id
  on lead_measure_entries
  for each row execute function jaga_nilai_pendukung();
