-- =====================================================================
-- K-Space V2 — Izin terencana sehari & izin berjam sebelum absen masuk
--
-- 1. Izin terencana SATU hari selalu gagal dengan "FOREACH expression
--    must not be null". Hari lanjutan dikumpulkan dengan array_agg, dan
--    array_agg atas nol baris bernilai NULL, bukan larik kosong. Padahal
--    isian bawaan formulir justru sehari (besok sampai besok), jadi
--    pengajuan yang paling umum itulah yang selalu ditolak. Pengulangan
--    kini langsung atas generate_series: nol baris berarti nol putaran.
--
--    Sekalian, pengajuan yang menimpa izin terencana lain tidak lagi
--    meninggalkan hari yang menggantung. Antrean atasan hanya memuat
--    baris tanpa induk, dan keputusan hanya menyebar dari induk ke
--    anaknya langsung (0133), jadi:
--      - hari pertama yang menimpa hari lanjutan izin lama dilepas dari
--        induk lamanya; tanpa itu pengajuan baru tidak pernah muncul di
--        antrean dan tidak pernah diputuskan;
--      - induk lama yang tertimpa rentang baru menyerahkan sisa harinya
--        di luar rentang itu kepada hari sisa yang pertama, yang menjadi
--        pengajuan sendiri; tanpa itu hari-hari sisa itu ikut menunjuk
--        baris yang kini milik pengajuan lain dan tidak pernah diputuskan.
--
-- 2. Izin beberapa jam yang diajukan SEBELUM absen masuk membuat baris
--    hari itu dengan status bawaan 'hadir' tanpa jam masuk. Orangnya
--    tercatat hadir padahal belum datang, dan absen masuknya ditolak
--    "sudah absen". Baris seperti itu kini lahir berstatus 'alpa' —
--    keadaan "belum absen" yang sama dengan sesudah absen ulang (0171) —
--    dan absen masuk yang menyusul mengubahnya menjadi hadir/terlambat.
--    Hanya INSERT yang diusik: izin berjam yang diajukan setelah absen
--    masuk menimpa baris yang sudah ada, dan statusnya tidak disentuh.
-- =====================================================================

create or replace function ajukan_izin_terencana(
  p_mulai date,
  p_selesai date,
  p_alasan text
)
returns uuid
language plpgsql
security invoker  -- RLS tetap berlaku: hanya untuk diri sendiri
set search_path = public
as $$
declare
  induk uuid;
  hari date;
  lama uuid;
  pengganti uuid;
begin
  if auth.uid() is null then
    raise exception 'Perlu masuk untuk mengajukan izin'
      using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(p_alasan, ''))) < 5 then
    raise exception 'Tulis alasan minimal 5 karakter'
      using errcode = 'check_violation';
  end if;
  if p_selesai < p_mulai then
    raise exception 'Tanggal selesai tidak boleh sebelum tanggal mulai'
      using errcode = 'check_violation';
  end if;
  if p_selesai - p_mulai >= 30 then
    raise exception 'Satu pengajuan paling lama 30 hari'
      using errcode = 'check_violation';
  end if;

  for lama in
    select a.id
    from attendance a
    where a.user_id = auth.uid()
      and a.tanggal between p_mulai and p_selesai
      and a.izin_jenis = 'terencana'
      and a.izin_induk_id is null
  loop
    select a.id into pengganti
    from attendance a
    where a.izin_induk_id = lama and a.tanggal > p_selesai
    order by a.tanggal
    limit 1;

    if pengganti is not null then
      update attendance set izin_induk_id = null where id = pengganti;
      update attendance set izin_induk_id = pengganti
       where izin_induk_id = lama and tanggal > p_selesai;
    end if;
  end loop;

  -- Hari pertama; pagar H-1 ditegakkan trigger jaga_izin_terencana.
  insert into attendance
    (user_id, tanggal, status, izin_jenis, alasan, persetujuan)
  values
    (auth.uid(), p_mulai, 'izin', 'terencana', btrim(p_alasan), 'diajukan')
  on conflict (user_id, tanggal) do update
    set status = 'izin',
        izin_jenis = 'terencana',
        izin_induk_id = null,
        alasan = excluded.alasan,
        persetujuan = 'diajukan'
  returning id into induk;

  for hari in
    select d::date
    from generate_series(p_mulai + 1, p_selesai, interval '1 day') d
  loop
    insert into attendance
      (user_id, tanggal, status, izin_jenis, izin_induk_id, alasan, persetujuan)
    values
      (auth.uid(), hari, 'izin', 'terencana', induk, btrim(p_alasan), 'diajukan')
    on conflict (user_id, tanggal) do update
      set status = 'izin',
          izin_jenis = 'terencana',
          izin_induk_id = induk,
          alasan = excluded.alasan,
          persetujuan = 'diajukan';
  end loop;

  return induk;
end;
$$;

comment on function ajukan_izin_terencana(date, date, text) is
  'Membuat seluruh hari izin terencana sekaligus; gagal sebagian berarti gagal semua.';

create or replace function izin_jam_belum_absen()
returns trigger
language plpgsql
as $$
begin
  if new.izin_jenis = 'jam'
     and new.jam_masuk is null
     and new.status = 'hadir'
  then
    new.status := 'alpa';
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_izin_jam_belum_absen on attendance;

create trigger attendance_izin_jam_belum_absen
  before insert on attendance
  for each row execute function izin_jam_belum_absen();

-- Rollback (manual): kembalikan ajukan_izin_terencana ke definisi 0134,
-- lalu `drop trigger attendance_izin_jam_belum_absen on attendance;
-- drop function izin_jam_belum_absen();`.
