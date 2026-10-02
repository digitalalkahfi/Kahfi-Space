-- =====================================================================
-- K-Space V2 — GRD Oktober 2026 versi final (docs/GRD-OKTOBER-2026.xlsx)
--
-- Melengkapi modul GRD agar menjadi sumber kebenaran goal, operational
-- plan, kurva mingguan, dan KPI. Hanya yang belum ada:
--
--   1. AKTUAL kurva WRM: ukuran GMV terisi otomatis dari laporan harian
--      bila datanya ada; bila laporan harian belum memuat lingkupnya
--      (mis. GMV creator MCN, akun santri yang belum terdaftar), AKTUAL
--      diisi manual tiap Sabtu. Angka yang sama dipakai progres goal dan
--      KPI otomatis.
--   2. Yang mengisi AKTUAL: CEO/Manager, atau Leader/Co-Leader untuk
--      ukuran divisinya (PIC/pemilik goal = dirinya atau bawahannya).
--      Staf tidak mengisi aktual.
--   3. Impor ulang: status tonggak hanya dipertahankan bila isi tonggaknya
--      sama — file final menggeser isi M.5–M.8 dan 1.1.4.5–1.1.4.6.
--   4. Di modul GRD staf hanya melihat goal miliknya: baris operational
--      plan yang dia PIC-nya (plus yang untuk "Seluruh tim/karyawan"),
--      blok goal miliknya di Tabel GRD, dan baris kurva miliknya. Tabel
--      `goals` sendiri tidak diubah karena dipakai modul lain (lead
--      measure, laporan, beranda).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Laporan harian sudah memuat data ukuran GMV?
-- ---------------------------------------------------------------------

/**
 * Ukuran turunan = hanya menjumlah ukuran lain (mis. total perusahaan),
 * tanpa lingkup akun/unit sendiri. Turunan tidak pernah diisi manual;
 * angkanya ikut ukuran-ukuran sumbernya.
 */
create or replace function ukuran_turunan(p_ukuran uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from grd_ukuran_lingkup
           where ukuran_id = p_ukuran and sumber_ukuran_id is not null
         )
     and not exists (
           select 1 from grd_ukuran_lingkup
           where ukuran_id = p_ukuran and sumber_ukuran_id is null
         );
$$;

/**
 * Apakah laporan harian sudah memuat lingkup langsung ukuran GMV ini,
 * dari awal periode GRD sampai `p_sampai`. LIVE dihitung ada bila GMV
 * LIVE-nya terisi. Security definer supaya keputusan otomatis/manual
 * sama bagi semua orang; yang dikembalikan hanya ya/tidak.
 */
create or replace function laporan_ada_ukuran(p_ukuran uuid, p_sampai date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from grd_ukuran u
    join grd_ukuran_lingkup l
      on l.ukuran_id = u.id and l.sumber_ukuran_id is null
    join daily_reports r
      on r.tanggal between u.grd_periode
                       and least(p_sampai, (u.grd_periode + interval '1 month - 1 day')::date)
    left join accounts a on a.id = r.account_id
    where u.id = p_ukuran
      and u.sumber = 'gmv'
      and case
            when l.account_id is not null then r.account_id = l.account_id
            else coalesce(r.unit_id, a.unit_id) = l.unit_id
          end
      and case l.jenis_gmv
            when 'live' then r.gmv_live is not null
            else r.gmv is not null
          end
  );
$$;

comment on function laporan_ada_ukuran(uuid, date) is
  'Laporan harian sudah memuat lingkup ukuran GMV sampai tanggal itu; bila tidak, AKTUAL diisi manual (0198).';

/**
 * Realisasi kumulatif ukuran sampai tanggal (0188), ditambah cadangan
 * manual: ukuran GMV yang lingkupnya belum ada di laporan harian memakai
 * isian terakhir pada atau sebelum `p_sampai` (0 bila belum diisi, sama
 * seperti sebelumnya).
 */
create or replace function realisasi_ukuran(
  p_ukuran uuid,
  p_sampai date,
  p_kedalaman integer default 0
)
returns numeric
language plpgsql
stable
as $$
declare
  u grd_ukuran;
  l grd_ukuran_lingkup;
  dari date;
  akhir date;
  jumlah numeric := 0;
