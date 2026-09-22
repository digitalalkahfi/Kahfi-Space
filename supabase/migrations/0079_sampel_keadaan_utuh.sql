-- =====================================================================
-- K-Space V2 — Keadaan sampel harus utuh, bukan hanya berurutan
--
-- Perpindahan sampel sudah dijaga urutannya (0048–0051): barang tidak
-- melompat dari 'tersedia' ke 'dikembalikan', dan status hanya berubah
-- lewat pencatatan kejadian. Yang belum dijaga adalah kelengkapan
-- keadaannya — dan tanpa itu, catatan yang rapi tetap tidak menjawab
-- pertanyaan yang justru penting saat barang dicari:
--
--   * status 'dipegang' tanpa pemegang: barangnya dibawa, tapi entah
--     oleh siapa — persis keadaan yang membuat sampel hilang tanpa
--     ada yang bisa ditanya;
--   * status 'dikirim'/'diterima' tanpa nama kreator: dikirim ke mana?
--   * sampel yang kembali ke gudang tetapi masih tercatat dipegang
--     seseorang, sehingga muncul di dua tempat sekaligus;
--   * sampel tanpa unit tidak terjaring `boleh_unit()`, jadi tidak
--     muncul di layar unit mana pun — hanya pengelola yang melihatnya.
--
-- Semua dijaga di sini supaya berlaku lewat jalur mana pun.
-- =====================================================================

alter table samples
  alter column unit_id set not null;

create or replace function jaga_keadaan_sampel()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'dipegang' and new.pemegang_id is null then
    raise exception 'Sampel berstatus dipegang harus menyebut pemegangnya'
      using errcode = 'check_violation';
  end if;

  if new.status in ('tersedia', 'dikembalikan') and new.pemegang_id is not null then
    -- Barang yang sudah kembali ke gudang tidak boleh tetap tercatat
    -- di tangan seseorang; ia akan muncul di dua tempat sekaligus.
    new.pemegang_id := null;
  end if;

  if new.status in ('dikirim', 'diterima') and btrim(new.kreator) = '' then
    raise exception 'Sampel berstatus % harus menyebut kreator tujuannya', new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_keadaan_sampel_trg on samples;

create trigger jaga_keadaan_sampel_trg
  before insert or update of status, pemegang_id, kreator on samples
  for each row execute function jaga_keadaan_sampel();
