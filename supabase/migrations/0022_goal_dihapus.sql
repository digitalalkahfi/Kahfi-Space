-- =====================================================================
-- K-Space V2 — Nasib komitmen saat goal-nya dihapus
--
-- `tasks.goal_id` memakai ON DELETE SET NULL, sementara constraint
-- `tasks_komitmen_punya_goal` mewajibkan komitmen mingguan punya goal.
-- Akibatnya menghapus goal yang punya komitmen selalu gagal.
--
-- Menghapus tugasnya juga bukan jawaban: pekerjaannya sudah terjadi dan
-- riwayat QC-nya bernilai. Jadi komitmen yang kehilangan induk diturunkan
-- menjadi tiket biasa, dengan catatan asal-usulnya.
-- =====================================================================

create or replace function lepaskan_komitmen_dari_goal()
returns trigger
language plpgsql
as $$
begin
  update tasks
     set tipe = 'tiket',
         goal_id = null,
         konteks = case
           when btrim(konteks) = '' then 'Bekas komitmen: ' || old.judul
           else konteks || ' · bekas komitmen: ' || old.judul
         end
   where goal_id = old.id
     and tipe = 'komitmen_mingguan';

  return old;
end;
$$;

create trigger goals_lepaskan_komitmen
  before delete on goals
  for each row execute function lepaskan_komitmen_dari_goal();

comment on function lepaskan_komitmen_dari_goal() is
  'Menurunkan komitmen mingguan jadi tiket biasa saat goal induknya dihapus.';
