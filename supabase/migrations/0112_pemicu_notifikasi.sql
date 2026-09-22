-- =====================================================================
-- K-Space V2 — Pemicu peristiwa notifikasi (PRD Fase 3)
--
-- Notifikasi diterbitkan basis data, bukan aplikasi. Alasannya bukan
-- selera arsitektur: peristiwa yang sama bisa terjadi lewat halaman,
-- lewat Server Action, lewat impor massal, dan kelak lewat pekerjaan
-- terjadwal. Satu pemicu di tabelnya menjangkau semuanya sekaligus;
-- kode di aplikasi hanya menjangkau jalan yang kebetulan diingat orang
-- yang menulisnya.
--
-- Semua trigger di sini AFTER dan tidak pernah menggagalkan peristiwa
-- aslinya. Tugas yang tersimpan tapi notifikasinya gagal terbit masih
-- jauh lebih baik daripada tugas yang gagal tersimpan karena
-- notifikasinya bermasalah.
--
-- Orang tidak menerima notifikasi atas tindakannya sendiri. Memberi
-- tahu seseorang tentang hal yang baru saja ia lakukan adalah cara
-- tercepat membuat lonceng berhenti dipercaya.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tugas baru ditugaskan
-- ---------------------------------------------------------------------
create or replace function notifikasi_tugas_baru()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.penerima_id is null or new.penerima_id = new.pembuat_id then
    return new;
  end if;

  perform terbitkan_notifikasi(
    new.penerima_id,
    'tugas',
    format('Tugas baru: %s', new.judul),
    coalesce(nullif(new.konteks, ''), 'Dibuka dari modul Tugas.'),
    '/tugas'
  );
  return new;
end;
$$;

drop trigger if exists notifikasi_tugas_baru_trg on tasks;
create trigger notifikasi_tugas_baru_trg
  after insert on tasks
  for each row execute function notifikasi_tugas_baru();

-- Penugasan ulang: tugas yang berpindah tangan adalah tugas baru bagi
-- penerimanya, walau barisnya sudah lama ada.
create or replace function notifikasi_tugas_pindah()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.penerima_id is distinct from old.penerima_id
     and new.penerima_id is not null then
    perform terbitkan_notifikasi(
      new.penerima_id,
      'tugas',
      format('Tugas dialihkan kepadamu: %s', new.judul),
      coalesce(nullif(new.konteks, ''), 'Dibuka dari modul Tugas.'),
      '/tugas'
    );
  end if;

  -- Hasil QC dikabarkan ke yang mengerjakan, bukan ke yang memeriksa.
  if new.qc_status is distinct from old.qc_status
     and new.qc_status in ('lolos', 'revisi')
     and new.penerima_id is not null
     and new.penerima_id is distinct from new.qc_by then
    perform terbitkan_notifikasi(
      new.penerima_id,
      'tugas',
      case new.qc_status
        when 'lolos' then format('QC lolos: %s', new.judul)
        else format('Perlu revisi: %s', new.judul)
      end,
      coalesce(nullif(new.qc_note, ''), 'Buka tugasnya untuk keterangan.'),
      '/tugas'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notifikasi_tugas_pindah_trg on tasks;
create trigger notifikasi_tugas_pindah_trg
  after update on tasks
  for each row execute function notifikasi_tugas_pindah();

-- ---------------------------------------------------------------------
-- Keputusan transaksi
-- ---------------------------------------------------------------------
create or replace function notifikasi_keputusan_transaksi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_judul text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.diajukan_id is null or new.diajukan_id = new.disetujui_id then
    return new;
  end if;

  v_judul := case new.status
    when 'disetujui' then 'Transaksimu disetujui'
    when 'ditolak'   then 'Transaksimu ditolak'
    when 'dibayar'   then 'Transaksimu sudah dibayar'
    else null
  end;

  if v_judul is null then
    return new;
  end if;

  perform terbitkan_notifikasi(
    new.diajukan_id,
    'transaksi',
    v_judul,
    format('%s — Rp %s.%s',
      new.keterangan,
      to_char(new.jumlah, 'FM999G999G999G999'),
      case when nullif(new.catatan_keputusan, '') is null
        then ''
        else ' ' || new.catatan_keputusan
      end),
    '/keuangan/transaksi'
  );
  return new;
end;
$$;

drop trigger if exists notifikasi_keputusan_transaksi_trg on transactions;
create trigger notifikasi_keputusan_transaksi_trg
  after update on transactions
  for each row execute function notifikasi_keputusan_transaksi();

-- ---------------------------------------------------------------------
-- Keputusan izin / sakit
-- ---------------------------------------------------------------------
create or replace function notifikasi_keputusan_izin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.persetujuan is not distinct from old.persetujuan
     or new.persetujuan is null
     or new.user_id = new.disetujui_oleh then
    return new;
  end if;

  perform terbitkan_notifikasi(
    new.user_id,
    'izin',
    case new.persetujuan
      when 'disetujui' then format('Pengajuanmu %s disetujui', new.tanggal)
      when 'ditolak'   then format('Pengajuanmu %s ditolak', new.tanggal)
      else format('Pengajuanmu %s diputuskan', new.tanggal)
    end,
    coalesce(nullif(new.alasan, ''), 'Buka Absensi untuk keterangan.'),
    '/absensi'
  );
  return new;
end;
$$;

drop trigger if exists notifikasi_keputusan_izin_trg on attendance;
create trigger notifikasi_keputusan_izin_trg
  after update on attendance
  for each row execute function notifikasi_keputusan_izin();

-- ---------------------------------------------------------------------
-- Pengumuman baru
-- ---------------------------------------------------------------------
-- Satu pengumuman menghasilkan satu baris PER PENERIMA. Terlihat boros,
-- tetapi "sudah dibaca" adalah keadaan milik masing-masing orang —
-- menyimpannya sekali berarti tidak bisa menjawab siapa yang sudah
-- membacanya.
create or replace function notifikasi_pengumuman_baru()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.published_at is null then
    return new;
  end if;

  insert into notifications (user_id, kategori, judul, pesan, tautan)
  select
    u.id,
    'pengumuman',
    format('Pengumuman baru: %s', new.judul),
    coalesce(nullif(new.ringkasan, ''), 'Buka untuk membacanya.'),
    '/pengumuman'
  from users u
  where u.status = 'aktif'
    and u.id is distinct from new.dibuat_oleh
    and (new.target_role is null or u.role = new.target_role)
    and (new.target_unit_id is null or u.unit_id = new.target_unit_id);

  return new;
end;
$$;

drop trigger if exists notifikasi_pengumuman_baru_trg on announcements;
create trigger notifikasi_pengumuman_baru_trg
  after insert on announcements
  for each row execute function notifikasi_pengumuman_baru();

-- ---------------------------------------------------------------------
-- Balasan masukan / masalah
-- ---------------------------------------------------------------------
create or replace function notifikasi_masukan_ditindak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status
     or new.dilaporkan_oleh is null then
    return new;
  end if;

  perform terbitkan_notifikasi(
    new.dilaporkan_oleh,
    'masukan',
    format('Masukanmu ditindaklanjuti: %s', new.judul),
    format('Status berubah menjadi %s.', new.status),
    '/masukan/saya'
  );
  return new;
end;
$$;

drop trigger if exists notifikasi_masukan_ditindak_trg on feedback;
create trigger notifikasi_masukan_ditindak_trg
  after update on feedback
  for each row execute function notifikasi_masukan_ditindak();
