-- =====================================================================
-- K-Space V2 — Hak akses hierarki, tahap lanjutan
--
-- Menutup sisa jalur yang masih membuka data di luar cakupan setelah
-- 0173:
--   1. Agenda unit lain terbaca semua orang. Sekarang: agenda perusahaan
--      (tanpa unit), agenda unit sendiri, dan buatan sendiri; CEO/Manager
--      semua. Deteksi bentrok tidak berkurang — bentrok hanya dihitung
--      antar agenda seunit atau dengan agenda perusahaan (lib/kalender).
--   2. Kaizen: Staff melihat semua masalah unitnya. Sekarang: pelapornya
--      dan atasan pelapor lewat garis pelaporan; CEO/Manager semua.
--   3. CO sampel per akun menyebut akun rekan seunit. Sekarang hanya
--      akun yang memang terlihat pemanggil.
--   4. Email & nomor WhatsApp: disediakan satu pintu baca `kontak_orang`
--      yang mengikuti hierarki. Kolomnya sendiri dikunci di migrasi
--      terpisah (0175) SETELAH kode yang memakai pintu ini tayang —
--      kalau dikunci lebih dulu, kode lama yang masih membaca kolom itu
--      langsung akan gagal memuat sesi.
-- =====================================================================

-- 1. Agenda -------------------------------------------------------------
drop policy if exists agenda_baca on agenda;
create policy agenda_baca on agenda
  for select
  using (
    auth.uid() is not null
    and (
      lintas_unit()
      or unit_id is null
      or unit_id = unit_saya()
      or dibuat_oleh = auth.uid()
    )
  );

-- 2. Kaizen ---------------------------------------------------------------
drop policy if exists problems_baca on problems;
create policy problems_baca on problems
  for select
  using (
    auth.uid() is not null
    and (
      lintas_unit()
      or dilaporkan_oleh = auth.uid()
      or boleh_orang(dilaporkan_oleh)
    )
  );

-- 3. CO sampel ------------------------------------------------------------
-- Bergabung dengan `accounts` supaya RLS akun (0173) ikut menyaring:
-- sampel boleh terlihat seunit, tetapi hitungan per akun hanya untuk
-- akun yang dipegang pemanggil atau bawahannya.
create or replace function co_sampel_akun(p_tanggal date)
returns table (account_id uuid, jumlah integer)
language sql
stable
set search_path = public
as $$
  select s.account_id, count(*)::int
  from sample_scans sc
  join samples s on s.id = sc.sample_id
  join accounts a on a.id = s.account_id
  where sc.dikenali
    and (sc.pada at time zone 'Asia/Jakarta')::date = p_tanggal
  group by s.account_id;
$$;

comment on function co_sampel_akun(date) is
  'Jumlah pemindaian sampel per akun yang terlihat pemanggil pada satu tanggal (0174).';

-- 4a. Verifikasi nomor berjalan sebagai pemilik ---------------------------
-- Fungsi ini membaca `kontak` orang lain. Setelah kolomnya dikunci dari
-- peran klien (0175), hanya fungsi pemilik yang boleh membacanya;
-- pemeriksaan CEO/Manager tetap sama.
create or replace function verifikasi_kontak(p_user uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
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

-- 4b. Satu pintu baca data kontak -----------------------------------------
-- Nama dan peran tetap terbaca semua orang (dipakai di seluruh aplikasi);
-- email dan nomor WhatsApp hanya untuk dirinya, atasannya lewat garis
-- pelaporan, dan CEO/Manager.
create or replace function kontak_orang(p_ids uuid[] default null)
returns table (
  id                        uuid,
  email                     text,
  kontak                    text,
  kontak_terverifikasi_pada timestamptz,
  whatsapp_optin            boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email, u.kontak, u.kontak_terverifikasi_pada, u.whatsapp_optin
  from users u
  where (p_ids is null or u.id = any (p_ids))
    and boleh_orang(u.id);
$$;

comment on function kontak_orang(uuid[]) is
  'Email & nomor WhatsApp orang dalam cakupan pemanggil: dirinya, bawahannya, atau semua bagi CEO/Manager (0174).';

revoke execute on function kontak_orang(uuid[]) from public, anon;
grant execute on function kontak_orang(uuid[]) to authenticated;
