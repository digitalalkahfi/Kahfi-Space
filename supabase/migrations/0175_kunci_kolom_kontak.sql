-- =====================================================================
-- K-Space V2 — Kunci kolom email & nomor WhatsApp
--
-- JANGAN dipindahkan ke supabase/migrations sebelum kode yang membaca
-- lewat `kontak_orang` (0174) tayang di Vercel: kode lama membaca
-- `users.email` langsung saat memuat sesi, dan akan gagal begitu kolom
-- ini dikunci.
--
-- Tabel `users` tetap terbaca semua pengguna untuk kolom direktori
-- (nama, peran, jabatan, unit, atasan, foto) karena nama dipakai di
-- seluruh aplikasi. Email, nomor, status verifikasi, dan persetujuan
-- WhatsApp hanya bisa dibaca lewat `kontak_orang`, yang mengikuti garis
-- pelaporan. Menulis tidak berubah: izin UPDATE/INSERT tetap, dan
-- policy `users_ubah_diri`/`users_kelola` tetap yang menentukan barisnya.
-- =====================================================================

revoke select on table users from anon, authenticated;

grant select (
  id, nama, role, jabatan, department_id, unit_id, program_id,
  atasan_id, foto_url, status, created_at, updated_at
) on table users to authenticated;
