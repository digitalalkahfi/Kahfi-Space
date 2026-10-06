-- =====================================================================
-- K-Space V2 — Laporan harian memuat GMV KEMARIN (H-1)
--
-- GMV dihitung untuk satu hari penuh (24 jam), jadi laporan yang dikirim
-- hari ini tidak mungkin memuat GMV hari ini: harinya belum selesai.
-- Contoh: laporan 6 Oktober memuat GMV 5 Oktober; laporan 7 Oktober memuat
-- GMV 6 Oktober.
--
-- Keputusan rancangan: sebuah laporan DISIMPAN bertanggal hari datanya
-- (kemarin), bukan hari ia dikirim. Seluruh isinya — GMV, komisi, GMV LIVE,
-- jumlah upload, jam LIVE, CO sampel, catatan — milik hari penuh itu.
-- Dengan begitu KPI, GRD, dan grafik langsung membaca angka itu di harinya
-- sendiri tanpa digeser satu per satu. Yang bergeser hanya hal-hal yang
-- bergantung pada "kapan laporan dikirim":
--
--   1. Penjaga tanggal (0128): hari ini dan masa depan ditolak.
--   2. Kunci Absen Pulang: yang ditunggu adalah laporan yang jatuh tempo
--      hari ini, yaitu laporan bertanggal kemarin (`sudah_lapor_harian`).
--   3. Unggahan di Status Tim: unggahan terakhir yang dilaporkan = kemarin.
--   4. Kepatuhan minimum: hari ini belum bisa dinilai (laporannya belum
--      bisa dikirim), jadi tidak dihitung sebagai "tidak melapor".
--   5. KPI "laporan tepat waktu": tenggatnya pukul `batas` pada hari
--      SESUDAH tanggal laporan.
--   6. Target prorata: GMV paling jauh ada sampai kemarin, jadi target
--      yang dibandingkan juga dihitung sampai kemarin (KPI GMV, ukuran
--      GRD, status WRM, laporan mingguan).
--   7. Penguncian: KPI sebuah bulan baru bisa dikunci dan laporan
--      mingguan baru dibentuk SESUDAH GMV hari terakhirnya dilaporkan.
--
-- Data lama tidak disentuh. Laporan yang sudah masuk (mis. yang dikirim
-- 5–6 Oktober dengan GMV sebagian hari) diperbaiki pelapor lewat
-- "Perbaiki laporan", yang tercatat di jejak revisi.
--
-- Isi tiap fungsi di bawah sama dengan definisi terbarunya; yang berubah
-- hanya baris yang disebut di komentar `-- H-1:`.
-- =====================================================================

-- Hari terbaru yang datanya sudah satu hari penuh: kemarin (WIB).
create or replace function tanggal_data_terakhir()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Jakarta')::date - 1;
$$;

comment on function tanggal_data_terakhir() is
  'Tanggal terbaru yang GMV-nya sudah satu hari penuh (kemarin, WIB). Padanan tanggalDataTerakhir() di aplikasi (0207).';

-- ---------------------------------------------------------------------
-- 1. Penjaga tanggal: hari ini pun ditolak (sebelumnya hanya masa depan)
-- ---------------------------------------------------------------------
create or replace function jaga_tanggal_laporan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- H-1: `>=`, bukan `>`. Seed dan skrip migrasi berjalan tanpa
  -- `auth.uid()` dan tetap bebas menulis tanggal apa pun.
  if auth.uid() is not null
     and new.tanggal >= (now() at time zone 'Asia/Jakarta')::date
  then
    raise exception
      'Laporan tidak bisa bertanggal hari ini atau masa depan (%). GMV dihitung satu hari penuh, jadi tanggal terbaru yang boleh dilaporkan adalah kemarin.',
      new.tanggal
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Kunci Absen Pulang menunggu laporan yang jatuh tempo hari ini
--    (bertanggal kemarin), bukan laporan bertanggal hari absen.
-- ---------------------------------------------------------------------
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
     and exists (
       select 1 from daily_reports r
       where r.user_id = p_user and r.tanggal = p_tanggal - 1
     );
$$;

