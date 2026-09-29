-- =====================================================================
-- K-Space V2 — Tiket & to-do SMART (keputusan D5)
--
-- Tiket yang hanya berjudul membuat QC menebak: pemeriksa menilai hasil
-- kerja tanpa ukuran yang disepakati di awal. Tiket kini wajib punya
-- KRITERIA SELESAI ("tiket dianggap selesai bila …"), dan tiket maupun
-- to-do boleh membawa target terukur (angka + satuan, mis. 14 sesi).
--
--   · `kriteria_selesai` — wajib untuk tiket/komitmen BARU (trigger
--     BEFORE INSERT); tiket lama tidak dipaksa dan tetap bisa digeser
--     serta di-QC seperti biasa.
--   · `target_angka` + `target_satuan` — opsional; bila angkanya diisi,
--     harus > 0 dan satuannya wajib (constraint, berlaku untuk semua).
--
-- Kolom baru ikut dikunci `kunci_isi_tiket` (0181): hanya pemberi tiket
-- yang boleh mengubahnya. `papan_tugas` & `daftar_tugas` (0182) dibuat
-- ulang supaya ikut membawa kolom baru.
--
-- Aman dijalankan ulang.
-- =====================================================================

alter table tasks
  add column if not exists kriteria_selesai text not null default '',
  add column if not exists target_angka     numeric,
  add column if not exists target_satuan    text not null default '';

comment on column tasks.kriteria_selesai is
  'Tiket dianggap selesai bila …; wajib untuk tiket/komitmen baru, dibaca pemeriksa saat QC (0183).';
comment on column tasks.target_angka is
  'Target terukur opsional (mis. 14); > 0 bila diisi (0183).';
comment on column tasks.target_satuan is
  'Satuan target (mis. sesi); wajib bila target_angka diisi (0183).';

alter table tasks drop constraint if exists tasks_target_positif;
alter table tasks
  add constraint tasks_target_positif check (
    target_angka is null or target_angka > 0
  );

alter table tasks drop constraint if exists tasks_target_bersatuan;
alter table tasks
  add constraint tasks_target_bersatuan check (
    target_angka is null or length(btrim(target_satuan)) > 0
  );

-- ---------------------------------------------------------------------
-- Tiket & komitmen BARU wajib berkriteria selesai.
--
-- Sama seperti kewajiban tenggat (0180): proses sistem (seed, migrasi
-- data lama lewat service role) menulis riwayat apa adanya.
-- ---------------------------------------------------------------------
create or replace function wajib_kriteria_tiket_baru()
returns trigger
language plpgsql
as $$
begin
  if new.tipe <> 'pribadi'
     and auth.uid() is not null
     and length(btrim(coalesce(new.kriteria_selesai, ''))) < 5 then
    raise exception 'Tiket baru wajib punya kriteria selesai (minimal 5 karakter)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_wajib_kriteria_tiket_baru on tasks;
create trigger tasks_wajib_kriteria_tiket_baru
  before insert on tasks
  for each row execute function wajib_kriteria_tiket_baru();

-- ---------------------------------------------------------------------
-- Kunci isi tiket (0181) kini mencakup kriteria & target.
-- ---------------------------------------------------------------------
create or replace function kunci_isi_tiket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Proses sistem tanpa identitas pengguna — migrasi, seed, service role
  -- — tetap boleh. Pemberi tiket boleh; untuk to-do, pemberinya adalah
  -- pemiliknya sendiri.
  if auth.uid() is null
     or auth.uid() is not distinct from old.pembuat_id then
    return new;
  end if;

  -- Penghapusan goal melepas tiketnya dari dalam trigger lain (lihat
  -- 0181): hanya dari dalam trigger, hanya melepas goal, isi lain utuh.
  if pg_trigger_depth() > 1
     and old.goal_id is not null
     and new.goal_id is null
     and (new.tipe = old.tipe
          or (old.tipe = 'komitmen_mingguan' and new.tipe = 'tiket'))
     and (new.tenggat, new.tanpa_jam, new.judul, new.deskripsi,
          new.kriteria_selesai, new.target_angka, new.target_satuan,
          new.penerima_id, new.pembuat_id)
         is not distinct from
         (old.tenggat, old.tanpa_jam, old.judul, old.deskripsi,
          old.kriteria_selesai, old.target_angka, old.target_satuan,
          old.penerima_id, old.pembuat_id) then
    return new;
  end if;

  if (new.tenggat, new.tanpa_jam, new.judul, new.deskripsi, new.konteks,
      new.kriteria_selesai, new.target_angka, new.target_satuan,
      new.penerima_id, new.pembuat_id, new.tipe, new.goal_id)
     is distinct from
     (old.tenggat, old.tanpa_jam, old.judul, old.deskripsi, old.konteks,
      old.kriteria_selesai, old.target_angka, old.target_satuan,
      old.penerima_id, old.pembuat_id, old.tipe, old.goal_id) then
    if old.tipe = 'pribadi' then
      raise exception 'Isi to-do hanya bisa diubah pemiliknya'
        using errcode = 'insufficient_privilege';
    end if;
    raise exception 'Isi tiket hanya bisa diubah oleh pemberi tiket'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Papan & daftar membawa kriteria dan target. Bentuk keluarannya
-- bertambah kolom, jadi keduanya dibuat ulang; isinya sama dengan 0182.
-- ---------------------------------------------------------------------
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
    c.goal_id, g.judul, g.periode, c.selesai_at, c.created_at,
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
  'Isi papan Kanban satu tanggal (WIB); to-do hanya milik sendiri; kolom total untuk pesan batas (0182, 0183).';

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
    (kelompok_tenggat_dari(t.tenggat, p_acuan) = 'terlambat') desc,
    case t.prioritas when 'tinggi' then 0 when 'sedang' then 1 else 2 end,
    t.tenggat nulls last,
    t.created_at
  limit greatest(1, least(coalesce(p_batas, 300), 500));
$$;

comment on function daftar_tugas(date, text, int) is
  'Daftar tugas tersaring & terurut; to-do hanya milik sendiri; kolom total untuk pesan batas (0020, 0182, 0183).';

-- ---------------------------------------------------------------------
-- Rollback (manual, urut):
--   jalankan ulang definisi papan_tugas & daftar_tugas dari 0182
--     (didahului drop function if exists untuk keduanya);
--   jalankan ulang definisi kunci_isi_tiket dari 0181;
--   drop trigger if exists tasks_wajib_kriteria_tiket_baru on tasks;
--   drop function if exists wajib_kriteria_tiket_baru();
--   alter table tasks drop constraint if exists tasks_target_bersatuan;
--   alter table tasks drop constraint if exists tasks_target_positif;
--   alter table tasks drop column if exists target_satuan,
--                     drop column if exists target_angka,
--                     drop column if exists kriteria_selesai;
-- ---------------------------------------------------------------------
