-- =====================================================================
-- K-Space V2 — Sumber otomatis indikator KPI GRD
--
-- Tahap 1 (0187) membuat semua PENCAPAIAN diisi penilai. Tahap 3 menyambung
-- indikator yang datanya sudah ada di aplikasi:
--
--   ukuran_persen  Σ realisasi ukuran / Σ target goal-nya × 100
--                  (GMV internal, per akun, LIVE, di luar LIVE, …)
--   ukuran_nilai   angka ukuran isian (seller, creator, SOP, %, …)
--   tonggak        tonggak tepat waktu % (0192)
--   upload_rata    rata-rata video terupload per hari atas daftar akun
--   hari_standar   % hari SEMUA akun di daftar memenuhi standar videonya
--   hari_live      % hari SEMUA akun di daftar LIVE ≥ N jam
--   laporan_tepat  % hari orangnya mengirim laporan harian (≤ jam batas)
--   lead_rata      rata-rata per hari entri lead measure (0193)
--   lead_jumlah    jumlah entri lead measure
--
-- Rujukan sumber (`sumber_ref`) memakai KODE GRD — ukuran, rencana, lead
-- measure — dan id akun, sehingga impor ulang tidak memutus tautannya.
--
-- Isian penilai tetap menang: bila PENCAPAIAN diisi, angka otomatis
-- hanya ditampilkan sebagai pembanding. Dengan begitu data yang keliru
-- tidak memaksa nilai yang keliru.
--
-- Satu rumus untuk semua: scorecard, penguncian, dan leaderboard (Tahap 4)
-- memanggil `nilai_kpi_grd` yang sama. Fungsi itu security definer agar
-- angka seseorang sama siapa pun yang melihatnya — hak lihat diperiksa
-- di pintu masuknya (`hitung_kpi_grd`), bukan lewat RLS laporan pemanggil.
-- =====================================================================

alter table kpi_indikator drop constraint if exists kpi_indikator_sumber_check;
alter table kpi_indikator
  add constraint kpi_indikator_sumber_check check (
    sumber in (
      'manual', 'ukuran_persen', 'ukuran_nilai', 'tonggak', 'upload_rata',
      'hari_standar', 'hari_live', 'laporan_tepat', 'lead_rata', 'lead_jumlah'
    )
  );

alter table kpi_indikator
  add column if not exists sumber_ref jsonb not null default '{}'::jsonb,
  add column if not exists keterangan_sumber text not null default '';

alter table kpi_indikator drop constraint if exists kpi_indikator_ref_objek;
alter table kpi_indikator
  add constraint kpi_indikator_ref_objek check (jsonb_typeof(sumber_ref) = 'object');

comment on column kpi_indikator.sumber is
  'manual = diisi penilai; selain itu dihitung otomatis dari data aplikasi menurut sumber_ref (0194).';
comment on column kpi_indikator.sumber_ref is
  'Rujukan sumber otomatis: kode ukuran/rencana/lead measure GRD, id akun, standar, jam batas (0194).';
comment on column kpi_indikator.keterangan_sumber is
  'Penjelasan singkat sumber otomatis untuk layar, mis. "Tonggak 1.1.4.1–1.1.4.4" (0194).';

-- ---------------------------------------------------------------------
-- Pembantu
-- ---------------------------------------------------------------------

/** Hari terakhir yang datanya dianggap lengkap: hari ini (WIB) belum. */
create or replace function hari_terakhir_lengkap(p_bulan date, p_sampai date)
returns date
language sql
stable
as $$
  select least(
    p_sampai,
    (p_bulan + interval '1 month - 1 day')::date,
    (now() at time zone 'Asia/Jakarta')::date - 1
  );
$$;

comment on function hari_terakhir_lengkap(date, date) is
  'Batas hitung harian KPI: p_sampai, akhir bulan, atau kemarin (WIB) — mana yang paling awal (0194).';

