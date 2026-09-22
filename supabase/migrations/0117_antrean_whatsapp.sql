-- =====================================================================
-- K-Space V2 — Antrean pengiriman WhatsApp (PRD Fase 3–4)
--
-- WhatsApp adalah PELENGKAP, bukan pengganti. Urutannya tidak boleh
-- dibalik: notifikasi in-app terbit lebih dulu dan selalu, lalu
-- pengiriman WhatsApp diantrekan bila memang diminta. Dengan begitu
-- kegagalan gateway — dan gateway pihak ketiga memang gagal — tidak
-- pernah berarti kabarnya hilang.
--
-- Pengiriman tidak dilakukan di dalam trigger. Memanggil layanan luar
-- dari dalam transaksi basis data berarti transaksi itu menunggu
-- jaringan; kalau gateway lambat, yang ikut lambat adalah penyimpanan
-- tugasnya. Yang dilakukan trigger hanya menaruh baris di antrean.
-- =====================================================================

-- Nomor baru berguna kalau pemiliknya memang setuju dihubungi di sana.
alter table users
  add column kontak_terverifikasi_pada timestamptz,
  add column whatsapp_optin boolean not null default false;

comment on column users.kontak_terverifikasi_pada is
  'Kapan nomor kontak dibuktikan milik orangnya; null berarti belum.';
comment on column users.whatsapp_optin is
  'Persetujuan dihubungi lewat WhatsApp; wajib bersama verifikasi.';

-- Nomor yang berubah membatalkan verifikasi dan persetujuannya: nomor
-- baru adalah nomor yang belum pernah dibuktikan, dan mengirim pesan
-- ke sana berarti mengirim ke orang yang tidak pernah setuju.
create or replace function reset_verifikasi_kontak()
returns trigger
language plpgsql
as $$
begin
  if new.kontak is distinct from old.kontak then
    new.kontak_terverifikasi_pada := null;
    new.whatsapp_optin := false;
  end if;
  return new;
end;
$$;

drop trigger if exists reset_verifikasi_kontak_trg on users;
create trigger reset_verifikasi_kontak_trg
  before update on users
  for each row execute function reset_verifikasi_kontak();

create type status_kirim_wa as enum ('antre', 'terkirim', 'gagal');

create table notification_delivery (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications (id) on delete cascade,
  -- Nomor tujuan DISALIN saat diantrekan, tidak dibaca ulang saat
  -- kirim: kalau orangnya mengganti nomor sementara antreannya jalan,
  -- pesan lama tidak boleh mendarat di nomor baru — dan riwayatnya
  -- harus tetap menyebut ke mana ia benar-benar dikirim.
  tujuan          text not null,
  status          status_kirim_wa not null default 'antre',
  percobaan       integer not null default 0,
  galat           text not null default '',
  dikirim_pada    timestamptz,
  created_at      timestamptz not null default now(),

  constraint kirim_wa_tujuan_baku check (tujuan ~ '^\+628[0-9]{8,12}$'),
  constraint kirim_wa_percobaan_wajar check (percobaan between 0 and 10),
  -- Yang berstatus terkirim wajib punya waktunya; tanpa itu riwayat
  -- "terkirim" tidak bisa dijawab dengan "kapan".
  constraint kirim_wa_terkirim_berwaktu
    check (status <> 'terkirim' or dikirim_pada is not null)
);

comment on table notification_delivery is
  'Antrean dan riwayat pengiriman WhatsApp untuk sebuah notifikasi.';

create index kirim_wa_antre_idx
  on notification_delivery (created_at)
  where status = 'antre';

alter table notification_delivery enable row level security;

-- Pemilik notifikasinya boleh melihat status pengirimannya — itulah
-- yang menjawab "kenapa saya tidak dapat WhatsApp-nya". Menulis dan
-- mengubah adalah urusan pengirim (service role), bukan pengguna.
create policy kirim_wa_baca_milik_sendiri on notification_delivery
  for select to authenticated
  using (
    exists (
      select 1 from notifications n
      where n.id = notification_delivery.notification_id
        and n.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Mengantrekan
-- ---------------------------------------------------------------------
-- Syaratnya berlapis dan semuanya wajib:
--   1. kategori itu memang diminta lewat WhatsApp;
--   2. nomornya ada DAN sudah diverifikasi;
--   3. orangnya sudah setuju dihubungi di sana (opt-in).
-- Satu saja tidak terpenuhi, barisnya tidak dibuat — dan notifikasi
-- in-app-nya tetap ada, karena ia sudah terbit lebih dulu.
create or replace function antrekan_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tujuan text;
begin
  select u.kontak into v_tujuan
  from users u
  join notification_preferences p
    on p.user_id = u.id and p.kategori = new.kategori
  where u.id = new.user_id
    and p.whatsapp = true
    and p.in_app = true
    and u.kontak is not null
    and u.kontak_terverifikasi_pada is not null
    and u.whatsapp_optin = true;

  if v_tujuan is null then
    return new;
  end if;

  insert into notification_delivery (notification_id, tujuan)
  values (new.id, v_tujuan);

  return new;
end;
$$;

drop trigger if exists antrekan_whatsapp_trg on notifications;
create trigger antrekan_whatsapp_trg
  after insert on notifications
  for each row execute function antrekan_whatsapp();
