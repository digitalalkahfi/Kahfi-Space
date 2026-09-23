-- =====================================================================
-- K-Space V2 — CO sampel harian (PRD Fase 1)
--
-- Angka CO sampel di form laporan tidak pernah diketik: ia dihitung dari
-- pemindaian QR sampel yang sudah tercatat. Karena itu fungsinya bukan
-- `security definer` — pemindaian yang tidak boleh dilihat pengguna juga
-- tidak boleh ikut terhitung di layarnya.
--
-- Harinya dipotong menurut Asia/Jakarta, sama seperti tenggat tugas dan
-- batas absen masuk: pemindaian pukul 22.00 WIB milik hari itu, bukan
-- hari berikutnya menurut UTC.
-- =====================================================================

create or replace function co_sampel_akun(p_tanggal date)
returns table (account_id uuid, jumlah integer)
language sql
stable
set search_path = public
as $$
  select s.account_id, count(*)::int
  from sample_scans sc
  join samples s on s.id = sc.sample_id
  where sc.dikenali
    and s.account_id is not null
    and (sc.pada at time zone 'Asia/Jakarta')::date = p_tanggal
  group by s.account_id;
$$;

comment on function co_sampel_akun(date) is
  'Jumlah pemindaian sampel per akun pada satu tanggal; dasar CO sampel di laporan harian.';
