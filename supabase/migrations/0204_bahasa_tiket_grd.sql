-- =====================================================================
-- K-Space V2 — Bahasa tiket GRD: pendek, jelas, SMART (0204)
--
-- Tiket dari tonggak GRD (0201) terlalu berbelit: judul rencana yang sama
-- tampil tiga kali di kartu (judul, deskripsi, kriteria), deskripsinya
-- penuh istilah internal ("Tonggak:", "PIC lain:", "Penanggung jawab di
-- file GRD:"), dan judulnya bisa ratusan huruf. Susunannya kini mengikuti
-- SMART dengan bahasa sehari-hari, dan setiap bagian hanya tampil SEKALI:
--
--   S  Specific    judul (kepala kalimat) + "Rincian:" bila judul rencana
--                  panjang — dipisah di ":" atau kalimat pertamanya
--   M  Measurable  "Selesai bila: Hasil sesuai isi tugas (termasuk angka
--                  atau jumlah yang disebut), ditulis dengan bukti (angka,
--                  link, atau foto), lalu diajukan sebelum <tanggal> jam
--                  17.00 WIB."
--   A  Achievable  "Dibantu: <PIC lain>"
--   R  Relevant    "Terhubung goal" (sudah ditampilkan kartu), dan
--                  "Asal: rencana GRD <kode> (<bulan>)"
--   T  Time-bound  tenggat tiket (17.00 WIB) dan tanggalnya di kriteria;
--                  "Rutin: <jadwal>" untuk rencana pekanan
--
-- Isi `buat_tiket_grd` tidak berubah selain teksnya. Tiket yang SUDAH ada
-- dirapikan sekali di akhir migrasi ini — hanya yang belum selesai, belum
-- dibatalkan, bulannya belum dikunci, dan deskripsinya masih tulisan
-- otomatis (bila pemberi sudah menyuntingnya, tidak ditimpa). Tanpa
-- notifikasi: perubahan oleh proses sistem tidak dikabarkan.
--
-- Aman dijalankan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Penolong judul
-- ---------------------------------------------------------------------

-- Tonggak yang judulnya sepotong dari rumusan rencananya (tahap-tahap
-- "SOP Komisi (1 Okt), SOP Studio (10 Okt)").
create or replace function tahap_grd(p_judul_rencana text, p_judul_tonggak text)
returns boolean
language sql
immutable
as $$
  select btrim(coalesce(p_judul_tonggak, '')) <> ''
     and lower(btrim(p_judul_tonggak)) <> lower(btrim(coalesce(p_judul_rencana, '')))
     and position(lower(btrim(p_judul_tonggak)) in lower(coalesce(p_judul_rencana, ''))) > 0;
$$;

comment on function tahap_grd(text, text) is
  'Judul tonggak adalah sepotong dari judul rencananya (tahap) (0204).';

-- Memisah judul rencana menjadi [kepala, rincian]. Judul yang cukup pendek
-- (≤ 100 huruf) dibiarkan utuh, kecuali `p_paksa` (tahap): kepalanya perlu
-- dipendekkan supaya tidak mengulang seluruh daftar tahap. Dipisah di
-- ": " atau ". " pertama yang kepalanya minimal 12 huruf; tanpa itu utuh.
create or replace function pisah_judul_grd(p_judul text, p_paksa boolean default false)
returns text[]
language plpgsql
immutable
as $$
declare
  j  text := btrim(coalesce(p_judul, ''));
  pc int  := position(': ' in j);
  pt int  := position('. ' in j);
  p  int;
begin
  if not p_paksa and length(j) <= 100 then
    return array[j, null];
  end if;
  if pc < 13 then pc := null; end if;
  if pt < 13 then pt := null; end if;
  p := least(pc, pt);
  if p is null then
    return array[j, null];
  end if;
  return array[btrim(left(j, p - 1)), nullif(btrim(substr(j, p + 2)), '')];
end;
$$;

