-- =====================================================================
-- K-Space V2 — Impor GRD dalam satu transaksi
--
-- `scripts/impor-grd.mjs` membaca file GRD (goal, target per akun,
-- kurva, lembar KPI), memetakan nama dan akun ke data yang ada, lalu
-- menyerahkan RENCANA berbentuk JSON ke fungsi ini. Semuanya diterapkan
-- dalam satu transaksi: kalau satu aturan database menolak (roll-down,
-- batas 3 goal, bobot 100, bulan terkunci), tidak ada yang tersimpan.
--
-- Bisa dijalankan ulang: goal dan ukuran dikenali dari (periode, kode),
-- lembar dari (orang, bulan), indikator dari urutannya. Yang diisi orang
-- — capaian isian, pencapaian KPI — tidak pernah disentuh. Usulan yang
-- sudah disahkan tidak dikembalikan menjadi usulan.
--
-- `p_uji = true` menjalankan seluruh rencana lalu membatalkannya, jadi uji
-- coba diperiksa oleh aturan database yang sama persis tanpa mengubah
-- apa pun. Ringkasannya dikembalikan lewat pesan galat berawalan
-- "UJI_COBA:".
-- =====================================================================

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
        (lembar_id, urutan, nama, satuan, bobot, arah, tangga, asal)
      values (
        v_lembar,
        (i ->> 'urutan')::smallint,
        i ->> 'nama',
        i ->> 'satuan',
        (i ->> 'bobot')::smallint,
        coalesce(i ->> 'arah', 'naik'),
        array(select (y)::numeric from jsonb_array_elements_text(i -> 'tangga') y),
        coalesce(i ->> 'asal', '')
      )
      on conflict (lembar_id, urutan) do update set
        nama = excluded.nama,
        satuan = excluded.satuan,
        bobot = excluded.bobot,
        arah = excluded.arah,
        tangga = excluded.tangga,
        asal = excluded.asal;
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

  ringkas := jsonb_build_object(
    'periode', v_periode,
    'goal_lama_dihapus', n_hapus,
    'struktur_disesuaikan', n_struktur,
    'goal', n_goal,
    'ukuran', n_ukuran,
    'lembar', n_lembar,
    'indikator', n_indikator,
    'lembar_terkunci_dilewati', lembar_terkunci
  );

  if p_uji then
    raise exception 'UJI_COBA:%', ringkas::text;
  end if;

  return ringkas;
end;
$$;

comment on function impor_grd(jsonb, boolean) is
  'Menerapkan rencana impor GRD (goal, ukuran, kurva, lembar KPI) dalam satu transaksi; p_uji membatalkannya setelah diperiksa (0190).';

-- Hanya untuk proses impor; klien biasa tidak perlu memanggilnya.
revoke execute on function impor_grd(jsonb, boolean) from public, anon;
