-- =====================================================================
-- K-Space V2 — Ringkasan keuangan sebagai layanan basis data (PRD §4)
--
-- Angka yang sama dihitung di dua tempat: `ringkasKeuangan` di
-- src/lib/keuangan.ts untuk layar, dan fungsi ini untuk apa pun yang
-- bertanya langsung ke basis data — laporan mingguan, ekspor, atau
-- pemeriksaan ulang saat angkanya diragukan.
--
-- Tiga aturan yang gampang salah dan karena itu ditulis sekali di sini:
--
--   1. NPM dihitung terhadap NET revenue — pendapatan setelah direct cost
--      dan creator share — bukan terhadap pendapatan kotor. Inilah sebab
--      NPM sistem lama selalu terlihat lebih bagus dari kenyataannya.
--   2. Aset TIDAK mengurangi laba: uangnya berpindah wujud jadi barang.
--      Ia tetap mengurangi kas.
--   3. Hanya transaksi berstatus 'dibayar' yang menggerakkan angka.
--      Pengajuan yang disetujui belum memindahkan sepeser pun.
-- =====================================================================

create or replace function ringkas_keuangan(
  p_dari date default null,
  p_sampai date default null
)
returns table (
  pendapatan numeric,
  direct_cost numeric,
  creator_share numeric,
  net_revenue numeric,
  beban numeric,
  aset numeric,
  dividen numeric,
  laba_bersih numeric,
  npm numeric,
  saldo_kas numeric,
  menunggu_persetujuan numeric
)
language sql
stable
set search_path = public
as $$
  with dipakai as (
    select *
    from transactions
    where (p_dari is null or tanggal >= p_dari)
      and (p_sampai is null or tanggal <= p_sampai)
  ),
  kas as (
    select
      coalesce(sum(jumlah) filter (where arah = 'masuk'), 0) as pendapatan,
      coalesce(sum(jumlah) filter (where jenis = 'direct_cost'), 0) as direct_cost,
      coalesce(sum(jumlah) filter (where jenis = 'creator_share'), 0) as creator_share,
      coalesce(sum(jumlah) filter (where jenis = 'beban'), 0) as beban,
      coalesce(sum(jumlah) filter (where jenis = 'aset'), 0) as aset,
      coalesce(sum(jumlah) filter (where jenis = 'dividen'), 0) as dividen
    from dipakai
    where status = 'dibayar'
  ),
  -- Saldo awal periode = kas pembuka + seluruh mutasi sebelum tanggal
  -- mulainya. Tanpa itu "saldo kas" sebuah periode akan berbohong.
  awal as (
    select coalesce((select kas_awal from keuangan_pengaturan where id), 0)
         + coalesce((
             select sum(case when arah = 'masuk' then jumlah else -jumlah end)
             from transactions
             where status = 'dibayar'
               and p_dari is not null
               and tanggal < p_dari
           ), 0) as saldo
  ),
  tertunda as (
    select coalesce(sum(jumlah), 0) as jumlah
    from dipakai
    where status = 'diajukan'
  )
  select
    kas.pendapatan,
    kas.direct_cost,
    kas.creator_share,
    kas.pendapatan - kas.direct_cost - kas.creator_share as net_revenue,
    kas.beban,
    kas.aset,
    kas.dividen,
    -- Aset dan dividen tidak muncul di sini: keduanya bukan beban.
    (kas.pendapatan - kas.direct_cost - kas.creator_share) - kas.beban as laba_bersih,
    case
      when (kas.pendapatan - kas.direct_cost - kas.creator_share) > 0
        then round(
          ((kas.pendapatan - kas.direct_cost - kas.creator_share - kas.beban)
            / (kas.pendapatan - kas.direct_cost - kas.creator_share)) * 1000
        ) / 10
      else 0
    end as npm,
    awal.saldo + kas.pendapatan - kas.direct_cost - kas.creator_share
      - kas.beban - kas.aset - kas.dividen as saldo_kas,
    tertunda.jumlah as menunggu_persetujuan
  from kas, awal, tertunda;
$$;

comment on function ringkas_keuangan is
  'Ringkasan keuangan satu periode: NPM terhadap net revenue, aset tidak mengurangi laba.';

-- ---------------------------------------------------------------------
-- Kontribusi tiap unit terhadap pendapatan (PRD §4).
--
-- Pertanyaan berikutnya setelah "labanya berapa" selalu "datangnya dari
-- mana". Direct cost dan creator share ikut dikurangkan per unit karena
-- keduanya memang melekat pada pendapatan unit itu; beban kantor tidak,
-- sebab ia milik bersama.
-- ---------------------------------------------------------------------
create or replace function kontribusi_unit(
  p_dari date default null,
  p_sampai date default null
)
returns table (
  unit_id uuid,
  unit_kode text,
  unit_nama text,
  pendapatan numeric,
  direct_cost numeric,
  creator_share numeric,
  net_revenue numeric,
  porsi numeric
)
language sql
stable
set search_path = public
as $$
  with dipakai as (
    select t.unit_id, t.arah, t.jenis, t.jumlah
    from transactions t
    where t.status = 'dibayar'
      and t.unit_id is not null
      and (p_dari is null or t.tanggal >= p_dari)
      and (p_sampai is null or t.tanggal <= p_sampai)
  ),
  per_unit as (
    select
      d.unit_id,
      coalesce(sum(d.jumlah) filter (where d.arah = 'masuk'), 0) as pendapatan,
      coalesce(sum(d.jumlah) filter (where d.jenis = 'direct_cost'), 0) as direct_cost,
      coalesce(sum(d.jumlah) filter (where d.jenis = 'creator_share'), 0) as creator_share
    from dipakai d
    group by d.unit_id
  ),
  total as (
    select nullif(sum(pendapatan - direct_cost - creator_share), 0) as net
    from per_unit
  )
  select
    u.id,
    u.kode,
    u.nama,
    p.pendapatan,
    p.direct_cost,
    p.creator_share,
    p.pendapatan - p.direct_cost - p.creator_share as net_revenue,
    coalesce(
      round(
        ((p.pendapatan - p.direct_cost - p.creator_share) / total.net) * 1000
      ) / 10,
      0
    ) as porsi
  from per_unit p
  join units u on u.id = p.unit_id
  cross join total
  order by net_revenue desc;
$$;

comment on function kontribusi_unit is
  'Pendapatan bersih per unit beserta porsinya; direct cost dan creator share melekat pada unitnya.';
