-- =====================================================================
-- K-Space V2 — Penanggung jawab menandai tuntas, bukan menulis ulang
--
-- `problem_actions_tandai` (0052) mengizinkan penanggung jawab menyunting
-- barisnya sendiri supaya ia bisa menandainya tuntas. RLS tidak bisa
-- membatasi kolom, jadi izin itu sekaligus membolehkannya menulis ulang
-- isi tindakan, memindah tenggat, atau mengalihkan sebab yang
-- ditanganinya.
--
-- Akibatnya bukan sekadar teoretis: tindakan yang disepakati bersama bisa
-- berubah menjadi tindakan lain yang lebih mudah, lalu ditandai tuntas —
-- dan papan masalah tetap menampilkan centang hijau.
--
-- Karena itu yang boleh ia ubah dipersempit ke penandaan tuntas saja.
-- CEO/Manager tetap bebas menyunting lewat `problem_actions_kelola`.
-- =====================================================================

create or replace function jaga_ubah_tindakan()
returns trigger
language plpgsql
as $$
begin
  if lintas_unit() then
    return new;
  end if;

  if (new.problem_id, new.tindakan, new.penanggung_id, new.why_id, new.tenggat)
     is distinct from
     (old.problem_id, old.tindakan, old.penanggung_id, old.why_id, old.tenggat)
  then
    raise exception 'Penanggung jawab hanya boleh menandai tuntas; isi tindakan diubah pengelola'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_ubah_tindakan_trg on problem_actions;

create trigger jaga_ubah_tindakan_trg
  before update on problem_actions
  for each row execute function jaga_ubah_tindakan();
