-- =====================================================================
-- K-Space V2 — Goal GRD per bulan: bulan baru tidak bertabrakan dengan
-- bulan lama
--
-- GRD November 2026 tidak bisa diimpor selama goal GRD Oktober masih
-- aktif: batas "3 goal aktif per orang" (0006) menghitung goal SEMUA
-- bulan. Mengubah status goal Oktober menjadi `selesai` bukan jalan
-- keluar yang aman — `realisasi_gmv_kpi`, `progres_goal`, dan daftar goal
-- hanya membaca goal `aktif`, sehingga angka Oktober yang belum dikunci
-- ikut berubah. Karena itu goal bulan lama DIBIARKAN apa adanya, dan
-- yang diperbaiki hanya tiga tempat yang membuat dua bulan bertabrakan:
--
--   1. batas 3 goal aktif dihitung PER PERIODE GRD (goal di luar GRD
--      dihitung sesama goal di luar GRD, seperti sebelumnya);
--   2. `goal_korporasi` memilih goal perusahaan milik bulan tanggal yang
--      diminta, bukan goal aktif tertua;
--   3. `impor_grd` menutup lead measure GRD bulan-bulan sebelumnya pada
--      akhir bulannya, supaya papan pekanan tidak menampilkan dua bulan.
--
-- Tidak ada rumus GMV, target, atau KPI yang berubah. Aman dijalankan
-- ulang. Rollback di bagian paling bawah.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Batas 3 goal aktif per orang, per periode GRD
-- ---------------------------------------------------------------------
create or replace function batasi_goal_per_orang()
returns trigger
language plpgsql
as $$
declare
  jumlah int;
begin
  if new.pemilik_id is null or new.status <> 'aktif' then
    return new;
  end if;

  select count(*) into jumlah
  from goals
  where pemilik_id = new.pemilik_id
    and status = 'aktif'
    and id is distinct from new.id
    and grd_periode is not distinct from new.grd_periode;

  if jumlah >= 3 then
    raise exception
      'Maksimal 3 goal aktif per orang; % sudah punya %', new.pemilik_id, jumlah
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function batasi_goal_per_orang() is
  'Maksimal 3 goal aktif per orang dalam satu periode GRD; goal di luar GRD dihitung sesamanya (0220).';

-- ---------------------------------------------------------------------
-- 2. Goal korporasi milik bulan yang diminta
-- ---------------------------------------------------------------------
create or replace function goal_korporasi(p_tanggal date)
returns table (
  goal_id        uuid,
  judul          text,
  periode        text,
  target_base    numeric,
  target_goal    numeric,
  target_stretch numeric,
  target_bulan   numeric,
  realisasi      numeric,
  rasio          numeric
)
language sql
stable
as $$
  with korporasi as (
    select
      g.id, g.judul, g.periode,
      g.target_base, g.target_goal, g.target_stretch,
      coalesce(gm.target, 0) as target_bulan,
      case
        when exists (select 1 from grd_ukuran u where u.goal_id = g.id)
          then coalesce(realisasi_goal(g.id, p_tanggal), 0)
        else gmv_goal_rentang(
          null,
          null,
          coalesce(gm.dari, date_trunc('month', p_tanggal)::date),
          least(p_tanggal, coalesce(gm.sampai, p_tanggal))
        )
      end as realisasi
    from goals g
    left join goal_months gm
      on gm.goal_id = g.id and gm.bulan = date_trunc('month', p_tanggal)::date
    where g.level = 'company' and g.status = 'aktif'
    -- Goal yang punya anak tangga untuk bulan tanggal itu lebih dulu,
    -- lalu goal GRD bulan itu; sisanya seperti semula (yang tertua).
    order by (gm.goal_id is null),
             (g.grd_periode is distinct from date_trunc('month', p_tanggal)::date),
             g.created_at
    limit 1
  )
  select
    k.id, k.judul, k.periode,
    k.target_base, k.target_goal, k.target_stretch,
    k.target_bulan,
    k.realisasi,
    case when k.target_bulan > 0
      then round(k.realisasi / k.target_bulan * 100, 1) else 0 end
  from korporasi k;
$$;

comment on function goal_korporasi(date) is
  'Goal perusahaan aktif untuk bulan tanggal itu (yang punya anak tangga bulan itu lebih dulu), beserta realisasinya (0220).';

-- ---------------------------------------------------------------------
-- 3. impor_grd: sama dengan 0201, ditambah langkah 0 (lead measure bulan
--    lalu ditutup pada akhir bulannya)
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
  n_blok integer := 0;
  c jsonb;
  v_peta jsonb := '{}'::jsonb;
  v_ke bigint;
  r jsonb;
  m jsonb;
  v_rencana uuid;
  v_goal uuid;
  v_lead uuid;
  v_hari date;
  v_unit uuid;
  lembar_terkunci jsonb := '[]'::jsonb;
  ringkas jsonb;
  v_tiket jsonb;
  n_lead_tutup integer := 0;
