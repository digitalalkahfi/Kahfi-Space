-- =====================================================================
-- K-Space V2 — Persetujuan pemetaan sebelum migrasi sungguhan
--
-- Pemetaan medan lama ke kolom baru menentukan bentuk akhir seluruh data
-- perusahaan. Sekali data sungguhan ditulis dengan pemetaan yang keliru,
-- memperbaikinya jauh lebih mahal daripada meninjaunya lebih dulu.
--
-- Karena itu setiap entitas harus disetujui seseorang, dan persetujuan
-- itu menempel pada versi pemetaannya. Begitu pemetaan diubah, sidik
-- versinya berganti dan persetujuan lama otomatis tidak berlaku lagi —
-- tidak ada persetujuan yang "terbawa" ke pemetaan yang sudah berbeda.
-- =====================================================================

create table migrasi_persetujuan (
  id            uuid primary key default gen_random_uuid(),
  entitas       text not null,
  versi         text not null,
  disetujui_oleh uuid not null references users (id) on delete restrict,
  disetujui_pada timestamptz not null default now(),
  catatan       text not null default '',
  unique (entitas, versi)
);

comment on column migrasi_persetujuan.versi is
  'Sidik isi pemetaan; berubah begitu pemetaannya disunting.';

create index migrasi_persetujuan_entitas_idx
  on migrasi_persetujuan (entitas);

alter table migrasi_persetujuan enable row level security;

create policy migrasi_persetujuan_baca on migrasi_persetujuan
  for select using (lintas_unit());

-- Persetujuan hanya boleh dicatat atas nama diri sendiri: menyetujui
-- mewakili orang lain menghilangkan makna jejaknya.
create policy migrasi_persetujuan_buat on migrasi_persetujuan
  for insert with check (lintas_unit() and disetujui_oleh = auth.uid());

create policy migrasi_persetujuan_hapus on migrasi_persetujuan
  for delete using (lintas_unit());
