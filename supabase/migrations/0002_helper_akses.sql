-- =====================================================================
-- K-Space V2 — Helper hak akses untuk Row Level Security (PRD §2)
--
-- Semua policy memanggil fungsi di sini supaya aturan perannya ditulis
-- satu kali. Fungsi dibuat `security definer` + `stable` agar bisa membaca
-- tabel users tanpa memicu rekursi policy pada tabel itu sendiri.
-- =====================================================================

-- Peran pengguna yang sedang login.
create or replace function peran_saya()
returns peran_pengguna
language sql
stable
security definer
set search_path = public
as $$
  select u.role from users u where u.id = auth.uid();
$$;

-- Unit tempat pengguna bertugas (null untuk CEO/Manager/Finance lintas unit).
create or replace function unit_saya()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.unit_id from users u where u.id = auth.uid();
$$;

-- CEO & Manager melihat seluruh perusahaan.
create or replace function lintas_unit()
returns boolean
language sql
stable
as $$
  select peran_saya() in ('CEO', 'Manager');
$$;

-- Finance melihat angka lintas unit, tapi bukan operasional harian orang lain.
create or replace function lintas_angka()
returns boolean
language sql
stable
as $$
  select peran_saya() in ('CEO', 'Manager', 'Finance');
$$;

-- Leader & Co-Leader memimpin satu unit.
create or replace function memimpin_unit()
returns boolean
language sql
stable
as $$
  select peran_saya() in ('Leader', 'Co-Leader');
$$;

-- Boleh melihat data milik unit tertentu?
create or replace function boleh_unit(target_unit uuid)
returns boolean
language sql
stable
as $$
  select lintas_unit()
      or (target_unit is not null and target_unit = unit_saya());
$$;

-- Boleh melihat data milik seseorang? (diri sendiri, bawahan, atau seunit)
create or replace function boleh_orang(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_user is null then false
    when target_user = auth.uid() then true
    when lintas_unit() then true
    when memimpin_unit() then exists (
      select 1 from users u
      where u.id = target_user
        and (u.unit_id = unit_saya() or u.atasan_id = auth.uid())
    )
    else false
  end;
$$;

-- Atasan langsung dari seseorang — dasar alur tiket, QC, dan persetujuan.
create or replace function atasan_dari(target_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.atasan_id from users u where u.id = target_user;
$$;

-- Apakah pengguna aktif adalah PIC akun ini?
create or replace function pic_akun(target_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from accounts a
    where a.id = target_account
      and (a.pic_user_id = auth.uid() or a.co_leader_id = auth.uid())
  );
$$;
