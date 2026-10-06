-- =====================================================================
-- K-Space V2 — Tonggak GRD menjadi tiket: penyelarasan (2 dari 4)
--
-- Tim bekerja dari halaman Tugas; halaman GRD > Rencana operasional
-- mengikuti. Satu arah untuk STATUS (tiket → tonggak), dua arah untuk
-- TENGGAT (satu tanggal, dua tampilan):
--
--   tiket todo                          → tonggak belum
--   tiket berjalan / menunggu_qc / revisi → tonggak progress
--   tiket selesai (QC lolos)            → tonggak selesai, dengan waktu
--                                         selesai = saat PIC MENGAJUKAN
--                                         pemeriksaan (bukan saat QC
--                                         meluluskan)
--   tiket dibatalkan                    → tonggak dibiarkan
--
-- Penjaga yang berubah (semuanya hanya menambah cabang untuk tiket/tonggak
-- GRD; perilaku tugas dan tonggak biasa sama persis dengan sebelumnya):
--
--   · `jaga_tonggak` (0192): tonggak yang punya tiket menolak perubahan
--     status manual (aturan 7). Waktu selesai dari tiket dipertahankan.
--   · `kunci_isi_tiket` (0186): tenggat tiket GRD hanya boleh diubah
--     CEO/Manager — termasuk yang bukan pemberi tiket — dan pemberi
--     tiket biasa tidak lagi boleh mengubahnya (aturan 8). Tautan ke
--     tonggak tidak bisa diubah pengguna.
--   · `jaga_hapus_tugas` (0184): tiket GRD tidak bisa dihapus dari
--     aplikasi; kalau dihapus, impor berikutnya akan membuatnya lagi.
--     Salah buat dibetulkan lewat rencananya.
--   · Bulan yang KPI-nya sudah dikunci tidak disentuh (aturan 11):
--     status tonggak tidak diubah tiketnya, dan tenggat tiketnya tidak
--     bisa digeser.
--
-- Aman dijalankan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. jaga_tonggak: isi 0192 + dua tambahan (ditandai "0200")
-- ---------------------------------------------------------------------
create or replace function jaga_tonggak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periode date;
begin
  if pemanggil_sistem() then
    if tg_op <> 'DELETE' then
      if new.status = 'selesai' and new.selesai_pada is null then
        new.selesai_pada := now();
      elsif new.status <> 'selesai' then
        new.selesai_pada := null;
      end if;
    end if;
    return coalesce(new, old);
  end if;

  select r.grd_periode into v_periode
  from grd_rencana r where r.id = coalesce(new.rencana_id, old.rencana_id);

  if exists (
    select 1 from kpi_snapshots s
    where s.periode_bulan = v_periode and s.dikunci_pada is not null
  ) then
    raise exception 'KPI % sudah dikunci; tonggaknya tidak bisa diubah lagi',
      to_char(v_periode, 'Mon YYYY')
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    if not lintas_unit() then
      raise exception 'Hanya CEO atau Manager yang boleh menghapus tonggak'
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if not lintas_unit() then
      raise exception 'Hanya CEO atau Manager yang boleh menambah tonggak'
        using errcode = 'insufficient_privilege';
    end if;
    new.selesai_pada := case when new.status = 'selesai' then now() end;
  else
    if (new.tenggat is distinct from old.tenggat
        or new.judul is distinct from old.judul
        or new.kunci is distinct from old.kunci
        or new.rencana_id is distinct from old.rencana_id
        or new.urutan is distinct from old.urutan)
       and not lintas_unit()
    then
      raise exception 'Tenggat dan isi tonggak hanya bisa diubah CEO atau Manager'
        using errcode = 'insufficient_privilege';
    end if;

    -- 0200: tonggak yang punya tiket hanya mengikuti tiketnya. Yang
    -- mengubahnya dari trigger tiket berjalan di kedalaman > 1; centang
    -- manual (`ubah_status_tonggak`) dan penyuntingan langsung di
    -- kedalaman 1 ditolak.
    if new.status is distinct from old.status
       and pg_trigger_depth() = 1
       and tonggak_punya_tiket(old.id) then
      raise exception 'Status tonggak ini mengikuti tiketnya; ubah lewat halaman Tugas'
        using errcode = 'check_violation';
    end if;

    if new.status = 'selesai' and old.status <> 'selesai' then
      -- 0200: dari tiket, waktu selesai = saat PIC mengajukan pemeriksaan
      -- (sudah diisi penyelaras); centang manual tetap saat ini.
      if not (pg_trigger_depth() > 1 and new.selesai_pada is not null) then
        new.selesai_pada := now();
      end if;
    elsif new.status <> 'selesai' then
      new.selesai_pada := null;
    else
      -- Tetap selesai: waktu centang pertama tidak boleh ditimpa.
      new.selesai_pada := old.selesai_pada;
    end if;
  end if;

  new.diubah_oleh := auth.uid();
  new.diubah_pada := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. kunci_isi_tiket: isi 0186 + cabang tiket GRD (ditandai "0200")