comment on function sudah_lapor_harian(uuid, date) is
  'Sudah mengirim laporan yang jatuh tempo pada p_tanggal, yaitu laporan bertanggal p_tanggal - 1 (GMV satu hari penuh, 0207).';

create or replace function jaga_absen_pulang()
returns trigger
language plpgsql
as $$
begin
  if new.jam_pulang is not null and old.jam_pulang is null then
    if wajib_lapor_harian(new.user_id)
       and not sudah_lapor_harian(new.user_id, new.tanggal) then
      raise exception
        'Absen pulang terkunci: laporan harian (GMV kemarin) belum terkirim'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Status tim: `unggahan_hari_ini` kini unggahan kemarin (laporan terbaru)
-- ---------------------------------------------------------------------
create or replace function status_tim_harian(p_tanggal date)
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
        -- H-1: unggahan yang sudah dilaporkan adalah milik kemarin.
        and r.tanggal = p_tanggal - 1
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

-- ---------------------------------------------------------------------
-- 4. Kepatuhan minimum dan tren tiga hari: hari ini belum dinilai
-- ---------------------------------------------------------------------
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
      -- H-1: laporan hari ini baru bisa dikirim besok, jadi hari ini
      -- belum dinilai (bukan "tidak melapor").
      and t.tanggal <= tanggal_data_terakhir()
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

create or replace view tren_kepatuhan_tiga_hari
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
   -- H-1: hari ini belum bisa dilaporkan, jadi belum dinilai.
   and t.tanggal <= tanggal_data_terakhir()
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

-- ---------------------------------------------------------------------
-- 5. KPI "laporan tepat waktu": tenggat pukul `batas` pada hari SESUDAH
--    tanggal laporan
-- ---------------------------------------------------------------------
create or replace function pencapaian_otomatis(p_indikator uuid, p_sampai date)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ind kpi_indikator;
  v_bulan date;
  v_pemilik uuid;
  ref jsonb;
  akhir_bulan date;
  d_awal date;
  d_akhir date;
  n_hari integer;
  v_akun uuid[];
  hasil numeric;
  r record;
  tgl date;
