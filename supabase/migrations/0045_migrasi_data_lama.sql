-- =====================================================================
-- K-Space V2 — Jejak migrasi data lama dari kv_store
--
-- PRD mewajibkan pemindahan data dari sistem lama yang menyimpan segala
-- hal sebagai pasangan kunci-nilai di `kv_store`. Pemindahan seperti ini
-- tidak pernah selesai dalam satu percobaan: ada kunci yang formatnya
-- menyimpang, ada yang bentrok dengan data yang sudah ada, dan ada yang
-- memang harus dilewati.
--
-- Karena itu yang dicatat bukan sekadar "sudah/belum", melainkan setiap
-- entri beserta alasannya. Tanpa itu, kegagalan diam-diam baru ketahuan
-- berbulan-bulan kemudian saat angkanya tidak cocok.
--
-- Tabel ini hanya menyimpan jejak; pemindahan datanya sendiri menulis ke
-- tabel tujuan masing-masing sehingga seluruh aturan dan RLS tetap
-- berlaku.
-- =====================================================================

create type status_migrasi as enum (
  'menunggu',    -- terdaftar, belum dijalankan
  'berhasil',
  'dilewati',    -- sengaja tidak dipindahkan (mis. sudah ada, atau usang)
  'gagal'
);

create type tahap_migrasi as enum ('uji_coba', 'sungguhan');

-- Satu baris per kali migrasi dijalankan.
create table migrasi_jalan (
  id           uuid primary key default gen_random_uuid(),
  tahap        tahap_migrasi not null,
  sumber       text not null default 'kv_store',
  dijalankan_oleh uuid references users (id) on delete set null,
  dimulai_pada timestamptz not null default now(),
  selesai_pada timestamptz,
  catatan      text not null default '',
  created_at   timestamptz not null default now()
);

comment on table migrasi_jalan is
  'Satu baris per eksekusi migrasi; uji coba dan sungguhan dibedakan.';

comment on column migrasi_jalan.tahap is
  'uji_coba tidak menulis ke tabel tujuan — hanya melaporkan apa yang akan terjadi.';

-- Satu baris per entri data lama yang diperiksa.
create table migrasi_catatan (
  id          uuid primary key default gen_random_uuid(),
  jalan_id    uuid not null references migrasi_jalan (id) on delete cascade,
  entitas     text not null,
  kunci_lama  text not null,
  id_baru     uuid,
  status      status_migrasi not null default 'menunggu',
  pesan       text not null default '',
  created_at  timestamptz not null default now(),
  unique (jalan_id, entitas, kunci_lama)
);

create index migrasi_catatan_jalan_idx on migrasi_catatan (jalan_id);
create index migrasi_catatan_status_idx on migrasi_catatan (status);

comment on column migrasi_catatan.kunci_lama is
  'Kunci asli di kv_store, disimpan apa adanya agar bisa ditelusuri balik.';

-- ---------------------------------------------------------------------
-- Ringkasan status per entitas untuk ditampilkan di layar.
-- ---------------------------------------------------------------------
create or replace function ringkas_migrasi(p_jalan uuid default null)
returns table (
  entitas   text,
  total     integer,
  berhasil  integer,
  dilewati  integer,
  gagal     integer,
  menunggu  integer
)
language sql
stable
as $$
  with terpilih as (
    select coalesce(
      p_jalan,
      (select id from migrasi_jalan order by dimulai_pada desc limit 1)
    ) as id
  )
  select
    c.entitas,
    count(*)::int,
    count(*) filter (where c.status = 'berhasil')::int,
    count(*) filter (where c.status = 'dilewati')::int,
    count(*) filter (where c.status = 'gagal')::int,
    count(*) filter (where c.status = 'menunggu')::int
  from migrasi_catatan c
  where c.jalan_id = (select id from terpilih)
  group by c.entitas
  order by c.entitas;
$$;

-- ---------------------------------------------------------------------
-- RLS — migrasi adalah pekerjaan CEO/Manager, dan isinya bisa memuat
-- data pribadi seluruh karyawan.
-- ---------------------------------------------------------------------
alter table migrasi_jalan enable row level security;
alter table migrasi_catatan enable row level security;

create policy migrasi_jalan_kelola on migrasi_jalan
  for all using (lintas_unit()) with check (lintas_unit());

create policy migrasi_catatan_kelola on migrasi_catatan
  for all using (lintas_unit()) with check (lintas_unit());
