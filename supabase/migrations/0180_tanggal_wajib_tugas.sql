-- =====================================================================
-- K-Space V2 — Semua tugas baru wajib bertanggal (keputusan D3)
--
-- Sebelumnya to-do tanpa jam tersimpan `tenggat = null`, sehingga tidak
-- masuk tanggal mana pun: papan per tanggal tidak akan pernah
-- menampilkannya. Tiket pun hanya bisa dibuat untuk hari ini.
--
-- Aturannya kini:
--   · To-do: tanggal wajib, jam opsional. To-do tanpa jam disimpan
--     sebagai 23:59 WIB tanggal itu — batas hari itu — dengan penanda
--     `tanpa_jam`, supaya layar menampilkan tanggalnya saja, bukan
--     "23:59" yang tidak pernah dipilih siapa pun.
--   · Tiket & komitmen: tanggal DAN jam wajib, sehingga `tanpa_jam`
--     hanya sah untuk to-do.
--
-- Tiket/komitmen lama yang tanpa tenggat DIBIARKAN: constraint akan
-- menggagalkan setiap perubahan status tiket lama itu. Kewajibannya
-- dijaga trigger BEFORE INSERT, jadi hanya berlaku untuk baris baru.
--
-- Aman dijalankan ulang.
-- =====================================================================

alter table tasks
  add column if not exists tanpa_jam boolean not null default false;

comment on column tasks.tanpa_jam is
  'Tenggat hanya bertanggal (to-do tanpa jam); jamnya 23:59 WIB sebagai batas hari itu (0180).';

-- ---------------------------------------------------------------------
-- 1. Data lama: to-do tanpa tenggat diberi tanggal dibuatnya (WIB),
--    pukul 23:59 WIB, tanpa jam.
--
--    Tenggat hasil pengisian ini tidak pernah dipilih orang, jadi
--    "melewatinya" bukan peristiwa yang layak dikabarkan. Tanpa
--    penanda, pengingat terjadwal (0113) akan menerbitkan "Tenggat
--    lewat" untuk setiap to-do lama yang belum dicentang sekaligus —
--    termasuk lewat WhatsApp bila preferensinya menyala. Penandanya
--    ditulis di pernyataan TERPISAH setelah pengisian: trigger
--    `reset_pengingat_tenggat` berjalan di akhir pernyataan UPDATE dan
--    akan menghapus penanda yang ditulis di pernyataan yang sama.
-- ---------------------------------------------------------------------
do $$
declare
  v_id       uuid[];
  v_ditandai integer;
begin
  with diisi as (
    update tasks
       set tenggat = ((created_at at time zone 'Asia/Jakarta')::date + time '23:59')
                       at time zone 'Asia/Jakarta',
           tanpa_jam = true
     where tipe = 'pribadi'
       and tenggat is null
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_id from diisi;

  insert into notifikasi_tenggat_terkirim (task_id, tahap)
  select t.id, 'lewat'
    from tasks t
   where t.id = any (v_id)
     and t.tenggat < now()
     and t.status not in ('selesai', 'dibatalkan')
  on conflict do nothing;
  get diagnostics v_ditandai = row_count;

  raise notice '0180: % to-do pribadi tanpa tenggat diisi 23:59 WIB tanggal dibuatnya; % di antaranya sudah lewat dan tidak diberi pengingat susulan',
    coalesce(array_length(v_id, 1), 0), v_ditandai;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Constraint
-- ---------------------------------------------------------------------
alter table tasks drop constraint if exists tasks_pribadi_bertenggat;
alter table tasks
  add constraint tasks_pribadi_bertenggat check (
    tipe <> 'pribadi' or tenggat is not null
  );

comment on constraint tasks_pribadi_bertenggat on tasks is
  'To-do pribadi selalu bertanggal (D3, 0180).';

alter table tasks drop constraint if exists tasks_tanpa_jam_hanya_todo;
alter table tasks
  add constraint tasks_tanpa_jam_hanya_todo check (
    tipe = 'pribadi' or not tanpa_jam
  );

comment on constraint tasks_tanpa_jam_hanya_todo on tasks is
  'Tiket & komitmen wajib berjam; hanya to-do yang boleh tanpa jam (D3, 0180).';

-- ---------------------------------------------------------------------
-- 3. Tiket & komitmen BARU wajib bertenggat.
--
-- Proses sistem — seed, migrasi data lama lewat service role — menulis
-- riwayat apa adanya, sama seperti pengecualian di kunci isi tiket
-- (0181). Yang dijaga adalah tiket yang dibuat orang lewat aplikasi atau
-- API.
-- ---------------------------------------------------------------------
create or replace function wajib_tenggat_tiket_baru()
returns trigger
language plpgsql
as $$
begin
  if new.tipe <> 'pribadi'
     and new.tenggat is null
     and auth.uid() is not null then
    raise exception 'Tiket baru wajib punya tanggal dan jam tenggat'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_wajib_tenggat_tiket_baru on tasks;
create trigger tasks_wajib_tenggat_tiket_baru
  before insert on tasks
  for each row execute function wajib_tenggat_tiket_baru();

-- ---------------------------------------------------------------------
-- Rollback (manual, urut):
--   drop trigger if exists tasks_wajib_tenggat_tiket_baru on tasks;
--   drop function if exists wajib_tenggat_tiket_baru();
--   alter table tasks drop constraint if exists tasks_tanpa_jam_hanya_todo;
--   alter table tasks drop constraint if exists tasks_pribadi_bertenggat;
--   alter table tasks drop column if exists tanpa_jam;
-- To-do lama yang diisi 23:59 WIB tetap bertenggat; jumlahnya tercetak
-- sebagai NOTICE. Penanda pengingat yang ditulis di langkah 1 boleh
-- dibiarkan (hanya mencegah pengingat susulan untuk tenggat itu).
-- ---------------------------------------------------------------------
