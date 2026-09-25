-- =====================================================================
-- K-Space V2 — data contoh
--
-- DIBUAT OTOMATIS dari supabase/seed/data.json oleh scripts/buat-seed-sql.mjs.
-- Jangan disunting tangan; ubah JSON-nya lalu jalankan `npm run db:seed:sql`.
--
-- Idempoten: aman dijalankan ulang (on conflict do update).
-- =====================================================================

begin;

-- Departemen -----------------------------------------------------------
insert into departments (nama) values
  ('MCN'),
  ('TAP'),
  ('Affiliator'),
  ('MMC'),
  ('Mabit Scholar')
on conflict (nama) do nothing;

-- Unit pelaporan -------------------------------------------------------
insert into units (id, kode, nama, department_id, deskripsi) values
  ('19570324-4683-5829-9eb5-4c69aa62222a', 'affiliator', 'Affiliator Network', (select id from departments where nama = 'Affiliator'), 'Akun affiliator TikTok Shop; program Mabit Scholar ikut di sini.'),
  ('db5378cf-cefb-5acc-9e22-8d62911fe882', 'mcn', 'MCN (incl. MMC)', (select id from departments where nama = 'MCN'), 'Multi-channel network; MMC sebagai pendukung.'),
  ('f1b49e07-9937-5915-bedc-37348bdf1ac1', 'tap', 'TAP (TikTok Agency Partner)', (select id from departments where nama = 'TAP'), 'Brand ads campaign sebagai agency partner.')
on conflict (id) do update
  set nama = excluded.nama,
      department_id = excluded.department_id,
      deskripsi = excluded.deskripsi;

-- Program (atribut akun, bukan unit) -----------------------------------
insert into programs (id, nama, unit_id, aktif) values
  ('bd30261c-89ca-5f3c-934e-682566c1e29b', 'Mabit Scholar', '19570324-4683-5829-9eb5-4c69aa62222a', true),
  ('566f6a36-a537-5e58-a02b-39f2330b6f81', 'Reguler', '19570324-4683-5829-9eb5-4c69aa62222a', true),
  ('5a03b042-d06f-5662-ab6c-13ba731bf701', 'MMC', 'db5378cf-cefb-5acc-9e22-8d62911fe882', true)
on conflict (id) do update set nama = excluded.nama, aktif = excluded.aktif;

-- Anggota tim ----------------------------------------------------------
insert into users
  (id, nama, email, role, jabatan, unit_id, program_id, department_id, kontak, status)
