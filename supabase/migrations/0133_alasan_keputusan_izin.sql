-- =====================================================================
-- K-Space V2 — Penolakan izin wajib beralasan (PRD Fase 3)
--
-- `alasan` pada attendance milik pengaju. Alasan penolakan adalah
-- kalimat orang lain, tentang hal lain, dan menimpanya berarti
-- menghapus keterangan pengaju — persis bukti yang dibutuhkan kalau
-- keputusannya dipersoalkan nanti.
--
-- Pengajuan yang ditolak tanpa keterangan hanya menyisakan pertanyaan;
-- karena itu alasannya diwajibkan di lapisan database, bukan di form.
-- =====================================================================

alter table attendance
  add column alasan_keputusan text not null default '';

comment on column attendance.alasan_keputusan is
  'Keterangan atasan saat menolak; wajib diisi, terpisah dari alasan pengaju.';

create or replace function jaga_alasan_penolakan()
returns trigger
language plpgsql
as $$
begin
  if new.persetujuan = 'ditolak'
     and new.persetujuan is distinct from old.persetujuan
     and length(btrim(new.alasan_keputusan)) < 10
  then
    raise exception
      'Penolakan izin wajib disertai alasan minimal 10 karakter'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger attendance_jaga_alasan_penolakan
  before update on attendance
  for each row execute function jaga_alasan_penolakan();

-- Keputusan satu pengajuan terencana menyebar beserta alasannya.
create or replace function sebar_keputusan_izin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.persetujuan is distinct from old.persetujuan
     and new.izin_induk_id is null
  then
    update attendance
       set persetujuan = new.persetujuan,
           disetujui_oleh = new.disetujui_oleh,
           disetujui_pada = new.disetujui_pada,
           alasan_keputusan = new.alasan_keputusan
     where izin_induk_id = new.id
       and persetujuan is distinct from new.persetujuan;
  end if;
  return null;
end;
$$;
