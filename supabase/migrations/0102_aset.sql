-- =====================================================================
-- K-Space V2 — Aset & inventaris (PRD Rilis 2)
--
-- Aset lahir dari transaksi berjenis 'aset': uang yang keluar untuk
-- barang tidak hilang seperti beban, ia berpindah wujud lalu menyusut.
-- Yang hilang di sistem lama bukan angkanya, melainkan dua pertanyaan
-- yang muncul setiap kali barang dicari — "sekarang di tangan siapa" dan
-- "nilainya tinggal berapa".
--
-- Karena itu `assets` menyimpan keadaan sekarang dan `asset_events`
-- menyimpan riwayat perpindahannya; statusnya tidak pernah disetel
-- langsung, ia selalu mengikuti kejadian terakhir — pola yang sama
-- dengan sampel (migrasi 0049) dan persetujuan transaksi (0098).
--
-- Soal akses: daftar barangnya operasional — mengetahui siapa memegang
-- apa justru mencegah barang hilang tanpa ada yang menyadari. Nilainya
-- angka perusahaan. RLS tidak bisa menyembunyikan satu kolom, jadi
-- pemisahannya lewat view `aset_publik` di bagian bawah.
-- =====================================================================

create type status_aset as enum (
  'dipakai',    -- sedang dipakai, biasanya ada pemegangnya
  'cadangan',   -- di gudang, siap dipakai
  'perbaikan',  -- sedang diservis
  'hilang',     -- tidak bisa dipertanggungjawabkan
  'dilepas'     -- dijual atau dihapusbukukan
);

create table assets (
  id              uuid primary key default gen_random_uuid(),
  kode            text not null,
  nama            text not null check (length(btrim(nama)) >= 3),
  kategori        text not null default '',
  unit_id         uuid references units (id) on delete set null,
  tanggal         date not null,
  nilai_perolehan numeric(16, 2) not null check (nilai_perolehan >= 0),
  -- 0 berarti tidak disusutkan (mis. tanah); 600 bulan = 50 tahun.
  masa_manfaat    int not null default 0 check (masa_manfaat between 0 and 600),
  residu          numeric(16, 2) not null default 0 check (residu >= 0),
  status          status_aset not null default 'dipakai',
  pemegang_id     uuid references users (id) on delete set null,
  lokasi          text not null default '',
  -- Tanggal aset berhenti disusutkan: dilepas atau dinyatakan hilang.
  berakhir        date,
  -- Transaksi asalnya, bila asetnya memang lahir dari sana.
  transaction_id  uuid references transactions (id) on delete set null,
  catatan         text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Nilai sisa tidak mungkin melebihi harga belinya.
  constraint aset_residu_masuk_akal check (residu <= nilai_perolehan),

  -- Yang berhenti dimiliki selalu punya tanggalnya; yang masih dimiliki
  -- tidak boleh punya. Tanpa ini penyusutan berhenti di tanggal yang
  -- tidak pernah ditetapkan siapa pun.
  constraint aset_akhir_sesuai_status check (
    (status in ('dilepas', 'hilang')) = (berakhir is not null)
  ),
  constraint aset_akhir_setelah_perolehan check (
    berakhir is null or berakhir >= tanggal
  )
);

-- Kode dicetak pada stiker dan diketik ulang orang; keunikannya tidak
-- boleh bergantung pada huruf besar-kecil.
create unique index aset_kode_unik on assets (lower(kode));
create index aset_status_idx on assets (status);
create index aset_unit_idx on assets (unit_id);
create index aset_pemegang_idx on assets (pemegang_id);

comment on table assets is
  'Aset perusahaan beserta keadaan terakhirnya; riwayatnya di asset_events.';
comment on column assets.masa_manfaat is
  'Masa manfaat dalam bulan; 0 berarti aset tidak disusutkan.';

create table asset_events (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references assets (id) on delete cascade,
  dari        status_aset,
  ke          status_aset not null,
  oleh_id     uuid references users (id) on delete set null,
  pemegang_id uuid references users (id) on delete set null,
  lokasi      text not null default '',
  catatan     text not null default '',
  pada        timestamptz not null default now()
);