begin
  select * into u from grd_ukuran where id = p_ukuran;
  if u.id is null then
    return null;
  end if;

  if u.sumber = 'isian' then
    return (
      select i.nilai from grd_ukuran_isian i
      where i.ukuran_id = u.id and i.tanggal <= p_sampai
      order by i.tanggal desc
      limit 1
    );
  end if;

  dari := u.grd_periode;
  akhir := least(p_sampai, (u.grd_periode + interval '1 month - 1 day')::date);
  if akhir < dari then
    return 0;
  end if;

  if not ukuran_turunan(u.id) and not laporan_ada_ukuran(u.id, akhir) then
    return coalesce((
      select i.nilai from grd_ukuran_isian i
      where i.ukuran_id = u.id and i.tanggal <= akhir
      order by i.tanggal desc
      limit 1
    ), 0);
  end if;

  for l in select * from grd_ukuran_lingkup where ukuran_id = u.id loop
    if l.sumber_ukuran_id is not null then
      if p_kedalaman < 3 then
        jumlah := jumlah + l.faktor * coalesce(
          realisasi_ukuran(l.sumber_ukuran_id, p_sampai, p_kedalaman + 1), 0);
      end if;
    else
      jumlah := jumlah + l.faktor * coalesce((
        select sum(case l.jenis_gmv
                     when 'live' then coalesce(r.gmv_live, 0)
                     when 'video' then r.gmv - coalesce(r.gmv_live, 0)
                     else r.gmv
                   end)
        from daily_reports r
        left join accounts a on a.id = r.account_id
        where r.tanggal between dari and akhir
          and case
                when l.account_id is not null then r.account_id = l.account_id
                else coalesce(r.unit_id, a.unit_id) = l.unit_id
              end
      ), 0);
    end if;
  end loop;

  return jumlah;
end;
$$;

comment on function realisasi_ukuran(uuid, date, integer) is
  'Realisasi kumulatif ukuran GRD: GMV laporan harian atas lingkupnya, atau isian (ukuran isian, atau GMV yang belum ada di laporan harian) (0198).';

-- ---------------------------------------------------------------------
-- 2. Siapa yang boleh mencatat AKTUAL, dan kapan isian GMV diterima
-- ---------------------------------------------------------------------
create or replace function boleh_isi_ukuran(p_ukuran uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from grd_ukuran u
       left join goals g on g.id = u.goal_id
       where u.id = p_ukuran
         and (u.sumber = 'isian' or not ukuran_turunan(u.id))
         and (
           lintas_unit()
           or (
             memimpin_unit()
             and (
               u.pic_id = auth.uid()
               or g.pemilik_id = auth.uid()
               or exists (
                 select 1 from bawahan_saya() b
                 where b in (u.pic_id, g.pemilik_id)
               )
             )
           )
         )
     );
$$;

comment on function boleh_isi_ukuran(uuid) is
  'CEO/Manager, atau Leader/Co-Leader untuk ukuran yang PIC/pemilik goalnya dirinya atau bawahannya (0198).';

create or replace function jaga_isian_ukuran()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sumber text;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;
  select sumber into v_sumber from grd_ukuran where id = new.ukuran_id;
  if v_sumber = 'gmv' then
    if ukuran_turunan(new.ukuran_id) then
      raise exception 'Ukuran ini jumlah dari ukuran lain, tidak diisi langsung'
        using errcode = 'check_violation';
    end if;
    if laporan_ada_ukuran(new.ukuran_id, new.tanggal) then
      raise exception 'Ukuran ini sudah terisi otomatis dari laporan harian'
        using errcode = 'check_violation';
    end if;
  end if;
  new.diisi_oleh := auth.uid();
  new.diisi_pada := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Kurva WRM: aktual GMV dari laporan harian bila ada; bila tidak, isian
