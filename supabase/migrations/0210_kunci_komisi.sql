-- =====================================================================
-- K-Space V2 — Komisi rahasia: kunci kolomnya, buka lewat pintu resmi
-- (docs/KOMISI-DETAIL-AKUN-AFFILIATOR.md §4.1, keputusan K5)
--
-- Komisi adalah angka omzet perusahaan. Yang boleh melihatnya:
--   * CEO dan Manager aktif — semua komisi;
--   * Staff — komisi laporan yang ia kirim sendiri.
-- Leader, Co-Leader, dan Finance TIDAK melihat angka komisi apa pun,
-- termasuk komisi laporannya sendiri. Mereka tetap bisa MENGISINYA.
--
-- Sebelumnya `daily_reports_baca` (0173) membuka baris laporan — dan
-- komisinya — untuk atasan pelapor, siapa pun yang melihat akunnya, dan
-- lintas angka (termasuk Finance). Menyembunyikan angka di layar tidak
-- cukup: kolomnya tetap bisa diminta lewat API.
--
-- Caranya: hak SELECT kolom komisi dicabut dari klien, hak menulis
-- tidak. Pembacaan hanya lewat fungsi security definer di bawah, yang
-- memeriksa peran pemanggil. Datanya tidak dipindahkan, jadi tidak ada
-- migrasi data, dan membatalkannya cukup dengan GRANT ulang.
--
-- CATATAN untuk migrasi berikutnya: hak baca `daily_reports` dan
-- `daily_report_revisions` kini PER KOLOM. Kolom baru di kedua tabel itu
-- tidak otomatis terbaca klien; tambahkan `grant select (kolom_baru)`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Hak per kolom
--
-- Mencabut satu kolom tidak berarti apa-apa selama hak SELECT tingkat
-- tabel masih ada (hak tabel mencakup semua kolom). Jadi hak tabelnya
-- dicabut, lalu setiap kolom selain komisi diberikan kembali.
-- ---------------------------------------------------------------------
do $$
declare
  t record;
  kolom text;
begin
  for t in
    select * from (values
      ('daily_reports', array['komisi']),
      ('daily_report_revisions', array['komisi_lama', 'komisi_baru'])
    ) as x(tabel, rahasia)
  loop
    execute format('revoke select on public.%I from anon, authenticated', t.tabel);

    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
      into kolom
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = t.tabel
      and c.column_name <> all (t.rahasia);

    execute format('grant select (%s) on public.%I to authenticated', kolom, t.tabel);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Siapa boleh melihat komisi
-- ---------------------------------------------------------------------

-- CEO/Manager aktif (peran_saya() aktif-saja sejak 0208). Finance tidak.
create or replace function boleh_lihat_komisi()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(peran_saya() in ('CEO', 'Manager'), false);
$$;

comment on function boleh_lihat_komisi() is
  'CEO/Manager aktif: boleh melihat semua angka komisi (0210, keputusan K5).';

-- Komisi sejumlah laporan. CEO/Manager: semua. Staff: hanya laporan yang
-- ia kirim sendiri. Peran lain: tidak ada baris sama sekali.
create or replace function komisi_laporan(p_ids uuid[])
returns table (report_id uuid, komisi numeric)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.komisi
  from daily_reports r
  where r.id = any (p_ids)
    and (
      boleh_lihat_komisi()
      or (peran_saya() = 'Staff' and r.user_id = auth.uid())
    );
$$;

comment on function komisi_laporan(uuid[]) is
  'Komisi laporan yang boleh dibaca pemanggil: semua bagi CEO/Manager, laporan sendiri bagi Staff (0210).';

-- Komisi laporan Staff sendiri dalam rentang — untuk capaian pribadi.
-- Leader dan Co-Leader menerima kosong: mereka mengisi komisi, tetapi
-- angkanya tidak ditampilkan lagi di mana pun (K5).
create or replace function komisi_laporan_saya(p_dari date, p_sampai date)
returns table (report_id uuid, tanggal date, account_id uuid, komisi numeric)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.tanggal, r.account_id, r.komisi
  from daily_reports r
  where peran_saya() = 'Staff'
    and r.user_id = auth.uid()
    and r.tanggal between p_dari and p_sampai;
