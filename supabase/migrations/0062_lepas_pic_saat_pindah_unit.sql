-- =====================================================================
-- K-Space V2 — Pindah unit ikut melepas akun yang dipegang
--
-- 0042 melepas PIC saat orangnya dinonaktifkan, tetapi memindahkan
-- orang ke unit lain meninggalkan masalah yang sama diam-diam:
--
--   * ia tetap melihat akun unit lamanya (0002/0004/0014 membuka akses
--     lewat pic_user_id dan co_leader_id) — sekat antar-unit bocor;
--   * `wajib_lapor_harian()` terus menagih laporan harian akun lama;
--   * `jaga_pic_akun()` (0038) menolak setiap penyuntingan akun itu
--     berikutnya, karena PIC-nya tidak lagi se-unit.
--
-- Karena itu tugas yang tidak lagi sah dilepas saat unit berubah. Akun
-- tampil "Belum ada PIC" di Kelola akun: terlihat dan bisa ditindak.
-- Akun yang kebetulan ada di unit barunya tetap dipegang.
-- =====================================================================

create or replace function lepas_pic_saat_pindah_unit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update accounts set pic_user_id = null
   where pic_user_id = new.id
     and unit_id is distinct from new.unit_id;

  update accounts set co_leader_id = null
   where co_leader_id = new.id
     and unit_id is distinct from new.unit_id;

  return new;
end;
$$;

drop trigger if exists lepas_pic_saat_pindah_unit_trg on users;

create trigger lepas_pic_saat_pindah_unit_trg
  after update of unit_id on users
  for each row
  when (new.unit_id is distinct from old.unit_id)
  execute function lepas_pic_saat_pindah_unit();
