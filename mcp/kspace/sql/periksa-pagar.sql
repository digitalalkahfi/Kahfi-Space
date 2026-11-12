-- Periksa jangkauan peran asisten_baca. HANYA MEMBACA katalog database.
-- Jalankan di SQL Editor Supabase sebelum dan sesudah migration 0218.
--
-- Harapan SESUDAH 0218:
--   peran_ada = true
--   fungsi_asisten = 7 (atau lebih bila tool bertambah)
--   definer_terbuka_di_luar_asisten = 0
--   tabel_terbaca = 0
--   skema_terjangkau = daftar skema yang boleh dimasuki (untuk ditinjau)
select
  exists (select 1 from pg_roles where rolname = 'asisten_baca') as peran_ada,
  (select rolcanlogin from pg_roles where rolname = 'asisten_baca') as boleh_login,
  (select count(*) from pg_proc p
     where p.pronamespace = 'asisten'::regnamespace
       and has_function_privilege('asisten_baca', p.oid, 'execute')) as fungsi_asisten,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.prosecdef
       and n.nspname not in ('asisten', 'pg_catalog', 'information_schema')
       and has_schema_privilege('asisten_baca', n.oid, 'usage')
       and has_function_privilege('asisten_baca', p.oid, 'execute')) as definer_terbuka_di_luar_asisten,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'v', 'm', 'p')
       and n.nspname not in ('pg_catalog', 'information_schema')
       and has_schema_privilege('asisten_baca', n.oid, 'usage')
       and has_table_privilege('asisten_baca', c.oid, 'select')) as tabel_terbaca,
  (select string_agg(n.nspname, ', ' order by n.nspname) from pg_namespace n
     where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
       and has_schema_privilege('asisten_baca', n.oid, 'usage')) as skema_terjangkau,
  (select string_agg(n.nspname || '.' || p.proname, ', ' order by 1) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where p.prosecdef
       and n.nspname not in ('asisten', 'pg_catalog', 'information_schema')
       and has_schema_privilege('asisten_baca', n.oid, 'usage')
       and has_function_privilege('asisten_baca', p.oid, 'execute')) as daftar_definer_terbuka;