$$;

-- Angka komisi di jejak revisi (BR-K5): CEO/Manager, dan pelapor Staff.
create or replace function komisi_revisi(p_report_ids uuid[])
returns table (revisi_id uuid, komisi_lama numeric, komisi_baru numeric)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.komisi_lama, v.komisi_baru
  from daily_report_revisions v
  join daily_reports r on r.id = v.report_id
  where v.report_id = any (p_report_ids)
    and (
      boleh_lihat_komisi()
      or (peran_saya() = 'Staff' and r.user_id = auth.uid())
    );
$$;

-- Komisi Affiliator per akun dalam rentang — kartu Komisi dan halaman
-- detail per akun. Hanya CEO/Manager aktif; selain itu galat.
-- `laporan` = laporan akun itu di rentang, `berkomisi` = yang komisinya
-- terisi (laporan sebelum komisi wajib boleh kosong, §4.3).
create or replace function komisi_affiliator(p_dari date, p_sampai date)
returns table (
  account_id uuid,
  komisi     numeric,
  laporan    integer,
  berkomisi  integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not boleh_lihat_komisi() then
    raise exception 'Hanya CEO atau Manager yang boleh melihat komisi.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select r.account_id,
         coalesce(sum(r.komisi), 0),
         count(*)::int,
         count(r.komisi)::int
  from daily_reports r
  -- Unit laporan seperti `gmv_harian_per_unit` (kartu Affiliator):
  -- laporan tingkat unit menyebutnya langsung, laporan akun mewarisinya.
  -- Laporan tingkat unit muncul dengan account_id null.
  left join accounts a on a.id = r.account_id
  join units u on u.id = coalesce(r.unit_id, a.unit_id)
  where u.kode = 'affiliator'
    and r.tanggal between p_dari and p_sampai
  group by r.account_id;
end;
$$;

-- Deret harian komisi Affiliator untuk grafik kartu Komisi.
create or replace function komisi_affiliator_harian(p_dari date, p_sampai date)
returns table (
  tanggal   date,
  komisi    numeric,
  laporan   integer,
  berkomisi integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not boleh_lihat_komisi() then
    raise exception 'Hanya CEO atau Manager yang boleh melihat komisi.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select r.tanggal,
         coalesce(sum(r.komisi), 0),
         count(*)::int,
         count(r.komisi)::int
  from daily_reports r
  left join accounts a on a.id = r.account_id
  join units u on u.id = coalesce(r.unit_id, a.unit_id)
  where u.kode = 'affiliator'
    and r.tanggal between p_dari and p_sampai
  group by r.tanggal
  order by r.tanggal;
end;
$$;

revoke execute on function komisi_laporan(uuid[]) from anon;
revoke execute on function komisi_laporan_saya(date, date) from anon;
revoke execute on function komisi_revisi(uuid[]) from anon;
revoke execute on function komisi_affiliator(date, date) from anon;
revoke execute on function komisi_affiliator_harian(date, date) from anon;

-- ---------------------------------------------------------------------
-- 3. View riwayat: tanpa kolom komisi
--
-- View ini security_invoker (0141), jadi `select *` darinya ikut
-- tertolak begitu kolom komisi terkunci. Isinya sama persis dengan
-- definisi terbarunya (0191), kecuali `l.komisi` yang dibuang; komisi
-- dibaca aplikasi lewat `komisi_laporan()`.
-- ---------------------------------------------------------------------
drop view if exists riwayat_laporan_minimum;

create view riwayat_laporan_minimum
with (security_invoker = true)
as
select
  l.id,
  l.tanggal,
  l.account_id,
  l.unit_id,
  l.gmv,
  l.jumlah_upload,
  l.catatan,
  l.status,
  l.submitted_at,
  a.username as akun_username,
  a.level as akun_level,
  batas_minimum(a.level) as minimum_unggahan,
  au.kode as akun_unit_kode,
  u.kode as unit_kode,
  u.nama as unit_nama,
  p.nama as pelapor_nama,
  l.gmv_live,
  l.jam_live
from daily_reports l
left join accounts a on a.id = l.account_id
left join units au on au.id = a.unit_id
left join units u on u.id = l.unit_id
left join users p on p.id = l.user_id
where anggota_aktif();

grant select on riwayat_laporan_minimum to authenticated;

-- ---------------------------------------------------------------------
-- 4. Perbaiki laporan tanpa membaca komisi
--
-- Fungsi ini security invoker (berjalan sebagai pelapor), dan sebelumnya
-- mengembalikan seluruh baris (`returning *`) — termasuk komisi yang kini
-- tidak boleh dibaca pelapor Leader/Co-Leader. Sekarang mengembalikan id.
--
-- Komisi kosong (null) berarti TIDAK DIUBAH, sama seperti GMV LIVE dan
-- jam LIVE (0191): Leader/Co-Leader tidak melihat komisi lamanya, jadi
-- memperbaiki GMV tidak boleh diam-diam mengosongkan komisi itu.
-- Komisi Affiliator wajib terisi sejak 0211, jadi "dikosongkan" memang
-- bukan perubahan yang sah.
-- ---------------------------------------------------------------------
drop function if exists perbaiki_laporan_harian(uuid, numeric, text, text, numeric, integer, numeric, numeric);

create function perbaiki_laporan_harian(
  p_report_id     uuid,
  p_gmv           numeric,
  p_alasan        text,
  p_catatan       text    default null,
  p_komisi        numeric default null,
  p_jumlah_upload integer default null,
  p_gmv_live      numeric default null,
  p_jam_live      numeric default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  if length(btrim(coalesce(p_alasan, ''))) < 10 then
    raise exception 'Alasan perbaikan minimal 10 karakter'
      using errcode = 'check_violation';
  end if;

  if p_gmv is null or p_gmv < 0 then
    raise exception 'Nilai GMV tidak sah' using errcode = 'check_violation';
  end if;

  perform set_config('app.alasan_revisi', btrim(p_alasan), true);

  -- Dua cabang, bukan `komisi = coalesce(p_komisi, komisi)`: membaca
  -- kolom komisi di SET butuh hak SELECT atasnya, yang sengaja tidak
  -- dimiliki klien.
  if p_komisi is null then
    update daily_reports
       set gmv = p_gmv,
           jumlah_upload = p_jumlah_upload,
           gmv_live = coalesce(p_gmv_live, gmv_live),
           jam_live = coalesce(p_jam_live, jam_live),
           catatan = coalesce(p_catatan, catatan)
     where id = p_report_id
    returning id into v_id;
  else
    update daily_reports
       set gmv = p_gmv,
           komisi = p_komisi,
           jumlah_upload = p_jumlah_upload,
           gmv_live = coalesce(p_gmv_live, gmv_live),
           jam_live = coalesce(p_jam_live, jam_live),
           catatan = coalesce(p_catatan, catatan)
     where id = p_report_id
    returning id into v_id;
  end if;

  if v_id is null then
    raise exception 'Laporan tidak ditemukan atau bukan milikmu'
      using errcode = 'insufficient_privilege';
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Capaian pribadi: komisi hanya untuk Staff, lewat pintu resmi
--
-- Isinya sama dengan definisi terbarunya (0131), kecuali kolom komisi
-- yang kini diambil dari `komisi_laporan_saya` (laporan yang dikirim
-- Staff itu sendiri). Bagi Leader/Co-Leader komisinya null.
-- ---------------------------------------------------------------------
create or replace function capaian_pribadi_saya(p_dari date, p_sampai date)
returns table (
  tanggal       date,
  target        numeric,
  gmv           numeric,
  komisi        numeric,
  jumlah_upload integer,
  co_sampel     integer,
  lingkup       text,
  departemen    text
)
language sql
stable
set search_path = public
as $$
  with akun_saya as (
    select a.id
    from accounts a
    where a.status = 'aktif' and a.pic_user_id = auth.uid()
  ),
  unit_saya as (
    select u.id
    from units u
    where not exists (
        select 1 from accounts a
        where a.unit_id = u.id and a.status = 'aktif'
      )
      and exists (
        select 1 from users me
        where me.id = auth.uid()
          and me.role = 'Leader'
          and me.unit_id = u.id
      )
  ),
  hari as (
    select d::date as tanggal
    from generate_series(p_dari, p_sampai, interval '1 day') d
  ),
  komisi_sendiri as (
    select k.report_id, k.komisi from komisi_laporan_saya(p_dari, p_sampai) k
  ),
  lapor as (
    select
      r.tanggal,
      sum(r.gmv) as gmv,
      sum(k.komisi) as komisi,
      sum(r.jumlah_upload)::int as jumlah_upload
    from daily_reports r
    left join komisi_sendiri k on k.report_id = r.id
    where r.tanggal between p_dari and p_sampai
      and (
        r.account_id in (select id from akun_saya)
        or r.unit_id in (select id from unit_saya)
      )
    group by r.tanggal
  ),
  sebutan as (
    select
      string_agg(nama, ', ' order by nama) as daftar,
      count(*)::int as jumlah,
      min(nama) as pertama,
      case when count(distinct kode) = 1 then min(kode) end as unit
    from (
      select a.username as nama, u.kode
      from accounts a join units u on u.id = a.unit_id
      where a.id in (select id from akun_saya)
      union all
      select u.nama, u.kode
      from units u where u.id in (select id from unit_saya)
    ) s
  ),
  scan as (
    select
      (sc.pada at time zone 'Asia/Jakarta')::date as tanggal,
      count(*)::int as jumlah
    from sample_scans sc
    join samples s on s.id = sc.sample_id
    where sc.dikenali
      and s.account_id in (select id from akun_saya)
      and (sc.pada at time zone 'Asia/Jakarta')::date between p_dari and p_sampai
    group by 1
  )
  select
    h.tanggal,
    coalesce(
      (select sum(t.target) from target_harian_akun(h.tanggal) t
        where t.account_id in (select id from akun_saya)), 0)
    + coalesce(
      (select sum(t.target) from target_harian_unit(h.tanggal) t
        where t.unit_id in (select id from unit_saya)), 0),
    coalesce(l.gmv, 0),
    l.komisi,
    l.jumlah_upload,
    coalesce(sc.jumlah, 0),
    case
      when sb.jumlah = 0 then null
      when sb.jumlah = 1 then sb.pertama
      else sb.pertama || ' & ' || (sb.jumlah - 1) || ' lainnya'
    end,
    sb.unit
  from hari h
  cross join sebutan sb
  left join lapor l on l.tanggal = h.tanggal
  left join scan sc on sc.tanggal = h.tanggal
  order by h.tanggal;
$$;

-- ---------------------------------------------------------------------
-- 6. GRD: lead measure bersumber komisi
--
-- `sinkron_lead_measure_laporan` menyalin jumlah komisi ke
-- `lead_measure_entries.nilai`, yang terbaca semua anggota. Entri lead
-- measure bersumber komisi kini hanya terbaca CEO/Manager; peran lain
-- melihat "Rahasia" di papan GRD (§4.1 no. 6, E9).
-- ---------------------------------------------------------------------
create policy lme_komisi_rahasia on lead_measure_entries
  as restrictive
  for select to public
  using (
    boleh_lihat_komisi()
    or not exists (
      select 1 from lead_measures m
      where m.id = lead_measure_entries.lead_measure_id
        and m.sumber_laporan = 'komisi'
    )
  );
