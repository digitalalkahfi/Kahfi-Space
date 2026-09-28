-- =====================================================================
-- K-Space V2 — Hak akses mengikuti struktur organisasi
--
-- Sebelumnya cakupan data berbasis UNIT: Leader dan Co-Leader melihat
-- seluruh anggota unitnya, dan beberapa baris tingkat unit terbuka
-- untuk semua Staff unit itu. Sekarang cakupannya mengikuti garis
-- pelaporan (`users.atasan_id`):
--
--   * Staff      : hanya data dirinya sendiri.
--   * Co-Leader  : dirinya + Staff yang melapor kepadanya (transitif).
--   * Leader     : dirinya + seluruh Co-Leader/Staff di bawahnya.
--   * Manager/CEO: seluruh organisasi (`lintas_unit`).
--   * Finance    : tetap `lintas_angka` untuk angka perusahaan (GMV,
--                  goal, keuangan), bukan data operasional orang.
--
-- Yang tetap berbasis unit (konteks bersama, bukan data orang): goal
-- tingkat unit, laporan tingkat unit MCN/TAP, agenda, catatan unit,
-- sampel, dan masalah unit. Direktori `users` tetap terbaca semua
-- pengguna karena nama dipakai di seluruh aplikasi; pembatasannya
-- dilakukan halaman Tim.
--
-- Tiga fungsi yang selama ini bocor lintas unit ikut dipagari:
-- `scorecard_tim`, `status_tim_harian`, dan `sudah_lapor_harian`
-- (beserta `realisasi_*` yang berjalan sebagai pemilik).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Bawahan transitif pemanggil, tanpa dirinya sendiri.
-- Siklus atasan sudah dicegah trigger 0044; `union` (bukan `union all`)
-- tetap menghentikan pengulangan seandainya data lama tidak rapi.
-- ---------------------------------------------------------------------
create or replace function bawahan_saya()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with recursive pohon as (
    select u.id from users u where u.atasan_id = auth.uid()
    union
    select u.id from users u join pohon p on u.atasan_id = p.id
  )
  select id from pohon;
$$;

comment on function bawahan_saya() is
  'Id seluruh bawahan pemanggil, langsung maupun lewat bawahannya (0173).';

-- ---------------------------------------------------------------------
-- Pemanggil sistem: sesi tanpa JWT yang BUKAN peran klien — migrasi,
-- seed, tes, dan service role. Pengunjung anonim juga tanpa `auth.uid()`,
-- tetapi peran sesinya `anon`, jadi tidak lolos. Dipakai supaya fungsi
-- yang menyaring dengan `boleh_orang` tetap utuh bagi proses sistem
-- tanpa membuka apa pun untuk yang belum masuk.
-- ---------------------------------------------------------------------
create or replace function pemanggil_sistem()
returns boolean
language sql
stable
as $$
  select auth.uid() is null
     and coalesce(current_setting('role', true), 'none')
         not in ('anon', 'authenticated');
$$;

comment on function pemanggil_sistem() is
  'Sesi tanpa JWT dengan peran bukan anon/authenticated: migrasi, seed, tes, service role (0173).';

