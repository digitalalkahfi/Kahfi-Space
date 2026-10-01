-- =====================================================================
-- K-Space V2 — Leaderboard GRD (Tahap 4)
--
-- Dua papan untuk bulan berjalan:
--
--   1. Peringkat NILAI KPI, dipisah per level: Leader, Co-Leader, dan
--      Staf/Partner (keputusan §9 no. 11: semua orang ditampilkan, tetapi
--      staf dibandingkan dengan staf, leader dengan leader).
--   2. Papan akun menurut % capaian target GMV. Akun yang dikecualikan
--      file (akun Manager & CEO) disebut lewat id akun dari pemetaan.
--
-- Satu-satunya sumber angka adalah fungsi scorecard. Untuk itu rumus satu
-- baris scorecard dipindah ke `skor_kpi_bulan` — snapshot bila terkunci,
-- selain itu `nilai_kpi_grd` (0194) — dan dipakai bersama oleh
-- `scorecard_tim` dan `papan_kpi`. Leaderboard hanya mengurutkan dan
-- mengelompokkan; tidak ada hitungan kedua.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Satu baris scorecard (tanpa pemeriksaan hak lihat; pemanggilnya yang
-- memeriksa). Isinya persis kolom `scorecard_tim` 0187.
-- ---------------------------------------------------------------------
create or replace function skor_kpi_bulan(
  p_user uuid,
  p_bulan date,
  p_sampai date
)
returns table (
  skor numeric,
  predikat predikat_kpi,
  cakupan numeric,
  detail jsonb,
  terkunci boolean,
  metode text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s kpi_snapshots;
begin
  select * into s from kpi_snapshots
  where user_id = p_user and periode_bulan = p_bulan;

  if s.id is not null then
    return query select
      s.skor_total, s.predikat, s.cakupan, s.detail,
      s.dikunci_pada is not null, s.metode;
    return;
  end if;

  if bulan_grd(p_bulan) then
    return query select
      coalesce(n.skor_total, 0), n.predikat, coalesce(n.cakupan, 0),
      coalesce(n.detail, '[]'::jsonb), false, 'grd'::text
    from nilai_kpi_grd(p_user, p_bulan, p_sampai) n;
  else
    -- Rumus jabatan memeriksa hak lihat pemanggil di dalamnya (0173).
    return query select
      coalesce(j.skor_total, 0),
      coalesce(j.predikat, 'Perlu Perbaikan'::predikat_kpi),
      coalesce(j.cakupan, 0), coalesce(j.detail, '[]'::jsonb),
      false, 'jabatan'::text
    from hitung_kpi_jabatan(p_user, p_bulan, p_sampai) j;
  end if;
end;
$$;

comment on function skor_kpi_bulan(uuid, date, date) is
  'Satu baris scorecard: snapshot bila terkunci, selain itu rumus GRD/jabatan; dipakai scorecard & leaderboard (0196).';

revoke execute on function skor_kpi_bulan(uuid, date, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Scorecard memakai baris yang sama. Kolom dan urutannya tidak berubah.
-- Security definer karena `skor_kpi_bulan` tertutup; hak lihat tetap
-- `boleh_orang`, sama seperti sebelumnya.
-- ---------------------------------------------------------------------
create or replace function scorecard_tim(p_bulan date, p_sampai date default current_date)
returns table (
  user_id uuid, nama text, inisial text, jabatan text, unit text,
  skor numeric, predikat predikat_kpi, cakupan numeric,
  detail jsonb, terkunci boolean, metode text, boleh_menilai boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with baris as (
    select
      u.id as user_id, u.nama,
      upper(left(split_part(u.nama, ' ', 1), 1)
            || left(split_part(u.nama, ' ', array_length(string_to_array(u.nama, ' '), 1)), 1)) as inisial,
      u.jabatan,
      coalesce(split_part(un.nama, ' (', 1), 'Manajemen') as unit,
      k.skor, k.predikat, k.cakupan, k.detail, k.terkunci, k.metode
    from users u
    left join units un on un.id = u.unit_id
    cross join lateral skor_kpi_bulan(u.id, p_bulan, p_sampai) k
    where u.status = 'aktif'
      and boleh_orang(u.id)
  )
  select
    b.user_id, b.nama, b.inisial, b.jabatan, b.unit, b.skor, b.predikat,
    b.cakupan, b.detail, b.terkunci, b.metode,
    b.metode = 'grd'
      and not b.terkunci
      and jsonb_array_length(b.detail) > 0
      and boleh_menilai(b.user_id) as boleh_menilai
  from baris b
  order by
    case when b.metode = 'grd' then b.predikat is not null
         else b.cakupan >= 100 end desc,
    b.skor desc,
    b.nama;
$$;

comment on function scorecard_tim(date, date) is
  'Scorecard KPI orang-orang dalam cakupan pemanggil; barisnya dari skor_kpi_bulan (0196).';

-- ---------------------------------------------------------------------
-- Level leaderboard dari peran: CEO dan Manager tidak ikut diperingkat.
-- ---------------------------------------------------------------------
create or replace function kelompok_papan(p_role peran_pengguna)
returns text
language sql
immutable
as $$
  select case p_role
    when 'Leader' then 'leader'
    when 'Co-Leader' then 'co_leader'
    when 'Staff' then 'staf'
    when 'Finance' then 'staf'
  end;
$$;

-- ---------------------------------------------------------------------
-- Peringkat NILAI KPI bulan GRD. Semua yang sudah masuk boleh melihat
-- nama, nilai, dan predikat — bukan rincian indikatornya.
-- ---------------------------------------------------------------------
create or replace function papan_kpi(p_bulan date, p_sampai date default current_date)
returns table (
  user_id   uuid,
  nama      text,
  inisial   text,
  jabatan   text,
  unit      text,
  kelompok  text,
  skor      numeric,
  predikat  predikat_kpi,
  cakupan   numeric,
  terkunci  boolean,
  peringkat bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with baris as (
    select
      u.id, u.nama,
      upper(left(split_part(u.nama, ' ', 1), 1)
            || left(split_part(u.nama, ' ', array_length(string_to_array(u.nama, ' '), 1)), 1)) as inisial,
      u.jabatan,
      coalesce(split_part(un.nama, ' (', 1), 'Manajemen') as unit,
      kelompok_papan(u.role) as kelompok,
      k.skor, k.predikat, k.cakupan, k.terkunci, k.detail, k.metode
    from users u
    left join units un on un.id = u.unit_id
    cross join lateral skor_kpi_bulan(u.id, p_bulan, p_sampai) k
    where u.status = 'aktif'
      and auth.uid() is not null
      and kelompok_papan(u.role) is not null
  )
  select
    b.id, b.nama, b.inisial, b.jabatan, b.unit, b.kelompok,
    b.skor, b.predikat, b.cakupan, b.terkunci,
    rank() over (partition by b.kelompok order by b.skor desc)
  from baris b
  -- Hanya bulan GRD dan orang yang punya lembar KPI.
  where b.metode = 'grd'
    and jsonb_array_length(b.detail) > 0
  order by b.kelompok, b.skor desc, b.nama;
$$;

comment on function papan_kpi(date, date) is
  'Leaderboard NILAI KPI per level (leader, co_leader, staf); angkanya dari skor_kpi_bulan, sama dengan scorecard (0196).';

-- ---------------------------------------------------------------------
-- Papan akun: % capaian target GMV per akun.
-- ---------------------------------------------------------------------

/** Akun yang tidak ikut papan akun pada sebuah periode GRD. */
create table grd_akun_dikecualikan (
  grd_periode date not null check (extract(day from grd_periode) = 1),
  account_id  uuid not null references accounts (id) on delete cascade,
  alasan      text not null default '',
  primary key (grd_periode, account_id)
);

comment on table grd_akun_dikecualikan is
  'Akun yang dikecualikan dari papan akun GRD, mis. akun CEO/Manager; diisi impor dari pemetaan (0196).';

alter table grd_akun_dikecualikan enable row level security;
create policy grd_akun_dikecualikan_baca on grd_akun_dikecualikan
  for select using (auth.uid() is not null);
create policy grd_akun_dikecualikan_kelola on grd_akun_dikecualikan
  for all using (lintas_unit()) with check (lintas_unit());

/**
 * Papan akun: tiap akun yang punya goal akun GRD pada periode itu,
 * kecuali yang dikecualikan. Semua yang sudah masuk melihat % dan
 * peringkatnya; rupiahnya hanya bagi yang boleh melihat angka lintas
 * unit (`lintas_angka`).
 */
create or replace function papan_akun_grd(p_periode date, p_sampai date default current_date)
returns table (
  account_id uuid,
  username   text,
  pemegang   text,
  unit       text,
  realisasi  numeric,
  target     numeric,
  persen     numeric,
  peringkat  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with akun as (
    select a.id, a.username, p.nama as pemegang,
           coalesce(split_part(un.nama, ' (', 1), '') as unit,
           array_agg(u.id) as ukuran
    from goals g
    join grd_ukuran u on u.goal_id = g.id
    join accounts a on a.id = g.account_id
    left join users p on p.id = a.pic_user_id
    left join units un on un.id = a.unit_id
    where g.grd_periode = p_periode
      and g.level = 'account'
      and g.jenis_realisasi = 'gmv'
      and not exists (
        select 1 from grd_akun_dikecualikan x
        where x.grd_periode = p_periode and x.account_id = a.id
      )
    group by a.id, a.username, p.nama, un.nama
  ),
  hitung as (
    select a.*, h.realisasi, h.target, h.persen
    from akun a
    -- Rumus `ukuran_persen` KPI (0194): persen akun sama dengan persen
    -- indikator GMV akun di lembar KPI pemegangnya.
    cross join lateral persen_ukuran(p_periode, a.ukuran, p_sampai) h
    where auth.uid() is not null
  )
  select
    h.id, h.username, h.pemegang, h.unit,
    case when lintas_angka() then h.realisasi end,
    case when lintas_angka() then h.target end,
    h.persen,
    rank() over (order by h.persen desc nulls last)
  from hitung h
  order by h.persen desc nulls last, h.username;
$$;

comment on function papan_akun_grd(date, date) is
  'Papan akun GRD: % capaian target GMV per akun (rumus ukuran_persen), tanpa akun yang dikecualikan (0196).';

-- ---------------------------------------------------------------------
-- Impor GRD ikut membawa akun yang dikecualikan papan akun. Sama dengan
-- 0195, ditambah langkah 8.
-- ---------------------------------------------------------------------
create or replace function impor_grd(p_rencana jsonb, p_uji boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periode date := (p_rencana ->> 'periode')::date;
  g jsonb;
  u jsonb;
  l jsonb;
  t jsonb;
  b jsonb;
  s jsonb;
  k jsonb;
  i jsonb;
  v_id uuid;
  v_induk uuid;
  v_lembar uuid;
  v_status_lama text;
  v_status_baru text;
  n_hapus integer := 0;
  n_struktur integer := 0;
  n_goal integer := 0;
  n_ukuran integer := 0;
  n_lembar integer := 0;
  n_indikator integer := 0;
  n_rencana integer := 0;
  n_tonggak integer := 0;
  n_lead integer := 0;
  n_kecuali integer := 0;
  r jsonb;
  m jsonb;
  v_rencana uuid;
  v_goal uuid;
  v_lead uuid;
  v_hari date;
  v_unit uuid;
  lembar_terkunci jsonb := '[]'::jsonb;
  ringkas jsonb;
begin
  if not (pemanggil_sistem() or lintas_unit()) then
    raise exception 'Hanya CEO, Manager, atau proses sistem yang boleh mengimpor GRD'
      using errcode = 'insufficient_privilege';
  end if;

  if v_periode is null or extract(day from v_periode) <> 1 then
    raise exception 'Periode rencana harus tanggal 1 sebuah bulan';
  end if;

  -- 1. Goal lama yang disebut eksplisit. Hanya goal di luar GRD (tanpa
  --    kode): goal GRD tidak pernah terhapus oleh impor.
  delete from goals
  where kode is null
    and id in (
      select x::uuid
      from jsonb_array_elements_text(coalesce(p_rencana -> 'hapus_goal', '[]')) x
    );
  get diagnostics n_hapus = row_count;

  -- 2. Penyesuaian struktur organisasi agar penilai KPI sesuai file.
  for s in select * from jsonb_array_elements(coalesce(p_rencana -> 'struktur', '[]')) loop
    update users
       set role = coalesce((s ->> 'role')::peran_pengguna, role),
           atasan_id = case when s ? 'atasan_id'
                            then (s ->> 'atasan_id')::uuid else atasan_id end,
           jabatan = coalesce(s ->> 'jabatan', jabatan)
     where id = (s ->> 'user_id')::uuid;
    n_struktur := n_struktur + 1;
  end loop;

  -- 3. Goal, urut dari tingkat teratas supaya induknya selalu sudah ada.
  for g in select * from jsonb_array_elements(coalesce(p_rencana -> 'goals', '[]')) loop
    v_induk := null;
    if g ->> 'induk' is not null then
      select id into v_induk from goals
      where grd_periode = v_periode and kode = g ->> 'induk';
      if v_induk is null then
        raise exception 'Induk % untuk goal % tidak ada di rencana', g ->> 'induk', g ->> 'kode';
      end if;
    end if;

    -- Bukan upsert: trigger batas 3 goal (0006) memeriksa baris calon
    -- sebelum konflik terdeteksi, sehingga upsert goal yang sudah ada
    -- akan ditolak seolah-olah goal keempat.
    select id, status::text into v_id, v_status_lama from goals
    where grd_periode = v_periode and kode = g ->> 'kode';

    if v_id is null then
      insert into goals
        (judul, level, pemilik_id, unit_id, account_id, parent_goal_id, satuan,
         target_base, target_goal, target_stretch, periode, grd_periode, kode,
         tenggat, jenis_realisasi, keterangan, status)
      values (
        g ->> 'judul',
        (g ->> 'level')::level_goal,
        (g ->> 'pemilik_id')::uuid,
        (g ->> 'unit_id')::uuid,
        (g ->> 'account_id')::uuid,
        v_induk,
        g ->> 'satuan',
        (g ->> 'base')::numeric,
        (g ->> 'target')::numeric,
        coalesce((g ->> 'stretch')::numeric, (g ->> 'target')::numeric),
        g ->> 'periode_label',
        v_periode,
        g ->> 'kode',
        (g ->> 'tenggat')::date,
        g ->> 'jenis_realisasi',
        coalesce(g ->> 'keterangan', ''),
        (g ->> 'status')::status_goal
      )
      returning id into v_id;
    else
      update goals set
        judul = g ->> 'judul',
        level = (g ->> 'level')::level_goal,
        pemilik_id = (g ->> 'pemilik_id')::uuid,
        unit_id = (g ->> 'unit_id')::uuid,
        account_id = (g ->> 'account_id')::uuid,
        parent_goal_id = v_induk,
        satuan = g ->> 'satuan',
        target_base = (g ->> 'base')::numeric,
        target_goal = (g ->> 'target')::numeric,
        target_stretch = coalesce((g ->> 'stretch')::numeric, (g ->> 'target')::numeric),
        periode = g ->> 'periode_label',
        tenggat = (g ->> 'tenggat')::date,
        jenis_realisasi = g ->> 'jenis_realisasi',
        keterangan = coalesce(g ->> 'keterangan', ''),
        -- Usulan yang sudah disahkan tidak dikembalikan menjadi usulan.
        status = case when v_status_lama = 'aktif' then 'aktif'::status_goal
                      else (g ->> 'status')::status_goal end
      where id = v_id;
    end if;

    delete from goal_months where goal_id = v_id;
    for b in select * from jsonb_array_elements(coalesce(g -> 'bulan', '[]')) loop
      insert into goal_months (goal_id, bulan, target, dari, sampai)
      values (
        v_id,
        (b ->> 'bulan')::date,
        (b ->> 'target')::numeric,
        (b ->> 'dari')::date,
        (b ->> 'sampai')::date
      );
    end loop;

    n_goal := n_goal + 1;
  end loop;

  -- 4. Ukuran: dibuat dulu semuanya, baru lingkupnya — lingkup boleh
  --    menunjuk ukuran lain di rencana yang sama.
  for u in select * from jsonb_array_elements(coalesce(p_rencana -> 'ukuran', '[]')) loop
    insert into grd_ukuran as x
      (grd_periode, kode, judul, satuan, sumber, goal_id, pic_id, pic_teks, urutan, asal)
    values (
      v_periode,
      u ->> 'kode',
      u ->> 'judul',
      u ->> 'satuan',
      u ->> 'sumber',
      (select id from goals where grd_periode = v_periode and kode = u ->> 'goal'),
      (u ->> 'pic_id')::uuid,
      coalesce(u ->> 'pic_teks', ''),
      coalesce((u ->> 'urutan')::smallint, 0),
      coalesce(u ->> 'asal', '')
    )
    on conflict (grd_periode, kode) do update set
      judul = excluded.judul,
      satuan = excluded.satuan,
      sumber = excluded.sumber,
      goal_id = excluded.goal_id,
      pic_id = excluded.pic_id,
      pic_teks = excluded.pic_teks,
      urutan = excluded.urutan,
      asal = excluded.asal;
    n_ukuran := n_ukuran + 1;
  end loop;

  for u in select * from jsonb_array_elements(coalesce(p_rencana -> 'ukuran', '[]')) loop
    select id into v_id from grd_ukuran
    where grd_periode = v_periode and kode = u ->> 'kode';

    delete from grd_ukuran_lingkup where ukuran_id = v_id;
    for l in select * from jsonb_array_elements(coalesce(u -> 'lingkup', '[]')) loop
      insert into grd_ukuran_lingkup
        (ukuran_id, account_id, unit_id, sumber_ukuran_id, jenis_gmv, faktor)
      values (
        v_id,
        (l ->> 'account_id')::uuid,
        (l ->> 'unit_id')::uuid,
        (select id from grd_ukuran
          where grd_periode = v_periode and kode = l ->> 'sumber_kode'),
        coalesce(l ->> 'jenis_gmv', 'semua'),
        coalesce((l ->> 'faktor')::smallint, 1)
      );
    end loop;

    delete from grd_ukuran_titik where ukuran_id = v_id;
    for t in select * from jsonb_array_elements(coalesce(u -> 'titik', '[]')) loop
      insert into grd_ukuran_titik (ukuran_id, tanggal, target)
      values (v_id, (t ->> 'tanggal')::date, (t ->> 'target')::numeric);
    end loop;
  end loop;

  -- 5. Lembar KPI. Bulan yang sudah terkunci dilewati: angkanya final.
  for k in select * from jsonb_array_elements(coalesce(p_rencana -> 'lembar', '[]')) loop
    if kpi_terkunci((k ->> 'user_id')::uuid, v_periode) then
      lembar_terkunci := lembar_terkunci || to_jsonb(k ->> 'user_id');
      continue;
    end if;

    select id, status into v_lembar, v_status_lama from kpi_lembar
    where user_id = (k ->> 'user_id')::uuid and periode_bulan = v_periode;

    if v_lembar is null then
      insert into kpi_lembar (user_id, periode_bulan, judul, status, asal)
      values ((k ->> 'user_id')::uuid, v_periode, k ->> 'judul', 'draft', coalesce(k ->> 'asal', ''))
      returning id into v_lembar;
    else
      -- Indikator hanya bisa disusun selama draft (0187).
      update kpi_lembar
         set status = 'draft', judul = k ->> 'judul', asal = coalesce(k ->> 'asal', '')
       where id = v_lembar;
    end if;

    for i in select * from jsonb_array_elements(coalesce(k -> 'indikator', '[]')) loop
      -- Diperbarui di tempat, bukan dihapus lalu dibuat ulang: pencapaian
      -- yang sudah diisi penilai melekat ke indikatornya.
      insert into kpi_indikator as x
        (lembar_id, urutan, nama, satuan, bobot, arah, tangga, asal,
         sumber, sumber_ref, keterangan_sumber)
      values (
        v_lembar,
        (i ->> 'urutan')::smallint,
        i ->> 'nama',
        i ->> 'satuan',
        (i ->> 'bobot')::smallint,
        coalesce(i ->> 'arah', 'naik'),
        array(select (y)::numeric from jsonb_array_elements_text(i -> 'tangga') y),
        coalesce(i ->> 'asal', ''),
        coalesce(i ->> 'sumber', 'manual'),
        coalesce(i -> 'sumber_ref', '{}'::jsonb),
        coalesce(i ->> 'keterangan_sumber', '')
      )
      on conflict (lembar_id, urutan) do update set
        nama = excluded.nama,
        satuan = excluded.satuan,
        bobot = excluded.bobot,
        arah = excluded.arah,
        tangga = excluded.tangga,
        asal = excluded.asal,
        sumber = excluded.sumber,
        sumber_ref = excluded.sumber_ref,
        keterangan_sumber = excluded.keterangan_sumber;
      n_indikator := n_indikator + 1;
    end loop;

    delete from kpi_indikator
    where lembar_id = v_lembar
      and urutan not in (
        select (i2 ->> 'urutan')::smallint
        from jsonb_array_elements(coalesce(k -> 'indikator', '[]')) i2
      );

    v_status_baru := case
      when v_status_lama = 'aktif' then 'aktif'
      else coalesce(k ->> 'status', 'aktif')
    end;
    update kpi_lembar set status = v_status_baru where id = v_lembar;
    n_lembar := n_lembar + 1;
  end loop;

  -- 6. Rencana operasional dan tonggaknya. Status tonggak milik orang
  --    yang mencentangnya: impor hanya menyentuh judul, tenggat, urutan.
  --    Baris rencana yang sudah tidak ada di file ikut dihapus.
  if p_rencana ? 'rencana' then
    delete from grd_rencana
    where grd_periode = v_periode
      and kode not in (
        select r2 ->> 'kode'
        from jsonb_array_elements(p_rencana -> 'rencana') r2
      );

    for r in select * from jsonb_array_elements(p_rencana -> 'rencana') loop
      insert into grd_rencana as x
        (grd_periode, kode, goal_id, induk_kode, judul, jenis, pic_ids,
         pic_teks, jadwal_teks, urutan, asal)
      values (
        v_periode,
        r ->> 'kode',
        (select id from goals where grd_periode = v_periode and kode = r ->> 'goal'),
        coalesce(r ->> 'induk_kode', ''),
        r ->> 'judul',
        r ->> 'jenis',
        array(select (y)::uuid from jsonb_array_elements_text(coalesce(r -> 'pic_ids', '[]')) y),
        coalesce(r ->> 'pic_teks', ''),
        coalesce(r ->> 'jadwal_teks', ''),
        coalesce((r ->> 'urutan')::smallint, 0),
        coalesce(r ->> 'asal', '')
      )
      on conflict (grd_periode, kode) do update set
        goal_id = excluded.goal_id,
        induk_kode = excluded.induk_kode,
        judul = excluded.judul,
        jenis = excluded.jenis,
        pic_ids = excluded.pic_ids,
        pic_teks = excluded.pic_teks,
        jadwal_teks = excluded.jadwal_teks,
        urutan = excluded.urutan,
        asal = excluded.asal
      returning id into v_rencana;
      n_rencana := n_rencana + 1;

      delete from grd_tonggak
      where rencana_id = v_rencana
        and kunci not in (
          select t2 ->> 'kunci'
          from jsonb_array_elements(coalesce(r -> 'tonggak', '[]')) t2
        );

      for t in select * from jsonb_array_elements(coalesce(r -> 'tonggak', '[]')) loop
        insert into grd_tonggak (rencana_id, kunci, judul, tenggat, urutan)
        values (
          v_rencana,
          coalesce(t ->> 'kunci', ''),
          t ->> 'judul',
          (t ->> 'tenggat')::date,
          coalesce((t ->> 'urutan')::smallint, 0)
        )
        on conflict (rencana_id, kunci) do update set
          judul = excluded.judul,
          tenggat = excluded.tenggat,
          urutan = excluded.urutan;
        n_tonggak := n_tonggak + 1;
      end loop;
    end loop;
  end if;

  -- 7. Lead measure dari baris HARIAN yang berupa jumlah. Dikenali dari
  --    (goal, kode); lead measure buatan Manager di luar GRD tidak
  --    disentuh. Yang bersumber laporan langsung dihitung ulang untuk
  --    seluruh bulannya, supaya laporan yang masuk sebelum impor ikut.
  for m in select * from jsonb_array_elements(coalesce(p_rencana -> 'lead', '[]')) loop
    select id into v_goal from goals
    where grd_periode = v_periode and kode = m ->> 'goal';
    if v_goal is null then
      raise exception 'Goal % untuk lead measure % tidak ada di rencana',
        m ->> 'goal', m ->> 'kode';
    end if;

    -- Bukan upsert, alasannya sama dengan goal: trigger batas 3 lead
    -- measure (0023) memeriksa baris calon sebelum konflik terdeteksi.
    select id into v_lead from lead_measures
    where goal_id = v_goal and kode = m ->> 'kode';

    if v_lead is null then
      insert into lead_measures
        (goal_id, kode, judul, satuan, target_mingguan, sumber_laporan,
         mulai, selesai, aktif, urutan)
      values (
        v_goal,
        m ->> 'kode',
        m ->> 'judul',
        coalesce(m ->> 'satuan', 'unit'),
        (m ->> 'target_mingguan')::numeric,
        m ->> 'sumber_laporan',
        (m ->> 'mulai')::date,
        (m ->> 'selesai')::date,
        true,
        coalesce((m ->> 'urutan')::int, 0)
      )
      returning id into v_lead;
    else
      update lead_measures set
        judul = m ->> 'judul',
        satuan = coalesce(m ->> 'satuan', 'unit'),
        target_mingguan = (m ->> 'target_mingguan')::numeric,
        sumber_laporan = m ->> 'sumber_laporan',
        mulai = (m ->> 'mulai')::date,
        selesai = (m ->> 'selesai')::date,
        aktif = true,
        urutan = coalesce((m ->> 'urutan')::int, 0)
      where id = v_lead;
    end if;

    delete from lead_measure_akun where lead_measure_id = v_lead;
    insert into lead_measure_akun (lead_measure_id, account_id)
    select v_lead, (y)::uuid
    from jsonb_array_elements_text(coalesce(m -> 'akun', '[]')) y;

    if m ->> 'sumber_laporan' is not null then
      for v_hari in
        select d::date from generate_series(
          greatest(v_periode, coalesce((m ->> 'mulai')::date, v_periode)),
          least((v_periode + interval '1 month - 1 day')::date,
                coalesce((m ->> 'selesai')::date, v_periode + interval '1 month - 1 day'),
                current_date),
          interval '1 day') d
      loop
        for v_unit in
          select distinct a.unit_id from lead_measure_akun x
          join accounts a on a.id = x.account_id
          where x.lead_measure_id = v_lead and a.unit_id is not null
          union
          select g.unit_id from goals g
          where g.id = v_goal and g.unit_id is not null
            and not exists (select 1 from lead_measure_akun x where x.lead_measure_id = v_lead)
        loop
          perform sinkron_lead_measure_laporan(v_unit, v_hari);
        end loop;
      end loop;
    end if;

    n_lead := n_lead + 1;
  end loop;

  -- 8. Akun yang dikecualikan dari papan akun (0196), diganti seluruhnya
  --    menurut pemetaan. Rencana tanpa bagian ini tidak menyentuhnya.
  if p_rencana ? 'papan_kecuali' then
    delete from grd_akun_dikecualikan where grd_periode = v_periode;
    insert into grd_akun_dikecualikan (grd_periode, account_id, alasan)
    select v_periode, (x ->> 'account_id')::uuid, coalesce(x ->> 'alasan', '')
    from jsonb_array_elements(p_rencana -> 'papan_kecuali') x
    on conflict do nothing;
    get diagnostics n_kecuali = row_count;
  end if;

  ringkas := jsonb_build_object(
    'periode', v_periode,
    'goal_lama_dihapus', n_hapus,
    'struktur_disesuaikan', n_struktur,
    'goal', n_goal,
    'ukuran', n_ukuran,
    'lembar', n_lembar,
    'indikator', n_indikator,
    'rencana', n_rencana,
    'tonggak', n_tonggak,
    'lead_measure', n_lead,
    'akun_dikecualikan', n_kecuali,
    'lembar_terkunci_dilewati', lembar_terkunci
  );

  if p_uji then
    raise exception 'UJI_COBA:%', ringkas::text;
  end if;

  return ringkas;
end;
$$;

comment on function impor_grd(jsonb, boolean) is
  'Menerapkan rencana impor GRD (goal, ukuran, kurva, lembar KPI, rencana operasional, tonggak, lead measure, akun dikecualikan papan) dalam satu transaksi; p_uji membatalkannya (0196).';

revoke execute on function impor_grd(jsonb, boolean) from public, anon;

-- ---------------------------------------------------------------------
-- Rollback (manual): kembalikan impor_grd dari 0195; drop papan_akun_grd, grd_akun_dikecualikan, papan_kpi,
-- kelompok_papan; kembalikan scorecard_tim dari 0187 (security invoker,
-- memanggil hitung_kpi); drop skor_kpi_bulan.
-- ---------------------------------------------------------------------
