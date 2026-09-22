-- =====================================================================
-- K-Space V2 — Sampel yang sudah berjejak tidak dihapus
--
-- `samples_kelola` berlaku FOR ALL, jadi CEO/Manager juga bisa menghapus
-- sampel. Padahal riwayatnya menggantung di sana:
--
--   * `sample_events` memakai ON DELETE CASCADE — seluruh jejak
--     perpindahannya lenyap bersama barisnya, termasuk catatan barang
--     hilang yang justru paling perlu disimpan;
--   * `sample_scans` memakai ON DELETE SET NULL, tetapi baris pemindaian
--     yang dikenali wajib menyebut sampelnya (0080), sehingga
--     penghapusan malah gagal dengan galat batasan yang tidak berarti
--     apa-apa bagi pemakai.
--
-- Yang benar-benar perlu dihapus hanyalah sampel yang salah dibuat dan
-- belum pernah menyentuh apa pun: belum pernah berpindah, belum pernah
-- dipindai. Itu yang diizinkan di sini; selebihnya ditolak dengan
-- menyebut alasannya.
-- =====================================================================

create or replace function jaga_hapus_sampel()
returns trigger
language plpgsql
as $$
declare
  kejadian integer;
  pindai   integer;
begin
  select count(*) into kejadian from sample_events where sample_id = old.id;
  select count(*) into pindai from sample_scans where sample_id = old.id;

  if kejadian > 0 or pindai > 0 then
    raise exception
      'Sampel % sudah punya riwayat (% perpindahan, % pemindaian); tandai hilang atau dikembalikan, jangan dihapus',
      old.kode, kejadian, pindai
      using errcode = 'check_violation';
  end if;

  if old.status <> 'tersedia' then
    raise exception 'Sampel % sedang berstatus %; hanya yang masih di gudang boleh dihapus',
      old.kode, old.status
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists jaga_hapus_sampel_trg on samples;

create trigger jaga_hapus_sampel_trg
  before delete on samples
  for each row execute function jaga_hapus_sampel();
