-- =====================================================================
-- K-Space V2 — Tonggak GRD menjadi tiket: tampilan (4 dari 4)
--
-- Papan dan daftar Tugas membawa `tonggak_id` supaya kartunya tahu bahwa
-- ia tiket dari rencana GRD (tenggatnya hanya diubah CEO/Manager, tidak
-- bisa dihapus). Halaman Rencana operasional membawa `punya_tiket` dan
-- `tiket_id` per tonggak supaya chip-nya menampilkan status tiket dan
-- tautan "Buka tiket", bukan pilihan ubah status (aturan 7).
--
-- `papan_tugas` dan `daftar_tugas` dibuat ulang (kolom keluarannya
-- bertambah) dengan isi sama persis dengan 0183; `rencana_grd` sama
-- dengan 0192 kecuali dua kunci baru di JSON tonggaknya.
--
-- Aman dijalankan ulang.
-- =====================================================================

drop function if exists papan_tugas(date, date, int);

create function papan_tugas(
  p_tanggal  date,
  p_hari_ini date,
  p_batas    int default 300
)
returns table (
  id               uuid,
  tipe             tipe_tugas,
  judul            text,
  deskripsi        text,
  konteks          text,
  kriteria_selesai text,
  target_angka     numeric,
  target_satuan    text,
  tenggat          timestamptz,
  tanpa_jam        boolean,
  kelompok         kelompok_tenggat,
  prioritas        prioritas_tugas,
  status           status_tugas,
  qc_status        status_qc,
  qc_note          text,
  hasil_kerja      text,
  penerima_id      uuid,
  pembuat_id       uuid,
  penerima         text,
  pembuat          text,
  goal_id          uuid,
  goal_judul       text,
  goal_periode     text,
  tonggak_id       uuid,
  selesai_at       timestamptz,
  created_at       timestamptz,
  total            bigint
)
language sql
stable
as $$
  with hari as (
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
         (t.status <> 'selesai' and t.tenggat >= h.awal and t.tenggat < h.akhir)
         or (t.status = 'selesai'
             and t.selesai_at >= h.awal and t.selesai_at < h.akhir)
         or (p_tanggal = p_hari_ini
             and t.status <> 'selesai'
             and kelompok_tenggat_dari(t.tenggat, p_hari_ini)
                   in ('terlambat', 'tanpa_tenggat'))
       )
  )
  select
    c.id, c.tipe, c.judul, c.deskripsi, c.konteks,
    c.kriteria_selesai, c.target_angka, c.target_satuan,
    c.tenggat, c.tanpa_jam,
    kelompok_tenggat_dari(c.tenggat, p_hari_ini),
    c.prioritas, c.status, c.qc_status, c.qc_note, c.hasil_kerja,
    c.penerima_id, c.pembuat_id, pn.nama, pb.nama,
    c.goal_id, g.judul, g.periode, c.tonggak_id, c.selesai_at, c.created_at,
    count(*) over ()
  from cocok c
  left join users pn on pn.id = c.penerima_id
  left join users pb on pb.id = c.pembuat_id
  left join goals g on g.id = c.goal_id
  order by
    (c.status = 'selesai'),
    (kelompok_tenggat_dari(c.tenggat, p_hari_ini) = 'terlambat') desc,
    case c.prioritas when 'tinggi' then 0 when 'sedang' then 1 else 2 end,
    c.tenggat nulls last,
    c.created_at
  limit greatest(1, least(coalesce(p_batas, 300), 500));
$$;

comment on function papan_tugas(date, date, int) is
  'Isi papan Kanban satu tanggal (WIB); to-do hanya milik sendiri; kolom total untuk pesan batas (0182, 0183, 0202).';

drop function if exists daftar_tugas(date, text, int);

