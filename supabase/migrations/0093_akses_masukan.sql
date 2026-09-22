-- =====================================================================
-- K-Space V2 — Pengirim dan penanggung jawab masukan
--
-- Sampai sekarang hanya CEO/Manager yang boleh menyentuh baris masukan.
-- Dua pihak yang paling berkepentingan justru tidak bisa apa-apa:
--
--   * PENGIRIM tidak bisa membetulkan judul atau isi laporannya sendiri.
--     Salah ketik pada judul bug — satu-satunya hal yang dibaca orang di
--     daftar — hanya bisa diperbaiki dengan melapor ulang, dan laporan
--     kembarnya lalu memecah dukungan yang sudah terkumpul.
--   * PENANGGUNG JAWAB tidak bisa menggerakkan status laporan yang
--     ditugaskan kepadanya. Ia mengerjakan, tetapi harus meminta orang
--     lain menandainya — sehingga status di layar selalu tertinggal dari
--     kenyataan.
--
-- Keduanya dibuka seperlunya: pengirim hanya selama laporannya belum
-- ditinjau, penanggung jawab hanya statusnya. RLS tidak bisa membatasi
-- kolom, jadi batasnya ditegakkan trigger — sama seperti 0041 dan 0087.
-- =====================================================================

create policy feedback_pengirim on feedback
  for update
  using (dilaporkan_oleh = auth.uid() and status = 'baru')
  with check (dilaporkan_oleh = auth.uid());

create policy feedback_penanggung on feedback
  for update
  using (ditugaskan_ke = auth.uid())
  with check (ditugaskan_ke = auth.uid());

create or replace function jaga_ubah_masukan()
returns trigger
language plpgsql
as $$
begin
  if lintas_unit() then
    return new;
  end if;

  -- Penanggung jawab: hanya statusnya, dan hanya ke arah pengerjaan.
  if old.ditugaskan_ke is not distinct from auth.uid()
     and old.ditugaskan_ke is not null
  then
    if (new.jenis, new.judul, new.isi, new.keparahan, new.halaman,
        new.dilaporkan_oleh, new.ditugaskan_ke)
       is distinct from
       (old.jenis, old.judul, old.isi, old.keparahan, old.halaman,
        old.dilaporkan_oleh, old.ditugaskan_ke)
    then
      raise exception 'Penanggung jawab hanya boleh menggerakkan statusnya'
        using errcode = 'insufficient_privilege';
    end if;

    if new.status not in ('dikerjakan', 'selesai') then
      raise exception 'Status hanya bisa digerakkan ke dikerjakan atau selesai'
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  -- Pengirim: hanya judul dan isinya, selama belum ditinjau.
  if old.dilaporkan_oleh is not distinct from auth.uid() then
    if (new.status, new.jenis, new.keparahan, new.ditugaskan_ke,
        new.dilaporkan_oleh, new.alasan_tolak)
       is distinct from
       (old.status, old.jenis, old.keparahan, old.ditugaskan_ke,
        old.dilaporkan_oleh, old.alasan_tolak)
    then
      raise exception 'Pengirim hanya boleh membetulkan judul dan isi laporannya'
        using errcode = 'insufficient_privilege';
    end if;

    new.updated_at := now();
    return new;
  end if;

  -- Selain keduanya, yang sampai ke sini sudah lolos RLS (atau memang
  -- melewatinya: pemilik basis data dan trigger SECURITY DEFINER seperti
  -- pelepasan tugas saat seseorang dinonaktifkan). Tugas trigger ini
  -- mempersempit hak pengirim dan penanggung jawab, bukan menjadi pagar
  -- utamanya — itu pekerjaan policy.
  return new;
end;
$$;

drop trigger if exists jaga_ubah_masukan_trg on feedback;

create trigger jaga_ubah_masukan_trg
  before update on feedback
  for each row execute function jaga_ubah_masukan();