begin
  select * into ind from kpi_indikator where id = p_indikator;
  if ind.id is null or ind.sumber = 'manual' then
    return null;
  end if;

  select l.periode_bulan, l.user_id into v_bulan, v_pemilik
  from kpi_lembar l where l.id = ind.lembar_id;

  ref := ind.sumber_ref;
  akhir_bulan := (v_bulan + interval '1 month - 1 day')::date;
  d_awal := greatest(v_bulan, coalesce((ref ->> 'mulai')::date, v_bulan));
  d_akhir := hari_terakhir_lengkap(v_bulan, p_sampai);
  n_hari := d_akhir - d_awal + 1;

  case ind.sumber

  -- -------------------------------------------------------------------
  when 'ukuran_persen' then
    return (
      select p.persen
      from persen_ukuran(
        v_bulan,
        array(
          select u.id from grd_ukuran u
          where u.grd_periode = v_bulan
            and u.kode in (select jsonb_array_elements_text(ref -> 'ukuran'))
        ),
        p_sampai
      ) p
    );

  -- -------------------------------------------------------------------
  when 'ukuran_nilai' then
    select u.id, g.tenggat into r
    from grd_ukuran u
    left join goals g on g.id = u.goal_id
    where u.grd_periode = v_bulan and u.kode = ref ->> 'ukuran';
    if r.id is null then
      return null;
    end if;
    -- "Dinilai 4 Nov": angka pada tenggat goal, walau melewati akhir bulan.
    tgl := case when p_sampai >= akhir_bulan
                then coalesce(r.tenggat, akhir_bulan)
                else least(p_sampai, coalesce(r.tenggat, akhir_bulan)) end;
    return realisasi_ukuran(r.id, tgl);

  -- -------------------------------------------------------------------
  when 'tonggak' then
    return tonggak_tepat_waktu(
      v_bulan,
      array(select jsonb_array_elements_text(ref -> 'rencana')),
      least(p_sampai, akhir_bulan)
    );

  -- -------------------------------------------------------------------
  when 'upload_rata' then
    v_akun := uuid_dari_json(ref -> 'akun');
    if n_hari <= 0 or cardinality(v_akun) = 0 then
      return null;
    end if;
    select coalesce(sum(r2.jumlah_upload), 0) into hasil
    from daily_reports r2
    where r2.account_id = any (v_akun)
      and r2.tanggal between d_awal and d_akhir;
    return hasil / n_hari;

  -- -------------------------------------------------------------------
  when 'hari_standar' then
    if n_hari <= 0 or jsonb_array_length(coalesce(ref -> 'akun', '[]')) = 0 then
      return null;
    end if;
    select count(*) filter (where lolos)::numeric / count(*) * 100 into hasil
    from (
      select bool_and(coalesce(h.upload, 0) >= (a ->> 'min')::numeric) as lolos
      from generate_series(d_awal, d_akhir, interval '1 day') d(hari)
      cross join jsonb_array_elements(ref -> 'akun') a
      left join lateral (
        select sum(r2.jumlah_upload) as upload
        from daily_reports r2
        where r2.account_id = (a ->> 'id')::uuid
          and r2.tanggal = d.hari::date
      ) h on true
      group by d.hari
    ) x;
    return hasil;

  -- -------------------------------------------------------------------
  when 'hari_live' then
    v_akun := uuid_dari_json(ref -> 'akun');
    if n_hari <= 0 or cardinality(v_akun) = 0 then
      return null;
    end if;
    select count(*) filter (where lolos)::numeric / count(*) * 100 into hasil
    from (
      select bool_and(coalesce(h.jam, 0) >= coalesce((ref ->> 'jam')::numeric, 0)) as lolos
      from generate_series(d_awal, d_akhir, interval '1 day') d(hari)
      cross join unnest(v_akun) a(id)
      left join lateral (
        select sum(r2.jam_live) as jam
        from daily_reports r2
        where r2.account_id = a.id and r2.tanggal = d.hari::date
      ) h on true
      group by d.hari
    ) x;
    return hasil;

  -- -------------------------------------------------------------------
  when 'laporan_tepat' then
    -- H-1: laporan bertanggal X dikirim paling lambat pukul `batas`
    -- pada X + 1. Hari yang tenggatnya belum lewat belum dinilai.
    d_akhir := least(d_akhir, tanggal_data_terakhir() - 1);
    n_hari := d_akhir - d_awal + 1;
    if n_hari <= 0 then
      return null;
    end if;
    select count(*) filter (where exists (
             select 1 from daily_reports r2
             where r2.user_id = v_pemilik
               and r2.tanggal = d.hari::date
               and (ref ->> 'batas' is null
                    or r2.submitted_at
                       <= ((d.hari::date + 1 + (ref ->> 'batas')::time)
                           at time zone 'Asia/Jakarta'))
           ))::numeric / count(*) * 100
      into hasil
    from generate_series(d_awal, d_akhir, interval '1 day') d(hari);
    return hasil;

  -- -------------------------------------------------------------------
  when 'lead_rata', 'lead_jumlah' then
    select min(coalesce(lm.mulai, v_bulan)), max(coalesce(lm.selesai, akhir_bulan))
      into d_awal, tgl
    from lead_measures lm
    join goals g on g.id = lm.goal_id
    where g.grd_periode = v_bulan
      and lm.kode in (select jsonb_array_elements_text(ref -> 'lead'));
    if d_awal is null then
      return null;
    end if;
    d_awal := greatest(d_awal, v_bulan);
    d_akhir := least(d_akhir, tgl);
    n_hari := d_akhir - d_awal + 1;
    if n_hari <= 0 then
      return null;
    end if;
    select coalesce(sum(e.nilai), 0) into hasil
    from lead_measure_entries e
    join lead_measures lm on lm.id = e.lead_measure_id
    join goals g on g.id = lm.goal_id
    where g.grd_periode = v_bulan
      and lm.kode in (select jsonb_array_elements_text(ref -> 'lead'))
      and e.tanggal between d_awal and d_akhir;
    return case when ind.sumber = 'lead_rata' then hasil / n_hari else hasil end;

  else
    return null;
  end case;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Target prorata sampai kemarin: KPI GMV, ukuran GRD, WRM, mingguan
