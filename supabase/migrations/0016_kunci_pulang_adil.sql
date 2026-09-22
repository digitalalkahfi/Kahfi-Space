-- =====================================================================
-- K-Space V2 — Kunci absen pulang hanya bagi yang wajib lapor
--
-- Aturan lama mengunci absen pulang untuk SIAPA PUN yang belum mengirim
-- laporan harian. Akibatnya Manager, Finance, dan staf yang memang tidak
-- memegang akun tidak akan pernah bisa absen pulang — kunci itu menghukum
-- orang yang tidak punya kewajiban apa pun.
--
-- PRD §2 mengikat kunci ini pada laporan GMV, dan yang wajib mengirim GMV
-- hanya PIC akun serta Leader unit. Jadi kuncinya menyesuaikan.
-- =====================================================================

create or replace function jaga_absen_pulang()
returns trigger
language plpgsql
as $$
begin
  if new.jam_pulang is not null and old.jam_pulang is null then
    if wajib_lapor_harian(new.user_id)
       and not sudah_lapor_harian(new.user_id, new.tanggal) then
      raise exception
        'Absen pulang terkunci: laporan harian hari ini belum terkirim'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

comment on function jaga_absen_pulang() is
  'Mengunci absen pulang hanya bagi orang yang memang punya sasaran laporan.';
