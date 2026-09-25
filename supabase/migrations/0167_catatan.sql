-- =====================================================================
-- K-Space V2 — Catatan: catatan kerja pribadi yang bisa dibagikan
--
-- Sistem lama punya catatan pribadi (SOP, dokumentasi, catatan rapat
-- harian) yang hanya terlihat penulisnya. V2 mempertahankan itu sebagai
-- bawaan — catatan adalah milik penulisnya — dan menambah satu hal yang
-- dulu tidak ada: penulis boleh membagikannya ke unitnya atau ke seluruh
-- perusahaan, supaya SOP yang ditulis seorang leader tidak berhenti di
-- ponselnya sendiri.
-- =====================================================================

create type kategori_catatan as enum (
  'dokumentasi',  -- catatan dokumentasi kerja
  'sop',          -- prosedur / templat
  'rapat',        -- catatan rapat atau review harian
  'lainnya'
);

create type visibilitas_catatan as enum (
  'pribadi',     -- hanya penulisnya
  'unit',        -- penulis dan anggota unitnya (juga CEO/Manager)
  'perusahaan'   -- semua orang yang masuk
);

create table notes (
  id           uuid primary key default gen_random_uuid(),
  judul        text not null check (length(trim(judul)) >= 3),
  isi          text not null default '',
  kategori     kategori_catatan not null default 'lainnya',
  visibilitas  visibilitas_catatan not null default 'pribadi',
  -- Unit tujuan bila dibagikan ke unit; kosong untuk yang lain.
  unit_id      uuid references units (id) on delete set null,
  disematkan   boolean not null default false,
  -- Tautan lampiran (gambar, berkas); berkasnya di penyimpanan luar.
  lampiran     text[] not null default '{}',
  dibuat_oleh  uuid not null references users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index notes_pemilik_idx on notes (dibuat_oleh, updated_at desc);
create index notes_unit_idx on notes (unit_id) where visibilitas = 'unit';

comment on table notes is
  'Catatan kerja milik penulisnya; bisa dibagikan ke unit atau seluruh perusahaan.';

create trigger notes_set_updated_at
  before update on notes
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Lingkup harus masuk akal: dibagikan ke unit berarti unitnya disebut,
-- dan lampiran harus tautan yang bisa dibuka.
-- ---------------------------------------------------------------------
create or replace function jaga_catatan()
returns trigger
language plpgsql
as $$
declare
  t text;
begin
  if new.visibilitas = 'unit' and new.unit_id is null then
    raise exception 'Catatan yang dibagikan ke unit harus menyebut unitnya'
      using errcode = 'check_violation';
  end if;
  if new.visibilitas <> 'unit' then
    new.unit_id := null;
  end if;

  foreach t in array new.lampiran loop
    if t !~ '^https?://[^[:space:]]+$' then
      raise exception 'Lampiran harus berupa tautan http(s): %', t
        using errcode = 'check_violation';
    end if;
  end loop;

  return new;
end;
$$;

create trigger jaga_catatan_trg
  before insert or update on notes
  for each row execute function jaga_catatan();

-- ---------------------------------------------------------------------
-- RLS — catatan milik penulisnya. Yang dibagikan terbaca sesuai
-- lingkupnya, tetapi hanya penulis yang boleh mengubah atau menghapus.
-- CEO/Manager pun tidak membaca catatan pribadi orang lain.
-- ---------------------------------------------------------------------
alter table notes enable row level security;

create policy notes_baca on notes
  for select using (
    auth.uid() is not null
    and (
      dibuat_oleh = auth.uid()
      or visibilitas = 'perusahaan'
      or (visibilitas = 'unit' and boleh_unit(unit_id))
    )
  );

create policy notes_tulis on notes
  for insert with check (dibuat_oleh = auth.uid());

create policy notes_ubah on notes
  for update using (dibuat_oleh = auth.uid()) with check (dibuat_oleh = auth.uid());

create policy notes_hapus on notes
  for delete using (dibuat_oleh = auth.uid());
