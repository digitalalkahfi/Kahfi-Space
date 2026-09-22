-- =====================================================================
-- K-Space V2 — Username akun unik tanpa memandang huruf besar-kecil
--
-- `unique (platform, username)` peka huruf, sehingga '@Skincare_Official'
-- dan '@skincare_official' bisa berdampingan sebagai dua akun berbeda
-- untuk toko yang sama. GMV-nya lalu terbelah dua dan target akun jadi
-- salah hitung. Perlakuannya disamakan dengan email pengguna di 0001.
-- =====================================================================

alter table accounts drop constraint if exists accounts_platform_username_key;

create unique index if not exists accounts_username_unik
  on accounts (platform, lower(username));
