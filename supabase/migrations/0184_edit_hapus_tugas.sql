-- =====================================================================
-- K-Space V2 — Edit & hapus tugas
--
-- Pemberi tiket kini bisa mengedit dan menghapus tiketnya dari layar,
-- dan pemilik to-do bisa mengedit dan menghapus to-do-nya. SIAPA yang
-- boleh sudah dijaga sejak awal: `tasks_hapus` (0009) untuk menghapus,
-- `kunci_isi_tiket` (0181, 0183) untuk mengubah isi. Yang ditambahkan di
-- sini adalah KAPAN dan KE SIAPA:
--
--   · Tiket yang sudah SELESAI (lolos QC) terkunci — isinya tidak bisa
--     diubah dan barisnya tidak bisa dihapus. Nilai KPI tiket dan
--     riwayat kerja penerimanya bergantung pada baris itu. To-do pribadi
--     tidak ikut dikunci: tidak dinilai siapa-siapa.
--   · Penerima tiket hanya bisa diganti selama tiket belum mulai
--     dikerjakan (masih To Do), dan penerima barunya harus orang yang
--     memang boleh ditugasi pemberinya — syarat yang sama dengan
--     `tasks_buat` (0009). Tanpa ini, mengedit penerima jadi jalan
--     memutar untuk menugasi orang di luar cakupan.
--   · Penerima dikabari saat tiketnya diubah, dialihkan, atau dihapus
--     orang lain — supaya tiketnya tidak berubah atau hilang diam-diam.
--
-- Policy `tasks_hapus`/`tasks_ubah` dan trigger notifikasi yang sudah
-- ada tidak diubah; notifikasi di sini trigger baru dengan pola yang
-- sama (AFTER, tidak pernah menggagalkan peristiwanya).
--
-- Aman dijalankan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Siapa yang boleh ditugasi pemanggil — syarat `tasks_buat` (0009) dalam
-- bentuk fungsi, supaya penggantian penerima memakai syarat yang sama
-- persis dengan pembuatan tiket.
-- ---------------------------------------------------------------------
create or replace function boleh_menugasi(p_penerima uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_penerima is not null
     and (p_penerima = auth.uid()
          or lintas_unit()
          or atasan_dari(p_penerima) = auth.uid()
          or (memimpin_unit() and boleh_orang(p_penerima)));
$$;

comment on function boleh_menugasi(uuid) is
  'Pemanggil boleh menugasi orang ini? Syarat yang sama dengan policy tasks_buat (0184).';

-- ---------------------------------------------------------------------
-- Kunci isi tiket (0181, 0183) + kunci tiket selesai + syarat ganti
-- penerima.
-- ---------------------------------------------------------------------
create or replace function kunci_isi_tiket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Proses sistem tanpa identitas pengguna — migrasi, seed, service role
  -- — tetap boleh.
  if auth.uid() is null then
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
      new.penerima_id, new.pembuat_id, new.tipe, new.goal_id)
     is not distinct from
     (old.tenggat, old.tanpa_jam, old.judul, old.deskripsi, old.konteks,
      old.kriteria_selesai, old.target_angka, old.target_satuan,
      old.penerima_id, old.pembuat_id, old.tipe, old.goal_id) then
    return new;
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

  return new;
end;
$$;

comment on function kunci_isi_tiket() is
  'Isi tiket hanya bisa diubah pemberinya dan terkunci setelah selesai; penerima hanya diganti selagi To Do dan dalam cakupan; isi to-do hanya pemiliknya (0181, 0183, 0184).';

-- Trigger `tasks_a_kunci_isi_tiket` (0181) tetap dipakai; hanya fungsinya
-- yang diperbarui.

-- ---------------------------------------------------------------------
-- Tiket selesai tidak bisa dihapus.
--
-- Berlaku untuk siapa pun yang login — termasuk CEO/Manager yang boleh
-- menghapus lewat `tasks_hapus`. Proses sistem tetap boleh.
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
  return old;
end;
$$;

drop trigger if exists tasks_jaga_hapus on tasks;
create trigger tasks_jaga_hapus
  before delete on tasks
  for each row execute function jaga_hapus_tugas();

-- ---------------------------------------------------------------------
-- Notifikasi: tiket diubah atau dialihkan.
--
-- Penerima BARU sudah dikabari `notifikasi_tugas_pindah` (0112); di sini
-- penerima LAMA yang dikabari. Perubahan oleh proses sistem dan rembetan
-- trigger lain (mis. goal dihapus) tidak dikabarkan, begitu juga
-- perubahan yang dilakukan penerimanya sendiri.
-- ---------------------------------------------------------------------
create or replace function notifikasi_tiket_diubah()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jenis  text;
  v_bagian text[] := '{}';
  v_nama   text;
  v_waktu  timestamp;
