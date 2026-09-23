-- =====================================================================
-- K-Space V2 — Jalur tulis khusus migrasi
--
-- Dua aturan V2 yang benar untuk pemakaian sehari-hari justru menutup
-- jalan bagi data lama:
--
--   · `attendance_masuk` (0010) hanya mengizinkan orang mengabsenkan
--     dirinya sendiri. Benar — tidak boleh ada yang mengabsenkan orang
--     lain. Tetapi kehadiran tahun lalu tidak bisa diabsenkan ulang oleh
--     pemiliknya; ia harus dimasukkan oleh yang menjalankan migrasi.
--
--   · `jaga_transaksi_baru` (0097) memaksa pengeluaran baru berstatus
--     'diajukan'. Benar — pengeluaran memang harus melewati persetujuan.
--     Tetapi arus kas lama hanya mencatat yang sudah terjadi; meminta
--     orang menyetujui ulang transaksi tahun lalu bukan kehati-hatian,
--     itu pekerjaan yang hasilnya sudah pasti.
--
-- Tanpa jalur ini, mesin migrasi tidak berhenti — Supabase hanya
-- mengembalikan nol baris, dan seluruhnya tercatat "berhasil" tanpa satu
-- baris pun pindah. Kegagalan yang tidak bersuara itu justru yang paling
-- mahal.
--
-- Jadi aturannya tidak dilonggarkan. Yang dibuat adalah dua pintu sempit
-- yang hanya bisa dibuka Owner/Manager, menulis apa adanya, dan menandai
-- barisnya sebagai hasil migrasi.
-- =====================================================================