comment on function pisah_judul_grd(text, boolean) is
  'Judul rencana → [kepala, rincian]; kepala dipakai di judul tiket, rincian di deskripsi (0204).';

-- Judul tiket: "<kode> · <kepala>" dan, bila tonggaknya punya nama sendiri
-- (hari/tanggal pekanan, atau tahap), " — <nama tonggak>". Paling banyak
-- 200 huruf (batas judul tugas).
create or replace function judul_tiket_grd(
  p_kode text,
  p_judul_rencana text,
  p_judul_tonggak text
)
returns text
language plpgsql
immutable
as $$
declare
  v_awal    text := p_kode || ' · ';
  v_rencana text := btrim(coalesce(p_judul_rencana, ''));
  v_tonggak text := btrim(coalesce(p_judul_tonggak, ''));
  v_kepala  text := (pisah_judul_grd(v_rencana, tahap_grd(v_rencana, v_tonggak)))[1];
  v_akhir   text;
  v_sisa    int;
begin
  if v_kepala = '' then
    v_kepala := v_tonggak;
  end if;
  if v_tonggak = ''
     or lower(v_tonggak) = lower(v_rencana)
     or lower(v_tonggak) = lower(v_kepala) then
    return potong_teks(v_awal || v_kepala, 200);
  end if;

  v_akhir := ' — ' || v_tonggak;
  v_sisa := 200 - length(v_awal) - length(v_akhir);
  if v_sisa < 20 then
    return potong_teks(v_awal || v_tonggak, 200);
  end if;
  return v_awal || potong_teks(v_kepala, v_sisa) || v_akhir;
end;
$$;

comment on function judul_tiket_grd(text, text, text) is
  'Judul tiket dari kode rencana + kepala judul rencana (+ nama tonggak bila berbeda), maks 200 huruf (0199, 0204).';

-- ---------------------------------------------------------------------
-- 2. Isi tiket: sama dengan 0203 selain deskripsi dan kriteria selesai
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
      t.status as t_status, t.urutan as t_urutan,
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
  'Satu baris per tonggak SEKALI/PEKANAN: isi tiket bila akan dibuat, alasan bila dilewati (0201, 0203, 0204).';

revoke execute on function calon_tiket_grd(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Rapikan tiket yang sudah ada (sekali)
--
-- Hanya tiket yang belum selesai/dibatalkan, di bulan yang belum dikunci,
-- dengan deskripsi yang masih tulisan otomatis lama. Yang sudah disunting
-- pemberinya tidak ditimpa. Dijalankan sebagai proses sistem, jadi tidak
-- ada notifikasi "tiket diubah".
-- ---------------------------------------------------------------------
do $$
declare
  p       date;
  n       integer;
  v_total integer := 0;
begin
  for p in
    select distinct r.grd_periode
    from grd_rencana r
    join grd_tonggak t on t.rencana_id = r.id
    join tasks k on k.tonggak_id = t.id
  loop
    if periode_grd_terkunci(p) then
      continue;
    end if;

    update tasks k
       set judul = c.judul,
           deskripsi = c.deskripsi,
           kriteria_selesai = c.kriteria
      from calon_tiket_grd(p) c
     where k.tonggak_id = c.tonggak_id
       and k.status not in ('selesai', 'dibatalkan')
       and k.deskripsi like 'Dibuat otomatis dari rencana operasional GRD%';
    get diagnostics n = row_count;
    v_total := v_total + n;
  end loop;

  raise notice '0204: % tiket GRD dirapikan bahasanya', v_total;
end;
$$;

-- ---------------------------------------------------------------------
-- Rollback (manual): jalankan ulang calon_tiket_grd dari 0203 dan
-- judul_tiket_grd dari 0199; drop function if exists pisah_judul_grd(text,
-- boolean), tahap_grd(text, text). Teks tiket yang sudah dirapikan tidak
-- dikembalikan.
-- ---------------------------------------------------------------------
