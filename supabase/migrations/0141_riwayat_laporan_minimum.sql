-- =====================================================================
-- K-Space V2 — Batas minimum menempel pada tiap baris riwayat laporan
--
-- Halaman riwayat menampilkan kolom "Min." di sebelah angka unggahan.
-- Tanpa view ini, layar harus menyusun sendiri: ambil laporan, ambil
-- level akunnya, lalu terjemahkan level → batas minimum. Tiga langkah
-- itu berarti tiga tempat yang bisa melenceng — dan yang paling mudah
-- melenceng adalah langkah terakhir, karena tabel acuannya bisa berubah
-- tanpa layar tahu.
--
-- Kolomnya ikut membawa pelapor dan unit, karena riwayat memang selalu
-- membutuhkan ketiganya bersama-sama; memecahnya jadi beberapa
-- permintaan hanya memindahkan join ke sisi yang lebih lambat.
-- =====================================================================

create view riwayat_laporan_minimum
with (security_invoker = true)
as
  select
    l.id,
    l.tanggal,
    l.account_id,
    l.unit_id,
    l.gmv,
    l.komisi,
    l.jumlah_upload,
    l.catatan,
    l.status,
    l.submitted_at,
    a.username           as akun_username,
    a.level              as akun_level,
    -- Satu-satunya tempat level diterjemahkan jadi angka batas.
    batas_minimum(a.level) as minimum_unggahan,
    au.kode              as akun_unit_kode,
    u.kode               as unit_kode,
    u.nama               as unit_nama,
    p.nama               as pelapor_nama
  from daily_reports l
  left join accounts a on a.id = l.account_id
  left join units au on au.id = a.unit_id
  left join units u on u.id = l.unit_id
  left join users p on p.id = l.user_id
  where auth.uid() is not null;

comment on view riwayat_laporan_minimum is
  'Baris riwayat laporan beserta level akun dan batas minimum unggahannya; ikut aturan baca pemanggilnya.';

grant select on riwayat_laporan_minimum to authenticated;
