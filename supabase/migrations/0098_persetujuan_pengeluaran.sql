-- =====================================================================
-- K-Space V2 — Persetujuan pengeluaran (PRD §4)
--
-- Sampai migrasi 0097 status transaksi bisa diubah langsung. Itu cukup
-- untuk menyimpan keadaannya, tetapi tidak menjawab pertanyaan yang
-- selalu muncul kemudian: siapa yang menyetujui, kapan, dan berapa kas
-- perusahaan saat keputusan itu diambil.
--
-- Pertanyaan terakhir bukan hiasan. PRD §4 menaikkan wewenang ke CEO
-- saat kas di bawah Rp 150 juta, jadi sah-tidaknya sebuah persetujuan
-- bergantung pada posisi kas pada detik itu — angka yang berubah terus.
-- Tanpa merekamnya, keputusan lama tidak bisa dinilai ulang dengan adil.
--
-- Karena itu status kini hanya berubah lewat baris `transaction_approvals`,
-- persis seperti status sampel yang hanya berubah lewat kejadiannya
-- (migrasi 0049).
-- =====================================================================

-- Batas kas yang menaikkan wewenang ke CEO — padanan BATAS_KAS_CEO di
-- src/lib/keuangan.ts. Ditulis sebagai fungsi supaya angkanya bisa
-- ditelusuri dari SQL mana pun yang memakainya.
create or replace function batas_kas_ceo()
returns numeric
language sql
immutable
as $$
  select 150000000::numeric;
$$;

create or replace function penyetuju_wajib()
returns peran_pengguna
language sql
stable
security definer
set search_path = public
as $$
  select case when saldo_kas() < batas_kas_ceo() then 'CEO' else 'Manager' end::peran_pengguna;
$$;

comment on function penyetuju_wajib is
  'Siapa yang harus memutuskan pengeluaran pada posisi kas sekarang (PRD §4).';

create table transaction_approvals (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions (id) on delete cascade,
  dari           status_transaksi,
  ke             status_transaksi not null,
  oleh_id        uuid references users (id) on delete set null,
  catatan        text not null default '',
  -- Direkam apa adanya: keputusan lama harus bisa dinilai dengan angka
  -- yang berlaku saat itu, bukan dengan kas hari ini.
  saldo_kas      numeric(16, 2) not null default 0,
  penyetuju_wajib peran_pengguna,
  pada           timestamptz not null default now()
);

create index transaksi_persetujuan_idx
  on transaction_approvals (transaction_id, pada desc);

comment on table transaction_approvals is
  'Satu baris per keputusan atas transaksi; tidak pernah disunting atau dihapus.';

