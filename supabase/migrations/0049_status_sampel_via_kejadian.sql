-- =====================================================================
-- K-Space V2 — Status sampel hanya berubah lewat pencatatan perpindahan
--
-- `samples_kelola` memberi CEO/Manager kuasa penuh atas tabel samples,
-- termasuk kolom `status`. Mengubahnya langsung membuat keadaan barang
-- tidak lagi cocok dengan riwayatnya: layar berkata "dikembalikan",
-- sementara jejaknya berhenti di "dikirim". Setelah itu tidak ada cara
-- mengetahui mana yang benar.
--
-- Perubahan status kini hanya diterima bila datang dari trigger
-- `jaga_kejadian_sampel`, yang menandainya lewat penanda sesi.
-- =====================================================================

create or replace function jaga_kejadian_sampel()
returns trigger
language plpgsql
as $$
declare
  status_kini status_sampel;
begin
  select status into status_kini from samples where id = new.sample_id;

  if not perpindahan_sampel_sah(status_kini, new.ke) then
    raise exception 'Sampel tidak bisa berpindah dari % ke %', status_kini, new.ke
      using errcode = 'check_violation';
  end if;

  new.dari := status_kini;

  -- Penanda sesi ini yang membedakan perubahan sah dari penyuntingan
  -- langsung; berlaku hanya sampai transaksinya selesai.
  perform set_config('app.sampel_via_kejadian', 'ya', true);

  update samples
     set status = new.ke,
         pemegang_id = case
           when new.ke in ('tersedia', 'dikembalikan') then null
           else coalesce(new.pemegang_id, pemegang_id)
         end,
         kreator = case
           when new.ke in ('dikirim', 'diterima')
             then coalesce(nullif(new.kreator, ''), kreator)
           when new.ke in ('tersedia', 'dikembalikan') then ''
           else kreator
         end,
         updated_at = now()
   where id = new.sample_id;

  perform set_config('app.sampel_via_kejadian', '', true);

  return new;
end;
$$;

create or replace function jaga_status_sampel()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.sampel_via_kejadian', true), '') <> 'ya'
  then
    raise exception
      'Status sampel hanya berubah lewat pencatatan perpindahan, bukan disunting langsung'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists jaga_status_sampel_trg on samples;

create trigger jaga_status_sampel_trg
  before update of status on samples
  for each row execute function jaga_status_sampel();
