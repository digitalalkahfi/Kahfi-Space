-- =====================================================================
-- K-Space V2 — Penanda "kemungkinan PIC cadangan" lebih teliti (0203)
--
-- Laporan `buat_tiket_grd` (0201) menandai tonggak yang kolom SIAPA-nya
-- tidak tampak pada nama PIC-nya, supaya PIC cadangan (pemilik goal atau
-- Manager, diisi impor saat nama di file tidak terdaftar — mis. "Santri")
-- ikut diperiksa. Pencocokannya terlalu longgar untuk data asli: nama
-- pengguna di K-Space sering berupa nama akun ("fajarn632",
-- "almailminafiatin", "Muhammad Ardiansyah"), sehingga "Fajar", "Alma",
-- dan "Ardi" tidak pernah cocok sebagai kata utuh dan hampir semua tiket
-- ditandai.
--
-- Kini cocok bila SALAH SATU kata pada nama PIC dan SALAH SATU kata pada
-- kolom SIAPA saling mengawali (min. 3 huruf): "Alma" ~ "almailminafiatin",
-- "Ardi" ~ "Ardiansyah", "Rifal" ~ "M. Rifal Fauziansyah". Hanya penanda
-- pada laporan yang berubah; siapa yang dibuatkan tiket tidak.
--
-- `create or replace` dengan tanda tangan yang sama; isi lain sama persis
-- dengan 0201. Aman dijalankan ulang.
-- =====================================================================

create or replace function calon_tiket_grd(p_periode date)
returns table (
  tonggak_id     uuid,
  kode           text,
  urutan_rencana smallint,
  urutan_tonggak smallint,
  tonggak_judul  text,
  penerima_id    uuid,
  penerima_nama  text,
  pembuat_id     uuid,
  pembuat_nama   text,
  goal_id        uuid,
  judul          text,
  deskripsi      text,
  konteks        text,
  kriteria       text,
  tenggat        timestamptz,
  status         status_tugas,
  alasan         text,
  catatan        text
)
language sql
stable
security definer
set search_path = public
as $$
  with dasar as (
    select
      t.id as tonggak_id, t.judul as t_judul, t.tenggat as t_tenggat,
      t.status as t_status, t.urutan as t_urutan,
      r.kode, r.judul as r_judul, r.goal_id, r.pic_ids, r.pic_teks,
      r.jadwal_teks, r.urutan as r_urutan,
      r.pic_ids[1] as pic_utama,
      g.kode as goal_kode, g.judul as goal_judul
    from grd_tonggak t
    join grd_rencana r on r.id = t.rencana_id
    left join goals g on g.id = r.goal_id
    where r.grd_periode = p_periode
      and r.jenis in ('sekali', 'pekanan')
  ),
  orang as (
    select
      d.*,
      u.id as p_id, u.nama as p_nama, u.status as p_status,
      -- Pemberi: atasan langsung yang aktif → Manager → CEO → penerima.
      coalesce(
        (select a.id from users a
          where a.id = u.atasan_id and a.status = 'aktif'),
        (select m.id from users m
          where m.role = 'Manager' and m.status = 'aktif' and m.id <> u.id
          order by m.created_at, m.id limit 1),
        (select c.id from users c
          where c.role = 'CEO' and c.status = 'aktif' and c.id <> u.id
          order by c.created_at, c.id limit 1),
        u.id
      ) as b_id,
      k.id as tiket_id,
      k.penerima_id as tiket_penerima
    from dasar d
    left join users u on u.id = d.pic_utama
    left join tasks k on k.tonggak_id = d.tonggak_id
  ),
  rakit as (
    select
      o.*,
      b.nama as b_nama,
      judul_tiket_grd(o.kode, o.r_judul, o.t_judul) as judul_tiket
    from orang o
    left join users b on b.id = o.b_id
  )
  select
    x.tonggak_id,
    x.kode,
    x.r_urutan,
    x.t_urutan,
    x.t_judul,
    x.p_id,
    x.p_nama,
    x.b_id,
    x.b_nama,
    x.goal_id,
    x.judul_tiket,
    concat_ws(E'\n',
      format('Dibuat otomatis dari rencana operasional GRD %s. Status tonggaknya mengikuti tiket ini.',
             bulan_indonesia(p_periode, true)),
      format('Rencana %s: %s', x.kode, x.r_judul),
      case when x.goal_kode is not null
           then format('Goal %s: %s', x.goal_kode, x.goal_judul) end,
      case when nullif(btrim(x.jadwal_teks), '') is not null
           then 'Jadwal: ' || x.jadwal_teks end,
      case when nullif(btrim(x.t_judul), '') is not null
                and x.t_judul <> x.r_judul
           then 'Tonggak: ' || x.t_judul end,
      (select 'PIC lain: ' || string_agg(y.nama, ', ' order by array_position(x.pic_ids, y.id))
         from users y
        where y.id = any (x.pic_ids) and y.id <> x.pic_utama
       having count(*) > 0),
      case when nullif(btrim(x.pic_teks), '') is not null
           then 'Penanggung jawab di file GRD: ' || x.pic_teks end
    ),
    format('GRD %s · %s', bulan_indonesia(p_periode), x.kode),
    format('"%s" selesai dan hasilnya bisa ditunjukkan ke pemeriksa. Diajukan paling lambat %s pukul 17.00 WIB.',
           substr(x.judul_tiket, length(x.kode || ' · ') + 1),
           case when x.t_tenggat is not null
                then tanggal_indonesia(x.t_tenggat) else '-' end),
    ((x.t_tenggat + time '17:00') at time zone 'Asia/Jakarta'),
    case x.t_status when 'progress' then 'berjalan'::status_tugas
                    else 'todo'::status_tugas end,
    case
      when periode_grd_terkunci(p_periode) then 'bulan_terkunci'
      when x.tiket_id is not null then 'sudah_punya_tiket'
      when x.t_status = 'selesai' then 'sudah_selesai'
      when x.t_tenggat is null then 'tanpa_tenggat'
      when x.p_id is null then 'tanpa_pic'
      when x.p_status <> 'aktif' then 'penerima_nonaktif'
    end,
    nullif(concat_ws('; ',
      case when x.p_id is not null and x.b_id = x.p_id
           then 'Pemberi sama dengan penerima (tidak ada atasan, Manager, atau CEO aktif lain)' end,
      case when x.tiket_id is not null and x.p_id is not null
                and x.tiket_penerima is distinct from x.p_id
           then 'PIC rencana berbeda dari penerima tiket yang sudah ada; tiket tidak dipindahkan' end,
      case when x.p_id is not null
                and nullif(btrim(x.pic_teks), '') is not null
                and not exists (
                  select 1
                  from users z,
                       regexp_split_to_table(lower(z.nama), '[^a-z0-9]+') w,
                       regexp_split_to_table(lower(x.pic_teks), '[^a-z0-9]+') t
                  where z.id = any (x.pic_ids)
                    and length(w) >= 3
                    and length(t) >= 3
                    and (w like t || '%' or t like w || '%')
                )
           then format('Kolom SIAPA ("%s") tidak tampak pada nama PIC; kemungkinan PIC cadangan (pemilik goal/Manager)',
                       x.pic_teks) end
    ), '')
  from rakit x;
$$;

comment on function calon_tiket_grd(date) is
  'Satu baris per tonggak SEKALI/PEKANAN: isi tiket bila akan dibuat, alasan bila dilewati (0201, 0203).';

revoke execute on function calon_tiket_grd(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Rollback (manual): jalankan ulang calon_tiket_grd dari 0201.
-- ---------------------------------------------------------------------