create or replace function migrasi_tulis_kehadiran(
  p_user       uuid,
  p_tanggal    date,
  p_status     status_kehadiran,
  p_jam_masuk  timestamptz default null,
  p_jam_pulang timestamptz default null,
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_alasan     text default '',
  p_persetujuan status_persetujuan default null,
  p_disetujui_oleh uuid default null,
  p_catatan_bukti text default 'Bukti di sistem lama'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh memasukkan kehadiran lama.'
      using errcode = '42501';
  end if;

  -- Keterangan asal bukti wajib terisi: baris kehadiran tanpa swafoto
  -- dan tanpa keterangan terbaca seolah orangnya tidak pernah berswafoto.
  if coalesce(trim(p_catatan_bukti), '') = '' then
    raise exception 'Kehadiran hasil migrasi harus menyebut asal buktinya.'
      using errcode = 'check_violation';
  end if;

  -- `izin_mulai`/`izin_selesai` sengaja tidak diisi: kolom itu jam,
  -- bukan tanggal (0132), dan hanya untuk izin hitungan jam. Izin
  -- beberapa hari di sistem lama menjadi beberapa baris kehadiran, satu
  -- per hari — itulah yang membuat hari-hari di tengahnya tidak terbaca
  -- sebagai mangkir.
  -- Izin dan sakit wajib beralasan dan berstatus ajuan (0010). Data lama
  -- tidak selalu menuliskan alasannya; yang kosong diberi keterangan apa
  -- adanya, bukan dikarang.
  if p_status in ('izin', 'sakit') then
    if coalesce(length(btrim(p_alasan)), 0) < 5 then
      p_alasan := 'Alasan tidak tercatat di sistem lama';
    end if;
    p_persetujuan := coalesce(p_persetujuan, 'diajukan');
  end if;

  insert into attendance (
    user_id, tanggal, status, jam_masuk, jam_pulang,
    lat_masuk, lng_masuk, lokasi_valid, terlambat,
    alasan, persetujuan, disetujui_oleh, catatan_bukti
  )
  values (
    p_user, p_tanggal, p_status, p_jam_masuk, p_jam_pulang,
    p_lat, p_lng,
    -- Koordinat lama tidak diperiksa ulang terhadap pagar kantor yang
    -- berlaku sekarang: kantornya bisa saja pindah, dan menandai
    -- kehadiran lama sebagai di luar pagar adalah tuduhan yang tidak
    -- pernah dimaksudkan siapa pun.
    true,
    p_status = 'terlambat',
    coalesce(p_alasan, ''), p_persetujuan, p_disetujui_oleh, p_catatan_bukti
  )
  on conflict (user_id, tanggal) do update set
    status        = excluded.status,
    jam_masuk     = excluded.jam_masuk,
    jam_pulang    = excluded.jam_pulang,
    lat_masuk     = excluded.lat_masuk,
    lng_masuk     = excluded.lng_masuk,
    terlambat     = excluded.terlambat,
    alasan        = excluded.alasan,
    persetujuan   = excluded.persetujuan,
    disetujui_oleh = excluded.disetujui_oleh,
    catatan_bukti = excluded.catatan_bukti
  returning id into v_id;

  return v_id;
end;
$$;

comment on function migrasi_tulis_kehadiran is
  'Satu-satunya jalan memasukkan kehadiran sistem lama; hanya Owner/Manager.';

-- ---------------------------------------------------------------------
create or replace function migrasi_tulis_transaksi(
  p_tanggal    date,
  p_arah       arah_transaksi,
  p_jenis      jenis_keluar,
  p_jumlah     numeric,
  p_keterangan text,
  p_unit       uuid default null,
  p_diajukan   uuid default null,
  p_id         uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh memasukkan arus kas lama.'
      using errcode = '42501';
  end if;

  -- Transaksi yang sudah pernah dipetakan dibiarkan apa adanya.
  --
  -- Isi transaksi yang sudah diputuskan memang tidak boleh diubah (0098),
  -- dan itu benar juga di sini: uangnya sudah keluar, dan menulis ulang
  -- angkanya karena ekspor diunggah dua kali akan mengubah catatan
  -- keuangan yang sudah dipertanggungjawabkan. Yang dikembalikan
  -- barisnya yang lama, tanpa disentuh.
  if p_id is not null then
    select id into v_id from transactions where id = p_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into transactions (
    tanggal, arah, jenis, jumlah, keterangan, unit_id, diajukan_id, status
  )
  values (
    p_tanggal, p_arah,
    case when p_arah = 'keluar' then p_jenis else null end,
    p_jumlah, p_keterangan, p_unit, p_diajukan,
    -- Trigger 0097 menimpanya menjadi 'diajukan' untuk pengeluaran baru;
    -- statusnya dikembalikan sesudah baris terbentuk.
    'diajukan'
  )
  returning id into v_id;

  -- Arus kas lama hanya mencatat yang sudah terjadi. Status transaksi
  -- hanya boleh berubah lewat pencatatan persetujuan (0098); penandanya
  -- dipasang di sini, sebatas transaksi ini, supaya penjagaan itu tetap
  -- berlaku untuk semua jalur lain.
  perform set_config('app.transaksi_via_persetujuan', 'ya', true);

  -- Tangganya tetap dilewati satu per satu (0098): 'diajukan' →
  -- 'disetujui' → 'dibayar'. Melompatinya akan membuat perpindahan
  -- status yang tidak sah lolos lewat pintu ini, dan pintu yang
  -- melonggarkan aturan lebih dari yang perlu berhenti bisa dipercaya.
  update transactions
     set status = 'disetujui',
         disetujui_id = coalesce(disetujui_id, p_diajukan),
         diputuskan_pada = coalesce(diputuskan_pada, now())
   where id = v_id;

  update transactions set status = 'dibayar' where id = v_id;

  perform set_config('app.transaksi_via_persetujuan', '', true);

  return v_id;
end;
$$;

comment on function migrasi_tulis_transaksi is
  'Memasukkan arus kas sistem lama sebagai transaksi dibayar; hanya Owner/Manager.';

-- ---------------------------------------------------------------------
-- Laporan harian
-- ---------------------------------------------------------------------
-- `daily_reports_kirim` (0005) hanya mengizinkan orang mengirim laporan
-- atas namanya sendiri — benar, karena laporan adalah pernyataan orang
-- tentang pekerjaannya. Laporan tahun lalu tidak bisa dikirim ulang oleh
-- pemiliknya; ia harus dimasukkan oleh yang menjalankan migrasi.
create or replace function migrasi_tulis_laporan(
  p_user     uuid,
  p_tanggal  date,
  p_account  uuid,
  p_unit     uuid,
  p_gmv      numeric,
  p_komisi   numeric default null,
  p_upload   integer default null,
  p_catatan  text default '',
  p_dikirim  timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh memasukkan laporan lama.'
      using errcode = '42501';
  end if;

  insert into daily_reports (
    user_id, tanggal, account_id, unit_id, gmv, komisi, jumlah_upload,
    catatan, status, submitted_at
  )
  values (
    p_user, p_tanggal, p_account, p_unit, p_gmv, p_komisi, p_upload,
    coalesce(p_catatan, ''), 'terkirim', coalesce(p_dikirim, now())
  )
  returning id into v_id;

  return v_id;
exception
  -- Laporan untuk sasaran dan tanggal yang sama sudah ada: itu bukan
  -- kegagalan, itu pengulangan yang memang ditahan indeks uniknya.
  when unique_violation then
    return null;
end;
$$;

comment on function migrasi_tulis_laporan is
  'Satu-satunya jalan memasukkan laporan harian sistem lama; hanya Owner/Manager.';
