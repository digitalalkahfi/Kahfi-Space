-- =====================================================================
-- K-Space V2 — Preferensi tampilan per pengguna (PRD Personalisasi)
--
-- Satu baris per pengguna per permukaan per item. Permukaan yang belum
-- pernah diatur TIDAK punya baris sama sekali: ketiadaan baris berarti
-- "ikut bawaan", dan bawaan itu satu-satunya tempat susunan awal
-- hidup. Menyalin bawaan ke tabel saat pengguna dibuat terlihat rapi,
-- tetapi membuat penambahan menu di kemudian hari tidak pernah sampai
-- ke orang lama — menu barunya diam di luar layar dan tidak ada yang
-- sadar (alasan yang sama dengan 0115).
--
-- `urutan` sengaja TIDAK unik per permukaan. Menyimpan susunan baru
-- berarti mengganti seluruh daftar permukaan itu sekaligus; dengan
-- kunci unik, penggantian harus melewati keadaan antara yang melanggar
-- batasannya sendiri. Urutan ganda paling buruk hanya membuat dua item
-- bersebelahan bertukar tempat, dan pembacaannya tetap mantap karena
-- diurutkan bersama `kunci_item`.
--
-- Yang DIJAGA di sini cuma kepemilikan dan bentuk. Penyaringan per
-- peran (widgetPerPeran/bolehLihat) ditegakkan di lapisan server —
-- `lib/data/preferensi-tampilan.ts` dan server action-nya — karena
-- daftar peran itu hidup di TypeScript, dan menyalinnya ke SQL
-- menciptakan sumber kebenaran kedua yang pasti melenceng. Pembacaan
-- pun menyaring ulang, jadi baris yang terlanjur tersimpan di luar
-- wewenang tidak pernah tergambar.
-- =====================================================================

create type permukaan_tampilan as enum (
  'sidebar',   -- rail ikon desktop
  'dock',      -- dock bawah + laci ponsel
  'pintasan',  -- bar pintasan atas
  'beranda'    -- kartu ringkasan di Beranda
);

create table preferensi_tampilan (
  pengguna_id uuid not null references users (id) on delete cascade,
  permukaan   permukaan_tampilan not null,
  kunci_item  text not null,
  tampil      boolean not null default true,
  urutan      int not null,
  updated_at  timestamptz not null default now(),

  primary key (pengguna_id, permukaan, kunci_item),

  -- Kunci item berasal dari href menu atau nama widget; keduanya
  -- pendek. Batas ini menahan baris raksasa yang dikirim skrip, bukan
  -- salah ketik orang.
  constraint preferensi_tampilan_kunci_masuk_akal
    check (length(btrim(kunci_item)) between 1 and 120),
  constraint preferensi_tampilan_urutan_wajar
    check (urutan between 0 and 999)
);

comment on table preferensi_tampilan is
  'Centang dan urutan tampilan per pengguna; tanpa baris berarti ikut bawaan.';

comment on column preferensi_tampilan.kunci_item is
  'href menu (mis. /absensi) atau nama widget Beranda (mis. wrm).';

create index preferensi_tampilan_milik_idx
  on preferensi_tampilan (pengguna_id, permukaan, urutan);

-- ---------------------------------------------------------------------
-- RLS — preferensi adalah urusan pemiliknya sendiri.
--
-- Tidak ada policy lintas unit di sini, bahkan untuk CEO: susunan menu
-- orang lain bukan informasi yang perlu dibaca siapa pun, dan mengubah
-- tampilan orang lain dari jauh hanya akan terasa seperti aplikasinya
-- rusak.
-- ---------------------------------------------------------------------
alter table preferensi_tampilan enable row level security;

create policy preferensi_tampilan_baca on preferensi_tampilan
  for select to authenticated
  using (pengguna_id = auth.uid());

create policy preferensi_tampilan_tulis on preferensi_tampilan
  for insert to authenticated
  with check (pengguna_id = auth.uid());

create policy preferensi_tampilan_ubah on preferensi_tampilan
  for update to authenticated
  using (pengguna_id = auth.uid())
  with check (pengguna_id = auth.uid());

-- Menghapus barisnya berarti kembali ke bawaan; itu pilihan yang sah,
-- dan itulah yang dilakukan tombol "Kembalikan ke bawaan".
create policy preferensi_tampilan_hapus on preferensi_tampilan
  for delete to authenticated
  using (pengguna_id = auth.uid());

-- ---------------------------------------------------------------------
-- Waktu ubah dicatat sendiri, bukan dititipkan pengirimnya.
-- ---------------------------------------------------------------------
create or replace function sentuh_preferensi_tampilan()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sentuh_preferensi_tampilan_trg on preferensi_tampilan;

create trigger sentuh_preferensi_tampilan_trg
  before insert or update on preferensi_tampilan
  for each row execute function sentuh_preferensi_tampilan();
