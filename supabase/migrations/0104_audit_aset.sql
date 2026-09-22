-- =====================================================================
-- K-Space V2 — Jejak perubahan data aset
--
-- Perpindahan tangan dan keadaan sudah punya jejaknya sendiri
-- (`asset_events`, migrasi 0102). Yang belum: perubahan pada data
-- asetnya — nilai perolehan, masa manfaat, nilai residu, unit, dan
-- transaksi asalnya.
--
-- Justru kolom-kolom itulah yang mengubah angka di laporan tanpa terlihat
-- di layar mana pun. Menaikkan nilai perolehan atau memperpanjang masa
-- manfaat menulis ulang seluruh riwayat penyusutannya secara surut, dan
-- tanpa jejak tidak ada cara mengetahui bahwa angkanya pernah lain.
--
-- Jejaknya menumpang `audit_logs` yang sudah dipakai goal dan anggota:
-- satu tempat mencari, satu cara membaca.
-- =====================================================================

create or replace function ringkas_aset(p_baris assets)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'kode', p_baris.kode,
    'nama', p_baris.nama,
    'kategori', p_baris.kategori,
    'unit_id', p_baris.unit_id,
    'tanggal', p_baris.tanggal,
    'nilai_perolehan', p_baris.nilai_perolehan,
    'masa_manfaat', p_baris.masa_manfaat,
    'residu', p_baris.residu,
    'status', p_baris.status,
    'pemegang_id', p_baris.pemegang_id,
    'berakhir', p_baris.berakhir,
    'transaction_id', p_baris.transaction_id
  );
$$;

comment on function ringkas_aset is
  'Kolom aset yang berarti untuk jejak audit; lokasi dan catatan sengaja tidak ikut.';

create or replace function catat_audit_aset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lama jsonb;
  baru jsonb;
begin
  lama := case when tg_op = 'INSERT' then null else ringkas_aset(old) end;
  baru := case when tg_op = 'DELETE' then null else ringkas_aset(new) end;

  -- Suntingan yang tidak menyentuh satu pun kolom berarti tidak dicatat:
  -- pembaruan `updated_at` dan perpindahan lokasi bukan kabar untuk
  -- jejak audit — perpindahan sudah punya tabelnya sendiri.
  if tg_op = 'UPDATE' and lama = baru then
    return new;
  end if;

  insert into audit_logs (user_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
  values (
    auth.uid(),
    lower(tg_op),
    'assets',
    coalesce(new.id, old.id),
    lama,
    baru
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists assets_audit on assets;

create trigger assets_audit
  after insert or update or delete on assets
  for each row execute function catat_audit_aset();

-- ---------------------------------------------------------------------
-- Membaca jejaknya.
--
-- `audit_logs` hanya terbuka untuk CEO/Manager (migrasi 0025). Finance
-- memegang angka asetnya, jadi ia perlu bisa menelusuri perubahan angka
-- itu juga — tetapi hanya untuk aset, bukan untuk data kepegawaian.
-- ---------------------------------------------------------------------
create or replace function audit_aset(
  p_aset uuid default null,
  p_batas int default 200
)
returns table (
  id uuid,
  aset_id uuid,
  kode text,
  nama_aset text,
  aksi text,
  oleh_nama text,
  nilai_lama jsonb,
  nilai_baru jsonb,
  pada timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.entitas_id,
    coalesce(a.kode, l.nilai_lama ->> 'kode'),
    coalesce(a.nama, l.nilai_lama ->> 'nama'),
    l.aksi,
    u.nama,
    l.nilai_lama,
    l.nilai_baru,
    l.created_at
  from audit_logs l
  left join assets a on a.id = l.entitas_id
  left join users u on u.id = l.user_id
  where l.entitas = 'assets'
    and lintas_angka()
    and (p_aset is null or l.entitas_id = p_aset)
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_batas, 200), 1000));
$$;

comment on function audit_aset is
  'Jejak perubahan data aset untuk Finance, Manager, dan CEO.';
