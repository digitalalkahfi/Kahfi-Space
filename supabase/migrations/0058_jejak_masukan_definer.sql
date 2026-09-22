-- =====================================================================
-- K-Space V2 — Jejak masukan selalu tercatat bersama perubahannya
--
-- CACAT yang ditutup di sini: trigger `catat_perubahan_masukan` menulis
-- ke `feedback_events` atas nama pemanggilnya, sementara tabel itu hanya
-- punya policy SELECT. Akibatnya setiap perubahan status oleh Manager
-- ditolak RLS — bukan diam-diam, melainkan menggagalkan seluruh
-- perubahannya. Fitur tindak lanjut tidak akan berfungsi sama sekali.
--
-- Trigger dijadikan SECURITY DEFINER supaya jejaknya selalu ikut
-- tertulis. Siapa yang boleh mengubah status tetap dijaga RLS pada
-- tabel `feedback`.
-- =====================================================================

create or replace function catat_perubahan_masukan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'ditolak'
     and length(trim(coalesce(new.alasan_tolak, ''))) < 10
  then
    raise exception 'Sebutkan alasan penolakan (minimal 10 huruf)'
      using errcode = 'check_violation';
  end if;

  new.updated_at := now();

  insert into feedback_events (feedback_id, dari, ke, oleh_id, catatan)
  values (
    new.id, old.status, new.status, auth.uid(),
    case when new.status = 'ditolak' then new.alasan_tolak else '' end
  );

  return new;
end;
$$;
