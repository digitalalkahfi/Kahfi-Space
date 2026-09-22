-- =====================================================================
-- K-Space V2 — LMS: kursus, modul, dan kemajuan belajar (PRD Rilis 3)
--
-- Yang dilacak bukan "sudah nonton atau belum", melainkan modul mana
-- yang sudah tuntas. Kemajuan kursus tidak disimpan sebagai angka
-- terpisah: ia selalu dihitung dari modul yang tuntas, supaya tidak
-- pernah ada persentase yang berbeda dari isinya.
-- =====================================================================

create type tingkat_kursus as enum ('dasar', 'menengah', 'lanjutan');

create table courses (
  id          uuid primary key default gen_random_uuid(),
  judul       text not null,
  ringkasan   text not null default '',
  kategori    text not null default '',
  tingkat     tingkat_kursus not null default 'dasar',
  unit_id     uuid references units (id) on delete set null,
  wajib_untuk peran_pengguna[] not null default '{}',
  aktif       boolean not null default true,
  dibuat_oleh uuid references users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index courses_aktif_idx on courses (aktif);

comment on column courses.wajib_untuk is
  'Peran yang diwajibkan mengikuti kursus ini; kosong berarti sukarela.';

create table course_modules (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses (id) on delete cascade,
  urutan        int not null check (urutan > 0),
  judul         text not null,
  isi           text not null default '',
  durasi_menit  int not null default 10 check (durasi_menit between 1 and 600),
  created_at    timestamptz not null default now(),
  unique (course_id, urutan)
);

create index course_modules_kursus_idx on course_modules (course_id, urutan);

create table course_enrollments (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses (id) on delete cascade,
  user_id      uuid not null references users (id) on delete cascade,
  dimulai_pada timestamptz not null default now(),
  selesai_pada timestamptz,
  unique (course_id, user_id)
);

create index course_enrollments_orang_idx on course_enrollments (user_id);

create table module_progress (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references course_enrollments (id) on delete cascade,
  module_id     uuid not null references course_modules (id) on delete cascade,
  selesai_pada  timestamptz not null default now(),
  unique (enrollment_id, module_id)
);

comment on table module_progress is
  'Satu baris per modul yang tuntas; kemajuan kursus dihitung dari sini.';

-- ---------------------------------------------------------------------
-- Kursus dinyatakan selesai hanya bila seluruh modulnya tuntas.
--
-- Dihitung ulang setiap kali kemajuan berubah — termasuk saat dibatalkan
-- dan saat modul baru ditambahkan ke kursus yang sudah dinyatakan
-- selesai. Tanpa itu, menambah modul akan meninggalkan orang yang
-- "selesai" padahal ada bagian yang belum pernah ia buka.
-- ---------------------------------------------------------------------
create or replace function segarkan_kelulusan(p_enrollment uuid)
returns void
language plpgsql
as $$
declare
  jumlah_modul int;
  jumlah_tuntas int;
begin
  select count(*) into jumlah_modul
  from course_modules m
  join course_enrollments e on e.course_id = m.course_id
  where e.id = p_enrollment;

  select count(*) into jumlah_tuntas
  from module_progress where enrollment_id = p_enrollment;

  update course_enrollments
     set selesai_pada = case
       when jumlah_modul > 0 and jumlah_tuntas >= jumlah_modul
         then coalesce(selesai_pada, now())
       else null
     end
   where id = p_enrollment;
end;
$$;

create or replace function jaga_kemajuan_modul()
returns trigger
language plpgsql
as $$
declare
  kursus_modul uuid;
  kursus_daftar uuid;
begin
  if tg_op = 'DELETE' then
    perform segarkan_kelulusan(old.enrollment_id);
    return old;
  end if;

  -- Modul harus benar-benar milik kursus yang diikuti; tanpa penjagaan
  -- ini, kemajuan bisa dicatat dari kursus yang sama sekali lain.
  select course_id into kursus_modul from course_modules where id = new.module_id;
  select course_id into kursus_daftar from course_enrollments where id = new.enrollment_id;

  if kursus_modul is distinct from kursus_daftar then
    raise exception 'Modul itu bukan bagian dari kursus yang diikuti'
      using errcode = 'check_violation';
  end if;

  perform segarkan_kelulusan(new.enrollment_id);
  return new;
end;
$$;

create trigger jaga_kemajuan_modul_trg
  after insert or delete on module_progress
  for each row execute function jaga_kemajuan_modul();

-- Menambah atau menghapus modul mengubah arti "selesai" bagi semua peserta.
create or replace function segarkan_kelulusan_kursus()
returns trigger
language plpgsql
as $$
declare
  daftar record;
begin
  for daftar in
    select id from course_enrollments
    where course_id = coalesce(new.course_id, old.course_id)
  loop
    perform segarkan_kelulusan(daftar.id);
  end loop;
  return coalesce(new, old);
end;
$$;

create trigger segarkan_kelulusan_kursus_trg
  after insert or delete on course_modules
  for each row execute function segarkan_kelulusan_kursus();

-- ---------------------------------------------------------------------
-- RLS — katalog terbuka bagi seluruh anggota; kemajuan bersifat pribadi.
-- ---------------------------------------------------------------------
alter table courses enable row level security;
alter table course_modules enable row level security;
alter table course_enrollments enable row level security;
alter table module_progress enable row level security;

create policy courses_baca on courses
  for select using (auth.uid() is not null);
create policy courses_kelola on courses
  for all using (lintas_unit()) with check (lintas_unit());

create policy course_modules_baca on course_modules
  for select using (auth.uid() is not null);
create policy course_modules_kelola on course_modules
  for all using (lintas_unit()) with check (lintas_unit());

-- Kemajuan belajar orang lain bukan urusan sesama staf; atasan dan
-- pengelola boleh melihat untuk memastikan pelatihan wajib berjalan.
create policy enrollments_baca on course_enrollments
  for select using (user_id = auth.uid() or boleh_orang(user_id));

create policy enrollments_daftar on course_enrollments
  for insert with check (user_id = auth.uid());

create policy enrollments_batal on course_enrollments
  for delete using (user_id = auth.uid() or lintas_unit());

create policy progress_baca on module_progress
  for select using (
    exists (select 1 from course_enrollments e where e.id = enrollment_id)
  );

create policy progress_tandai on module_progress
  for insert with check (
    exists (
      select 1 from course_enrollments e
      where e.id = enrollment_id and e.user_id = auth.uid()
    )
  );

create policy progress_batal on module_progress
  for delete using (
    exists (
      select 1 from course_enrollments e
      where e.id = enrollment_id and e.user_id = auth.uid()
    )
  );
