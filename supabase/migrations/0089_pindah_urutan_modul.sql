-- =====================================================================
-- K-Space V2 — Modul bisa dipindah urutannya
--
-- Modul selalu masuk di nomor terakhir dan nomornya dirapatkan setelah
-- penghapusan (0055), tetapi tidak ada cara memindahkannya. Padahal
-- urutan modul adalah isi kurikulumnya: materi yang seharusnya dibaca
-- lebih dulu terlanjur berada di belakang, dan satu-satunya jalan
-- membetulkannya sekarang adalah menghapus lalu membuat ulang seluruh
-- modul sesudahnya — yang ikut menghapus catatan belajar orang.
--
-- Penukaran dilakukan lewat nomor sementara: `unique (course_id, urutan)`
-- menolak dua baris bernomor sama walau hanya sesaat di tengah perintah.
-- =====================================================================

create or replace function pindah_urutan_modul(p_modul uuid, p_arah int)
returns course_modules
language plpgsql
as $$
declare
  modul course_modules;
  tetangga course_modules;
  sementara int;
begin
  if p_arah not in (-1, 1) then
    raise exception 'Arah pemindahan hanya -1 (naik) atau 1 (turun)';
  end if;

  select * into modul from course_modules where id = p_modul;
  if modul.id is null then
    raise exception 'Modul tidak ditemukan';
  end if;

  select * into tetangga
  from course_modules
  where course_id = modul.course_id and urutan = modul.urutan + p_arah;

  -- Sudah di ujung: bukan galat, sekadar tidak ada yang bisa ditukar.
  if tetangga.id is null then
    return modul;
  end if;

  select coalesce(max(urutan), 0) + 1 into sementara
  from course_modules where course_id = modul.course_id;

  update course_modules set urutan = sementara where id = modul.id;
  update course_modules set urutan = modul.urutan where id = tetangga.id;
  update course_modules set urutan = tetangga.urutan where id = modul.id
  returning * into modul;

  return modul;
end;
$$;

comment on function pindah_urutan_modul(uuid, int) is
  'Menukar modul dengan tetangganya; -1 naik, 1 turun.';
