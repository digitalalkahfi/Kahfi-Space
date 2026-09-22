-- =====================================================================
-- K-Space V2 — Riwayat pembekuan K-Space lama
--
-- 0047 menyimpan keadaan sekarang: dibekukan atau tidak, sejak kapan,
-- oleh siapa. Tetapi membuka kembali menghapus ketiganya — dan itulah
-- justru kejadian yang paling perlu ditelusuri. Setelah dibuka lalu
-- dibekukan lagi, tidak ada lagi cara mengetahui bahwa sistem lama
-- sempat terbuka, berapa lama, dan atas keputusan siapa. Padahal di
-- jendela itulah laporan bisa terlanjur masuk ke sistem yang datanya
-- tidak akan pernah ikut pindah.
--
-- Karena itu setiap pembekuan dan pembukaan dicatat sebagai kejadian
-- tersendiri. Keadaan sekarang tetap di `pengaturan`; riwayatnya di sini.
-- =====================================================================

create table kspace_lama_log (
  id         uuid primary key default gen_random_uuid(),
  readonly   boolean not null,
  oleh       uuid references users (id) on delete set null,
  pada       timestamptz not null default now(),
  catatan    text not null default ''
);

create index kspace_lama_log_pada_idx on kspace_lama_log (pada desc);

comment on table kspace_lama_log is
  'Riwayat pembekuan/pembukaan K-Space lama; keadaan sekarang ada di pengaturan.';

create or replace function catat_log_pembekuan_lama()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lama_readonly is distinct from old.lama_readonly then
    insert into kspace_lama_log (readonly, oleh, catatan)
    values (
      new.lama_readonly,
      auth.uid(),
      case when new.lama_readonly
        then 'K-Space lama dibekukan; seluruh pencatatan pindah ke K-Space V2.'
        else 'K-Space lama dibuka kembali; laporan yang masuk ke sana tidak ikut pindah.'
      end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists catat_log_pembekuan_lama_trg on pengaturan;

create trigger catat_log_pembekuan_lama_trg
  after update of lama_readonly on pengaturan
  for each row execute function catat_log_pembekuan_lama();

-- ---------------------------------------------------------------------
-- RLS — riwayatnya boleh dibaca siapa pun yang sudah masuk (semua orang
-- perlu tahu sistem mana yang sedang berlaku), tetapi hanya ditulis
-- trigger di atas.
-- ---------------------------------------------------------------------
alter table kspace_lama_log enable row level security;

create policy kspace_lama_log_baca on kspace_lama_log
  for select using (auth.uid() is not null);
