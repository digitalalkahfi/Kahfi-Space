-- =====================================================================
-- K-Space V2 — Notifikasi tenggat (PRD Fase 3)
--
-- Tenggat berbeda dari peristiwa lain: tidak ada yang "terjadi" saat
-- sebuah tugas mendekati batas waktunya. Tidak ada INSERT, tidak ada
-- UPDATE — yang berubah hanya jam dinding. Karena itu ia tidak bisa
-- dipicu trigger tabel, dan harus dijalankan berkala.
--
-- Fungsinya dibuat AMAN DIPANGGIL BERULANG: memanggilnya lima kali
-- dalam sejam tidak menghasilkan lima notifikasi. Pekerjaan terjadwal
-- yang gagal lalu diulang adalah hal biasa; notifikasi ganda membuat
-- orang berhenti membaca loncengnya.
-- =====================================================================

-- Penanda idempoten: satu tugas boleh diingatkan sekali per tahap.
-- Disimpan sebagai baris, bukan kolom di `tasks`, supaya tabel tugas
-- tidak ikut berubah setiap kali pengingat berjalan — dan supaya
-- pengingat bisa dihapus tanpa menyentuh tugasnya.
create table notifikasi_tenggat_terkirim (
  task_id    uuid not null references tasks (id) on delete cascade,
  tahap      text not null check (tahap in ('mendekat', 'lewat')),
  terkirim   timestamptz not null default now(),
  primary key (task_id, tahap)
);

comment on table notifikasi_tenggat_terkirim is
  'Penanda agar pengingat tenggat tidak terbit dua kali untuk tugas yang sama.';

alter table notifikasi_tenggat_terkirim enable row level security;

-- Penolakan ditulis EKSPLISIT, bukan dibiarkan sebagai "tabel ber-RLS
-- tanpa policy". Keduanya berakibat sama — tidak ada yang bisa
-- membacanya — tetapi yang kedua tidak bisa dibedakan dari policy yang
-- lupa ditulis, dan pembaca berikutnya akan menambahkannya "supaya
-- tidak lupa". Fungsi pengingat di bawah berjalan security definer,
-- jadi ia tidak terpengaruh.
create policy tenggat_terkirim_tertutup on notifikasi_tenggat_terkirim
  for select to authenticated
  using (false);

/**
 * Menerbitkan pengingat tenggat.
 *
 * `p_ambang_jam` menentukan seberapa dekat dianggap "mendekat" —
 * bawaannya 24 jam. Tugas yang sudah selesai atau dibatalkan tidak
 * diingatkan: mengingatkan tenggat pekerjaan yang sudah beres adalah
 * cara cepat membuat pengingat diabaikan.
 */
create or replace function terbitkan_notifikasi_tenggat(
  p_ambang_jam integer default 24
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jumlah integer := 0;
begin
  -- Pagar di dalam fungsi, bukan pada GRANT-nya (lihat catatan di
  -- 0111): hanya pemanggil tanpa identitas pengguna — pekerjaan
  -- terjadwal atau service role — yang boleh menjalankannya. Tanpa
  -- ini, siapa pun yang punya sesi bisa membanjiri kotak masuk
  -- seluruh tim dengan memanggilnya berulang-ulang.
  if auth.uid() is not null then
    raise exception 'Pengingat tenggat hanya dijalankan sistem'
      using errcode = 'insufficient_privilege';
  end if;
  -- Tahap "lewat" didahulukan: tugas yang sudah lewat tenggat tidak
  -- perlu lagi diberi tahu bahwa tenggatnya mendekat.
  with calon as (
    select t.id, t.judul, t.penerima_id, t.tenggat
    from tasks t
    where t.penerima_id is not null
      and t.tenggat is not null
      and t.tenggat < now()
      and t.status not in ('selesai', 'dibatalkan')
      and not exists (
        select 1 from notifikasi_tenggat_terkirim x
        where x.task_id = t.id and x.tahap = 'lewat'
      )
  ),
  terbit as (
    insert into notifications (user_id, kategori, judul, pesan, tautan)
    select
      c.penerima_id,
      'tenggat',
      format('Tenggat lewat: %s', c.judul),
      format('Jatuh tempo %s.', to_char(c.tenggat, 'DD Mon YYYY HH24:MI')),
      '/tugas'
    from calon c
    returning 1
  ),
  tandai as (
    insert into notifikasi_tenggat_terkirim (task_id, tahap)
    select c.id, 'lewat' from calon c
    returning 1
  )
  select count(*) into v_jumlah from terbit;

  with calon as (
    select t.id, t.judul, t.penerima_id, t.tenggat
    from tasks t
    where t.penerima_id is not null
      and t.tenggat is not null
      and t.tenggat >= now()
      and t.tenggat <= now() + make_interval(hours => p_ambang_jam)
      and t.status not in ('selesai', 'dibatalkan')
      and not exists (
        select 1 from notifikasi_tenggat_terkirim x
        where x.task_id = t.id and x.tahap = 'mendekat'
      )
  ),
  terbit as (
    insert into notifications (user_id, kategori, judul, pesan, tautan)
    select
      c.penerima_id,
      'tenggat',
      format('Tenggat mendekat: %s', c.judul),
      format('Jatuh tempo %s.', to_char(c.tenggat, 'DD Mon YYYY HH24:MI')),
      '/tugas'
    from calon c
    returning 1
  ),
  tandai as (
    insert into notifikasi_tenggat_terkirim (task_id, tahap)
    select c.id, 'mendekat' from calon c
    returning 1
  )
  select v_jumlah + count(*) into v_jumlah from terbit;

  return v_jumlah;
end;
$$;

comment on function terbitkan_notifikasi_tenggat(integer) is
  'Menerbitkan pengingat tenggat; aman dipanggil berulang.';

-- Dicabut dari PUBLIC lebih dulu (lihat catatan di 0111).
revoke execute on function terbitkan_notifikasi_tenggat(integer)
  from public, authenticated;

-- Tenggat yang digeser maju berarti pengingatnya layak terbit lagi:
-- penandanya dihapus supaya panggilan berikutnya mengirim ulang.
create or replace function reset_pengingat_tenggat()
returns trigger
language plpgsql
as $$
begin
  if new.tenggat is distinct from old.tenggat then
    delete from notifikasi_tenggat_terkirim where task_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists reset_pengingat_tenggat_trg on tasks;
create trigger reset_pengingat_tenggat_trg
  after update on tasks
  for each row execute function reset_pengingat_tenggat();