-- ---------------------------------------------------------------------
create or replace function kunci_isi_tiket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hanya_tenggat boolean;
begin
  -- Proses sistem tanpa identitas pengguna — migrasi, seed, service role
  -- — tetap boleh.
  if auth.uid() is null then
    return new;
  end if;

  -- 0200: penyelarasan dari tonggaknya. Tenggat dan judul tiket GRD
  -- mengikuti tonggak (impor, perubahan tenggat oleh CEO/Manager) lewat
  -- trigger di tabel tonggak, yaitu di kedalaman > 1; pelepasan tiket saat
  -- tonggaknya dihapus juga begitu. Penerima, pemberi, jenis, dan goal
  -- tidak ikut berubah.
  if pg_trigger_depth() > 1
     and old.tonggak_id is not null
     and (new.tonggak_id is null or new.tonggak_id = old.tonggak_id)
     and (new.tipe, new.penerima_id, new.pembuat_id)
         is not distinct from (old.tipe, old.penerima_id, old.pembuat_id) then
    return new;
  end if;

  -- Penghapusan goal melepas tiketnya dari dalam trigger lain (lihat
  -- 0181): hanya dari dalam trigger, hanya melepas goal, isi lain utuh.
  -- Diperiksa sebelum kunci tiket selesai: komitmen yang sudah selesai
  -- pun harus tetap bisa dilepas dari goal yang dihapus.
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

  -- Hanya isi yang dijaga; status, hasil kerja, dan kolom QC punya
  -- penjaganya sendiri.
  if (new.tenggat, new.tanpa_jam, new.judul, new.deskripsi, new.konteks,
      new.kriteria_selesai, new.target_angka, new.target_satuan,
      new.penerima_id, new.pembuat_id, new.tipe, new.goal_id, new.tonggak_id)
     is not distinct from
     (old.tenggat, old.tanpa_jam, old.judul, old.deskripsi, old.konteks,
      old.kriteria_selesai, old.target_angka, old.target_satuan,
      old.penerima_id, old.pembuat_id, old.tipe, old.goal_id, old.tonggak_id) then
    return new;
  end if;

  -- 0200: tiket yang lahir dari tonggak GRD.
  if old.tonggak_id is not null then
    if new.tonggak_id is distinct from old.tonggak_id then
      raise exception 'Tautan tiket ke tonggak GRD tidak bisa diubah'
        using errcode = 'insufficient_privilege';
    end if;

    if (new.tenggat, new.tanpa_jam) is distinct from (old.tenggat, old.tanpa_jam) then
      -- Mengikuti aturan tenggat tonggak (0192): hanya CEO/Manager, supaya
      -- tonggak yang terlambat tidak "menjadi tepat" karena tenggatnya
      -- digeser orang lain.
      if not lintas_unit() then
        raise exception 'Tenggat tiket dari rencana GRD hanya bisa diubah CEO atau Manager'
          using errcode = 'insufficient_privilege';
      end if;

      -- CEO/Manager yang bukan pemberi tiket boleh mengubah tenggat saja.
      v_hanya_tenggat :=
        (new.judul, new.deskripsi, new.konteks, new.kriteria_selesai,
         new.target_angka, new.target_satuan, new.penerima_id,
         new.pembuat_id, new.tipe, new.goal_id)
        is not distinct from
        (old.judul, old.deskripsi, old.konteks, old.kriteria_selesai,
         old.target_angka, old.target_satuan, old.penerima_id,
         old.pembuat_id, old.tipe, old.goal_id);

      if v_hanya_tenggat and auth.uid() is distinct from old.pembuat_id then
        if old.status = 'selesai' then
          raise exception 'Tiket yang sudah selesai tidak bisa diubah lagi'
            using errcode = 'insufficient_privilege';
        end if;
        return new;
      end if;
    end if;
  end if;

  -- Pemberi tiket satu-satunya yang boleh; untuk to-do, pemberinya
  -- adalah pemiliknya sendiri.
  if auth.uid() is distinct from old.pembuat_id then
    if old.tipe = 'pribadi' then
      raise exception 'Isi to-do hanya bisa diubah pemiliknya'
        using errcode = 'insufficient_privilege';
    end if;
    raise exception 'Isi tiket hanya bisa diubah oleh pemberi tiket'
      using errcode = 'insufficient_privilege';
  end if;

  if old.tipe <> 'pribadi' then
    -- Tiket yang lolos QC sudah jadi bagian nilai KPI penerimanya.
    if old.status = 'selesai' then
      raise exception 'Tiket yang sudah selesai tidak bisa diubah lagi'
        using errcode = 'insufficient_privilege';
    end if;

    if new.penerima_id is distinct from old.penerima_id then
      -- Yang sudah mulai dikerjakan tidak dipindah tangan: hasil kerja
      -- dan riwayat QC-nya milik penerima lama.
      if old.status <> 'todo' then
        raise exception 'Penerima hanya bisa diganti selama tiket belum mulai dikerjakan'
          using errcode = 'check_violation';
      end if;
      if not boleh_menugasi(new.penerima_id) then
        raise exception 'Penerima baru harus anggota yang boleh kamu tugasi'
          using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;

  -- Delegasi (0186): pemilik mengubah to-do-nya menjadi tiket untuk
  -- bawahan. Syaratnya sama dengan membuat tiket baru — penerimanya orang
  -- yang boleh ia tugasi — dan pemberinya tetap pemilik to-do itu.
  if old.tipe = 'pribadi' and new.tipe <> 'pribadi' then
    if new.tipe <> 'tiket' then
      raise exception 'To-do hanya bisa didelegasikan sebagai tiket biasa'
        using errcode = 'check_violation';
    end if;
    if old.status = 'selesai' then
      raise exception 'To-do yang sudah selesai tidak bisa didelegasikan'
        using errcode = 'check_violation';
    end if;
    if new.pembuat_id is distinct from old.pembuat_id then
      raise exception 'Pemberi tiket hasil delegasi adalah pemilik to-do'
        using errcode = 'insufficient_privilege';
    end if;
    if new.penerima_id is not distinct from old.pembuat_id then
      raise exception 'Pilih bawahan yang akan mengerjakannya'
        using errcode = 'check_violation';
    end if;
    if not boleh_menugasi(new.penerima_id) then
      raise exception 'Penerima baru harus anggota yang boleh kamu tugasi'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

