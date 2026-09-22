-- =====================================================================
-- K-Space V2 — Pencatatan perpindahan selalu memperbarui keadaan sampel
--
-- CACAT yang ditutup di sini: trigger `jaga_kejadian_sampel` memperbarui
-- tabel `samples` atas nama pemanggilnya, sementara `samples_kelola`
-- hanya mengizinkan CEO/Manager. Akibatnya ketika seorang Staff mencatat
-- perpindahan — justru orang yang memegang barangnya — barisnya masuk ke
-- riwayat, tetapi UPDATE-nya tidak mengenai baris apa pun. Tidak ada
-- galat sama sekali; yang terjadi hanyalah riwayat berkata "dipegang"
-- sedangkan sampelnya tetap tercatat "tersedia".
--
-- Trigger dijadikan SECURITY DEFINER supaya keadaan selalu ikut berubah
-- bersama jejaknya. Siapa yang boleh mencatat tetap dijaga RLS pada
-- `sample_events`; yang berubah hanyalah bahwa pencatatan yang sudah
-- lolos tidak bisa lagi setengah jadi.
-- =====================================================================

create or replace function jaga_kejadian_sampel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_kini status_sampel;
begin
  select status into status_kini from samples where id = new.sample_id;

  if status_kini is null then
    raise exception 'Sampel tidak ditemukan';
  end if;

  if not perpindahan_sampel_sah(status_kini, new.ke) then
    raise exception 'Sampel tidak bisa berpindah dari % ke %', status_kini, new.ke
      using errcode = 'check_violation';
  end if;

  new.dari := status_kini;

  perform set_config('app.sampel_via_kejadian', 'ya', true);

  update samples
     set status = new.ke,
         pemegang_id = case
           when new.ke in ('tersedia', 'dikembalikan') then null
           else coalesce(new.pemegang_id, pemegang_id)
         end,
         kreator = case
           when new.ke in ('dikirim', 'diterima')
             then coalesce(nullif(new.kreator, ''), kreator)
           when new.ke in ('tersedia', 'dikembalikan') then ''
           else kreator
         end,
         updated_at = now()
   where id = new.sample_id;

  perform set_config('app.sampel_via_kejadian', '', true);

  return new;
end;
$$;
