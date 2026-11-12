-- =====================================================================
-- K-Space V2 — Pagar peran `asisten_baca` (lanjutan 0217)
--
-- MASALAH
-- 0217 menulis bahwa `asisten_baca` "tidak punya hak apa pun di skema
-- public". Itu benar untuk TABEL, tetapi tidak untuk FUNGSI: Postgres
-- memberi hak EXECUTE setiap fungsi baru kepada PUBLIC (= semua peran),
-- dan `asisten_baca` ikut mewarisinya. Akibatnya pemegang sandi
-- `asisten_baca` bisa memanggil ratusan fungsi di skema public. Yang
-- berbahaya adalah fungsi SECURITY DEFINER: ia berjalan dengan hak
-- pemilik, dan karena sesi asisten tidak membawa JWT,
-- `pemanggil_sistem()` (0173) menganggapnya sistem → seluruh organisasi.
-- Setelan read-only peran itu juga hanya BAWAAN sesi; sesi bisa
-- menggantinya sendiri. Jadi yang menahan tulisan harus hak, bukan
-- setelan.
--
-- PERBAIKAN
-- Postgres tidak punya "DENY" untuk satu peran. Maka untuk setiap
-- fungsi SECURITY DEFINER di skema public yang masih terbuka ke PUBLIC:
--   1. hak EXECUTE diberikan EKSPLISIT ke setiap peran yang ada saat ini
--      (anon, authenticated, service_role, dan peran bawaan Supabase),
--      KECUALI asisten_baca;
--   2. baru sesudahnya hak PUBLIC dicabut.
-- Hasilnya: hak efektif semua peran lain PERSIS seperti sebelumnya,
-- dan hanya asisten_baca yang kehilangan akses. Fungsi yang sudah
-- dicabut dari PUBLIC oleh migration lama tidak disentuh.
--
-- Fungsi biasa (security invoker) dibiarkan: ia berjalan dengan hak
-- asisten_baca sendiri, yang tidak punya hak tabel apa pun.
--
-- KE DEPAN
-- Fungsi baru buatan peran migrasi tidak lagi otomatis terbuka ke
-- PUBLIC. anon/authenticated/service_role tetap mendapat hak lewat
-- default privileges skema public bawaan Supabase. Peran lain yang
-- butuh fungsi baru harus diberi `grant execute` eksplisit.
--
-- `asisten.*` tidak terpengaruh: fungsinya SECURITY DEFINER milik
-- pemilik skema, jadi panggilan ke fungsi public di dalamnya berjalan
-- sebagai pemilik.
--
-- Aman dijalankan ulang. Rollback di bagian paling bawah.
-- =====================================================================

do $$
declare
  f record;
  r record;
begin
  for f in
    select p.oid, p.oid::regprocedure::text as tanda
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and exists (
        select 1
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0            -- 0 = PUBLIC
          and a.privilege_type = 'EXECUTE'
      )
  loop
    for r in
      select rolname
      from pg_roles
      where rolname <> 'asisten_baca'
        and rolname !~ '^pg_'
    loop
      execute format('grant execute on routine %s to %I', f.tanda, r.rolname);
    end loop;
    execute format('revoke execute on routine %s from public', f.tanda);
  end loop;
end $$;

-- Fungsi yang dibuat sesudah ini oleh peran migrasi tidak lagi terbuka
-- ke PUBLIC. (Bawaan global hanya bisa dicabut tanpa `in schema`.)
alter default privileges revoke execute on functions from public;

-- Sabuk pengaman: nyatakan lagi bahwa asisten_baca tidak punya hak
-- langsung apa pun di skema public.
revoke all on all tables in schema public from asisten_baca;
revoke all on all sequences in schema public from asisten_baca;
revoke all on all routines in schema public from asisten_baca;

comment on role asisten_baca is
  'Asisten Manager (MCP kspace), hanya-baca. Hanya boleh EXECUTE fungsi di skema asisten; fungsi SECURITY DEFINER di public tertutup (0218).';

-- ---------------------------------------------------------------------
-- Rollback (manual). Mengembalikan keadaan 0217: semua peran, termasuk
-- asisten_baca, kembali boleh memanggil fungsi SECURITY DEFINER public.
--   alter default privileges grant execute on functions to public;
--   do $r$ declare f record; begin
--     for f in select p.oid::regprocedure::text as tanda from pg_proc p
--              where p.pronamespace = 'public'::regnamespace and p.prosecdef
--     loop execute format('grant execute on routine %s to public', f.tanda);
--     end loop; end $r$;
-- Catatan: rollback ini juga membuka fungsi yang sengaja ditutup dari
-- PUBLIC oleh migration lama (mis. impor_grd). Tutup lagi sesuai
-- migration asalnya bila rollback dipakai.
-- ---------------------------------------------------------------------
