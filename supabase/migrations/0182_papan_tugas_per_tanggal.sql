-- =====================================================================
-- K-Space V2 — Papan tugas per tanggal (keputusan D4)
--
-- Halaman Tugas sebelumnya menarik SEMUA tugas sepanjang masa —
-- termasuk yang sudah selesai — dibatasi 200 baris tanpa urutan yang
-- berarti. Bagi CEO/Manager yang melihat seluruh organisasi, tugas di
-- atas baris ke-200 hilang tanpa tanda. `daftar_tugas`/`hitung_tugas`
-- (0020) sudah ada tetapi tidak dipakai.
--
-- Migrasi ini:
--   1. `papan_tugas(tanggal, hari_ini)` — isi papan satu tanggal,
--      disaring di basis data;
--   2. `daftar_tugas` & `hitung_tugas` — to-do pribadi hanya milik
--      sendiri, plus kolom yang dibutuhkan tampilan (tanpa_jam, total).
--
-- Ketiganya SECURITY INVOKER (bawaan fungsi SQL): RLS `tasks_baca` tetap
-- menentukan tiket siapa yang terlihat — fungsi ini hanya menyaring
-- tanggal, tidak pernah memperluas cakupan.
--
-- To-do pribadi selalu milik sendiri di sini, termasuk bagi CEO/Manager
-- yang secara RLS boleh membacanya: to-do adalah catatan kerja pribadi
-- ("Hanya kamu yang melihatnya" di form to-do), dan pemiliknya
-- dibandingkan lewat id — bukan nama, yang bisa kembar.
--
-- Batasnya aman dan TIDAK diam-diam: setiap baris membawa `total`
-- (jumlah yang cocok sebelum dibatasi), sehingga layar bisa berkata
-- "Menampilkan N tugas pertama".
--
-- Aman dijalankan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Isi papan satu tanggal
-- ---------------------------------------------------------------------
create or replace function papan_tugas(
  p_tanggal  date,
  p_hari_ini date,
  p_batas    int default 300
)
returns table (
  id           uuid,
  tipe         tipe_tugas,
  judul        text,
  deskripsi    text,
  konteks      text,
  tenggat      timestamptz,
  tanpa_jam    boolean,
  kelompok     kelompok_tenggat,
  prioritas    prioritas_tugas,
  status       status_tugas,
  qc_status    status_qc,
  qc_note      text,
  hasil_kerja  text,
  penerima_id  uuid,
  pembuat_id   uuid,
  penerima     text,
  pembuat      text,
  goal_id      uuid,
  goal_judul   text,
  goal_periode text,
  selesai_at   timestamptz,
  created_at   timestamptz,
  total        bigint
)
language sql
stable
as $$
  with hari as (
    -- Batas hari dalam WIB; dibandingkan sebagai rentang supaya indeks
    -- `tenggat` tetap terpakai.
    select (p_tanggal::timestamp at time zone 'Asia/Jakarta')       as awal,
           ((p_tanggal + 1)::timestamp at time zone 'Asia/Jakarta') as akhir
  ),
  cocok as (
    select t.*
      from tasks t
     cross join hari h
     where t.status <> 'dibatalkan'
       and (t.tipe <> 'pribadi' or t.penerima_id = auth.uid())
       and (
         -- To Do / Dikerjakan / Review: tenggatnya jatuh di tanggal itu.
         (t.status <> 'selesai' and t.tenggat >= h.awal and t.tenggat < h.akhir)
         -- Selesai: diselesaikan pada tanggal itu.
         or (t.status = 'selesai'
             and t.selesai_at >= h.awal and t.selesai_at < h.akhir)
         -- Hari ini saja: yang terlambat & tiket lama tanpa tenggat.
         or (p_tanggal = p_hari_ini
             and t.status <> 'selesai'
             and kelompok_tenggat_dari(t.tenggat, p_hari_ini)
                   in ('terlambat', 'tanpa_tenggat'))
       )
  )
  select
    c.id, c.tipe, c.judul, c.deskripsi, c.konteks, c.tenggat, c.tanpa_jam,
    kelompok_tenggat_dari(c.tenggat, p_hari_ini),
    c.prioritas, c.status, c.qc_status, c.qc_note, c.hasil_kerja,
    c.penerima_id, c.pembuat_id, pn.nama, pb.nama,
    c.goal_id, g.judul, g.periode, c.selesai_at, c.created_at,
    count(*) over ()
  from cocok c
  left join users pn on pn.id = c.penerima_id
  left join users pb on pb.id = c.pembuat_id
  left join goals g on g.id = c.goal_id
  order by
    -- Bila batas tercapai, yang terpotong lebih dulu adalah yang sudah
    -- selesai, lalu yang paling tidak mendesak.
    (c.status = 'selesai'),
    (kelompok_tenggat_dari(c.tenggat, p_hari_ini) = 'terlambat') desc,
    case c.prioritas when 'tinggi' then 0 when 'sedang' then 1 else 2 end,
    c.tenggat nulls last,
    c.created_at
  limit greatest(1, least(coalesce(p_batas, 300), 500));
