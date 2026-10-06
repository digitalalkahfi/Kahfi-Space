-- =====================================================================
-- K-Space V2 — Pemberi boleh menghapus tiket selesai dan tiket GRD (0206)
--
-- Dua larangan lama dilonggarkan, masing-masing dengan pengamannya:
--
-- 1. TIKET SELESAI (0184). Dilarang demi nilai KPI dan riwayat kerja
--    penerimanya. Kini PEMBERINYA boleh menghapusnya — selama tiket itu
--    tidak ikut KPI bulan yang sudah dikunci (nilai terkunci tidak
--    disentuh). CEO/Manager yang bukan pemberi tetap tidak bisa; penerima
--    dan jejak QC-nya ikut terhapus, dan penerima dikabari dengan kalimat
--    yang pantas untuk pekerjaan yang sudah beres (bukan "tidak perlu
--    mengerjakannya lagi").
--
-- 2. TIKET GRD (0200). Dilarang karena impor berikutnya akan membuatnya
--    lagi. Kini CEO/Manager yang menjadi pemberinya boleh menghapusnya,
--    dengan pengaman:
--      · tonggaknya DITANDAI `tanpa_tiket` sehingga pembuat tiket
--        (`buat_tiket_grd`, impor) tidak membuatnya lagi dan melaporkannya
--        sebagai "tiket_dihapus";
--      · tonggaknya kembali dikelola manual (status tidak lagi mengikuti
--        tiket) dan tetap memegang status/waktu selesai terakhirnya;
--      · pemberi biasa (Leader) tidak bisa — menghapus tiket GRD berarti
--        melepas tonggak dari pantauan tiket/QC, keputusan CEO/Manager;
--      · bulan GRD yang KPI-nya sudah dikunci tidak disentuh.
--    `pulihkan_tiket_grd(tonggak)` membatalkan penanda bila tiketnya mau
--    dibuat lagi (lalu jalankan `npm run grd:tiket`).
--
-- Aman dijalankan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Penanda di tonggak
-- ---------------------------------------------------------------------
alter table grd_tonggak
  add column if not exists tanpa_tiket boolean not null default false;

comment on column grd_tonggak.tanpa_tiket is
  'Tiketnya sengaja dihapus pemberinya: tidak dibuatkan tiket lagi dan dikelola manual (0206).';

-- ---------------------------------------------------------------------
-- 2. Penjaga hapus: isi 0200 + dua pelonggaran di atas
-- ---------------------------------------------------------------------
create or replace function jaga_hapus_tugas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periode date;
  v_bulan   date;
begin
  -- Proses sistem (perbaikan data oleh admin) tetap boleh; to-do dijaga RLS
  -- (hanya pemiliknya).
  if auth.uid() is null or old.tipe = 'pribadi' then
    return old;
  end if;

  -- Tiket dari rencana GRD: CEO/Manager yang menjadi pemberinya.
  if old.tonggak_id is not null then
    if auth.uid() is distinct from old.pembuat_id or not lintas_unit() then
      raise exception 'Tiket dari rencana GRD hanya bisa dihapus oleh CEO atau Manager yang menjadi pemberinya'
        using errcode = 'insufficient_privilege';
    end if;

    select r.grd_periode into v_periode
    from grd_tonggak t join grd_rencana r on r.id = t.rencana_id
    where t.id = old.tonggak_id;

    if v_periode is not null and periode_grd_terkunci(v_periode) then
      raise exception 'KPI % sudah dikunci; tiket GRD-nya tidak bisa dihapus lagi',
        to_char(v_periode, 'Mon YYYY')
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- Tiket yang sudah selesai: hanya pemberinya, dan hanya bila bulannya
  -- belum dikunci KPI-nya (sama dengan bulan yang dipakai `realisasi_kpi`).
  if old.status = 'selesai' then
    if auth.uid() is distinct from old.pembuat_id then
      raise exception 'Tiket yang sudah selesai hanya bisa dihapus oleh pemberinya'
        using errcode = 'insufficient_privilege';
    end if;

    v_bulan := date_trunc(
      'month',
      coalesce(old.tenggat, old.created_at) at time zone 'Asia/Jakarta'
    )::date;
    if kpi_terkunci(old.penerima_id, v_bulan) then
      raise exception 'Tiket ini sudah dihitung di KPI bulan yang dikunci; tidak bisa dihapus lagi'
        using errcode = 'check_violation';
    end if;
  end if;

  return old;
end;
$$;

comment on function jaga_hapus_tugas() is
  'Tiket selesai hanya dihapus pemberinya (bulan KPI belum dikunci); tiket GRD hanya CEO/Manager pemberinya; sistem bebas (0184, 0200, 0206).';

-- ---------------------------------------------------------------------
-- 3. Tiket GRD dihapus pengguna → tonggaknya tidak dibuatkan tiket lagi
--
-- Hanya untuk penghapusan oleh pengguna: perbaikan data oleh sistem (mis.
-- tes, migrasi) tidak menandai apa pun.
-- ---------------------------------------------------------------------
create or replace function tandai_tonggak_tanpa_tiket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and old.tonggak_id is not null then
    update grd_tonggak set tanpa_tiket = true where id = old.tonggak_id;
  end if;
  return old;
end;
$$;

drop trigger if exists tasks_tandai_tonggak_tanpa_tiket on tasks;
create trigger tasks_tandai_tonggak_tanpa_tiket
  after delete on tasks
  for each row
  when (old.tonggak_id is not null)
  execute function tandai_tonggak_tanpa_tiket();

-- Membatalkan penanda: tonggaknya akan dibuatkan tiket lagi pada pembuatan
-- tiket berikutnya (`buat_tiket_grd`, impor). CEO/Manager atau sistem.
create or replace function pulihkan_tiket_grd(p_tonggak uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (pemanggil_sistem() or lintas_unit()) then
    raise exception 'Hanya CEO, Manager, atau proses sistem yang boleh memulihkan tiket GRD'
      using errcode = 'insufficient_privilege';
  end if;
  update grd_tonggak set tanpa_tiket = false where id = p_tonggak;
end;
$$;

comment on function pulihkan_tiket_grd(uuid) is
  'Tonggak yang tiketnya pernah dihapus dibuatkan tiket lagi pada pembuatan berikutnya (0206).';

revoke execute on function pulihkan_tiket_grd(uuid) from public, anon;

-- ---------------------------------------------------------------------
-- 4. Kabar ke penerima: kalimat yang pantas untuk tiket yang sudah beres
--    (isi lain sama dengan 0184)
-- ---------------------------------------------------------------------
create or replace function notifikasi_tiket_dihapus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nama  text;
  v_jenis text;
begin
  if old.tipe = 'pribadi'
     or old.status = 'dibatalkan'
     or auth.uid() is null
     or old.penerima_id is not distinct from auth.uid() then
    return old;
  end if;

  v_jenis := case old.tipe when 'komitmen_mingguan' then 'Komitmen' else 'Tiket' end;
  select u.nama into v_nama from users u where u.id = auth.uid();

  if old.status = 'selesai' then
    perform terbitkan_notifikasi(
      old.penerima_id,
      'tugas',
      format('%s selesai dihapus: %s', v_jenis, old.judul),
      format('%s menghapus %s yang sudah kamu selesaikan. Riwayatnya tidak lagi tercatat.',
             coalesce(v_nama, 'Pemberi tiket'), lower(v_jenis)),
      '/tugas'
    );
  else
    perform terbitkan_notifikasi(
      old.penerima_id,
      'tugas',
      format('%s dihapus: %s', v_jenis, old.judul),
      format('%s menghapusnya. Kamu tidak perlu mengerjakannya lagi.',
             coalesce(v_nama, 'Pemberi tiket')),
      '/tugas'
    );
  end if;
  return old;
exception
  when others then
    raise warning 'notifikasi_tiket_dihapus gagal untuk %: %', old.id, sqlerrm;
    return old;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Pembuat tiket melewati tonggak yang tiketnya sengaja dihapus
--    (isi 0204 + satu alasan baru: tiket_dihapus)
-- ---------------------------------------------------------------------
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
      t.status as t_status, t.urutan as t_urutan, t.tanpa_tiket as t_tanpa_tiket,
      r.kode, r.judul as r_judul, r.jenis, r.goal_id, r.pic_ids, r.pic_teks,
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
      judul_tiket_grd(o.kode, o.r_judul, o.t_judul) as judul_tiket,
      -- Bagian judul rencana sesudah "kepala"-nya (lihat pisah_judul_grd).
      (pisah_judul_grd(o.r_judul, tahap_grd(o.r_judul, o.t_judul)))[2] as rincian,
      -- PIC tak berhubungan sama sekali dengan tulisan di kolom SIAPA:
      -- kemungkinan PIC cadangan (0203).
      (o.p_id is not null
       and nullif(btrim(o.pic_teks), '') is not null
       and not exists (
         select 1
         from users z,
              regexp_split_to_table(lower(z.nama), '[^a-z0-9]+') w,
              regexp_split_to_table(lower(o.pic_teks), '[^a-z0-9]+') t
         where z.id = any (o.pic_ids)
           and length(w) >= 3
           and length(t) >= 3
           and (w like t || '%' or t like w || '%')
       )) as cadangan
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
    -- Deskripsi: pendek dan hanya yang belum ada di tempat lain di kartu
    -- (judul, penerima, goal, dan tenggat sudah tampil sendiri).
    concat_ws(E'\n',
      case when x.rincian is not null then 'Rincian: ' || x.rincian end,
      case when x.jenis = 'pekanan'
                and nullif(btrim(x.jadwal_teks), '') is not null
           then 'Rutin: ' || x.jadwal_teks end,
      (select 'Dibantu: ' || string_agg(y.nama, ', ' order by array_position(x.pic_ids, y.id))
         from users y
        where y.id = any (x.pic_ids) and y.id <> x.pic_utama
       having count(*) > 0),
      format('Asal: rencana GRD %s (%s).', x.kode, bulan_indonesia(p_periode, true)),
      case when x.cadangan
           then format('Catatan: di file GRD tertulis "%s".', x.pic_teks) end
    ),
    format('GRD %s · %s', bulan_indonesia(p_periode), x.kode),
    -- Kartu menampilkannya sesudah "Selesai bila:".
    format('Hasil sesuai isi tugas (termasuk angka atau jumlah yang disebut), ditulis dengan bukti (angka, link, atau foto), lalu diajukan sebelum %s jam 17.00 WIB.',
           case when x.t_tenggat is not null
                then tanggal_indonesia(x.t_tenggat) else '-' end),
    ((x.t_tenggat + time '17:00') at time zone 'Asia/Jakarta'),
    case x.t_status when 'progress' then 'berjalan'::status_tugas
                    else 'todo'::status_tugas end,
    case
      when periode_grd_terkunci(p_periode) then 'bulan_terkunci'
      when x.tiket_id is not null then 'sudah_punya_tiket'
      when x.t_tanpa_tiket then 'tiket_dihapus'
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
      case when x.cadangan
           then format('Kolom SIAPA ("%s") tidak tampak pada nama PIC; kemungkinan PIC cadangan (pemilik goal/Manager)',
                       x.pic_teks) end
    ), '')
  from rakit x;
$$;

comment on function calon_tiket_grd(date) is
  'Satu baris per tonggak SEKALI/PEKANAN: isi tiket bila akan dibuat, alasan bila dilewati (0201, 0203, 0204, 0206).';

revoke execute on function calon_tiket_grd(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Rollback (manual, urut): jalankan ulang calon_tiket_grd dari 0204,
-- notifikasi_tiket_dihapus dari 0184, dan jaga_hapus_tugas dari 0200;
--   drop trigger if exists tasks_tandai_tonggak_tanpa_tiket on tasks;
--   drop function if exists tandai_tonggak_tanpa_tiket();
--   drop function if exists pulihkan_tiket_grd(uuid);
--   alter table grd_tonggak drop column if exists tanpa_tiket;
-- ---------------------------------------------------------------------
