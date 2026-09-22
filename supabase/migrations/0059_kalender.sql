-- =====================================================================
-- K-Space V2 — Kalender bersama (PRD Rilis 3)
--
-- Kalender yang hanya berisi agenda yang diketik manual cepat ditinggal:
-- orang sudah punya tenggat di Tugas dan anak tangga di GRD, dan tidak
-- akan mengetik ulang semuanya ke sini.
--
-- Karena itu tabel ini hanya menyimpan agenda yang memang tidak punya
-- tempat lain (rapat, libur, pelatihan). Tenggat tugas dan tonggak GRD
-- ditarik aplikasi dari sumbernya masing-masing dan digabung saat
-- ditampilkan — satu tanggal hanya punya satu kebenaran.
-- =====================================================================

create type jenis_agenda as enum ('rapat', 'libur', 'pelatihan', 'lainnya');

create table agenda (
  id          uuid primary key default gen_random_uuid(),
  judul       text not null check (length(trim(judul)) >= 3),
  keterangan  text not null default '',
  jenis       jenis_agenda not null default 'rapat',
  tanggal     date not null,
  -- Kosong berarti agenda sepanjang hari.
  jam_mulai   time,
  jam_selesai time,
  -- Kosong berarti berlaku untuk seluruh perusahaan.
  unit_id     uuid references units (id) on delete cascade,
  lokasi      text not null default '',
  dibuat_oleh uuid references users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint agenda_jam_masuk_akal
    check (jam_selesai is null or jam_mulai is null or jam_selesai > jam_mulai)
);

create index agenda_tanggal_idx on agenda (tanggal);
create index agenda_unit_idx on agenda (unit_id);

comment on column agenda.unit_id is
  'Kosong berarti seluruh perusahaan; diisi berarti hanya unit itu.';

alter table agenda enable row level security;

-- Agenda unit lain tetap terlihat: rapat yang bentrok baru bisa
-- dihindari kalau jadwalnya saling terlihat.
create policy agenda_baca on agenda
  for select using (auth.uid() is not null);

create policy agenda_kelola on agenda
  for all using (lintas_unit()) with check (lintas_unit());

-- Leader boleh mengatur agenda unitnya sendiri; menyerahkan semua jadwal
-- unit ke Manager hanya membuat kalendernya selalu ketinggalan.
create policy agenda_unit_kelola on agenda
  for all
  using (memimpin_unit() and unit_id = unit_saya())
  with check (memimpin_unit() and unit_id = unit_saya());
