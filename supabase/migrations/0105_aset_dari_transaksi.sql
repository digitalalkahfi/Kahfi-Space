-- =====================================================================
-- K-Space V2 — Transaksi berjenis aset melahirkan asetnya sendiri
--
-- PRD Rilis 2 menyebut aset "dari transaksi Aset", dan selama ini
-- hubungan itu hanya ada di kepala orang: Finance membayar pembelian
-- laptop, lalu seseorang harus ingat mencatatnya lagi di register aset.
-- Yang tidak diingat tidak tercatat, dan barang yang tidak tercatat
-- tidak pernah ditagih kembali saat pemegangnya keluar.
--
-- Karena itu asetnya dibuatkan otomatis begitu pengeluarannya benar-benar
-- dibayar — bukan saat disetujui: sebelum uangnya keluar, barangnya juga
-- belum ada.
--
-- Yang dibuat sengaja setengah jadi: nama dan nilainya benar, tetapi
-- kategori, pemegang, dan masa manfaatnya menunggu orang yang tahu.
-- Keadaannya 'cadangan' — barang yang sudah dibeli tetapi belum
-- diserahkan memang ada di gudang, bukan di tangan siapa pun.
-- =====================================================================

alter table keuangan_pengaturan
  add column masa_manfaat_bawaan int not null default 48
    check (masa_manfaat_bawaan between 0 and 600);

comment on column keuangan_pengaturan.masa_manfaat_bawaan is
  'Masa manfaat (bulan) untuk aset yang lahir dari transaksi; Finance menyesuaikannya per aset.';

-- Nomor aset berikutnya — padanan `kodeAsetBerikutnya` di src/lib/aset.ts.
create or replace function kode_aset_berikutnya()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'AST-' || lpad(
    (
      coalesce(
        max(nullif(regexp_replace(kode, '^AST-', ''), '')::int),
        0
      ) + 1
    )::text,
    4,
    '0'
  )
  from assets
  where kode ~ '^AST-[0-9]+$';
$$;

create or replace function buat_aset_dari_transaksi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  masa int;
begin
  if new.jenis is distinct from 'aset' or new.status <> 'dibayar' then
    return new;
  end if;

  -- Sekali saja: transaksi yang sama tidak melahirkan dua barang.
  if exists (select 1 from assets where transaction_id = new.id) then
    return new;
  end if;

  select coalesce(masa_manfaat_bawaan, 48) into masa
  from keuangan_pengaturan where id;

  insert into assets (
    kode, nama, kategori, unit_id, tanggal, nilai_perolehan,
    masa_manfaat, residu, status, pemegang_id, lokasi, transaction_id, catatan
  )
  values (
    kode_aset_berikutnya(),
    new.keterangan,
    '',
    new.unit_id,
    new.tanggal,
    new.jumlah,
    coalesce(masa, 48),
    0,
    'cadangan',
    null,
    '',
    new.id,
    'Dibuat otomatis dari transaksi aset yang sudah dibayar; kategori, '
      || 'masa manfaat, dan pemegangnya masih perlu dilengkapi.'
  );

  return new;
end;
$$;

create trigger buat_aset_dari_transaksi_trg
  after insert or update of status on transactions
  for each row execute function buat_aset_dari_transaksi();

-- ---------------------------------------------------------------------
-- Aset yang lahir otomatis dan belum dilengkapi.
--
-- Tanpa daftar ini, barang yang dibuatkan sistem mengendap tanpa
-- kategori dan tanpa pemegang — persis keadaan yang hendak dihindari.
-- ---------------------------------------------------------------------
create or replace function aset_perlu_dilengkapi()
returns table (
  id uuid,
  kode text,
  nama text,
  tanggal date,
  nilai_perolehan numeric,
  alasan text
)
language sql
stable
set search_path = public
as $$
  select
    a.id,
    a.kode,
    a.nama,
    a.tanggal,
    a.nilai_perolehan,
    concat_ws(', ',
      nullif(case when btrim(a.kategori) = '' then 'kategori belum diisi' else '' end, ''),
      nullif(case when a.masa_manfaat = 0 then 'masa manfaat belum ditentukan' else '' end, ''),
      nullif(case when a.pemegang_id is null and a.status = 'dipakai'
                  then 'dipakai tanpa pemegang' else '' end, ''),
      nullif(case when btrim(a.lokasi) = '' then 'lokasi belum diisi' else '' end, '')
    )
  from assets a
  where a.status <> 'dilepas'
    and (
      btrim(a.kategori) = ''
      or a.masa_manfaat = 0
      or btrim(a.lokasi) = ''
      or (a.pemegang_id is null and a.status = 'dipakai')
    )
  order by a.tanggal desc, a.kode;
$$;

comment on function aset_perlu_dilengkapi is
  'Aset yang datanya belum utuh — biasanya yang baru lahir dari transaksi.';
