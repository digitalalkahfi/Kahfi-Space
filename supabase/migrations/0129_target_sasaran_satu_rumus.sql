-- =====================================================================
-- K-Space V2 — Target sasaran laporan memakai rumus GRD yang sudah ada
--
-- `sasaran_laporan_saya` (0014) menyalin rumus prorata target harian ke
-- dalam dirinya sendiri, padahal `target_harian_akun` dan
-- `target_harian_unit` (0006) sudah menghitung hal yang sama untuk WRM
-- dan KPI. Dua salinan rumus yang sama adalah dua tempat yang bisa
-- berbeda: begitu satu diubah — misalnya prorata per hari kerja, bukan
-- per hari kalender — target di form laporan dan target di KPI diam-diam
-- berbeda, dan tidak ada yang memberi tahu.
--
-- Isinya tidak berubah, hanya sumber angkanya kini satu.
-- =====================================================================

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
  -- Akun affiliator: hanya yang benar-benar dipegang (atau semua bagi CEO/Manager).
  select
    'akun'::text,
    a.id,
    u.kode,
    a.username,
    nullif(p.nama, 'Reguler'),
    pic.nama,
    coalesce(t.target, 0),
    exists (
      select 1 from daily_reports r
      where r.account_id = a.id and r.tanggal = p_tanggal
    )
  from accounts a
  join units u on u.id = a.unit_id
  left join programs p on p.id = a.program_id
  left join users pic on pic.id = a.pic_user_id
  left join target_harian_akun(p_tanggal) t on t.account_id = a.id
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
    coalesce(t.target, 0),
    exists (
      select 1 from daily_reports r
      where r.unit_id = u.id and r.tanggal = p_tanggal
    )
  from units u
  left join target_harian_unit(p_tanggal) t on t.unit_id = u.id
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
  'Daftar akun/unit yang boleh dilaporkan pengguna aktif; targetnya dari GRD (0006).';
