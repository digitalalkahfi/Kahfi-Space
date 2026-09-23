-- =====================================================================
-- K-Space V2 — Tabel anggaran & alokasi tambahan
--
-- Sampai sekarang pagu anggaran hidup sebagai data contoh: form-nya
-- memeriksa isian dengan benar lalu mengembalikan pesan yang mengatakan
-- terus terang bahwa tabelnya belum ada. Migrasi ini menutup itu.
--
-- Dua tabel, bukan satu: pagu adalah keadaan (berapa pagu pos ini
-- sekarang), alokasi adalah peristiwa (siapa minta tambahan berapa,
-- dan siapa memutuskannya). Menyatukannya memaksa setiap pembacaan pagu
-- ikut menyaring status, dan cepat atau lambat ada yang lupa.
-- =====================================================================

create type status_alokasi as enum ('diajukan', 'disetujui', 'ditolak');

create table budgets (
  id           uuid primary key default gen_random_uuid(),
  -- Bentuk 'YYYY-MM' mengikuti `goals.periode`: anggaran selalu bulanan,
  -- dan tanggal penuh hanya akan mengundang pertanyaan "tanggal berapa".
  periode      text not null check (periode ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  -- null berarti pagu perusahaan, bukan milik satu unit.
  unit_id      uuid references units (id) on delete restrict,
  jenis        jenis_keluar not null,
  jumlah       numeric(14, 2) not null check (jumlah > 0),
  catatan      text not null default '',
  disetujui_id uuid references users (id) on delete set null,
  dibuat_oleh  uuid references users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Satu pos hanya boleh punya satu pagu per periode. Tanpa ini,
  -- "tambah pagu" akan dipakai sebagai cara menaikkan pagu diam-diam,
  -- dan jumlah pagunya jadi hasil penjumlahan baris yang tak seorang pun
  -- berniat membuatnya.
  constraint budgets_satu_pos unique nulls not distinct (periode, unit_id, jenis)
);

create index budgets_periode_idx on budgets (periode);

comment on table budgets is
  'Pagu anggaran per periode, unit, dan jenis pengeluaran; satu pos satu baris.';

create trigger budgets_updated_at
  before update on budgets
  for each row execute function set_updated_at();

create table budget_allocations (
  id                uuid primary key default gen_random_uuid(),
  periode           text not null check (periode ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  unit_id           uuid references units (id) on delete restrict,
  jenis             jenis_keluar not null,
  jumlah            numeric(14, 2) not null check (jumlah > 0),
  alasan            text not null check (length(btrim(alasan)) >= 10),
  status            status_alokasi not null default 'diajukan',
  diajukan_id       uuid references users (id) on delete set null,
  diputuskan_id     uuid references users (id) on delete set null,
  catatan_keputusan text not null default '',
  diputuskan_pada   timestamptz,
  created_at        timestamptz not null default now(),

  -- Penolakan wajib beralasan: pengajuan yang ditolak tanpa keterangan
  -- hanya akan diajukan ulang apa adanya.
  constraint alokasi_tolak_beralasan check (
    status <> 'ditolak' or length(btrim(catatan_keputusan)) >= 10
  ),
  -- Keputusan selalu punya pemutus dan waktunya; yang masih menunggu
  -- tidak boleh punya keduanya.
  constraint alokasi_keputusan_utuh check (
    (status = 'diajukan'
      and diputuskan_id is null and diputuskan_pada is null)
    or (status <> 'diajukan'
      and diputuskan_id is not null and diputuskan_pada is not null)
  )
);

create index budget_allocations_periode_idx
  on budget_allocations (periode, created_at desc);

comment on table budget_allocations is
  'Pengajuan tambahan pagu beserta keputusannya; bukan penambahan langsung ke budgets.';

-- ---------------------------------------------------------------------
-- Status alokasi hanya bergerak dari 'diajukan'.
--
-- Pengajuan yang sudah diputuskan tidak bisa diputuskan ulang — kalau
-- bisa, catatan penolakan bisa diganti menjadi persetujuan tanpa jejak.
-- ---------------------------------------------------------------------
create or replace function jaga_status_alokasi()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'diajukan' and new.status is distinct from old.status then
    raise exception
      'Pengajuan berstatus % tidak bisa diputuskan lagi', old.status;
  end if;

  -- Pengaju tidak memutuskan pengajuannya sendiri. Aturan yang sama
  -- dengan persetujuan transaksi (migrasi 0098).
  if new.status <> 'diajukan' and new.diputuskan_id = old.diajukan_id then
    raise exception 'Pengaju tidak boleh memutuskan pengajuannya sendiri';
  end if;

  return new;
end;
$$;

create trigger budget_allocations_jaga_status
  before update on budget_allocations
  for each row execute function jaga_status_alokasi();

-- ---------------------------------------------------------------------
-- RLS — angka perusahaan.
--
-- Dibaca semua yang berhak melihat angka lintas unit (Finance, Manager,
-- CEO); pagunya sendiri hanya boleh disetel manajemen. Pengajuan boleh
-- dibuat pimpinan unit atas namanya sendiri.
-- ---------------------------------------------------------------------
alter table budgets enable row level security;
alter table budget_allocations enable row level security;

create policy budgets_baca on budgets
  for select using (lintas_angka());

create policy budgets_kelola on budgets
  for all using (lintas_angka()) with check (lintas_angka());

create policy alokasi_baca on budget_allocations
  for select using (lintas_angka() or memimpin_unit());

create policy alokasi_ajukan on budget_allocations
  for insert with check (
    (lintas_angka() or memimpin_unit())
    and diajukan_id = auth.uid()
    and status = 'diajukan'
  );

create policy alokasi_putus on budget_allocations
  for update using (lintas_angka()) with check (lintas_angka());