begin
  if old.tipe = 'pribadi'
     or new.tipe = 'pribadi'
     or auth.uid() is null
     or pg_trigger_depth() > 1 then
    return new;
  end if;

  v_jenis := case new.tipe when 'komitmen_mingguan' then 'Komitmen' else 'Tiket' end;

  if new.penerima_id is distinct from old.penerima_id then
    if old.penerima_id is distinct from auth.uid() then
      select u.nama into v_nama from users u where u.id = new.penerima_id;
      perform terbitkan_notifikasi(
        old.penerima_id,
        'tugas',
        format('%s dialihkan: %s', v_jenis, new.judul),
        format('Kini dikerjakan %s. Kamu tidak perlu mengerjakannya lagi.',
               coalesce(v_nama, 'orang lain')),
        '/tugas'
      );
    end if;
    return new;
  end if;

  if new.penerima_id is not distinct from auth.uid() then
    return new;
  end if;

  if new.judul is distinct from old.judul then
    v_bagian := array_append(v_bagian, 'judul');
  end if;
  if (new.deskripsi, new.konteks) is distinct from (old.deskripsi, old.konteks) then
    v_bagian := array_append(v_bagian, 'rincian');
  end if;
  if new.kriteria_selesai is distinct from old.kriteria_selesai then
    v_bagian := array_append(v_bagian, 'kriteria selesai');
  end if;
  if (new.target_angka, new.target_satuan)
     is distinct from (old.target_angka, old.target_satuan) then
    v_bagian := array_append(v_bagian, 'target');
  end if;
  if (new.tenggat, new.tanpa_jam) is distinct from (old.tenggat, old.tanpa_jam) then
    if new.tenggat is null then
      v_bagian := array_append(v_bagian, 'tenggat');
    else
      -- Tanggal & jam WIB dengan nama bulan Indonesia, mis. "2 Okt 17.00".
      v_waktu := new.tenggat at time zone 'Asia/Jakarta';
      v_bagian := array_append(v_bagian, format(
        'tenggat (kini %s %s%s)',
        extract(day from v_waktu)::int,
        (array['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
               'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'])
          [extract(month from v_waktu)::int],
        case when new.tanpa_jam then ''
             else ' ' || to_char(v_waktu, 'HH24.MI') || ' WIB' end
      ));
    end if;
  end if;
  if new.prioritas is distinct from old.prioritas then
    v_bagian := array_append(v_bagian, 'prioritas');
  end if;
  if new.goal_id is distinct from old.goal_id then
    v_bagian := array_append(v_bagian, 'goal');
  end if;

  if cardinality(v_bagian) = 0 then
    return new;
  end if;

  perform terbitkan_notifikasi(
    new.penerima_id,
    'tugas',
    format('%s diubah: %s', v_jenis, new.judul),
    format('Yang berubah: %s.', array_to_string(v_bagian, ', ')),
    '/tugas'
  );
  return new;
exception
  -- Notifikasi yang gagal terbit bukan alasan menggagalkan perubahan
  -- tiketnya (prinsip 0112); galatnya tetap tercatat di log basis data.
  when others then
    raise warning 'notifikasi_tiket_diubah gagal untuk %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists notifikasi_tiket_diubah_trg on tasks;
create trigger notifikasi_tiket_diubah_trg
  after update on tasks
  for each row execute function notifikasi_tiket_diubah();

-- ---------------------------------------------------------------------
-- Notifikasi: tiket dihapus.
-- ---------------------------------------------------------------------
create or replace function notifikasi_tiket_dihapus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nama text;
begin
  if old.tipe = 'pribadi'
     or old.status = 'dibatalkan'
     or auth.uid() is null
     or old.penerima_id is not distinct from auth.uid() then
    return old;
  end if;

  select u.nama into v_nama from users u where u.id = auth.uid();
  perform terbitkan_notifikasi(
    old.penerima_id,
    'tugas',
    format('%s dihapus: %s',
           case old.tipe when 'komitmen_mingguan' then 'Komitmen' else 'Tiket' end,
           old.judul),
    format('%s menghapusnya. Kamu tidak perlu mengerjakannya lagi.',
           coalesce(v_nama, 'Pemberi tiket')),
    '/tugas'
  );
  return old;
exception
  when others then
    raise warning 'notifikasi_tiket_dihapus gagal untuk %: %', old.id, sqlerrm;
    return old;
end;
$$;

drop trigger if exists notifikasi_tiket_dihapus_trg on tasks;
create trigger notifikasi_tiket_dihapus_trg
  after delete on tasks
  for each row execute function notifikasi_tiket_dihapus();

-- ---------------------------------------------------------------------
-- Rollback (manual, urut):
--   drop trigger if exists notifikasi_tiket_dihapus_trg on tasks;
--   drop function if exists notifikasi_tiket_dihapus();
--   drop trigger if exists notifikasi_tiket_diubah_trg on tasks;
--   drop function if exists notifikasi_tiket_diubah();
--   drop trigger if exists tasks_jaga_hapus on tasks;
--   drop function if exists jaga_hapus_tugas();
--   jalankan ulang definisi kunci_isi_tiket dari 0183;
--   drop function if exists boleh_menugasi(uuid);
-- ---------------------------------------------------------------------
