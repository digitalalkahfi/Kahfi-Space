-- =====================================================================
-- K-Space V2 — Tren kepatuhan tiga hari terakhir per akun
--
-- Angka kepatuhan sebulan menjawab "seberapa patuh", tapi tidak menjawab
-- "sedang membaik atau memburuk". Tiga hari terakhir itulah yang dilihat
-- Leader saat memutuskan siapa yang perlu ditegur hari ini.
--
-- Dibuat sebagai VIEW, bukan kolom baru di tabel mana pun: isinya murni
-- turunan dari absensi + laporan, jadi menyimpannya berarti menyediakan
-- satu lagi angka yang bisa basi.
--
-- "Tiga hari terakhir" berarti tiga HARI KERJA terakhir akun itu — hari
-- dengan absensi masuk pemegangnya. Kalau dipakai tiga hari kalender,
-- akhir pekan akan selalu terbaca sebagai "tidak memenuhi minimum".
-- =====================================================================

-- security_invoker: view ini ikut aturan baca pemanggilnya. Staff hanya
-- melihat akunnya sendiri, Leader melihat unitnya — persis seperti saat
-- ia membaca `accounts` dan `daily_reports` langsung.
create view tren_kepatuhan_tiga_hari
with (security_invoker = true)
as
with dinilai as (
  select
    a.id                       as account_id,
    batas_minimum(a.level)     as minimum,
    t.tanggal,
    -- Sengaja tidak di-coalesce ke nol: layar perlu membedakan
    -- "melapor nol" dari "tidak melapor sama sekali".
    r.jumlah_upload            as unggahan,
    row_number() over (
      partition by a.id order by t.tanggal desc
    )                          as urutan
  from accounts a
  join attendance t
    on t.user_id = a.pic_user_id
   and t.jam_masuk is not null
   and t.tanggal <= current_date
  left join daily_reports r
    on r.account_id = a.id and r.tanggal = t.tanggal
  where a.status = 'aktif'
),
tiga as (
  select
    d.account_id,
    d.minimum,
    array_agg(d.tanggal order by d.tanggal)  as tanggal,
    array_agg(d.unggahan order by d.tanggal) as unggahan,
    array_agg(
      d.minimum is not null and coalesce(d.unggahan, 0) >= d.minimum
      order by d.tanggal
    )                                        as terpenuhi,
    count(*) filter (
      where d.minimum is not null and coalesce(d.unggahan, 0) >= d.minimum
    )::int                                   as jumlah_terpenuhi,
    count(*)::int                            as hari_dinilai
  from dinilai d
  where d.urutan <= 3
  group by d.account_id, d.minimum
)
select
  a.id                            as account_id,
  a.username,
  u.kode                          as unit_kode,
  a.pic_user_id,
  a.level,
  batas_minimum(a.level)          as minimum,
  coalesce(g.hari_dinilai, 0)     as hari_dinilai,
  coalesce(g.jumlah_terpenuhi, 0) as jumlah_terpenuhi,
  -- Urutan array selalu lama → baru, supaya layar bisa menggambarnya
  -- apa adanya tanpa membalik sendiri.
  g.tanggal,
  g.unggahan,
  g.terpenuhi,
  -- Arah dibandingkan ujung ke ujung, bukan hari terakhir lawan hari
  -- sebelumnya: satu hari sepi di tengah tidak boleh terbaca sebagai
  -- tren turun. Kurang dari dua hari berarti belum ada tren apa pun.
  case
    when coalesce(g.hari_dinilai, 0) < 2 then null
    when coalesce(g.unggahan[g.hari_dinilai], 0)
       > coalesce(g.unggahan[1], 0) then 'naik'
    when coalesce(g.unggahan[g.hari_dinilai], 0)
       < coalesce(g.unggahan[1], 0) then 'turun'
    else 'datar'
  end                             as arah,
  -- Berapa hari TERAKHIR berturut-turut yang di bawah minimum. Inilah
  -- yang dipakai menandai akun untuk ditindaklanjuti; nol berarti hari
  -- terakhirnya sudah memenuhi.
  case
    when g.minimum is null or coalesce(g.hari_dinilai, 0) = 0 then 0
    when g.terpenuhi[g.hari_dinilai] then 0
    when g.hari_dinilai >= 2 and g.terpenuhi[g.hari_dinilai - 1] then 1
    when g.hari_dinilai >= 3 and g.terpenuhi[g.hari_dinilai - 2] then 2
    else g.hari_dinilai
  end                             as beruntun_kurang
from accounts a
join units u on u.id = a.unit_id
left join tiga g on g.account_id = a.id
where a.status = 'aktif'
  and auth.uid() is not null;

comment on view tren_kepatuhan_tiga_hari is
  'Tren kepatuhan tiga hari kerja terakhir per akun aktif: unggahan, terpenuhi, arah, dan beruntun di bawah minimum.';

grant select on tren_kepatuhan_tiga_hari to authenticated;
