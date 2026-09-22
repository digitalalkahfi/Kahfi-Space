-- =====================================================================
-- K-Space V2 — Migrasi sungguhan menolak data tiruan
--
-- `eksporKvStore()` punya jalan mundur yang masuk akal: selama
-- `kv_store_lama` masih kosong, yang dipakai adalah berkas contoh di
-- repositori, dan layar menyebutnya apa adanya ("data tiruan"). Itu
-- membuat uji coba bisa dijalankan sebelum data lama tersalin.
--
-- Yang belum dijaga: tidak ada apa pun yang menghentikan tahap
-- SUNGGUHAN berjalan di atas data tiruan itu. Urutannya sangat mungkin
-- terjadi pada hari peluncuran — uji coba lulus dengan contoh, lalu
-- orang menekan "jalankan sungguhan" sebelum sempat menyalin kv_store —
-- dan hasilnya baris karangan tertulis ke `users`, `accounts`, `goals`,
-- `daily_reports`, `attendance`, dan `tasks`. Migrasi sungguhan hanya
-- boleh sekali, jadi kekeliruan itu tidak ada jalan pulangnya.
--
-- Syaratnya ditaruh di sini, bukan di aplikasi, karena alasan yang sama
-- dengan syarat-syarat sebelumnya di 0076: ia harus berlaku lewat jalur
-- mana pun, termasuk SQL langsung.
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

    -- Syarat baru: data lamanya harus benar-benar ada di sini.
    if not exists (select 1 from kv_store_lama) then
      raise exception 'kv_store_lama masih kosong; salin dulu data sistem lama ke sana. Uji coba boleh memakai contoh, migrasi sungguhan tidak.'
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
  'Membuka satu jalan migrasi; sungguhan wajib didahului uji coba dan data lama yang sudah tersalin.';
