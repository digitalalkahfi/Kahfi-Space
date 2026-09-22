-- =====================================================================
-- K-Space V2 — Masalah & analisis 5-Why (PRD Rilis 3)
--
-- Inti metode 5-Why bukan mencatat masalahnya, melainkan memaksa orang
-- menelusuri sebabnya bertingkat sampai akar. Karena itu jawabannya
-- disimpan berurutan dan wajib runtut: menulis "mengapa" ketiga sebelum
-- kedua terisi akan menghasilkan rantai yang terputus dan menyesatkan.
--
-- Tindakan perbaikan disimpan terpisah karena satu akar masalah lazim
-- melahirkan beberapa tindakan dengan penanggung jawab berbeda.
-- =====================================================================

create type status_masalah as enum (
  'baru',        -- dilaporkan, belum ditelusuri
  'dianalisis',  -- rantai 5-Why sedang diisi
  'ditindak',    -- akar ketemu, tindakan berjalan
  'selesai',     -- seluruh tindakan tuntas
  'ditutup'      -- ditutup tanpa tindakan (mis. bukan masalah)
);

create type dampak_masalah as enum ('rendah', 'sedang', 'tinggi');

create table problems (
  id            uuid primary key default gen_random_uuid(),
  judul         text not null,
  konteks       text not null default '',
  unit_id       uuid references units (id) on delete set null,
  dilaporkan_oleh uuid references users (id) on delete set null,
  dampak        dampak_masalah not null default 'sedang',
  status        status_masalah not null default 'baru',
  ditutup_alasan text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index problems_status_idx on problems (status);
create index problems_unit_idx on problems (unit_id);

comment on table problems is
  'Masalah yang ditelusuri dengan 5-Why; akarnya di problem_whys.';

create table problem_whys (
  id         uuid primary key default gen_random_uuid(),
  problem_id uuid not null references problems (id) on delete cascade,
  urutan     int not null check (urutan between 1 and 5),
  jawaban    text not null check (length(trim(jawaban)) >= 5),
  oleh_id    uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (problem_id, urutan)
);

comment on column problem_whys.urutan is
  'Tingkat ke-berapa; 1 adalah sebab langsung, yang terakhir dianggap akar.';

create table problem_actions (
  id          uuid primary key default gen_random_uuid(),
  problem_id  uuid not null references problems (id) on delete cascade,
  tindakan    text not null check (length(trim(tindakan)) >= 5),
  penanggung_id uuid references users (id) on delete set null,
  tenggat     date,
  selesai     boolean not null default false,
  selesai_pada timestamptz,
  created_at  timestamptz not null default now()
);

create index problem_actions_masalah_idx on problem_actions (problem_id);

-- ---------------------------------------------------------------------
-- Rantai 5-Why harus runtut.
--
-- Tanpa ini, orang cenderung melompat ke tingkat yang terdengar paling
-- meyakinkan dan melewatkan langkah di antaranya — persis kebiasaan yang
-- hendak dicegah metode ini.
-- ---------------------------------------------------------------------
create or replace function jaga_urutan_why()
returns trigger
language plpgsql
as $$
declare
  sebelumnya int;
begin
  if new.urutan > 1 then
    select count(*) into sebelumnya
    from problem_whys
    where problem_id = new.problem_id and urutan = new.urutan - 1;

    if sebelumnya = 0 then
      raise exception 'Isi "mengapa" ke-% dulu sebelum ke-%',
        new.urutan - 1, new.urutan
        using errcode = 'check_violation';
    end if;
  end if;

  -- Begitu penelusuran dimulai, status masalahnya ikut bergerak.
  update problems
     set status = case when status = 'baru' then 'dianalisis' else status end,
         updated_at = now()
   where id = new.problem_id;

  return new;
end;
$$;

create trigger jaga_urutan_why_trg
  before insert on problem_whys
  for each row execute function jaga_urutan_why();

-- Menghapus satu mata rantai di tengah memutus penelusurannya.
create or replace function jaga_hapus_why()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from problem_whys
    where problem_id = old.problem_id and urutan > old.urutan
  ) then
    raise exception 'Hapus "mengapa" yang lebih dalam lebih dulu'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger jaga_hapus_why_trg
  before delete on problem_whys
  for each row execute function jaga_hapus_why();

-- ---------------------------------------------------------------------
-- RLS — masalah dilihat unitnya sendiri; CEO/Manager lintas unit.
-- ---------------------------------------------------------------------
alter table problems enable row level security;
alter table problem_whys enable row level security;
alter table problem_actions enable row level security;

create policy problems_baca on problems
  for select using (
    auth.uid() is not null
    and (lintas_angka() or dilaporkan_oleh = auth.uid() or boleh_unit(unit_id))
  );

-- Siapa pun yang login boleh melaporkan masalah — menyaring pelapor
-- hanya membuat masalah tidak pernah sampai ke permukaan.
create policy problems_lapor on problems
  for insert with check (dilaporkan_oleh = auth.uid());

create policy problems_kelola on problems
  for all using (lintas_unit()) with check (lintas_unit());

create policy problem_whys_baca on problem_whys
  for select using (exists (select 1 from problems p where p.id = problem_id));

create policy problem_whys_isi on problem_whys
  for insert with check (
    oleh_id = auth.uid()
    and exists (select 1 from problems p where p.id = problem_id)
  );

create policy problem_whys_kelola on problem_whys
  for all using (lintas_unit()) with check (lintas_unit());

create policy problem_actions_baca on problem_actions
  for select using (exists (select 1 from problems p where p.id = problem_id));

create policy problem_actions_kelola on problem_actions
  for all using (lintas_unit()) with check (lintas_unit());

-- Penanggung jawab boleh menandai tindakannya sendiri selesai.
create policy problem_actions_tandai on problem_actions
  for update using (penanggung_id = auth.uid())
  with check (penanggung_id = auth.uid());
