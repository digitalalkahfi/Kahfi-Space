-- =====================================================================
-- K-Space V2 — Ekspor K-Space lama yang sungguhan
--
-- `kv_store_lama` (0074) dibuat untuk bentuk ekspor karangan: satu baris
-- per entitas, kuncinya `user:<uuid>`. Ekspor K-Space lama yang asli
-- tidak berbentuk begitu. Ia satu objek JSON besar berisi `_meta` dan
-- sekian kunci tingkat atas — `users:list`, `daily-reports:all`,
-- `keuangan:cashflow` — yang masing-masing berisi seluruh datanya
-- sekaligus. Jadi satu kunci ekspor = satu baris di sini, bukan satu
-- orang = satu baris.
--
-- Yang ditambahkan migrasi ini:
--   · `kv_unggahan` — satu baris per berkas yang diunggah, beserta
--     `_meta`-nya. Tanpa ini tidak ada cara mengetahui isi tabel ini
--     berasal dari ekspor kapan dan diunggah siapa.
--   · Penolakan kolom kredensial. Ekspor lama memuat `passwordHash`,
--     `salt`, dan sejenisnya. Kata sandi orang tidak boleh ikut mendarat
--     di basis data baru, sekali pun sebagai bahan mentah yang "nanti
--     dibuang saat pemetaan" — karena "nanti" itu sering tidak datang.
--   · `golongan_kunci()` — padanan SQL dari `golonganKunci()` di
--     `src/lib/ekspor-v1.ts`, supaya layar dan basis data memutuskan
--     kunci mana yang dipetakan dengan daftar yang sama persis.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Satu baris per berkas ekspor yang diunggah.
-- ---------------------------------------------------------------------
create table kv_unggahan (
  id           uuid primary key default gen_random_uuid(),
  berkas       text not null check (length(trim(berkas)) > 0),
  -- Isi `_meta` ekspor apa adanya: versi aplikasi lama, waktu ekspor,
  -- dan siapa yang mengekspor. Disimpan utuh karena angka di layar
  -- verifikasi nanti dibandingkan dengan keterangan ini.
  meta         jsonb not null default '{}'::jsonb,
  jumlah_kunci integer not null default 0 check (jumlah_kunci >= 0),
  jumlah_entri integer not null default 0 check (jumlah_entri >= 0),
  oleh         uuid references users (id),
  dimuat_pada  timestamptz not null default now()
);

comment on table kv_unggahan is
  'Satu baris per berkas ekspor K-Space lama yang diunggah; _meta-nya disimpan utuh.';

create index kv_unggahan_waktu_idx on kv_unggahan (dimuat_pada desc);

alter table kv_unggahan enable row level security;

create policy kv_unggahan_kelola on kv_unggahan
  for all using (lintas_unit()) with check (lintas_unit());

-- ---------------------------------------------------------------------
-- Baris ekspor menunjuk berkas asalnya.
-- ---------------------------------------------------------------------
alter table kv_store_lama
  add column unggahan_id uuid references kv_unggahan (id) on delete set null;

create index kv_store_lama_unggahan_idx on kv_store_lama (unggahan_id);

comment on column kv_store_lama.key is
  'Kunci tingkat atas ekspor lama (mis. users:list); sekaligus id_lama baris ini.';

-- ---------------------------------------------------------------------
-- Golongan kunci — daftarnya sama dengan src/lib/ekspor-v1.ts.
-- ---------------------------------------------------------------------
create or replace function golongan_kunci(p_kunci text)
returns text
language sql
immutable
as $$
  select case
    when p_kunci in (
      'users:list', 'affiliate-accounts:all', 'daily-reports:all',
      'gmv:daily', 'affiliate-gmv:daily', 'attendance:all',
      'attendance:config', 'leave-requests:all', 'tasks:all',
      'todos:all', 'keuangan:cashflow'
    ) then 'dikenal'
    -- Dicatat sebagai rujukan angka lama, tidak dipetakan.
    when p_kunci in ('gmv:targets', 'affiliate:goal') then 'referensi'
    when p_kunci in (
      'img:store', 'activities', 'backup', 'drive',
      'template', 'reports', 'targets', 'app:settings'
    ) then 'diabaikan'
    -- Kunci yang belum pernah terlihat bukan 'diabaikan': keputusannya
    -- milik orang, dan sistem yang diam-diam membuangnya adalah cara
    -- paling rapi kehilangan data.
    else 'asing'
  end;
$$;

comment on function golongan_kunci(text) is
  'Padanan SQL golonganKunci() di src/lib/ekspor-v1.ts; diuji sama persis.';

-- ---------------------------------------------------------------------
-- Kata sandi tidak boleh mendarat di sini.
-- ---------------------------------------------------------------------
create or replace function punya_kredensial(p_nilai jsonb)
returns boolean
language sql
immutable
as $$
  -- `$.**` menelusuri seluruh kedalaman: kata sandi di ekspor lama tidak
  -- selalu di tingkat atas, kadang di dalam larik pengguna.
  select jsonb_path_exists(p_nilai, '$.**.password')
      or jsonb_path_exists(p_nilai, '$.**.passwordHash')
      or jsonb_path_exists(p_nilai, '$.**.password_hash')
      or jsonb_path_exists(p_nilai, '$.**.confirmPassword')
      or jsonb_path_exists(p_nilai, '$.**.salt');
$$;

create or replace function jaga_kredensial_kv()
returns trigger
language plpgsql
as $$
begin
  if punya_kredensial(new.value) then
    raise exception
      'Kolom kata sandi ikut terbawa pada kunci %. Buang password/passwordHash/salt/confirmPassword sebelum mengunggah.',
      new.key
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger jaga_kredensial_kv
  before insert or update on kv_store_lama
  for each row execute function jaga_kredensial_kv();

-- ---------------------------------------------------------------------
-- Ringkasan per kunci — dipakai layar unggah dan layar pemetaan.
-- ---------------------------------------------------------------------
create or replace function ringkas_kunci_lama()
returns table (
  kunci       text,
  golongan    text,
  jumlah      integer,
  dimuat_pada timestamptz
)
language sql
stable
as $$
  select
    k.key,
    golongan_kunci(k.key),
    -- Kunci yang isinya objek (mis. attendance:config) bukan larik;
    -- dihitung satu entri, bukan nol.
    case
      when jsonb_typeof(k.value) = 'array' then jsonb_array_length(k.value)
      else 1
    end,
    k.dimuat_pada
  from kv_store_lama k
  order by
    case golongan_kunci(k.key)
      when 'dikenal' then 1
      when 'referensi' then 2
      when 'asing' then 3
      else 4
    end,
    k.key;
$$;
