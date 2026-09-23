-- =====================================================================
-- K-Space V2 — Peta yang menunjuk baris yang sudah tidak ada
--
-- `migrasi_peta` (0154) sengaja tidak memakai kunci asing: satu tabel
-- peta menunjuk enam tabel tujuan yang berbeda, dan kunci asing tidak
-- bisa begitu. Harganya: kalau baris tujuannya dihapus, petanya tetap
-- tinggal dan menunjuk ke ruang kosong.
--
-- Akibatnya bukan galat, melainkan sesuatu yang lebih halus: pemetaan
-- berikutnya melihat catatan itu "sudah pernah dipindahkan" lalu
-- melewatinya — selamanya. Datanya hilang dan tidak ada yang tahu.
--
-- Fungsi ini yang membuat keadaan itu bisa dilihat, dan dibersihkan.
-- =====================================================================

create or replace function peta_menggantung()
returns table (kelompok text, tabel text, id_lama text, id_baru uuid)
language plpgsql
stable
as $$
declare
  t text;
begin
  -- Diperiksa per tabel tujuan; daftarnya dibatasi pada tabel yang memang
  -- pernah ditulis mesin migrasi, bukan seluruh basis data.
  foreach t in array array[
    'users', 'accounts', 'daily_reports', 'attendance', 'tasks', 'transactions'
  ] loop
    return query execute format(
      'select m.kelompok, m.tabel, m.id_lama, m.id_baru
         from migrasi_peta m
        where m.tabel = %L
          and not exists (select 1 from %I x where x.id = m.id_baru)',
      t, t
    );
  end loop;
end;
$$;

comment on function peta_menggantung() is
  'Baris migrasi_peta yang tujuannya sudah tidak ada; kalau dibiarkan, catatannya tidak akan pernah dipindahkan lagi.';

/**
 * Membuang peta yang menggantung supaya catatannya bisa dipindahkan lagi.
 *
 * Bukan pembersihan rapi-rapi: yang dilakukan sebenarnya adalah
 * mengembalikan catatan lama ke keadaan "belum pernah dipindahkan",
 * karena memang itulah keadaannya sekarang.
 */
create or replace function bersihkan_peta_menggantung()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jumlah integer;
begin
  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh membersihkan peta migrasi.'
      using errcode = '42501';
  end if;

  with menggantung as (select * from peta_menggantung())
  delete from migrasi_peta m
   using menggantung g
   where m.kelompok = g.kelompok and m.id_lama = g.id_lama;

  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end;
$$;
