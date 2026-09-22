-- =====================================================================
-- K-Space V2 — Migrasi sungguhan hanya sekali jalan
--
-- Impornya sudah idempoten: setiap entri dikenali dari kunci lamanya dan
-- ditulis dengan upsert, jadi menjalankan ulang tidak menggandakan apa
-- pun. Tapi "tidak menggandakan" bukan berarti "aman diulang": setelah
-- migrasi, orang mulai bekerja di data baru — memperbaiki nama, mengganti
-- PIC, menutup goal. Menjalankan migrasi sungguhan untuk kedua kalinya
-- menimpa seluruh perbaikan itu dengan isi sistem lama, diam-diam.
--
-- Karena itu migrasi sungguhan dibatasi sekali. Uji coba tetap boleh
-- berulang kali — memang itu gunanya — dan justru diwajibkan lebih dulu:
-- migrasi sungguhan tanpa gladi bersih adalah satu-satunya langkah di
-- seluruh alur ini yang tidak bisa dibatalkan.
-- =====================================================================

create or replace function mulai_migrasi_jalan(
  p_tahap tahap_migrasi,
  p_sumber text default 'kv_store',
  p_pemetaan jsonb default '[]'::jsonb,
  p_catatan text default ''
)
returns migrasi_jalan
language plpgsql
security definer
set search_path = public
as $$
declare
  jalan migrasi_jalan;
  terbuka uuid;
begin
  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh memulai migrasi'
      using errcode = 'insufficient_privilege';
  end if;

  select id into terbuka from migrasi_jalan where selesai_pada is null limit 1;
  if terbuka is not null then
    raise exception 'Masih ada jalan migrasi yang belum ditutup; tutup dulu jalan itu'
      using errcode = 'check_violation';
  end if;

  if p_tahap = 'sungguhan' then
    if exists (
      select 1 from migrasi_jalan
      where tahap = 'sungguhan' and selesai_pada is not null
    ) then
      raise exception 'Migrasi sungguhan sudah pernah dijalankan; menjalankannya lagi akan menimpa pekerjaan sesudahnya'
        using errcode = 'check_violation';
    end if;

    if not exists (
      select 1 from migrasi_jalan
      where tahap = 'uji_coba' and selesai_pada is not null
    ) then
      raise exception 'Jalankan uji coba lebih dulu; migrasi sungguhan tidak bisa dibatalkan'
        using errcode = 'check_violation';
    end if;
  end if;

  insert into migrasi_jalan (tahap, sumber, dijalankan_oleh, pemetaan, catatan)
  values (p_tahap, p_sumber, auth.uid(), p_pemetaan, p_catatan)
  returning * into jalan;

  return jalan;
end;
$$;

comment on function mulai_migrasi_jalan(tahap_migrasi, text, jsonb, text) is
  'Memulai jalan migrasi; sungguhan hanya sekali dan wajib didahului uji coba.';