/** Daftar uuid dari larik JSON; elemen objek dibaca kunci "id". */
create or replace function uuid_dari_json(p jsonb)
returns uuid[]
language sql
immutable
as $$
  select coalesce(array_agg(
    case when jsonb_typeof(x) = 'object' then (x ->> 'id')::uuid
         else (x #>> '{}')::uuid end
  ), '{}')
  from jsonb_array_elements(coalesce(p, '[]'::jsonb)) x;
$$;

-- ---------------------------------------------------------------------
-- % realisasi sekumpulan ukuran GRD terhadap target goal-nya. Dipakai
-- sumber `ukuran_persen` dan papan akun leaderboard (0196) — satu rumus.
--
-- Bulan selesai: realisasi pada tenggat goal (GMV paling jauh akhir
-- bulan). Bulan berjalan: sampai p_sampai, dan targetnya diprorata
-- sesuai hari yang sudah berjalan — sama seperti 0029.
-- ---------------------------------------------------------------------
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
begin
  for r in
    select u.id, g.target_goal, g.tenggat
    from grd_ukuran u
    join goals g on g.id = u.goal_id
    where u.id = any (p_ukuran)
  loop
    if p_sampai >= akhir_bulan then
      tgl := coalesce(r.tenggat, akhir_bulan);
      porsi := 1;
    else
      tgl := least(p_sampai, coalesce(r.tenggat, akhir_bulan));
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

comment on function persen_ukuran(date, uuid[], date) is
  'Σ realisasi ukuran ÷ Σ target goal-nya × 100; bulan berjalan diprorata (0194).';

revoke execute on function persen_ukuran(date, uuid[], date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Pencapaian otomatis satu indikator. Null = belum ada data (belum ada
-- hari yang lengkap, belum ada tonggak jatuh tempo, ukuran belum diisi,
-- atau sumbernya menunjuk sesuatu yang belum terdaftar).
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
    if n_hari <= 0 then
      return null;
    end if;
    select count(*) filter (where exists (
             select 1 from daily_reports r2
             where r2.user_id = v_pemilik
               and r2.tanggal = d.hari::date
               and (ref ->> 'batas' is null
                    or r2.submitted_at
                       <= ((d.hari::date + (ref ->> 'batas')::time)
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

comment on function pencapaian_otomatis(uuid, date) is
  'PENCAPAIAN indikator KPI GRD dari data aplikasi menurut sumber & sumber_ref; null bila belum ada data (0194).';

-- Hanya dipanggil fungsi penilaian; angka laporan tidak dibuka lewat RPC.
revoke execute on function pencapaian_otomatis(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Rumus nilai KPI GRD — SATU-SATUNYA. Tanpa pemeriksaan hak lihat:
-- pemanggilnya yang memeriksa (`hitung_kpi_grd`, penguncian, leaderboard).
-- ---------------------------------------------------------------------
create or replace function nilai_kpi_grd(p_user uuid, p_bulan date, p_sampai date)
returns table (
  skor_total numeric,
  predikat predikat_kpi,
  cakupan numeric,
  detail jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with lembar as (
    select l.id
    from kpi_lembar l
    where l.user_id = p_user
      and l.periode_bulan = p_bulan
      and l.status = 'aktif'
  ),
  baris as (
    select
      i.id, i.urutan, i.nama, i.satuan, i.bobot, i.arah, i.tangga, i.sumber,
      i.keterangan_sumber,
      p.nilai as manual,
      case when i.sumber <> 'manual'
        then pencapaian_otomatis(i.id, p_sampai) end as otomatis
    from kpi_indikator i
    join lembar l on l.id = i.lembar_id
    left join kpi_pencapaian p on p.indikator_id = i.id
  ),
  dinilai as (
    select b.*,
      coalesce(b.manual, b.otomatis) as pencapaian,
      nilai_tangga(coalesce(b.manual, b.otomatis), b.tangga, b.arah) as nilai
    from baris b
  )
  select
    coalesce(sum(b.nilai * b.bobot), 0)::numeric,
    case when count(b.pencapaian) > 0
      then predikat_dari_skor(coalesce(sum(b.nilai * b.bobot), 0))
    end,
    case when coalesce(sum(b.bobot), 0) > 0
      then round(
        coalesce(sum(b.bobot) filter (where b.pencapaian is not null), 0)::numeric
        / sum(b.bobot) * 100, 0)
      else 0
    end,
    coalesce(jsonb_agg(jsonb_build_object(
      'indikator_id', b.id,
      'urutan', b.urutan,
      'nama', b.nama,
      'satuan', b.satuan,
      'bobot', b.bobot,
      'arah', b.arah,
      'tangga', to_jsonb(b.tangga),
      'sumber', b.sumber,
      'keterangan_sumber', b.keterangan_sumber,
      'manual', b.manual,
      'otomatis', b.otomatis,
      'pencapaian', b.pencapaian,
      'nilai', b.nilai,
      'total', b.nilai * b.bobot
    ) order by b.urutan) filter (where b.id is not null), '[]'::jsonb)
  from dinilai b;
$$;

comment on function nilai_kpi_grd(uuid, date, date) is
  'Rumus tunggal nilai KPI GRD: PENCAPAIAN = isian penilai, atau otomatis bila kosong; Σ VALUE × bobot (0194).';

revoke execute on function nilai_kpi_grd(uuid, date, date) from public, anon, authenticated;

-- Pintu masuk dengan hak lihat: orangnya sendiri, atasannya, CEO/Manager.
drop function if exists hitung_kpi_grd(uuid, date);

create function hitung_kpi_grd(
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
security definer
set search_path = public
as $$
  select n.skor_total, n.predikat, n.cakupan, n.detail
  from nilai_kpi_grd(p_user, p_bulan, p_sampai) n
  where boleh_orang(p_user);
$$;

comment on function hitung_kpi_grd(uuid, date, date) is
  'Nilai KPI GRD seseorang bagi yang boleh melihatnya; rumusnya `nilai_kpi_grd` (0194).';

create or replace function hitung_kpi(
  p_user uuid,
  p_bulan date,
  p_sampai date default current_date
)
returns table (
  skor_total numeric,
  predikat predikat_kpi,
  cakupan numeric,
  detail jsonb,
  metode text
)
language plpgsql
stable
as $$
begin
  if bulan_grd(p_bulan) then
    return query
      select g.skor_total, g.predikat, g.cakupan, g.detail, 'grd'::text
      from hitung_kpi_grd(p_user, p_bulan, p_sampai) g;
  else
    return query
      select j.skor_total, j.predikat, j.cakupan, j.detail, 'jabatan'::text
      from hitung_kpi_jabatan(p_user, p_bulan, p_sampai) j;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Rollback (manual): kembalikan hitung_kpi_grd(uuid, date) dan hitung_kpi
-- dari 0187; drop nilai_kpi_grd, pencapaian_otomatis, persen_ukuran, uuid_dari_json,
-- hari_terakhir_lengkap; drop kolom sumber_ref & keterangan_sumber dan
-- kembalikan cek sumber ke ('manual').
-- ---------------------------------------------------------------------
