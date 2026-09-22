-- =====================================================================
-- K-Space V2 — Anggota nonaktif dilepas dari tugas PIC
--
-- Menonaktifkan seseorang tidak menyentuh akun yang ia pegang. Akibatnya
-- akun itu tetap menunjuk orang yang sudah tidak aktif:
--
--   * `wajib_lapor_harian()` terus menagih laporan harian kepadanya,
--     sehingga Beranda selamanya menampilkan "belum lapor";
--   * `jaga_pic_akun()` (0038) menolak setiap penyuntingan akun itu
--     berikutnya, karena PIC-nya tidak lagi memenuhi syarat;
--   * tidak ada satu pun tanda di layar bahwa akun itu terbengkalai.
--
-- Karena itu PIC dilepas saat orangnya dinonaktifkan. Akun lalu tampil
-- "Belum ada PIC" di halaman Kelola akun — terlihat dan bisa ditindak,
-- bukan diam-diam salah. Riwayat GMV akun tidak tersentuh.
-- =====================================================================

create or replace function lepas_pic_saat_nonaktif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'nonaktif' and old.status <> 'nonaktif' then
    update accounts set pic_user_id = null where pic_user_id = new.id;
    update accounts set co_leader_id = null where co_leader_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists lepas_pic_saat_nonaktif_trg on users;

create trigger lepas_pic_saat_nonaktif_trg
  after update of status on users
  for each row execute function lepas_pic_saat_nonaktif();
