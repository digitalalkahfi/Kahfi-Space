-- =====================================================================
-- K-Space V2 — Masukan tidak menggantung pada orang yang sudah pergi
--
-- Keparahan sudah dirapikan sejak 0057: bug tanpa keparahan diisi
-- 'sedang', dan keparahan pada saran dibersihkan. Yang belum dijaga
-- adalah penerima tugasnya.
--
-- `ditugaskan_ke` boleh menunjuk orang yang sudah nonaktif, sehingga
-- laporannya tercatat "sedang dikerjakan" atas nama orang yang tidak lagi
-- bekerja di sini — tanpa ada yang merasa memilikinya, dan tanpa satu pun
-- tanda di layar.
-- =====================================================================

create or replace function jaga_penerima_masukan()
returns trigger
language plpgsql
as $$
declare
  status_penerima status_aktif;
begin
  if new.ditugaskan_ke is not null then
    select status into status_penerima from users where id = new.ditugaskan_ke;

    if status_penerima is null then
      raise exception 'Penerima tugas tidak ditemukan';
    end if;
    if status_penerima <> 'aktif' then
      raise exception 'Penerima tugas sudah nonaktif; tugaskan ke orang lain'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_masukan_trg on feedback;

create trigger jaga_penerima_masukan_trg
  before insert or update of ditugaskan_ke on feedback
  for each row execute function jaga_penerima_masukan();

-- Menonaktifkan seseorang melepas masukan yang ditugaskan kepadanya,
-- sejalan pelepasan PIC akun (0042) dan bawahan (0070). Laporan lalu
-- tampil "belum ditugaskan": terlihat, dan bisa diambil orang lain.
create or replace function lepas_tugas_masukan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'nonaktif' and old.status <> 'nonaktif' then
    update feedback set ditugaskan_ke = null where ditugaskan_ke = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists lepas_tugas_masukan_trg on users;

create trigger lepas_tugas_masukan_trg
  after update of status on users
  for each row execute function lepas_tugas_masukan();
