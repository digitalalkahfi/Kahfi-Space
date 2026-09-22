-- =====================================================================
-- K-Space V2 — Notifikasi disiarkan ke layar yang sedang terbuka
--
-- Pusat notifikasi yang harus dimuat ulang untuk melihat isinya bukan
-- pusat notifikasi; ia daftar. Yang membuatnya berguna justru kabar
-- yang datang saat orangnya sedang mengerjakan hal lain.
--
-- Menumpang kanal yang sudah dipakai kalender (0096): tidak ada
-- mekanisme baru, tidak ada polling. Yang ditambahkan hanya satu tabel
-- ke publication yang sama.
--
-- RLS tetap berlaku pada siaran: setiap orang hanya menerima baris yang
-- memang boleh ia baca (`notifikasi_baca_milik_sendiri`, 0111). Tanpa
-- itu, menyiarkan tabel notifikasi berarti menyiarkan kotak masuk
-- semua orang ke semua orang.
--
-- Ditulis defensif dengan alasan yang sama seperti 0096: publication
-- `supabase_realtime` milik Supabase dan tidak ada pada PostgreSQL
-- biasa, termasuk PGlite yang dipakai test.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise notice 'Publication supabase_realtime tidak ada; siaran notifikasi dilewati.';
    return;
  end if;

  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    return;
  end if;

  execute 'alter publication supabase_realtime add table public.notifications';
end $$;

-- Berbeda dari agenda: di sini `replica identity` sengaja DIBIARKAN
-- bawaannya (kunci primer saja).
--
-- Layar notifikasi hanya perlu tahu BAHWA ada yang baru — isinya ia
-- ambil ulang lewat `router.refresh()` yang tunduk pada RLS. Menyiarkan
-- baris penuh berarti judul dan isi notifikasi ikut melewati kanal
-- replikasi, dan itu memperbesar permukaan tanpa menambah satu pun
-- kemampuan yang dipakai.
