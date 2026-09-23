-- =====================================================================
-- K-Space V2 — Satu orang V2 hanya boleh diklaim satu orang V1
--
-- Penautan manual sampai sekarang tidak dijaga apa pun: dua id lama bisa
-- ditautkan ke profil V2 yang sama. Akibatnya bukan galat — datanya tetap
-- masuk — melainkan riwayat kerja dua orang yang menyatu menjadi satu,
-- dan tidak ada cara memisahkannya kembali sesudah itu.
--
-- Penjagaannya dua lapis karena padanan bisa datang dari dua tempat:
-- keputusan manual di `migrasi_orang_pending`, dan hasil pemetaan
-- `users:list` yang tersimpan di `migrasi_peta`.
-- =====================================================================

create unique index migrasi_orang_pending_user_unik
  on migrasi_orang_pending (user_id)
  where user_id is not null;

create or replace function jaga_tautan_ganda()
returns trigger
language plpgsql
as $$
declare
  v_lama text;
begin
  if new.user_id is null then
    return new;
  end if;

  select m.id_lama into v_lama
  from migrasi_peta m
  where m.kelompok = 'users:list'
    and m.id_baru = new.user_id
    and m.id_lama <> new.id_lama
  limit 1;

  if v_lama is not null then
    raise exception
      'Orang V2 itu sudah menjadi padanan % dari hasil pemetaan. Periksa dulu mana yang benar.',
      v_lama
      using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

create trigger jaga_tautan_ganda
  before insert or update on migrasi_orang_pending
  for each row execute function jaga_tautan_ganda();
