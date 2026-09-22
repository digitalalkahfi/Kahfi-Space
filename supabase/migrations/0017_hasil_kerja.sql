-- =====================================================================
-- K-Space V2 — Catatan hasil kerja saat mengajukan pemeriksaan
--
-- Sebelumnya tugas bisa melompat ke "menunggu_qc" tanpa keterangan apa pun,
-- sehingga pemeriksa harus menebak apa yang sudah dikerjakan. Kolom ini
-- menampung ringkasan hasil dari penerima tugas.
-- =====================================================================

alter table tasks
  add column hasil_kerja text not null default '';

comment on column tasks.hasil_kerja is
  'Ringkasan hasil dari penerima tugas; dibaca pemeriksa saat QC.';

-- Mengajukan pemeriksaan tanpa keterangan hasil ditolak.
create or replace function jaga_ajuan_qc()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'menunggu_qc'
     and old.status is distinct from 'menunggu_qc'
     and old.tipe <> 'pribadi'
     and length(btrim(coalesce(new.hasil_kerja, ''))) < 5 then
    raise exception
      'Tulis ringkasan hasil kerja sebelum mengajukan pemeriksaan'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger tasks_b_jaga_ajuan_qc
  before update on tasks
  for each row execute function jaga_ajuan_qc();
