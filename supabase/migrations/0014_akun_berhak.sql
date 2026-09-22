-- =====================================================================
-- K-Space V2 — Perketat siapa yang melihat daftar akun
--
-- Policy lama memakai `boleh_unit(unit_id)`, yang bernilai true untuk
-- SEMUA anggota unit — termasuk Staff biasa. Akibatnya pemilih sasaran
-- laporan menawarkan akun milik rekan sejawat: membingungkan, dan
-- membocorkan siapa memegang apa.
--
-- Aturan baru: akun terlihat oleh PIC-nya, co-leader-nya, Leader/Co-Leader
-- unit yang menaunginya, serta CEO/Manager/Finance.
-- =====================================================================

drop policy if exists accounts_baca on accounts;

create policy accounts_baca on accounts
  for select
  using (
    lintas_angka()
    or pic_user_id = auth.uid()
    or co_leader_id = auth.uid()
    or (memimpin_unit() and unit_id = unit_saya())
  );

-- ---------------------------------------------------------------------
-- Sasaran laporan yang benar-benar boleh diisi pengguna aktif.
-- Dipakai API pemilih akun/unit supaya UI dan database sepakat.
-- ---------------------------------------------------------------------
create or replace function sasaran_laporan_saya(p_tanggal date)
returns table (
  jenis          text,
  akun_id        uuid,
  unit_kode      text,
  label          text,
  program        text,
  pic_nama       text,
  target_harian  numeric,
  sudah_lapor    boolean
)
language sql
stable
as $$
  with hari as (
    select extract(day from (date_trunc('month', p_tanggal)
                             + interval '1 month - 1 day'))::numeric as n
  )
  -- Akun affiliator: hanya yang benar-benar dipegang (atau semua bagi CEO/Manager).
  select
    'akun'::text,
    a.id,
    u.kode,
    a.username,
    nullif(p.nama, 'Reguler'),
    pic.nama,
    coalesce((
      select sum(gm.target) / (select n from hari)
      from goals g join goal_months gm on gm.goal_id = g.id
      where g.account_id = a.id and g.status = 'aktif'
        and gm.bulan = date_trunc('month', p_tanggal)::date
    ), 0),
    exists (
      select 1 from daily_reports r
      where r.account_id = a.id and r.tanggal = p_tanggal
    )
  from accounts a
  join units u on u.id = a.unit_id
  left join programs p on p.id = a.program_id
  left join users pic on pic.id = a.pic_user_id
  where a.status = 'aktif'
    and (lintas_unit() or a.pic_user_id = auth.uid())

  union all

  -- Unit tanpa akun aktif melapor di tingkat unit, oleh Leader-nya.
  select
    'unit'::text,
    null::uuid,
    u.kode,
    u.nama,
    null,
    null,
    coalesce((
      select sum(gm.target) / (select n from hari)
      from goals g join goal_months gm on gm.goal_id = g.id
      where g.unit_id = u.id and g.account_id is null and g.status = 'aktif'
        and gm.bulan = date_trunc('month', p_tanggal)::date
    ), 0),
    exists (
      select 1 from daily_reports r
      where r.unit_id = u.id and r.tanggal = p_tanggal
    )
  from units u
  where not exists (
      select 1 from accounts a where a.unit_id = u.id and a.status = 'aktif'
    )
    and (
      lintas_unit()
      or exists (
        select 1 from users me
        where me.id = auth.uid() and me.role = 'Leader' and me.unit_id = u.id
      )
    );
$$;

comment on function sasaran_laporan_saya(date) is
  'Daftar akun/unit yang boleh dilaporkan pengguna aktif, plus targetnya.';
