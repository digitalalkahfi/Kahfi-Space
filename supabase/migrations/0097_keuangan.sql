-- =====================================================================
-- K-Space V2 — Transaksi keuangan (PRD Rilis 2 §4)
--
-- Sampai sekarang modul Keuangan membaca berkas contoh: angkanya benar
-- secara bentuk, tetapi tidak ada yang tersimpan. Tabel ini menutup
-- lubang itu.
--
-- Dua aturan PRD yang dijaga di tingkat basis data, bukan di layar:
--
--   1. Pengeluaran wajib berjenis (beban, aset, direct cost, creator
--      share, dividen) dan pemasukan wajib menyebut unit pendapatannya.
--      Pencampuran beban dan aset itulah yang membuat NPM lama salah —
--      aset tidak mengurangi laba, hanya mengurangi kas.
--
--   2. Uang baru bergerak saat statusnya 'dibayar'. Pengajuan yang
--      disetujui belum memindahkan sepeser pun; menganggapnya sudah
--      keluar membuat posisi kas berbohong tepat saat ia paling dibaca.
--
-- Siapa yang boleh memutuskan diatur migrasi berikutnya (persetujuan
-- berjenjang); di sini cukup bentuk datanya dan pagar dasarnya.
-- =====================================================================

create type arah_transaksi as enum ('masuk', 'keluar');

create type jenis_keluar as enum (
  'beban',          -- biaya operasional, mengurangi laba
  'aset',           -- berpindah wujud jadi barang, tidak mengurangi laba
  'direct_cost',    -- biaya yang melekat pada pendapatan satu akun/unit
  'creator_share',  -- bagi hasil kreator
  'dividen'         -- pembagian laba ke pemilik
);

create type status_transaksi as enum (
  'diajukan',   -- menunggu keputusan
  'disetujui',  -- boleh dibayar, tetapi kas belum bergerak
  'ditolak',    -- selesai tanpa uang keluar
  'dibayar'     -- uang benar-benar berpindah
);

create table transactions (
  id            uuid primary key default gen_random_uuid(),
  tanggal       date not null,
  arah          arah_transaksi not null,
  -- Wajib untuk arah keluar, kosong untuk arah masuk (dijaga check).
  jenis         jenis_keluar,
  unit_id       uuid references units (id) on delete restrict,
  account_id    uuid references accounts (id) on delete set null,
  keterangan    text not null check (length(btrim(keterangan)) >= 5),
  jumlah        numeric(16, 2) not null check (jumlah > 0),
  status        status_transaksi not null default 'diajukan',
  diajukan_id   uuid references users (id) on delete set null,
  disetujui_id  uuid references users (id) on delete set null,
  diputuskan_pada timestamptz,
  catatan_keputusan text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- PRD §4: pengeluaran selalu berjenis, pemasukan tidak memakai jenis.
  constraint transaksi_jenis_sesuai_arah check (
    (arah = 'keluar' and jenis is not null)
    or (arah = 'masuk' and jenis is null)
  ),

  -- Pemasukan adalah pendapatan sebuah unit; tanpa itu kontribusi unit
  -- tidak bisa dihitung sama sekali.
  constraint transaksi_pemasukan_berunit check (
    arah = 'keluar' or unit_id is not null
  ),

  -- Direct cost menempel pada pendapatan, jadi ia juga berunit.
  constraint transaksi_direct_cost_berunit check (
    jenis is distinct from 'direct_cost' or unit_id is not null
  ),

  -- Keputusan selalu punya pemutus dan waktunya; yang masih diajukan
  -- tidak boleh sudah menyimpan keduanya.
  constraint transaksi_keputusan_utuh check (
    (status = 'diajukan' and disetujui_id is null and diputuskan_pada is null)
    or (status <> 'diajukan')
  )
);

create index transaksi_tanggal_idx on transactions (tanggal desc);
create index transaksi_status_idx on transactions (status);
create index transaksi_unit_idx on transactions (unit_id);
create index transaksi_akun_idx on transactions (account_id);

comment on table transactions is
  'Transaksi keuangan perusahaan; kas hanya bergerak pada status dibayar.';
comment on column transactions.jenis is
  'Jenis pengeluaran (PRD §4). Aset tidak mengurangi laba, hanya kas.';

-- ---------------------------------------------------------------------
-- Kas awal.
--
-- Berdiri sendiri, tidak menumpang tabel `pengaturan`: saldo pembuka
-- adalah angka perusahaan, dan `pengaturan` dibaca setiap pengguna yang
-- login. RLS tidak bisa menyembunyikan satu kolom, jadi tabelnya yang
-- dipisah.
-- ---------------------------------------------------------------------
create table keuangan_pengaturan (
  id         boolean primary key default true check (id),
  kas_awal   numeric(16, 2) not null default 0,
  updated_at timestamptz not null default now()
);

insert into keuangan_pengaturan (id) values (true) on conflict (id) do nothing;

comment on table keuangan_pengaturan is
  'Saldo kas pembuka; dipakai menghitung posisi kas berjalan.';

