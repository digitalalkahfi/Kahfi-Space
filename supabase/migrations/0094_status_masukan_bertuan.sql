-- =====================================================================
-- K-Space V2 — Laporan yang dikerjakan harus ada yang mengerjakan
--
-- Status 'dikerjakan' bisa dipasang tanpa penanggung jawab. Laporan lalu
-- tampak sedang ditangani — pelapornya berhenti bertanya — padahal tidak
-- ada satu pun orang yang merasa memilikinya. Inilah bentuk paling halus
-- dari laporan yang menghilang: statusnya menenangkan, isinya tidak
-- dikerjakan siapa-siapa.
--
-- Karena itu perpindahan ke 'dikerjakan' menuntut penanggung jawab
-- disebut pada saat yang sama. Status lain tidak diusik: 'baru' dan
-- 'ditinjau' memang belum tentu bertuan, dan menutup laporan tidak
-- memerlukan siapa pun.
--
-- Sebaliknya, melepas penanggung jawab tidak ditolak melainkan ikut
-- memundurkan statusnya ke 'ditinjau'. Orang yang dinonaktifkan melepas
-- seluruh tugasnya (0092); kalau pelepasan itu ditolak, menonaktifkan
-- anggota malah gagal seluruhnya — dan laporannya tetap tampak dikerjakan
-- oleh orang yang sudah tidak ada.
-- =====================================================================

create or replace function jaga_status_bertuan()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'dikerjakan' or new.ditugaskan_ke is not null then
    return new;
  end if;

  -- Penanggung jawabnya dilepas: laporannya memang tidak lagi dikerjakan.
  if tg_op = 'UPDATE' and old.ditugaskan_ke is not null then
    new.status := 'ditinjau';
    return new;
  end if;

  raise exception 'Tentukan penanggung jawabnya sebelum menandai dikerjakan'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists jaga_status_bertuan_trg on feedback;

create trigger jaga_status_bertuan_trg
  before insert or update of status, ditugaskan_ke on feedback
  for each row execute function jaga_status_bertuan();
