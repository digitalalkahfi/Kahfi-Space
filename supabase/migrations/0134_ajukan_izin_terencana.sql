-- =====================================================================
-- K-Space V2 — Pengajuan izin terencana dalam satu transaksi
--
-- Izin tiga hari sebelumnya dikirim aplikasi sebagai dua perjalanan:
-- baris hari pertama dulu, lalu hari-hari sisanya yang menunjuk
-- kepadanya. Bila yang kedua gagal — jaringan putus, satu hari bentrok
-- dengan absensi yang sudah ada — yang tersisa adalah izin sehari yang
-- disangka tiga hari oleh pengajunya. Tidak ada galat yang muncul di
-- layar atasan, karena baginya memang cuma ada satu hari.
--
-- Karena itu seluruh harinya dibuat di satu fungsi, satu transaksi.
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

  -- Hari pertama; pagar H-1 ditegakkan trigger jaga_izin_terencana.
  insert into attendance
    (user_id, tanggal, status, izin_jenis, alasan, persetujuan)
  values
    (auth.uid(), p_mulai, 'izin', 'terencana', btrim(p_alasan), 'diajukan')
  on conflict (user_id, tanggal) do update
    set status = 'izin',
        izin_jenis = 'terencana',
        alasan = excluded.alasan,
        persetujuan = 'diajukan'
  returning id into induk;

  foreach hari in array (
    select array_agg(d::date)
    from generate_series(p_mulai + 1, p_selesai, interval '1 day') d
  )
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
