-- ---------------------------------------------------------------------
-- Golongan kunci ekspor lama: sellers:all dan notes:all kini dipetakan.
--
-- Keduanya tinggal sebagai "asing" sejak 0165 karena V2 belum punya
-- tabelnya. Dengan 0166 (sellers) dan 0167 (notes), tidak ada lagi kunci
-- data lama yang tanpa tempat. Daftarnya HARUS sama dengan
-- src/lib/ekspor-v1.ts; tes unggahan-ekspor-lama membandingkannya.
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
      'announcements:all', 'calendar:all', 'schedule:all',
      'problems:all', 'feedback:all', 'sampel:all', 'sampel-usage:all',
      'lms:paths:all', 'lms:courses:all', 'lms:enrollments:all',
      'lms:progress:all', 'lms:library:all',
      'sellers:all', 'notes:all'
    ) then 'dikenal'
    when p_kunci in ('gmv:targets', 'affiliate:goal') then 'referensi'
    when p_kunci in (
      'img:store', 'activities', 'activities:all',
      'backup', 'backup:last', 'backup:drive-last',
      'drive', 'drive:auto-backup',
      'template', 'daily-report-templates:all',
      'reports', 'reports:all', 'targets', 'targets:all',
      'app:settings',
      'sampel-stat:all', 'lms:lesson-bodies:all', 'attendance:selfie-index'
    ) then 'diabaikan'
    else 'asing'
  end;
$$;

comment on function golongan_kunci(text) is
  'Padanan SQL golonganKunci() di src/lib/ekspor-v1.ts; diuji sama persis. Diperbarui 0168.';
