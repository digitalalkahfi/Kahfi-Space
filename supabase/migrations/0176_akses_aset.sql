-- =====================================================================
-- K-Space V2 — Hak akses aset mengikuti hierarki
--
-- Sebelumnya daftar aset tanpa rupiah (`aset_publik`) dan riwayatnya
-- (`riwayat_aset`) terbuka untuk semua yang sudah masuk, dan tabel
-- `assets` membuka baris beserta harganya kepada pemegangnya. Di
-- produksi, isi aset dibuat otomatis dari transaksi pembelian, jadi yang
-- terbuka sebenarnya daftar belanja semua departemen.
--
-- Aturan baru:
--   * Staff               : aset yang sedang ia pegang.
--   * Leader & Co-Leader  : aset yang dipegang dirinya atau orang di
--                           bawahnya, ditambah aset unitnya yang belum
--                           dipegang siapa pun.
--   * CEO, Manager, Finance: semua aset, termasuk nilai rupiahnya.
--   * Riwayat aset mengikuti aturan yang sama.
-- =====================================================================

create or replace function boleh_aset(p_pemegang uuid, p_unit uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select pemanggil_sistem()
      or (
        auth.uid() is not null
        and (
          lintas_angka()
          -- Pemegangnya sendiri dan atasannya lewat garis pelaporan.
          or (p_pemegang is not null and boleh_orang(p_pemegang))
          -- Barang unit yang sedang tidak dipegang siapa pun: pimpinan
          -- unit itu perlu tahu ada, supaya bisa dimintakan pemakaiannya.
          or (
            p_pemegang is null
            and p_unit is not null
            and memimpin_unit()
            and p_unit = unit_saya()
          )
        )
      );
$$;

comment on function boleh_aset(uuid, uuid) is
  'Aset terlihat oleh pemegangnya dan atasannya; aset unit tanpa pemegang oleh Leader/Co-Leader unit itu; CEO/Manager/Finance semua (0176).';

-- ---------------------------------------------------------------------
-- Tabel lengkap dengan rupiah: hanya pemegang angka perusahaan.
-- Yang lain membaca `aset_publik`, yang tidak memuat kolom rupiah.
-- ---------------------------------------------------------------------
drop policy if exists aset_baca on assets;
create policy aset_baca on assets
  for select using (auth.uid() is not null and lintas_angka());

-- ---------------------------------------------------------------------
-- Daftar tanpa rupiah: kolomnya tetap, barisnya kini disaring.
-- View ini berjalan dengan hak pemiliknya (tanpa RLS tabel), jadi
-- saringannya harus ditulis di sini.
-- ---------------------------------------------------------------------
create or replace view aset_publik
with (security_barrier = true)
as
  select
    a.id,
    a.kode,
    a.nama,
    a.kategori,
    a.unit_id,
    u.kode as unit_kode,
    coalesce(u.nama, 'Perusahaan') as unit_nama,
    a.tanggal,
    a.status,
    a.pemegang_id,
    p.nama as pemegang_nama,
    a.lokasi,
    a.berakhir,
    a.catatan
  from assets a
  left join units u on u.id = a.unit_id
  left join users p on p.id = a.pemegang_id
  where auth.uid() is not null
    and boleh_aset(a.pemegang_id, a.unit_id);

comment on view aset_publik is
  'Daftar aset tanpa kolom rupiah, disaring boleh_aset: pemegang & atasannya, aset unit tanpa pemegang untuk pimpinannya (0176).';

-- ---------------------------------------------------------------------
-- Riwayat perpindahan: hanya untuk aset yang boleh dilihat pemanggil.
-- ---------------------------------------------------------------------
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
    and boleh_aset(a.pemegang_id, a.unit_id)
    and (p_kode is null or lower(a.kode) = lower(p_kode))
  order by e.pada desc, a.kode
  limit greatest(1, least(coalesce(p_batas, 500), 2000));
$$;

comment on function riwayat_aset is
  'Riwayat perpindahan aset tanpa angka rupiah, hanya untuk aset yang boleh dilihat pemanggil (0176).';
