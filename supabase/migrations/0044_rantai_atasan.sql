-- =====================================================================
-- K-Space V2 — Rantai atasan tidak boleh berputar
--
-- 0001 hanya melarang seseorang menjadi atasan dirinya sendiri, dan
-- mencatat bahwa rantai lebih dalam "dijaga aplikasi". Itu tidak cukup:
-- A→B→A membuat setiap penelusuran atasan berputar tanpa henti, dan
-- fungsi seperti `atasan_dari()` dipakai policy RLS. Satu siklus bisa
-- menggantung query, bukan sekadar menampilkan data aneh.
--
-- Tampilan garis pelaporannya sendiri diturunkan di aplikasi dari daftar
-- anggota yang sudah dimuat (`src/lib/atasan.ts`), jadi tidak perlu satu
-- query per orang.
-- =====================================================================

create or replace function jaga_rantai_atasan()
returns trigger
language plpgsql
as $$
declare
  jejak uuid := new.atasan_id;
  langkah integer := 0;
begin
  if new.atasan_id is null then
    return new;
  end if;

  -- Telusuri ke atas; bila bertemu orangnya sendiri, rantainya berputar.
  while jejak is not null loop
    if jejak = new.id then
      raise exception 'Penetapan ini membuat rantai atasan berputar'
        using errcode = 'check_violation';
    end if;

    langkah := langkah + 1;
    if langkah > 50 then
      raise exception 'Rantai atasan terlalu dalam; kemungkinan sudah berputar'
        using errcode = 'check_violation';
    end if;

    select atasan_id into jejak from users where id = jejak;
  end loop;

  return new;
end;
$$;

drop trigger if exists jaga_rantai_atasan_trg on users;

create trigger jaga_rantai_atasan_trg
  before insert or update of atasan_id on users
  for each row execute function jaga_rantai_atasan();
