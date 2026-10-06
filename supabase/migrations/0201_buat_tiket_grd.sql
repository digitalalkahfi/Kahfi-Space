-- =====================================================================
-- K-Space V2 — Tonggak GRD menjadi tiket: pembuatan tiket (3 dari 4)
--
-- Rencana operasional GRD jenis SEKALI dan PEKANAN otomatis menjadi tiket
-- di modul Tugas untuk PIC-nya; rencana HARIAN tidak (sudah diukur dari
-- laporan harian). Aturan pembuatannya:
--
--   · satu tonggak = satu tiket; penerima = PIC utama (`pic_ids[1]`),
--     PIC lain ditulis namanya di deskripsi;
--   · pemberi = atasan langsung penerima (yang masih aktif); tanpa atasan
--     → Manager; penerimanya Manager sendiri → CEO; bila tak ada
--     siapa-siapa lagi → sama dengan penerima. QC mengikuti alur QC yang
--     sudah ada, tidak diubah;
--   · tipe `tiket`, goal dari goal rencananya, judul memuat kode rencana
--     + judul tonggak, tenggat = tenggat tonggak pukul 17.00 WIB, dan
--     kriteria selesai disusun dari data rencananya;
--   · TIDAK dibuatkan: tonggak tanpa tenggat, tanpa PIC terdaftar, PIC
--     nonaktif, yang sudah selesai, yang sudah punya tiket, dan semua
--     tonggak di bulan yang KPI-nya sudah dikunci;
--   · tonggak berstatus progress → tiket berstatus berjalan; belum → todo;
--   · tenggat tonggak yang sudah lewat TIDAK digeser — tiketnya langsung
--     lewat tenggat, karena itulah keadaan sebenarnya.
--
-- `buat_tiket_grd` aman dipanggil berulang (tonggak yang sudah bertiket
-- dilewati; kuncinya `tasks_tonggak_unik`) dan berjalan otomatis di akhir
-- `impor_grd`, sehingga GRD bulan berikutnya langsung menjadi tiket. Mode
-- uji (`p_uji = true`) hanya melaporkan: berapa tiket, untuk siapa, dari
-- siapa, dan tonggak mana dilewati beserta alasannya.
--
-- NOTIFIKASI (aturan 12). Pengingat tenggat 0113 tetap berlaku untuk
-- tiket GRD. Yang dicegah adalah ledakan saat tiket dibuat serentak:
--   · "Tugas baru" per tiket dilewati untuk tiket GRD dan diganti SATU
--     ringkasan per penerima per pembuatan;
--   · tiket yang saat dibuat sudah lewat tenggat langsung ditandai
--     "lewat" di `notifikasi_tenggat_terkirim` (cara yang sama dengan
--     0180), sehingga tidak ada "Tenggat lewat" susulan untuknya.
--
-- KPI. Tiket GRD tidak ikut komponen `tiket` rumus jabatan
-- (`realisasi_kpi`): tonggaknya sudah dinilai lewat "tonggak tepat waktu"
-- (`tonggak_tepat_waktu`, tidak diubah), jadi tidak boleh terhitung dua
-- kali bila sebuah bulan memakai rumus jabatan.
--
-- Aman dijalankan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Calon tiket: satu baris per tonggak SEKALI/PEKANAN, lengkap dengan
--    isi tiketnya bila akan dibuat, atau alasan bila dilewati.
--
-- Hanya dipanggil `buat_tiket_grd`; tidak dibuka untuk klien.
-- ---------------------------------------------------------------------
create or replace function calon_tiket_grd(p_periode date)
returns table (
  tonggak_id     uuid,
  kode           text,
  urutan_rencana smallint,
  urutan_tonggak smallint,
  tonggak_judul  text,
  penerima_id    uuid,
  penerima_nama  text,
  pembuat_id     uuid,
  pembuat_nama   text,
  goal_id        uuid,
  judul          text,
  deskripsi      text,
  konteks        text,
  kriteria       text,
  tenggat        timestamptz,
  status         status_tugas,
  alasan         text,
  catatan        text
)
language sql
stable
security definer
set search_path = public
as $$
  with dasar as (
    select
      t.id as tonggak_id, t.judul as t_judul, t.tenggat as t_tenggat,
      t.status as t_status, t.urutan as t_urutan,
      r.kode, r.judul as r_judul, r.goal_id, r.pic_ids, r.pic_teks,
      r.jadwal_teks, r.urutan as r_urutan,
      r.pic_ids[1] as pic_utama,
      g.kode as goal_kode, g.judul as goal_judul
    from grd_tonggak t
    join grd_rencana r on r.id = t.rencana_id
    left join goals g on g.id = r.goal_id
    where r.grd_periode = p_periode
      and r.jenis in ('sekali', 'pekanan')
  ),
  orang as (
    select
      d.*,
      u.id as p_id, u.nama as p_nama, u.status as p_status,
      -- Pemberi: atasan langsung yang aktif → Manager → CEO → penerima.
      coalesce(
        (select a.id from users a
          where a.id = u.atasan_id and a.status = 'aktif'),
        (select m.id from users m
          where m.role = 'Manager' and m.status = 'aktif' and m.id <> u.id
          order by m.created_at, m.id limit 1),
        (select c.id from users c
          where c.role = 'CEO' and c.status = 'aktif' and c.id <> u.id
          order by c.created_at, c.id limit 1),
        u.id
      ) as b_id,
      k.id as tiket_id,
      k.penerima_id as tiket_penerima
    from dasar d
    left join users u on u.id = d.pic_utama
    left join tasks k on k.tonggak_id = d.tonggak_id
  ),
  rakit as (
    select
      o.*,
      b.nama as b_nama,
      judul_tiket_grd(o.kode, o.r_judul, o.t_judul) as judul_tiket
    from orang o
    left join users b on b.id = o.b_id
  )
  select
    x.tonggak_id,
    x.kode,
    x.r_urutan,
    x.t_urutan,
    x.t_judul,
    x.p_id,
    x.p_nama,
    x.b_id,
    x.b_nama,
    x.goal_id,
    x.judul_tiket,
    concat_ws(E'\n',
      format('Dibuat otomatis dari rencana operasional GRD %s. Status tonggaknya mengikuti tiket ini.',
             bulan_indonesia(p_periode, true)),
      format('Rencana %s: %s', x.kode, x.r_judul),
      case when x.goal_kode is not null
           then format('Goal %s: %s', x.goal_kode, x.goal_judul) end,
      case when nullif(btrim(x.jadwal_teks), '') is not null
           then 'Jadwal: ' || x.jadwal_teks end,
      case when nullif(btrim(x.t_judul), '') is not null
                and x.t_judul <> x.r_judul
           then 'Tonggak: ' || x.t_judul end,
      (select 'PIC lain: ' || string_agg(y.nama, ', ' order by array_position(x.pic_ids, y.id))
         from users y
        where y.id = any (x.pic_ids) and y.id <> x.pic_utama
       having count(*) > 0),
      case when nullif(btrim(x.pic_teks), '') is not null
           then 'Penanggung jawab di file GRD: ' || x.pic_teks end
    ),
    format('GRD %s · %s', bulan_indonesia(p_periode), x.kode),
    format('"%s" selesai dan hasilnya bisa ditunjukkan ke pemeriksa. Diajukan paling lambat %s pukul 17.00 WIB.',
           substr(x.judul_tiket, length(x.kode || ' · ') + 1),
           case when x.t_tenggat is not null
                then tanggal_indonesia(x.t_tenggat) else '-' end),
    ((x.t_tenggat + time '17:00') at time zone 'Asia/Jakarta'),
    case x.t_status when 'progress' then 'berjalan'::status_tugas
                    else 'todo'::status_tugas end,
    case
      when periode_grd_terkunci(p_periode) then 'bulan_terkunci'
      when x.tiket_id is not null then 'sudah_punya_tiket'
      when x.t_status = 'selesai' then 'sudah_selesai'
      when x.t_tenggat is null then 'tanpa_tenggat'
      when x.p_id is null then 'tanpa_pic'
      when x.p_status <> 'aktif' then 'penerima_nonaktif'
    end,
    nullif(concat_ws('; ',
      case when x.p_id is not null and x.b_id = x.p_id
           then 'Pemberi sama dengan penerima (tidak ada atasan, Manager, atau CEO aktif lain)' end,
      case when x.tiket_id is not null and x.p_id is not null
                and x.tiket_penerima is distinct from x.p_id
           then 'PIC rencana berbeda dari penerima tiket yang sudah ada; tiket tidak dipindahkan' end,
      case when x.p_id is not null
                and nullif(btrim(x.pic_teks), '') is not null
                and not exists (
                  select 1
                  from users z,
                       regexp_split_to_table(lower(z.nama), '\s+') w
                  where z.id = any (x.pic_ids)
                    and length(w) >= 3
                    and position(w in lower(x.pic_teks)) > 0
                )
           then format('Kolom SIAPA ("%s") tidak tampak pada nama PIC; kemungkinan PIC cadangan (pemilik goal/Manager)',
                       x.pic_teks) end
    ), '')
  from rakit x;
