-- =====================================================================
-- K-Space V2 — Preferensi notifikasi (PRD Fase 3)
--
-- Satu baris per pengguna per kategori. Kategori yang belum pernah
-- diatur TIDAK disimpan: ketiadaan baris berarti "ikut bawaan", dan
-- bawaan itu satu-satunya tempat aturan default hidup. Menyalin bawaan
-- ke tabel saat pengguna dibuat terlihat rapi, tetapi membuat setiap
-- perubahan bawaan di kemudian hari hanya berlaku bagi orang baru —
-- dan tidak ada yang akan sadar.
--
-- Bawaan yang berlaku: in-app menyala, WhatsApp mati. Kanal yang
-- mengirim pesan ke ponsel pribadi tidak boleh menyala tanpa seseorang
-- memilihnya.
-- =====================================================================

create table notification_preferences (
  user_id    uuid not null references users (id) on delete cascade,
  kategori   kategori_notifikasi not null,
  in_app     boolean not null default true,
  whatsapp   boolean not null default false,
  updated_at timestamptz not null default now(),

  primary key (user_id, kategori),

  -- WhatsApp tidak pernah bisa menyala sendirian. Pesan yang sampai di
  -- ponsel tapi tidak bisa ditemukan lagi di aplikasi adalah pesan yang
  -- hilang: tidak ada tempat membacanya ulang, dan tidak ada jejak
  -- bahwa ia pernah dikirim.
  constraint preferensi_whatsapp_butuh_in_app
    check (not whatsapp or in_app)
);

comment on table notification_preferences is
  'Preferensi per pengguna per kategori; baris yang tidak ada berarti ikut bawaan.';

create index preferensi_notifikasi_milik_idx
  on notification_preferences (user_id);

alter table notification_preferences enable row level security;

create policy preferensi_baca_milik_sendiri on notification_preferences
  for select to authenticated
  using (user_id = auth.uid());

create policy preferensi_tulis_milik_sendiri on notification_preferences
  for insert to authenticated
  with check (user_id = auth.uid());

create policy preferensi_ubah_milik_sendiri on notification_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Menghapus barisnya berarti kembali ke bawaan; itu pilihan yang sah.
create policy preferensi_hapus_milik_sendiri on notification_preferences
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Siapa yang boleh mematikan
-- ---------------------------------------------------------------------
-- RLS tidak bisa membatasi NILAI yang boleh ditulis seseorang pada
-- barisnya sendiri, hanya baris mana yang boleh ia sentuh. Pagar peran
-- karena itu ditaruh di trigger.
--
-- Hanya CEO dan Manager yang boleh mematikan kanal in-app. Bukan soal
-- kepercayaan: notifikasi seorang Staff berisi tugas yang ditujukan
-- kepadanya, dan mematikannya berarti pekerjaan itu hilang tanpa jejak.
-- Peran mana pun tetap boleh MENYALAKAN — larangannya satu arah.
create or replace function jaga_matikan_notifikasi()
returns trigger
language plpgsql
as $$
begin
  -- Perubahan tanpa identitas pengguna (seed, service role) dilepas.
  if auth.uid() is null then
    return new;
  end if;

  if new.in_app = false and not lintas_unit() then
    raise exception 'Hanya CEO dan Manager yang bisa mematikan notifikasi di aplikasi'
      using errcode = 'insufficient_privilege';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists jaga_matikan_notifikasi_trg on notification_preferences;

create trigger jaga_matikan_notifikasi_trg
  before insert or update on notification_preferences
  for each row execute function jaga_matikan_notifikasi();

-- ---------------------------------------------------------------------
-- Membaca preferensi yang berlaku
-- ---------------------------------------------------------------------
-- Menggabungkan baris tersimpan dengan bawaan, supaya pemanggil tidak
-- perlu menirukan aturan penggabungannya sendiri-sendiri — termasuk
-- kategori yang baru ditambahkan setelah seseorang terakhir menyimpan.
create or replace function preferensi_notifikasi_berlaku(p_user uuid)
returns table (
  kategori kategori_notifikasi,
  in_app   boolean,
  whatsapp boolean
)
language sql
stable
as $$
  select
    k.kategori,
    coalesce(p.in_app, true),
    coalesce(p.whatsapp, false)
  from unnest(enum_range(null::kategori_notifikasi)) as k(kategori)
  left join notification_preferences p
    on p.user_id = p_user and p.kategori = k.kategori
  order by k.kategori;
$$;

comment on function preferensi_notifikasi_berlaku(uuid) is
  'Preferensi yang benar-benar berlaku: tersimpan digabung dengan bawaan.';
