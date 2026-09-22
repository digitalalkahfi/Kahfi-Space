-- =====================================================================
-- K-Space V2 — Menandai K-Space lama sebagai hanya-baca
--
-- Selama masa peralihan, dua sistem hidup berdampingan dan orang masih
-- terbiasa membuka yang lama. Setiap laporan yang terlanjur masuk ke
-- sana setelah migrasi berjalan akan hilang tanpa ada yang menyadari —
-- data itu tidak pernah ikut pindah, dan tidak ada galat apa pun.
--
-- Karena itu status pembekuan sistem lama disimpan dan ditampilkan ke
-- semua orang, bukan hanya ke yang mengurus migrasi.
-- =====================================================================

alter table pengaturan
  add column if not exists lama_readonly boolean not null default false,
  add column if not exists lama_readonly_pada timestamptz,
  add column if not exists lama_readonly_oleh uuid references users (id)
    on delete set null,
  add column if not exists lama_url text not null default '';

comment on column pengaturan.lama_readonly is
  'true berarti K-Space lama sudah dibekukan; seluruh pencatatan pindah ke sini.';

-- Waktu dan pelaku dicatat otomatis supaya tidak bisa berbeda dari
-- kenyataannya, dan supaya pertanyaan "sejak kapan?" selalu terjawab.
create or replace function catat_pembekuan_lama()
returns trigger
language plpgsql
as $$
begin
  if new.lama_readonly is distinct from old.lama_readonly then
    if new.lama_readonly then
      new.lama_readonly_pada := now();
      new.lama_readonly_oleh := auth.uid();
    else
      new.lama_readonly_pada := null;
      new.lama_readonly_oleh := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists catat_pembekuan_lama_trg on pengaturan;

create trigger catat_pembekuan_lama_trg
  before update on pengaturan
  for each row execute function catat_pembekuan_lama();