-- ---------------------------------------------------------------------
-- Wewenang memutuskan.
--
-- Dua aturan PRD §4 dijaga di sini: tidak seorang pun memutuskan
-- pengajuannya sendiri, dan saat kas menipis hanya CEO yang boleh
-- memutuskan — sekecil apa pun nominalnya.
-- ---------------------------------------------------------------------
create or replace function izin_putus_transaksi(
  p_transaksi uuid,
  p_ke status_transaksi
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pengaju uuid;
  wajib peran_pengguna;
  peran peran_pengguna := peran_saya();
begin
  select diajukan_id into pengaju from transactions where id = p_transaksi;

  -- Pembayaran bukan persetujuan: ia pelaksanaan keputusan yang sudah
  -- diambil orang lain, dan itu pekerjaan Finance — termasuk untuk
  -- pengajuan yang ia tulis sendiri. Melarangnya di sini justru
  -- membuat kasir tidak bisa membayar apa pun.
  if p_ke = 'dibayar' then
    return case
      when lintas_angka() then null
      else 'Hanya Finance, Manager, atau CEO yang mencatat pembayaran'
    end;
  end if;

  -- Menyetujui atau menolak pengajuan sendiri: tidak, sekali pun ia CEO.
  if pengaju is not null and pengaju = auth.uid() then
    return 'Pengajuanmu sendiri diputuskan orang lain';
  end if;

  wajib := penyetuju_wajib();

  if wajib = 'CEO' then
    return case
      when peran = 'CEO' then null
      else format(
        'Kas di bawah %s: hanya CEO yang bisa memutuskan',
        to_char(batas_kas_ceo(), 'FM999G999G999')
      )
    end;
  end if;

  return case
    when peran in ('CEO', 'Manager') then null
    else 'Hanya Manager atau CEO yang memutuskan pengeluaran'
  end;
end;
$$;

create or replace function jaga_persetujuan_transaksi()
returns trigger
language plpgsql
as $$
declare
  status_kini status_transaksi;
  halangan text;
begin
  select status into status_kini from transactions where id = new.transaction_id;

  if status_kini is null then
    raise exception 'Transaksi tidak ditemukan'
      using errcode = 'foreign_key_violation';
  end if;

  if not perpindahan_transaksi_sah(status_kini, new.ke) then
    raise exception 'Transaksi berstatus % tidak bisa menjadi %', status_kini, new.ke
      using errcode = 'check_violation';
  end if;

  halangan := izin_putus_transaksi(new.transaction_id, new.ke);
  if halangan is not null then
    raise exception '%', halangan using errcode = 'insufficient_privilege';
  end if;

  -- Penolakan tanpa alasan membuat pengajunya menebak apa yang salah.
  if new.ke = 'ditolak' and length(btrim(new.catatan)) < 10 then
    raise exception 'Sebutkan alasan penolakan (minimal 10 huruf)'
      using errcode = 'check_violation';
  end if;

  new.dari := status_kini;
  new.saldo_kas := saldo_kas();
  new.penyetuju_wajib := penyetuju_wajib();

  -- Penanda sesi ini yang membedakan perubahan sah dari penyuntingan
  -- langsung; berlaku hanya sampai transaksinya selesai.
  perform set_config('app.transaksi_via_persetujuan', 'ya', true);

  -- Pembayaran tidak menimpa siapa yang menyetujui: pelaksananya
  -- tercatat di jejak ini, penyetujunya tetap di barisnya.
  update transactions
     set status = new.ke,
         disetujui_id = case
           when new.ke = 'dibayar' then disetujui_id
           else coalesce(new.oleh_id, auth.uid())
         end,
         diputuskan_pada = case
           when new.ke = 'dibayar' then diputuskan_pada
           else now()
         end,
         catatan_keputusan = case
           when btrim(new.catatan) = '' then catatan_keputusan
           else new.catatan
         end,
         updated_at = now()
   where id = new.transaction_id;

  perform set_config('app.transaksi_via_persetujuan', '', true);

  return new;
end;
$$;

create trigger jaga_persetujuan_transaksi_trg
  before insert on transaction_approvals
  for each row execute function jaga_persetujuan_transaksi();

-- Jejak keputusan tidak boleh disunting; keputusan yang berubah dicatat
-- sebagai keputusan baru.
create or replace function larang_ubah_persetujuan()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Jejak persetujuan transaksi tidak bisa diubah atau dihapus'
    using errcode = 'check_violation';
end;
$$;

create trigger larang_ubah_persetujuan_trg
  before update or delete on transaction_approvals
  for each row execute function larang_ubah_persetujuan();

-- ---------------------------------------------------------------------
-- Sejak persetujuan punya tabelnya sendiri, `jaga_ubah_transaksi`
-- (migrasi 0097) tidak lagi ikut menentukan siapa pemutusnya: kalau ia
-- tetap menyetel `disetujui_id` dari auth.uid(), pembayaran akan
-- menimpa nama penyetuju dengan nama kasirnya. Tugasnya kini tinggal
-- satu — menjaga isi transaksi tidak berubah setelah diputuskan.
-- ---------------------------------------------------------------------
create or replace function jaga_ubah_transaksi()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'diajukan' and (
       new.tanggal    is distinct from old.tanggal
    or new.arah       is distinct from old.arah
    or new.jenis      is distinct from old.jenis
    or new.jumlah     is distinct from old.jumlah
    or new.unit_id    is distinct from old.unit_id
    or new.account_id is distinct from old.account_id
  ) then
    raise exception 'Isi transaksi yang sudah diputuskan tidak bisa diubah'
      using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status
     and not perpindahan_transaksi_sah(old.status, new.status) then
    raise exception 'Transaksi berstatus % tidak bisa menjadi %',
      old.status, new.status
      using errcode = 'check_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Status transaksi hanya berubah lewat persetujuan.
--
-- Mengubahnya langsung membuat keadaan transaksi tidak lagi cocok dengan
-- jejaknya: layar berkata "dibayar", sementara jejaknya berhenti di
-- "diajukan". Sesudah itu tidak ada cara mengetahui mana yang benar.
-- ---------------------------------------------------------------------
create or replace function jaga_status_transaksi()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.transaksi_via_persetujuan', true), '') <> 'ya'
  then
    raise exception
      'Status transaksi hanya berubah lewat pencatatan persetujuan'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger jaga_status_transaksi_trg
  before update on transactions
  for each row execute function jaga_status_transaksi();

-- ---------------------------------------------------------------------
-- RLS — jejaknya mengikuti transaksinya.
-- ---------------------------------------------------------------------
alter table transaction_approvals enable row level security;

create policy transaksi_persetujuan_baca on transaction_approvals
  for select using (
    exists (select 1 from transactions t where t.id = transaction_id)
  );

-- Wewenangnya diperiksa trigger; RLS memastikan keputusan selalu
-- tercatat atas nama yang memutuskan.
create policy transaksi_persetujuan_buat on transaction_approvals
  for insert with check (
    oleh_id = auth.uid()
    and exists (select 1 from transactions t where t.id = transaction_id)
  );
