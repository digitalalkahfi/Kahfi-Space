-- =====================================================================
-- K-Space V2 — Preferensi dihormati saat notifikasi terbit (PRD Fase 3)
--
-- Sampai sekarang preferensi baru tersimpan; belum ada yang membacanya
-- saat peristiwa terjadi. Pengaturan yang tidak berpengaruh apa-apa
-- lebih buruk daripada tidak ada pengaturan: orang mematikannya, lalu
-- notifikasinya tetap datang, dan sesudah itu tidak ada satu pun
-- pengaturan di aplikasi ini yang ia percayai.
--
-- Penyaringan dilakukan DI TITIK TERBIT, bukan saat membaca. Notifikasi
-- yang tersimpan lalu disembunyikan tetap menumpuk di basis data, ikut
-- terhitung sebagai "belum dibaca", dan muncul kembali begitu seseorang
-- menyalakan kategorinya — kabar basah dari pekan lalu.
-- =====================================================================

create or replace function boleh_terima_in_app(
  p_user     uuid,
  p_kategori kategori_notifikasi
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Tidak ada baris = ikut bawaan = menyala. Ketiadaan preferensi tidak
  -- pernah berarti "jangan kirim".
  select coalesce(
    (select p.in_app
     from notification_preferences p
     where p.user_id = p_user and p.kategori = p_kategori),
    true
  );
$$;

comment on function boleh_terima_in_app(uuid, kategori_notifikasi) is
  'Apakah kategori ini masih dikirim in-app ke pengguna tersebut.';

-- ---------------------------------------------------------------------
-- Penerbit tunggal ikut menyaring
-- ---------------------------------------------------------------------
create or replace function terbitkan_notifikasi(
  p_user     uuid,
  p_kategori kategori_notifikasi,
  p_judul    text,
  p_pesan    text,
  p_tautan   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Pagar pemanggil (lihat 0111): trigger boleh, klien langsung tidak.
  if pg_trigger_depth() = 0 and auth.uid() is not null then
    raise exception 'Notifikasi hanya diterbitkan oleh sistem'
      using errcode = 'insufficient_privilege';
  end if;

  if p_user is null then
    return null;
  end if;

  -- Baru di 0116: preferensi orangnya dihormati. Mengembalikan null,
  -- bukan melempar — peristiwanya tetap sah, hanya tidak dikabarkan.
  if not boleh_terima_in_app(p_user, p_kategori) then
    return null;
  end if;

  insert into notifications (user_id, kategori, judul, pesan, tautan)
  values (p_user, p_kategori, p_judul, coalesce(p_pesan, ''), p_tautan)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Pengumuman menyisipkan massal, jadi ia perlu penyaring yang sama
-- ---------------------------------------------------------------------
-- Ditulis ulang utuh (bukan ditambal) supaya satu-satunya cara membaca
-- fungsi ini adalah membaca versi terakhirnya.
create or replace function notifikasi_pengumuman_baru()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.published_at is null then
    return new;
  end if;

  insert into notifications (user_id, kategori, judul, pesan, tautan)
  select
    u.id,
    'pengumuman',
    format('Pengumuman baru: %s', new.judul),
    coalesce(nullif(new.ringkasan, ''), 'Buka untuk membacanya.'),
    '/pengumuman'
  from users u
  where u.status = 'aktif'
    and u.id is distinct from new.dibuat_oleh
    and (new.target_role is null or u.role = new.target_role)
    and (new.target_unit_id is null or u.unit_id = new.target_unit_id)
    -- Sama seperti jalur lain: yang mematikan kategori pengumuman
    -- memang tidak ingin diberi tahu.
    and boleh_terima_in_app(u.id, 'pengumuman');

  return new;
end;
$$;
