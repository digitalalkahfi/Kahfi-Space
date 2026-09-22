-- =====================================================================
-- K-Space V2 — Penyusutan & nilai buku aset (PRD Rilis 2)
--
-- Penyusutannya garis lurus: (nilai perolehan − residu) ÷ masa manfaat,
-- dihitung per BULAN PENUH. Bukan harian — pembukuan mencatatnya sekali
-- sebulan, dan menghitung harian hanya membuat angka di layar berbeda
-- dari angka di jurnal tanpa menambah ketelitian apa pun.
--
-- Tiga hal yang mudah salah dan karena itu ditulis sekali di sini:
--
--   1. Penyusutan berhenti di akhir masa manfaat. Nilai bukunya tinggal
--      residu, bukan nol, dan tidak pernah minus.
--   2. Penyusutan juga berhenti saat asetnya berhenti dimiliki — dilepas
--      atau dinyatakan hilang. Nilai bukunya lalu nol, bukan karena
--      barangnya tak berharga, melainkan karena ia bukan milik kita lagi.
--   3. Aset bermasa manfaat 0 tidak disusutkan sama sekali.
--
-- Semuanya padanan persis fungsi murni di src/lib/aset.ts; test skema
-- membandingkan keduanya angka demi angka.
-- =====================================================================

-- Bulan penuh antara dua tanggal; tanggal 15 → 14 belum genap sebulan.
create or replace function bulan_penuh(p_dari date, p_sampai date)
returns int
language sql
immutable
as $$
  select greatest(
    0,
    (extract(year from p_sampai)::int - extract(year from p_dari)::int) * 12
      + (extract(month from p_sampai)::int - extract(month from p_dari)::int)
      - case
          when p_sampai < p_dari then 0
          when extract(day from p_sampai) < extract(day from p_dari) then 1
          else 0
        end
  );
$$;

create or replace function penyusutan_per_bulan(p_aset assets)
returns numeric
language sql
immutable
as $$
  select case
    when p_aset.masa_manfaat <= 0 then 0
    else greatest(0, p_aset.nilai_perolehan - p_aset.residu) / p_aset.masa_manfaat
  end;
$$;

create or replace function akumulasi_penyusutan(p_aset assets, p_sampai date)
returns numeric
language sql
immutable
as $$
  select round(
    penyusutan_per_bulan(p_aset) * least(
      bulan_penuh(
        p_aset.tanggal,
        case
          when p_aset.berakhir is not null and p_aset.berakhir < p_sampai
            then p_aset.berakhir
          else p_sampai
        end
      ),
      p_aset.masa_manfaat
    )
  );
$$;

create or replace function nilai_buku(p_aset assets, p_sampai date)
returns numeric
language sql
immutable
as $$
  select case
    when p_aset.status in ('dilepas', 'hilang') then 0
    else p_aset.nilai_perolehan - akumulasi_penyusutan(p_aset, p_sampai)
  end;
$$;

-- Nilai yang hangus saat aset hilang: nilai bukunya tepat sebelum
-- dinyatakan hilang — itulah angka kerugiannya, bukan harga belinya.
create or replace function nilai_hangus(p_aset assets, p_sampai date)
returns numeric
language sql
immutable
as $$
  select case
    when p_aset.status <> 'hilang' then 0
    else p_aset.nilai_perolehan - akumulasi_penyusutan(p_aset, p_sampai)
  end;
$$;

-- ---------------------------------------------------------------------
-- Daftar aset beserta nilai bukunya pada satu tanggal.
-- ---------------------------------------------------------------------
create or replace function nilai_buku_aset(p_sampai date default null)
returns table (
  id uuid,
  kode text,
  nama text,
  kategori text,
  unit_nama text,
  status status_aset,
  tanggal date,
  nilai_perolehan numeric,
  akumulasi_penyusutan numeric,
  nilai_buku numeric,
  sisa_masa_manfaat int
)
language sql
stable
set search_path = public
as $$
  select
    a.id,
    a.kode,
    a.nama,
    a.kategori,
    coalesce(u.nama, 'Perusahaan'),
    a.status,
    a.tanggal,
    a.nilai_perolehan,
    akumulasi_penyusutan(a, coalesce(p_sampai, current_date)),
    nilai_buku(a, coalesce(p_sampai, current_date)),
    case
      when a.masa_manfaat <= 0 then 0
      else greatest(
        0,
        a.masa_manfaat
          - bulan_penuh(a.tanggal, coalesce(p_sampai, current_date))
      )
    end
  from assets a
  left join units u on u.id = a.unit_id
  order by a.kode;
$$;

comment on function nilai_buku_aset is
  'Nilai buku tiap aset pada satu tanggal; penyusutan garis lurus per bulan penuh.';

-- ---------------------------------------------------------------------
-- Ringkasan: berapa nilai barang yang masih dimiliki, dan berapa yang
-- sudah hangus. Aset yang dilepas atau hilang tidak ikut dijumlah —
-- perusahaan tidak lagi memilikinya.
--
-- Ini angka seluruh perusahaan, jadi ia hanya dijawab untuk pemegang
-- angka perusahaan. Yang lain mendapat nol: RLS memang akan menyisakan
-- aset yang ia pegang sendiri, dan menjumlahkan sisa itu lalu
-- menyebutnya "nilai aset perusahaan" adalah jawaban yang terlihat sah
-- dan diam-diam salah.
-- ---------------------------------------------------------------------
create or replace function ringkas_nilai_aset(p_sampai date default null)
returns table (
  dimiliki int,
  total int,
  nilai_perolehan numeric,
  akumulasi_penyusutan numeric,
  nilai_buku numeric,
  perlu_perhatian int,
  tanpa_pemegang int,
  nilai_hilang numeric,
  susut_bulan_ini numeric
)
language sql
stable
set search_path = public
as $$
  with sampai as (select coalesce(p_sampai, current_date) as hari),
  terlihat as (select a.* from assets a where lintas_angka()),
  milik as (
    select t.* from terlihat t
    where t.status not in ('dilepas', 'hilang')
  )
  select
    (select count(*)::int from milik),
    (select count(*)::int from terlihat),
    coalesce((select sum(nilai_perolehan) from milik), 0),
    coalesce((
      select sum(akumulasi_penyusutan(m, s.hari)) from milik m, sampai s
    ), 0),
    coalesce((select sum(nilai_buku(m, s.hari)) from milik m, sampai s), 0),
    (select count(*)::int from terlihat where status in ('perbaikan', 'hilang')),
    (
      select count(*)::int from terlihat
      where status = 'dipakai' and pemegang_id is null
    ),
    coalesce((
      select sum(nilai_hangus(a, s.hari)) from terlihat a, sampai s
    ), 0),
    coalesce((
      select sum(penyusutan_per_bulan(m))
      from milik m, sampai s
      where m.masa_manfaat > 0
        and bulan_penuh(m.tanggal, s.hari) < m.masa_manfaat
    ), 0);
$$;

comment on function ringkas_nilai_aset is
  'Nilai perolehan, penyusutan, dan nilai buku seluruh aset yang masih dimiliki.';
