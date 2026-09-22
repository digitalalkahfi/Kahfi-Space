-- =====================================================================
-- K-Space V2 — Sampel produk & jejak pemindaian (PRD Rilis 2)
--
-- Sampel adalah barang fisik yang berpindah tangan: dari gudang ke staf,
-- dari staf ke kreator, lalu kembali atau tidak kembali sama sekali.
-- Yang hilang di sistem lama bukan datanya, melainkan pertanyaan
-- "sekarang ada di siapa?" — dan itu hanya bisa dijawab kalau setiap
-- perpindahan meninggalkan jejak, bukan sekadar menimpa status terakhir.
--
-- Karena itu `samples` menyimpan keadaan sekarang, dan `sample_events`
-- menyimpan riwayat lengkapnya. Statusnya sendiri tidak pernah diubah
-- langsung: ia selalu mengikuti kejadian terakhir (trigger di bawah).
-- =====================================================================

create type status_sampel as enum (
  'tersedia',      -- di gudang, siap dipakai
  'dipegang',      -- dibawa staf
  'dikirim',       -- dalam perjalanan ke kreator
  'diterima',      -- sudah di tangan kreator
  'dikembalikan',  -- kembali ke gudang
  'hilang'         -- tidak bisa dipertanggungjawabkan
);

create table samples (
  id          uuid primary key default gen_random_uuid(),
  kode        text not null,
  nama        text not null,
  kategori    text not null default '',
  unit_id     uuid references units (id) on delete set null,
  nilai       numeric(14, 2) not null default 0 check (nilai >= 0),
  status      status_sampel not null default 'tersedia',
  pemegang_id uuid references users (id) on delete set null,
  kreator     text not null default '',
  catatan     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Kode dipindai, jadi harus unik tanpa memandang huruf besar-kecil:
-- pembaca QR yang berbeda bisa mengembalikan huruf yang berbeda.
create unique index samples_kode_unik on samples (lower(kode));
create index samples_status_idx on samples (status);
create index samples_unit_idx on samples (unit_id);
create index samples_pemegang_idx on samples (pemegang_id);

comment on table samples is
  'Sampel produk beserta keadaan terakhirnya; riwayatnya di sample_events.';

create table sample_events (
  id         uuid primary key default gen_random_uuid(),
  sample_id  uuid not null references samples (id) on delete cascade,
  dari       status_sampel,
  ke         status_sampel not null,
  oleh_id    uuid references users (id) on delete set null,
  pemegang_id uuid references users (id) on delete set null,
  kreator    text not null default '',
  catatan    text not null default '',
  pada       timestamptz not null default now()
);

create index sample_events_sampel_idx on sample_events (sample_id, pada desc);

comment on table sample_events is
  'Satu baris per perpindahan sampel; tidak pernah disunting atau dihapus.';

-- ---------------------------------------------------------------------
-- Perpindahan yang masuk akal.
--
-- Barang tidak melompat dari 'tersedia' langsung ke 'dikembalikan', dan
-- yang sudah hilang tidak tiba-tiba diterima kreator. Aturannya dijaga
-- di sini supaya jalur mana pun — UI, pemindai, atau API — tunduk sama.
-- ---------------------------------------------------------------------
create or replace function perpindahan_sampel_sah(
  p_dari status_sampel,
  p_ke status_sampel
)
returns boolean
language sql
immutable
as $$
  select case
    when p_dari is null then p_ke = 'tersedia'
    when p_dari = p_ke then false
    when p_dari = 'tersedia'     then p_ke in ('dipegang', 'hilang')
    when p_dari = 'dipegang'     then p_ke in ('dikirim', 'tersedia', 'hilang')
    when p_dari = 'dikirim'      then p_ke in ('diterima', 'hilang')
    when p_dari = 'diterima'     then p_ke in ('dikembalikan', 'hilang')
    when p_dari = 'dikembalikan' then p_ke in ('dipegang', 'hilang')
    -- Sampel hilang bisa ditemukan lagi; itu kabar baik, bukan kejanggalan.
    when p_dari = 'hilang'       then p_ke = 'tersedia'
    else false
  end;
$$;

create or replace function jaga_kejadian_sampel()
returns trigger
language plpgsql
as $$
declare
  status_kini status_sampel;
begin
  select status into status_kini from samples where id = new.sample_id;

  if not perpindahan_sampel_sah(status_kini, new.ke) then
    raise exception 'Sampel tidak bisa berpindah dari % ke %', status_kini, new.ke
      using errcode = 'check_violation';
  end if;

  new.dari := status_kini;

  update samples
     set status = new.ke,
         pemegang_id = case
           when new.ke in ('tersedia', 'dikembalikan') then null
           else coalesce(new.pemegang_id, pemegang_id)
         end,
         kreator = case
           when new.ke in ('dikirim', 'diterima')
             then coalesce(nullif(new.kreator, ''), kreator)
           when new.ke in ('tersedia', 'dikembalikan') then ''
           else kreator
         end,
         updated_at = now()
   where id = new.sample_id;

  return new;
end;
$$;

create trigger jaga_kejadian_sampel_trg
  before insert on sample_events
  for each row execute function jaga_kejadian_sampel();

-- Riwayat perpindahan tidak boleh disunting; kalau keliru, catat
-- perpindahan baru yang membetulkannya.
create or replace function larang_ubah_kejadian_sampel()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Riwayat perpindahan sampel tidak bisa diubah atau dihapus'
    using errcode = 'check_violation';
end;
$$;

create trigger larang_ubah_kejadian_sampel_trg
  before update or delete on sample_events
  for each row execute function larang_ubah_kejadian_sampel();

-- ---------------------------------------------------------------------
-- RLS — sampel dilihat unitnya sendiri; CEO/Manager/Finance lintas unit.
-- ---------------------------------------------------------------------
alter table samples enable row level security;
alter table sample_events enable row level security;

create policy samples_baca on samples
  for select using (
    auth.uid() is not null
    and (
      lintas_angka()
      or pemegang_id = auth.uid()
      or boleh_unit(unit_id)
    )
  );

create policy samples_kelola on samples
  for all using (lintas_unit()) with check (lintas_unit());

create policy sample_events_baca on sample_events
  for select using (
    exists (select 1 from samples s where s.id = sample_id)
  );

-- Siapa pun yang boleh melihat sampelnya boleh mencatat perpindahannya:
-- yang memegang barangnyalah yang tahu ia berpindah.
create policy sample_events_buat on sample_events
  for insert with check (
    oleh_id = auth.uid()
    and exists (select 1 from samples s where s.id = sample_id)
  );
