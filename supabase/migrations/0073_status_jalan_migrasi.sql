-- =====================================================================
-- K-Space V2 — Satu jalan migrasi terbuka, dan yang sudah ditutup final
--
-- `migrasi_jalan.selesai_pada` ada sejak 0045 tetapi tidak ada yang
-- mengisinya, dan tidak ada yang mencegah dua jalan terbuka sekaligus.
-- Dua akibatnya sama-sama menyesatkan:
--
--   * `ringkas_migrasi()` membaca jalan terakhir. Kalau dua jalan
--     berjalan bersamaan, catatannya terbelah dan layar melaporkan
--     migrasi yang tampak setengah — padahal keduanya utuh, hanya
--     terpisah.
--   * Catatan yang masih bisa ditambahkan ke jalan yang sudah selesai
--     membuat angka verifikasi berubah sesudah dinyatakan lulus.
--
-- Maka: satu jalan terbuka pada satu waktu, dan jalan yang sudah ditutup
-- menolak catatan baru maupun perubahan catatan lamanya.
-- =====================================================================

create unique index migrasi_jalan_terbuka_tunggal
  on migrasi_jalan ((selesai_pada is null))
  where selesai_pada is null;

comment on index migrasi_jalan_terbuka_tunggal is
  'Hanya satu jalan migrasi boleh terbuka; tutup dulu sebelum memulai berikutnya.';

create or replace function jaga_catatan_migrasi()
returns trigger
language plpgsql
as $$
declare
  ditutup timestamptz;
begin
  select selesai_pada into ditutup
  from migrasi_jalan
  where id = new.jalan_id;

  if ditutup is not null then
    raise exception 'Jalan migrasi itu sudah ditutup pada %; mulai jalan baru untuk mencatat lagi',
      to_char(ditutup, 'DD Mon YYYY HH24:MI')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_catatan_migrasi_trg on migrasi_catatan;

-- Hanya penambahan dan penyuntingan yang ditutup. Menghapus seluruh
-- catatan sebuah jalan tetap boleh: itu pembersihan arsip yang disengaja
-- oleh pengelola, bukan perubahan angka yang menyamar sebagai hasil asli.
create trigger jaga_catatan_migrasi_trg
  before insert or update on migrasi_catatan
  for each row execute function jaga_catatan_migrasi();

/**
 * Menutup jalan migrasi yang sedang terbuka.
 *
 * Catatan yang masih 'menunggu' berarti pekerjaannya belum tuntas —
 * menutupnya akan mengabadikan laporan yang belum selesai sebagai hasil
 * akhir, jadi ditolak dengan menyebut sisanya.
 */
create or replace function tutup_migrasi_jalan(p_jalan uuid)
returns migrasi_jalan
language plpgsql
security definer
set search_path = public
as $$
declare
  jalan migrasi_jalan;
  sisa integer;
begin
  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh menutup jalan migrasi'
      using errcode = 'insufficient_privilege';
  end if;

  select * into jalan from migrasi_jalan where id = p_jalan;
  if jalan.id is null then
    raise exception 'Jalan migrasi tidak ditemukan';
  end if;
  if jalan.selesai_pada is not null then
    raise exception 'Jalan migrasi itu sudah ditutup'
      using errcode = 'check_violation';
  end if;

  select count(*) into sisa
  from migrasi_catatan
  where jalan_id = p_jalan and status = 'menunggu';

  if sisa > 0 then
    raise exception 'Masih ada % catatan berstatus menunggu; selesaikan dulu', sisa
      using errcode = 'check_violation';
  end if;

  update migrasi_jalan
     set selesai_pada = now()
   where id = p_jalan
   returning * into jalan;

  return jalan;
end;
$$;