create index aset_kejadian_idx on asset_events (asset_id, pada desc);

comment on table asset_events is
  'Satu baris per perpindahan aset; tidak pernah disunting atau dihapus.';

-- ---------------------------------------------------------------------
-- Perpindahan yang masuk akal — padanan `LANJUTAN_ASET` di
-- src/lib/aset.ts. Status yang sama di kedua sisi berarti pindah tangan
-- tanpa ganti keadaan, dan itu sah.
-- ---------------------------------------------------------------------
create or replace function perpindahan_aset_sah(
  p_dari status_aset,
  p_ke status_aset
)
returns boolean
language sql
immutable
as $$
  select case
    when p_dari is null then p_ke <> 'dilepas'
    when p_dari = p_ke then true
    when p_dari = 'dipakai'   then p_ke in ('cadangan', 'perbaikan', 'hilang', 'dilepas')
    when p_dari = 'cadangan'  then p_ke in ('dipakai', 'perbaikan', 'hilang', 'dilepas')
    when p_dari = 'perbaikan' then p_ke in ('dipakai', 'cadangan', 'dilepas', 'hilang')
    -- Barang hilang bisa ditemukan lagi; itu kabar baik, bukan kejanggalan.
    when p_dari = 'hilang'    then p_ke in ('dipakai', 'cadangan', 'dilepas')
    -- Yang sudah dilepas tidak hidup lagi: barang yang kembali adalah
    -- perolehan baru dengan nilai baru.
    else false
  end;
$$;

create or replace function jaga_kejadian_aset()
returns trigger
language plpgsql
as $$
declare
  status_kini status_aset;
  aset_tanggal date;
begin
  select status, tanggal into status_kini, aset_tanggal
  from assets where id = new.asset_id;

  if status_kini is null then
    raise exception 'Aset tidak ditemukan' using errcode = 'foreign_key_violation';
  end if;

  -- Kejadian pertama adalah perolehannya: ia hanya merekam keadaan awal
  -- yang sudah ada di barisnya, jadi tidak ada yang perlu diubah maupun
  -- diperiksa sebagai "perpindahan".
  if not exists (select 1 from asset_events where asset_id = new.asset_id) then
    new.dari := null;
    return new;
  end if;

  if not perpindahan_aset_sah(status_kini, new.ke) then
    raise exception 'Aset tidak bisa berpindah dari % ke %', status_kini, new.ke
      using errcode = 'check_violation';
  end if;

  if status_kini = new.ke and new.pemegang_id is not distinct from (
    select pemegang_id from assets where id = new.asset_id
  ) then
    raise exception 'Belum ada yang berubah: pilih pemegang baru atau keadaan yang berbeda'
      using errcode = 'check_violation';
  end if;

  -- Barang di gudang tidak dipegang perorangan; menyimpan namanya hanya
  -- membuat orang mencarinya ke tangan yang salah.
  if new.ke = 'cadangan' and new.pemegang_id is not null then
    raise exception 'Aset cadangan disimpan di gudang, bukan dipegang perorangan'
      using errcode = 'check_violation';
  end if;

  -- Yang hilang atau dilepas menghentikan nilainya; tanpa keterangan,
  -- jejaknya tidak menolong siapa pun saat ditelusuri kemudian.
  if new.ke in ('hilang', 'dilepas') and length(btrim(new.catatan)) < 10 then
    raise exception 'Sebutkan keterangannya (minimal 10 huruf)'
      using errcode = 'check_violation';
  end if;

  new.dari := status_kini;

  perform set_config('app.aset_via_kejadian', 'ya', true);

  update assets
     set status = new.ke,
         pemegang_id = case
           when new.ke = 'cadangan' then null
           else new.pemegang_id
         end,
         lokasi = coalesce(nullif(btrim(new.lokasi), ''), lokasi),
         -- Tanggal berhentinya diambil dari kejadiannya, bukan dari hari
         -- ini: penyusutan berhenti saat barangnya berhenti dimiliki.
         berakhir = case
           when new.ke in ('hilang', 'dilepas')
             then greatest(new.pada::date, aset_tanggal)
           else null
         end,
         updated_at = now()
   where id = new.asset_id;

  perform set_config('app.aset_via_kejadian', '', true);

  return new;
