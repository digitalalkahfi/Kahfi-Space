-- =====================================================================
-- K-Space V2 — Riwayat pemegang aset yang bisa dibaca semua orang
--
-- `asset_events` (migrasi 0102) sudah menyimpan tiap perpindahan, tetapi
-- RLS-nya mengikuti tabel `assets`: Staff hanya melihat kejadian pada
-- barang yang ia pegang sendiri. Untuk barang yang sedang dicari, aturan
-- itu justru menutup satu-satunya jalan menemukannya — yang tahu di mana
-- barang terakhir dilihat biasanya bukan pemegang terdaftarnya.
--
-- Riwayatnya sendiri tidak memuat satu pun angka rupiah, jadi membukanya
-- tidak membuka angka perusahaan. Yang dibuka hanyalah: barang apa,
-- berpindah ke keadaan apa, di tangan siapa, dan siapa yang mencatat.
-- =====================================================================

create or replace function riwayat_aset(
  p_kode text default null,
  p_batas int default 500
)
returns table (
  id uuid,
  asset_id uuid,
  kode text,
  nama_aset text,
  unit_nama text,
  dari status_aset,
  ke status_aset,
  pemegang_nama text,
  oleh_nama text,
  lokasi text,
  catatan text,
  pada timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.asset_id,
    a.kode,
    a.nama,
    coalesce(u.nama, 'Perusahaan'),
    e.dari,
    e.ke,
    peg.nama,
    oleh.nama,
    e.lokasi,
    e.catatan,
    e.pada
  from asset_events e
  join assets a on a.id = e.asset_id
  left join units u on u.id = a.unit_id
  left join users peg on peg.id = e.pemegang_id
  left join users oleh on oleh.id = e.oleh_id
  where auth.uid() is not null
    and (p_kode is null or lower(a.kode) = lower(p_kode))
  order by e.pada desc, a.kode
  limit greatest(1, least(coalesce(p_batas, 500), 2000));
$$;

comment on function riwayat_aset is
  'Riwayat perpindahan aset tanpa angka rupiah; terbuka untuk semua pengguna yang sudah masuk.';

-- ---------------------------------------------------------------------
-- Barang yang sedang dipegang seseorang.
--
-- Dipakai saat serah terima dan saat orang keluar dari perusahaan —
-- pertanyaannya selalu "apa saja yang masih di tangannya", dan sebelum
-- ini jawabannya hanya bisa dikumpulkan satu per satu.
-- ---------------------------------------------------------------------
create or replace function aset_dipegang(p_user uuid default null)
returns table (
  id uuid,
  kode text,
  nama text,
  kategori text,
  unit_nama text,
  status status_aset,
  lokasi text,
  sejak timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.kode,
    a.nama,
    a.kategori,
    coalesce(u.nama, 'Perusahaan'),
    a.status,
    a.lokasi,
    (
      -- Sejak kapan ia memegangnya: kejadian terakhir yang menaruh
      -- barang ini di tangannya.
      select max(e.pada) from asset_events e
      where e.asset_id = a.id and e.pemegang_id = a.pemegang_id
    )
  from assets a
  left join units u on u.id = a.unit_id
  where auth.uid() is not null
    and a.pemegang_id = coalesce(p_user, auth.uid())
    -- Yang sudah dilepas bukan lagi tanggung jawab siapa pun.
    and a.status <> 'dilepas'
    and (
      -- Daftar milik orang lain hanya untuk yang berhak melihatnya:
      -- atasan, atau pemegang angka perusahaan.
      coalesce(p_user, auth.uid()) = auth.uid()
      or lintas_angka()
      or boleh_orang(p_user)
    )
  order by a.kode;
$$;

comment on function aset_dipegang is
  'Aset yang sedang dipegang seseorang; dasar serah terima saat pindah unit atau keluar.';
