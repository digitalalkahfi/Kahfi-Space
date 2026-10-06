-- =====================================================================
-- K-Space V2 — Tonggak GRD menjadi tiket: penghubung (1 dari 4)
--
-- Tonggak rencana operasional GRD (0192) kini punya tiket di modul Tugas.
-- Migration ini hanya menyiapkan PENGHUBUNG dan datanya:
--
--   · `tasks.tonggak_id` — tiket ini lahir dari tonggak mana. UNIK: satu
--     tonggak paling banyak satu tiket, sehingga pembuatan tiket yang
--     diulang (impor ulang, perintah manual dua kali) tidak pernah
--     menghasilkan tiket kembar.
--   · `tasks.diajukan_pada` — saat penerima terakhir mengajukan
--     pemeriksaan (status masuk `menunggu_qc`). Tonggak dianggap tepat
--     waktu menurut saat ini, bukan saat QC meluluskan, supaya QC yang
--     lambat tidak merugikan PIC (aturan 6). Kolom ini hanya diisi
--     trigger; isian pengguna diabaikan, sehingga tidak bisa dimundurkan
--     untuk "menepatkan" waktu.
--   · Penjaga: tautan hanya boleh dipasang CEO/Manager, dan tonggak yang
--     dihapus melepas tiketnya (yang belum selesai dibatalkan, yang sudah
--     selesai dibiarkan sebagai arsip).
--
-- Penyelarasan status/tenggat ada di 0200, pembuatan tiketnya di 0201,
-- tampilannya di 0202.
--
-- Aman dijalankan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kolom penghubung
-- ---------------------------------------------------------------------
alter table tasks
  add column if not exists tonggak_id uuid
    references grd_tonggak (id) on delete set null,
  add column if not exists diajukan_pada timestamptz;

comment on column tasks.tonggak_id is
  'Tonggak rencana operasional GRD yang melahirkan tiket ini; unik, null untuk tugas biasa (0199).';
comment on column tasks.diajukan_pada is
  'Saat penerima terakhir mengajukan pemeriksaan; dasar waktu selesai tonggak GRD. Hanya diisi trigger (0199).';

-- Unik tanpa syarat: NULL tidak saling bentrok, dan `on conflict
-- (tonggak_id)` dapat dipakai pembuat tiket.
create unique index if not exists tasks_tonggak_unik on tasks (tonggak_id);

alter table tasks drop constraint if exists tasks_tonggak_hanya_tiket;
alter table tasks
  add constraint tasks_tonggak_hanya_tiket check (
    tonggak_id is null or tipe = 'tiket'
  );

comment on constraint tasks_tonggak_hanya_tiket on tasks is
  'Tonggak GRD menjadi tiket biasa, bukan to-do atau komitmen mingguan (0199).';

-- ---------------------------------------------------------------------
-- 2. Penolong
-- ---------------------------------------------------------------------

-- Bulan GRD yang KPI-nya sudah dikunci: predikat yang sama dengan penjaga
-- tonggak (`jaga_tonggak`, 0192) — satu bulan terkunci bila ada
-- snapshot yang dikunci.
create or replace function periode_grd_terkunci(p_periode date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from kpi_snapshots s
    where s.periode_bulan = p_periode
      and s.dikunci_pada is not null
  );
$$;

comment on function periode_grd_terkunci(date) is
  'Bulan GRD ini sudah dikunci KPI-nya (ada snapshot terkunci); tonggak & tiketnya tidak disentuh lagi (0199).';

-- Tonggak yang tiketnya masih berjalan — statusnya mengikuti tiket dan
-- tidak boleh diubah manual (aturan 7). Tiket yang dibatalkan
-- melepaskan tonggaknya kembali ke pengelolaan manual.
create or replace function tonggak_punya_tiket(p_tonggak uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from tasks t
    where t.tonggak_id = p_tonggak
      and t.status <> 'dibatalkan'
  );
$$;

comment on function tonggak_punya_tiket(uuid) is
  'Tonggak ini punya tiket yang belum dibatalkan; statusnya hanya mengikuti tiket (0199).';

