-- =====================================================================
-- K-Space V2 — Pendaftaran akun lewat Google + persetujuan CEO/Manager
-- (Fase 2 Daftar via Google; docs/DAFTAR-GOOGLE-PERSETUJUAN.md §5–§7)
--
-- Orang yang login Google dengan email yang tidak dikenal TIDAK lagi
-- dibuatkan profil Staff nonaktif. Trigger `auth_ke_users`
-- (supabase/auth.sql) mencatatnya di `pendaftaran_akun` berstatus
-- menunggu. CEO/Manager aktif lalu memutuskan:
--
--   * setujui sebagai anggota baru  → `setujui_pendaftaran_baru`
--   * setujui dengan menyambungkan ke profil lama → `sambungkan_pendaftaran`
--   * tolak beralasan → `tolak_pendaftaran`
--
-- Ketiganya fungsi database supaya profil dan status pendaftaran berubah
-- dalam SATU transaksi (E10), dan supaya pengecekan "masih menunggu"
-- terjadi di dalam perintah yang mengubahnya, bukan hanya di layar
-- (BR-06). Klien tidak punya hak menulis kolom keputusan sama sekali.
--
-- Tabel ini sengaja TIDAK diberi gerbang `gerbang_anggota_aktif` (0208):
-- pemiliknya justru akun yang belum aktif.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipe
-- ---------------------------------------------------------------------
create type status_pendaftaran as enum ('menunggu', 'disetujui', 'ditolak');
create type cara_persetujuan as enum ('baru', 'sambung');

-- Notifikasi pendaftaran baru untuk CEO/Manager. Hanya in-app: trigger
-- antrean WhatsApp di bawah melewatkan kategori ini (keputusan §11 no. 1).
alter type kategori_notifikasi add value if not exists 'anggota';

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------
create table pendaftaran_akun (
  -- Sama dengan auth.users.id: satu akun Google = satu pendaftaran (E2).
  -- Tanpa foreign key karena skema auth tidak ada di database uji.
  id              uuid primary key,
  email           text not null,
  nama_google     text not null,
  foto_url        text,
  no_wa           text,
  -- Pengajuan calon, BUKAN keputusan: unitnya ditetapkan approver.
  unit_diajukan   text check (unit_diajukan in ('affiliator', 'mcn', 'tap')),
  catatan         text,
  status          status_pendaftaran not null default 'menunggu',
  diputuskan_oleh uuid references users (id) on update cascade on delete set null,
  diputuskan_pada timestamptz,
  alasan_tolak    text,
  profil_id       uuid references users (id) on update cascade on delete set null,
  cara            cara_persetujuan,
  dibuat_pada     timestamptz not null default now(),

  constraint pendaftaran_email_kecil check (email = lower(email)),
  constraint pendaftaran_no_wa_sah check (no_wa is null or no_wa ~ '^62[0-9]{8,13}$'),
  constraint pendaftaran_catatan_pendek check (catatan is null or length(catatan) <= 500),
  constraint pendaftaran_keputusan_lengkap check (
    status = 'menunggu'
    or (diputuskan_oleh is not null and diputuskan_pada is not null)
  ),
  -- BR-07: minimal 5 huruf.
  constraint pendaftaran_tolak_beralasan check (
    status <> 'ditolak'
    or length(regexp_replace(coalesce(alasan_tolak, ''), '[^[:alpha:]]', '', 'g')) >= 5
  ),
  constraint pendaftaran_setuju_lengkap check (
    status <> 'disetujui' or (profil_id is not null and cara is not null)
  )
);

comment on table pendaftaran_akun is
  'Pendaftaran akun lewat Google beserta keputusan CEO/Manager. Jejak audit; tidak dihapus (0209).';

create index pendaftaran_status_idx on pendaftaran_akun (status, dibuat_pada desc);

-- ---------------------------------------------------------------------
-- Hak akses
--
-- Klien hanya membaca, dan pemiliknya hanya mengubah isian dirinya
-- selama masih menunggu. INSERT hanya dari trigger Auth; DELETE tidak
-- ada sama sekali (retensi penuh).
-- ---------------------------------------------------------------------
alter table pendaftaran_akun enable row level security;

