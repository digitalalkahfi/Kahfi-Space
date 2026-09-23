-- =====================================================================
-- K-Space V2 — Sasaran laporan ikut membawa level akunnya
--
-- Form laporan menampilkan batas minimum level tepat di sebelah kolom
-- jumlah upload. Tanpa kolom ini, halaman itu harus bertanya sekali lagi
-- ke `accounts` hanya untuk satu angka kecil — satu perjalanan tambahan
-- pada halaman yang dibuka seluruh tim setiap sore.
-- =====================================================================

-- Bentuk baris keluarannya berubah, jadi `create or replace` saja ditolak
-- PostgreSQL. Dibuang dulu; hak akses di bawah dipasang ulang.
drop function if exists sasaran_laporan_saya(date);

create function sasaran_laporan_saya(p_tanggal date)
returns table (
  jenis          text,
  akun_id        uuid,
  unit_kode      text,
  label          text,
  program        text,
  pic_nama       text,
  target_harian  numeric,
  level          smallint,
  sudah_lapor    boolean
)
language sql
stable
as $$
  select
    'akun'::text,
    a.id,
    u.kode,
    a.username,
    nullif(p.nama, 'Reguler'),
    pic.nama,
    coalesce(t.target, 0),
    a.level,
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

  -- Sasaran tingkat unit tidak punya level: batas minimum menempel pada
  -- akun, bukan pada unit.
  select
    'unit'::text,
    null::uuid,
    u.kode,
    u.nama,
    null,
    null,
    coalesce(t.target, 0),
    null::smallint,
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
  'Akun/unit yang boleh dilaporkan pengguna aktif, beserta target GRD dan level akunnya.';
