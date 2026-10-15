-- =====================================================================
-- K-Space V2 — Gerbang anggota aktif (Fase 1 Daftar via Google)
--
-- Sebelum login Google dibuka, siapa pun yang sudah login dianggap boleh
-- membaca: banyak policy hanya berbunyi `auth.uid() is not null`, dan
-- `peran_saya()` tidak melihat status profil. Begitu orang bisa membuat
-- akun sendiri lewat Google, orang asing langsung membaca nama anggota,
-- unit, KPI, LMS; anggota yang sudah dinonaktifkan pun tetap membaca
-- sesuai perannya. Lihat docs/DAFTAR-GOOGLE-PERSETUJUAN.md §3.
--
-- Aturan barunya (BR-02, BR-03): hanya akun yang punya profil `users`
-- BERSTATUS AKTIF yang boleh membaca atau mengubah data. Dijaga di tiga
-- lapis:
--
--   1. `anggota_aktif()` — satu-satunya definisi "anggota aktif".
--   2. Helper peran (`peran_saya`, `unit_saya`, `bawahan_saya`,
--      `boleh_orang`, `pic_akun`) hanya bernilai bila profilnya aktif,
--      sehingga semua policy dan fungsi yang bertumpu pada peran ikut
--      tertutup untuk profil nonaktif.
--   3. Setiap policy `auth.uid() is not null` diganti `anggota_aktif()`,
--      dan setiap tabel diberi policy RESTRICTIVE `gerbang_anggota_aktif`.
--      Policy restrictive di-AND-kan dengan policy yang sudah ada, jadi
--      aturan per peran tidak berubah sedikit pun; ia hanya menutup celah
--      "baris milik sendiri" untuk akun yang tidak aktif.
--
-- Anggota aktif tidak merasakan bedanya: setiap syarat baru bernilai true
-- untuk mereka. Fungsi sistem (cron, trigger security definer, service
-- role) tidak terpengaruh karena tidak berjalan sebagai role klien.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Definisi anggota aktif
-- ---------------------------------------------------------------------
create or replace function anggota_aktif()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from users u
    where u.id = auth.uid() and u.status = 'aktif'
  );
$$;

comment on function anggota_aktif() is
  'True bila akun yang sedang login punya profil users berstatus aktif. Gerbang seluruh RLS (0208).';

-- Status akses untuk aplikasi (middleware): ke mana orang yang login
-- diarahkan. Tidak membocorkan apa pun selain status dirinya sendiri.
--   aktif        — boleh memakai K-Space
--   nonaktif     — profil ada tetapi dinonaktifkan
--   tanpa_profil — akun login tanpa profil (diperluas di 0209)
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
      'tanpa_profil'
    )
  end;
$$;

-- ---------------------------------------------------------------------
-- 2. Helper peran: hanya bernilai untuk profil aktif
-- ---------------------------------------------------------------------
create or replace function peran_saya()
returns peran_pengguna
language sql
stable
security definer
set search_path = public
as $$
  select u.role from users u where u.id = auth.uid() and u.status = 'aktif';
$$;

create or replace function unit_saya()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.unit_id from users u where u.id = auth.uid() and u.status = 'aktif';
$$;

create or replace function bawahan_saya()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with recursive pohon as (
    select u.id from users u
    where u.atasan_id = auth.uid() and anggota_aktif()
    union
    select u.id from users u join pohon p on u.atasan_id = p.id
  )
  select id from pohon;
$$;