revoke all on pendaftaran_akun from anon, authenticated;
grant select on pendaftaran_akun to authenticated;
grant update (no_wa, unit_diajukan, catatan) on pendaftaran_akun to authenticated;

create policy pendaftaran_baca on pendaftaran_akun
  for select to authenticated
  using (id = auth.uid() or lintas_unit());

create policy pendaftaran_isi_sendiri on pendaftaran_akun
  for update to authenticated
  using (id = auth.uid() and status = 'menunggu')
  with check (id = auth.uid() and status = 'menunggu');

-- ---------------------------------------------------------------------
-- Status akses (perluasan 0208): pendaftar menunggu / ditolak
-- ---------------------------------------------------------------------
create or replace function status_akses_saya()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then null
    else coalesce(
      (select u.status::text from users u where u.id = auth.uid()),
      (select p.status::text from pendaftaran_akun p
        where p.id = auth.uid() and p.status in ('menunggu', 'ditolak')),
      'tanpa_profil'
    )
  end;
$$;

-- ---------------------------------------------------------------------
-- Notifikasi ke CEO & Manager aktif saat ada pendaftaran baru
-- ---------------------------------------------------------------------
create or replace function notifikasi_pendaftaran_baru()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select u.id from users u
    where u.status = 'aktif' and u.role in ('CEO', 'Manager')
  loop
    perform terbitkan_notifikasi(
      r.id,
      'anggota',
      format('Pendaftaran baru: %s', new.nama_google),
      format('%s menunggu persetujuan.', new.email),
      '/tim/pendaftaran'
    );
  end loop;
  return new;
end;
$$;

create trigger notifikasi_pendaftaran_baru_trg
  after insert on pendaftaran_akun
  for each row execute function notifikasi_pendaftaran_baru();

-- Antrean WhatsApp melewatkan notifikasi pendaftaran. Dibandingkan
-- sebagai teks: nilai enum yang baru ditambahkan belum boleh dipakai
-- sebagai literal di transaksi yang sama.
drop trigger if exists antrekan_whatsapp_trg on notifications;
create trigger antrekan_whatsapp_trg
  after insert on notifications
  for each row
  when (new.kategori::text <> 'anggota')
  execute function antrekan_whatsapp();