begin
  if not (pemanggil_sistem() or lintas_unit()) then
    raise exception 'Hanya CEO, Manager, atau proses sistem yang boleh mengimpor GRD'
      using errcode = 'insufficient_privilege';
  end if;

  if v_periode is null or extract(day from v_periode) <> 1 then
    raise exception 'Periode rencana harus tanggal 1 sebuah bulan';
  end if;

  -- 0. Lead measure GRD bulan-bulan sebelumnya yang belum bertanggal
  --    selesai ditutup pada akhir bulannya (0220), supaya tidak ikut
  --    tampil di papan pekanan bulan ini. Isiannya tidak disentuh, dan
  --    KPI bulan itu sudah membaca "akhir bulan" bila selesai kosong.
  update lead_measures lm
     set selesai = (g.grd_periode + interval '1 month - 1 day')::date
    from goals g
   where g.id = lm.goal_id
     and g.grd_periode is not null
     and g.grd_periode < v_periode
     and lm.kode is not null
     and lm.selesai is null
     and (lm.mulai is null
          or lm.mulai <= (g.grd_periode + interval '1 month - 1 day')::date);
  get diagnostics n_lead_tutup = row_count;

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
          -- Kode yang sama kini pekerjaan lain (isi tonggak berubah):
          -- centang lama bukan milik pekerjaan baru ini → kembali belum.
          -- 0201: status tonggak yang punya tiket milik tiketnya; judul
          -- yang berganti tidak menghapus pekerjaan yang sudah dicatat
          -- di sana (judul tiketnya ikut diperbarui oleh penyelaras 0200).
          status = case when grd_tonggak.judul = excluded.judul
                             or tonggak_punya_tiket(grd_tonggak.id)
                        then grd_tonggak.status else 'belum' end,
          catatan = case when grd_tonggak.judul = excluded.judul
                         then grd_tonggak.catatan else '' end,
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

  -- 9. Susunan sheet GRD Cascade (0197): blok kolom Perusahaan, Manager,
  --    dan Leader beserta labelnya, lalu tiap rencana ditautkan ke blok
  --    tempatnya berada. Diganti seluruhnya setiap impor.
  if p_rencana ? 'cascade' then
    delete from grd_cascade_blok where grd_periode = v_periode;
    for c, v_ke in
      select x, n - 1 from jsonb_array_elements(p_rencana -> 'cascade')
        with ordinality as t(x, n)
    loop
      insert into grd_cascade_blok
        (grd_periode, kolom, kode, teks, label, goal_id, urutan)
      values (
        v_periode,
        c ->> 'kolom',
        coalesce(c ->> 'kode', ''),
        coalesce(c ->> 'teks', ''),
        coalesce(c ->> 'label', ''),
        (select id from goals where grd_periode = v_periode and kode = c ->> 'goal'),
        v_ke
      )
      returning id into v_id;
      v_peta := v_peta || jsonb_build_object(v_ke::text, v_id);
      n_blok := n_blok + 1;
    end loop;

    for r in select * from jsonb_array_elements(coalesce(p_rencana -> 'rencana', '[]')) loop
      update grd_rencana set
        blok_perusahaan = (v_peta ->> (r #>> '{blok,perusahaan}'))::uuid,
        blok_manager = (v_peta ->> (r #>> '{blok,manager}'))::uuid,
        blok_leader = (v_peta ->> (r #>> '{blok,leader}'))::uuid
      where grd_periode = v_periode and kode = r ->> 'kode';
    end loop;
  end if;

  -- 10. Tiket dari tonggak SEKALI/PEKANAN (0201). Aman diulang: tonggak
  --     yang sudah bertiket dilewati. Pada uji coba seluruh transaksi
  --     dibatalkan di bawah, jadi laporannya persis yang akan terjadi.
  if p_rencana ? 'rencana' then
    v_tiket := buat_tiket_grd(v_periode, false) - 'tiket';
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
    'lead_measure_bulan_lalu_ditutup', n_lead_tutup,
    'akun_dikecualikan', n_kecuali,
    'blok_cascade', n_blok,
    'lembar_terkunci_dilewati', lembar_terkunci,
    'tiket_grd', coalesce(v_tiket, '{}'::jsonb)
  );

  if p_uji then
    raise exception 'UJI_COBA:%', ringkas::text;
  end if;

  return ringkas;
end;
$$;

comment on function impor_grd(jsonb, boolean) is
  'Menerapkan rencana impor GRD (goal, ukuran, kurva, lembar KPI, rencana operasional, tonggak, lead measure, akun dikecualikan, susunan GRD Cascade, tiket dari tonggak) dalam satu transaksi; lead measure bulan lalu ditutup; p_uji membatalkannya (0198, 0201, 0220).';

revoke execute on function impor_grd(jsonb, boolean) from public, anon;

-- ---------------------------------------------------------------------
-- Rollback (manual): jalankan ulang batasi_goal_per_orang dari 0006,
-- goal_korporasi dari 0188, dan impor_grd dari 0201. Tanggal `selesai`
-- lead measure yang sudah terisi boleh dibiarkan (nilainya sama dengan
-- yang dibaca KPI saat kosong).
-- ---------------------------------------------------------------------
