-- =====================================================================
-- K-Space V2 — Atasan langsung: tidak terbalik, tidak nonaktif
--
-- Rantai atasan sudah dijaga agar tidak berputar (0044), tetapi arah dan
-- keadaan atasannya belum. Dua akibatnya nyata:
--
--   * Atasan berperan lebih sempit daripada bawahannya membalik wewenang:
--     persetujuan izin, penugasan tiket, dan QC jatuh ke orang yang justru
--     lebih sempit cakupannya — dan `boleh_orang()` ikut membuka data ke
--     arah yang salah.
--   * Atasan yang sudah nonaktif membuat setiap pengajuan izin dan tiket
--     menggantung: penerimanya tidak pernah membukanya lagi.
--
-- Peringkat peran mengikuti PRD: CEO > Manager > Leader > Co-Leader >
-- Staff. Finance berdiri di luar garis unit dan disetarakan dengan Staff.
-- Peringkat yang sama masih diizinkan — organisasi kecil memang kadang
-- menempatkan staf senior sebagai atasan langsung — hanya pembalikannya
-- yang ditolak.
-- =====================================================================

create or replace function peringkat_peran(p_peran peran_pengguna)
returns int
language sql
immutable
as $$
  select case p_peran
    when 'CEO' then 0
    when 'Manager' then 1
    when 'Leader' then 2
    when 'Co-Leader' then 3
    when 'Staff' then 4
    when 'Finance' then 4
  end;
$$;

create or replace function jaga_atasan()
returns trigger
language plpgsql
as $$
declare
  peran_atasan peran_pengguna;
  status_atasan status_aktif;
begin
  if new.atasan_id is null then
    return new;
  end if;

  select role, status into peran_atasan, status_atasan
  from users where id = new.atasan_id;

  if peran_atasan is null then
    raise exception 'Atasan tidak ditemukan';
  end if;

  if status_atasan <> 'aktif' then
    raise exception 'Atasan harus anggota aktif'
      using errcode = 'check_violation';
  end if;

  if peringkat_peran(peran_atasan) > peringkat_peran(new.role) then
    raise exception 'Garis pelaporan terbalik: % tidak bisa menjadi atasan %',
      peran_atasan, new.role
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_atasan_trg on users;

create trigger jaga_atasan_trg
  before insert or update of atasan_id, role on users
  for each row execute function jaga_atasan();

-- Menonaktifkan seseorang melepas bawahannya, bukan membiarkan mereka
-- melapor ke orang yang tak lagi bekerja. Bawahannya lalu tampil "belum
-- ada atasan" di layar Anggota Tim: terlihat, dan bisa ditindak.
create or replace function lepas_bawahan_saat_nonaktif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'nonaktif' and old.status <> 'nonaktif' then
    update users set atasan_id = null where atasan_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists lepas_bawahan_saat_nonaktif_trg on users;

create trigger lepas_bawahan_saat_nonaktif_trg
  after update of status on users
  for each row execute function lepas_bawahan_saat_nonaktif();