-- ---------------------------------------------------------------------
-- Memindahkan id profil ke id akun login
--
-- Riwayat seseorang ikut pindah lewat foreign key `on update cascade`
-- (supabase/auth.sql). Masalahnya, banyak tabel riwayat dijaga trigger
-- yang menolak SEMUA perubahan — tiket selesai, jejak sampel/aset,
-- persetujuan transaksi, dst. — termasuk perubahan yang datang dari
-- cascade. Akibatnya profil yang sudah punya riwayat tidak bisa
-- disambungkan sama sekali.
--
-- Mengganti id orang bukan mengubah isi riwayat, jadi trigger buatan
-- (bukan trigger internal foreign key) di tabel-tabel anak dimatikan
-- SELAMA perpindahan ini saja. Semuanya terjadi di satu transaksi:
-- `alter table` mengunci tabelnya, sehingga sesi lain tidak pernah
-- melihat trigger dalam keadaan mati, dan bila ada galat semuanya
-- kembali seperti semula. Trigger di tabel `users` sendiri tetap hidup
-- (audit anggota mencatat perpindahannya).
--
-- Cascade berjalan satu foreign key demi satu. CHECK yang menyebut dua
-- kolom orang sekaligus (mis. `tasks_pribadi_milik_sendiri`: pembuat =
-- penerima) sempat melihat keadaan setengah jalan dan menolak, padahal
-- hasil akhirnya sah. CHECK seperti itu dilepas lalu dipasang lagi —
-- pemasangan ulang memvalidasi seluruh baris, jadi aturannya tetap
-- terbukti terpenuhi.
-- ---------------------------------------------------------------------
create or replace function pindahkan_id_profil(p_lama uuid, p_baru uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t regclass;
  anak regclass[];
  c record;
  cek jsonb := '[]';
begin
  if p_lama = p_baru then
    return;
  end if;

  select array_agg(distinct con.conrelid::regclass) into anak
  from pg_constraint con
  where con.contype = 'f'
    and con.confrelid = 'public.users'::regclass
    and con.conrelid <> 'public.users'::regclass;

  -- CHECK yang menyebut dua kolom orang atau lebih.
  for c in
    with fk as (
      select con.conrelid as rel, a.attname as kolom
      from pg_constraint con
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
      where con.contype = 'f' and con.confrelid = 'public.users'::regclass
    )
    select k.conrelid::regclass as tabel, k.conname, pg_get_constraintdef(k.oid) as def
    from pg_constraint k
    where k.contype = 'c'
      and (
        select count(distinct fk.kolom) from fk
        where fk.rel = k.conrelid
          and pg_get_constraintdef(k.oid) ~ ('\m' || fk.kolom || '\M')
      ) >= 2
  loop
    cek := cek || jsonb_build_object('t', c.tabel::text, 'n', c.conname, 'd', c.def);
    execute format('alter table %s drop constraint %I', c.tabel, c.conname);
  end loop;

  foreach t in array coalesce(anak, '{}') loop
    execute format('alter table %s disable trigger user', t);
  end loop;

  update users set id = p_baru where id = p_lama;

  foreach t in array coalesce(anak, '{}') loop
    execute format('alter table %s enable trigger user', t);
  end loop;

  for c in select * from jsonb_to_recordset(cek) as x(t text, n text, d text) loop
    execute format('alter table %s add constraint %I %s', c.t, c.n, c.d);
  end loop;
end;
$$;

revoke execute on function pindahkan_id_profil(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Keputusan
-- ---------------------------------------------------------------------

-- Penjaga bersama: pemanggil CEO/Manager AKTIF (BR-01), lalu baris
-- pendaftaran dikunci dan statusnya harus masih yang dilihat approver.
-- `p_status_awal` membedakan "menyetujui dari tab Menunggu" dari
-- "menyetujui yang dulu ditolak" (BR-09) — dua approver yang menekan
-- tombol berbarengan tetap hanya satu yang berhasil (E1).
create or replace function kunci_pendaftaran(
  p_id uuid,
  p_status_awal status_pendaftaran
)
returns pendaftaran_akun
language plpgsql
security definer
set search_path = public
as $$
declare
  r pendaftaran_akun;
  nama_pemutus text;
begin
  if not coalesce(lintas_unit(), false) then
    raise exception 'Hanya CEO atau Manager yang boleh memutuskan pendaftaran.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into r from pendaftaran_akun where id = p_id for update;
  if not found then
    raise exception 'Pendaftaran tidak ditemukan.';
  end if;

  if r.status is distinct from p_status_awal then
    select u.nama into nama_pemutus from users u where u.id = r.diputuskan_oleh;
    raise exception '%', case
      when nama_pemutus is null then 'Pendaftaran ini sudah diputuskan.'
      else format('Pendaftaran ini sudah diputuskan oleh %s.', nama_pemutus)
    end;
  end if;

  return r;
end;
$$;

-- Email Google tidak boleh sudah dipakai profil lain (E7).
create or replace function jaga_email_pendaftaran(p_email text, p_kecuali uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pemakai text;
begin
  select u.nama into pemakai from users u
  where lower(u.email) = lower(p_email)
    and u.id is distinct from p_kecuali
  limit 1;
  if pemakai is not null then
    raise exception 'Email % sudah dipakai profil %.', p_email, pemakai;
  end if;
end;
$$;

-- Setujui sebagai ANGGOTA BARU. Validasi isian (BR-04: `periksa`,
-- `periksaAtasan`, `sebabAtasanTakSah`) dikerjakan server action lebih
-- dulu; aturan hierarki atasan tetap dijaga trigger `users` (0044,
-- 0070, 0164) di sini juga.
create or replace function setujui_pendaftaran_baru(
  p_id          uuid,
  p_status_awal status_pendaftaran,
  p_nama        text,
  p_role        peran_pengguna,
  p_jabatan     text,
  p_unit        uuid,
  p_departemen  uuid,
  p_program     uuid,
  p_atasan      uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r pendaftaran_akun;
begin
  if p_status_awal not in ('menunggu', 'ditolak') then
    raise exception 'Pendaftaran ini sudah disetujui.';
  end if;
  r := kunci_pendaftaran(p_id, p_status_awal);

  if exists (select 1 from users where id = r.id) then
    raise exception 'Akun ini sudah punya profil.';
  end if;
  perform jaga_email_pendaftaran(r.email, null);

  if p_atasan is not null and not exists (
    select 1 from users where id = p_atasan and status = 'aktif'
  ) then
    raise exception 'Atasan yang dipilih tidak ditemukan atau nonaktif.';
  end if;

  insert into users (
    id, nama, email, role, jabatan, unit_id, department_id, program_id,
    atasan_id, status
  ) values (
    r.id, trim(p_nama), r.email, p_role, trim(p_jabatan), p_unit,
    p_departemen, p_program,
    case when p_role = 'CEO' then null else p_atasan end,
    'aktif'
  );

  update pendaftaran_akun set
    status = 'disetujui',
    cara = 'baru',
    profil_id = r.id,
    diputuskan_oleh = auth.uid(),
    diputuskan_pada = now(),
    alasan_tolak = null
  where id = r.id;
end;
$$;

-- Setujui dengan MENYAMBUNGKAN ke profil yang sudah ada (jalur C).
-- Id profil dipindahkan ke id akun Google; seluruh riwayatnya ikut lewat
-- foreign key `on update cascade` (supabase/auth.sql). Email profil
-- diganti email Google (keputusan §11 no. 4).
create or replace function sambungkan_pendaftaran(
  p_id          uuid,
  p_status_awal status_pendaftaran,
  p_profil      uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r pendaftaran_akun;
  profil users;
  punya_login boolean := false;
begin
  if p_status_awal not in ('menunggu', 'ditolak') then
    raise exception 'Pendaftaran ini sudah disetujui.';
  end if;
  r := kunci_pendaftaran(p_id, p_status_awal);

  select * into profil from users where id = p_profil for update;
  if not found then
    raise exception 'Profil yang dipilih tidak ditemukan.';
  end if;
  -- BR-05
  if profil.status <> 'aktif' then
    raise exception 'Profil % nonaktif. Aktifkan dulu sebelum disambungkan.', profil.nama;
  end if;
  if exists (select 1 from users where id = r.id) then
    raise exception 'Akun ini sudah punya profil.';
  end if;

  -- E3: profil yang sudah punya akun login tidak boleh diambil alih.
  -- Skema auth hanya ada di Supabase; di database uji pemeriksaan ini
  -- dilewati (server action memeriksanya juga lewat Auth admin).
  if to_regclass('auth.users') is not null then
    execute 'select exists (select 1 from auth.users where id = $1)'
      into punya_login using p_profil;
  end if;
  if punya_login then
    raise exception 'Profil % sudah punya akun login.', profil.nama;
  end if;

  perform jaga_email_pendaftaran(r.email, p_profil);

  perform pindahkan_id_profil(p_profil, r.id);
  update users set email = r.email where id = r.id;

  update pendaftaran_akun set
    status = 'disetujui',
    cara = 'sambung',
    profil_id = r.id,
    diputuskan_oleh = auth.uid(),
    diputuskan_pada = now(),
    alasan_tolak = null
  where id = r.id;
end;
$$;

-- Tolak beralasan (BR-07). Hanya dari status menunggu.
create or replace function tolak_pendaftaran(p_id uuid, p_alasan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(regexp_replace(coalesce(p_alasan, ''), '[^[:alpha:]]', '', 'g')) < 5 then
    raise exception 'Isi alasan penolakan (minimal 5 huruf).';
  end if;
  perform kunci_pendaftaran(p_id, 'menunggu');

  update pendaftaran_akun set
    status = 'ditolak',
    alasan_tolak = trim(p_alasan),
    diputuskan_oleh = auth.uid(),
    diputuskan_pada = now()
  where id = p_id;
end;
$$;

-- Penolong internal tidak dipanggil klien langsung.
revoke execute on function kunci_pendaftaran(uuid, status_pendaftaran) from public, anon, authenticated;
revoke execute on function jaga_email_pendaftaran(text, uuid) from public, anon, authenticated;
revoke execute on function notifikasi_pendaftaran_baru() from public, anon, authenticated;
revoke execute on function setujui_pendaftaran_baru(uuid, status_pendaftaran, text, peran_pengguna, text, uuid, uuid, uuid, uuid) from anon;
revoke execute on function sambungkan_pendaftaran(uuid, status_pendaftaran, uuid) from anon;
revoke execute on function tolak_pendaftaran(uuid, text) from anon;
