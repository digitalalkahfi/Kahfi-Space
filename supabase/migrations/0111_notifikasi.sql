-- =====================================================================
-- K-Space V2 — Pusat notifikasi in-app (PRD Fase 3)
--
-- Satu baris = satu peristiwa yang terjadi pada SATU orang. Bukan pesan
-- siaran: pengumuman yang ditujukan ke sepuluh orang menghasilkan
-- sepuluh baris, karena "sudah dibaca" adalah keadaan milik masing-
-- masing orang, bukan milik pesannya.
--
-- Tabelnya sengaja tidak menyimpan salinan entitas asalnya — hanya
-- judul, pesan pendek, dan tautan. Notifikasi adalah penunjuk arah,
-- dan penunjuk arah yang menyimpan isi akan basi begitu isinya berubah.
-- =====================================================================

create type kategori_notifikasi as enum (
  'tugas',
  'tenggat',
  'pengumuman',
  'izin',
  'transaksi',
  'anggaran',
  'masukan'
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  kategori    kategori_notifikasi not null,
  judul       text not null,
  pesan       text not null default '',
  -- Selalu jalur internal. `^/` menolak `//luar.example.com` dan
  -- `https://…` sekaligus: kolom ini berakhir di atribut href, dan
  -- href yang bisa diisi alamat luar adalah jalan keluar dari aplikasi
  -- yang tidak pernah diminta siapa pun.
  tautan      text not null,
  dibaca_pada timestamptz,
  created_at  timestamptz not null default now(),

  constraint notifikasi_judul_terisi check (length(trim(judul)) > 0),
  constraint notifikasi_tautan_internal check (tautan ~ '^/(?!/)[^\s]*$'),
  -- Dibaca tidak boleh mendahului terbitnya; jam perangkat yang meleset
  -- akan membuat urutannya mustahil dibaca manusia.
  constraint notifikasi_dibaca_setelah_terbit
    check (dibaca_pada is null or dibaca_pada >= created_at)
);

comment on table notifications is
  'Notifikasi in-app per pengguna; satu baris satu penerima.';
comment on column notifications.tautan is
  'Jalur internal tujuan, mis. /tugas — alamat luar ditolak CHECK.';

-- Yang paling sering ditanya: "punyaku, terbaru dulu" dan "berapa yang
-- belum kubaca". Keduanya dilayani satu indeks parsial dan satu indeks
-- biasa.
create index notifikasi_milik_idx
  on notifications (user_id, created_at desc);

create index notifikasi_belum_dibaca_idx
  on notifications (user_id)
  where dibaca_pada is null;

-- ---------------------------------------------------------------------
-- RLS — notifikasi adalah milik penerimanya, titik
-- ---------------------------------------------------------------------
alter table notifications enable row level security;

-- Tidak ada pengecualian untuk CEO/Manager di sini, berbeda dari tabel
-- lain. Lintas-unit berarti boleh melihat ANGKA unit lain, bukan boleh
-- membaca kotak masuk orang lain.
create policy notifikasi_baca_milik_sendiri on notifications
  for select to authenticated
  using (user_id = auth.uid());

-- Yang boleh diubah pemiliknya hanya penandaan sudah dibaca. Kolom lain
-- dijaga trigger di bawah — RLS tidak bisa membatasi kolom.
create policy notifikasi_tandai_dibaca on notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Tidak ada policy INSERT maupun DELETE untuk `authenticated`:
-- notifikasi diterbitkan trigger peristiwa (security definer) dan
-- dibersihkan pekerjaan terjadwal. Pengguna yang bisa menerbitkan
-- notifikasi untuk dirinya sendiri bisa memalsukan jejak keputusan.

create or replace function jaga_ubah_notifikasi()
returns trigger
language plpgsql
as $$
begin
  -- Perubahan tanpa identitas pengguna (trigger sistem, service role)
  -- tidak dibatasi.
  if auth.uid() is null then
    return new;
  end if;

  if new.user_id     is distinct from old.user_id
     or new.kategori is distinct from old.kategori
     or new.judul    is distinct from old.judul
     or new.pesan    is distinct from old.pesan
     or new.tautan   is distinct from old.tautan
     or new.created_at is distinct from old.created_at then
    raise exception 'Notifikasi hanya bisa ditandai sudah dibaca'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_ubah_notifikasi_trg on notifications;

create trigger jaga_ubah_notifikasi_trg
  before update on notifications
  for each row execute function jaga_ubah_notifikasi();

-- ---------------------------------------------------------------------
-- Menerbitkan notifikasi
-- ---------------------------------------------------------------------

-- `security definer` karena pemanggilnya adalah trigger peristiwa yang
-- berjalan atas nama orang lain: yang membuat tugas menerbitkan
-- notifikasi untuk penerimanya, dan ia tidak punya izin menulis ke
-- kotak masuk orang itu.
create or replace function terbitkan_notifikasi(
  p_user     uuid,
  p_kategori kategori_notifikasi,
  p_judul    text,
  p_pesan    text,
  p_tautan   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Pagar sesungguhnya ada DI DALAM fungsi, bukan pada GRANT-nya.
  -- Proyek Supabase lazim menjalankan `grant execute on all functions
  -- in schema public to authenticated` setelah migrasi, dan REVOKE di
  -- bawah bisa terhapus tanpa ada yang sadar.
  --
  -- Yang dibedakan: dipanggil DARI TRIGGER (sah — peristiwanya memang
  -- sedang terjadi) atau dipanggil langsung oleh klien (tidak sah —
  -- pengguna yang bisa menerbitkan notifikasi bisa memalsukan jejak
  -- "sudah diberi tahu"). `pg_trigger_depth()` menjawabnya tanpa perlu
  -- tahu peran pemanggilnya; `auth.uid() is null` melepaskan seed dan
  -- service role yang memang bukan siapa-siapa.
  if pg_trigger_depth() = 0 and auth.uid() is not null then
    raise exception 'Notifikasi hanya diterbitkan oleh sistem'
      using errcode = 'insufficient_privilege';
  end if;

  -- Penerima yang tidak ada bukan galat yang layak menggagalkan
  -- peristiwanya: tugas tetap harus tersimpan walau notifikasinya
  -- gagal terbit.
  if p_user is null then
    return null;
  end if;

  insert into notifications (user_id, kategori, judul, pesan, tautan)
  values (p_user, p_kategori, p_judul, coalesce(p_pesan, ''), p_tautan)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function terbitkan_notifikasi(uuid, kategori_notifikasi, text, text, text) is
  'Menerbitkan satu notifikasi; dipanggil trigger peristiwa, bukan klien.';

-- Dicabut dari PUBLIC lebih dulu: fungsi baru mewarisi EXECUTE untuk
-- PUBLIC secara bawaan, jadi mencabutnya hanya dari `authenticated`
-- tidak mengubah apa pun — izinnya tetap datang lewat PUBLIC.
revoke execute on function
  terbitkan_notifikasi(uuid, kategori_notifikasi, text, text, text)
  from public, authenticated;