$$;

comment on function papan_tugas(date, date, int) is
  'Isi papan Kanban satu tanggal (WIB); to-do hanya milik sendiri; kolom total untuk pesan batas (0182).';

-- ---------------------------------------------------------------------
-- 2. Daftar bertenggat: to-do hanya milik sendiri, tanpa yang selesai
--    (kecuali diminta), dan membawa total sebelum dibatasi.
--
--    Bentuk keluarannya bertambah kolom, jadi fungsinya dibuat ulang.
-- ---------------------------------------------------------------------
drop function if exists daftar_tugas(date, text, int);

create function daftar_tugas(
  p_acuan    date,
  p_saringan text default 'semua',
  p_batas    int default 300
)
returns table (
  id           uuid,
  tipe         tipe_tugas,
  judul        text,
  deskripsi    text,
  konteks      text,
  tenggat      timestamptz,
  tanpa_jam    boolean,
  kelompok     kelompok_tenggat,
  prioritas    prioritas_tugas,
  status       status_tugas,
  qc_status    status_qc,
  qc_note      text,
  hasil_kerja  text,
  penerima_id  uuid,
  pembuat_id   uuid,
  penerima     text,
  pembuat      text,
  goal_id      uuid,
  goal_judul   text,
  goal_periode text,
  selesai_at   timestamptz,
  created_at   timestamptz,
  total        bigint
)
language sql
stable
as $$
  select
    t.id, t.tipe, t.judul, t.deskripsi, t.konteks, t.tenggat, t.tanpa_jam,
    kelompok_tenggat_dari(t.tenggat, p_acuan),
    t.prioritas, t.status, t.qc_status, t.qc_note, t.hasil_kerja,
    t.penerima_id, t.pembuat_id, pn.nama, pb.nama,
    t.goal_id, g.judul, g.periode, t.selesai_at, t.created_at,
    count(*) over ()
  from tasks t
  left join users pn on pn.id = t.penerima_id
  left join users pb on pb.id = t.pembuat_id
  left join goals g on g.id = t.goal_id
  where t.status <> 'dibatalkan'
    and (t.tipe <> 'pribadi' or t.penerima_id = auth.uid())
    and case p_saringan
      when 'saya'     then t.tipe = 'pribadi' and t.status <> 'selesai'
      when 'tiket'    then t.tipe = 'tiket' and t.status <> 'selesai'
      when 'komitmen' then t.tipe = 'komitmen_mingguan' and t.status <> 'selesai'
      when 'qc'       then t.status = 'menunggu_qc'
      when 'selesai'  then t.status = 'selesai'
      else t.status <> 'selesai'
    end
  order by
    -- Yang lewat tenggat naik paling atas, lalu prioritas, lalu tenggat.
    (kelompok_tenggat_dari(t.tenggat, p_acuan) = 'terlambat') desc,
    case t.prioritas when 'tinggi' then 0 when 'sedang' then 1 else 2 end,
    t.tenggat nulls last,
    t.created_at
  limit greatest(1, least(coalesce(p_batas, 300), 500));
$$;

comment on function daftar_tugas(date, text, int) is
  'Daftar tugas tersaring & terurut; to-do hanya milik sendiri; kolom total untuk pesan batas (0020, 0182).';

-- ---------------------------------------------------------------------
-- 3. Lencana hitungan: cakupan yang sama dengan daftarnya.
-- ---------------------------------------------------------------------
create or replace function hitung_tugas(p_acuan date)
returns table (
  semua     int,
  saya      int,
  tiket     int,
  komitmen  int,
  qc        int,
  selesai   int,
  terlambat int
)
language sql
stable
as $$
  select
    count(*) filter (where status not in ('selesai', 'dibatalkan'))::int,
    count(*) filter (where tipe = 'pribadi' and status not in ('selesai','dibatalkan'))::int,
    count(*) filter (where tipe = 'tiket' and status not in ('selesai','dibatalkan'))::int,
    count(*) filter (where tipe = 'komitmen_mingguan' and status not in ('selesai','dibatalkan'))::int,
    count(*) filter (where status = 'menunggu_qc')::int,
    count(*) filter (where status = 'selesai')::int,
    count(*) filter (
      where status not in ('selesai', 'dibatalkan')
        and kelompok_tenggat_dari(tenggat, p_acuan) = 'terlambat'
    )::int
  from tasks
  where tipe <> 'pribadi' or penerima_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 4. Indeks untuk kolom Selesai per tanggal.
-- ---------------------------------------------------------------------
create index if not exists tasks_selesai_at_idx
  on tasks (selesai_at) where status = 'selesai';

-- ---------------------------------------------------------------------
-- Rollback (manual):
--   drop index if exists tasks_selesai_at_idx;
--   drop function if exists papan_tugas(date, date, int);
--   lalu jalankan ulang definisi `daftar_tugas` dan `hitung_tugas` dari
--   0020_tugas_tenggat.sql (didahului
--   `drop function if exists daftar_tugas(date, text, int);`).
-- ---------------------------------------------------------------------
