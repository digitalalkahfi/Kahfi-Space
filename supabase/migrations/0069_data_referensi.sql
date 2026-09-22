-- =====================================================================
-- K-Space V2 — Data referensi organisasi (bukan data contoh)
--
-- Departemen, unit, dan program adalah tulang punggung hak akses:
-- `boleh_unit()`, lingkup KPI, sasaran laporan harian, dan penempatan
-- anggota semuanya bergantung padanya. Sampai sekarang isinya hanya ada
-- di `supabase/seed.sql` — berkas data contoh berisi nama-nama karangan
-- yang tidak akan dipasang di lingkungan sungguhan. Akibatnya pemasangan
-- yang benar (migrasi saja, tanpa seed) menghasilkan basis data tanpa
-- satu pun unit: peran unit tidak bisa dibuat, dan tak ada tempat untuk
-- melapor.
--
-- Karena itu isinya dipindahkan ke migrasi. Nilainya tetap yang
-- ditetapkan PRD §1: lima departemen, tiga unit pelaporan, dan program
-- per unit. Id unit sengaja sama persis dengan yang dipakai data contoh
-- supaya seed tetap menimpa baris yang sama, bukan menggandakannya.
-- =====================================================================

insert into departments (nama) values
  ('MCN'), ('TAP'), ('Affiliator'), ('MMC'), ('Mabit Scholar')
on conflict (nama) do nothing;

insert into units (id, kode, nama, department_id, deskripsi) values
  ('19570324-4683-5829-9eb5-4c69aa62222a', 'affiliator', 'Affiliator Network',
   (select id from departments where nama = 'Affiliator'),
   'Akun affiliator TikTok Shop; program Mabit Scholar ikut di sini.'),
  ('db5378cf-cefb-5acc-9e22-8d62911fe882', 'mcn', 'MCN (incl. MMC)',
   (select id from departments where nama = 'MCN'),
   'Multi-channel network; MMC sebagai pendukung.'),
  ('f1b49e07-9937-5915-bedc-37348bdf1ac1', 'tap', 'TAP (TikTok Agency Partner)',
   (select id from departments where nama = 'TAP'),
   'Brand ads campaign sebagai agency partner.')
on conflict (kode) do nothing;

-- Program per unit. "Reguler" ada di tiap unit supaya akun mana pun
-- punya penempatan bawaan; MMC dan Mabit Scholar hanya di unitnya.
insert into programs (id, nama, unit_id)
select
  -- Id tetap untuk dua program yang sudah dipakai data contoh; sisanya
  -- dibangkitkan sekali di sini.
  coalesce(p.id, gen_random_uuid()),
  p.nama,
  u.id
from units u
join (values
  ('bd30261c-89ca-5f3c-934e-682566c1e29b'::uuid, 'Mabit Scholar', 'affiliator'),
  ('566f6a36-a537-5e58-a02b-39f2330b6f81'::uuid, 'Reguler', 'affiliator'),
  ('5a03b042-d06f-5662-ab6c-13ba731bf701'::uuid, 'MMC', 'mcn'),
  (null, 'Reguler', 'mcn'),
  (null, 'Reguler', 'tap')
) as p (id, nama, kode) on p.kode = u.kode
on conflict (unit_id, nama) do nothing;

-- ---------------------------------------------------------------------
-- Indikator KPI per jabatan (PRD §3)
--
-- Sama alasannya dengan unit: tanpa indikator, `hitung_kpi` mengembalikan
-- cakupan 0 untuk semua orang, scorecard kosong, dan penguncian bulan
-- menolak karena tidak ada yang bisa dinilai. Bobot tiap jabatan berjumlah
-- 100; targetnya boleh disesuaikan kemudian lewat layar Definisi KPI.
-- ---------------------------------------------------------------------
insert into kpi_definitions
  (jabatan, nama_kpi, bobot, satuan, target_base, target_goal, target_stretch, sumber_data)
values
  ('Staff', 'Capaian GMV akun', 50, '%', 80, 100, 120, 'gmv'),
  ('Staff', 'Kedisiplinan absensi', 25, '%', 85, 95, 100, 'absensi'),
  ('Staff', 'Penyelesaian tiket', 25, '%', 70, 90, 100, 'tiket'),
  ('Leader', 'Capaian GMV unit', 45, '%', 85, 100, 120, 'gmv'),
  ('Leader', 'Eksekusi lead measure', 35, '%', 75, 95, 110, 'lead_measure'),
  ('Leader', 'Ketepatan laporan tim', 20, '%', 80, 95, 100, 'tiket'),
  ('Co-Leader', 'Capaian GMV unit', 40, '%', 80, 100, 115, 'gmv'),
  ('Co-Leader', 'Eksekusi lead measure', 35, '%', 75, 95, 110, 'lead_measure'),
  ('Co-Leader', 'Kedisiplinan absensi', 25, '%', 85, 95, 100, 'absensi'),
  ('Manager', 'Capaian GMV perusahaan', 60, '%', 85, 100, 120, 'gmv'),
  ('Manager', 'Kesehatan matriks WRM', 40, '%', 70, 90, 100, 'lead_measure'),
  ('CEO', 'Capaian GMV perusahaan', 60, '%', 85, 100, 115, 'gmv'),
  ('CEO', 'Kesehatan matriks WRM', 40, '%', 70, 90, 100, 'lead_measure'),
  ('Finance', 'Ketepatan tugas keuangan', 60, '%', 80, 95, 100, 'tiket'),
  ('Finance', 'Kedisiplinan absensi', 40, '%', 85, 95, 100, 'absensi')
on conflict (jabatan, nama_kpi) do nothing;
