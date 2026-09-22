-- =====================================================================
-- K-Space V2 — Siapa yang boleh memverifikasi nomor (PRD Fase 4)
--
-- 0117 menambahkan kolomnya; yang belum ada adalah pagarnya. Sampai
-- migrasi ini, seseorang bisa menulis `kontak_terverifikasi_pada`
-- pada barisnya sendiri — dan verifikasi yang bisa diberikan sendiri
-- tidak memverifikasi apa pun. Seluruh syarat opt-in di 0117 berdiri di
-- atas kolom itu, jadi lubangnya bukan sekadar kosmetik: siapa pun bisa
-- membuat sistem mengirim pesan ke nomor mana pun yang ia tulis.
--
-- Pembagiannya:
--   - `whatsapp_optin`  → milik ORANGNYA. Persetujuan yang diberikan
--     orang lain bukan persetujuan.
--   - `kontak_terverifikasi_pada` → milik PENGELOLA. Ia pernyataan
--     pihak ketiga bahwa nomor itu benar-benar menjawab.
-- =====================================================================

create or replace function jaga_verifikasi_kontak()
returns trigger
language plpgsql
as $$
begin
  -- CEO dan Manager memang berwenang memverifikasi.
  if lintas_unit() then
    return new;
  end if;

  -- Perubahan oleh sistem (seed, service role, trigger) tidak dibatasi.
  if auth.uid() is null then
    return new;
  end if;

  -- Pengosongan otomatis saat nomornya berganti tetap boleh: itu
  -- dilakukan `reset_verifikasi_kontak` (0117), dan arahnya justru
  -- memperketat.
  if new.kontak_terverifikasi_pada is distinct from old.kontak_terverifikasi_pada
     and new.kontak_terverifikasi_pada is not null then
    raise exception 'Verifikasi nomor hanya bisa dilakukan CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- Dijalankan SESUDAH `reset_verifikasi_kontak` (0117) supaya
-- pengosongan otomatisnya tidak ikut tertolak. Nama trigger menentukan
-- urutan pada tahap yang sama, dan "z_" memastikannya terakhir.
drop trigger if exists z_jaga_verifikasi_kontak_trg on users;

create trigger z_jaga_verifikasi_kontak_trg
  before update on users
  for each row execute function jaga_verifikasi_kontak();

-- ---------------------------------------------------------------------
-- Memverifikasi
-- ---------------------------------------------------------------------
-- Disediakan sebagai fungsi, bukan UPDATE langsung, supaya satu-satunya
-- cara memverifikasi juga mencatat SIAPA yang melakukannya — lewat
-- audit yang sudah berjalan pada tabel users.
create or replace function verifikasi_kontak(p_user uuid)
returns timestamptz
language plpgsql
as $$
declare
  v_kontak text;
  v_waktu  timestamptz;
begin
  if not lintas_unit() then
    raise exception 'Verifikasi nomor hanya bisa dilakukan CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  select kontak into v_kontak from users where id = p_user;
  if v_kontak is null then
    raise exception 'Orang ini belum mengisi nomor kontak'
      using errcode = 'check_violation';
  end if;

  update users
  set kontak_terverifikasi_pada = now()
  where id = p_user
  returning kontak_terverifikasi_pada into v_waktu;

  return v_waktu;
end;
$$;

comment on function verifikasi_kontak(uuid) is
  'Menandai nomor seseorang sudah dibuktikan; hanya CEO dan Manager.';

-- Mencabut verifikasi ikut mencabut persetujuannya: persetujuan atas
-- nomor yang tidak lagi dipercaya tidak boleh tetap berlaku.
create or replace function cabut_verifikasi_kontak(p_user uuid)
returns void
language plpgsql
as $$
begin
  if not lintas_unit() then
    raise exception 'Pencabutan verifikasi hanya bisa dilakukan CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;

  update users
  set kontak_terverifikasi_pada = null,
      whatsapp_optin = false
  where id = p_user;
end;
$$;

comment on function cabut_verifikasi_kontak(uuid) is
  'Mencabut verifikasi nomor sekaligus persetujuan WhatsApp-nya.';