-- Teks berbahasa Indonesia untuk tiket GRD. Nama hari/bulan ditulis di
-- sini, bukan lewat `to_char`, karena locale basis data tidak dijamin.
create or replace function tanggal_indonesia(p_tanggal date)
returns text
language sql
immutable
as $$
  select (array['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'])
           [extract(dow from p_tanggal)::int + 1]
         || ', ' || extract(day from p_tanggal)::int::text
         || ' ' || (array['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                          'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'])
                      [extract(month from p_tanggal)::int]
         || ' ' || extract(year from p_tanggal)::int::text;
$$;

comment on function tanggal_indonesia(date) is
  'Contoh: Sabtu, 3 Okt 2026 (0199).';

create or replace function bulan_indonesia(p_tanggal date, p_panjang boolean default false)
returns text
language sql
immutable
as $$
  select case when p_panjang
           then (array['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                       'Juli', 'Agustus', 'September', 'Oktober', 'November',
                       'Desember'])[extract(month from p_tanggal)::int]
           else (array['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                       'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'])
                  [extract(month from p_tanggal)::int]
         end
         || ' ' || extract(year from p_tanggal)::int::text;
$$;

comment on function bulan_indonesia(date, boolean) is
  'Contoh: Oktober 2026 (panjang) atau Okt 2026 (0199).';

create or replace function potong_teks(p_teks text, p_batas int)
returns text
language sql
immutable
as $$
  select case when length(p_teks) <= p_batas then p_teks
              else left(p_teks, greatest(p_batas - 1, 0)) || '…' end;
$$;

-- Judul tiket dari tonggak: "<kode> · <uraian>", paling banyak 200 huruf
-- (batas judul tugas).
--
--   · Judul tonggak yang sudah memuat dirinya di rumusan rencana (tonggak
--     tunggal, atau tahap yang diambil dari rumusan) cukup berdiri
--     sendiri;
--   · Judul tonggak berjadwal pekanan hanya hari/tanggalnya ("Senin, 5
--     Okt"), jadi judul rencana ikut ditulis di depannya.
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
  v_akhir   text;
  v_sisa    int;
begin
  if v_tonggak = '' then
    return potong_teks(v_awal || v_rencana, 200);
  end if;
  if v_rencana = ''
     or position(lower(v_tonggak) in lower(v_rencana)) > 0 then
    return potong_teks(v_awal || v_tonggak, 200);
  end if;

  v_akhir := ' — ' || v_tonggak;
  v_sisa := 200 - length(v_awal) - length(v_akhir);
  if v_sisa < 20 then
    return potong_teks(v_awal || v_tonggak, 200);
  end if;
  return v_awal || potong_teks(v_rencana, v_sisa) || v_akhir;
end;
$$;

comment on function judul_tiket_grd(text, text, text) is
  'Judul tiket dari kode rencana + judul tonggak (dan judul rencana bila tonggaknya hanya bertanggal), maks 200 huruf (0199).';

-- ---------------------------------------------------------------------
-- 3. diajukan_pada: dikelola trigger
--
-- Nama diawali `tasks_b_` supaya berjalan sebelum `tasks_jaga_status`.
-- Isian pengguna tidak dipercaya: nilainya selalu dikembalikan ke yang
-- lama, kecuali saat status baru saja masuk `menunggu_qc`.
-- ---------------------------------------------------------------------
create or replace function catat_pengajuan_tugas()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'menunggu_qc'
     and old.status is distinct from 'menunggu_qc' then
    new.diajukan_pada := now();
  else
    new.diajukan_pada := old.diajukan_pada;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_b_catat_pengajuan on tasks;
create trigger tasks_b_catat_pengajuan
  before update on tasks
  for each row execute function catat_pengajuan_tugas();

-- ---------------------------------------------------------------------
-- 4. Tautan hanya dipasang CEO/Manager (atau proses sistem)
--
-- `tasks_buat` (0009) mengizinkan atasan membuat tiket untuk bawahannya.
-- Tanpa pagar ini, atasan mana pun bisa menautkan tiketnya ke tonggak
-- dan lewat penyelarasan 0200 mengubah status tonggak orang lain.
-- ---------------------------------------------------------------------
create or replace function jaga_tautan_tonggak_baru()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tonggak_id is not null
     and auth.uid() is not null
     and not lintas_unit() then
    raise exception 'Tiket hanya bisa ditautkan ke tonggak GRD oleh CEO atau Manager'
      using errcode = 'insufficient_privilege';
  end if;
  -- Penanda pengajuan hanya lahir dari perpindahan status.
  new.diajukan_pada := null;
  return new;
end;
$$;

drop trigger if exists tasks_a_jaga_tautan_tonggak on tasks;
create trigger tasks_a_jaga_tautan_tonggak
  before insert on tasks
  for each row execute function jaga_tautan_tonggak_baru();

-- ---------------------------------------------------------------------
-- 5. Tonggak dihapus (impor tidak memuatnya lagi, atau rencananya
--    dihapus): tiketnya dilepas. Yang belum selesai dibatalkan supaya
--    hilang dari papan; yang sudah selesai dibiarkan — nilainya sudah
--    jadi riwayat kerja penerimanya. Penerima dikabari bila tiketnya
--    dibatalkan.
--
-- Berjalan SEBELUM `grd_tonggak_jaga` (urut abjad): tonggak di bulan
-- terkunci tetap tidak bisa dihapus, dan penolakannya membatalkan seluruh
-- pernyataan.
-- ---------------------------------------------------------------------
create or replace function lepas_tiket_tonggak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k record;
begin
  for k in
    select t.id, t.judul, t.penerima_id, t.status
    from tasks t
    where t.tonggak_id = old.id
  loop
    update tasks
       set tonggak_id = null,
           status = case when k.status = 'selesai'
                         then k.status else 'dibatalkan' end
     where id = k.id;

    if k.status not in ('selesai', 'dibatalkan') then
      perform terbitkan_notifikasi(
        k.penerima_id,
        'tugas',
        format('Tiket dibatalkan: %s', k.judul),
        'Tonggaknya sudah tidak ada di rencana operasional GRD. Kamu tidak perlu mengerjakannya lagi.',
        '/tugas'
      );
    end if;
  end loop;
  return old;
end;
$$;

comment on function lepas_tiket_tonggak() is
  'Tonggak GRD dihapus: tiket belum selesai dibatalkan, tiket selesai dilepas sebagai arsip (0199).';

drop trigger if exists grd_tonggak_a_lepas_tiket on grd_tonggak;
create trigger grd_tonggak_a_lepas_tiket
  before delete on grd_tonggak
  for each row execute function lepas_tiket_tonggak();

-- ---------------------------------------------------------------------
-- Rollback (manual, urut):
--   drop trigger if exists grd_tonggak_a_lepas_tiket on grd_tonggak;
--   drop function if exists lepas_tiket_tonggak();
--   drop trigger if exists tasks_a_jaga_tautan_tonggak on tasks;
--   drop function if exists jaga_tautan_tonggak_baru();
--   drop trigger if exists tasks_b_catat_pengajuan on tasks;
--   drop function if exists catat_pengajuan_tugas();
--   drop function if exists tonggak_punya_tiket(uuid);
--   drop function if exists periode_grd_terkunci(date);
--   drop function if exists judul_tiket_grd(text, text, text);
--   drop function if exists potong_teks(text, int);
--   drop function if exists bulan_indonesia(date, boolean);
--   drop function if exists tanggal_indonesia(date);
--   alter table tasks drop constraint if exists tasks_tonggak_hanya_tiket;
--   drop index if exists tasks_tonggak_unik;
--   alter table tasks drop column if exists diajukan_pada,
--                     drop column if exists tonggak_id;
-- (jalankan rollback 0200–0202 lebih dulu; fungsi di sana memakai kolom ini)
-- ---------------------------------------------------------------------