-- Boleh melihat data seseorang: diri sendiri, bawahan, atau lintas unit.
create or replace function boleh_orang(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_user is null then false
    when pemanggil_sistem() then true
    when target_user = auth.uid() then true
    when lintas_unit() then true
    else exists (select 1 from bawahan_saya() b where b = target_user)
  end;
$$;

comment on function boleh_orang(uuid) is
  'Diri sendiri, bawahan transitif, CEO/Manager, atau pemanggil sistem (0173).';

-- ---------------------------------------------------------------------
-- Akun: yang memegangnya, yang mendampinginya, atasan pemegangnya, dan
-- pimpinan unit untuk akun yang belum punya PIC (supaya bisa ditindak).
-- ---------------------------------------------------------------------
drop policy if exists accounts_baca on accounts;
create policy accounts_baca on accounts
  for select
  using (
    lintas_angka()
    or pic_user_id = auth.uid()
    or co_leader_id = auth.uid()
    or boleh_orang(pic_user_id)
    or (memimpin_unit() and pic_user_id is null and unit_id = unit_saya())
  );

-- ---------------------------------------------------------------------
-- Laporan harian: pelapor dan atasannya; laporan akun mengikuti siapa
-- yang boleh melihat akunnya; laporan tingkat unit tetap konteks unit.
-- ---------------------------------------------------------------------
drop policy if exists daily_reports_baca on daily_reports;
create policy daily_reports_baca on daily_reports
  for select
  using (
    lintas_angka()
    or user_id = auth.uid()
    or boleh_orang(user_id)
    or (account_id is not null
        and exists (select 1 from accounts a where a.id = account_id))
    or (unit_id is not null and boleh_unit(unit_id))
  );

-- ---------------------------------------------------------------------
-- Goal: goal akun mengikuti akunnya; goal pribadi (level staff) mengikuti
-- hierarki; goal level leader adalah TARGET UNIT — dimiliki Leader tetapi
-- menjadi acuan bersama (papan lead measure, WRM), jadi tetap terbaca
-- anggota unit itu. Goal company/manager hanya untuk lintas angka.
-- ---------------------------------------------------------------------
drop policy if exists goals_baca on goals;
create policy goals_baca on goals
  for select
  using (
    lintas_angka()
    or pemilik_id = auth.uid()
    or boleh_orang(pemilik_id)
    or (account_id is not null
        and exists (select 1 from accounts a where a.id = account_id))
    or (level = 'leader' and boleh_unit(unit_id))
    or (account_id is null and pemilik_id is null and boleh_unit(unit_id))
  );

-- Alokasi anggaran: pimpinan hanya melihat pengajuan unitnya sendiri.
drop policy if exists alokasi_baca on budget_allocations;
create policy alokasi_baca on budget_allocations
  for select
  using (
    lintas_angka()
    or diajukan_id = auth.uid()
    or (memimpin_unit() and unit_id = unit_saya())
  );

-- ---------------------------------------------------------------------
-- Fungsi pembantu yang berjalan sebagai pemilik: hanya menjawab untuk
-- orang dalam cakupan pemanggil. Proses sistem (seed, migrasi, service
-- role) tetap mendapat jawaban lewat `pemanggil_sistem()` di boleh_orang.
-- ---------------------------------------------------------------------
create or replace function sudah_lapor_harian(p_user uuid, p_tanggal date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select boleh_orang(p_user)
     and exists (
       select 1 from daily_reports r
       where r.user_id = p_user and r.tanggal = p_tanggal
     );
$$;

create or replace function wajib_lapor_harian(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select boleh_orang(p_user)
     and (
       exists (
         select 1 from accounts a
         where a.status = 'aktif' and a.pic_user_id = p_user
       )
       or exists (
         select 1
         from users u
         join units un on un.id = u.unit_id
         where u.id = p_user
           and u.role = 'Leader'
           and not exists (
             select 1 from accounts a
             where a.unit_id = un.id and a.status = 'aktif'
           )
       )
     );
$$;

-- Overload lama tiga argumen (0029) tidak pernah dilepas; ia berjalan
-- sebagai pemilik tanpa pagar. Dilepas sekarang.
drop function if exists realisasi_kpi(uuid, sumber_kpi, date);

create or replace function realisasi_gmv_kpi(
  p_user uuid,
  p_bulan date,
  p_sampai date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with pengguna as (
    select id, role, unit_id from users
    where id = p_user and boleh_orang(p_user)
  ),
  rentang as (
    select
      p_bulan as dari,
      least(p_sampai, (p_bulan + interval '1 month - 1 day')::date) as sampai,
      greatest(porsi_bulan_berjalan(p_bulan, p_sampai), 0.01) as porsi
  ),
  punya_akun as (
    select exists (
      select 1 from accounts a
      join pengguna p on a.pic_user_id = p.id
      join goals g on g.account_id = a.id and g.status = 'aktif'
      join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
      where a.status = 'aktif'
    ) as ada
  ),
  sasaran as (
    select gm.target, coalesce((
      select sum(r.gmv) from daily_reports r
      where r.account_id = a.id
        and r.tanggal between (select dari from rentang) and (select sampai from rentang)
    ), 0) as realisasi
    from pengguna p
    join accounts a on a.pic_user_id = p.id and a.status = 'aktif'
    join goals g on g.account_id = a.id and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role = 'Staff'

    union all

    select gm.target, gmv_unit_bulan(p.unit_id, (select sampai from rentang))
    from pengguna p
    join goals g on g.unit_id = p.unit_id and g.account_id is null and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role = 'Staff'
      and p.unit_id is not null
      and not (select ada from punya_akun)

    union all

    select gm.target, gmv_unit_bulan(p.unit_id, (select sampai from rentang))
    from pengguna p
    join goals g on g.unit_id = p.unit_id and g.account_id is null and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role in ('Leader', 'Co-Leader') and p.unit_id is not null

    union all

    select gm.target, coalesce((
      select sum(r.gmv) from daily_reports r
      where r.tanggal between (select dari from rentang) and (select sampai from rentang)
    ), 0)
    from pengguna p
    join goals g on g.level in ('company', 'manager') and g.status = 'aktif'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role in ('Manager', 'CEO') and g.pemilik_id = p.id
  )
  select case when coalesce(sum(target), 0) > 0
    then sum(realisasi) / (sum(target) * (select porsi from rentang)) * 100
    else null end
  from sasaran;
$$;

create or replace function realisasi_lead_measure_kpi(
  p_user uuid,
  p_bulan date,
  p_sampai date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with pengguna as (
    select id, role, unit_id from users
    where id = p_user and boleh_orang(p_user)
  ),
  rentang as (
    select p_bulan as dari,
           least(p_sampai, (p_bulan + interval '1 month - 1 day')::date) as sampai
  ),
  entri as (
    select e.lead_measure_id, e.nilai, e.tanggal
    from lead_measure_entries e
    join lead_measures lm on lm.id = e.lead_measure_id and lm.aktif
    left join goals g on g.id = lm.goal_id
    cross join pengguna p
    where e.tanggal between (select dari from rentang) and (select sampai from rentang)
      and (
        (p.role = 'Staff' and e.user_id = p.id)
        or (p.role in ('Leader', 'Co-Leader') and g.unit_id = p.unit_id)
        or (p.role in ('Manager', 'CEO'))
      )
  ),
  sasaran as (
    select
      sum(x.realisasi) as realisasi,
      sum(lm.target_mingguan * x.pekan) as target
    from (
      select lead_measure_id,
             sum(nilai) as realisasi,
             count(distinct awal_pekan(tanggal)) as pekan
      from entri group by lead_measure_id
    ) x
    join lead_measures lm on lm.id = x.lead_measure_id
  )
  select case when coalesce(target, 0) > 0 then realisasi / target * 100 else null end
  from sasaran;
$$;

create or replace function realisasi_kpi(
  p_user uuid,
  p_sumber sumber_kpi,
  p_bulan date,
  p_sampai date default current_date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with rentang as (
    select p_bulan as dari,
           least(p_sampai, (p_bulan + interval '1 month - 1 day')::date) as sampai
  )
  select case
    when not boleh_orang(p_user) then null

    when p_sumber = 'gmv' then realisasi_gmv_kpi(p_user, p_bulan, p_sampai)

    when p_sumber = 'lead_measure' then realisasi_lead_measure_kpi(p_user, p_bulan, p_sampai)

    when p_sumber = 'absensi' then (
      select case when count(*) > 0
        then count(*) filter (where status = 'hadir')::numeric / count(*) * 100
        else null end
      from attendance
      where user_id = p_user
        and tanggal between (select dari from rentang) and (select sampai from rentang)
    )

    when p_sumber = 'tiket' then (
      select case when count(*) > 0
        then count(*) filter (where status = 'selesai')::numeric / count(*) * 100
        else null end
      from tasks
      where penerima_id = p_user
        and tipe <> 'pribadi'
        and coalesce(tenggat::date, created_at::date)
            between (select dari from rentang) and (select sampai from rentang)
    )

    else null
  end;
$$;

-- ---------------------------------------------------------------------
-- Fungsi tampilan yang membaca `users` (terbuka untuk semua) kini
-- menyaring orangnya dengan `boleh_orang`, bukan sekadar mengandalkan
-- RLS tabel anaknya — yang sebelumnya membuat orang di luar cakupan
-- tampil dengan angka kosong.
-- ---------------------------------------------------------------------
create or replace function hitung_kpi(
  p_user uuid,
  p_bulan date,
  p_sampai date default current_date
)
returns table (
  skor_total numeric,
  predikat predikat_kpi,
  cakupan numeric,
  detail jsonb
)
language sql
stable
as $$
  with dinilai as (
    select
      k.nama_kpi, k.bobot, k.satuan, k.sumber_data,
      r.realisasi,
      case when r.realisasi is null then null
        else skor_kpi(r.realisasi, k.target_base, k.target_goal, k.target_stretch)
      end as skor
    from users u
    join kpi_definitions k on k.jabatan = u.role::text and k.aktif
    cross join lateral (
      select realisasi_kpi(u.id, k.sumber_data, p_bulan, p_sampai) as realisasi
    ) r
    where u.id = p_user
      and boleh_orang(u.id)
  ),
  hasil as (
    select
      case when sum(bobot) filter (where skor is not null) > 0
        then round(
          sum(skor * bobot) filter (where skor is not null)
          / sum(bobot) filter (where skor is not null), 1)
        else 0 end as total,
      case when sum(bobot) > 0
        then round(
          coalesce(sum(bobot) filter (where skor is not null), 0)
          / sum(bobot) * 100, 0)
        else 0 end as cakupan,
      jsonb_agg(jsonb_build_object(
        'nama', nama_kpi, 'bobot', bobot, 'satuan', satuan,
        'sumber', sumber_data,
        'realisasi', case when realisasi is null then null else round(realisasi, 1) end,
        'skor', skor,
        'berlaku', skor is not null
      ) order by bobot desc, nama_kpi) as rincian
    from dinilai
  )
  select total, predikat_dari_skor(total), cakupan, coalesce(rincian, '[]'::jsonb)
  from hasil;
$$;

create or replace function scorecard_tim(p_bulan date, p_sampai date default current_date)
returns table (
  user_id uuid, nama text, inisial text, jabatan text, unit text,
  skor numeric, predikat predikat_kpi, cakupan numeric,
  detail jsonb, terkunci boolean
)
language sql
stable
as $$
  with baris as (
    select
      u.id as user_id, u.nama,
      upper(left(split_part(u.nama, ' ', 1), 1)
            || left(split_part(u.nama, ' ', array_length(string_to_array(u.nama, ' '), 1)), 1)) as inisial,
      u.jabatan,
      coalesce(split_part(un.nama, ' (', 1), 'Manajemen') as unit,
      coalesce(s.skor_total, h.skor_total, 0) as skor,
      coalesce(s.predikat, h.predikat, 'Perlu Perbaikan'::predikat_kpi) as predikat,
      coalesce(s.cakupan, h.cakupan, 0) as cakupan,
      coalesce(s.detail, h.detail, '[]'::jsonb) as detail,
      s.dikunci_pada is not null as terkunci
    from users u
    left join units un on un.id = u.unit_id
    left join kpi_snapshots s on s.user_id = u.id and s.periode_bulan = p_bulan
    left join lateral hitung_kpi(u.id, p_bulan, p_sampai) h on true
    where u.status = 'aktif'
      and boleh_orang(u.id)
  )
  select user_id, nama, inisial, jabatan, unit, skor, predikat, cakupan, detail, terkunci
  from baris
  order by (cakupan >= 100) desc, skor desc, nama;
$$;

comment on function scorecard_tim(date, date) is
  'Scorecard KPI orang-orang dalam cakupan pemanggil: dirinya dan bawahannya; CEO/Manager semua (0173).';

create or replace function status_kunci_kpi(p_bulan date)
returns table (
  terkunci     integer,
  belum        integer,
  dikunci_oleh text,
  dikunci_pada timestamptz,
  bulan_tuntas boolean
)
language sql
stable
as $$
  with bisa as (
    select count(*)::int n
    from users u
    cross join lateral hitung_kpi(
      u.id, p_bulan, (p_bulan + interval '1 month - 1 day')::date) h
    where u.status = 'aktif' and boleh_orang(u.id) and h.cakupan > 0
  ),
  snap as (
    select
      count(*) filter (where s.dikunci_pada is not null)::int terkunci,
      max(s.dikunci_pada) pada,
      (array_agg(u.nama order by s.dikunci_pada desc nulls last))[1] oleh
    from kpi_snapshots s
    left join users u on u.id = s.dikunci_oleh
    where s.periode_bulan = p_bulan
  )
  select
    snap.terkunci,
    greatest(bisa.n - snap.terkunci, 0),
    snap.oleh,
    snap.pada,
    (p_bulan + interval '1 month')::date <= current_date
  from bisa, snap;
$$;

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
  minimum_unggahan  integer,
  wajib_absen       boolean
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
    (
      select sum(r.jumlah_upload)::int
      from daily_reports r
      join accounts ak on ak.id = r.account_id
      where ak.pic_user_id = u.id
        and r.tanggal = p_tanggal
        and r.jumlah_upload is not null
    ),
    (
      select sum(batas_minimum(ak.level))::int
      from accounts ak
      where ak.pic_user_id = u.id
        and ak.status = 'aktif'
        and ak.level is not null
    ),
    peran_wajib_absen(u.role)
  from users u
  left join units un on un.id = u.unit_id
  left join attendance a on a.user_id = u.id and a.tanggal = p_tanggal
  where u.status = 'aktif'
    and boleh_orang(u.id)
  order by u.nama;
$$;

comment on function status_tim_harian(date) is
  'Dipakai Beranda: kehadiran dan laporan orang-orang dalam cakupan pemanggil (0173).';

-- Agregat kehadiran per orang untuk verifikasi migrasi ikut dipagari.
create or replace function kehadiran_per_orang()
returns table (user_id uuid, nama text, hadir integer, izin integer)
language sql
stable
as $$
  select
    u.id,
    u.nama,
    count(*) filter (where a.status in ('hadir', 'terlambat'))::int,
    count(*) filter (where a.status in ('izin', 'sakit'))::int
  from users u
  left join attendance a on a.user_id = u.id
  where boleh_orang(u.id)
  group by u.id, u.nama
  order by u.nama;
$$;