end;
$$;

create trigger jaga_kejadian_aset_trg
  before insert on asset_events
  for each row execute function jaga_kejadian_aset();

create or replace function larang_ubah_kejadian_aset()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Riwayat perpindahan aset tidak bisa diubah atau dihapus'
    using errcode = 'check_violation';
end;
$$;

create trigger larang_ubah_kejadian_aset_trg
  before update or delete on asset_events
  for each row execute function larang_ubah_kejadian_aset();

-- Status aset hanya berubah lewat pencatatan perpindahan; kalau tidak,
-- layar bisa berkata "dipakai" sementara jejaknya berhenti di "hilang".
create or replace function jaga_status_aset()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.aset_via_kejadian', true), '') <> 'ya'
  then
    raise exception 'Status aset hanya berubah lewat pencatatan perpindahan'
      using errcode = 'check_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger jaga_status_aset_trg
  before update on assets
  for each row execute function jaga_status_aset();

-- Perolehan dicatat sebagai kejadian pertama, supaya aset yang belum
-- pernah berpindah pun punya riwayat yang bisa dibaca.
create or replace function catat_perolehan_aset()
returns trigger
language plpgsql
as $$
begin
  insert into asset_events (asset_id, dari, ke, oleh_id, pemegang_id, lokasi, catatan, pada)
  values (
    new.id, null, new.status, auth.uid(), new.pemegang_id, new.lokasi,
    'Dicatat sebagai perolehan.', new.tanggal::timestamptz
  );
  return new;
end;
$$;

create trigger catat_perolehan_aset_trg
  after insert on assets
  for each row execute function catat_perolehan_aset();

-- ---------------------------------------------------------------------
-- RLS.
--
-- Tabelnya memuat angka perusahaan, jadi pagarnya sama dengan Keuangan.
-- Pemegangnya ikut melihat barisnya sendiri: ia yang bertanggung jawab
-- atas barang itu, dan nilainya bagian dari tanggung jawab itu.
-- ---------------------------------------------------------------------
alter table assets enable row level security;
alter table asset_events enable row level security;

create policy aset_baca on assets
  for select using (
    auth.uid() is not null
    and (lintas_angka() or pemegang_id = auth.uid())
  );

create policy aset_kelola on assets
  for all using (lintas_angka()) with check (lintas_angka());

create policy aset_kejadian_baca on asset_events
  for select using (
    exists (select 1 from assets a where a.id = asset_id)
  );

create policy aset_kejadian_buat on asset_events
  for insert with check (
    oleh_id = auth.uid()
    and lintas_angka()
    and exists (select 1 from assets a where a.id = asset_id)
  );

-- ---------------------------------------------------------------------
-- Daftar barang tanpa angka.
--
-- "Siapa memegang apa" adalah pertanyaan operasional yang boleh dijawab
-- untuk semua orang; "berapa nilainya" tidak. RLS tidak bisa
-- menyembunyikan satu kolom, jadi kolom-kolom itu yang tidak ikut ke
-- dalam view ini. View berjalan dengan hak pemiliknya, sehingga RLS
-- tabel di belakangnya sengaja tidak berlaku — yang membatasi adalah
-- pilihan kolomnya, ditambah syarat pengguna harus sudah masuk.
-- ---------------------------------------------------------------------
-- Nama unit dan pemegangnya ikut di-join di sini: view tidak punya
-- foreign key, jadi pembacanya tidak bisa menyusulkan keduanya sendiri.
create view aset_publik
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
  where auth.uid() is not null;

comment on view aset_publik is
  'Daftar aset tanpa kolom rupiah; untuk pengguna yang tidak berhak melihat angka perusahaan.';

grant select on aset_publik to anon, authenticated;
