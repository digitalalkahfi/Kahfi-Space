-- =====================================================================
-- K-Space V2 — Jejak pemeriksaan (QC)
--
-- Kolom qc_note hanya menyimpan catatan TERAKHIR. Saat sebuah tugas bolak-
-- balik revisi, alasan putaran sebelumnya hilang — padahal justru di situ
-- riwayat pembinaannya. Tabel ini menyimpan tiap keputusan QC.
-- =====================================================================

create table task_qc_log (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks (id) on delete cascade,
  hasil       status_qc not null check (hasil <> 'belum'),
  catatan     text not null default '',
  hasil_kerja text not null default '',
  diperiksa_oleh uuid references users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index task_qc_log_task_idx on task_qc_log (task_id, created_at);

comment on table task_qc_log is
  'Satu baris per keputusan QC; menyimpan konteks tiap putaran revisi.';

-- Ditulis otomatis oleh trigger, sama seperti jejak revisi laporan.
create or replace function catat_jejak_qc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.qc_status is distinct from old.qc_status and new.qc_status <> 'belum' then
    insert into task_qc_log
      (task_id, hasil, catatan, hasil_kerja, diperiksa_oleh)
    values (
      old.id,
      new.qc_status,
      coalesce(new.qc_note, ''),
      coalesce(old.hasil_kerja, ''),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

-- Dijalankan setelah trigger status agar nilai akhirnya yang tercatat.
create trigger tasks_z_catat_jejak_qc
  after update on tasks
  for each row execute function catat_jejak_qc();

-- ---------------------------------------------------------------------
-- RLS: terlihat oleh yang berhak melihat tugasnya; tidak bisa diubah.
-- ---------------------------------------------------------------------
alter table task_qc_log enable row level security;

create policy task_qc_log_baca on task_qc_log
  for select
  using (
    exists (
      select 1 from tasks t
      where t.id = task_id
        and (
          t.penerima_id = auth.uid()
          or t.pembuat_id = auth.uid()
          or lintas_unit()
          or boleh_orang(t.penerima_id)
        )
    )
  );
