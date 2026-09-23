-- =====================================================================
-- K-Space V2 — Status tim harian ikut membawa unggahan & batas minimum
--
-- Kartu "Pantau Kehadiran" adalah tempat Leader menindaklanjuti hari
-- ini: siapa belum absen, siapa belum lapor. Sejak ada batas minimum,
-- ada pertanyaan ketiga yang sama mendesaknya — siapa yang sudah lapor
-- tapi unggahannya di bawah minimum. Tanpa kolom ini, kartu itu harus
-- memanggil rekap terpisah hanya untuk satu angka per orang.
--
-- Keduanya DIJUMLAHKAN untuk seluruh akun yang ia pegang, karena satu
-- orang bisa memegang beberapa akun dan yang dinilai adalah harinya,
-- bukan akunnya satu per satu. Orang tanpa akun berlevel tetap null —
-- bukan nol, yang akan terbaca sebagai "minimumnya nol".
--
-- Bentuk keluarannya berubah, jadi yang lama dibuang lebih dulu.
-- =====================================================================

drop function if exists status_tim_harian(date);

create function status_tim_harian(p_tanggal date)
returns table (
  user_id           uuid,
  nama              text,
  inisial           text,
  unit_nama         text,
  status            status_kehadiran,
  jam_masuk         timestamptz,
  terlambat         boolean,
  menit_telat       integer,
  izin_jenis        jenis_izin,
  izin_selesai      time,
  lokasi_valid      boolean,
  persetujuan       status_persetujuan,
  wajib_lapor       boolean,
  sudah_lapor       boolean,
  unggahan_hari_ini integer,
  minimum_unggahan  integer
)
language sql
stable
as $$
  select
    u.id,
    u.nama,
    upper(left(split_part(u.nama, ' ', 1), 1)
          || left(split_part(u.nama, ' ', array_length(string_to_array(u.nama, ' '), 1)), 1)),
    coalesce(split_part(un.nama, ' (', 1), 'Manajemen'),
    coalesce(a.status, 'alpa'::status_kehadiran),
    a.jam_masuk,
    coalesce(a.terlambat, false),
    coalesce(a.menit_telat, 0),
    a.izin_jenis,
    a.izin_selesai,
    coalesce(a.lokasi_valid, false),
    a.persetujuan,
    wajib_lapor_harian(u.id),
    sudah_lapor_harian(u.id, p_tanggal),
    -- Unggahan hari itu, dijumlahkan seluruh akun yang ia pegang.
    -- null bila tidak satu pun akunnya melaporkan kolom ini.
    (
      select sum(r.jumlah_upload)::int
      from daily_reports r
      join accounts ak on ak.id = r.account_id
      where ak.pic_user_id = u.id
        and r.tanggal = p_tanggal
        and r.jumlah_upload is not null
    ),
    -- Batas minimumnya dijumlahkan dengan cara yang sama.
    (
      select sum(batas_minimum(ak.level))::int
      from accounts ak
      where ak.pic_user_id = u.id
        and ak.status = 'aktif'
        and ak.level is not null
    )
  from users u
  left join units un on un.id = u.unit_id
  left join attendance a on a.user_id = u.id and a.tanggal = p_tanggal
  where u.status = 'aktif'
  order by u.nama;
$$;

comment on function status_tim_harian(date) is
  'Dipakai Beranda: siapa sudah absen, berapa menit telat, siapa belum lapor, dan unggahannya terhadap batas minimum.';
