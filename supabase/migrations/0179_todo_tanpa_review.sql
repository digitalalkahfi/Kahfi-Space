-- =====================================================================
-- K-Space V2 — To-do pribadi tanpa tahap Review/QC (keputusan D2)
--
-- QC hanya berlaku untuk tiket: to-do pribadi tidak punya pemeriksa,
-- dan papan tidak pernah menampilkan tombol QC untuknya. Tetapi status
-- `menunggu_qc` tetap bisa dituju, sehingga to-do yang diajukan ke
-- Review tertahan di kolom itu selamanya — tidak ada yang bisa
-- meloloskannya, dan pemiliknya tidak bisa mencentangnya.
--
-- Alur to-do kini: todo → berjalan → selesai (lewat centang atau
-- seret). Aturannya dijaga constraint, bukan hanya disembunyikan di UI.
--
-- Aman dijalankan ulang: pemindahan data hanya menyentuh baris yang
-- masih melanggar, dan constraint dibuat ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Data lama: to-do yang terjebak di Review/revisi kembali ke
--    "Sedang Dikerjakan", BUKAN ke "Selesai". Menandainya selesai tanpa
--    konfirmasi pemiliknya berarti pekerjaan itu hilang dari layar —
--    padahal belum tentu sudah beres. Dari "Sedang Dikerjakan" pemiliknya
--    tinggal mencentang bila memang sudah.
-- ---------------------------------------------------------------------
do $$
declare
  v_jumlah integer;
begin
  update tasks
     set status = 'berjalan',
         qc_status = 'belum'
   where tipe = 'pribadi'
     and status in ('menunggu_qc', 'revisi');

  get diagnostics v_jumlah = row_count;
  raise notice '0179: % to-do pribadi dipindah dari menunggu_qc/revisi ke berjalan',
    v_jumlah;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Constraint: to-do pribadi hanya todo, berjalan, selesai, atau
--    dibatalkan. Status `revisi` ikut tertutup — ia hanya lahir dari
--    keputusan QC, dan to-do tidak punya QC.
-- ---------------------------------------------------------------------
alter table tasks drop constraint if exists tasks_pribadi_tanpa_review;
alter table tasks
  add constraint tasks_pribadi_tanpa_review check (
    tipe <> 'pribadi'
    or status in ('todo', 'berjalan', 'selesai', 'dibatalkan')
  );

comment on constraint tasks_pribadi_tanpa_review on tasks is
  'To-do pribadi tidak punya tahap Review/QC (D2, 0179).';

-- ---------------------------------------------------------------------
-- Rollback (manual):
--   alter table tasks drop constraint if exists tasks_pribadi_tanpa_review;
-- Data to-do yang dipindah menunggu_qc/revisi → berjalan TIDAK
-- dikembalikan; jumlahnya tercetak sebagai NOTICE saat migrasi berjalan.
-- ---------------------------------------------------------------------