-- ---------------------------------------------------------------------
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
  punya_akun as (
    select exists (
      select 1 from accounts a
      join pengguna p on a.pic_user_id = p.id
      join goals g on g.account_id = a.id and g.status = 'aktif'
                  and g.jenis_realisasi = 'gmv'
      join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
      where a.status = 'aktif'
    ) as ada
  ),
  sasaran as (
    select gm.target, gm.dari, gm.sampai, a.id as akun, null::uuid as unit
    from pengguna p
    join accounts a on a.pic_user_id = p.id and a.status = 'aktif'
    join goals g on g.account_id = a.id and g.status = 'aktif'
                and g.jenis_realisasi = 'gmv'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role = 'Staff'

    union all

    select gm.target, gm.dari, gm.sampai, null, p.unit_id
    from pengguna p
    join goals g on g.unit_id = p.unit_id and g.account_id is null
                and g.status = 'aktif' and g.jenis_realisasi = 'gmv'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role = 'Staff'
      and p.unit_id is not null
      and not (select ada from punya_akun)

    union all

    select gm.target, gm.dari, gm.sampai, null, p.unit_id
    from pengguna p
    join goals g on g.unit_id = p.unit_id and g.account_id is null
                and g.status = 'aktif' and g.jenis_realisasi = 'gmv'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role in ('Leader', 'Co-Leader') and p.unit_id is not null

    union all

    select gm.target, gm.dari, gm.sampai, null, null
    from pengguna p
    join goals g on g.level in ('company', 'manager') and g.status = 'aktif'
                and g.jenis_realisasi = 'gmv'
    join goal_months gm on gm.goal_id = g.id and gm.bulan = p_bulan
    where p.role in ('Manager', 'CEO') and g.pemilik_id = p.id
  ),
  -- H-1: GMV paling jauh ada sampai kemarin, jadi target prorata
  -- juga dihitung sampai kemarin.
  berjalan as (
    select
      s.target,
      greatest(least(
        (least(p_sampai, s.sampai, tanggal_data_terakhir()) - s.dari + 1)::numeric
          / (s.sampai - s.dari + 1),
        1), 0) as porsi,
      gmv_goal_rentang(s.akun, s.unit, s.dari, least(p_sampai, s.sampai, tanggal_data_terakhir())) as realisasi
    from sasaran s
  )
  select case when coalesce(sum(target * porsi), 0) > 0
    then sum(realisasi) / sum(target * porsi) * 100
    else null end
  from berjalan;
$$;