create function daftar_tugas(
  p_acuan    date,
  p_saringan text default 'semua',
  p_batas    int default 300
)
returns table (
  id               uuid,
  tipe             tipe_tugas,
  judul            text,
  deskripsi        text,
  konteks          text,
  kriteria_selesai text,
  target_angka     numeric,
  target_satuan    text,
  tenggat          timestamptz,
  tanpa_jam        boolean,
  kelompok         kelompok_tenggat,
  prioritas        prioritas_tugas,
  status           status_tugas,
  qc_status        status_qc,
  qc_note          text,
  hasil_kerja      text,
  penerima_id      uuid,
  pembuat_id       uuid,
  penerima         text,
  pembuat          text,
  goal_id          uuid,
  goal_judul       text,
  goal_periode     text,
  tonggak_id       uuid,
  selesai_at       timestamptz,
  created_at       timestamptz,
  total            bigint
)
language sql
stable
as $$
  select
    t.id, t.tipe, t.judul, t.deskripsi, t.konteks,
    t.kriteria_selesai, t.target_angka, t.target_satuan,
    t.tenggat, t.tanpa_jam,
    kelompok_tenggat_dari(t.tenggat, p_acuan),
    t.prioritas, t.status, t.qc_status, t.qc_note, t.hasil_kerja,
    t.penerima_id, t.pembuat_id, pn.nama, pb.nama,
    t.goal_id, g.judul, g.periode, t.tonggak_id, t.selesai_at, t.created_at,
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
    (kelompok_tenggat_dari(t.tenggat, p_acuan) = 'terlambat') desc,
    case t.prioritas when 'tinggi' then 0 when 'sedang' then 1 else 2 end,
    t.tenggat nulls last,
    t.created_at
  limit greatest(1, least(coalesce(p_batas, 300), 500));
$$;

comment on function daftar_tugas(date, text, int) is
  'Daftar tugas tersaring & terurut; to-do hanya milik sendiri; kolom total untuk pesan batas (0020, 0182, 0183, 0202).';

create or replace function rencana_grd(p_periode date)
returns table (
  rencana_id    uuid,
  kode          text,
  goal_kode     text,
  goal_judul    text,
  induk_kode    text,
  judul         text,
  jenis         text,
  pic_teks      text,
  pic_nama      text[],
  jadwal_teks   text,
  urutan        smallint,
  boleh_centang boolean,
  tonggak       jsonb
)
language sql
stable
as $$
  select
    r.id, r.kode, g.kode, g.judul, r.induk_kode, r.judul, r.jenis,
    r.pic_teks,
    coalesce((
      select array_agg(u.nama order by array_position(r.pic_ids, u.id))
      from users u where u.id = any (r.pic_ids)
    ), '{}'),
    r.jadwal_teks, r.urutan,
    boleh_centang_tonggak(r.id),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'kunci', t.kunci,
        'judul', t.judul,
        'tenggat', t.tenggat,
        'status', t.status,
        'selesai_pada', t.selesai_pada,
        'catatan', t.catatan,
        -- 0202: tonggak yang punya tiket hanya mengikuti tiketnya.
        -- `tiket_id` hanya terisi bila pemanggil boleh melihat tiketnya
        -- (RLS tasks); `punya_tiket` terisi untuk semua yang melihat
        -- tonggaknya.
        'punya_tiket', tonggak_punya_tiket(t.id),
        'tiket_id', (select k.id from tasks k
                     where k.tonggak_id = t.id and k.status <> 'dibatalkan')
      ) order by t.urutan, t.tenggat)
      from grd_tonggak t where t.rencana_id = r.id
    ), '[]'::jsonb)
  from grd_rencana r
  left join goals g on g.id = r.goal_id
  where r.grd_periode = p_periode
  order by r.urutan, r.kode;
$$;

comment on function rencana_grd(date) is
  'Rencana operasional satu periode GRD beserta tonggak dan hak centang pemanggil (0192, 0202).';

-- ---------------------------------------------------------------------
-- Rollback (manual): jalankan ulang papan_tugas & daftar_tugas dari 0183
-- (didahului drop function if exists untuk keduanya) dan rencana_grd dari
-- 0192.
-- ---------------------------------------------------------------------
