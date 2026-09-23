-- =====================================================================
-- K-Space V2 — Tanda "bukti di sistem lama" pada kehadiran
--
-- Kehadiran di V2 dibuktikan swafoto dan koordinat. Kehadiran hasil
-- migrasi tidak punya swafotonya: foto lama tersimpan sebagai rujukan ke
-- `img:store`, dan `img:store` sengaja tidak ikut dipindahkan.
--
-- Kolom kosong tanpa keterangan terbaca seolah orangnya tidak pernah
-- berswafoto — tuduhan yang tidak pernah dimaksudkan siapa pun. Kolom
-- ini yang menuliskan apa adanya: buktinya ada, hanya tidak di sini.
-- =====================================================================

alter table attendance
  add column catatan_bukti text not null default '';

comment on column attendance.catatan_bukti is
  'Keterangan asal bukti kehadiran; diisi "bukti di sistem lama" untuk baris hasil migrasi.';

-- Baris hasil migrasi dikenali dari kolom ini, jadi penyaringannya
-- harus murah: jumlahnya ribuan dan layar verifikasi membacanya tiap
-- kali dibuka.
create index attendance_bukti_lama_idx on attendance (tanggal)
  where catatan_bukti <> '';
