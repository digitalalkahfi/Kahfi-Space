-- =====================================================================
-- K-Space V2 — Izin/sakit tidak boleh disetujui sendiri
--
-- Policy update pada attendance sengaja longgar supaya seseorang bisa
-- memperbarui absensinya sendiri (mis. absen pulang). Celahnya: ia juga
-- bisa menandai pengajuan izinnya sendiri sebagai "disetujui".
--
-- Keputusan izin adalah wewenang atasan (PRD §3), jadi dijaga di sini.
-- =====================================================================

create or replace function larang_setujui_izin_sendiri()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.persetujuan is distinct from old.persetujuan
     and new.persetujuan in ('disetujui', 'ditolak')
     and auth.uid() = old.user_id then
    raise exception 'Pengajuan izin harus diputuskan atasan, bukan diri sendiri'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger attendance_a_larang_setujui_sendiri
  before update on attendance
  for each row execute function larang_setujui_izin_sendiri();
