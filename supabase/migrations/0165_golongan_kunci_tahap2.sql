-- ---------------------------------------------------------------------
-- Golongan kunci ekspor lama, tahap 2 (25 Sep 2026).
--
-- Dua belas kunci yang sebelumnya "asing" kini dipetakan (pengumuman,
-- kalender, jadwal, masalah, masukan, sampel, riwayat pindai, dan lima
-- kunci portal belajar), dan beberapa kunci turunan/kosong dinyatakan
-- diabaikan. Daftarnya HARUS sama dengan src/lib/ekspor-v1.ts; tes
-- unggahan-ekspor-lama membandingkan keduanya satu per satu.
--
-- Penjual (sellers:all) dan catatan pribadi (notes:all) sengaja tetap
-- asing: V2 belum punya tabelnya, dan keputusannya milik orang.
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
      'todos:all', 'keuangan:cashflow',
      -- Tahap 2.
      'announcements:all', 'calendar:all', 'schedule:all',
      'problems:all', 'feedback:all', 'sampel:all', 'sampel-usage:all',
      'lms:paths:all', 'lms:courses:all', 'lms:enrollments:all',
      'lms:progress:all', 'lms:library:all'
    ) then 'dikenal'
    -- Dicatat sebagai rujukan angka lama, tidak dipetakan.
    when p_kunci in ('gmv:targets', 'affiliate:goal') then 'referensi'
    when p_kunci in (
      'img:store', 'activities', 'activities:all',
      'backup', 'backup:last', 'backup:drive-last',
      'drive', 'drive:auto-backup',
      'template', 'daily-report-templates:all',
      'reports', 'reports:all', 'targets', 'targets:all',
      'app:settings',
      -- Turunan yang V2 hitung sendiri, atau yang isinya kosong di ekspor.
      'sampel-stat:all', 'lms:lesson-bodies:all', 'attendance:selfie-index'
    ) then 'diabaikan'
    -- Kunci yang belum pernah terlihat bukan 'diabaikan': keputusannya
    -- milik orang, dan sistem yang diam-diam membuangnya adalah cara
    -- paling rapi kehilangan data.
    else 'asing'
  end;
$$;

comment on function golongan_kunci(text) is
  'Padanan SQL golonganKunci() di src/lib/ekspor-v1.ts; diuji sama persis. Diperbarui tahap 2 (0165).';
