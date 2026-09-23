-- =====================================================================
-- K-Space V2 — Peta id lama → id baru
--
-- Migrasi harus aman diulang. Ekspor yang sama bisa diunggah dua kali
-- (karena yang pertama terputus, karena ekspornya diperbarui, karena
-- orang ragu), dan tanpa penanda apa pun setiap pengulangan menggandakan
-- seluruh data perusahaan — kesalahan yang jauh lebih mahal diperbaiki
-- daripada dicegah.
--
-- Tabel ini penandanya: satu baris per (kelompok, id lama), menunjuk
-- baris V2 yang sudah dibuat untuknya. Pemetaan berikutnya memeriksa
-- tabel ini lebih dulu — kalau id lamanya sudah ada, barisnya diperbarui,
-- bukan dibuat lagi.
--
-- Petanya disimpan terpisah, bukan sebagai kolom `id_lama` di tiap tabel
-- tujuan, karena tidak semua tabel boleh ditambahi kolom demi migrasi
-- yang suatu hari selesai — dan karena satu catatan lama kadang menjadi
-- beberapa baris V2 (izin beberapa hari, misalnya).
-- =====================================================================

create table migrasi_peta (
  -- Kunci ekspor asalnya, mis. 'users:list'.
  kelompok    text not null check (length(trim(kelompok)) > 0),
  -- Penanda catatan di sistem lama, apa adanya.
  id_lama     text not null check (length(trim(id_lama)) > 0),
  -- Baris V2 yang dibuat untuknya.
  id_baru     uuid not null,
  tabel       text not null check (length(trim(tabel)) > 0),
  dibuat_pada timestamptz not null default now(),

  primary key (kelompok, id_lama)
);

comment on table migrasi_peta is
  'Penanda idempoten migrasi: satu baris per catatan lama yang sudah punya padanan di V2.';

-- Dipakai verifikasi: baris V2 mana yang benar-benar berasal dari migrasi.
create index migrasi_peta_tujuan_idx on migrasi_peta (tabel, id_baru);

alter table migrasi_peta enable row level security;

create policy migrasi_peta_kelola on migrasi_peta
  for all using (lintas_unit()) with check (lintas_unit());

-- ---------------------------------------------------------------------
-- Orang yang belum bisa ditautkan
-- ---------------------------------------------------------------------
-- Data lama menunjuk orang lewat id V1. Sebagian di antaranya tidak ada
-- padanannya di V2: karyawan yang sudah keluar sebelum V2 dipakai, akun
-- uji coba, atau orang yang namanya berubah. Barisnya tidak boleh
-- dipaksa masuk dengan penunjuk kosong — laporan tanpa pelapor dan tugas
-- tanpa penerima adalah data yang tampak utuh tetapi tidak bisa dipakai.
--
-- Jadi orangnya dikumpulkan di sini sampai ada yang memutuskan.
create table migrasi_orang_pending (
  id             uuid primary key default gen_random_uuid(),
  id_lama        text not null unique check (length(trim(id_lama)) > 0),
  nama           text not null default '',
  -- Di kunci ekspor mana saja id ini muncul; membantu menilai dampaknya.
  kemunculan     text[] not null default '{}',
  alasan         text not null default 'Tidak ada di users:list.',
  -- Keputusannya: ditautkan ke orang V2, atau sengaja dibiarkan kosong.
  user_id        uuid references users (id) on delete set null,
  diabaikan      boolean not null default false,
  diputuskan_oleh uuid references users (id),
  diputuskan_pada timestamptz,
  dibuat_pada    timestamptz not null default now(),

  -- Ditautkan dan diabaikan tidak bisa keduanya.
  constraint migrasi_orang_pending_keputusan_utuh check (
    not (user_id is not null and diabaikan)
  )
);

comment on table migrasi_orang_pending is
  'Orang V1 yang belum punya padanan di V2; barisnya menunggu keputusan sebelum data yang menunjuknya diproses.';

alter table migrasi_orang_pending enable row level security;

create policy migrasi_orang_pending_kelola on migrasi_orang_pending
  for all using (lintas_unit()) with check (lintas_unit());

-- Keputusan wajib punya pemilik dan waktu. Tanpa ini, penautan yang
-- keliru tidak bisa ditelusuri ke siapa pun.
create or replace function jaga_keputusan_orang_pending()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is not null or new.diabaikan then
    if new.diputuskan_oleh is null then
      raise exception 'Keputusan penautan harus mencatat siapa yang memutuskan.'
        using errcode = 'check_violation';
    end if;
    new.diputuskan_pada := coalesce(new.diputuskan_pada, now());
  else
    -- Keputusan yang dicabut ikut melepas jejaknya, supaya tidak ada
    -- baris yang tampak sudah diputuskan padahal tidak.
    new.diputuskan_oleh := null;
    new.diputuskan_pada := null;
  end if;
  return new;
end;
$$;

create trigger jaga_keputusan_orang_pending
  before insert or update on migrasi_orang_pending
  for each row execute function jaga_keputusan_orang_pending();

-- ---------------------------------------------------------------------
-- Pencarian padanan
-- ---------------------------------------------------------------------

/**
 * Id V2 sebuah catatan lama, atau null bila belum pernah dipetakan.
 */
create or replace function peta_id(p_kelompok text, p_id_lama text)
returns uuid
language sql
stable
as $$
  select m.id_baru
  from migrasi_peta m
  where m.kelompok = p_kelompok and m.id_lama = p_id_lama;
$$;

/**
 * Id V2 seorang anggota dari id lamanya.
 *
 * Dicari dua kali: pada peta hasil pemetaan `users:list`, lalu pada
 * keputusan penautan manual. Urutannya penting — hasil pemetaan adalah
 * yang paling sering benar, dan penautan manual hanya untuk yang tidak
 * ketemu di sana.
 */
create or replace function orang_v1(p_id_lama text)
returns uuid
language sql
stable
as $$
  select coalesce(
    (select m.id_baru from migrasi_peta m
      where m.kelompok = 'users:list' and m.id_lama = p_id_lama),
    (select o.user_id from migrasi_orang_pending o
      where o.id_lama = p_id_lama and o.user_id is not null)
  );
$$;

/** Berapa orang yang masih menunggu keputusan. */
create or replace function orang_pending_terbuka()
returns integer
language sql
stable
as $$
  select count(*)::int
  from migrasi_orang_pending o
  where o.user_id is null and not o.diabaikan;
$$;
