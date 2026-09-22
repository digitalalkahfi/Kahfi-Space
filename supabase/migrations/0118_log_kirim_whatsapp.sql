-- =====================================================================
-- K-Space V2 — Log tiap percobaan kirim WhatsApp (PRD Fase 4)
--
-- `notification_delivery` (0117) menyimpan KEADAAN TERAKHIR: berhasil
-- atau tidak, dan galat yang terakhir terjadi. Itu cukup untuk layar,
-- tidak cukup untuk menelusuri.
--
-- Yang hilang justru pertanyaan yang paling sering muncul saat pesan
-- tidak sampai: percobaan pertama gagal karena apa, yang kedua karena
-- apa, dan berapa lama jedanya. Tanpa log, galat kedua menimpa galat
-- pertama dan polanya lenyap — padahal pola itulah yang membedakan
-- "gateway sedang tumbang" dari "nomor ini memang salah".
--
-- Log ini hanya bertambah. Tidak ada UPDATE maupun DELETE untuk siapa
-- pun: catatan percobaan yang bisa disunting bukan catatan.
-- =====================================================================

create table notification_delivery_attempts (
  id          uuid primary key default gen_random_uuid(),
  delivery_id uuid not null
    references notification_delivery (id) on delete cascade,
  urutan      integer not null,
  status      status_kirim_wa not null,
  galat       text not null default '',
  -- Balasan mentah gateway, dipotong. Berguna saat galat yang sudah
  -- diterjemahkan ternyata tidak menjelaskan apa-apa.
  balasan     text not null default '',
  created_at  timestamptz not null default now(),

  unique (delivery_id, urutan),
  constraint log_kirim_urutan_wajar check (urutan between 1 and 10),
  -- 'antre' bukan hasil percobaan, ia keadaan sebelum mencoba.
  constraint log_kirim_hasil_saja
    check (status in ('terkirim', 'gagal')),
  constraint log_kirim_balasan_pendek check (length(balasan) <= 2000)
);

comment on table notification_delivery_attempts is
  'Satu baris per percobaan kirim; hanya bertambah, tidak pernah diubah.';

create index log_kirim_pengiriman_idx
  on notification_delivery_attempts (delivery_id, urutan);

alter table notification_delivery_attempts enable row level security;

-- Pemilik notifikasinya boleh menelusuri percobaannya sendiri — itulah
-- yang menjawab "kenapa punyaku gagal terus". Menulis adalah urusan
-- pengirim (service role), bukan pengguna.
create policy log_kirim_baca_milik_sendiri on notification_delivery_attempts
  for select to authenticated
  using (
    exists (
      select 1
      from notification_delivery d
      join notifications n on n.id = d.notification_id
      where d.id = notification_delivery_attempts.delivery_id
        and n.user_id = auth.uid()
    )
  );

-- Tidak ada policy UPDATE/DELETE: log yang bisa disunting bukan log.

-- ---------------------------------------------------------------------
-- Mencatat percobaan
-- ---------------------------------------------------------------------
-- Dipanggil pengirim setelah gateway menjawab. Ia yang menaikkan
-- `percobaan` dan memindahkan status, supaya pemanggil tidak perlu
-- mengingat urutan kedua langkah itu — dan supaya keduanya tidak bisa
-- terpisah setengah jalan.
create or replace function catat_percobaan_kirim(
  p_delivery uuid,
  p_status   status_kirim_wa,
  p_galat    text default '',
  p_balasan  text default ''
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_urutan integer;
begin
  if auth.uid() is not null then
    raise exception 'Pencatatan pengiriman hanya dilakukan sistem'
      using errcode = 'insufficient_privilege';
  end if;

  if p_status not in ('terkirim', 'gagal') then
    raise exception 'Percobaan hanya berhasil atau gagal'
      using errcode = 'check_violation';
  end if;

  update notification_delivery
  set percobaan    = percobaan + 1,
      status       = p_status,
      galat        = coalesce(p_galat, ''),
      dikirim_pada = case when p_status = 'terkirim' then now() else dikirim_pada end
  where id = p_delivery
  returning percobaan into v_urutan;

  if v_urutan is null then
    return null; -- pengirimannya sudah tidak ada; bukan galat.
  end if;

  insert into notification_delivery_attempts
    (delivery_id, urutan, status, galat, balasan)
  values
    (p_delivery, v_urutan, p_status, coalesce(p_galat, ''),
     left(coalesce(p_balasan, ''), 2000));

  return v_urutan;
end;
$$;

comment on function catat_percobaan_kirim(uuid, status_kirim_wa, text, text) is
  'Mencatat satu percobaan kirim sekaligus memutakhirkan keadaan terakhirnya.';

revoke execute on function
  catat_percobaan_kirim(uuid, status_kirim_wa, text, text)
  from public, authenticated;
