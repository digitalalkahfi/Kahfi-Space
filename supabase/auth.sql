-- =====================================================================
-- K-Space V2 — Jembatan Supabase Auth ke tabel `users`
--
-- BUKAN bagian dari migrasi biasa: skema `auth` hanya ada di Supabase,
-- sementara migrasi juga dijalankan di PostgreSQL polos saat pengujian.
-- Jalankan berkas ini sekali lewat SQL Editor Supabase setelah migrasi.
--
-- Seluruh policy RLS bertumpu pada `auth.uid() = users.id`. Karena itu
-- baris profil wajib memakai id yang sama persis dengan akun Auth-nya.
-- Tanpa jembatan ini, orang bisa berhasil masuk tetapi tidak punya
-- profil, sehingga `peran_saya()` null dan ia tidak melihat apa pun.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Akun Auth baru → baris profil, atau pendaftaran yang menunggu
--
-- Anggota tim didaftarkan lebih dulu di tabel `users` (lewat seed atau
-- oleh Manager). Saat akun Auth dibuat dengan email yang sama, id profil
-- disamakan dengan id Auth (jalur A di docs/DAFTAR-GOOGLE-PERSETUJUAN.md).
--
-- Sejak 0209, email yang belum dikenal — biasanya orang yang masuk
-- lewat Google — TIDAK dibuatkan profil. Ia dicatat di
-- `pendaftaran_akun` berstatus menunggu sampai CEO/Manager menyetujui
-- atau menolaknya. Tanpa profil aktif, RLS (0208) menolaknya membaca apa
-- pun.
--
-- Profil yang SUDAH punya akun login lain tidak diambil alih walau
-- emailnya cocok: akun baru itu ikut menunggu persetujuan. Tanpa
-- pengecekan ini, mengganti email profil lalu masuk Google dengan email
-- tersebut akan memindahkan profil dan membuat akun sandinya yatim.
-- ---------------------------------------------------------------------
create or replace function auth_ke_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lama uuid;
begin
  select id into lama from users where lower(email) = lower(new.email);

  if lama is not null
     and lama <> new.id
     and exists (select 1 from auth.users a where a.id = lama) then
    lama := null;
  end if;

  if lama is null then
    insert into pendaftaran_akun (id, email, nama_google, foto_url)
    values (
      new.id,
      lower(new.email),
      coalesce(
        nullif(new.raw_user_meta_data ->> 'full_name', ''),
        nullif(new.raw_user_meta_data ->> 'name', ''),
        nullif(new.raw_user_meta_data ->> 'nama', ''),
        split_part(new.email, '@', 1)
      ),
      coalesce(
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'picture'
      )
    )
    on conflict (id) do nothing;
    return new;
  end if;

  if lama <> new.id then
    -- Menyamakan id profil dengan id Auth. Seluruh baris anak ikut
    -- terbawa karena foreign key-nya on update cascade (lihat bawah);
    -- `pindahkan_id_profil` (0209) menahan trigger penjaga riwayat
    -- supaya cascade itu tidak ditolak.
    perform pindahkan_id_profil(lama, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists auth_ke_users_trg on auth.users;

create trigger auth_ke_users_trg
  after insert on auth.users
  for each row execute function auth_ke_users();

-- ---------------------------------------------------------------------
-- Agar penyamaan id di atas tidak memutus riwayat, setiap foreign key
-- yang menunjuk users harus ikut berpindah saat id berubah.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select
      con.conname,
      cl.relname as tabel,
      pg_get_constraintdef(con.oid) as definisi
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    where con.contype = 'f'
      and ns.nspname = 'public'
      and con.confrelid = 'public.users'::regclass
      and pg_get_constraintdef(con.oid) not like '%ON UPDATE CASCADE%'
  loop
    execute format('alter table public.%I drop constraint %I', r.tabel, r.conname);
    execute format('alter table public.%I add constraint %I %s on update cascade',
                   r.tabel, r.conname, r.definisi);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Akun Auth dihapus → profil dinonaktifkan, bukan ikut terhapus.
-- Riwayat laporan, absensi, dan KPI orang itu harus tetap utuh.
-- ---------------------------------------------------------------------
create or replace function auth_hapus_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update users set status = 'nonaktif' where id = old.id;
  return old;
end;
$$;

drop trigger if exists auth_hapus_users_trg on auth.users;

create trigger auth_hapus_users_trg
  after delete on auth.users
  for each row execute function auth_hapus_users();
