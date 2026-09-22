-- =====================================================================
-- K-Space V2 — Pemetaan yang disetujui ikut tersimpan, bukan hanya sidiknya
--
-- 0046 menyimpan persetujuan sebagai (entitas, versi) — sidik isi
-- pemetaan. Sidik cukup untuk menggugurkan persetujuan begitu pemetaannya
-- berubah, tetapi tidak cukup untuk menjawab pertanyaan yang justru
-- penting sesudahnya: "apa sebenarnya yang disetujui waktu itu?"
--
-- Pemetaan hidup di kode aplikasi dan ikut berubah setiap rilis. Begitu
-- berubah, tidak ada satu pun cara merekonstruksi bentuk yang pernah
-- disetujui — jejaknya jadi sekadar angka tanpa arti.
--
-- Karena itu isi pemetaannya ikut disalin saat disetujui, dan jalan
-- migrasi mencatat pemetaan yang benar-benar dipakainya. Keduanya
-- menjadikan migrasi bisa ditelusuri setelah kejadian, bukan hanya saat
-- berlangsung.
-- =====================================================================

alter table migrasi_persetujuan
  add column if not exists pemetaan jsonb not null default '{}'::jsonb;

comment on column migrasi_persetujuan.pemetaan is
  'Salinan isi pemetaan saat disetujui; versi adalah sidik dari isi ini.';

alter table migrasi_jalan
  add column if not exists pemetaan jsonb not null default '[]'::jsonb;

comment on column migrasi_jalan.pemetaan is
  'Pemetaan seluruh entitas yang dipakai jalan ini, disalin saat dimulai.';

-- Persetujuan adalah jejak; setelah dicatat isinya tidak boleh berubah.
-- Menarik persetujuan tetap bisa dilakukan dengan menghapus barisnya.
create or replace function jaga_persetujuan_pemetaan()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Persetujuan pemetaan tidak bisa disunting; tarik lalu setujui ulang'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists jaga_persetujuan_pemetaan_trg on migrasi_persetujuan;

create trigger jaga_persetujuan_pemetaan_trg
  before update on migrasi_persetujuan
  for each row execute function jaga_persetujuan_pemetaan();
