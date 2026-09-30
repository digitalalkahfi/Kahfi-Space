-- =====================================================================
-- K-Space V2 — Delegasi to-do ke bawahan
--
-- Masukan tim: sering sebuah to-do akhirnya dikerjakan bawahan. Pemilik
-- to-do kini bisa mendelegasikannya — to-do itu BERUBAH menjadi tiket
-- dari pemiliknya untuk orang yang dipilih (bukan disalin), sehingga
-- tidak ada to-do kembar yang tertinggal di papan pemiliknya.
--
-- Yang dijaga di `kunci_isi_tiket` (0181, 0183, 0184):
--   · hanya pemilik to-do (sudah dijaga sejak 0181), dan hanya menjadi
--     tiket biasa — komitmen mingguan butuh goal dan laporan mingguan;
--   · to-do yang sudah selesai tidak didelegasikan;
--   · pemberi tiketnya tetap pemilik to-do, penerimanya bukan dirinya
--     sendiri, dan harus orang yang boleh ia tugasi — syarat yang sama
--     dengan `tasks_buat` (lewat `boleh_menugasi`, 0184). Tanpa ini,
--     delegasi jadi jalan memutar menugasi orang di luar cakupan.
--
-- Kewajiban tiket lainnya tetap dijaga constraint yang ada: tiket harus
-- berjam (`tasks_tanpa_jam_hanya_todo`, 0180). Kriteria selesai hanya
-- diwajibkan saat tiket DIBUAT (0183), jadi delegasi tetap cepat.
-- Penerima dikabari `notifikasi_tugas_pindah` (0112) karena penerimanya
-- berganti.
--
-- Isi fungsi selain blok delegasi sama persis dengan 0184.
-- Aman dijalankan ulang.
-- =====================================================================

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
  'Isi tiket hanya bisa diubah pemberinya dan terkunci setelah selesai; penerima hanya diganti selagi To Do dan dalam cakupan; isi to-do hanya pemiliknya, yang boleh mendelegasikannya sebagai tiket (0181, 0183, 0184, 0186).';

-- ---------------------------------------------------------------------
-- Rollback (manual): jalankan ulang definisi kunci_isi_tiket dari 0184.
-- ---------------------------------------------------------------------
