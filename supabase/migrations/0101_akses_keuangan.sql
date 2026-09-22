-- =====================================================================
-- K-Space V2 — Menutup celah akses modul Keuangan (PRD §2, §4)
--
-- Migrasi 0097–0099 sudah memagari tabelnya dengan RLS, tetapi menyisakan
-- tiga lubang yang baru kelihatan setelah semuanya berjalan bersama:
--
--   1. `saldo_kas()` dan `penyetuju_wajib()` dibuat `security definer`
--      supaya trigger bisa memakainya. Akibatnya SIAPA PUN yang sudah
--      login bisa memanggilnya dan mengetahui posisi kas perusahaan —
--      angka yang justru paling dijaga RLS di tabelnya sendiri.
--
--   2. Baris `update transactions` di dalam trigger persetujuan tunduk
--      pada RLS pemanggilnya. Begitu policy `update` dipersempit, Finance
--      tidak akan bisa menandai lunas pengajuan milik orang lain — dan
--      kegagalannya senyap, karena RLS menolak dengan nol baris.
--
--   3. Policy `update` yang lama membiarkan siapa pun yang berhak melihat
--      angka ikut menyunting pengajuan milik orang lain.
--
-- Ketiganya ditutup di sini: fungsi angka dipagari, triggernya dijadikan
-- `security definer` (wewenangnya tetap diperiksa di dalam), dan
-- penyuntingan dibatasi pengajunya sendiri atau CEO/Manager.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Angka kas hanya untuk yang berhak melihat angka perusahaan.
--    Yang lain mendapat null — bukan nol, sebab nol adalah jawaban yang
--    terlihat sah dan diam-diam salah.
-- ---------------------------------------------------------------------
create or replace function saldo_kas()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- Pekerjaan latar (service_role) memang berjalan tanpa pengguna;
    -- ia sudah melewati RLS di tabelnya, jadi tidak ada gunanya
    -- membutakannya di sini.
    when lintas_angka() or auth.role() = 'service_role' then
      coalesce((select kas_awal from keuangan_pengaturan where id), 0)
      + coalesce((
          select sum(case when arah = 'masuk' then jumlah else -jumlah end)
          from transactions
          where status = 'dibayar'
        ), 0)
    else null
  end;
$$;

create or replace function penyetuju_wajib()
returns peran_pengguna
language sql
stable
security definer
set search_path = public
as $$
  select case
    when saldo_kas() is null then null
    when saldo_kas() < batas_kas_ceo() then 'CEO'
    else 'Manager'
  end::peran_pengguna;
$$;

-- ---------------------------------------------------------------------
-- 2. Trigger persetujuan berjalan sebagai pemilik.
--
--    Wewenangnya tetap diperiksa di dalam fungsi (izin_putus_transaksi),
--    jadi ini bukan pelonggaran: ia hanya memisahkan "boleh memutuskan"
--    dari "boleh menyunting baris transaksinya langsung" — dua hal yang
--    memang berbeda.
--
--    Saat wewenangnya tidak bisa dipastikan (mis. posisi kas tidak
--    terbaca pemanggil), keputusannya ditolak, bukan diloloskan.
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

  -- Pembayaran bukan persetujuan: ia pelaksanaan keputusan orang lain,
  -- dan itu pekerjaan Finance — termasuk untuk pengajuan yang ia tulis
  -- sendiri. Melarangnya justru membuat kasir tidak bisa membayar apa pun.
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

  if wajib is null then
    return 'Hanya Manager atau CEO yang memutuskan pengeluaran';
  end if;

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
security definer
set search_path = public
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
  new.saldo_kas := coalesce(saldo_kas(), 0);
  new.penyetuju_wajib := penyetuju_wajib();

  perform set_config('app.transaksi_via_persetujuan', 'ya', true);

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

-- ---------------------------------------------------------------------
-- 3. Menyunting pengajuan: pengajunya sendiri, atau CEO/Manager.
--
--    Setelah ada keputusan, isinya terkunci trigger (migrasi 0097); yang
--    dijaga di sini adalah siapa yang boleh menyentuhnya selagi masih
--    menunggu. Menghapus transaksi tidak diberi policy sama sekali:
--    catatan keuangan yang keliru diperbaiki dengan penolakan atau
--    transaksi pengimbang, bukan dengan menghilangkannya.
-- ---------------------------------------------------------------------
drop policy if exists transaksi_putus on transactions;

create policy transaksi_ubah on transactions
  for update
  using (
    lintas_angka()
    and status = 'diajukan'
    and (diajukan_id = auth.uid() or lintas_unit())
  )
  with check (
    lintas_angka()
    and (diajukan_id = auth.uid() or lintas_unit())
  );