create or replace function boleh_orang(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_user is null then false
    when pemanggil_sistem() then true
    -- 0208: profil nonaktif / tanpa profil tidak melihat siapa pun,
    -- termasuk dirinya sendiri.
    when not anggota_aktif() then false
    when target_user = auth.uid() then true
    when lintas_unit() then true
    else exists (select 1 from bawahan_saya() b where b = target_user)
  end;
$$;

create or replace function pic_akun(target_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select anggota_aktif() and exists (
    select 1 from accounts a
    where a.id = target_account
      and (a.pic_user_id = auth.uid() or a.co_leader_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------
-- 3a. Fungsi yang memakai `auth.uid() is not null` sebagai syarat baca
--
-- Isinya tidak diubah selain frasa itu, yang diganti `anggota_aktif()`.
-- Ditulis ulang dari definisi terbarunya supaya tidak ada salinan kedua
-- yang bisa berbeda. Fungsi trigger yang memakai `auth.uid() is null`
-- untuk membedakan "sistem" dari "klien" sengaja tidak disentuh.
-- ---------------------------------------------------------------------
do $$
declare
  nama text;
  def text;
  baru text;
begin
  foreach nama in array array[
    'pengumuman_untuk_saya',
    'boleh_aset',
    'aset_dipegang',
    'riwayat_aset',
    'boleh_menilai',
    'boleh_centang_tonggak',
    'boleh_isi_ukuran',
    'rencana_terlihat',
    'papan_kpi',
    'papan_akun_grd'
  ] loop
    select pg_get_functiondef(p.oid) into def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = nama;

    if def is null then
      raise exception 'Fungsi % tidak ditemukan', nama;
    end if;

    baru := replace(def, 'auth.uid() is not null', 'anggota_aktif()');
    if baru = def then
      raise exception 'Fungsi % tidak memuat "auth.uid() is not null"', nama;
    end if;

    execute baru;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3b. Policy `auth.uid() is not null` → `anggota_aktif()`
--
-- Hanya frasa itu yang berganti; sisa syarat tiap policy sama persis
-- dengan definisi terbarunya.
-- ---------------------------------------------------------------------
alter policy agenda_baca on agenda
  using (((anggota_aktif()) AND (lintas_unit() OR (unit_id IS NULL) OR (unit_id = unit_saya()) OR (dibuat_oleh = auth.uid()))));

alter policy announcements_baca on announcements
  using (((anggota_aktif()) AND (((published_at IS NOT NULL) AND (published_at <= now()) AND pengumuman_untuk_saya(target_role, target_unit_id)) OR (dibuat_oleh = auth.uid()) OR lintas_unit())));

alter policy aset_baca on assets
  using (((anggota_aktif()) AND lintas_angka()));

alter policy batas_minimum_baca on batas_minimum_level
  using ((anggota_aktif()));

alter policy course_modules_baca on course_modules
  using ((anggota_aktif()));

alter policy courses_baca on courses
  using ((anggota_aktif()));

alter policy departments_baca on departments
  using ((anggota_aktif()));

alter policy feedback_baca on feedback
  using ((anggota_aktif()));

alter policy komentar_baca on feedback_comments
  using ((anggota_aktif()));

alter policy jejak_baca on feedback_events
  using ((anggota_aktif()));

alter policy votes_baca on feedback_votes
  using ((anggota_aktif()));

alter policy grd_akun_dikecualikan_baca on grd_akun_dikecualikan
  using ((anggota_aktif()));

alter policy grd_cascade_blok_baca on grd_cascade_blok
  using (((anggota_aktif()) AND ((peran_saya() IS DISTINCT FROM 'Staff'::peran_pengguna) OR (goal_id IS NULL) OR (EXISTS ( SELECT 1
   FROM goals g
  WHERE ((g.id = grd_cascade_blok.goal_id) AND (g.pemilik_id = auth.uid())))))));

alter policy kpi_def_baca on kpi_definitions
  using ((anggota_aktif()));

alter policy kspace_lama_log_baca on kspace_lama_log
  using ((anggota_aktif()));

alter policy metrik_departemen_baca on metrik_departemen
  using ((anggota_aktif()));

alter policy notes_baca on notes
  using (((anggota_aktif()) AND ((dibuat_oleh = auth.uid()) OR (visibilitas = 'perusahaan'::visibilitas_catatan) OR ((visibilitas = 'unit'::visibilitas_catatan) AND boleh_unit(unit_id)))));

alter policy pengaturan_baca on pengaturan
  using ((anggota_aktif()));

alter policy problems_baca on problems
  using (((anggota_aktif()) AND (lintas_unit() OR (dilaporkan_oleh = auth.uid()) OR boleh_orang(dilaporkan_oleh))));

alter policy programs_baca on programs
  using ((anggota_aktif()));

alter policy quiz_questions_baca on quiz_questions
  using ((anggota_aktif()));

alter policy samples_baca on samples
  using (((anggota_aktif()) AND (lintas_angka() OR (pemegang_id = auth.uid()) OR boleh_unit(unit_id) OR ((account_id IS NOT NULL) AND pic_akun(account_id)))));

alter policy units_baca on units
  using ((anggota_aktif()));

alter policy users_baca on users
  using ((anggota_aktif()));

-- ---------------------------------------------------------------------
-- 3c. Gerbang restrictive di setiap tabel
--
-- `(select anggota_aktif())` dievaluasi sekali per query (InitPlan), bukan
-- per baris. Tabel yang dibuat SESUDAH migrasi ini wajib menambahkan
-- policy yang sama, kecuali tabel yang memang untuk akun belum aktif
-- (mis. `pendaftaran_akun`, 0209).
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    order by c.relname
  loop
    execute format('drop policy if exists gerbang_anggota_aktif on public.%I', t);
    execute format(
      'create policy gerbang_anggota_aktif on public.%I as restrictive
         for all to public
         using ((select anggota_aktif()))
         with check ((select anggota_aktif()))',
      t
    );
  end loop;
end;
$$;
