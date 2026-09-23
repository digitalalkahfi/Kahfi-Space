-- =====================================================================
-- K-Space V2 — Bukti pendukung transaksi
--
-- Persetujuan pengeluaran sudah berjenjang (migrasi 0098), tapi yang
-- memutuskan hanya melihat keterangan yang diketik pengaju. Nota, faktur,
-- atau tangkapan layar transfernya tidak punya tempat — jadi ia beredar
-- di grup chat, dan tidak ikut tersimpan bersama transaksinya.
--
-- Berkasnya sendiri diunggah browser langsung ke Supabase Storage,
-- seperti foto profil (migrasi 0113): yang masuk ke kolom ini hanya
-- alamatnya. Dengan begitu berkas tidak singgah di server aplikasi, dan
-- batas ukurannya ditentukan bucket — bukan batas badan Server Action
-- yang jauh lebih ketat.
-- =====================================================================

alter table transactions
  add column bukti_url text not null default '';

comment on column transactions.bukti_url is
  'Alamat bukti di bucket bukti-transaksi; kosong berarti belum ada bukti.';

-- Hanya alamat di dalam bucket `bukti-transaksi` yang diterima. Tanpa
-- ini, kolomnya bisa dipakai menyematkan tautan ke mana saja pada
-- halaman yang dibuka Finance dan manajemen.
alter table transactions
  add constraint transactions_bukti_url_sah check (
    bukti_url = ''
    or bukti_url ~ '^https://[^/]+/storage/v1/object/public/bukti-transaksi/'
  );

-- ---------------------------------------------------------------------
-- Bukti tidak bisa diganti setelah transaksinya dibayar.
--
-- Bukti yang masih bisa ditukar setelah uangnya keluar bukan bukti —
-- ia hanya lampiran. Menambahkannya pada transaksi yang belum dibayar
-- tetap boleh; itu justru yang diharapkan sebelum diputuskan.
-- ---------------------------------------------------------------------
create or replace function jaga_bukti_transaksi()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'dibayar'
     and new.bukti_url is distinct from old.bukti_url then
    raise exception
      'Bukti transaksi yang sudah dibayar tidak bisa diganti';
  end if;
  return new;
end;
$$;

create trigger transactions_jaga_bukti
  before update of bukti_url on transactions
  for each row execute function jaga_bukti_transaksi();
