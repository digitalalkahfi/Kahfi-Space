-- =====================================================================
-- K-Space V2 — Masukan & laporan bug (PRD Rilis 3)
--
-- Kanal masukan hanya berguna kalau orang percaya laporannya dibaca.
-- Karena itu yang dijaga di sini bukan cuma datanya, melainkan tiga hal
-- yang membuat orang berhenti melapor:
--
--   1. Laporan menghilang tanpa kabar — setiap perubahan status wajib
--      punya jejak, dan penolakan wajib disertai alasan.
--   2. Dukungan orang lain tidak terlihat — dukungan dicatat per orang
--      sehingga yang banyak dialami bisa didahulukan.
--   3. Laporan orang lain tertutup — masukan terbuka bagi semua anggota,
--      supaya tidak ada yang melaporkan hal yang sama berulang kali.
-- =====================================================================

create type jenis_masukan as enum ('bug', 'saran', 'pertanyaan');

create type status_masukan as enum (
  'baru',        -- belum dibaca pengelola
  'ditinjau',    -- sedang dipertimbangkan
  'dikerjakan',
  'selesai',
  'ditolak'      -- tidak dikerjakan, wajib berisi alasan
);

create type keparahan_bug as enum ('ringan', 'sedang', 'berat', 'kritis');

create table feedback (
  id            uuid primary key default gen_random_uuid(),
  jenis         jenis_masukan not null default 'saran',
  judul         text not null check (length(trim(judul)) >= 10),
  isi           text not null default '',
  -- Hanya berarti untuk jenis 'bug'.
  keparahan     keparahan_bug,
  halaman       text not null default '',
  status        status_masukan not null default 'baru',
  alasan_tolak  text not null default '',
  dilaporkan_oleh uuid references users (id) on delete set null,
  ditugaskan_ke uuid references users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index feedback_status_idx on feedback (status);
create index feedback_jenis_idx on feedback (jenis);

comment on column feedback.halaman is
  'Halaman tempat masalahnya ditemui; sangat menolong saat menelusuri bug.';

-- Satu orang satu dukungan; itulah yang membuat angkanya berarti.
create table feedback_votes (
  feedback_id uuid not null references feedback (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (feedback_id, user_id)
);

create table feedback_comments (
  id          uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references feedback (id) on delete cascade,
  oleh_id     uuid references users (id) on delete set null,
  isi         text not null check (length(trim(isi)) >= 2),
  created_at  timestamptz not null default now()
);

create index feedback_comments_masukan_idx
  on feedback_comments (feedback_id, created_at);

-- ---------------------------------------------------------------------
-- Jejak perubahan status: tanpa ini, laporan terasa menghilang.
-- ---------------------------------------------------------------------
create table feedback_events (
  id          uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references feedback (id) on delete cascade,
  dari        status_masukan,
  ke          status_masukan not null,
  oleh_id     uuid references users (id) on delete set null,
  catatan     text not null default '',
  pada        timestamptz not null default now()
);

create index feedback_events_masukan_idx
  on feedback_events (feedback_id, pada desc);

create or replace function catat_perubahan_masukan()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  -- Menolak tanpa alasan membuat pelapor tidak pernah tahu apa yang
  -- salah dengan masukannya, dan berhenti melapor lain kali.
  if new.status = 'ditolak'
     and length(trim(coalesce(new.alasan_tolak, ''))) < 10
  then
    raise exception 'Sebutkan alasan penolakan (minimal 10 huruf)'
      using errcode = 'check_violation';
  end if;

  new.updated_at := now();

  insert into feedback_events (feedback_id, dari, ke, oleh_id, catatan)
  values (
    new.id, old.status, new.status, auth.uid(),
    case when new.status = 'ditolak' then new.alasan_tolak else '' end
  );

  return new;
end;
$$;

create trigger catat_perubahan_masukan_trg
  before update of status on feedback
  for each row execute function catat_perubahan_masukan();

-- Keparahan hanya berarti untuk bug; mengisinya pada saran hanya
-- membuat papan prioritas berisik tanpa arti.
create or replace function jaga_keparahan_masukan()
returns trigger
language plpgsql
as $$
begin
  if new.jenis <> 'bug' then
    new.keparahan := null;
  elsif new.keparahan is null then
    new.keparahan := 'sedang';
  end if;
  return new;
end;
$$;

create trigger jaga_keparahan_masukan_trg
  before insert or update of jenis, keparahan on feedback
  for each row execute function jaga_keparahan_masukan();

-- ---------------------------------------------------------------------
-- RLS — masukan terbuka bagi seluruh anggota yang login.
-- ---------------------------------------------------------------------
alter table feedback enable row level security;
alter table feedback_votes enable row level security;
alter table feedback_comments enable row level security;
alter table feedback_events enable row level security;

create policy feedback_baca on feedback
  for select using (auth.uid() is not null);

create policy feedback_lapor on feedback
  for insert with check (dilaporkan_oleh = auth.uid());

create policy feedback_kelola on feedback
  for all using (lintas_unit()) with check (lintas_unit());

create policy votes_baca on feedback_votes
  for select using (auth.uid() is not null);
create policy votes_beri on feedback_votes
  for insert with check (user_id = auth.uid());
create policy votes_tarik on feedback_votes
  for delete using (user_id = auth.uid());

create policy komentar_baca on feedback_comments
  for select using (auth.uid() is not null);
create policy komentar_tulis on feedback_comments
  for insert with check (oleh_id = auth.uid());
create policy komentar_kelola on feedback_comments
  for all using (lintas_unit()) with check (lintas_unit());

create policy jejak_baca on feedback_events
  for select using (auth.uid() is not null);
