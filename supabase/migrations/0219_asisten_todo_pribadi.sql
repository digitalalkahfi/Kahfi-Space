-- =====================================================================
-- K-Space V2 — Asisten Manager: to-do pribadi orang lain tidak ikut
--
-- `asisten.tugas_telat` (0217) membaca seluruh organisasi, termasuk
-- to-do pribadi setiap orang. Halaman Tugas TIDAK menampilkan to-do
-- pribadi orang lain kepada siapa pun, termasuk Manager: saringannya
-- `tipe <> 'pribadi' or penerima_id = <saya>` (src/lib/data/tugas.ts).
-- Akibatnya Asisten Manager melihat lebih banyak daripada Manager di
-- aplikasi (12 Nov 2026: 13 to-do lewat tenggat vs 6 di halaman Tugas).
--
-- Perbaikan: to-do pribadi hanya ikut bila penerimanya ber-role
-- Manager — pemilik asisten ini. Tiket dan komitmen tidak berubah.
-- Selain satu syarat itu, isi fungsi sama persis dengan 0217.
--
-- Aman dijalankan ulang. Rollback: jalankan lagi definisi fungsi ini
-- dari 0217_asisten_baca.sql.
-- =====================================================================

create or replace function asisten.tugas_telat(p_waktu timestamptz)
returns table (
  penerima    text,
  role        peran_pengguna,
  unit        text,
  leader      text,
  pembuat     text,
  tipe        text,
  judul       text,
  tenggat_wib text,
  hari_telat  integer,
  status      status_tugas,
  kelompok    text
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive naik as (
    select u.id as asal, u.atasan_id as atas, 1 as langkah
    from users u
    union all
    select n.asal, x.atasan_id, n.langkah + 1
    from naik n
    join users x on x.id = n.atas
    where x.role <> 'Leader' and n.langkah < 10
  ),
  leader as (
    select distinct on (n.asal) n.asal, l.nama
    from naik n
    join users l on l.id = n.atas and l.role = 'Leader'
    order by n.asal, n.langkah
  )
  select
    pe.nama,
    pe.role,
    coalesce(split_part(un.nama, ' (', 1), 'Manajemen'),
    case when pe.role = 'Leader' then pe.nama
         else coalesce(ld.nama, 'Tanpa Leader') end,
    pb.nama,
    case t.tipe when 'pribadi' then 'To-do'
                when 'tiket' then 'Tiket'
                else 'Komitmen' end,
    t.judul,
    to_char(t.tenggat at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI'),
    ((p_waktu at time zone 'Asia/Jakarta')::date
      - (t.tenggat at time zone 'Asia/Jakarta')::date)::int,
    t.status,
    case when t.status = 'menunggu_qc' then 'menunggu_qc' else 'telat' end
  from tasks t
  join users pe on pe.id = t.penerima_id
  join users pb on pb.id = t.pembuat_id
  left join units un on un.id = pe.unit_id
  left join leader ld on ld.asal = pe.id
  where t.tenggat is not null
    and t.tenggat < p_waktu
    and t.status in ('todo', 'berjalan', 'revisi', 'menunggu_qc')
    and pe.status = 'aktif'
    -- To-do pribadi hanya milik Manager sendiri. Halaman Tugas memakai
    -- aturan yang sama: `tipe <> 'pribadi' or penerima = saya`.
    and (t.tipe <> 'pribadi' or pe.role = 'Manager')
  order by t.tenggat;
$$;

comment on function asisten.tugas_telat(timestamptz) is
  'Tugas bertenggat < p_waktu yang belum selesai. To-do pribadi hanya milik Manager (0219). kelompok: telat (todo/berjalan/revisi) atau menunggu_qc (dipisah).';

-- `create or replace` mempertahankan hak yang ada; dinyatakan lagi
-- supaya berkas ini berdiri sendiri.
revoke all on function asisten.tugas_telat(timestamptz) from public;
grant execute on function asisten.tugas_telat(timestamptz) to asisten_baca;
