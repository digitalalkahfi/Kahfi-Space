-- =====================================================================
-- K-Space V2 — Penyimpanan berkas (selfie absensi & foto profil)
--
-- BUKAN bagian dari migrasi biasa: skema `storage` hanya ada di Supabase,
-- sementara migrasi juga dijalankan di PostgreSQL polos saat pengujian.
-- Jalankan berkas ini sekali lewat SQL Editor Supabase setelah migrasi.
-- =====================================================================

-- Bucket privat: foto absensi tidak boleh bisa ditebak lewat URL publik.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('selfie-absensi', 'selfie-absensi', false, 3145728,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Nama berkas selalu diawali id pengguna: "<user_id>/<tanggal>-masuk.jpg".
-- Dengan begitu kepemilikan bisa diperiksa dari path-nya.
create policy "selfie unggah milik sendiri"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'selfie-absensi'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "selfie baca milik sendiri"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'selfie-absensi'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      -- Atasan boleh memeriksa foto anggota yang ia bawahi.
      or boleh_orang(((storage.foldername(name))[1])::uuid)
    )
  );

-- Foto absensi adalah bukti kehadiran: tidak boleh ditimpa atau dihapus
-- oleh penggunanya sendiri. Tidak ada policy update/delete.


-- =====================================================================
-- Foto profil (PRD Fase 1)
--
-- Bucket ini PUBLIK, tidak seperti selfie absensi. Alasannya berbeda:
-- foto profil memang dimaksudkan untuk dilihat rekan kerja di daftar
-- tim, kolom PIC, dan riwayat kegiatan — sementara selfie absensi
-- adalah bukti kehadiran yang hanya boleh dilihat pemilik dan atasannya.
-- URL publik juga membuat <img> bisa memuatnya tanpa menandatangani
-- ulang tautan setiap kali halaman dibuka.
--
-- Yang publik hanya MEMBACA. Menulis tetap terbatas pada folder milik
-- sendiri, persis seperti bucket selfie.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto-profil', 'foto-profil', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Path selalu "<user_id>/<nama-berkas>"; kepemilikan dibaca dari folder
-- pertama, sama seperti bucket selfie.
create policy "foto profil unggah milik sendiri"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'foto-profil'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Berbeda dari selfie: foto profil MEMANG diganti-ganti, jadi pemiliknya
-- boleh menimpa dan menghapus miliknya sendiri.
create policy "foto profil ganti milik sendiri"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'foto-profil'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'foto-profil'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "foto profil hapus milik sendiri"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'foto-profil'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