values
  ('7019770e-faea-5467-98ad-3c4a088d602e', 'Farhan Pratama', 'farhan@alkahfi.co.id', 'Manager', 'Manager Operasional Al-Kahfi Corp', null, null, null, '+6281234567890', 'aktif'),
  ('9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', 'Hafidz Alkahfi', 'hafidz@alkahfi.co.id', 'CEO', 'CEO Al-Kahfi Corp', null, null, null, '+6281122334455', 'aktif'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', 'Rian Hidayat', 'rian@alkahfi.co.id', 'Staff', 'Staff Affiliator · PIC akun beauty', '19570324-4683-5829-9eb5-4c69aa62222a', null, null, '+6285700112233', 'aktif'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', 'Nabila Putri', 'nabila@alkahfi.co.id', 'Staff', 'Staff Affiliator', '19570324-4683-5829-9eb5-4c69aa62222a', null, null, '+6281399887766', 'aktif'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', 'Bayu Nugraha', 'bayu@alkahfi.co.id', 'Staff', 'Staff Affiliator', '19570324-4683-5829-9eb5-4c69aa62222a', null, null, null, 'aktif'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', 'Dimas Maulana', 'dimas@alkahfi.co.id', 'Leader', 'Leader TAP', 'f1b49e07-9937-5915-bedc-37348bdf1ac1', null, null, null, 'aktif'),
  ('581aa0ce-6f9c-5d52-8922-c102e64aa12c', 'Maya Safitri', 'maya@alkahfi.co.id', 'Co-Leader', 'Co-Leader MCN', 'db5378cf-cefb-5acc-9e22-8d62911fe882', null, null, null, 'aktif'),
  ('56e8a824-7195-5cca-8b01-80b5516bd3db', 'Rizky Ananda', 'rizky@alkahfi.co.id', 'Staff', 'Staff MCN', 'db5378cf-cefb-5acc-9e22-8d62911fe882', null, null, '+6285711223344', 'aktif'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', 'Intan Permata', 'intan@alkahfi.co.id', 'Staff', 'Staff Affiliator', '19570324-4683-5829-9eb5-4c69aa62222a', null, null, null, 'aktif'),
  ('73eab5ac-5007-5391-913e-01e9ad855f45', 'Yoga Saputra', 'yoga@alkahfi.co.id', 'Staff', 'Staff TAP', 'f1b49e07-9937-5915-bedc-37348bdf1ac1', null, null, null, 'aktif'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', 'Salsabila Rahma', 'salsabila@alkahfi.co.id', 'Staff', 'Staff Affiliator · Mabit Scholar', '19570324-4683-5829-9eb5-4c69aa62222a', 'bd30261c-89ca-5f3c-934e-682566c1e29b', (select id from departments where nama = 'Mabit Scholar'), null, 'aktif'),
  ('72005e8f-e3c0-51fe-ade9-0d6f3a5d508d', 'Fajar Ramadhan', 'fajar@alkahfi.co.id', 'Staff', 'Staff MCN', 'db5378cf-cefb-5acc-9e22-8d62911fe882', null, null, null, 'aktif'),
  ('7f52935c-fccd-55c6-9d33-341cf854fb18', 'Anisa Larasati', 'anisa@alkahfi.co.id', 'Staff', 'Staff Affiliator', '19570324-4683-5829-9eb5-4c69aa62222a', null, null, null, 'aktif'),
  ('fd438ea5-9664-51d4-9fed-4744fe5c6d8d', 'Hendra Kusuma', 'hendra@alkahfi.co.id', 'Staff', 'Staff TAP', 'f1b49e07-9937-5915-bedc-37348bdf1ac1', null, null, null, 'aktif'),
  ('66f8b261-08cb-58cd-980d-ea3cb7f2f61d', 'Putri Amelia', 'putri@alkahfi.co.id', 'Staff', 'Staff MCN', 'db5378cf-cefb-5acc-9e22-8d62911fe882', null, null, null, 'aktif'),
  ('48e841ca-3e54-5c76-a7c5-084b7cd81677', 'Arif Setiawan', 'arif@alkahfi.co.id', 'Staff', 'Staff Affiliator', '19570324-4683-5829-9eb5-4c69aa62222a', null, null, null, 'aktif'),
  ('e2391748-8e38-5009-b5d6-758e232c6381', 'Dewi Lestari', 'dewi@alkahfi.co.id', 'Leader', 'Leader Affiliator', '19570324-4683-5829-9eb5-4c69aa62222a', null, null, '+6282155667788', 'aktif'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', 'Galih Prakoso', 'galih@alkahfi.co.id', 'Leader', 'Leader MCN', 'db5378cf-cefb-5acc-9e22-8d62911fe882', null, null, null, 'aktif'),
  ('2f4160f3-fea1-5b98-ba6c-f93645b4fbc0', 'Vina Oktaviani', 'vina@alkahfi.co.id', 'Staff', 'Staff TAP', 'f1b49e07-9937-5915-bedc-37348bdf1ac1', null, null, null, 'aktif'),
  ('670c9117-473d-5c0a-8ccd-1cfac0f0f80b', 'Rendi Firmansyah', 'rendi@alkahfi.co.id', 'Staff', 'Staff Affiliator', '19570324-4683-5829-9eb5-4c69aa62222a', null, null, null, 'aktif'),
  ('0c613b14-b429-57b2-aed0-395751a41d97', 'Bagas Adriansyah', 'bagas@alkahfi.co.id', 'Staff', 'Staff Affiliator · Mabit Scholar', '19570324-4683-5829-9eb5-4c69aa62222a', 'bd30261c-89ca-5f3c-934e-682566c1e29b', (select id from departments where nama = 'Mabit Scholar'), null, 'aktif'),
  ('2a6feda0-dc3c-5aeb-9122-0640f53e3c33', 'Laras Ayuningtyas', 'laras@alkahfi.co.id', 'Finance', 'Finance Al-Kahfi Corp', null, null, null, '+6281199887766', 'aktif'),
  ('2752b688-eaaa-574c-b84e-ab675064d7be', 'Teguh Wibowo', 'teguh@alkahfi.co.id', 'Staff', 'Staff Affiliator', '19570324-4683-5829-9eb5-4c69aa62222a', null, null, null, 'aktif'),
  ('26acd2f9-a9bd-5479-84e9-6ecf01b58709', 'Sinta Maharani', 'sinta@alkahfi.co.id', 'Staff', 'Staff MCN', 'db5378cf-cefb-5acc-9e22-8d62911fe882', null, null, null, 'aktif'),
  ('f65668c7-d2d9-5812-b4a9-2e085cce40c6', 'Eko Prasetyo', 'eko@alkahfi.co.id', 'Staff', 'Staff TAP', 'f1b49e07-9937-5915-bedc-37348bdf1ac1', null, null, null, 'aktif'),
  ('b7c1e0d2-4a3f-5e6b-8c9d-1f2a3b4c5d6e', 'Yusuf Ramadhan', 'yusuf@alkahfi.co.id', 'Staff', 'Staff Affiliator', '19570324-4683-5829-9eb5-4c69aa62222a', null, null, null, 'nonaktif')
on conflict (id) do update
  set nama = excluded.nama,
      email = excluded.email,
      role = excluded.role,
      jabatan = excluded.jabatan,
      unit_id = excluded.unit_id,
      program_id = excluded.program_id,
      department_id = excluded.department_id,
      kontak = excluded.kontak,
      status = excluded.status;

-- Atasan langsung (dasar alur tiket, QC, dan persetujuan).
update users set atasan_id = '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33' where id = '7019770e-faea-5467-98ad-3c4a088d602e';
update users set atasan_id = 'e2391748-8e38-5009-b5d6-758e232c6381' where id = '484a9a6a-149f-56d0-a15a-9215cf7403a3';
update users set atasan_id = 'e2391748-8e38-5009-b5d6-758e232c6381' where id = 'ad72efba-7708-5742-9bea-3e70ead115f2';
update users set atasan_id = 'e2391748-8e38-5009-b5d6-758e232c6381' where id = '83dc3963-466d-5d71-93d3-0815f1fd926b';
update users set atasan_id = '7019770e-faea-5467-98ad-3c4a088d602e' where id = 'c5631790-4df7-5d06-b9db-ee468783017f';
update users set atasan_id = '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97' where id = '581aa0ce-6f9c-5d52-8922-c102e64aa12c';
update users set atasan_id = '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97' where id = '56e8a824-7195-5cca-8b01-80b5516bd3db';
update users set atasan_id = 'e2391748-8e38-5009-b5d6-758e232c6381' where id = 'dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9';
update users set atasan_id = 'c5631790-4df7-5d06-b9db-ee468783017f' where id = '73eab5ac-5007-5391-913e-01e9ad855f45';
update users set atasan_id = 'e2391748-8e38-5009-b5d6-758e232c6381' where id = 'ff63318a-dd1f-5438-bb27-88987420c0d9';
update users set atasan_id = '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97' where id = '72005e8f-e3c0-51fe-ade9-0d6f3a5d508d';
update users set atasan_id = 'e2391748-8e38-5009-b5d6-758e232c6381' where id = '7f52935c-fccd-55c6-9d33-341cf854fb18';
update users set atasan_id = 'c5631790-4df7-5d06-b9db-ee468783017f' where id = 'fd438ea5-9664-51d4-9fed-4744fe5c6d8d';
update users set atasan_id = '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97' where id = '66f8b261-08cb-58cd-980d-ea3cb7f2f61d';
update users set atasan_id = 'e2391748-8e38-5009-b5d6-758e232c6381' where id = '48e841ca-3e54-5c76-a7c5-084b7cd81677';
update users set atasan_id = '7019770e-faea-5467-98ad-3c4a088d602e' where id = 'e2391748-8e38-5009-b5d6-758e232c6381';
update users set atasan_id = '7019770e-faea-5467-98ad-3c4a088d602e' where id = '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97';
update users set atasan_id = 'c5631790-4df7-5d06-b9db-ee468783017f' where id = '2f4160f3-fea1-5b98-ba6c-f93645b4fbc0';
update users set atasan_id = 'e2391748-8e38-5009-b5d6-758e232c6381' where id = '670c9117-473d-5c0a-8ccd-1cfac0f0f80b';
update users set atasan_id = 'e2391748-8e38-5009-b5d6-758e232c6381' where id = '0c613b14-b429-57b2-aed0-395751a41d97';
update users set atasan_id = '7019770e-faea-5467-98ad-3c4a088d602e' where id = '2a6feda0-dc3c-5aeb-9122-0640f53e3c33';
update users set atasan_id = 'e2391748-8e38-5009-b5d6-758e232c6381' where id = '2752b688-eaaa-574c-b84e-ab675064d7be';
update users set atasan_id = '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97' where id = '26acd2f9-a9bd-5479-84e9-6ecf01b58709';
update users set atasan_id = 'c5631790-4df7-5d06-b9db-ee468783017f' where id = 'f65668c7-d2d9-5812-b4a9-2e085cce40c6';
update users set atasan_id = 'e2391748-8e38-5009-b5d6-758e232c6381' where id = 'b7c1e0d2-4a3f-5e6b-8c9d-1f2a3b4c5d6e';

-- Akun affiliator ------------------------------------------------------
insert into accounts (id, platform, username, pic_user_id, co_leader_id, unit_id, program_id, level) values
  ('23f37851-57bd-55bd-9d1a-8699874b39a1', 'TikTok Shop', '@skincare_official', '484a9a6a-149f-56d0-a15a-9215cf7403a3', 'e2391748-8e38-5009-b5d6-758e232c6381', '19570324-4683-5829-9eb5-4c69aa62222a', '566f6a36-a537-5e58-a02b-39f2330b6f81', 0),
  ('6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', 'TikTok Shop', '@beauty_daily.id', '484a9a6a-149f-56d0-a15a-9215cf7403a3', 'e2391748-8e38-5009-b5d6-758e232c6381', '19570324-4683-5829-9eb5-4c69aa62222a', 'bd30261c-89ca-5f3c-934e-682566c1e29b', 1),
  ('341fd812-5440-518a-af7c-d9e589d9cc39', 'TikTok Shop', '@fashion_hijab', 'ad72efba-7708-5742-9bea-3e70ead115f2', 'e2391748-8e38-5009-b5d6-758e232c6381', '19570324-4683-5829-9eb5-4c69aa62222a', '566f6a36-a537-5e58-a02b-39f2330b6f81', 2),
  ('4bcb8165-a584-5d5b-a194-859250042d96', 'TikTok Shop', '@gadget_daily', '83dc3963-466d-5d71-93d3-0815f1fd926b', 'e2391748-8e38-5009-b5d6-758e232c6381', '19570324-4683-5829-9eb5-4c69aa62222a', '566f6a36-a537-5e58-a02b-39f2330b6f81', 0),
  ('8fedddaa-ad4e-5faa-b7a0-9aa815be177f', 'TikTok Shop', '@snack_nusantara', 'dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', 'e2391748-8e38-5009-b5d6-758e232c6381', '19570324-4683-5829-9eb5-4c69aa62222a', 'bd30261c-89ca-5f3c-934e-682566c1e29b', 0),
  ('87969379-7771-5c7a-bc4b-d4e5983b59be', 'TikTok Shop', '@home_essentials', 'ff63318a-dd1f-5438-bb27-88987420c0d9', 'e2391748-8e38-5009-b5d6-758e232c6381', '19570324-4683-5829-9eb5-4c69aa62222a', '566f6a36-a537-5e58-a02b-39f2330b6f81', 1)
on conflict (id) do update
  set pic_user_id = excluded.pic_user_id,
      co_leader_id = excluded.co_leader_id,
      program_id = excluded.program_id,
      level = excluded.level;

-- Riwayat level akun ---------------------------------------------------
-- Baris "ditetapkan" yang dibuat trigger saat akun disisipkan dibuang
-- dulu: stempel waktunya adalah waktu seed dijalankan, bukan waktu
-- levelnya benar-benar ditetapkan, dan riwayat dengan dua baris awal
-- yang saling bertentangan lebih membingungkan daripada tanpa riwayat.
delete from account_level_events;

insert into account_level_events
  (account_id, dari, ke, oleh_id, alasan, created_at) values
  ('23f37851-57bd-55bd-9d1a-8699874b39a1', null, 0, '7019770e-faea-5467-98ad-3c4a088d602e', 'Akun baru, mulai dari level dasar', '2024-07-01T09:10:00+07:00'),
  ('6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 0, '7019770e-faea-5467-98ad-3c4a088d602e', 'Akun baru, mulai dari level dasar', '2024-07-01T09:12:00+07:00'),
  ('6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', 0, 1, '7019770e-faea-5467-98ad-3c4a088d602e', 'Tiga bulan berturut melewati minimum, ritme unggahan stabil', '2024-10-01T08:40:00+07:00'),
  ('341fd812-5440-518a-af7c-d9e589d9cc39', null, 0, '7019770e-faea-5467-98ad-3c4a088d602e', 'Akun baru, mulai dari level dasar', '2024-07-01T09:14:00+07:00'),
  ('341fd812-5440-518a-af7c-d9e589d9cc39', 0, 3, '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', 'Target dinaikkan mengikuti kampanye Ramadan', '2024-09-02T10:05:00+07:00'),
  ('341fd812-5440-518a-af7c-d9e589d9cc39', 3, 2, '7019770e-faea-5467-98ad-3c4a088d602e', 'Diturunkan setelah dua bulan tidak pernah menyentuh minimum', '2024-10-14T16:20:00+07:00'),
  ('4bcb8165-a584-5d5b-a194-859250042d96', null, 0, '7019770e-faea-5467-98ad-3c4a088d602e', 'Akun baru, mulai dari level dasar', '2024-07-01T09:16:00+07:00'),
  ('8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 0, '7019770e-faea-5467-98ad-3c4a088d602e', 'Akun baru, mulai dari level dasar', '2024-07-01T09:18:00+07:00'),
  ('87969379-7771-5c7a-bc4b-d4e5983b59be', null, 0, '7019770e-faea-5467-98ad-3c4a088d602e', 'Akun baru, mulai dari level dasar', '2024-07-01T09:20:00+07:00'),
  ('87969379-7771-5c7a-bc4b-d4e5983b59be', 0, 1, '7019770e-faea-5467-98ad-3c4a088d602e', 'Volume unggahan naik stabil sejak kampanye peralatan rumah', '2024-09-16T11:30:00+07:00');

-- Pengumuman -----------------------------------------------------------
insert into announcements
  (slug, judul, ringkasan, isi, target_role, target_unit_id, disematkan, dibuat_oleh, published_at) values
  ('cutoff-partner-center', 'Cutoff Partner Center', 'Sinkronisasi GRD laporan GMV malam ini dipercepat menjadi pukul 20.00 WIB.', array['Batas penutupan sinkronisasi GRD untuk laporan GMV malam ini dipercepat menjadi pukul 20.00 WIB, dari yang biasanya 23.59 WIB. Percepatan ini disiapkan untuk evaluasi mingguan besok pagi.', 'Mohon seluruh PIC akun affiliator dan Leader unit MCN serta TAP menyelesaikan input GMV di menu Laporan Harian sebelum pukul 19.30 WIB, agar masih ada waktu memeriksa angka terhadap Partner Center.', 'Laporan yang masuk setelah cutoff tetap tercatat, tetapi tidak ikut terhitung pada rekap mingguan yang dibahas besok.'], null, null, true, '7019770e-faea-5467-98ad-3c4a088d602e', '2024-10-24T09:00:00+07:00'),
  ('revisi-alur-qc-tiket', 'Revisi alur QC tiket', 'Tiket yang sudah diperiksa Leader kini perlu satu kali konfirmasi balik dari pembuat tiket.', array['Mulai pekan ini, tiket yang statusnya sudah diperiksa (QC) oleh Leader tidak langsung berubah menjadi selesai. Pembuat tiket perlu memberi satu konfirmasi balik bahwa hasilnya sesuai permintaan.', 'Tujuannya menutup celah tiket yang ditandai selesai padahal hasilnya masih perlu perbaikan. Perubahan status tetap tercatat lengkap di jejak audit.'], 'Leader', null, false, '7019770e-faea-5467-98ad-3c4a088d602e', '2024-10-23T16:30:00+07:00'),
  ('jadwal-standup-oktober', 'Jadwal standup Oktober', 'Standup harian unit Affiliator bergeser ke pukul 09.00 WIB sampai akhir bulan.', array['Standup harian unit Affiliator bergeser dari pukul 08.30 WIB menjadi 09.00 WIB sampai akhir Oktober, menyesuaikan jam live pagi yang ditambah.', 'Unit MCN dan TAP tidak terpengaruh dan tetap mulai pukul 08.30 WIB.'], null, '19570324-4683-5829-9eb5-4c69aa62222a', false, 'e2391748-8e38-5009-b5d6-758e232c6381', '2024-10-21T07:15:00+07:00')
on conflict (slug) do update
  set judul = excluded.judul,
      ringkasan = excluded.ringkasan,
      isi = excluded.isi,
      target_role = excluded.target_role,
      target_unit_id = excluded.target_unit_id,
      disematkan = excluded.disematkan,
      published_at = excluded.published_at;

-- Goal unit & akun -----------------------------------------------------
insert into goals
  (id, judul, level, pemilik_id, unit_id, account_id, satuan,
   target_base, target_goal, target_stretch, periode, dibuat_oleh) values
  ('3fb5b63e-0edc-5124-8ccf-504549fc9de7', 'GMV perusahaan Oktober 2024', 'company', '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', null, null, 'IDR', 930000000, 1162500000, 1453125000, '2024-Q4', '7019770e-faea-5467-98ad-3c4a088d602e'),
  ('f3e9fd84-efee-52ea-911e-a908b5093f74', 'GMV operasional Oktober 2024', 'manager', '7019770e-faea-5467-98ad-3c4a088d602e', null, null, 'IDR', 930000000, 1162500000, 1395000000, '2024-Q4', '7019770e-faea-5467-98ad-3c4a088d602e'),
  ('0844d12e-eb26-5be5-ac8a-db6e4d7113e2', 'GMV bulanan unit AFFILIATOR', 'leader', 'e2391748-8e38-5009-b5d6-758e232c6381', '19570324-4683-5829-9eb5-4c69aa62222a', null, 'IDR', 496000000, 620000000, 744000000, '2024-Q4', '7019770e-faea-5467-98ad-3c4a088d602e'),
  ('21b36aa0-2fe0-58e5-a7bb-58c202d71bf1', 'GMV bulanan unit MCN', 'leader', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', 'db5378cf-cefb-5acc-9e22-8d62911fe882', null, 'IDR', 310000000, 387500000, 465000000, '2024-Q4', '7019770e-faea-5467-98ad-3c4a088d602e'),
  ('21e8a8a0-afdf-589d-a6e8-e18d2b920b0a', 'GMV bulanan unit TAP', 'leader', 'c5631790-4df7-5d06-b9db-ee468783017f', 'f1b49e07-9937-5915-bedc-37348bdf1ac1', null, 'IDR', 124000000, 155000000, 186000000, '2024-Q4', '7019770e-faea-5467-98ad-3c4a088d602e'),
  ('24ca497b-8472-57c8-a3a7-44d4d2f81acf', 'GMV bulanan @skincare_official', 'account', '484a9a6a-149f-56d0-a15a-9215cf7403a3', null, '23f37851-57bd-55bd-9d1a-8699874b39a1', 'IDR', 111600000, 139500000, 167400000, '2024-Q4', '7019770e-faea-5467-98ad-3c4a088d602e'),
  ('a85afd06-e3f2-5b85-992f-6732bd543394', 'GMV bulanan @beauty_daily.id', 'account', '484a9a6a-149f-56d0-a15a-9215cf7403a3', null, '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', 'IDR', 74400000, 93000000, 111600000, '2024-Q4', '7019770e-faea-5467-98ad-3c4a088d602e'),
  ('dfcae26c-b716-5e38-9de3-3a68890413f2', 'GMV bulanan @fashion_hijab', 'account', 'ad72efba-7708-5742-9bea-3e70ead115f2', null, '341fd812-5440-518a-af7c-d9e589d9cc39', 'IDR', 86800000, 108500000, 130200000, '2024-Q4', '7019770e-faea-5467-98ad-3c4a088d602e'),
  ('26c6d65a-d4d7-5a2c-b44e-647701fd767c', 'GMV bulanan @gadget_daily', 'account', '83dc3963-466d-5d71-93d3-0815f1fd926b', null, '4bcb8165-a584-5d5b-a194-859250042d96', 'IDR', 99200000, 124000000, 148800000, '2024-Q4', '7019770e-faea-5467-98ad-3c4a088d602e'),
  ('f9774007-22de-5136-8497-0fe82d95aaea', 'GMV bulanan @snack_nusantara', 'account', 'dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', null, '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', 'IDR', 62000000, 77500000, 93000000, '2024-Q4', '7019770e-faea-5467-98ad-3c4a088d602e'),
  ('d8b3f49b-4999-5c04-85e2-e135bc6826d5', 'GMV bulanan @home_essentials', 'account', 'ff63318a-dd1f-5438-bb27-88987420c0d9', null, '87969379-7771-5c7a-bc4b-d4e5983b59be', 'IDR', 62000000, 77500000, 93000000, '2024-Q4', '7019770e-faea-5467-98ad-3c4a088d602e')
on conflict (id) do update
  set target_base = excluded.target_base,
      target_goal = excluded.target_goal,
      target_stretch = excluded.target_stretch,
      pemilik_id = excluded.pemilik_id;

-- Rantai roll-down diisi setelah seluruh goal ada.
update goals set parent_goal_id = '3fb5b63e-0edc-5124-8ccf-504549fc9de7' where id = 'f3e9fd84-efee-52ea-911e-a908b5093f74';
update goals set parent_goal_id = 'f3e9fd84-efee-52ea-911e-a908b5093f74' where id = '0844d12e-eb26-5be5-ac8a-db6e4d7113e2';
update goals set parent_goal_id = 'f3e9fd84-efee-52ea-911e-a908b5093f74' where id = '21b36aa0-2fe0-58e5-a7bb-58c202d71bf1';
update goals set parent_goal_id = 'f3e9fd84-efee-52ea-911e-a908b5093f74' where id = '21e8a8a0-afdf-589d-a6e8-e18d2b920b0a';
update goals set parent_goal_id = '0844d12e-eb26-5be5-ac8a-db6e4d7113e2' where id = '24ca497b-8472-57c8-a3a7-44d4d2f81acf';
update goals set parent_goal_id = '0844d12e-eb26-5be5-ac8a-db6e4d7113e2' where id = 'a85afd06-e3f2-5b85-992f-6732bd543394';
update goals set parent_goal_id = '0844d12e-eb26-5be5-ac8a-db6e4d7113e2' where id = 'dfcae26c-b716-5e38-9de3-3a68890413f2';
update goals set parent_goal_id = '0844d12e-eb26-5be5-ac8a-db6e4d7113e2' where id = '26c6d65a-d4d7-5a2c-b44e-647701fd767c';
update goals set parent_goal_id = '0844d12e-eb26-5be5-ac8a-db6e4d7113e2' where id = 'f9774007-22de-5136-8497-0fe82d95aaea';
update goals set parent_goal_id = '0844d12e-eb26-5be5-ac8a-db6e4d7113e2' where id = 'd8b3f49b-4999-5c04-85e2-e135bc6826d5';

-- Anak tangga bulanan --------------------------------------------------
insert into goal_months (goal_id, bulan, target) values
  ('3fb5b63e-0edc-5124-8ccf-504549fc9de7', '2024-10-01', 1162500000),
  ('3fb5b63e-0edc-5124-8ccf-504549fc9de7', '2024-11-01', 1255500000),
  ('3fb5b63e-0edc-5124-8ccf-504549fc9de7', '2024-12-01', 1395000000),
  ('f3e9fd84-efee-52ea-911e-a908b5093f74', '2024-10-01', 1162500000),
  ('f3e9fd84-efee-52ea-911e-a908b5093f74', '2024-11-01', 1255500000),
  ('f3e9fd84-efee-52ea-911e-a908b5093f74', '2024-12-01', 1395000000),
  ('0844d12e-eb26-5be5-ac8a-db6e4d7113e2', '2024-10-01', 620000000),
  ('0844d12e-eb26-5be5-ac8a-db6e4d7113e2', '2024-11-01', 669600000),
  ('0844d12e-eb26-5be5-ac8a-db6e4d7113e2', '2024-12-01', 744000000),
  ('21b36aa0-2fe0-58e5-a7bb-58c202d71bf1', '2024-10-01', 387500000),
  ('21b36aa0-2fe0-58e5-a7bb-58c202d71bf1', '2024-11-01', 418500000),
  ('21b36aa0-2fe0-58e5-a7bb-58c202d71bf1', '2024-12-01', 465000000),
  ('21e8a8a0-afdf-589d-a6e8-e18d2b920b0a', '2024-10-01', 155000000),
  ('21e8a8a0-afdf-589d-a6e8-e18d2b920b0a', '2024-11-01', 167400000),
  ('21e8a8a0-afdf-589d-a6e8-e18d2b920b0a', '2024-12-01', 186000000),
  ('24ca497b-8472-57c8-a3a7-44d4d2f81acf', '2024-10-01', 139500000),
  ('24ca497b-8472-57c8-a3a7-44d4d2f81acf', '2024-11-01', 150660000),
  ('24ca497b-8472-57c8-a3a7-44d4d2f81acf', '2024-12-01', 167400000),
  ('a85afd06-e3f2-5b85-992f-6732bd543394', '2024-10-01', 93000000),
  ('a85afd06-e3f2-5b85-992f-6732bd543394', '2024-11-01', 100440000),
  ('a85afd06-e3f2-5b85-992f-6732bd543394', '2024-12-01', 111600000),
  ('dfcae26c-b716-5e38-9de3-3a68890413f2', '2024-10-01', 108500000),
  ('dfcae26c-b716-5e38-9de3-3a68890413f2', '2024-11-01', 117180000),
  ('dfcae26c-b716-5e38-9de3-3a68890413f2', '2024-12-01', 130200000),
  ('26c6d65a-d4d7-5a2c-b44e-647701fd767c', '2024-10-01', 124000000),
  ('26c6d65a-d4d7-5a2c-b44e-647701fd767c', '2024-11-01', 133920000),
  ('26c6d65a-d4d7-5a2c-b44e-647701fd767c', '2024-12-01', 148800000),
  ('f9774007-22de-5136-8497-0fe82d95aaea', '2024-10-01', 77500000),
  ('f9774007-22de-5136-8497-0fe82d95aaea', '2024-11-01', 83700000),
  ('f9774007-22de-5136-8497-0fe82d95aaea', '2024-12-01', 93000000),
  ('d8b3f49b-4999-5c04-85e2-e135bc6826d5', '2024-10-01', 77500000),
  ('d8b3f49b-4999-5c04-85e2-e135bc6826d5', '2024-11-01', 83700000),
  ('d8b3f49b-4999-5c04-85e2-e135bc6826d5', '2024-12-01', 93000000)
on conflict (goal_id, bulan) do update set target = excluded.target;

-- Laporan harian per akun ----------------------------------------------
insert into daily_reports
  (user_id, tanggal, account_id, unit_id, gmv, komisi, jumlah_upload,
   catatan, submitted_at) values
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-01', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 4176000, 543000, 3, '', '2024-10-01T18:18:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-01', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2784000, 223000, 2, '', '2024-10-01T19:32:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-01', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3248000, 292000, 2, '', '2024-10-01T17:18:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-01', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3712000, 334000, 2, '', '2024-10-01T18:05:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-01', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2320000, 209000, 4, '', '2024-10-01T19:47:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-01', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2320000, 209000, 5, '', '2024-10-01T18:47:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-02', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 4146000, 332000, 3, '', '2024-10-02T17:47:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-02', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2763000, 249000, 2, '', '2024-10-02T18:05:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-02', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3223000, 322000, 2, '', '2024-10-02T18:47:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-02', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3684000, 368000, 3, '', '2024-10-02T19:18:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-02', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2302000, 230000, 4, '', '2024-10-02T17:32:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-02', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2302000, 230000, 5, '', '2024-10-02T17:32:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-03', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 4416000, 397000, 4, '', '2024-10-03T19:47:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-03', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2943000, 294000, 2, '', '2024-10-03T19:05:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-03', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3433000, 378000, 2, '', '2024-10-03T17:18:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-03', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3924000, 432000, 3, '', '2024-10-03T19:47:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-03', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2452000, 270000, 4, '', '2024-10-03T17:18:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-03', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2452000, 270000, 5, '', '2024-10-03T18:47:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-04', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 3903000, 390000, 4, '', '2024-10-04T19:18:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-04', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2601000, 286000, 2, '', '2024-10-04T18:47:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-04', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3034000, 364000, 2, '', '2024-10-04T17:32:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-04', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3468000, 416000, 3, '', '2024-10-04T19:32:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-04', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2167000, 260000, 5, '', '2024-10-04T17:18:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-04', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2167000, 260000, 5, '', '2024-10-04T18:05:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-05', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 3726000, 410000, 4, '', '2024-10-05T19:32:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-05', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2482000, 298000, 2, '', '2024-10-05T19:05:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-05', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 2896000, 376000, 2, '', '2024-10-05T17:32:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-05', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3310000, 430000, 3, '', '2024-10-05T17:18:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-05', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2068000, 269000, 5, '', '2024-10-05T17:47:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-05', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2068000, 269000, 6, '', '2024-10-05T18:05:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-07', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 3748000, 487000, 4, '', '2024-10-07T19:32:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-07', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2497000, 200000, 2, '', '2024-10-07T19:32:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-07', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 2913000, 262000, 3, '', '2024-10-07T17:47:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-07', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3330000, 300000, 3, '', '2024-10-07T19:32:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-07', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2081000, 187000, 5, '', '2024-10-07T18:05:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-07', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2081000, 187000, 6, '', '2024-10-07T19:47:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-08', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 3852000, 308000, 4, '', '2024-10-08T18:05:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-08', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2566000, 231000, 3, '', '2024-10-08T19:32:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-08', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 2994000, 299000, 3, '', '2024-10-08T18:18:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-08', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3422000, 342000, 3, '', '2024-10-08T17:05:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-08', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2138000, 214000, 5, '', '2024-10-08T18:32:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-08', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2138000, 214000, 6, '', '2024-10-08T18:47:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-09', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 4632000, 417000, 4, '', '2024-10-09T19:18:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-09', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 3087000, 309000, 3, '', '2024-10-09T17:18:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-09', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3601000, 396000, 3, '', '2024-10-09T19:05:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-09', '4bcb8165-a584-5d5b-a194-859250042d96', null, 4116000, 453000, 4, '', '2024-10-09T18:18:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-09', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2572000, 283000, 5, '', '2024-10-09T18:05:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-09', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2572000, 283000, 6, '', '2024-10-09T17:05:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-10', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 3852000, 501000, 3, '', '2024-10-10T19:18:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-10', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2566000, 205000, 6, '', '2024-10-10T17:47:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-10', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 2994000, 269000, 6, '', '2024-10-10T17:32:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-10', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3422000, 308000, 2, '', '2024-10-10T18:32:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-10', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2138000, 192000, 3, '', '2024-10-10T19:32:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-10', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2138000, 192000, 4, '', '2024-10-10T19:32:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-11', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 4581000, 366000, 3, '', '2024-10-11T17:47:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-11', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 3052000, 275000, 6, '', '2024-10-11T19:18:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-11', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3561000, 356000, 6, '', '2024-10-11T17:18:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-11', '4bcb8165-a584-5d5b-a194-859250042d96', null, 4070000, 407000, 2, '', '2024-10-11T17:18:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-11', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2543000, 254000, 4, '', '2024-10-11T19:32:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-11', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2543000, 254000, 4, '', '2024-10-11T17:18:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-12', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 4149000, 373000, 3, '', '2024-10-12T19:05:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-12', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2764000, 276000, 6, '', '2024-10-12T18:47:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-12', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3225000, 355000, 6, '', '2024-10-12T17:32:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-12', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3686000, 405000, 2, '', '2024-10-12T19:05:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-12', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2303000, 253000, 4, '', '2024-10-12T17:05:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-12', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2303000, 253000, 5, '', '2024-10-12T17:32:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-14', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 5094000, 560000, 3, '', '2024-10-14T18:32:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-14', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 3396000, 408000, 6, '', '2024-10-14T17:05:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-14', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3962000, 515000, 2, '', '2024-10-14T17:47:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-14', '4bcb8165-a584-5d5b-a194-859250042d96', null, 4528000, 589000, 2, '', '2024-10-14T18:05:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-14', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2830000, 368000, 4, '', '2024-10-14T17:18:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-14', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2830000, 368000, 5, '', '2024-10-14T17:18:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-15', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 4491000, 539000, 3, '', '2024-10-15T19:18:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-15', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2992000, 389000, 2, '', '2024-10-15T19:05:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-15', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3491000, 279000, 2, '', '2024-10-15T17:05:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-15', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3990000, 319000, 2, '', '2024-10-15T17:32:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-15', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2493000, 199000, 4, '', '2024-10-15T19:47:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-15', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2493000, 199000, 5, '', '2024-10-15T18:05:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-16', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 4707000, 612000, 3, '', '2024-10-16T19:18:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-16', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 3138000, 251000, 2, '', '2024-10-16T17:32:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-16', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3661000, 329000, 2, '', '2024-10-16T17:32:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-16', '4bcb8165-a584-5d5b-a194-859250042d96', null, 4184000, 377000, 3, '', '2024-10-16T19:05:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-16', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2615000, 235000, 4, '', '2024-10-16T18:32:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-16', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2615000, 235000, 5, '', '2024-10-16T18:47:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-17', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 4221000, 338000, 4, '', '2024-10-17T18:05:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-17', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2814000, 253000, 2, '', '2024-10-17T18:18:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-17', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3283000, 328000, 2, '', '2024-10-17T18:05:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-17', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3752000, 375000, 3, '', '2024-10-17T18:32:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-17', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2345000, 234000, 4, '', '2024-10-17T17:18:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-17', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2345000, 234000, 5, '', '2024-10-17T18:05:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-18', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 4515000, 406000, 4, '', '2024-10-18T17:05:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-18', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 3009000, 301000, 2, '', '2024-10-18T19:32:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-18', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3510000, 386000, 2, '', '2024-10-18T18:05:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-18', '4bcb8165-a584-5d5b-a194-859250042d96', null, 4012000, 441000, 3, '', '2024-10-18T19:47:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-18', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2507000, 276000, 5, '', '2024-10-18T17:32:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-18', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2507000, 276000, 5, '', '2024-10-18T17:18:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-19', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 3930000, 393000, 4, '', '2024-10-19T17:18:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-19', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2619000, 288000, 2, '', '2024-10-19T17:47:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-19', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3055000, 367000, 2, '', '2024-10-19T17:18:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-19', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3492000, 419000, 3, '', '2024-10-19T18:32:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-19', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2182000, 262000, 5, '', '2024-10-19T19:05:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-19', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2182000, 262000, 6, '', '2024-10-19T19:05:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-21', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 3775000, 340000, 2, '', '2024-10-21T18:05:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-21', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2515000, 252000, 5, '', '2024-10-21T19:47:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-21', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 2934000, 323000, 6, '', '2024-10-21T17:32:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-21', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3354000, 369000, 6, '', '2024-10-21T18:32:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-21', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2096000, 231000, 3, '', '2024-10-21T19:47:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-21', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2096000, 231000, 4, '', '2024-10-21T18:18:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-22', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 5130000, 513000, 2, '', '2024-10-22T18:18:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-22', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 3418000, 376000, 6, '', '2024-10-22T18:32:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-22', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 3988000, 479000, 6, '', '2024-10-22T19:47:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-22', '4bcb8165-a584-5d5b-a194-859250042d96', null, 4558000, 547000, 6, '', '2024-10-22T18:18:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-22', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2848000, 342000, 3, '', '2024-10-22T18:05:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-22', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2848000, 342000, 4, '', '2024-10-22T17:47:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-23', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 3510000, 386000, 2, 'Live 4 jam, bundling serum + toner jalan. Stok toner tinggal 40 pcs.', '2024-10-23T18:47:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-23', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 2340000, 281000, 6, 'Host pengganti, ritme masih menyesuaikan.', '2024-10-23T19:18:00+07:00'),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-23', '341fd812-5440-518a-af7c-d9e589d9cc39', null, 2730000, 355000, 6, '', '2024-10-23T19:32:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-23', '4bcb8165-a584-5d5b-a194-859250042d96', null, 3120000, 406000, 2, '', '2024-10-23T18:18:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-23', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 1950000, 254000, 3, '', '2024-10-23T17:47:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-23', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 1950000, 254000, 4, '', '2024-10-23T18:05:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-24', '23f37851-57bd-55bd-9d1a-8699874b39a1', null, 4784000, 574000, 3, 'Live streaming 3 jam stabil, konversi paket glowing bundle naik 22%.', '2024-10-24T19:47:00+07:00'),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-24', '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925', null, 3404000, 443000, 6, '', '2024-10-24T17:18:00+07:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-24', '4bcb8165-a584-5d5b-a194-859250042d96', null, 4324000, 346000, 2, '', '2024-10-24T19:32:00+07:00'),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-24', '8fedddaa-ad4e-5faa-b7a0-9aa815be177f', null, 2944000, 236000, 3, '', '2024-10-24T17:32:00+07:00'),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-24', '87969379-7771-5c7a-bc4b-d4e5983b59be', null, 2944000, 236000, 4, '', '2024-10-24T17:32:00+07:00')
on conflict (account_id, tanggal) where account_id is not null
do update set gmv = excluded.gmv, komisi = excluded.komisi,
              jumlah_upload = excluded.jumlah_upload,
              catatan = excluded.catatan;

-- Laporan harian per unit ----------------------------------------------
insert into daily_reports
  (user_id, tanggal, account_id, unit_id, gmv, catatan, submitted_at) values
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-01', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 13160000, '', '2024-10-01T17:55:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-01', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 5020000, '', '2024-10-01T17:25:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-02', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 12770000, '', '2024-10-02T18:25:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-02', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4390000, '', '2024-10-02T19:25:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-03', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 11380000, '', '2024-10-03T19:40:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-03', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4740000, '', '2024-10-03T17:25:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-04', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 12620000, '', '2024-10-04T19:25:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-04', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4160000, '', '2024-10-04T18:10:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-05', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 13080000, '', '2024-10-05T19:40:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-05', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4820000, '', '2024-10-05T17:25:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-07', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 11510000, '', '2024-10-07T17:40:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-07', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4270000, '', '2024-10-07T17:55:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-08', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 12590000, '', '2024-10-08T19:55:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-08', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4190000, '', '2024-10-08T19:10:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-09', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 11540000, '', '2024-10-09T17:40:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-09', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4790000, '', '2024-10-09T19:55:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-10', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 12580000, '', '2024-10-10T17:40:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-10', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4550000, '', '2024-10-10T17:10:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-11', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 13910000, '', '2024-10-11T17:55:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-11', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 5300000, '', '2024-10-11T17:40:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-12', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 12640000, '', '2024-10-12T18:40:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-12', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4540000, '', '2024-10-12T17:10:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-14', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 13860000, '', '2024-10-14T19:10:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-14', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4250000, '', '2024-10-14T17:55:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-15', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 10760000, '', '2024-10-15T18:55:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-15', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 5020000, '', '2024-10-15T19:10:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-16', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 11580000, '', '2024-10-16T19:10:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-16', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 5630000, '', '2024-10-16T19:10:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-17', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 10600000, '', '2024-10-17T18:40:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-17', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4810000, '', '2024-10-17T17:25:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-18', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 11000000, '', '2024-10-18T17:40:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-18', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 5480000, '', '2024-10-18T17:55:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-19', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 12050000, '', '2024-10-19T17:25:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-19', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 5410000, '', '2024-10-19T17:10:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-21', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 11870000, '', '2024-10-21T17:25:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-21', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4780000, '', '2024-10-21T17:40:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-22', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 14220000, '', '2024-10-22T17:55:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-22', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4260000, '', '2024-10-22T19:40:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-23', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 9400000, '', '2024-10-23T18:55:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-23', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 3900000, '', '2024-10-23T18:40:00+07:00'),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-24', null, 'db5378cf-cefb-5acc-9e22-8d62911fe882', 11200000, '', '2024-10-24T18:40:00+07:00'),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-24', null, 'f1b49e07-9937-5915-bedc-37348bdf1ac1', 4600000, '', '2024-10-24T18:25:00+07:00')
on conflict (unit_id, tanggal) where unit_id is not null
do update set gmv = excluded.gmv, catatan = excluded.catatan;

-- Tugas: to-do pribadi, tiket atasan, komitmen mingguan ----------------
insert into tasks
  (tipe, goal_id, judul, deskripsi, konteks, pembuat_id, penerima_id,
   tenggat, prioritas, status, qc_status)
select v.* from (values
  ('pribadi'::tipe_tugas, null::uuid, 'Cek 14 sesi live sore', '', 'Affiliator · jadwal 16.00–21.00', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '2024-10-24T16:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'todo'::status_tugas, 'belum'::status_qc),
  ('pribadi'::tipe_tugas, null::uuid, 'Balas 6 pengajuan sampel', '', 'MCN · antrean kreator baru', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, null::timestamptz, 'sedang'::prioritas_tugas, 'todo'::status_tugas, 'belum'::status_qc),
  ('pribadi'::tipe_tugas, null::uuid, 'Review draf brief TAP', '', 'TAP · brand ads Ramadan', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '2024-10-24T13:30:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'belum'::status_qc),
  ('pribadi'::tipe_tugas, null::uuid, 'Kunci target harian tim', '', 'GRD · anak tangga Oktober', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, null::timestamptz, 'rendah'::prioritas_tugas, 'todo'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Audit GMV Akun Beauty', 'Penyesuaian deviasi nominal komisi kreator top 5 kategori skincare.', 'Prioritas Tinggi', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid, '2024-10-24T15:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Otorisasi Akun MMC Baru', 'Persetujuan token akses multi-channel TikTok Shop untuk 12 kreator batch Ramadan.', 'Approval', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '581aa0ce-6f9c-5d52-8922-c102e64aa12c'::uuid, '2024-10-24T16:30:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'menunggu_qc'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Sinkronisasi TAP Center', 'Rekonsiliasi data GMV dasbor terhadap invoice real-time TikTok Ads Agency.', 'Finance & GMV', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '2024-10-24T18:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'QC Tiket Konten FYP', 'Verifikasi 12 video batch Ramadan sebelum jadwal posting jam 17.15.', 'SOP GRD', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '83dc3963-466d-5d71-93d3-0815f1fd926b'::uuid, '2024-10-24T17:15:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'menunggu_qc'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rapikan stok sampel skincare', 'Hitung ulang sisa sampel serum dan toner, cocokkan dengan catatan gudang.', 'Operasional', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9'::uuid, '2024-10-23T17:00:00+07:00'::timestamptz, 'rendah'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('komitmen_mingguan'::tipe_tugas, '0844d12e-eb26-5be5-ac8a-db6e4d7113e2'::uuid, 'Naikkan konversi live Affiliator 5%', 'Fokus pada bundling dan voucher toko di dua jam pertama tiap sesi.', 'Komitmen pekan ini', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '2024-10-27T23:59:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rapikan katalog produk pekan ini — Rian', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Kurasi 10 kreator baru — Rian', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun jadwal live sepekan — Rian', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut order pending — Rian', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rapikan katalog produk pekan ini — Nabila', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'ad72efba-7708-5742-9bea-3e70ead115f2'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Kurasi 10 kreator baru — Nabila', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'ad72efba-7708-5742-9bea-3e70ead115f2'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'todo'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun jadwal live sepekan — Nabila', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'ad72efba-7708-5742-9bea-3e70ead115f2'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'todo'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut order pending — Nabila', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'ad72efba-7708-5742-9bea-3e70ead115f2'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rapikan katalog produk pekan ini — Bayu', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '83dc3963-466d-5d71-93d3-0815f1fd926b'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Kurasi 10 kreator baru — Bayu', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '83dc3963-466d-5d71-93d3-0815f1fd926b'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun jadwal live sepekan — Bayu', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '83dc3963-466d-5d71-93d3-0815f1fd926b'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut order pending — Bayu', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '83dc3963-466d-5d71-93d3-0815f1fd926b'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Validasi dokumen agency — Dimas', '', 'Unit TAP', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rekap pencairan komisi — Dimas', '', 'Unit TAP', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tinjau pengajuan sampel — Dimas', '', 'Unit TAP', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun laporan kemitraan — Dimas', '', 'Unit TAP', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Verifikasi binding kreator — Maya', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '581aa0ce-6f9c-5d52-8922-c102e64aa12c'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rekap kehadiran MMC — Maya', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '581aa0ce-6f9c-5d52-8922-c102e64aa12c'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut kreator pasif — Maya', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '581aa0ce-6f9c-5d52-8922-c102e64aa12c'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Siapkan materi kelas MMC — Maya', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '581aa0ce-6f9c-5d52-8922-c102e64aa12c'::uuid, '2024-10-22T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Verifikasi binding kreator — Rizky', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '56e8a824-7195-5cca-8b01-80b5516bd3db'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rekap kehadiran MMC — Rizky', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '56e8a824-7195-5cca-8b01-80b5516bd3db'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut kreator pasif — Rizky', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '56e8a824-7195-5cca-8b01-80b5516bd3db'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Siapkan materi kelas MMC — Rizky', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '56e8a824-7195-5cca-8b01-80b5516bd3db'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rapikan katalog produk pekan ini — Intan', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Kurasi 10 kreator baru — Intan', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun jadwal live sepekan — Intan', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut order pending — Intan', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9'::uuid, '2024-10-22T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Validasi dokumen agency — Yoga', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '73eab5ac-5007-5391-913e-01e9ad855f45'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rekap pencairan komisi — Yoga', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '73eab5ac-5007-5391-913e-01e9ad855f45'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tinjau pengajuan sampel — Yoga', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '73eab5ac-5007-5391-913e-01e9ad855f45'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'todo'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun laporan kemitraan — Yoga', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '73eab5ac-5007-5391-913e-01e9ad855f45'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rapikan katalog produk pekan ini — Salsabila', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'ff63318a-dd1f-5438-bb27-88987420c0d9'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Kurasi 10 kreator baru — Salsabila', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'ff63318a-dd1f-5438-bb27-88987420c0d9'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun jadwal live sepekan — Salsabila', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'ff63318a-dd1f-5438-bb27-88987420c0d9'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut order pending — Salsabila', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'ff63318a-dd1f-5438-bb27-88987420c0d9'::uuid, '2024-10-22T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Verifikasi binding kreator — Fajar', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '72005e8f-e3c0-51fe-ade9-0d6f3a5d508d'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rekap kehadiran MMC — Fajar', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '72005e8f-e3c0-51fe-ade9-0d6f3a5d508d'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut kreator pasif — Fajar', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '72005e8f-e3c0-51fe-ade9-0d6f3a5d508d'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Siapkan materi kelas MMC — Fajar', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '72005e8f-e3c0-51fe-ade9-0d6f3a5d508d'::uuid, '2024-10-22T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rapikan katalog produk pekan ini — Anisa', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '7f52935c-fccd-55c6-9d33-341cf854fb18'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Kurasi 10 kreator baru — Anisa', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '7f52935c-fccd-55c6-9d33-341cf854fb18'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun jadwal live sepekan — Anisa', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '7f52935c-fccd-55c6-9d33-341cf854fb18'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut order pending — Anisa', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '7f52935c-fccd-55c6-9d33-341cf854fb18'::uuid, '2024-10-22T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Validasi dokumen agency — Hendra', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, 'fd438ea5-9664-51d4-9fed-4744fe5c6d8d'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rekap pencairan komisi — Hendra', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, 'fd438ea5-9664-51d4-9fed-4744fe5c6d8d'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tinjau pengajuan sampel — Hendra', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, 'fd438ea5-9664-51d4-9fed-4744fe5c6d8d'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun laporan kemitraan — Hendra', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, 'fd438ea5-9664-51d4-9fed-4744fe5c6d8d'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Verifikasi binding kreator — Putri', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '66f8b261-08cb-58cd-980d-ea3cb7f2f61d'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rekap kehadiran MMC — Putri', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '66f8b261-08cb-58cd-980d-ea3cb7f2f61d'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut kreator pasif — Putri', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '66f8b261-08cb-58cd-980d-ea3cb7f2f61d'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Siapkan materi kelas MMC — Putri', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '66f8b261-08cb-58cd-980d-ea3cb7f2f61d'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rapikan katalog produk pekan ini — Arif', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '48e841ca-3e54-5c76-a7c5-084b7cd81677'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Kurasi 10 kreator baru — Arif', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '48e841ca-3e54-5c76-a7c5-084b7cd81677'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun jadwal live sepekan — Arif', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '48e841ca-3e54-5c76-a7c5-084b7cd81677'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut order pending — Arif', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '48e841ca-3e54-5c76-a7c5-084b7cd81677'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rapikan katalog produk pekan ini — Dewi', '', 'Unit AFFILIATOR', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Kurasi 10 kreator baru — Dewi', '', 'Unit AFFILIATOR', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun jadwal live sepekan — Dewi', '', 'Unit AFFILIATOR', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut order pending — Dewi', '', 'Unit AFFILIATOR', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Verifikasi binding kreator — Galih', '', 'Unit MCN', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rekap kehadiran MMC — Galih', '', 'Unit MCN', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut kreator pasif — Galih', '', 'Unit MCN', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Siapkan materi kelas MMC — Galih', '', 'Unit MCN', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Validasi dokumen agency — Vina', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '2f4160f3-fea1-5b98-ba6c-f93645b4fbc0'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rekap pencairan komisi — Vina', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '2f4160f3-fea1-5b98-ba6c-f93645b4fbc0'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tinjau pengajuan sampel — Vina', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '2f4160f3-fea1-5b98-ba6c-f93645b4fbc0'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun laporan kemitraan — Vina', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '2f4160f3-fea1-5b98-ba6c-f93645b4fbc0'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rapikan katalog produk pekan ini — Rendi', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '670c9117-473d-5c0a-8ccd-1cfac0f0f80b'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Kurasi 10 kreator baru — Rendi', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '670c9117-473d-5c0a-8ccd-1cfac0f0f80b'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'todo'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun jadwal live sepekan — Rendi', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '670c9117-473d-5c0a-8ccd-1cfac0f0f80b'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'todo'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut order pending — Rendi', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '670c9117-473d-5c0a-8ccd-1cfac0f0f80b'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rapikan katalog produk pekan ini — Bagas', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '0c613b14-b429-57b2-aed0-395751a41d97'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Kurasi 10 kreator baru — Bagas', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '0c613b14-b429-57b2-aed0-395751a41d97'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun jadwal live sepekan — Bagas', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '0c613b14-b429-57b2-aed0-395751a41d97'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut order pending — Bagas', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '0c613b14-b429-57b2-aed0-395751a41d97'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rekonsiliasi kas operasional — Laras', '', 'Keuangan', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Verifikasi bukti pengeluaran — Laras', '', 'Keuangan', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun laporan arus kas — Laras', '', 'Keuangan', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid, '2024-10-18T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tinjau pengajuan reimburse — Laras', '', 'Keuangan', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rapikan katalog produk pekan ini — Teguh', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '2752b688-eaaa-574c-b84e-ab675064d7be'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Kurasi 10 kreator baru — Teguh', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '2752b688-eaaa-574c-b84e-ab675064d7be'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun jadwal live sepekan — Teguh', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '2752b688-eaaa-574c-b84e-ab675064d7be'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'todo'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut order pending — Teguh', '', 'Unit AFFILIATOR', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '2752b688-eaaa-574c-b84e-ab675064d7be'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Verifikasi binding kreator — Sinta', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '26acd2f9-a9bd-5479-84e9-6ecf01b58709'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rekap kehadiran MMC — Sinta', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '26acd2f9-a9bd-5479-84e9-6ecf01b58709'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tindak lanjut kreator pasif — Sinta', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '26acd2f9-a9bd-5479-84e9-6ecf01b58709'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'todo'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Siapkan materi kelas MMC — Sinta', '', 'Unit MCN', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '26acd2f9-a9bd-5479-84e9-6ecf01b58709'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Validasi dokumen agency — Eko', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, 'f65668c7-d2d9-5812-b4a9-2e085cce40c6'::uuid, '2024-10-08T17:00:00+07:00'::timestamptz, 'tinggi'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Rekap pencairan komisi — Eko', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, 'f65668c7-d2d9-5812-b4a9-2e085cce40c6'::uuid, '2024-10-14T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'selesai'::status_tugas, 'lolos'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Tinjau pengajuan sampel — Eko', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, 'f65668c7-d2d9-5812-b4a9-2e085cce40c6'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'todo'::status_tugas, 'belum'::status_qc),
  ('tiket'::tipe_tugas, null::uuid, 'Susun laporan kemitraan — Eko', '', 'Unit TAP', 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, 'f65668c7-d2d9-5812-b4a9-2e085cce40c6'::uuid, '2024-10-24T17:00:00+07:00'::timestamptz, 'sedang'::prioritas_tugas, 'berjalan'::status_tugas, 'belum'::status_qc)
) as v
where not exists (select 1 from tasks);

-- Absensi hari acuan ---------------------------------------------------
insert into attendance
  (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk, status, alasan,
   persetujuan, disetujui_oleh, izin_jenis, izin_mulai, izin_selesai)
values
  ('7f52935c-fccd-55c6-9d33-341cf854fb18', '2024-10-22', '2024-10-22T07:44:00+07:00', -6.261269, 106.809988, 'hadir', '', null, null, null, null, null),
  ('48e841ca-3e54-5c76-a7c5-084b7cd81677', '2024-10-22', '2024-10-22T08:02:00+07:00', -6.260478, 106.810396, 'hadir', '', null, null, null, null, null),
  ('0c613b14-b429-57b2-aed0-395751a41d97', '2024-10-22', '2024-10-22T07:46:00+07:00', -6.260775, 106.81028, 'hadir', '', null, null, null, null, null),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-22', '2024-10-22T07:34:00+07:00', -6.26144, 106.810494, 'hadir', '', null, null, null, null, null),
  ('e2391748-8e38-5009-b5d6-758e232c6381', '2024-10-22', '2024-10-22T07:36:00+07:00', -6.260624, 106.8099, 'hadir', '', null, null, null, null, null),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-22', '2024-10-22T07:43:00+07:00', -6.261388, 106.809945, 'hadir', '', null, null, null, null, null),
  ('72005e8f-e3c0-51fe-ade9-0d6f3a5d508d', '2024-10-22', '2024-10-22T08:01:00+07:00', -6.260126, 106.810263, 'hadir', '', null, null, null, null, null),
  ('7019770e-faea-5467-98ad-3c4a088d602e', '2024-10-22', '2024-10-22T07:55:00+07:00', -6.260982, 106.810041, 'hadir', '', null, null, null, null, null),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-22', '2024-10-22T07:49:00+07:00', -6.261405, 106.81013, 'hadir', '', null, null, null, null, null),
  ('9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', '2024-10-22', '2024-10-22T07:23:00+07:00', -6.260459, 106.809916, 'hadir', '', null, null, null, null, null),
  ('fd438ea5-9664-51d4-9fed-4744fe5c6d8d', '2024-10-22', '2024-10-22T07:53:00+07:00', -6.261006, 106.811106, 'hadir', '', null, null, null, null, null),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-22', '2024-10-22T07:40:00+07:00', -6.260496, 106.811316, 'hadir', '', null, null, null, null, null),
  ('2a6feda0-dc3c-5aeb-9122-0640f53e3c33', '2024-10-22', '2024-10-22T07:50:00+07:00', -6.260229, 106.810918, 'hadir', '', null, null, null, null, null),
  ('581aa0ce-6f9c-5d52-8922-c102e64aa12c', '2024-10-22', '2024-10-22T07:47:00+07:00', -6.260821, 106.811123, 'hadir', '', null, null, null, null, null),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-22', '2024-10-22T09:17:00+07:00', -6.261407, 106.810612, 'hadir', '', null, null, null, null, null),
  ('66f8b261-08cb-58cd-980d-ea3cb7f2f61d', '2024-10-22', '2024-10-22T07:39:00+07:00', -6.261211, 106.810731, 'hadir', '', null, null, null, null, null),
  ('670c9117-473d-5c0a-8ccd-1cfac0f0f80b', '2024-10-22', '2024-10-22T08:25:00+07:00', -6.260997, 106.810737, 'hadir', '', null, null, null, null, null),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-22', '2024-10-22T07:51:00+07:00', -6.260643, 106.810385, 'hadir', '', null, null, null, null, null),
  ('56e8a824-7195-5cca-8b01-80b5516bd3db', '2024-10-22', '2024-10-22T07:58:00+07:00', -6.261302, 106.810157, 'hadir', '', null, null, null, null, null),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-22', '2024-10-22T07:32:00+07:00', -6.259938, 106.809875, 'hadir', '', null, null, null, null, null),
  ('2f4160f3-fea1-5b98-ba6c-f93645b4fbc0', '2024-10-22', '2024-10-22T07:55:00+07:00', -6.260411, 106.810484, 'hadir', '', null, null, null, null, null),
  ('73eab5ac-5007-5391-913e-01e9ad855f45', '2024-10-22', '2024-10-22T08:50:00+07:00', -6.256577, 106.810435, 'hadir', '', null, null, null, null, null),
  ('7f52935c-fccd-55c6-9d33-341cf854fb18', '2024-10-23', '2024-10-23T07:39:00+07:00', -6.261269, 106.809988, 'hadir', '', null, null, null, null, null),
  ('48e841ca-3e54-5c76-a7c5-084b7cd81677', '2024-10-23', '2024-10-23T07:57:00+07:00', -6.260478, 106.810396, 'hadir', '', null, null, null, null, null),
  ('0c613b14-b429-57b2-aed0-395751a41d97', '2024-10-23', '2024-10-23T07:41:00+07:00', -6.260775, 106.81028, 'hadir', '', null, null, null, null, null),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-23', '2024-10-23T07:29:00+07:00', -6.26144, 106.810494, 'hadir', '', null, null, null, null, null),
  ('e2391748-8e38-5009-b5d6-758e232c6381', '2024-10-23', '2024-10-23T07:31:00+07:00', -6.260624, 106.8099, 'hadir', '', null, null, null, null, null),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-23', '2024-10-23T07:38:00+07:00', -6.261388, 106.809945, 'hadir', '', null, null, null, null, null),
  ('72005e8f-e3c0-51fe-ade9-0d6f3a5d508d', '2024-10-23', '2024-10-23T07:56:00+07:00', -6.260126, 106.810263, 'hadir', '', null, null, null, null, null),
  ('7019770e-faea-5467-98ad-3c4a088d602e', '2024-10-23', '2024-10-23T07:50:00+07:00', -6.260982, 106.810041, 'hadir', '', null, null, null, null, null),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-23', '2024-10-23T07:44:00+07:00', -6.261405, 106.81013, 'hadir', '', null, null, null, null, null),
  ('9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', '2024-10-23', '2024-10-23T07:18:00+07:00', -6.260459, 106.809916, 'hadir', '', null, null, null, null, null),
  ('fd438ea5-9664-51d4-9fed-4744fe5c6d8d', '2024-10-23', '2024-10-23T07:48:00+07:00', -6.261006, 106.811106, 'hadir', '', null, null, null, null, null),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-23', '2024-10-23T07:35:00+07:00', -6.260496, 106.811316, 'hadir', '', null, null, null, null, null),
  ('2a6feda0-dc3c-5aeb-9122-0640f53e3c33', '2024-10-23', '2024-10-23T07:45:00+07:00', -6.260229, 106.810918, 'hadir', '', null, null, null, null, null),
  ('581aa0ce-6f9c-5d52-8922-c102e64aa12c', '2024-10-23', '2024-10-23T07:42:00+07:00', -6.260821, 106.811123, 'hadir', '', null, null, null, null, null),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-23', '2024-10-23T09:12:00+07:00', -6.261407, 106.810612, 'hadir', '', null, null, null, null, null),
  ('66f8b261-08cb-58cd-980d-ea3cb7f2f61d', '2024-10-23', '2024-10-23T07:34:00+07:00', -6.261211, 106.810731, 'hadir', '', null, null, null, null, null),
  ('670c9117-473d-5c0a-8ccd-1cfac0f0f80b', '2024-10-23', '2024-10-23T08:20:00+07:00', -6.260997, 106.810737, 'hadir', '', null, null, null, null, null),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-23', '2024-10-23T07:46:00+07:00', -6.260643, 106.810385, 'hadir', '', null, null, null, null, null),
  ('56e8a824-7195-5cca-8b01-80b5516bd3db', '2024-10-23', '2024-10-23T07:53:00+07:00', -6.261302, 106.810157, 'hadir', '', null, null, null, null, null),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-23', '2024-10-23T07:27:00+07:00', -6.259938, 106.809875, 'hadir', '', null, null, null, null, null),
  ('2f4160f3-fea1-5b98-ba6c-f93645b4fbc0', '2024-10-23', '2024-10-23T07:50:00+07:00', -6.260411, 106.810484, 'hadir', '', null, null, null, null, null),
  ('73eab5ac-5007-5391-913e-01e9ad855f45', '2024-10-23', '2024-10-23T08:45:00+07:00', -6.256577, 106.810435, 'hadir', '', null, null, null, null, null),
  ('7019770e-faea-5467-98ad-3c4a088d602e', '2024-10-24', '2024-10-24T07:52:00+07:00', -6.260982, 106.810041, 'hadir', '', null, null, null, null, null),
  ('9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', '2024-10-24', '2024-10-24T07:20:00+07:00', -6.260459, 106.809916, 'hadir', '', null, null, null, null, null),
  ('484a9a6a-149f-56d0-a15a-9215cf7403a3', '2024-10-24', '2024-10-24T07:48:00+07:00', -6.260643, 106.810385, 'hadir', '', null, null, null, null, null),
  ('ad72efba-7708-5742-9bea-3e70ead115f2', '2024-10-24', '2024-10-24T09:14:00+07:00', -6.261407, 106.810612, 'hadir', 'Mengantar anak ke dokter, masuk setelah itu.', 'disetujui', '7019770e-faea-5467-98ad-3c4a088d602e', 'jam'::jenis_izin, '08:00', '09:00'),
  ('83dc3963-466d-5d71-93d3-0815f1fd926b', '2024-10-24', '2024-10-24T07:31:00+07:00', -6.26144, 106.810494, 'hadir', '', null, null, null, null, null),
  ('c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-24', '2024-10-24T07:40:00+07:00', -6.261388, 106.809945, 'hadir', '', null, null, null, null, null),
  ('581aa0ce-6f9c-5d52-8922-c102e64aa12c', '2024-10-24', '2024-10-24T07:44:00+07:00', -6.260821, 106.811123, 'hadir', '', null, null, null, null, null),
  ('56e8a824-7195-5cca-8b01-80b5516bd3db', '2024-10-24', '2024-10-24T07:55:00+07:00', -6.261302, 106.810157, 'hadir', '', null, null, null, null, null),
  ('dd0b0a40-8d0f-5534-bbcf-3aae10cdbee9', '2024-10-24', '2024-10-24T07:37:00+07:00', -6.260496, 106.811316, 'hadir', '', null, null, null, null, null),
  ('73eab5ac-5007-5391-913e-01e9ad855f45', '2024-10-24', '2024-10-24T08:47:00+07:00', -6.256577, 106.810435, 'terlambat', '', null, null, null, null, null),
  ('ff63318a-dd1f-5438-bb27-88987420c0d9', '2024-10-24', '2024-10-24T07:29:00+07:00', -6.259938, 106.809875, 'hadir', '', null, null, null, null, null),
  ('72005e8f-e3c0-51fe-ade9-0d6f3a5d508d', '2024-10-24', '2024-10-24T07:58:00+07:00', -6.260126, 106.810263, 'hadir', '', null, null, null, null, null),
  ('7f52935c-fccd-55c6-9d33-341cf854fb18', '2024-10-24', '2024-10-24T07:41:00+07:00', -6.261269, 106.809988, 'hadir', '', null, null, null, null, null),
  ('fd438ea5-9664-51d4-9fed-4744fe5c6d8d', '2024-10-24', '2024-10-24T07:50:00+07:00', -6.261006, 106.811106, 'hadir', '', null, null, null, null, null),
  ('66f8b261-08cb-58cd-980d-ea3cb7f2f61d', '2024-10-24', '2024-10-24T07:36:00+07:00', -6.261211, 106.810731, 'hadir', '', null, null, null, null, null),
  ('48e841ca-3e54-5c76-a7c5-084b7cd81677', '2024-10-24', '2024-10-24T07:59:00+07:00', -6.260478, 106.810396, 'hadir', '', null, null, null, null, null),
  ('e2391748-8e38-5009-b5d6-758e232c6381', '2024-10-24', '2024-10-24T07:33:00+07:00', -6.260624, 106.8099, 'hadir', '', null, null, null, null, null),
  ('32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-24', '2024-10-24T07:46:00+07:00', -6.261405, 106.81013, 'hadir', '', null, null, null, null, null),
  ('2f4160f3-fea1-5b98-ba6c-f93645b4fbc0', '2024-10-24', '2024-10-24T07:52:00+07:00', -6.260411, 106.810484, 'hadir', '', null, null, null, null, null),
  ('670c9117-473d-5c0a-8ccd-1cfac0f0f80b', '2024-10-24', '2024-10-24T08:22:00+07:00', -6.260997, 106.810737, 'terlambat', 'Mengurus perpanjangan STNK, kembali sebelum siang.', 'diajukan', null, 'jam'::jenis_izin, '08:00', '09:00'),
  ('0c613b14-b429-57b2-aed0-395751a41d97', '2024-10-24', '2024-10-24T07:43:00+07:00', -6.260775, 106.81028, 'hadir', '', null, null, null, null, null),
  ('2a6feda0-dc3c-5aeb-9122-0640f53e3c33', '2024-10-24', '2024-10-24T07:47:00+07:00', -6.260229, 106.810918, 'hadir', '', null, null, null, null, null),
  ('2752b688-eaaa-574c-b84e-ab675064d7be', '2024-10-24', null, null, null, 'izin', 'Mengurus dokumen keluarga di luar kota.', 'disetujui', '7019770e-faea-5467-98ad-3c4a088d602e', null, null, null),
  ('26acd2f9-a9bd-5479-84e9-6ecf01b58709', '2024-10-24', null, null, null, 'sakit', 'Demam sejak semalam, istirahat sesuai anjuran klinik.', 'disetujui', '7019770e-faea-5467-98ad-3c4a088d602e', null, null, null),
  ('f65668c7-d2d9-5812-b4a9-2e085cce40c6', '2024-10-25', null, null, null, 'izin', 'Mengurus administrasi BPJS keluarga, kembali besok siang.', 'diajukan', null, null, null, null),
  ('72005e8f-e3c0-51fe-ade9-0d6f3a5d508d', '2024-10-25', null, null, null, 'sakit', 'Radang tenggorokan, sudah periksa ke klinik pagi ini.', 'diajukan', null, null, null, null),
  ('73eab5ac-5007-5391-913e-01e9ad855f45', '2024-10-28', null, null, null, 'izin', 'Menghadiri pernikahan keluarga di luar kota.', 'diajukan', null, 'terencana'::jenis_izin, null, null),
  ('73eab5ac-5007-5391-913e-01e9ad855f45', '2024-10-29', null, null, null, 'izin', 'Menghadiri pernikahan keluarga di luar kota.', 'diajukan', null, 'terencana'::jenis_izin, null, null),
  ('73eab5ac-5007-5391-913e-01e9ad855f45', '2024-10-30', null, null, null, 'izin', 'Menghadiri pernikahan keluarga di luar kota.', 'diajukan', null, 'terencana'::jenis_izin, null, null)
on conflict (user_id, tanggal) do update
  set jam_masuk = excluded.jam_masuk,
      lat_masuk = excluded.lat_masuk,
      lng_masuk = excluded.lng_masuk,
      status = excluded.status,
      alasan = excluded.alasan,
      persetujuan = excluded.persetujuan,
      izin_jenis = excluded.izin_jenis,
      izin_mulai = excluded.izin_mulai,
      izin_selesai = excluded.izin_selesai;

-- Hari lanjutan izin terencana menunjuk hari pertamanya, supaya satu
-- keputusan atasan menutup seluruh pengajuan (migrasi 0132).
update attendance set izin_induk_id = (
  select id from attendance
   where user_id = '73eab5ac-5007-5391-913e-01e9ad855f45' and tanggal = '2024-10-28'
)
 where user_id = '73eab5ac-5007-5391-913e-01e9ad855f45' and tanggal = '2024-10-29';
update attendance set izin_induk_id = (
  select id from attendance
   where user_id = '73eab5ac-5007-5391-913e-01e9ad855f45' and tanggal = '2024-10-28'
)
 where user_id = '73eab5ac-5007-5391-913e-01e9ad855f45' and tanggal = '2024-10-30';

-- Lead measure (papan skor langkah kunci) ------------------------------
insert into lead_measures
  (id, goal_id, judul, satuan, target_mingguan, label_pendukung, urutan,
   sumber_laporan) values
  ('6a55cbe0-37f3-5115-92f8-bb270ea28c1e', '0844d12e-eb26-5be5-ac8a-db6e4d7113e2', 'Live Stream TikTok', 'jam', 40, null, 1, null),
  ('44ed0b3a-9df7-572c-bd77-72dc885dd1c3', '21b36aa0-2fe0-58e5-a7bb-58c202d71bf1', 'Creator Binding MMC', 'akun', 15, 'Peserta hadir MMC', 1, null),
  ('9f506e5c-fc29-5633-a410-f73323f13884', '21e8a8a0-afdf-589d-a6e8-e18d2b920b0a', 'Video Affiliate & UGC', 'video', 200, null, 1, null),
  ('2c1f9d64-7a83-5ae1-bb02-91d4f0c67a15', '0844d12e-eb26-5be5-ac8a-db6e4d7113e2', 'Upload Konten Harian', 'konten', 140, null, 2, 'jumlah_upload')
on conflict (id) do update
  set target_mingguan = excluded.target_mingguan,
      label_pendukung = excluded.label_pendukung,
      sumber_laporan = excluded.sumber_laporan;

-- Realisasi harian pekan berjalan --------------------------------------
insert into lead_measure_entries
  (lead_measure_id, user_id, tanggal, nilai, nilai_pendukung, catatan) values
  ('6a55cbe0-37f3-5115-92f8-bb270ea28c1e', 'e2391748-8e38-5009-b5d6-758e232c6381', '2024-10-21', 10, null, ''),
  ('6a55cbe0-37f3-5115-92f8-bb270ea28c1e', 'e2391748-8e38-5009-b5d6-758e232c6381', '2024-10-22', 9, null, ''),
  ('6a55cbe0-37f3-5115-92f8-bb270ea28c1e', 'e2391748-8e38-5009-b5d6-758e232c6381', '2024-10-23', 10, null, ''),
  ('6a55cbe0-37f3-5115-92f8-bb270ea28c1e', 'e2391748-8e38-5009-b5d6-758e232c6381', '2024-10-24', 9, null, ''),
  ('44ed0b3a-9df7-572c-bd77-72dc885dd1c3', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-21', 4, 22, ''),
  ('44ed0b3a-9df7-572c-bd77-72dc885dd1c3', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-22', 3, 18, ''),
  ('44ed0b3a-9df7-572c-bd77-72dc885dd1c3', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-23', 4, 25, ''),
  ('44ed0b3a-9df7-572c-bd77-72dc885dd1c3', '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97', '2024-10-24', 3, 20, ''),
  ('9f506e5c-fc29-5633-a410-f73323f13884', 'c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-21', 50, null, ''),
  ('9f506e5c-fc29-5633-a410-f73323f13884', 'c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-22', 45, null, ''),
  ('9f506e5c-fc29-5633-a410-f73323f13884', 'c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-23', 48, null, ''),
  ('9f506e5c-fc29-5633-a410-f73323f13884', 'c5631790-4df7-5d06-b9db-ee468783017f', '2024-10-24', 42, null, '')
on conflict (lead_measure_id, tanggal) do update
  set nilai = excluded.nilai, nilai_pendukung = excluded.nilai_pendukung;

-- Definisi KPI per jabatan ---------------------------------------------
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
on conflict (jabatan, nama_kpi) do update
  set bobot = excluded.bobot,
      target_base = excluded.target_base,
      target_goal = excluded.target_goal,
      target_stretch = excluded.target_stretch;

commit;

-- Sampel produk ---------------------------------------------------------
insert into samples (kode, nama, kategori, unit_id, account_id, nilai, brand, link_produk) values
  ('SMP-0001', 'Serum Vitamin C 30ml', 'Skincare', '19570324-4683-5829-9eb5-4c69aa62222a', (select id from accounts where username = '@skincare_official'), 185000, 'Glowrich Official', 'https://shopee.co.id/glowrich-serum-vitamin-c-30ml-i.112233.445566'),
  ('SMP-0002', 'Cushion Matte SPF50', 'Skincare', '19570324-4683-5829-9eb5-4c69aa62222a', (select id from accounts where username = '@beauty_daily.id'), 145000, 'Belle Cosmetics', 'https://www.tiktok.com/@belle.cosmetics/video/7301122334455667788'),
  ('SMP-0003', 'Hijab Voal Premium', 'Fashion', '19570324-4683-5829-9eb5-4c69aa62222a', null, 89000, 'Nadia Hijab House', 'https://shopee.co.id/nadia-hijab-voal-premium-i.223344.556677'),
  ('SMP-0004', 'Earbuds TWS Pro', 'Gadget', '19570324-4683-5829-9eb5-4c69aa62222a', null, 320000, 'Aeromode Gadget', 'https://www.tiktok.com/@aeromode.id/video/7311223344556677889'),
  ('SMP-0005', 'Snack Box Nusantara', 'F&B', '19570324-4683-5829-9eb5-4c69aa62222a', (select id from accounts where username = '@snack_nusantara'), 75000, 'Dapur Rasa Nusantara', null),
  ('SMP-0006', 'Set Panci Antilengket', 'Home', '19570324-4683-5829-9eb5-4c69aa62222a', null, 410000, 'Homey Living', 'https://shopee.co.id/homey-living-set-toples-kaca-i.334455.667788'),
  ('SMP-0007', 'Lampu Meja LED', 'Home', 'db5378cf-cefb-5acc-9e22-8d62911fe882', null, 135000, 'Glowrich Official', 'https://shopee.co.id/glowrich-toner-centella-i.112233.998877'),
  ('SMP-0008', 'Tripod Ring Light 18"', 'Gadget', 'db5378cf-cefb-5acc-9e22-8d62911fe882', null, 275000, 'Belle Cosmetics', null),
  ('SMP-0009', 'Mic Lavalier Wireless', 'Gadget', 'f1b49e07-9937-5915-bedc-37348bdf1ac1', null, 390000, 'Aeromode Gadget', 'https://www.tiktok.com/@aeromode.id/video/7322334455667788990'),
  ('SMP-0010', 'Parfum Travel 15ml', 'Skincare', 'f1b49e07-9937-5915-bedc-37348bdf1ac1', null, 98000, 'Nadia Hijab House', 'https://shopee.co.id/nadia-hijab-inner-ninja-i.223344.112233')
on conflict (lower(kode)) do update
  set nama = excluded.nama,
      kategori = excluded.kategori,
      unit_id = excluded.unit_id,
      account_id = excluded.account_id,
      nilai = excluded.nilai,
      brand = excluded.brand,
      link_produk = excluded.link_produk;

-- Riwayat pemindaian QR --------------------------------------------------
insert into sample_scans (kode, sample_id, oleh_id, dikenali, pada)
select kode, sample_id::uuid, oleh_id::uuid, dikenali, pada::timestamptz
from (values
  ('SMP-0002', (select id from samples where lower(kode) = lower('SMP-0002')), '484a9a6a-149f-56d0-a15a-9215cf7403a3', true, now() - interval '0 day'),
  ('SMP-0001', (select id from samples where lower(kode) = lower('SMP-0001')), '484a9a6a-149f-56d0-a15a-9215cf7403a3', true, now() - interval '0 day'),
  ('SMP-0003', (select id from samples where lower(kode) = lower('SMP-0003')), 'ad72efba-7708-5742-9bea-3e70ead115f2', true, now() - interval '0 day'),
  ('SMP-0001', (select id from samples where lower(kode) = lower('SMP-0001')), '484a9a6a-149f-56d0-a15a-9215cf7403a3', true, now() - interval '1 day'),
  ('SMP-LAMA-114', null, '484a9a6a-149f-56d0-a15a-9215cf7403a3', false, now() - interval '1 day'),
  ('SMP-0007', (select id from samples where lower(kode) = lower('SMP-0007')), '56e8a824-7195-5cca-8b01-80b5516bd3db', true, now() - interval '2 day'),
  ('SMP-LAMA-114', null, 'ad72efba-7708-5742-9bea-3e70ead115f2', false, now() - interval '3 day')
) as v(kode, sample_id, oleh_id, dikenali, pada)
where not exists (select 1 from sample_scans);

-- Jejak perpindahan sampel ---------------------------------------------
insert into sample_events (sample_id, ke, oleh_id, pemegang_id, kreator, pada)
select sample_id, ke::status_sampel, oleh_id::uuid, pemegang_id::uuid, kreator, pada::timestamptz
from (values
  ((select id from samples where lower(kode) = lower('SMP-0001')), 'dipegang', '7019770e-faea-5467-98ad-3c4a088d602e', '484a9a6a-149f-56d0-a15a-9215cf7403a3', '', now() - interval '3 day'),
  ((select id from samples where lower(kode) = lower('SMP-0001')), 'dikirim', '7019770e-faea-5467-98ad-3c4a088d602e', null, '@rara.beauty', now() - interval '2 day'),
  ((select id from samples where lower(kode) = lower('SMP-0001')), 'diterima', '7019770e-faea-5467-98ad-3c4a088d602e', null, '@rara.beauty', now() - interval '1 day'),
  ((select id from samples where lower(kode) = lower('SMP-0002')), 'dipegang', '7019770e-faea-5467-98ad-3c4a088d602e', '484a9a6a-149f-56d0-a15a-9215cf7403a3', '', now() - interval '2 day'),
  ((select id from samples where lower(kode) = lower('SMP-0002')), 'dikirim', '7019770e-faea-5467-98ad-3c4a088d602e', null, '@dinda.makeup', now() - interval '1 day'),
  ((select id from samples where lower(kode) = lower('SMP-0003')), 'dipegang', '7019770e-faea-5467-98ad-3c4a088d602e', 'ad72efba-7708-5742-9bea-3e70ead115f2', '', now() - interval '1 day'),
  ((select id from samples where lower(kode) = lower('SMP-0005')), 'dipegang', '7019770e-faea-5467-98ad-3c4a088d602e', '484a9a6a-149f-56d0-a15a-9215cf7403a3', '', now() - interval '4 day'),
  ((select id from samples where lower(kode) = lower('SMP-0005')), 'dikirim', '7019770e-faea-5467-98ad-3c4a088d602e', null, '@resep.ibu', now() - interval '3 day'),
  ((select id from samples where lower(kode) = lower('SMP-0005')), 'diterima', '7019770e-faea-5467-98ad-3c4a088d602e', null, '@resep.ibu', now() - interval '2 day'),
  ((select id from samples where lower(kode) = lower('SMP-0005')), 'dikembalikan', '7019770e-faea-5467-98ad-3c4a088d602e', null, '', now() - interval '1 day'),
  ((select id from samples where lower(kode) = lower('SMP-0006')), 'dipegang', '7019770e-faea-5467-98ad-3c4a088d602e', '2752b688-eaaa-574c-b84e-ab675064d7be', '', now() - interval '2 day'),
  ((select id from samples where lower(kode) = lower('SMP-0006')), 'hilang', '7019770e-faea-5467-98ad-3c4a088d602e', null, '', now() - interval '1 day'),
  ((select id from samples where lower(kode) = lower('SMP-0007')), 'dipegang', '7019770e-faea-5467-98ad-3c4a088d602e', '56e8a824-7195-5cca-8b01-80b5516bd3db', '', now() - interval '1 day'),
  ((select id from samples where lower(kode) = lower('SMP-0008')), 'dipegang', '7019770e-faea-5467-98ad-3c4a088d602e', '56e8a824-7195-5cca-8b01-80b5516bd3db', '', now() - interval '3 day'),
  ((select id from samples where lower(kode) = lower('SMP-0008')), 'dikirim', '7019770e-faea-5467-98ad-3c4a088d602e', null, '@kreator.mmc', now() - interval '2 day'),
  ((select id from samples where lower(kode) = lower('SMP-0008')), 'diterima', '7019770e-faea-5467-98ad-3c4a088d602e', null, '@kreator.mmc', now() - interval '1 day'),
  ((select id from samples where lower(kode) = lower('SMP-0010')), 'dipegang', '7019770e-faea-5467-98ad-3c4a088d602e', 'fd438ea5-9664-51d4-9fed-4744fe5c6d8d', '', now() - interval '2 day'),
  ((select id from samples where lower(kode) = lower('SMP-0010')), 'dikirim', '7019770e-faea-5467-98ad-3c4a088d602e', null, '@brand.partner', now() - interval '1 day')
) as v(sample_id, ke, oleh_id, pemegang_id, kreator, pada)
where not exists (select 1 from sample_events);

-- Masalah ---------------------------------------------------------------
insert into problems (judul, konteks, unit_id, dilaporkan_oleh, dampak, status, solusi)
select * from (values
  ('GMV akun beauty turun 3 pekan berturut-turut', 'Turun dari Rp 4,2 Jt/hari menjadi Rp 2,1 Jt/hari sejak awal Oktober.', '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'tinggi'::dampak_masalah, 'selesai'::status_masalah, 'Jadwal pelatihan host dibuat bulanan, minimal 2 host cadangan per akun. Sementara itu 8 sesi live tambahan pekan ini diisi host dari akun lain.'),
  ('Laporan harian sering terlambat di unit MCN', 'Rata-rata masuk pukul 21.00, jauh setelah batas 18.00.', 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, 'sedang'::dampak_masalah, 'diproses'::status_masalah, ''),
  ('Sampel sering tidak kembali setelah dikirim ke kreator', '6 dari 20 sampel bulan lalu tidak pernah kembali.', '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'sedang'::dampak_masalah, 'diproses'::status_masalah, ''),
  ('Absensi selfie gagal di beberapa perangkat Android lama', 'Tiga staf melaporkan kamera tidak terbuka sejak pekan lalu.', 'f1b49e07-9937-5915-bedc-37348bdf1ac1'::uuid, 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, 'rendah'::dampak_masalah, 'baru'::status_masalah, '')
) as v(judul, konteks, unit_id, dilaporkan_oleh, dampak, status, solusi)
where not exists (select 1 from problems);

-- Catatan ---------------------------------------------------------------
insert into notes (judul, isi, kategori, visibilitas, unit_id, disematkan, lampiran, dibuat_oleh)
select * from (values
  ('Templat chat admin kreator', 'Halo Kak, terima kasih sudah bergabung.

1. Kirim link produk yang dipilih.
2. Konfirmasi jadwal live.
3. Laporkan kendala lewat grup.', 'sop'::kategori_catatan, 'unit'::visibilitas_catatan, 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, true, array[]::text[], '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid),
  ('Review harian 24 Oktober', 'Dua akun beauty masih di bawah target. Minta host cadangan siap pekan depan.', 'rapat'::kategori_catatan, 'pribadi'::visibilitas_catatan, null::uuid, false, array[]::text[], '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('Lima jenis dokumen di bawah SOP', 'Kebijakan, prosedur, instruksi kerja, formulir, dan rekaman. Setiap SOP baru harus menyebut kelimanya.', 'dokumentasi'::kategori_catatan, 'perusahaan'::visibilitas_catatan, null::uuid, false, array['https://contoh.invalid/dokumen-sop.png']::text[], '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33'::uuid)
) as v(judul, isi, kategori, visibilitas, unit_id, disematkan, lampiran, dibuat_oleh)
where not exists (select 1 from notes);

-- Kursus ----------------------------------------------------------------
insert into courses (judul, ringkasan, kategori, tingkat, unit_id, wajib_untuk, dibuat_oleh)
select * from (values
  ('Dasar Live Streaming TikTok Shop', 'Menyiapkan sesi live yang layak tayang: pencahayaan, skrip, dan penanganan komentar.', 'Affiliator', 'dasar'::tingkat_kursus, '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, '{"Staff"}'::peran_pengguna[], '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('Membaca Angka GMV & Target Harian', 'Memahami dari mana angka target datang dan apa artinya bagi pekerjaan sehari-hari.', 'GRD', 'dasar'::tingkat_kursus, null::uuid, '{"Staff","Leader","Co-Leader"}'::peran_pengguna[], '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('Creator Binding untuk MCN', 'Alur mengikat kreator baru, dari pendekatan awal sampai verifikasi.', 'MCN', 'menengah'::tingkat_kursus, 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, '{}'::peran_pengguna[], '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('Etika Kerja & Kerahasiaan Data', 'Apa yang boleh dan tidak boleh dibagikan keluar, termasuk angka penjualan.', 'Umum', 'dasar'::tingkat_kursus, null::uuid, '{"CEO","Manager","Leader","Co-Leader","Staff","Finance"}'::peran_pengguna[], '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('Brand Ads Campaign untuk TAP', 'Menyusun proposal kampanye dan melaporkan hasilnya ke brand.', 'TAP', 'lanjutan'::tingkat_kursus, 'f1b49e07-9937-5915-bedc-37348bdf1ac1'::uuid, '{}'::peran_pengguna[], '7019770e-faea-5467-98ad-3c4a088d602e'::uuid)
) as v(judul, ringkasan, kategori, tingkat, unit_id, wajib_untuk, dibuat_oleh)
where not exists (select 1 from courses);

-- Modul kursus ----------------------------------------------------------
insert into course_modules (course_id, urutan, judul, isi, durasi_menit)
select * from (values
  ((select id from courses where judul = 'Dasar Live Streaming TikTok Shop'), 1, 'Menyiapkan alat & pencahayaan', 'Sesi live yang layak tayang tidak butuh alat mahal, tapi butuh tiga hal yang konsisten: cahaya yang merata di wajah, suara yang bersih, dan gambar yang stabil.

Letakkan sumber cahaya di depan, bukan di belakang. Cahaya dari belakang membuat wajah gelap dan penonton pergi dalam hitungan detik.

Periksa suara sebelum mulai. Suara yang pecah lebih cepat mengusir penonton daripada gambar yang kurang tajam.

Kunci ponsel pada tripod. Gambar yang bergoyang membuat penonton lelah tanpa mereka sadari alasannya.', 12),
  ((select id from courses where judul = 'Dasar Live Streaming TikTok Shop'), 2, 'Menyusun skrip 60 menit', 'Skrip bukan naskah yang dibaca kata per kata, melainkan urutan yang menjaga sesi tidak kehilangan arah.

Bagi 60 menit menjadi enam blok 10 menit. Tiap blok punya satu produk utama dan satu ajakan yang jelas.

Sediakan dua menit di setiap blok untuk menjawab komentar. Sesi yang tidak pernah menjawab terasa seperti iklan.

Siapkan penutup yang sama setiap kali. Penonton yang hafal penutupmu tahu kapan harus bertindak.', 18),
  ((select id from courses where judul = 'Dasar Live Streaming TikTok Shop'), 3, 'Menangani komentar dan keberatan', 'Sebagian besar keberatan berulang: harga, keaslian, dan lama pengiriman. Siapkan jawabannya sebelum live, bukan saat ditanya.

Jawab keberatan dengan fakta, bukan bantahan. Sebutkan nomor batch, garansi, atau perkiraan waktu kirim.

Komentar kasar tidak perlu dilayani. Sapa yang bertanya dengan sungguh-sungguh, abaikan sisanya tanpa menyebutnya.', 15),
  ((select id from courses where judul = 'Dasar Live Streaming TikTok Shop'), 4, 'Membaca angka setelah live', 'Angka yang paling menolong bukan total penonton, melainkan berapa yang bertahan lebih dari lima menit.

Bandingkan GMV per jam tayang, bukan GMV total. Sesi empat jam yang menghasilkan sama dengan sesi dua jam berarti dua jam terbuang.

Catat satu hal yang akan diubah di sesi berikutnya. Satu, bukan lima — perubahan yang terlalu banyak membuat sebabnya tak terlacak.', 10),
  ((select id from courses where judul = 'Membaca Angka GMV & Target Harian'), 1, 'Base, Goal, Stretch', 'Base adalah angka yang harus tercapai agar operasional tetap sehat. Tidak mencapainya berarti ada yang perlu dibereskan segera.

Goal adalah target yang disepakati. Inilah angka yang dipakai menilai apakah rencana berjalan.

Stretch adalah angka terbaik yang masuk akal bila semuanya berpihak. Ia bukan hukuman bila tidak tercapai.

Pada skala KPI 1.000: base bernilai 500, goal 800, dan stretch 1.000. Di antaranya dihitung lurus.', 10),
  ((select id from courses where judul = 'Membaca Angka GMV & Target Harian'), 2, 'Anak tangga bulanan', 'Target tahunan dipecah menjadi anak tangga bulanan supaya kekurangan terlihat sejak awal, bukan di bulan terakhir.

Anak tangga tidak selalu rata. Bulan dengan kampanye besar wajar dipatok lebih tinggi.

Yang penting dijaga: jumlah seluruh anak tangga sama dengan target tahunannya.', 12),
  ((select id from courses where judul = 'Membaca Angka GMV & Target Harian'), 3, 'Membaca scorecard sendiri', 'Skor KPI dihitung dari indikator yang memang berlaku untukmu. Indikator yang tidak kamu pegang tidak dinilai, dan bobotnya dibagi ulang.

Perhatikan cakupannya. Skor 1.000 dengan cakupan 25% berarti hanya seperempat bobot yang benar-benar terukur.

Kalau ada indikator yang tertulis ''tidak berlaku'' padahal seharusnya berlaku, itu tanda datanya belum masuk — bukan tanda kamu aman.', 10),
  ((select id from courses where judul = 'Creator Binding untuk MCN'), 1, 'Menyaring calon kreator', '', 15),
  ((select id from courses where judul = 'Creator Binding untuk MCN'), 2, 'Percakapan pertama', '', 12),
  ((select id from courses where judul = 'Creator Binding untuk MCN'), 3, 'Verifikasi & dokumen', '', 20),
  ((select id from courses where judul = 'Etika Kerja & Kerahasiaan Data'), 1, 'Data mana yang rahasia', '', 8),
  ((select id from courses where judul = 'Etika Kerja & Kerahasiaan Data'), 2, 'Berbagi dengan mitra', '', 10),
  ((select id from courses where judul = 'Brand Ads Campaign untuk TAP'), 1, 'Membaca brief brand', '', 15),
  ((select id from courses where judul = 'Brand Ads Campaign untuk TAP'), 2, 'Menyusun proposal', '', 25),
  ((select id from courses where judul = 'Brand Ads Campaign untuk TAP'), 3, 'Laporan hasil kampanye', '', 20)
) as v(course_id, urutan, judul, isi, durasi_menit)
where not exists (select 1 from course_modules);

-- Pendaftaran kursus ----------------------------------------------------
insert into course_enrollments (course_id, user_id)
select * from (values
  ((select id from courses where judul = 'Dasar Live Streaming TikTok Shop'), '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid),
  ((select id from courses where judul = 'Dasar Live Streaming TikTok Shop'), '7f52935c-fccd-55c6-9d33-341cf854fb18'::uuid),
  ((select id from courses where judul = 'Dasar Live Streaming TikTok Shop'), 'ad72efba-7708-5742-9bea-3e70ead115f2'::uuid),
  ((select id from courses where judul = 'Membaca Angka GMV & Target Harian'), '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid),
  ((select id from courses where judul = 'Membaca Angka GMV & Target Harian'), '581aa0ce-6f9c-5d52-8922-c102e64aa12c'::uuid),
  ((select id from courses where judul = 'Etika Kerja & Kerahasiaan Data'), '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid),
  ((select id from courses where judul = 'Creator Binding untuk MCN'), '56e8a824-7195-5cca-8b01-80b5516bd3db'::uuid)
) as v(course_id, user_id)
where not exists (select 1 from course_enrollments);

-- Kemajuan per modul ----------------------------------------------------
insert into module_progress (enrollment_id, module_id)
select * from (values
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Dasar Live Streaming TikTok Shop' and en.user_id = '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Dasar Live Streaming TikTok Shop' and m.urutan = 1)),
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Dasar Live Streaming TikTok Shop' and en.user_id = '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Dasar Live Streaming TikTok Shop' and m.urutan = 2)),
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Dasar Live Streaming TikTok Shop' and en.user_id = '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Dasar Live Streaming TikTok Shop' and m.urutan = 3)),
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Dasar Live Streaming TikTok Shop' and en.user_id = '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Dasar Live Streaming TikTok Shop' and m.urutan = 4)),
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Dasar Live Streaming TikTok Shop' and en.user_id = '7f52935c-fccd-55c6-9d33-341cf854fb18'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Dasar Live Streaming TikTok Shop' and m.urutan = 1)),
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Dasar Live Streaming TikTok Shop' and en.user_id = '7f52935c-fccd-55c6-9d33-341cf854fb18'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Dasar Live Streaming TikTok Shop' and m.urutan = 2)),
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Membaca Angka GMV & Target Harian' and en.user_id = '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Membaca Angka GMV & Target Harian' and m.urutan = 1)),
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Membaca Angka GMV & Target Harian' and en.user_id = '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Membaca Angka GMV & Target Harian' and m.urutan = 2)),
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Membaca Angka GMV & Target Harian' and en.user_id = '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Membaca Angka GMV & Target Harian' and m.urutan = 3)),
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Membaca Angka GMV & Target Harian' and en.user_id = '581aa0ce-6f9c-5d52-8922-c102e64aa12c'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Membaca Angka GMV & Target Harian' and m.urutan = 1)),
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Etika Kerja & Kerahasiaan Data' and en.user_id = '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Etika Kerja & Kerahasiaan Data' and m.urutan = 1)),
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Creator Binding untuk MCN' and en.user_id = '56e8a824-7195-5cca-8b01-80b5516bd3db'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Creator Binding untuk MCN' and m.urutan = 1)),
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Creator Binding untuk MCN' and en.user_id = '56e8a824-7195-5cca-8b01-80b5516bd3db'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Creator Binding untuk MCN' and m.urutan = 2)),
  ((select en.id from course_enrollments en join courses c on c.id = en.course_id where c.judul = 'Creator Binding untuk MCN' and en.user_id = '56e8a824-7195-5cca-8b01-80b5516bd3db'::uuid), (select m.id from course_modules m join courses c on c.id = m.course_id where c.judul = 'Creator Binding untuk MCN' and m.urutan = 3))
) as v(enrollment_id, module_id)
where not exists (select 1 from module_progress);

-- Soal kuis -------------------------------------------------------------
insert into quiz_questions (module_id, urutan, pertanyaan, pilihan)
select * from (values
  ((select m.id from course_modules m where m.judul = 'Base, Goal, Stretch'), 1, 'Pada skala KPI 1.000, berapa nilai skor bila capaian tepat di Goal?', array['500', '650', '800', '1.000']::text[]),
  ((select m.id from course_modules m where m.judul = 'Base, Goal, Stretch'), 2, 'Apa arti tidak tercapainya Base?', array['Bonus batal', 'Ada yang perlu dibereskan segera', 'Target tahun depan diturunkan', 'Tidak berarti apa-apa']::text[]),
  ((select m.id from course_modules m where m.judul = 'Base, Goal, Stretch'), 3, 'Stretch paling tepat dipahami sebagai…', array['Hukuman bila tidak tercapai', 'Angka terbaik yang masuk akal bila semuanya berpihak', 'Angka wajib', 'Rata-rata tahun lalu']::text[]),
  ((select m.id from course_modules m where m.judul = 'Menyiapkan alat & pencahayaan'), 1, 'Di mana sebaiknya sumber cahaya diletakkan?', array['Di belakang host', 'Di depan host', 'Di lantai', 'Tidak perlu cahaya tambahan']::text[]),
  ((select m.id from course_modules m where m.judul = 'Menyiapkan alat & pencahayaan'), 2, 'Mana yang lebih cepat mengusir penonton?', array['Gambar kurang tajam', 'Suara yang pecah', 'Latar polos', 'Host tidak memakai seragam']::text[]),
  ((select m.id from course_modules m where m.judul = 'Data mana yang rahasia'), 1, 'Angka GMV per akun termasuk data…', array['Publik', 'Rahasia internal', 'Boleh dibagikan ke kreator', 'Boleh diunggah ke media sosial']::text[]),
  ((select m.id from course_modules m where m.judul = 'Data mana yang rahasia'), 2, 'Bila mitra meminta data penjualan rinci, yang tepat dilakukan adalah…', array['Kirim langsung', 'Tolak dan teruskan permintaannya ke Manager', 'Kirim sebagian', 'Abaikan']::text[])
) as v(module_id, urutan, pertanyaan, pilihan)
where not exists (select 1 from quiz_questions);

-- Kunci jawaban ---------------------------------------------------------
insert into quiz_keys (question_id, jawaban_benar, penjelasan)
select * from (values
  ((select qq.id from quiz_questions qq join course_modules m on m.id = qq.module_id where m.judul = 'Base, Goal, Stretch' and qq.urutan = 1), 2, 'Base bernilai 500, Goal 800, dan Stretch 1.000.'),
  ((select qq.id from quiz_questions qq join course_modules m on m.id = qq.module_id where m.judul = 'Base, Goal, Stretch' and qq.urutan = 2), 1, 'Base adalah angka minimum agar operasional tetap sehat.'),
  ((select qq.id from quiz_questions qq join course_modules m on m.id = qq.module_id where m.judul = 'Base, Goal, Stretch' and qq.urutan = 3), 1, 'Stretch bukan kewajiban; ia menandai hasil terbaik yang masuk akal.'),
  ((select qq.id from quiz_questions qq join course_modules m on m.id = qq.module_id where m.judul = 'Menyiapkan alat & pencahayaan' and qq.urutan = 1), 1, 'Cahaya dari belakang membuat wajah gelap.'),
  ((select qq.id from quiz_questions qq join course_modules m on m.id = qq.module_id where m.judul = 'Menyiapkan alat & pencahayaan' and qq.urutan = 2), 1, 'Penonton bertahan pada gambar seadanya, tapi tidak pada suara buruk.'),
  ((select qq.id from quiz_questions qq join course_modules m on m.id = qq.module_id where m.judul = 'Data mana yang rahasia' and qq.urutan = 1), 1, 'Angka penjualan per akun hanya untuk internal.'),
  ((select qq.id from quiz_questions qq join course_modules m on m.id = qq.module_id where m.judul = 'Data mana yang rahasia' and qq.urutan = 2), 1, 'Permintaan data keluar diputuskan Manager, bukan per orang.')
) as v(question_id, jawaban_benar, penjelasan)
where not exists (select 1 from quiz_keys);

-- Masukan & bug ---------------------------------------------------------
insert into feedback
  (jenis, judul, isi, keparahan, halaman, status, alasan_tolak,
   dilaporkan_oleh, ditugaskan_ke)
select * from (values
  ('bug'::jenis_masukan, 'Absensi selfie gagal terbuka di Android 8', 'Tombol ambil foto ditekan, kamera tidak terbuka sama sekali. Sudah dicoba di dua perangkat Android 8.', 'berat'::keparahan_bug, '/absensi', 'dikerjakan'::status_masukan, '', 'fd438ea5-9664-51d4-9fed-4744fe5c6d8d'::uuid, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('saran'::jenis_masukan, 'Tambahkan pengingat laporan harian jam 17.00', 'Banyak yang lupa mengisi sebelum pulang. Pengingat satu jam sebelum batas akan sangat menolong.', null::keparahan_bug, '/laporan-harian', 'ditinjau'::status_masukan, '', '581aa0ce-6f9c-5d52-8922-c102e64aa12c'::uuid, null::uuid),
  ('bug'::jenis_masukan, 'Angka GMV di beranda berbeda dengan halaman laporan', 'Beranda menampilkan Rp 34,2 Jt sementara laporan harian menjumlahkan Rp 34,7 Jt untuk tanggal yang sama.', 'kritis'::keparahan_bug, '/beranda', 'selesai'::status_masukan, '', 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('saran'::jenis_masukan, 'Izinkan mengunduh rekap absensi sebagai Excel', 'Untuk keperluan penggajian, rekapnya perlu dibuka di Excel.', null::keparahan_bug, '/absensi/rekap', 'baru'::status_masukan, '', '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid, null::uuid),
  ('pertanyaan'::jenis_masukan, 'Apakah target stretch memengaruhi bonus bulanan?', 'Belum jelas apakah mencapai stretch berpengaruh ke bonus.', null::keparahan_bug, '/grd', 'ditolak'::status_masukan, 'Pertanyaan kebijakan, bukan masukan produk. Sudah dijawab langsung di rapat mingguan.', '48e841ca-3e54-5c76-a7c5-084b7cd81677'::uuid, null::uuid)
) as v(jenis, judul, isi, keparahan, halaman, status, alasan_tolak,
       dilaporkan_oleh, ditugaskan_ke)
where not exists (select 1 from feedback);

-- Dukungan masukan ------------------------------------------------------
insert into feedback_votes (feedback_id, user_id)
select * from (values
  ((select id from feedback where judul = 'Absensi selfie gagal terbuka di Android 8'), '2f4160f3-fea1-5b98-ba6c-f93645b4fbc0'::uuid),
  ((select id from feedback where judul = 'Absensi selfie gagal terbuka di Android 8'), 'f65668c7-d2d9-5812-b4a9-2e085cce40c6'::uuid),
  ((select id from feedback where judul = 'Absensi selfie gagal terbuka di Android 8'), '73eab5ac-5007-5391-913e-01e9ad855f45'::uuid),
  ((select id from feedback where judul = 'Tambahkan pengingat laporan harian jam 17.00'), '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid),
  ((select id from feedback where judul = 'Tambahkan pengingat laporan harian jam 17.00'), '56e8a824-7195-5cca-8b01-80b5516bd3db'::uuid),
  ((select id from feedback where judul = 'Tambahkan pengingat laporan harian jam 17.00'), '66f8b261-08cb-58cd-980d-ea3cb7f2f61d'::uuid),
  ((select id from feedback where judul = 'Tambahkan pengingat laporan harian jam 17.00'), '26acd2f9-a9bd-5479-84e9-6ecf01b58709'::uuid),
  ((select id from feedback where judul = 'Angka GMV di beranda berbeda dengan halaman laporan'), '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid),
  ((select id from feedback where judul = 'Apakah target stretch memengaruhi bonus bulanan?'), '0c613b14-b429-57b2-aed0-395751a41d97'::uuid)
) as v(feedback_id, user_id)
where not exists (select 1 from feedback_votes);

-- Komentar masukan ------------------------------------------------------
insert into feedback_comments (feedback_id, oleh_id, isi)
select * from (values
  ((select id from feedback where judul = 'Absensi selfie gagal terbuka di Android 8'), '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'Sudah bisa ditiru di perangkat uji. Sedang dicari penyebabnya.'),
  ((select id from feedback where judul = 'Angka GMV di beranda berbeda dengan halaman laporan'), '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'Penyebabnya laporan revisi terhitung dua kali. Sudah diperbaiki.')
) as v(feedback_id, oleh_id, isi)
where not exists (select 1 from feedback_comments);

-- Agenda ----------------------------------------------------------------
insert into agenda (judul, keterangan, jenis, tanggal, jam_mulai, jam_selesai, unit_id, lokasi, dibuat_oleh)
select * from (values
  ('Rapat mingguan WRM', 'Membahas matriks WRM pekan lalu dan keputusan pekan ini.', 'rapat'::jenis_agenda, '2024-10-21'::date, '09:00'::time, '10:30'::time, null::uuid, 'Ruang rapat lantai 2', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('Rapat mingguan WRM', '', 'rapat'::jenis_agenda, '2024-10-28'::date, '09:00'::time, '10:30'::time, null::uuid, 'Ruang rapat lantai 2', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('Kelas MMC angkatan 4', 'Materi: creator binding dan etika konten.', 'pelatihan'::jenis_agenda, '2024-10-24'::date, '13:00'::time, '16:00'::time, 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, 'Studio MCN', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('Briefing kampanye 11.11', 'Persiapan stok dan jadwal live.', 'rapat'::jenis_agenda, '2024-10-25'::date, '15:00'::time, '16:00'::time, '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, 'Ruang rapat lantai 2', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('Maulid Nabi', 'Libur nasional.', 'libur'::jenis_agenda, '2024-09-16'::date, null::time, null::time, null::uuid, '', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('Tutup buku Oktober', 'Batas akhir seluruh laporan harian Oktober masuk.', 'lainnya'::jenis_agenda, '2024-10-31'::date, '16:00'::time, null::time, null::uuid, '', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('Pelatihan host cadangan', 'Tindak lanjut masalah GMV akun beauty.', 'pelatihan'::jenis_agenda, '2024-11-04'::date, '10:00'::time, '12:00'::time, '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, 'Studio Affiliator', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid),
  ('Sesi foto produk bersama', 'Pengambilan foto katalog untuk kampanye November.', 'lainnya'::jenis_agenda, '2024-10-24'::date, '15:00'::time, '17:00'::time, null::uuid, 'Studio lantai 1', '7019770e-faea-5467-98ad-3c4a088d602e'::uuid)
) as v(judul, keterangan, jenis, tanggal, jam_mulai, jam_selesai, unit_id, lokasi, dibuat_oleh)
where not exists (select 1 from agenda);

-- Transaksi keuangan --------------------------------------------------
update keuangan_pengaturan set kas_awal = 185000000 where id;

insert into transactions (id, tanggal, arah, jenis, unit_id, account_id, keterangan, jumlah, diajukan_id)
select * from (values
  ('bf449933-c24f-4891-98dd-a9e67138c468'::uuid, '2024-09-06'::date, 'masuk'::arah_transaksi, null::jenis_keluar, '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925'::uuid, 'Pencairan komisi TikTok Shop periode 21–31 Agu', 158200000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('180c9be7-f3f2-459b-a2ba-ac9f6fdff738'::uuid, '2024-09-06'::date, 'masuk'::arah_transaksi, null::jenis_keluar, 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, null::uuid, 'Pencairan MCN periode 21–31 Agu', 81500000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('b663ff0b-4822-41e8-81af-97511f309645'::uuid, '2024-09-09'::date, 'keluar'::arah_transaksi, 'creator_share'::jenis_keluar, 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, null::uuid, 'Bagi hasil kreator MCN Agustus', 34100000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('ab374e79-f68b-433e-976a-753dcc4c4247'::uuid, '2024-09-11'::date, 'keluar'::arah_transaksi, 'direct_cost'::jenis_keluar, '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, '6bc1d8ed-0115-50a0-a6b5-ae5570c9a925'::uuid, 'Iklan TikTok akun beauty daily', 21800000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('43973bd0-0a66-4451-9dcd-804cf488e1c3'::uuid, '2024-09-10'::date, 'keluar'::arah_transaksi, 'beban'::jenis_keluar, null::uuid, null::uuid, 'Gaji tim September', 74500000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('b6ca9980-49c1-42dc-9ddf-aa27d9d7261f'::uuid, '2024-10-05'::date, 'masuk'::arah_transaksi, null::jenis_keluar, '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, '23f37851-57bd-55bd-9d1a-8699874b39a1'::uuid, 'Pencairan komisi TikTok Shop periode 21–30 Sep', 186400000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('2bdb507d-b4b1-4b4c-9b8b-bf4a47eb5dfd'::uuid, '2024-10-05'::date, 'masuk'::arah_transaksi, null::jenis_keluar, 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, null::uuid, 'Pencairan MCN periode 21–30 Sep', 92300000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('787d7276-8bca-42e3-8a42-d88f0ecd6e37'::uuid, '2024-10-07'::date, 'keluar'::arah_transaksi, 'creator_share'::jenis_keluar, 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, null::uuid, 'Bagi hasil kreator MCN September', 38700000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('55c65085-7d86-4b21-8dcc-13e22a6d484f'::uuid, '2024-10-08'::date, 'keluar'::arah_transaksi, 'direct_cost'::jenis_keluar, '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, '23f37851-57bd-55bd-9d1a-8699874b39a1'::uuid, 'Iklan TikTok akun skincare', 24500000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('653a6136-28d4-4c7c-8009-a23d142c3706'::uuid, '2024-10-10'::date, 'keluar'::arah_transaksi, 'beban'::jenis_keluar, null::uuid, null::uuid, 'Gaji tim Oktober', 78000000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('b3c41384-dd96-4389-8aff-ec16f023dafb'::uuid, '2024-10-12'::date, 'keluar'::arah_transaksi, 'aset'::jenis_keluar, '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, null::uuid, 'Dua set lighting studio live', 18900000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('f76c3249-f871-46cb-b74f-4ed0df627d80'::uuid, '2024-10-15'::date, 'masuk'::arah_transaksi, null::jenis_keluar, 'f1b49e07-9937-5915-bedc-37348bdf1ac1'::uuid, null::uuid, 'Termin pertama kampanye brand ads', 64000000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('ba692b76-0584-44c4-8f13-fa36109b335c'::uuid, '2024-10-18'::date, 'keluar'::arah_transaksi, 'beban'::jenis_keluar, null::uuid, null::uuid, 'Sewa kantor kuartal IV', 45000000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('665b79a2-5248-400d-97a8-7bd494bac801'::uuid, '2024-10-21'::date, 'keluar'::arah_transaksi, 'beban'::jenis_keluar, 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, null::uuid, 'Konsumsi MMC Oktober', 3200000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('5bae9eee-bc9d-4309-b31f-7b671cf2e976'::uuid, '2024-10-22'::date, 'keluar'::arah_transaksi, 'aset'::jenis_keluar, 'f1b49e07-9937-5915-bedc-37348bdf1ac1'::uuid, null::uuid, 'Laptop editor TAP', 21500000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('c4e44309-c6fc-4f0f-a402-2dd249c9aeaa'::uuid, '2024-10-23'::date, 'keluar'::arah_transaksi, 'direct_cost'::jenis_keluar, '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, '341fd812-5440-518a-af7c-d9e589d9cc39'::uuid, 'Iklan akun fashion hijab', 9800000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('1a2e4861-7dcd-4dc3-b12d-24961f5138b7'::uuid, '2024-10-09'::date, 'keluar'::arah_transaksi, 'dividen'::jenis_keluar, null::uuid, null::uuid, 'Dividen pemegang saham kuartal III', 50000000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid),
  ('dd983c69-4e64-4d05-8de3-f5059ba8bba5'::uuid, '2024-10-20'::date, 'keluar'::arah_transaksi, 'beban'::jenis_keluar, null::uuid, null::uuid, 'Langganan alat desain & penjadwalan', 4600000, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid)
) as v(id, tanggal, arah, jenis, unit_id, account_id, keterangan, jumlah, diajukan_id)
where not exists (select 1 from transactions);



-- Aset & inventaris ----------------------------------------------------
insert into assets (id, kode, nama, kategori, unit_id, tanggal, nilai_perolehan,
                    masa_manfaat, residu, status, pemegang_id, lokasi, berakhir,
                    transaction_id, catatan)
select * from (values
  ('e4421f3e-9323-45e9-941b-0b3b6ca21f07'::uuid, 'AST-0001', 'Laptop editor MacBook Pro 14', 'Elektronik', 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, '2023-03-15'::date, 32500000, 48, 5000000, 'dipakai'::status_aset, '56e8a824-7195-5cca-8b01-80b5516bd3db'::uuid, 'Studio MCN Lt. 2', null::date, null::uuid, 'Mesin utama pemotongan kasar.'),
  ('0d8b1334-a752-4f7b-8c8f-91d689213dd7'::uuid, 'AST-0002', 'Kamera Sony A7 IV', 'Elektronik', 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, '2023-06-02'::date, 38900000, 60, 6000000, 'dipakai'::status_aset, '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, 'Studio MCN Lt. 2', null::date, null::uuid, ''),
  ('11809d69-57e0-423c-bf4b-c2a1c4523046'::uuid, 'AST-0003', 'Dua set lighting studio live', 'Peralatan studio', '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, '2024-10-12'::date, 18900000, 36, 0, 'dipakai'::status_aset, 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'Studio live Affiliator', null::date, 'b3c41384-dd96-4389-8aff-ec16f023dafb'::uuid, 'Lahir dari transaksi aset yang sudah dibayar.'),
  ('cd45c49a-6ad9-49d3-950a-45601bb8e856'::uuid, 'AST-0004', 'PC editing Ryzen 9', 'Elektronik', 'f1b49e07-9937-5915-bedc-37348bdf1ac1'::uuid, '2022-11-08'::date, 27400000, 48, 3000000, 'dipakai'::status_aset, 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, 'Ruang kerja TAP', null::date, null::uuid, ''),
  ('c1996503-770a-480c-9e08-3ac0e3415a5f'::uuid, 'AST-0005', 'Green screen dan rigging', 'Peralatan studio', 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, '2023-01-20'::date, 6800000, 36, 0, 'dipakai'::status_aset, '581aa0ce-6f9c-5d52-8922-c102e64aa12c'::uuid, 'Gudang Lt. 1', null::date, null::uuid, 'Dipakai bergantian saat studio penuh.'),
  ('f3e2f6ec-cbe0-4baf-95fa-3eb85c234297'::uuid, 'AST-0006', 'iPhone 13 untuk akun live', 'Elektronik', '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, '2023-08-14'::date, 12900000, 36, 2000000, 'dipakai'::status_aset, 'ad72efba-7708-5742-9bea-3e70ead115f2'::uuid, 'Dibawa pemegang', null::date, null::uuid, ''),
  ('8d5a2dbd-c75b-434a-8f54-fd39b235bb0c'::uuid, 'AST-0007', 'Meja kerja modular 6 unit', 'Perabot', null::uuid, '2022-09-01'::date, 15600000, 96, 0, 'dipakai'::status_aset, null::uuid, 'Kantor Lt. 1', null::date, null::uuid, 'Perabot bersama, tidak dipegang perorangan.'),
  ('00edcf51-12a6-4e9c-8e67-bd9afd11523b'::uuid, 'AST-0008', 'Mikrofon Rode Wireless Go II', 'Elektronik', 'f1b49e07-9937-5915-bedc-37348bdf1ac1'::uuid, '2023-05-11'::date, 4950000, 36, 0, 'dipakai'::status_aset, '73eab5ac-5007-5391-913e-01e9ad855f45'::uuid, 'Servis resmi Bandung', null::date, null::uuid, 'Kanal kanan mati sejak 9 Okt 2024.'),
  ('5d9c93da-a19e-4f02-b241-626548b68835'::uuid, 'AST-0009', 'Gimbal DJI RS 3 dan tripod', 'Peralatan studio', 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, '2023-04-03'::date, 8700000, 36, 0, 'dipakai'::status_aset, '581aa0ce-6f9c-5d52-8922-c102e64aa12c'::uuid, 'Studio MCN Lt. 2', null::date, null::uuid, ''),
  ('456b392a-d8ee-4fe2-b6b1-2c5de4d4160b'::uuid, 'AST-0010', 'Laptop ASUS Vivobook staf', 'Elektronik', '19570324-4683-5829-9eb5-4c69aa62222a'::uuid, '2022-07-19'::date, 9300000, 48, 1000000, 'dipakai'::status_aset, '48e841ca-3e54-5c76-a7c5-084b7cd81677'::uuid, 'Tidak diketahui', null::date, null::uuid, 'Belum kembali setelah pemegangnya berhenti; sudah dilaporkan ke Manager.'),
  ('9fad67ec-c044-428b-9df1-b9719cd866fa'::uuid, 'AST-0011', 'Printer dan pemindai kantor', 'Perabot', null::uuid, '2021-12-05'::date, 5400000, 60, 0, 'dipakai'::status_aset, null::uuid, '—', null::date, null::uuid, 'Dijual, diganti sewa mesin.'),
  ('22f764cb-6738-4cfd-b108-43385b60772d'::uuid, 'AST-0012', 'AC 1,5 PK ruang studio', 'Perabot', 'db5378cf-cefb-5acc-9e22-8d62911fe882'::uuid, '2022-10-10'::date, 6200000, 60, 0, 'dipakai'::status_aset, null::uuid, 'Studio MCN Lt. 2', null::date, null::uuid, '')
) as v(id, kode, nama, kategori, unit_id, tanggal, nilai_perolehan, masa_manfaat,
       residu, status, pemegang_id, lokasi, berakhir, transaction_id, catatan)
where not exists (select 1 from assets a where a.kode = v.kode);

insert into asset_events (asset_id, ke, oleh_id, pemegang_id, lokasi, catatan, pada)
select 'e4421f3e-9323-45e9-941b-0b3b6ca21f07'::uuid, 'dipakai'::status_aset, '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, '72005e8f-e3c0-51fe-ade9-0d6f3a5d508d'::uuid, 'Studio MCN Lt. 2', 'Serah terima saat Rizky pindah ke tim riset.', '2024-02-05'::timestamptz
where not exists (
  select 1 from asset_events
  where asset_id = 'e4421f3e-9323-45e9-941b-0b3b6ca21f07'::uuid and pada = '2024-02-05'::timestamptz
);
insert into asset_events (asset_id, ke, oleh_id, pemegang_id, lokasi, catatan, pada)
select 'c1996503-770a-480c-9e08-3ac0e3415a5f'::uuid, 'cadangan'::status_aset, '32de9d7a-0ac4-5c56-a57f-aeb9f7099b97'::uuid, null::uuid, 'Gudang Lt. 1', 'Dikembalikan ke gudang setelah studio dirapikan.', '2024-06-18'::timestamptz
where not exists (
  select 1 from asset_events
  where asset_id = 'c1996503-770a-480c-9e08-3ac0e3415a5f'::uuid and pada = '2024-06-18'::timestamptz
);
insert into asset_events (asset_id, ke, oleh_id, pemegang_id, lokasi, catatan, pada)
select 'f3e2f6ec-cbe0-4baf-95fa-3eb85c234297'::uuid, 'dipakai'::status_aset, 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, '484a9a6a-149f-56d0-a15a-9215cf7403a3'::uuid, 'Dibawa pemegang', 'Ikut pindah bersama PIC akun beauty.', '2024-05-02'::timestamptz
where not exists (
  select 1 from asset_events
  where asset_id = 'f3e2f6ec-cbe0-4baf-95fa-3eb85c234297'::uuid and pada = '2024-05-02'::timestamptz
);
insert into asset_events (asset_id, ke, oleh_id, pemegang_id, lokasi, catatan, pada)
select '00edcf51-12a6-4e9c-8e67-bd9afd11523b'::uuid, 'perbaikan'::status_aset, 'c5631790-4df7-5d06-b9db-ee468783017f'::uuid, '73eab5ac-5007-5391-913e-01e9ad855f45'::uuid, 'Servis resmi Bandung', 'Kanal kanan mati saat rekaman.', '2024-10-09'::timestamptz
where not exists (
  select 1 from asset_events
  where asset_id = '00edcf51-12a6-4e9c-8e67-bd9afd11523b'::uuid and pada = '2024-10-09'::timestamptz
);
insert into asset_events (asset_id, ke, oleh_id, pemegang_id, lokasi, catatan, pada)
select '456b392a-d8ee-4fe2-b6b1-2c5de4d4160b'::uuid, 'dipakai'::status_aset, 'e2391748-8e38-5009-b5d6-758e232c6381'::uuid, 'b7c1e0d2-4a3f-5e6b-8c9d-1f2a3b4c5d6e'::uuid, 'Dibawa pemegang', 'Serah terima antar staf, tanpa berita acara.', '2023-11-06'::timestamptz
where not exists (
  select 1 from asset_events
  where asset_id = '456b392a-d8ee-4fe2-b6b1-2c5de4d4160b'::uuid and pada = '2023-11-06'::timestamptz
);
insert into asset_events (asset_id, ke, oleh_id, pemegang_id, lokasi, catatan, pada)
select '456b392a-d8ee-4fe2-b6b1-2c5de4d4160b'::uuid, 'hilang'::status_aset, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'b7c1e0d2-4a3f-5e6b-8c9d-1f2a3b4c5d6e'::uuid, 'Tidak diketahui', 'Tidak kembali setelah pemegangnya berhenti.', '2024-09-30'::timestamptz
where not exists (
  select 1 from asset_events
  where asset_id = '456b392a-d8ee-4fe2-b6b1-2c5de4d4160b'::uuid and pada = '2024-09-30'::timestamptz
);
insert into asset_events (asset_id, ke, oleh_id, pemegang_id, lokasi, catatan, pada)
select '9fad67ec-c044-428b-9df1-b9719cd866fa'::uuid, 'dilepas'::status_aset, '2a6feda0-dc3c-5aeb-9122-0640f53e3c33'::uuid, null::uuid, '—', 'Dijual, diganti sewa mesin.', '2024-08-16'::timestamptz
where not exists (
  select 1 from asset_events
  where asset_id = '9fad67ec-c044-428b-9df1-b9719cd866fa'::uuid and pada = '2024-08-16'::timestamptz
);

-- Keputusan atas transaksi ---------------------------------------------
select set_config('request.jwt.claim.sub', '7019770e-faea-5467-98ad-3c4a088d602e', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select 'b663ff0b-4822-41e8-81af-97511f309645'::uuid, 'disetujui'::status_transaksi, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, ''
where exists (
  select 1 from transactions
  where id = 'b663ff0b-4822-41e8-81af-97511f309645'::uuid and status = 'diajukan'
);
select set_config('request.jwt.claim.sub', '7019770e-faea-5467-98ad-3c4a088d602e', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select 'ab374e79-f68b-433e-976a-753dcc4c4247'::uuid, 'disetujui'::status_transaksi, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, ''
where exists (
  select 1 from transactions
  where id = 'ab374e79-f68b-433e-976a-753dcc4c4247'::uuid and status = 'diajukan'
);
select set_config('request.jwt.claim.sub', '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select '43973bd0-0a66-4451-9dcd-804cf488e1c3'::uuid, 'disetujui'::status_transaksi, '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33'::uuid, ''
where exists (
  select 1 from transactions
  where id = '43973bd0-0a66-4451-9dcd-804cf488e1c3'::uuid and status = 'diajukan'
);
select set_config('request.jwt.claim.sub', '7019770e-faea-5467-98ad-3c4a088d602e', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select '787d7276-8bca-42e3-8a42-d88f0ecd6e37'::uuid, 'disetujui'::status_transaksi, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, ''
where exists (
  select 1 from transactions
  where id = '787d7276-8bca-42e3-8a42-d88f0ecd6e37'::uuid and status = 'diajukan'
);
select set_config('request.jwt.claim.sub', '7019770e-faea-5467-98ad-3c4a088d602e', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select '55c65085-7d86-4b21-8dcc-13e22a6d484f'::uuid, 'disetujui'::status_transaksi, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, ''
where exists (
  select 1 from transactions
  where id = '55c65085-7d86-4b21-8dcc-13e22a6d484f'::uuid and status = 'diajukan'
);
select set_config('request.jwt.claim.sub', '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select '653a6136-28d4-4c7c-8009-a23d142c3706'::uuid, 'disetujui'::status_transaksi, '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33'::uuid, ''
where exists (
  select 1 from transactions
  where id = '653a6136-28d4-4c7c-8009-a23d142c3706'::uuid and status = 'diajukan'
);
select set_config('request.jwt.claim.sub', '7019770e-faea-5467-98ad-3c4a088d602e', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select 'b3c41384-dd96-4389-8aff-ec16f023dafb'::uuid, 'disetujui'::status_transaksi, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, ''
where exists (
  select 1 from transactions
  where id = 'b3c41384-dd96-4389-8aff-ec16f023dafb'::uuid and status = 'diajukan'
);
select set_config('request.jwt.claim.sub', '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select 'ba692b76-0584-44c4-8f13-fa36109b335c'::uuid, 'disetujui'::status_transaksi, '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33'::uuid, ''
where exists (
  select 1 from transactions
  where id = 'ba692b76-0584-44c4-8f13-fa36109b335c'::uuid and status = 'diajukan'
);
select set_config('request.jwt.claim.sub', '7019770e-faea-5467-98ad-3c4a088d602e', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select 'c4e44309-c6fc-4f0f-a402-2dd249c9aeaa'::uuid, 'disetujui'::status_transaksi, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, ''
where exists (
  select 1 from transactions
  where id = 'c4e44309-c6fc-4f0f-a402-2dd249c9aeaa'::uuid and status = 'diajukan'
);
select set_config('request.jwt.claim.sub', '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select '1a2e4861-7dcd-4dc3-b12d-24961f5138b7'::uuid, 'disetujui'::status_transaksi, '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33'::uuid, ''
where exists (
  select 1 from transactions
  where id = '1a2e4861-7dcd-4dc3-b12d-24961f5138b7'::uuid and status = 'diajukan'
);
select set_config('request.jwt.claim.sub', '7019770e-faea-5467-98ad-3c4a088d602e', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select 'b663ff0b-4822-41e8-81af-97511f309645'::uuid, 'dibayar'::status_transaksi, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, ''
where exists (
  select 1 from transactions
  where id = 'b663ff0b-4822-41e8-81af-97511f309645'::uuid and status = 'disetujui'
);
select set_config('request.jwt.claim.sub', '7019770e-faea-5467-98ad-3c4a088d602e', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select 'ab374e79-f68b-433e-976a-753dcc4c4247'::uuid, 'dibayar'::status_transaksi, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, ''
where exists (
  select 1 from transactions
  where id = 'ab374e79-f68b-433e-976a-753dcc4c4247'::uuid and status = 'disetujui'
);
select set_config('request.jwt.claim.sub', '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select '43973bd0-0a66-4451-9dcd-804cf488e1c3'::uuid, 'dibayar'::status_transaksi, '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33'::uuid, ''
where exists (
  select 1 from transactions
  where id = '43973bd0-0a66-4451-9dcd-804cf488e1c3'::uuid and status = 'disetujui'
);
select set_config('request.jwt.claim.sub', '7019770e-faea-5467-98ad-3c4a088d602e', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select '787d7276-8bca-42e3-8a42-d88f0ecd6e37'::uuid, 'dibayar'::status_transaksi, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, ''
where exists (
  select 1 from transactions
  where id = '787d7276-8bca-42e3-8a42-d88f0ecd6e37'::uuid and status = 'disetujui'
);
select set_config('request.jwt.claim.sub', '7019770e-faea-5467-98ad-3c4a088d602e', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select '55c65085-7d86-4b21-8dcc-13e22a6d484f'::uuid, 'dibayar'::status_transaksi, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, ''
where exists (
  select 1 from transactions
  where id = '55c65085-7d86-4b21-8dcc-13e22a6d484f'::uuid and status = 'disetujui'
);
select set_config('request.jwt.claim.sub', '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select '653a6136-28d4-4c7c-8009-a23d142c3706'::uuid, 'dibayar'::status_transaksi, '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33'::uuid, ''
where exists (
  select 1 from transactions
  where id = '653a6136-28d4-4c7c-8009-a23d142c3706'::uuid and status = 'disetujui'
);
select set_config('request.jwt.claim.sub', '7019770e-faea-5467-98ad-3c4a088d602e', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select 'b3c41384-dd96-4389-8aff-ec16f023dafb'::uuid, 'dibayar'::status_transaksi, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, ''
where exists (
  select 1 from transactions
  where id = 'b3c41384-dd96-4389-8aff-ec16f023dafb'::uuid and status = 'disetujui'
);
select set_config('request.jwt.claim.sub', '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select 'ba692b76-0584-44c4-8f13-fa36109b335c'::uuid, 'dibayar'::status_transaksi, '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33'::uuid, ''
where exists (
  select 1 from transactions
  where id = 'ba692b76-0584-44c4-8f13-fa36109b335c'::uuid and status = 'disetujui'
);
select set_config('request.jwt.claim.sub', '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select '1a2e4861-7dcd-4dc3-b12d-24961f5138b7'::uuid, 'dibayar'::status_transaksi, '9fbfa1b2-ab86-5fa3-8a0c-1a88537cdc33'::uuid, ''
where exists (
  select 1 from transactions
  where id = '1a2e4861-7dcd-4dc3-b12d-24961f5138b7'::uuid and status = 'disetujui'
);
select set_config('request.jwt.claim.sub', '7019770e-faea-5467-98ad-3c4a088d602e', false);
insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
select 'dd983c69-4e64-4d05-8de3-f5059ba8bba5'::uuid, 'ditolak'::status_transaksi, '7019770e-faea-5467-98ad-3c4a088d602e'::uuid, 'Dua langganan tumpang tindih; pakai yang sudah ada dulu.'
where exists (
  select 1 from transactions
  where id = 'dd983c69-4e64-4d05-8de3-f5059ba8bba5'::uuid and status = 'diajukan'
);

-- Penanda pengguna dikembalikan kosong supaya sesi berikutnya tidak
-- mewarisi identitas penyetuju terakhir.
select set_config('request.jwt.claim.sub', '', false);