$$;

comment on function calon_tiket_grd(date) is
  'Satu baris per tonggak SEKALI/PEKANAN: isi tiket bila akan dibuat, alasan bila dilewati (0201).';

revoke execute on function calon_tiket_grd(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Pembuat tiket
-- ---------------------------------------------------------------------
create or replace function buat_tiket_grd(p_periode date, p_uji boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terkunci boolean;
  v_harian   integer;
  v_laporan  jsonb;
  v_ids      uuid[] := '{}';
  v_bulan    text;
  n          record;
begin
  if not (pemanggil_sistem() or lintas_unit()) then
    raise exception 'Hanya CEO, Manager, atau proses sistem yang boleh membuat tiket dari rencana GRD'
      using errcode = 'insufficient_privilege';
  end if;

  if p_periode is null or extract(day from p_periode) <> 1 then
    raise exception 'Periode rencana harus tanggal 1 sebuah bulan';
  end if;

  v_terkunci := periode_grd_terkunci(p_periode);
  v_bulan := bulan_indonesia(p_periode, true);
  select count(*) into v_harian
  from grd_rencana where grd_periode = p_periode and jenis = 'harian';

  -- Laporan disusun dari keadaan SEBELUM tiket dibuat; sesudahnya,
  -- tonggak-tonggak itu sudah terbaca "sudah punya tiket".
  with c as materialized (
    select * from calon_tiket_grd(p_periode)
  )
  select jsonb_build_object(
    'periode', p_periode,
    'uji', p_uji,
    'terkunci', v_terkunci,
    'rencana_harian', v_harian,
    'tonggak_diperiksa', (select count(*) from c),
    'dibuat', (select count(*) from c where alasan is null),
    'sudah_ada', (select count(*) from c where alasan = 'sudah_punya_tiket'),
    -- Tiket yang begitu dibuat sudah lewat tenggat (tenggatnya tidak
    -- digeser); mereka tidak memicu "Tenggat lewat" massal.
    'sudah_lewat_tenggat', (select count(*) from c
                            where alasan is null and tenggat < now()),
    'alasan_dilewati', coalesce((
      select jsonb_object_agg(a.alasan, a.jumlah)
      from (select alasan, count(*) as jumlah from c
            where alasan is not null group by alasan) a
    ), '{}'::jsonb),
    'per_penerima', coalesce((
      select jsonb_agg(jsonb_build_object(
               'penerima', p.penerima_nama,
               'pemberi', p.pembuat_nama,
               'jumlah', p.jumlah)
             order by p.jumlah desc, p.penerima_nama)
      from (select penerima_nama, pembuat_nama, count(*) as jumlah
            from c where alasan is null
            group by penerima_nama, pembuat_nama) p
    ), '[]'::jsonb),
    'tiket', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kode', t.kode,
               'tonggak', t.tonggak_judul,
               'judul', t.judul,
               'penerima', t.penerima_nama,
               'pemberi', t.pembuat_nama,
               'tenggat', to_char(t.tenggat at time zone 'Asia/Jakarta',
                                  'YYYY-MM-DD"T"HH24:MI'),
               'status', t.status,
               'catatan', t.catatan)
             order by t.urutan_rencana, t.kode, t.urutan_tonggak)
      from c t where t.alasan is null
    ), '[]'::jsonb),
    'dilewati', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kode', d.kode,
               'tonggak', d.tonggak_judul,
               'alasan', d.alasan)
             order by d.urutan_rencana, d.kode, d.urutan_tonggak)
      from c d
      where d.alasan is not null and d.alasan <> 'sudah_punya_tiket'
    ), '[]'::jsonb),
    'perlu_diperiksa', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kode', e.kode,
               'tonggak', e.tonggak_judul,
               'penerima', e.penerima_nama,
               'catatan', e.catatan)
             order by e.urutan_rencana, e.kode, e.urutan_tonggak)
      from c e where e.catatan is not null
    ), '[]'::jsonb)
  ) into v_laporan;

  if p_uji or v_terkunci then
    if v_terkunci then
      v_laporan := v_laporan || jsonb_build_object('dibuat', 0);
    end if;
    return v_laporan;
  end if;

  with baru as (
    insert into tasks
      (tipe, goal_id, judul, deskripsi, konteks, kriteria_selesai,
       pembuat_id, penerima_id, tenggat, tanpa_jam, prioritas, status,
       tonggak_id)
    select
      'tiket'::tipe_tugas, c.goal_id, c.judul, c.deskripsi, c.konteks,
      c.kriteria, c.pembuat_id, c.penerima_id, c.tenggat, false,
      'sedang'::prioritas_tugas, c.status, c.tonggak_id
    from calon_tiket_grd(p_periode) c
    where c.alasan is null
    order by c.urutan_rencana, c.kode, c.urutan_tonggak
    on conflict (tonggak_id) do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from baru;

  if cardinality(v_ids) > 0 then
    -- Tiket yang saat dibuat sudah lewat tenggat: tidak perlu "Tenggat
    -- lewat" untuknya. Ditulis di pernyataan terpisah dari pembuatan
    -- tiketnya (lihat catatan 0180).
    insert into notifikasi_tenggat_terkirim (task_id, tahap)
    select k.id, 'lewat'
    from tasks k
    where k.id = any (v_ids)
      and k.tenggat < now()
      and k.status not in ('selesai', 'dibatalkan')
    on conflict do nothing;

    -- Satu ringkasan per penerima, bukan satu notifikasi per tiket.
    -- Tidak pernah menggagalkan pembuatan tiketnya.
    begin
      for n in
        select k.penerima_id, count(*) as jumlah
        from tasks k
        where k.id = any (v_ids)
          and k.penerima_id <> k.pembuat_id
        group by k.penerima_id
      loop
        if boleh_terima_in_app(n.penerima_id, 'tugas') then
          insert into notifications (user_id, kategori, judul, pesan, tautan)
          values (
            n.penerima_id,
            'tugas',
            format('Tiket dari rencana GRD %s', v_bulan),
            format('Kamu mendapat %s tiket dari rencana operasional GRD %s. Buka halaman Tugas untuk melihatnya.',
                   n.jumlah, v_bulan),
            '/tugas'
          );
        end if;
      end loop;
    exception
      when others then
        raise warning 'ringkasan notifikasi tiket GRD gagal: %', sqlerrm;
    end;
  end if;

  return v_laporan || jsonb_build_object('dibuat', cardinality(v_ids));
end;
$$;

comment on function buat_tiket_grd(date, boolean) is
  'Membuat tiket dari tonggak SEKALI/PEKANAN satu periode GRD; aman diulang; p_uji = true hanya melaporkan (0201).';

revoke execute on function buat_tiket_grd(date, boolean) from public, anon;

-- ---------------------------------------------------------------------
-- 3. "Tugas baru" tidak diterbitkan per tiket GRD (diganti ringkasan di
--    atas). Isi fungsi sama dengan 0112.
-- ---------------------------------------------------------------------
create or replace function notifikasi_tugas_baru()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.penerima_id is null or new.penerima_id = new.pembuat_id then
    return new;
  end if;

  -- 0201: tiket dari rencana GRD dibuat serentak; penerimanya dikabari
  -- satu kali lewat ringkasan `buat_tiket_grd`.
  if new.tonggak_id is not null then
    return new;
  end if;

  perform terbitkan_notifikasi(
    new.penerima_id,
    'tugas',
    format('Tugas baru: %s', new.judul),
    coalesce(nullif(new.konteks, ''), 'Dibuka dari modul Tugas.'),
    '/tugas'
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. KPI: komponen `tiket` rumus jabatan tidak menghitung tiket GRD.
--    Isi fungsi sama dengan 0185; hanya cabang `tiket` yang bertambah
--    satu syarat (`tonggak_id is null`).
-- ---------------------------------------------------------------------
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

    -- Tanggal tenggat (atau tanggal dibuat, untuk tiket lama tanpa
    -- tenggat) dibaca di WIB, bukan dipotong dari waktu UTC-nya. Tiket
    -- dari rencana GRD dikecualikan: tonggaknya dinilai lewat
    -- `tonggak_tepat_waktu`, jadi menghitungnya di sini berarti dua kali.
    when p_sumber = 'tiket' then (
      select case when count(*) > 0
        then count(*) filter (where status = 'selesai')::numeric / count(*) * 100
        else null end
      from tasks
      where penerima_id = p_user
        and tipe <> 'pribadi'
        and tonggak_id is null
        and coalesce((tenggat at time zone 'Asia/Jakarta')::date,
                     (created_at at time zone 'Asia/Jakarta')::date)
            between (select dari from rentang) and (select sampai from rentang)
    )

    else null
  end;
$$;

comment on function realisasi_kpi(uuid, sumber_kpi, date, date) is
  'Realisasi satu indikator KPI seseorang pada rentang bulan; tiket dipetakan ke periode menurut tanggal WIB, tiket dari rencana GRD tidak dihitung (0173, 0185, 0201).';

-- ---------------------------------------------------------------------
-- 5. impor_grd: isi 0198 apa adanya, dengan dua tambahan (ditandai
--    "0201"):
--      · status tonggak yang punya tiket tidak dikembalikan ke "belum"
--        saat judulnya berubah — statusnya milik tiketnya;
--      · di akhir, tiket dari tonggak dibuat (atau dilaporkan, pada uji
--        coba) dan ringkasannya ikut di hasil impor.
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
  'Menerapkan rencana impor GRD (goal, ukuran, kurva, lembar KPI, rencana operasional, tonggak, lead measure, akun dikecualikan, susunan GRD Cascade, tiket dari tonggak) dalam satu transaksi; p_uji membatalkannya (0198, 0201).';

revoke execute on function impor_grd(jsonb, boolean) from public, anon;

-- ---------------------------------------------------------------------
-- Rollback (manual, urut):
--   jalankan ulang impor_grd dari 0198 dan realisasi_kpi dari 0185;
--   jalankan ulang notifikasi_tugas_baru dari 0112;
--   drop function if exists buat_tiket_grd(date, boolean);
--   drop function if exists calon_tiket_grd(date);
-- Tiket yang sudah terbuat tidak ikut terhapus: lepas tautannya dulu
-- (update tasks set tonggak_id = null where tonggak_id is not null) dan
-- hapus yang tak diinginkan setelah rollback 0200.
-- ---------------------------------------------------------------------
