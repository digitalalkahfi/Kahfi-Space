-- =====================================================================
-- K-Space V2 — Perbaikan kebocoran policy pengumuman
--
-- Temuan audit RLS: pengunjung TANPA sesi bisa membaca pengumuman yang
-- tidak menyasar peran/unit tertentu.
--
-- Sebabnya presedensi operator. Policy lama berbunyi:
--     A and B and C or D or E
-- yang dibaca PostgreSQL sebagai (A and B and C) or D or E. Untuk anon,
-- `peran_saya()` bernilai null sehingga `pengumuman_untuk_saya(null, null)`
-- menghasilkan true — dan seluruh syarat "sudah tayang" ikut lolos.
--
-- Perbaikan: syarat "harus punya sesi" dinaikkan ke depan dan seluruh
-- cabang OR dikurung tegas.
-- =====================================================================

drop policy if exists announcements_baca on announcements;

create policy announcements_baca on announcements
  for select
  using (
    auth.uid() is not null
    and (
      -- Sudah tayang DAN memang ditujukan kepada pembaca.
      (
        published_at is not null
        and published_at <= now()
        and pengumuman_untuk_saya(target_role, target_unit_id)
      )
      -- Penulisnya sendiri boleh melihat drafnya.
      or dibuat_oleh = auth.uid()
      -- CEO & Manager mengawasi seluruh pengumuman.
      or lintas_unit()
    )
  );

-- Pengaman berlapis: fungsi pencocokan menolak pemanggil tanpa sesi,
-- supaya policy lain yang memakainya tidak mengulang celah yang sama.
create or replace function pengumuman_untuk_saya(
  p_target_role peran_pengguna,
  p_target_unit uuid
)
returns boolean
language sql
stable
as $$
  select auth.uid() is not null
     and (p_target_role is null or p_target_role = peran_saya())
     and (p_target_unit is null or p_target_unit = unit_saya() or lintas_unit());
$$;
