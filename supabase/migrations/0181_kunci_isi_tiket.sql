-- =====================================================================
-- K-Space V2 — Isi tiket hanya bisa diubah pemberi tiket (keputusan D1)
--
-- Policy `tasks_ubah` (0009) sengaja longgar supaya penerima bisa
-- menggeser status tiketnya sendiri. Akibatnya penerima juga bisa
-- mengubah SEMUA kolom lewat API — termasuk memundurkan tenggatnya
-- sendiri atau mengganti judul pekerjaan yang ditugaskan kepadanya.
--
-- Policy-nya tidak diubah (penerima memang harus bisa menggeser status).
-- Yang ditambahkan adalah pagar per kolom: isi tiket — tenggat, judul,
-- rincian, penerima, dan tautan goal — hanya boleh diubah pemberi
-- tiketnya (`pembuat_id`). CEO/Manager yang bukan pemberi tiket juga
-- tidak boleh. Status, hasil kerja, dan kolom yang dikelola trigger
-- (`selesai_at`, `updated_at`) tetap bebas; kolom QC tetap dijaga
-- `larang_qc_sendiri`.
--
-- Pagar yang sama berlaku untuk to-do pribadi, yang pemberinya adalah
-- pemiliknya sendiri (pembuat = penerima, 0009): tabel izin keputusan
-- menyatakan CEO/Manager tidak boleh mengubah tanggal to-do orang lain,
-- padahal `tasks_ubah` mengizinkan lintas unit mengubah baris mana pun.
--
-- Nama trigger diawali `tasks_a_k…` supaya berjalan SEBELUM
-- `tasks_a_larang_qc_sendiri` dan `tasks_jaga_status` (trigger BEFORE
-- berjalan urut abjad namanya).
--
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
  -- — tetap boleh. Pemberi tiket boleh; untuk to-do, pemberinya adalah
  -- pemiliknya sendiri.
  if auth.uid() is null
     or auth.uid() is not distinct from old.pembuat_id then
    return new;
  end if;

  -- Penghapusan goal melepas tiketnya dari dalam trigger lain:
  -- `lepaskan_komitmen_dari_goal` (0022) menurunkan komitmen menjadi
  -- tiket, dan ON DELETE SET NULL mengosongkan `goal_id`. Itu akibat
  -- penghapusan goal oleh CEO/Manager — yang memang berwenang — bukan
  -- penyuntingan isi tiket, jadi dilewatkan. Syaratnya sempit: hanya
  -- dari dalam trigger (pg_trigger_depth() > 1), hanya melepas goal, dan
  -- isi lain tidak berubah.
  if pg_trigger_depth() > 1
     and old.goal_id is not null
     and new.goal_id is null
     and (new.tipe = old.tipe
          or (old.tipe = 'komitmen_mingguan' and new.tipe = 'tiket'))
     and (new.tenggat, new.tanpa_jam, new.judul, new.deskripsi,
          new.penerima_id, new.pembuat_id)
         is not distinct from
         (old.tenggat, old.tanpa_jam, old.judul, old.deskripsi,
          old.penerima_id, old.pembuat_id) then
    return new;
  end if;

  if (new.tenggat, new.tanpa_jam, new.judul, new.deskripsi, new.konteks,
      new.penerima_id, new.pembuat_id, new.tipe, new.goal_id)
     is distinct from
     (old.tenggat, old.tanpa_jam, old.judul, old.deskripsi, old.konteks,
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

comment on function kunci_isi_tiket() is
  'Isi tiket (tenggat, judul, rincian, penerima, goal) hanya bisa diubah pemberi tiket; isi to-do hanya pemiliknya (D1, 0181).';

drop trigger if exists tasks_a_kunci_isi_tiket on tasks;
create trigger tasks_a_kunci_isi_tiket
  before update on tasks
  for each row execute function kunci_isi_tiket();

-- ---------------------------------------------------------------------
-- Pengingat tenggat ikut terbit lagi saat tenggat digeser PENGGUNA.
--
-- `reset_pengingat_tenggat` (0113) menghapus penanda pengingat tanpa
-- security definer, sementara `notifikasi_tenggat_terkirim` ber-RLS
-- tanpa policy hapus. Hasilnya: saat pemberi tiket menggeser tenggat
-- lewat aplikasi, penghapusannya menyentuh nol baris tanpa galat, dan
-- pengingat untuk tenggat baru tidak pernah terbit. Test 0113 tidak
-- menangkapnya karena menggeser tenggat sebagai admin.
--
-- Trigger 0113 tidak diubah. Pendamping ini melakukan hal yang sama
-- dengan hak pemilik tabel; untuk proses sistem keduanya berjalan dan
-- yang kedua hanya menemukan nol baris.
-- ---------------------------------------------------------------------
create or replace function reset_pengingat_tenggat_pengguna()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tenggat is distinct from old.tenggat then
    delete from notifikasi_tenggat_terkirim where task_id = new.id;
  end if;
  return new;
end;
$$;

comment on function reset_pengingat_tenggat_pengguna() is
  'Menghapus penanda pengingat saat tenggat digeser pengguna (RLS-aman), 0181.';

drop trigger if exists reset_pengingat_tenggat_pengguna_trg on tasks;
create trigger reset_pengingat_tenggat_pengguna_trg
  after update of tenggat on tasks
  for each row execute function reset_pengingat_tenggat_pengguna();

-- ---------------------------------------------------------------------
-- Rollback (manual):
--   drop trigger if exists reset_pengingat_tenggat_pengguna_trg on tasks;
--   drop function if exists reset_pengingat_tenggat_pengguna();
--   drop trigger if exists tasks_a_kunci_isi_tiket on tasks;
--   drop function if exists kunci_isi_tiket();
-- ---------------------------------------------------------------------