-- ---------------------------------------------------------------------
-- Status awal ditentukan basis data, bukan pengirim.
--
-- Pemasukan yang sudah diterima tidak perlu disetujui siapa pun — ia
-- hanya dicatat. Pengeluaran selalu mulai dari 'diajukan', bahkan bila
-- yang mencatat adalah CEO sendiri: jejaknya yang membuat angka bisa
-- dipertanggungjawabkan.
-- ---------------------------------------------------------------------
create or replace function status_awal_transaksi(p_arah arah_transaksi)
returns status_transaksi
language sql
immutable
as $$
  select case when p_arah = 'masuk' then 'dibayar' else 'diajukan' end::status_transaksi;
$$;

create or replace function jaga_transaksi_baru()
returns trigger
language plpgsql
as $$
begin
  new.status := status_awal_transaksi(new.arah);
  new.diajukan_id := coalesce(new.diajukan_id, auth.uid());

  if new.status = 'diajukan' then
    new.disetujui_id := null;
    new.diputuskan_pada := null;
  else
    -- Pemasukan tercatat langsung; pencatatnya sekaligus pemutusnya.
    new.disetujui_id := coalesce(new.disetujui_id, new.diajukan_id);
    new.diputuskan_pada := coalesce(new.diputuskan_pada, now());
  end if;

  return new;
end;
$$;

create trigger jaga_transaksi_baru_trg
  before insert on transactions
  for each row execute function jaga_transaksi_baru();

-- ---------------------------------------------------------------------
-- Perpindahan status yang masuk akal — padanan `perpindahanSah`
-- di src/lib/keuangan.ts.
-- ---------------------------------------------------------------------
create or replace function perpindahan_transaksi_sah(
  p_dari status_transaksi,
  p_ke status_transaksi
)
returns boolean
language sql
immutable
as $$
  select case
    when p_dari = 'diajukan'  then p_ke in ('disetujui', 'ditolak')
    -- Yang sudah disetujui tinggal dibayar; menolak sesudah menyetujui
    -- berarti keputusannya berubah, dan itu perlu jejaknya sendiri.
    when p_dari = 'disetujui' then p_ke = 'dibayar'
    else false
  end;
$$;

-- ---------------------------------------------------------------------
-- Angka transaksi tidak berubah setelah ia meninggalkan meja pengaju.
--
-- Menaikkan nominal setelah disetujui adalah cara paling mudah membuat
-- persetujuan kehilangan arti.
-- ---------------------------------------------------------------------
create or replace function jaga_ubah_transaksi()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'diajukan' and (
       new.tanggal    is distinct from old.tanggal
    or new.arah       is distinct from old.arah
    or new.jenis      is distinct from old.jenis
    or new.jumlah     is distinct from old.jumlah
    or new.unit_id    is distinct from old.unit_id
    or new.account_id is distinct from old.account_id
  ) then
    raise exception 'Isi transaksi yang sudah diputuskan tidak bisa diubah'
      using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status
     and not perpindahan_transaksi_sah(old.status, new.status) then
    raise exception 'Transaksi berstatus % tidak bisa menjadi %',
      old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status then
    new.disetujui_id := coalesce(auth.uid(), new.disetujui_id);
    new.diputuskan_pada := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger jaga_ubah_transaksi_trg
  before update on transactions
  for each row execute function jaga_ubah_transaksi();

-- ---------------------------------------------------------------------
-- Posisi kas berjalan: kas awal ditambah seluruh mutasi yang sudah
-- benar-benar dibayar. Dipakai aturan persetujuan berjenjang (PRD §4).
-- ---------------------------------------------------------------------
create or replace function saldo_kas()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select kas_awal from keuangan_pengaturan where id), 0)
       + coalesce((
           select sum(case when arah = 'masuk' then jumlah else -jumlah end)
           from transactions
           where status = 'dibayar'
         ), 0);
$$;

comment on function saldo_kas is
  'Kas awal + mutasi berstatus dibayar. Pengajuan yang disetujui belum menggerakkan kas.';

-- ---------------------------------------------------------------------
-- RLS — angka perusahaan hanya untuk Finance, Manager, dan CEO (PRD §2).
-- ---------------------------------------------------------------------
alter table transactions enable row level security;
alter table keuangan_pengaturan enable row level security;

create policy transaksi_baca on transactions
  for select using (lintas_angka());

-- Mencatat transaksi: siapa pun yang berhak melihat angkanya, atas
-- namanya sendiri. Status awalnya ditentukan trigger, bukan pengirim.
create policy transaksi_buat on transactions
  for insert with check (lintas_angka() and diajukan_id = auth.uid());

-- Keputusan dan pembayaran dijaga trigger; RLS hanya menentukan siapa
-- yang boleh menyentuh barisnya sama sekali.
create policy transaksi_putus on transactions
  for update using (lintas_angka()) with check (lintas_angka());

create policy keuangan_pengaturan_baca on keuangan_pengaturan
  for select using (lintas_angka());

create policy keuangan_pengaturan_kelola on keuangan_pengaturan
  for all using (lintas_unit()) with check (lintas_unit());