-- PADA tanggal titik itu (diisi tiap Sabtu), sama seperti ukuran isian.
-- `manual` menandai titik yang AKTUAL-nya diisi tangan. Staf hanya
-- melihat baris miliknya.
-- ---------------------------------------------------------------------
create or replace function kurva_grd(p_periode date, p_acuan date)
returns table (
  ukuran_id uuid,
  kode      text,
  judul     text,
  satuan    text,
  sumber    text,
  goal_id   uuid,
  pic       text,
  urutan    smallint,
  boleh_isi boolean,
  titik     jsonb
)
language sql
stable
as $$
  select
    u.id, u.kode, u.judul, u.satuan, u.sumber, u.goal_id,
    coalesce(nullif(p.nama, ''), u.pic_teks),
    u.urutan,
    boleh_isi_ukuran(u.id),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'tanggal', t.tanggal,
        'target', t.target,
        'aktual', a.aktual,
        'manual', a.manual,
        'status', case
          when a.aktual is null then null
          when a.aktual >= t.target then 'hijau'
          else 'merah'
        end
      ) order by t.tanggal)
      from grd_ukuran_titik t
      cross join lateral (
        select
          u.sumber = 'isian'
            or (not ukuran_turunan(u.id)
                and not laporan_ada_ukuran(u.id, least(t.tanggal, p_acuan)))
            as manual
      ) m
      cross join lateral (
        select m.manual, case
          when t.tanggal > p_acuan then null
          when m.manual then (
            select i.nilai from grd_ukuran_isian i
            where i.ukuran_id = u.id and i.tanggal = t.tanggal
          )
          else realisasi_ukuran(u.id, t.tanggal)
        end as aktual
      ) a
      where t.ukuran_id = u.id
    ), '[]'::jsonb)
  from grd_ukuran u
  left join users p on p.id = u.pic_id
  left join goals g on g.id = u.goal_id
  where u.grd_periode = p_periode
    and (
      peran_saya() is distinct from 'Staff'
      or u.pic_id = auth.uid()
      or g.pemilik_id = auth.uid()
    )
  order by u.urutan, u.kode;
$$;

comment on function kurva_grd(date, date) is
  'Kurva WRM GRD: target kumulatif tiap Sabtu, aktual (laporan harian atau isian manual), status HIJAU/MERAH; staf hanya barisnya sendiri (0198).';

-- ---------------------------------------------------------------------
-- 4. Staf di modul GRD: operational plan miliknya, blok goal miliknya
-- ---------------------------------------------------------------------
create or replace function rencana_terlihat(p_pic_ids uuid[], p_pic_teks text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and (
       peran_saya() is distinct from 'Staff'
       or auth.uid() = any (p_pic_ids)
       -- Pekerjaan untuk semua orang, mis. "Seluruh tim", "Seluruh karyawan".
       or p_pic_teks ilike 'seluruh%'
     );
$$;

comment on function rencana_terlihat(uuid[], text) is
  'Operational plan GRD terlihat: semua peran selain Staff; Staff hanya yang dia PIC-nya atau untuk seluruh tim (0198).';

drop policy if exists grd_rencana_baca on grd_rencana;
create policy grd_rencana_baca on grd_rencana
  for select using (rencana_terlihat(pic_ids, pic_teks));

drop policy if exists grd_tonggak_baca on grd_tonggak;
create policy grd_tonggak_baca on grd_tonggak
  for select using (exists (select 1 from grd_rencana r where r.id = rencana_id));

drop policy if exists grd_cascade_blok_baca on grd_cascade_blok;
create policy grd_cascade_blok_baca on grd_cascade_blok
  for select using (
    auth.uid() is not null
    and (
      peran_saya() is distinct from 'Staff'
      or goal_id is null
      or exists (
        select 1 from goals g
        where g.id = goal_id and g.pemilik_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------
-- 3. Impor GRD: sama dengan 0197, kecuali status tonggak dikembalikan
--    ke belum bila isi tonggaknya berubah.
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
          -- Kode yang sama kini pekerjaan lain (isi tonggak berubah):
          -- centang lama bukan milik pekerjaan baru ini → kembali belum.
          status = case when grd_tonggak.judul = excluded.judul
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
    'blok_cascade', n_blok,
    'lembar_terkunci_dilewati', lembar_terkunci
  );

  if p_uji then
    raise exception 'UJI_COBA:%', ringkas::text;
  end if;

  return ringkas;
end;
$$;

comment on function impor_grd(jsonb, boolean) is
  'Menerapkan rencana impor GRD (goal, ukuran, kurva, lembar KPI, rencana operasional, tonggak, lead measure, akun dikecualikan, susunan GRD Cascade) dalam satu transaksi; p_uji membatalkannya (0198).';

revoke execute on function impor_grd(jsonb, boolean) from public, anon;

-- ---------------------------------------------------------------------
-- Rollback (manual): kembalikan realisasi_ukuran, boleh_isi_ukuran,
-- jaga_isian_ukuran, kurva_grd dari 0188, impor_grd dari 0197, policy
-- grd_rencana_baca/grd_tonggak_baca (0192) dan grd_cascade_blok_baca
-- (0197); drop function rencana_terlihat, laporan_ada_ukuran,
-- ukuran_turunan.
-- ---------------------------------------------------------------------
