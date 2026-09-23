-- =====================================================================
-- K-Space V2 — Padanan SQL `hitungKepatuhanMinimum`
--
-- Fungsi murni di `src/lib/batas-minimum.ts` menilai satu akun untuk
-- layar. Rekap massal tidak bisa memakainya: menarik seluruh laporan
-- dan absensi sebulan ke browser hanya untuk menghitung persentase
-- adalah pekerjaan yang memang milik basis data.
--
-- Karena itu ada dua tempat, dan keduanya WAJIB sepakat. Aturannya
-- ditulis sama persis:
--   1. Hanya hari dengan absensi masuk yang masuk pembagi. Izin yang
--      disetujui, sakit, dan hari tanpa absensi tidak dihitung.
--   2. Hari kerja tanpa laporan dinilai TIDAK terpenuhi.
--   3. Tepat di batas sudah terpenuhi.
--   4. Akun tanpa level tidak dinilai — rasionya null, bukan nol.
--
-- `supabase/tests/kepatuhan-minimum.test.mjs` membandingkan hasilnya
-- dengan hasil fungsi murni pada kasus yang sama.
-- =====================================================================

create or replace function kepatuhan_minimum_akun(
  p_account_id uuid,
  p_dari date,
  p_sampai date
)
returns table (
  hari_kerja integer,
  terpenuhi  integer,
  rasio      numeric,
  minimum    integer
)
language sql
stable
set search_path = public
as $$
  with akun as (
    select a.id, a.pic_user_id, batas_minimum(a.level) as minimum
    from accounts a
    where a.id = p_account_id
  ),
  -- Hari kerja = pemegang akunnya benar-benar absen masuk hari itu.
  -- Izin harian dan sakit tidak punya jam_masuk, jadi terjaring sendiri;
  -- izin berjam tetap terhitung hari kerja karena orangnya memang masuk.
  hari as (
    select t.tanggal
    from attendance t, akun
    where t.user_id = akun.pic_user_id
      and t.tanggal between p_dari and p_sampai
      and t.jam_masuk is not null
  ),
  dinilai as (
    select
      h.tanggal,
      coalesce(r.jumlah_upload, 0) as unggahan
    from hari h
    left join daily_reports r
      on r.account_id = p_account_id and r.tanggal = h.tanggal
  )
  -- `count(d.tanggal)`, bukan `count(*)`: right join tetap menghasilkan
  -- satu baris kosong saat rentangnya tanpa absensi sama sekali, dan
  -- baris itu akan terhitung sebagai satu hari kerja yang tidak ada.
  select
    count(d.tanggal)::int,
    count(*) filter (
      where d.tanggal is not null
        and akun.minimum is not null
        and d.unggahan >= akun.minimum
    )::int,
    case
      when akun.minimum is null or count(d.tanggal) = 0 then null
      else round(
        count(*) filter (
          where d.tanggal is not null and d.unggahan >= akun.minimum
        )::numeric
        / count(d.tanggal) * 100,
        1
      )
    end,
    akun.minimum
  from dinilai d
  right join akun on true
  group by akun.minimum;
$$;

comment on function kepatuhan_minimum_akun(uuid, date, date) is
  'Kepatuhan sebuah akun terhadap batas minimum levelnya; padanan hitungKepatuhanMinimum.';

-- ---------------------------------------------------------------------
-- Kepatuhan seseorang: rata-rata kepatuhan seluruh akun yang ia pegang.
--
-- Rata-rata per AKUN, bukan per hari yang digabung — supaya satu akun
-- ramai tidak menutupi satu akun sepi.
-- ---------------------------------------------------------------------
create or replace function kepatuhan_minimum_orang(
  p_user_id uuid,
  p_dari date,
  p_sampai date
)
returns table (
  akun_dinilai integer,
  hari_kerja   integer,
  terpenuhi    integer,
  rasio        numeric
)
language sql
stable
set search_path = public
as $$
  with per_akun as (
    select k.*
    from accounts a
    cross join lateral kepatuhan_minimum_akun(a.id, p_dari, p_sampai) k
    where a.pic_user_id = p_user_id and a.status = 'aktif'
  ),
  dinilai as (select * from per_akun where rasio is not null)
  select
    (select count(*) from dinilai)::int,
    coalesce((select sum(hari_kerja) from dinilai), 0)::int,
    coalesce((select sum(terpenuhi) from dinilai), 0)::int,
    (select round(avg(rasio), 1) from dinilai);
$$;

comment on function kepatuhan_minimum_orang(uuid, date, date) is
  'Rata-rata kepatuhan seluruh akun aktif yang dipegang seseorang.';
