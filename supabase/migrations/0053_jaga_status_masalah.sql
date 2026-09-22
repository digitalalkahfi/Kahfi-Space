-- =====================================================================
-- K-Space V2 — Status masalah harus jujur pada isinya
--
-- Papan masalah paling gampang berbohong lewat statusnya: ditandai
-- "selesai" padahal tindakannya masih menggantung, atau "ditindak"
-- padahal belum ada satu pun tindakan yang disepakati. Setelah itu
-- papannya hijau sementara masalahnya masih berjalan.
--
-- Aturan di bawah menolak status yang tidak didukung isinya.
-- =====================================================================

create or replace function jaga_status_masalah()
returns trigger
language plpgsql
as $$
declare
  jumlah_why int;
  jumlah_tindakan int;
  tindakan_tertunda int;
begin
  if new.status = old.status then
    return new;
  end if;

  select count(*) into jumlah_why
  from problem_whys where problem_id = new.id;

  select count(*), count(*) filter (where not selesai)
    into jumlah_tindakan, tindakan_tertunda
  from problem_actions where problem_id = new.id;

  if new.status = 'ditindak' then
    if jumlah_why = 0 then
      raise exception 'Telusuri sebabnya dulu sebelum menandai masalah ini ditindak'
        using errcode = 'check_violation';
    end if;
    if jumlah_tindakan = 0 then
      raise exception 'Belum ada tindakan yang disepakati untuk masalah ini'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'selesai' then
    if jumlah_tindakan = 0 then
      raise exception 'Masalah tanpa satu pun tindakan tidak bisa dinyatakan selesai; tutup dengan alasan bila memang tidak perlu ditindak'
        using errcode = 'check_violation';
    end if;
    if tindakan_tertunda > 0 then
      raise exception 'Masih ada % tindakan yang belum tuntas', tindakan_tertunda
        using errcode = 'check_violation';
    end if;
  end if;

  -- Menutup tanpa menindak selalu perlu alasan: itulah satu-satunya
  -- jejak mengapa masalahnya tidak dikerjakan.
  if new.status = 'ditutup'
     and length(trim(coalesce(new.ditutup_alasan, ''))) < 10
  then
    raise exception 'Sebutkan alasan penutupan (minimal 10 huruf)'
      using errcode = 'check_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists jaga_status_masalah_trg on problems;

create trigger jaga_status_masalah_trg
  before update of status on problems
  for each row execute function jaga_status_masalah();

-- Menandai tindakan tuntas ikut mencatat waktunya.
create or replace function catat_tindakan_tuntas()
returns trigger
language plpgsql
as $$
begin
  if new.selesai is distinct from old.selesai then
    new.selesai_pada := case when new.selesai then now() else null end;
  end if;
  return new;
end;
$$;

drop trigger if exists catat_tindakan_tuntas_trg on problem_actions;

create trigger catat_tindakan_tuntas_trg
  before update of selesai on problem_actions
  for each row execute function catat_tindakan_tuntas();
