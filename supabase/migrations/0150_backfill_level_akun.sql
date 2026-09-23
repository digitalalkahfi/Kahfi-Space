-- =====================================================================
-- K-Space V2 — Level awal untuk akun yang sudah ada
--
-- `accounts.level` lahir nullable (migrasi 0137) supaya migrasi itu
-- tidak menebak standar siapa pun. Akibatnya, setiap akun yang sudah
-- ada sebelum fitur ini TIDAK dinilai sama sekali: kepatuhannya null,
-- dan di layar ia tampak seolah tidak punya kewajiban.
--
-- Migrasi ini menutup lubang itu dengan level 0 — anak tangga TERENDAH
-- (3 unggahan per hari kerja), bukan level yang ditebak dari volume
-- unggahannya. Alasannya: menebak level dari volume masa lalu akan
-- menghukum akun yang kebetulan sedang ramai dengan standar yang tidak
-- pernah disepakati siapa pun. Level 0 adalah lantai yang jelas, dan
-- menaikkannya adalah keputusan manajemen — lengkap dengan alasannya.
--
-- Hanya akun AKTIF yang diisi. Akun nonaktif tidak melapor lagi, dan
-- memberinya standar hanya menambah baris yang tidak menjelaskan apa pun.
-- =====================================================================

do $$
declare
  v_jumlah integer;
begin
  select count(*) into v_jumlah
  from accounts
  where level is null and status = 'aktif';

  if v_jumlah = 0 then
    raise notice 'Tidak ada akun aktif tanpa level; tidak ada yang diisi.';
    return;
  end if;

  -- Alasannya ikut ke jejak lewat trigger `catat_level_akun` (0137).
  -- `oleh_id` akan null di sini karena migrasi berjalan tanpa sesi, dan
  -- itu justru benar: yang menetapkannya sistem, bukan orang.
  perform set_config(
    'app.alasan_level',
    'Level awal saat fitur batas minimum diaktifkan; dinaikkan manajemen bila perlu',
    true
  );

  update accounts
  set level = 0
  where level is null and status = 'aktif';

  raise notice 'Level awal diisi untuk % akun aktif.', v_jumlah;
end;
$$;

-- ---------------------------------------------------------------------
-- Akun aktif baru pun sebaiknya tidak lahir tanpa standar.
--
-- Bukan NOT NULL: akun nonaktif dan akun lama tetap boleh tanpa level,
-- dan memaksakan kolomnya akan menolak baris yang sah. Yang dipasang
-- default, supaya yang lupa mengisinya tetap punya lantai.
-- ---------------------------------------------------------------------
alter table accounts alter column level set default 0;

comment on column accounts.level is
  'Level 0-8 penentu batas minimum unggahan; default 0 sejak migrasi 0150.';
