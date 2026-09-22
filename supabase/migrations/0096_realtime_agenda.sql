-- =====================================================================
-- K-Space V2 — Perubahan agenda disiarkan ke layar yang sedang terbuka
--
-- Kalender bersama baru benar-benar bersama kalau perubahannya sampai
-- tanpa harus memuat ulang. Rapat yang digeser setengah jam sebelum
-- mulai adalah kejadian paling lazim sekaligus paling merugikan bila
-- terlambat diketahui — dan orang biasanya sedang membuka halaman
-- kalender justru pada saat itu.
--
-- Supabase menyiarkan perubahan tabel yang terdaftar pada publication
-- `supabase_realtime`. RLS tetap berlaku pada siaran itu: setiap orang
-- hanya menerima baris yang memang boleh ia baca.
--
-- Ditulis defensif: publication itu milik Supabase dan tidak ada pada
-- PostgreSQL biasa (termasuk PGlite yang dipakai test), jadi
-- ketiadaannya tidak boleh menggagalkan migrasi.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise notice 'Publication supabase_realtime tidak ada; siaran agenda dilewati.';
    return;
  end if;

  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'agenda'
  ) then
    return;
  end if;

  execute 'alter publication supabase_realtime add table public.agenda';
end $$;

-- Siaran UPDATE dan DELETE hanya membawa kunci primernya kecuali replica
-- identity-nya penuh. Untuk kalender, layar perlu tahu tanggal mana yang
-- berubah supaya bisa menyegarkan bagian yang tepat.
alter table agenda replica identity full;
