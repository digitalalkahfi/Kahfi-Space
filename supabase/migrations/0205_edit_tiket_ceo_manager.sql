-- =====================================================================
-- K-Space V2 — CEO dan Manager boleh mengedit semua tiket (0205)
--
-- Sebelumnya (D1, 0181) isi tiket — judul, deskripsi, kriteria selesai,
-- target, tenggat, penerima, goal — hanya bisa diubah PEMBERI tiketnya.
-- CEO/Manager yang bukan pemberi harus meminta pemberinya, padahal mereka
-- yang bertanggung jawab atas seluruh tim (mis. tiket GRD yang pemberinya
-- atasan langsung penerima, bukan Manager).
--
-- Kini isi tiket yang BELUM selesai bisa diubah oleh:
--   · pemberi tiketnya (seperti sebelumnya), dan
--   · CEO atau Manager, siapa pun pemberinya.
-- Penerima tetap tidak bisa; to-do tetap hanya pemiliknya.
--
-- Yang tetap dijaga:
--   · tiket yang sudah selesai terkunci (nilai KPI penerimanya);
--   · penerima hanya diganti selagi tiket To Do, dan harus orang yang
--     boleh ditugasi pengubahnya (`boleh_menugasi`);
--   · pemberi dan jenis tiket tidak bisa diambil alih lewat suntingan —
--     CEO/Manager menyunting isinya, bukan memindahkan kepemilikannya;
--   · tenggat tiket dari rencana GRD tetap hanya CEO/Manager (0200),
--     dan tautan ke tonggaknya tetap tidak bisa diubah.
--
-- Pemberi tiket DIKABARI bila orang lain yang mengubah isinya
-- ("Tiket diubah oleh <nama>: …"), sama seperti penerima dikabari sejak
-- 0184. Alur QC tidak berubah.
--
-- `kunci_isi_tiket` sama dengan 0200 kecuali blok pemeriksa pemberi;
-- `notifikasi_tiket_diubah` sama dengan 0184 kecuali kabar ke pemberi.
-- Aman dijalankan ulang.
-- =====================================================================

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

  -- Pemberi tiket, atau CEO/Manager (0205); untuk to-do, hanya pemiliknya
  -- sendiri.
  if auth.uid() is distinct from old.pembuat_id then
    if old.tipe = 'pribadi' then
      raise exception 'Isi to-do hanya bisa diubah pemiliknya'
        using errcode = 'insufficient_privilege';
    end if;
    if not lintas_unit() then
      raise exception 'Isi tiket hanya bisa diubah oleh pemberi tiket, CEO, atau Manager'
        using errcode = 'insufficient_privilege';
    end if;
    -- CEO/Manager menyunting isinya; pemberi dan jenis tiket tetap milik
    -- pemberinya — mengambil alih tiket orang lain bukan menyunting.
    if (new.pembuat_id, new.tipe) is distinct from (old.pembuat_id, old.tipe) then
      raise exception 'Pemberi dan jenis tiket tidak bisa diubah oleh orang lain'
        using errcode = 'insufficient_privilege';
    end if;
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
  'Isi tiket hanya bisa diubah pemberinya atau CEO/Manager dan terkunci setelah selesai; penerima hanya diganti selagi To Do dan dalam cakupan; isi to-do hanya pemiliknya, yang boleh mendelegasikannya sebagai tiket; tenggat tiket dari rencana GRD hanya CEO/Manager (0181, 0183, 0184, 0186, 0200, 0205).';

-- ---------------------------------------------------------------------
-- Kabar ke pemberi tiket saat orang lain mengubah isinya
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
  v_editor text;
  v_waktu  timestamp;
begin
  if old.tipe = 'pribadi'
     or new.tipe = 'pribadi'
     or auth.uid() is null
     or pg_trigger_depth() > 1 then
    return new;
  end if;

  v_jenis := case new.tipe when 'komitmen_mingguan' then 'Komitmen' else 'Tiket' end;

  -- Bagian yang berubah, dihitung sekali untuk penerima dan pemberi.
  if new.penerima_id is distinct from old.penerima_id then
    v_bagian := array_append(v_bagian, 'penerima');
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

  -- 0205: pemberi dikabari bila ORANG LAIN (CEO/Manager) yang mengubah
  -- isinya. Pemberi yang mengubah sendiri tidak dikabari.
  if cardinality(v_bagian) > 0
     and new.pembuat_id is not distinct from old.pembuat_id
     and new.pembuat_id is distinct from auth.uid()
     and new.pembuat_id is distinct from new.penerima_id then
    select u.nama into v_editor from users u where u.id = auth.uid();
    perform terbitkan_notifikasi(
      new.pembuat_id,
      'tugas',
      format('%s diubah oleh %s: %s', v_jenis, coalesce(v_editor, 'atasan'), new.judul),
      format('Yang berubah: %s.', array_to_string(v_bagian, ', ')),
      '/tugas'
    );
  end if;

  -- Penerima (sama seperti 0184).
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

-- ---------------------------------------------------------------------
-- Rollback (manual): jalankan ulang kunci_isi_tiket dari 0200 dan
-- notifikasi_tiket_diubah dari 0184.
-- ---------------------------------------------------------------------
