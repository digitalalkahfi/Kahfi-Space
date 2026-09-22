-- =====================================================================
-- K-Space V2 — RLS tabel organisasi (PRD §2 "row-level security")
--
-- Tanpa RLS, siapa pun yang memegang anon key bisa membaca seluruh tabel.
-- Referensi organisasi boleh dibaca semua anggota yang sudah login, tetapi
-- hanya CEO/Manager yang boleh mengubahnya.
-- =====================================================================

alter table departments enable row level security;
alter table units       enable row level security;
alter table programs    enable row level security;
alter table users       enable row level security;
alter table accounts    enable row level security;

-- ---------------------------------------------------------------------
-- Referensi organisasi: dibaca semua, ditulis CEO/Manager
-- ---------------------------------------------------------------------
create policy departments_baca on departments
  for select using (auth.uid() is not null);
create policy departments_kelola on departments
  for all using (lintas_unit()) with check (lintas_unit());

create policy units_baca on units
  for select using (auth.uid() is not null);
create policy units_kelola on units
  for all using (lintas_unit()) with check (lintas_unit());

create policy programs_baca on programs
  for select using (auth.uid() is not null);
create policy programs_kelola on programs
  for all using (lintas_unit()) with check (lintas_unit());

-- ---------------------------------------------------------------------
-- users: profil sendiri selalu terbaca; selebihnya sesuai cakupan peran.
-- Direktori nama/jabatan memang dibutuhkan lintas unit (mis. memilih
-- penerima tiket), jadi SELECT dibuka untuk sesama anggota yang login —
-- data sensitif per orang ada di tabel lain yang RLS-nya lebih ketat.
-- ---------------------------------------------------------------------
create policy users_baca on users
  for select using (auth.uid() is not null);

create policy users_ubah_diri on users
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy users_kelola on users
  for all using (lintas_unit()) with check (lintas_unit());

-- ---------------------------------------------------------------------
-- accounts: PIC melihat akunnya, Leader melihat unitnya, CEO/Manager semua
-- ---------------------------------------------------------------------
create policy accounts_baca on accounts
  for select
  using (
    lintas_angka()
    or pic_user_id = auth.uid()
    or co_leader_id = auth.uid()
    or boleh_unit(unit_id)
  );

create policy accounts_kelola on accounts
  for all using (lintas_unit()) with check (lintas_unit());
