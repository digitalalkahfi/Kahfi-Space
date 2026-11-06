-- =====================================================================
-- K-Space V2 — Absen pulang tidak boleh terkunci tanpa jalan keluar
--
-- `sudah_lapor_harian` hanya mencari laporan dengan user_id = orang yang
-- absen. Padahal satu akun hanya boleh punya satu laporan per tanggal, dan
-- Manager, CEO, serta co-leader boleh mengirim laporan akun itu. Begitu
-- mereka melaporkan seluruh akun seorang PIC, ia tidak bisa lagi mengirim
-- apa pun (kunci unik) dan absen pulangnya terkunci sampai hari berganti,
-- sementara daftar "belum dilaporkan" di layarnya kosong.
--
-- Jalan buntu yang sama menimpa PIC yang akunnya baru didaftarkan hari itu:
-- laporan yang ditagih bertanggal kemarin, dan laporan sebelum akun terdaftar
-- ditolak aplikasi (`alasanTanggalLaporan`).
--
-- Aturannya kini: kunci terbuka bila orang itu sudah melapor sendiri, atau
-- bila tidak ada lagi yang bisa ia laporkan. Laporan kiriman orang lain
-- sengaja tidak langsung membuka kunci selama masih ada akun lain yang belum
-- terlapor; kalau tidak, satu laporan Manager akan menghapus tagihan akun
-- kedua dari Beranda dan layar absen.
--
-- Sengaja tidak diubah:
--   - Laporan yang dikirim sendiri tetap cukup satu, walau PIC memegang
--     beberapa akun (perilaku sejak 0016).
--   - Pagar `boleh_orang` tetap: fungsi ini tidak menjawab untuk orang di
--     luar cakupan pemanggilnya (0173).
--   - Akun dibaca dari keadaan saat ini, sama seperti `wajib_lapor_harian`:
--     kolom rekap hari lampau mengikuti PIC sekarang, bukan PIC waktu itu.
--     Akun yang terdaftar sesudah suatu tanggal tidak ikut dinilai pada
--     tanggal itu, jadi rekap lampau tidak berubah saat akun baru ditambahkan.
-- =====================================================================

create or replace function sudah_lapor_harian(p_user uuid, p_tanggal date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- H-1: `p_tanggal` = hari absen; laporan yang ditagih hari itu memuat
  -- GMV hari sebelumnya.
  select boleh_orang(p_user)
     and (
       -- Melapor sendiri.
       exists (
         select 1 from daily_reports r
         where r.user_id = p_user and r.tanggal = p_tanggal - 1
       )
       -- Leader unit tanpa akun: unitnya sudah dilaporkan, siapa pun
       -- pengirimnya. Syaratnya sama dengan `wajib_lapor_harian`.
       or exists (
         select 1
         from daily_reports r
         join users u on u.unit_id = r.unit_id
         where u.id = p_user
           and u.role = 'Leader'
           and r.tanggal = p_tanggal - 1
           and not exists (
             select 1 from accounts a
             where a.unit_id = u.unit_id and a.status = 'aktif'
           )
       )
       -- PIC: sudah memegang akun aktif pada hari itu, dan tidak ada yang
       -- tersisa untuk dilapor. Akun yang terdaftar persis pada hari absen
       -- belum bisa dilapor untuk kemarin, jadi belum ditagih.
       or (
         exists (
           select 1 from accounts a
           where a.pic_user_id = p_user
             and a.status = 'aktif'
             and (a.created_at at time zone 'Asia/Jakarta')::date <= p_tanggal
         )
         and not exists (
           select 1 from accounts a
           where a.pic_user_id = p_user
             and a.status = 'aktif'
             and (a.created_at at time zone 'Asia/Jakarta')::date < p_tanggal
             and not exists (
               select 1 from daily_reports r
               where r.account_id = a.id and r.tanggal = p_tanggal - 1
             )
         )
       )
     );
$$;

comment on function sudah_lapor_harian(uuid, date) is
  'Tagihan laporan pada p_tanggal (bertanggal p_tanggal - 1) sudah tuntas: orang ini melapor sendiri, unit yang dipimpinnya terlapor, atau tidak ada lagi akunnya yang bisa dilapor.';

-- Rollback (manual): kembalikan sudah_lapor_harian ke definisi 0207.