create or replace function persen_ukuran(
  p_periode date,
  p_ukuran uuid[],
  p_sampai date
)
returns table (realisasi numeric, target numeric, persen numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  akhir_bulan date := (p_periode + interval '1 month - 1 day')::date;
  r record;
  tgl date;
  porsi numeric;
  real_total numeric := 0;
  target_total numeric := 0;
  -- H-1: realisasi dan target prorata dihitung sampai kemarin.
  v_sampai date := least(p_sampai, tanggal_data_terakhir());
begin
  for r in
    select u.id, g.target_goal, g.tenggat
    from grd_ukuran u
    join goals g on g.id = u.goal_id
    where u.id = any (p_ukuran)
  loop
    if v_sampai < p_periode then
      continue; -- bulan ini belum punya satu hari penuh pun
    elsif v_sampai >= akhir_bulan then
      tgl := coalesce(r.tenggat, akhir_bulan);
      porsi := 1;
    else
      tgl := least(v_sampai, coalesce(r.tenggat, akhir_bulan));
      porsi := least(1,
        (tgl - p_periode + 1)::numeric
        / (coalesce(r.tenggat, akhir_bulan) - p_periode + 1));
    end if;
    real_total := real_total + coalesce(realisasi_ukuran(r.id, tgl), 0);
    target_total := target_total + r.target_goal * porsi;
  end loop;

  return query select
    real_total,
    target_total,
    case when target_total > 0 then real_total / target_total * 100 end;
end;
$$;

create or replace function status_wrm(p_tanggal date)
returns table (
  rasio_hasil  numeric,
  rasio_kri    numeric,
  status_hasil warna_wrm,
  status_kri   warna_wrm,
  keputusan    keputusan_wrm
)
language sql
stable
as $$
  -- H-1: pekan dibaca sampai kemarin (hari Senin menampilkan pekan lalu
  -- yang sudah lengkap), supaya target tidak melebihi GMV yang ada.
  with pekan as (
    select awal_pekan(least(p_tanggal, tanggal_data_terakhir())) as mulai, least(p_tanggal, tanggal_data_terakhir()) as sampai
  ),
  hasil as (
    select
      coalesce(sum(r.gmv), 0) as gmv,
      coalesce((
        select sum(t.target) from target_harian_unit(least(p_tanggal, tanggal_data_terakhir())) t
      ), 0) * (select (sampai - mulai + 1) from pekan) as target
    from daily_reports r, pekan
    where r.tanggal between pekan.mulai and pekan.sampai
  ),
  kri as (
    select coalesce(avg(p.rasio), 0) as rasio from papan_lead_measure(least(p_tanggal, tanggal_data_terakhir())) p
  ),
  warna as (
    select
      hasil.gmv, hasil.target, kri.rasio,
      case when hasil.target > 0 and hasil.gmv >= hasil.target
        then 'hijau'::warna_wrm else 'merah'::warna_wrm end as w_hasil,
      case when kri.rasio >= 100
        then 'hijau'::warna_wrm else 'merah'::warna_wrm end as w_kri
    from hasil, kri
  )
  select
    case when target > 0 then round(gmv / target * 100, 1) else 0 end,
    round(rasio, 1),
    w_hasil,
    w_kri,
    keputusan_wrm(w_hasil, w_kri)
  from warna;
$$;

create or replace function hitung_laporan_mingguan(
  p_pekan date,
  p_sampai date default current_date
)
returns table (
  unit_id      uuid,
  unit_kode    text,
  target       numeric,
  gmv          numeric,
  rasio_hasil  numeric,
  rasio_kri    numeric,
  status_hasil warna_wrm,
  status_kri   warna_wrm
)
language sql
stable
as $$
  with batas as (
    -- H-1: GMV paling jauh ada sampai kemarin.
    select least(p_sampai, p_pekan + 6, tanggal_data_terakhir()) as sampai
  ),
  baris as (
    select
      u.id, u.kode,
      coalesce(t.target, 0) as target,
      coalesce(g.gmv, 0) as gmv,
      coalesce(k.rasio, 0) as rasio_kri
    from units u
    cross join batas
    left join target_pekan_unit(p_pekan, batas.sampai) t on t.unit_id = u.id
    left join lateral (
      select sum(r.gmv) gmv
      from daily_reports r
      left join accounts a on a.id = r.account_id
      where coalesce(r.unit_id, a.unit_id) = u.id
        and r.tanggal between p_pekan and batas.sampai
    ) g on true
    left join lateral (
      select avg(p.rasio) rasio
      from papan_lead_measure(p_pekan) p
      where p.unit_kode = u.kode
    ) k on true
  )
  select
    id, kode, target, gmv,
    case when target > 0 then round(gmv / target * 100, 1) else 0 end,
    round(rasio_kri, 1),
    case when target > 0 and gmv >= target
      then 'hijau'::warna_wrm else 'merah'::warna_wrm end,
    case when rasio_kri >= 100
      then 'hijau'::warna_wrm else 'merah'::warna_wrm end
  from baris;
$$;

-- ---------------------------------------------------------------------
-- 7. Penguncian: tunggu GMV hari terakhir dilaporkan
-- ---------------------------------------------------------------------
create or replace function buat_laporan_mingguan(p_pekan date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  jumlah integer := 0;
begin
  if extract(isodow from p_pekan) <> 1 then
    raise exception 'Periode laporan mingguan harus hari Senin';
  end if;

  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh membentuk laporan mingguan'
      using errcode = 'insufficient_privilege';
  end if;

  -- H-1: GMV hari Minggu baru dilaporkan hari Senin, jadi laporan
  -- mingguan baru dibentuk sesudah itu.
  if p_pekan + 7 >= current_date then
    raise exception 'Pekan % belum selesai; GMV hari terakhirnya baru dilaporkan keesokan harinya, jadi laporannya dibentuk sesudah itu',
      to_char(p_pekan, 'DD Mon YYYY')
      using errcode = 'check_violation';
  end if;

  insert into weekly_reports as w
    (unit_id, periode, target_mingguan, gmv_total,
     rasio_hasil, rasio_kri, status_hasil, status_kri, keputusan, ringkasan)
  select
    h.unit_id,
    p_pekan,
    h.target,
    h.gmv,
    h.rasio_hasil,
    h.rasio_kri,
    h.status_hasil,
    h.status_kri,
    -- Diisi ulang trigger `weekly_lengkapi`; nilai ini sekadar pemenuh
    -- kolom NOT NULL.
    'LANJUT'::keputusan_wrm,
    ''
  from hitung_laporan_mingguan(p_pekan, p_pekan + 6) h
  on conflict (unit_id, periode) where unit_id is not null
  do update set
    target_mingguan = excluded.target_mingguan,
    gmv_total       = excluded.gmv_total,
    rasio_hasil     = excluded.rasio_hasil,
    rasio_kri       = excluded.rasio_kri,
    status_hasil    = excluded.status_hasil,
    status_kri      = excluded.status_kri,
    generated_at    = now()
  where w.periode = excluded.periode;

  get diagnostics jumlah = row_count;
  return jumlah;
end;
$$;

create or replace function kunci_kpi_bulan(p_bulan date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  akhir_bulan date := (p_bulan + interval '1 month - 1 day')::date;
  jumlah integer := 0;
begin
  if extract(day from p_bulan) <> 1 then
    raise exception 'Periode harus tanggal 1 sebuah bulan';
  end if;

  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh mengunci KPI'
      using errcode = 'insufficient_privilege';
  end if;

  -- H-1: GMV hari terakhir bulan baru dilaporkan keesokan harinya.
  if akhir_bulan + 1 >= current_date then
    raise exception 'Bulan % belum selesai; KPI baru bisa dikunci setelah bulan berakhir dan GMV hari terakhirnya dilaporkan (satu hari sesudahnya)',
      to_char(p_bulan, 'Mon YYYY')
      using errcode = 'check_violation';
  end if;

  insert into kpi_snapshots
    (user_id, periode_bulan, skor_total, predikat, cakupan, detail, metode,
     dikunci_oleh, dikunci_pada)
  select
    u.id, p_bulan, h.skor_total, h.predikat, h.cakupan, h.detail, h.metode,
    auth.uid(), now()
  from users u
  cross join lateral hitung_kpi(u.id, p_bulan, akhir_bulan) h
  where u.status = 'aktif'
    and h.cakupan > 0
    and not exists (
      select 1 from kpi_snapshots s
      where s.user_id = u.id and s.periode_bulan = p_bulan
    );

  get diagnostics jumlah = row_count;

  if jumlah = 0 and not exists (
    select 1 from kpi_snapshots s where s.periode_bulan = p_bulan
  ) then
    raise exception 'Tidak ada data KPI pada %; tidak ada yang bisa dikunci',
      to_char(p_bulan, 'Mon YYYY')
      using errcode = 'check_violation';
  end if;

  return jumlah;
end;
$$;

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
    -- H-1: tuntas setelah GMV hari terakhir bulan itu dilaporkan.
    (p_bulan + interval '1 month')::date + 1 <= current_date
  from bisa, snap;
$$;

-- ---------------------------------------------------------------------
-- Rollback (manual): kembalikan tiap fungsi ke definisi sebelumnya dengan
-- menjalankan ulang blok `create or replace` dari migrasi berikut, lalu
-- `drop function tanggal_data_terakhir()`:
--   jaga_tanggal_laporan ........... 0128
--   sudah_lapor_harian ............. 0173
--   jaga_absen_pulang .............. 0016
--   status_tim_harian .............. 0173
--   kepatuhan_minimum_akun ......... 0138
--   tren_kepatuhan_tiga_hari ....... 0140
--   pencapaian_otomatis, persen_ukuran ... 0194
--   realisasi_gmv_kpi .............. 0188
--   status_wrm, hitung_laporan_mingguan .. 0189
--   buat_laporan_mingguan .......... 0067
--   kunci_kpi_bulan ................ 0187
--   status_kunci_kpi ............... 0173
-- ---------------------------------------------------------------------