comment on function kunci_isi_tiket() is
  'Isi tiket hanya bisa diubah pemberinya dan terkunci setelah selesai; penerima hanya diganti selagi To Do dan dalam cakupan; isi to-do hanya pemiliknya, yang boleh mendelegasikannya sebagai tiket; tenggat tiket dari rencana GRD hanya CEO/Manager (0181, 0183, 0184, 0186, 0200).';

-- ---------------------------------------------------------------------
-- 3. jaga_hapus_tugas: isi 0184 + tiket GRD tidak bisa dihapus
-- ---------------------------------------------------------------------
create or replace function jaga_hapus_tugas()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
     and old.tipe <> 'pribadi'
     and old.status = 'selesai' then
    raise exception 'Tiket yang sudah selesai tidak bisa dihapus agar nilai KPI dan riwayatnya tetap utuh'
      using errcode = 'insufficient_privilege';
  end if;

  -- 0200: tiket dari rencana GRD adalah cermin tonggaknya. Bila dihapus,
  -- impor berikutnya membuatnya lagi; salah buat dibetulkan di rencana.
  if auth.uid() is not null and old.tonggak_id is not null then
    raise exception 'Tiket dari rencana GRD tidak bisa dihapus; betulkan lewat rencana operasional GRD'
      using errcode = 'insufficient_privilege';
  end if;
  return old;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Tiket → tonggak
-- ---------------------------------------------------------------------
create or replace function sinkron_tonggak_dari_tiket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periode  date;
  v_tonggak  date;
  v_tenggat  date;
  v_status   text;
  v_waktu    timestamptz;
begin
  if new.tonggak_id is null then
    return new;
  end if;

  select r.grd_periode, t.tenggat into v_periode, v_tonggak
  from grd_tonggak t
  join grd_rencana r on r.id = t.rencana_id
  where t.id = new.tonggak_id;

  if v_periode is null then
    return new;
  end if;

  -- Tenggat: satu tanggal untuk tiket dan tonggaknya. Jamnya hanya milik
  -- tiket. Di bulan terkunci tenggat tidak bisa digeser (aturan 11).
  if new.tenggat is distinct from old.tenggat then
    v_tenggat := (new.tenggat at time zone 'Asia/Jakarta')::date;
    if v_tonggak is distinct from v_tenggat then
      if periode_grd_terkunci(v_periode) then
        raise exception 'KPI % sudah dikunci; tenggat tiket GRD tidak bisa diubah lagi',
          to_char(v_periode, 'Mon YYYY')
          using errcode = 'check_violation';
      end if;
      update grd_tonggak set tenggat = v_tenggat where id = new.tonggak_id;
    end if;
  end if;

  -- Status: tiket → tonggak, tidak sebaliknya. Bulan terkunci dilewati
  -- diam-diam: PIC tetap bisa menyelesaikan tiketnya, hanya tonggak yang
  -- sudah jadi angka KPI final yang tidak disentuh.
  if new.status is distinct from old.status
     or new.diajukan_pada is distinct from old.diajukan_pada then
    v_status := case new.status
                  when 'todo'       then 'belum'
                  when 'selesai'    then 'selesai'
                  when 'dibatalkan' then null
                  else 'progress'
                end;

    if v_status is not null and not periode_grd_terkunci(v_periode) then
      v_waktu := case when v_status = 'selesai'
                      then coalesce(new.diajukan_pada, new.selesai_at, now())
                 end;
      update grd_tonggak
         set status = v_status,
             selesai_pada = v_waktu
       where id = new.tonggak_id
         and status is distinct from v_status;
    end if;
  end if;

  return new;
