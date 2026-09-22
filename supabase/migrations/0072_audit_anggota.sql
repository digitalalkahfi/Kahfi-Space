-- =====================================================================
-- K-Space V2 — Jejak perubahan data anggota
--
-- Goal dan anak tangganya sudah meninggalkan jejak sejak 0025, tetapi
-- data kepegawaian belum — padahal justru di sinilah wewenang berpindah:
-- peran menentukan apa yang terbuka, unit menentukan cakupannya, atasan
-- menentukan siapa yang menyetujui izin, dan status menentukan siapa
-- yang masih bisa masuk. Tanpa jejak, perubahan seperti itu tidak bisa
-- ditelusuri sesudahnya: tidak diketahui siapa yang mengubah, kapan, dan
-- dari apa menjadi apa.
--
-- Yang dicatat hanya kolom yang berarti — perubahan foto atau stempel
-- waktu tidak menambah apa pun selain kebisingan. Isinya pun dipilih
-- seperlunya, bukan seluruh baris, supaya jejaknya tidak menggandakan
-- data pribadi setiap kali ada suntingan kecil.
-- =====================================================================

create or replace function ringkas_anggota(p_baris users)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'nama', p_baris.nama,
    'email', p_baris.email,
    'role', p_baris.role,
    'jabatan', p_baris.jabatan,
    'unit_id', p_baris.unit_id,
    'department_id', p_baris.department_id,
    'program_id', p_baris.program_id,
    'atasan_id', p_baris.atasan_id,
    'status', p_baris.status
  );
$$;

create or replace function catat_audit_anggota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lama jsonb;
  baru jsonb;
begin
  lama := case when tg_op = 'INSERT' then null else ringkas_anggota(old) end;
  baru := case when tg_op = 'DELETE' then null else ringkas_anggota(new) end;

  -- Suntingan yang tidak menyentuh satu pun kolom berarti tidak dicatat.
  if tg_op = 'UPDATE' and lama = baru then
    return new;
  end if;

  insert into audit_logs (user_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
  values (
    auth.uid(),
    lower(tg_op),
    'users',
    coalesce(new.id, old.id),
    lama,
    baru
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists users_audit on users;

create trigger users_audit
  after insert or update or delete on users
  for each row execute function catat_audit_anggota();
