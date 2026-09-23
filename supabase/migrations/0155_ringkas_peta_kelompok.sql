-- =====================================================================
-- K-Space V2 — Hitungan pemetaan per kelompok
--
-- Layar pemetaan sudah bisa menjawab "berapa entri ada di ekspor" dan
-- "berapa yang menunggu keputusan". Yang belum: berapa yang benar-benar
-- sudah pindah. Tanpa angka itu, satu-satunya cara mengetahui migrasi
-- sudah sampai mana adalah menjalankannya lagi dan melihat apa yang
-- terjadi — cara yang mahal dan menakutkan.
--
-- Dihitung dari `migrasi_peta` (0154), bukan dari jumlah baris tabel
-- tujuan: tabel tujuan ikut menampung baris yang dibuat orang sesudah
-- migrasi, sehingga jumlahnya berhenti membuktikan apa pun.
-- =====================================================================

create or replace function ringkas_peta_kelompok()
returns table (kelompok text, tabel text, jumlah integer, terakhir timestamptz)
language sql
stable
as $$
  select m.kelompok, m.tabel, count(*)::int, max(m.dibuat_pada)
  from migrasi_peta m
  group by m.kelompok, m.tabel
  order by m.kelompok;
$$;

comment on function ringkas_peta_kelompok() is
  'Berapa catatan lama tiap kelompok yang sudah punya padanan di V2.';

/**
 * Orang yang menunggu keputusan, beserta di kunci mana saja ia muncul.
 */
create or replace function daftar_orang_pending()
returns table (
  id_lama    text,
  nama       text,
  alasan     text,
  kemunculan text[],
  user_id    uuid,
  diabaikan  boolean
)
language sql
stable
as $$
  select o.id_lama, o.nama, o.alasan, o.kemunculan, o.user_id, o.diabaikan
  from migrasi_orang_pending o
  order by (o.user_id is not null or o.diabaikan), o.nama, o.id_lama;
$$;