end;
$$;

comment on function sinkron_tonggak_dari_tiket() is
  'Status tiket GRD mengalir ke tonggaknya; waktu selesai = saat diajukan; tenggat sejalan; bulan terkunci tidak disentuh (0200).';

drop trigger if exists tasks_sinkron_tonggak on tasks;
create trigger tasks_sinkron_tonggak
  after update on tasks
  for each row
  when (
    new.tonggak_id is not null
    and (old.status is distinct from new.status
         or old.tenggat is distinct from new.tenggat
         or old.diajukan_pada is distinct from new.diajukan_pada)
  )
  execute function sinkron_tonggak_dari_tiket();

-- ---------------------------------------------------------------------
-- 5. Tonggak → tiket (tenggat dan judul)
--
-- Impor yang memperbarui tenggat/judul tonggak, atau CEO/Manager yang
-- menggesernya, membawa tiketnya. Tiket yang sudah selesai/dibatalkan
-- dibiarkan. Jam tenggat tiket dipertahankan (hanya tanggalnya yang
-- ikut). Penerima dikabari bila tenggatnya berpindah — kecuali ia
-- sendiri yang menggesernya.
-- ---------------------------------------------------------------------
create or replace function sinkron_tiket_dari_tonggak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periode date;
  v_kode    text;
  v_judul_r text;
  k         record;
  v_baru    timestamptz;
begin
  select r.grd_periode, r.kode, r.judul into v_periode, v_kode, v_judul_r
  from grd_rencana r where r.id = new.rencana_id;

  if v_periode is null or periode_grd_terkunci(v_periode) then
    return new;
  end if;

  for k in
    select t.id, t.judul, t.tenggat, t.penerima_id
    from tasks t
    where t.tonggak_id = new.id
      and t.status not in ('selesai', 'dibatalkan')
  loop
    if new.tenggat is not null
       and (k.tenggat at time zone 'Asia/Jakarta')::date
           is distinct from new.tenggat then
      v_baru := (new.tenggat + (k.tenggat at time zone 'Asia/Jakarta')::time)
                  at time zone 'Asia/Jakarta';
      update tasks set tenggat = v_baru where id = k.id;

      if k.penerima_id is distinct from auth.uid() then
        perform terbitkan_notifikasi(
          k.penerima_id,
          'tugas',
          format('Tenggat tiket berubah: %s', k.judul),
          format('Tenggat kini %s pukul %s WIB.',
                 tanggal_indonesia(new.tenggat),
                 to_char(v_baru at time zone 'Asia/Jakarta', 'HH24.MI')),
          '/tugas'
        );
      end if;
    end if;

    if new.judul is distinct from old.judul then
      update tasks
         set judul = judul_tiket_grd(v_kode, v_judul_r, new.judul)
       where id = k.id;
    end if;
  end loop;

  return new;
end;
$$;

comment on function sinkron_tiket_dari_tonggak() is
  'Tenggat dan judul tonggak mengalir ke tiketnya yang belum selesai; bulan terkunci tidak disentuh (0200).';

drop trigger if exists grd_tonggak_sinkron_tiket on grd_tonggak;
create trigger grd_tonggak_sinkron_tiket
  after update of judul, tenggat on grd_tonggak
  for each row
  when (old.judul is distinct from new.judul
        or old.tenggat is distinct from new.tenggat)
  execute function sinkron_tiket_dari_tonggak();

-- ---------------------------------------------------------------------
-- Rollback (manual, urut):
--   drop trigger if exists grd_tonggak_sinkron_tiket on grd_tonggak;
--   drop function if exists sinkron_tiket_dari_tonggak();
--   drop trigger if exists tasks_sinkron_tonggak on tasks;
--   drop function if exists sinkron_tonggak_dari_tiket();
--   jalankan ulang jaga_hapus_tugas dari 0184;
--   jalankan ulang kunci_isi_tiket dari 0186;
--   jalankan ulang jaga_tonggak dari 0192.
-- ---------------------------------------------------------------------
