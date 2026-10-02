-- =====================================================================
-- K-Space V2 — Rencana operasional GRD dan tonggaknya
--
-- Kolom OPERATIONAL PLAN di sheet "GRD Cascade" (docs/GRD-OKTOBER-2026.xlsx)
-- berisi cara mencapai tiap goal, masing-masing dengan JENIS, SIAPA,
-- dan KAPAN. Legenda file:
--
--   SEKALI  = tonggak, dicentang selesai;
--   HARIAN  = dicek di DRM (diukur dari laporan harian bila datanya ada);
--   PEKANAN = dicek di WRM Sabtu.
--
-- Karena itu satu baris rencana melahirkan:
--   * SEKALI  → satu tonggak (atau beberapa bila KAPAN-nya menyebut
--               beberapa tanggal, mis. S.1.1.5 dan lima tahap S.2.3.3);
--   * PEKANAN → satu tonggak per kejadian jadwalnya (tiap Senin,
--               Sen/Rab/Sab, Jumat, …; "setiap pekan" = tiap Sabtu WRM);
--   * HARIAN  → tanpa tonggak; diukur lewat sumber KPI otomatis (0194).
--
-- Status tonggak mengikuti file: BELUM / PROGRESS / SELESAI. Keputusan
-- §9 no. 9: dicentang PIC atau atasannya, tanggal selesai = saat
-- dicentang (WIB), tonggak berbutir dihitung satu. Tenggat hanya boleh
-- diubah CEO/Manager — supaya tonggak yang terlambat tidak "menjadi
-- tepat" karena tenggatnya digeser — dan setiap perubahan berjejak.
-- =====================================================================

create table grd_rencana (
  id          uuid primary key default gen_random_uuid(),
  grd_periode date not null check (extract(day from grd_periode) = 1),
  kode        text not null check (length(btrim(kode)) > 0),
  -- Goal yang dilayani; null untuk tonggak Manager (M.*) yang menopang
  -- seluruh blok.
  goal_id     uuid references goals (id) on delete set null,
  induk_kode  text not null default '',
  judul       text not null check (length(btrim(judul)) >= 3),
  jenis       text not null check (jenis in ('sekali', 'harian', 'pekanan')),
  -- Orang yang disebut di kolom SIAPA dan sudah terdaftar; yang pertama
  -- adalah penanggung jawab utama.
  pic_ids     uuid[] not null default '{}',
  pic_teks    text not null default '',
  jadwal_teks text not null default '',
  urutan      smallint not null default 0,
  asal        text not null default '',
  created_at  timestamptz not null default now(),
  unique (grd_periode, kode)
);

comment on table grd_rencana is
  'Baris OPERATIONAL PLAN di GRD Cascade: kode, goal yang dilayani, jenis (sekali/harian/pekanan), siapa, kapan (0192).';

create index grd_rencana_periode_idx on grd_rencana (grd_periode, urutan);

create table grd_tonggak (
  id           uuid primary key default gen_random_uuid(),
  rencana_id   uuid not null references grd_rencana (id) on delete cascade,
  -- Kunci kejadian di dalam rencananya: "" untuk tonggak tunggal,
  -- tanggal ISO untuk kejadian berjadwal, nomor untuk tahap berurutan.
  kunci        text not null default '',
  judul        text not null check (length(btrim(judul)) >= 3),
  -- Null = tanggalnya belum ditetapkan (mis. MRM "H-1"); tidak ikut
  -- dihitung tepat waktu sampai CEO/Manager menetapkannya.
  tenggat      date,
  status       text not null default 'belum'
                 check (status in ('belum', 'progress', 'selesai')),
  selesai_pada timestamptz,
  catatan      text not null default '',
  diubah_oleh  uuid references users (id) on delete set null,
  diubah_pada  timestamptz,
  urutan       smallint not null default 0,
  unique (rencana_id, kunci),
  constraint grd_tonggak_selesai_berwaktu check (
    (status = 'selesai') = (selesai_pada is not null)
  )
);

comment on table grd_tonggak is
  'Tonggak rencana operasional: tenggat dan status BELUM/PROGRESS/SELESAI; selesai_pada = saat dicentang (0192).';
comment on column grd_tonggak.selesai_pada is
  'Diisi otomatis saat status menjadi selesai, dikosongkan saat status kembali; tepat waktu bila tanggal WIB-nya ≤ tenggat.';

create index grd_tonggak_rencana_idx on grd_tonggak (rencana_id, urutan);
create index grd_tonggak_tenggat_idx on grd_tonggak (tenggat);

-- ---------------------------------------------------------------------
-- Siapa yang boleh mencentang: orang di kolom SIAPA, atasan mereka
-- (berjenjang), dan CEO/Manager.
-- ---------------------------------------------------------------------
create or replace function boleh_centang_tonggak(p_rencana uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (
       select 1 from grd_rencana r
       where r.id = p_rencana
         and (
           lintas_unit()
           or auth.uid() = any (r.pic_ids)
           or exists (select 1 from bawahan_saya() b where b = any (r.pic_ids))
         )
     );
$$;

comment on function boleh_centang_tonggak(uuid) is
  'PIC tonggak (kolom SIAPA), atasannya berjenjang, atau CEO/Manager (0192).';

-- ---------------------------------------------------------------------
-- Penjaga tonggak
--
-- * selesai_pada dikelola di sini, bukan oleh pemanggil: saat status
--   berubah menjadi selesai → now(); saat keluar dari selesai → null.
-- * Tenggat, judul, kunci, dan rencananya hanya diubah CEO/Manager.
-- * Bulan yang KPI-nya sudah dikunci tidak bisa diubah lagi.
-- Proses sistem (impor) boleh menulis semuanya, termasuk mempertahankan
-- status dan waktu selesai yang sudah ada.
-- ---------------------------------------------------------------------
create or replace function jaga_tonggak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periode date;
begin
  if pemanggil_sistem() then
    if tg_op <> 'DELETE' then
      if new.status = 'selesai' and new.selesai_pada is null then
        new.selesai_pada := now();
      elsif new.status <> 'selesai' then
        new.selesai_pada := null;
      end if;
    end if;
    return coalesce(new, old);
  end if;

  select r.grd_periode into v_periode
  from grd_rencana r where r.id = coalesce(new.rencana_id, old.rencana_id);

  if exists (
    select 1 from kpi_snapshots s
    where s.periode_bulan = v_periode and s.dikunci_pada is not null
  ) then
    raise exception 'KPI % sudah dikunci; tonggaknya tidak bisa diubah lagi',
      to_char(v_periode, 'Mon YYYY')
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    if not lintas_unit() then
      raise exception 'Hanya CEO atau Manager yang boleh menghapus tonggak'
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if not lintas_unit() then
      raise exception 'Hanya CEO atau Manager yang boleh menambah tonggak'
        using errcode = 'insufficient_privilege';
    end if;
    new.selesai_pada := case when new.status = 'selesai' then now() end;
  else
    if (new.tenggat is distinct from old.tenggat
        or new.judul is distinct from old.judul
        or new.kunci is distinct from old.kunci
        or new.rencana_id is distinct from old.rencana_id
        or new.urutan is distinct from old.urutan)
       and not lintas_unit()
    then
      raise exception 'Tenggat dan isi tonggak hanya bisa diubah CEO atau Manager'
        using errcode = 'insufficient_privilege';
    end if;

    if new.status = 'selesai' and old.status <> 'selesai' then
      new.selesai_pada := now();
    elsif new.status <> 'selesai' then
      new.selesai_pada := null;
    else
      -- Tetap selesai: waktu centang pertama tidak boleh ditimpa.
      new.selesai_pada := old.selesai_pada;
    end if;
  end if;

  new.diubah_oleh := auth.uid();
  new.diubah_pada := now();
  return new;
end;
$$;

create trigger grd_tonggak_jaga
  before insert or update or delete on grd_tonggak
  for each row execute function jaga_tonggak();

create trigger grd_tonggak_audit
  after insert or update or delete on grd_tonggak
  for each row execute function catat_audit_goal();

create trigger grd_rencana_audit
  after insert or update or delete on grd_rencana
  for each row execute function catat_audit_goal();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table grd_rencana enable row level security;
alter table grd_tonggak enable row level security;

-- Rencana operasional dibaca semua orang yang sudah masuk: ini peta kerja
-- bersama (siapa mengerjakan apa, kapan), bukan angka pribadi.
create policy grd_rencana_baca on grd_rencana
  for select using (auth.uid() is not null);
create policy grd_rencana_kelola on grd_rencana
  for all using (lintas_unit()) with check (lintas_unit());

create policy grd_tonggak_baca on grd_tonggak
  for select using (auth.uid() is not null);
create policy grd_tonggak_tambah on grd_tonggak
  for insert with check (lintas_unit());
create policy grd_tonggak_ubah on grd_tonggak
  for update using (boleh_centang_tonggak(rencana_id))
  with check (boleh_centang_tonggak(rencana_id));
create policy grd_tonggak_hapus on grd_tonggak
  for delete using (lintas_unit());

-- ---------------------------------------------------------------------
-- Ubah status satu tonggak. Security invoker: RLS dan penjaga di atas
-- yang memutuskan; fungsi ini hanya memberi pesan yang jelas.
-- ---------------------------------------------------------------------
create or replace function ubah_status_tonggak(
  p_tonggak uuid,
  p_status text,
  p_catatan text default null
)
returns grd_tonggak
language plpgsql
as $$
declare
  hasil grd_tonggak;
begin
  if p_status not in ('belum', 'progress', 'selesai') then
    raise exception 'Status tonggak tidak dikenal: %', p_status
      using errcode = 'check_violation';
  end if;

  update grd_tonggak
     set status = p_status,
         catatan = coalesce(btrim(p_catatan), catatan)
   where id = p_tonggak
  returning * into hasil;

  if hasil.id is null then
    raise exception 'Tonggak tidak ditemukan atau bukan wewenangmu'
      using errcode = 'insufficient_privilege';
  end if;

  return hasil;
end;
$$;

comment on function ubah_status_tonggak(uuid, text, text) is
  'PIC/atasan/CEO/Manager mengubah status tonggak; waktu selesai dicatat penjaga (0192).';

-- ---------------------------------------------------------------------
-- Tonggak tepat waktu (indikator "Tonggak … tepat waktu" di sheet KPI)
--
--   jatuh = tonggak dari rencana yang disebut, bertenggat ≤ p_sampai,
--           yang harinya sudah lewat atau sudah selesai;
--   tepat = jatuh yang selesai dengan tanggal selesai (WIB) ≤ tenggat;
--   hasil = tepat / jatuh × 100, null bila belum ada yang jatuh tempo.
--
-- "Harinya sudah lewat" membuat tonggak bertenggat hari ini belum
-- dihitung terlambat selama bulan berjalan; pada bulan yang sudah lewat
-- syarat itu selalu terpenuhi, jadi hasilnya sama dengan rumus file.
-- ---------------------------------------------------------------------
create or replace function tonggak_tepat_waktu(
  p_periode date,
  p_kode text[],
  p_sampai date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with jatuh as (
    select t.*
    from grd_tonggak t
    join grd_rencana r on r.id = t.rencana_id
    where r.grd_periode = p_periode
      and r.kode = any (p_kode)
      and t.tenggat is not null
      and t.tenggat <= p_sampai
      and (t.tenggat < (now() at time zone 'Asia/Jakarta')::date
           or t.status = 'selesai')
  )
  select case when count(*) = 0 then null
    else count(*) filter (
           where status = 'selesai'
             and (selesai_pada at time zone 'Asia/Jakarta')::date <= tenggat
         )::numeric / count(*) * 100
  end
  from jatuh;
$$;

comment on function tonggak_tepat_waktu(date, text[], date) is
  'Persen tonggak tepat waktu dari rencana yang disebut; null bila belum ada yang jatuh tempo (0192).';

-- ---------------------------------------------------------------------
-- Layar rencana operasional: satu baris per rencana beserta tonggaknya,
-- nama orang di kolom SIAPA, dan apakah pemanggil boleh mencentangnya.
-- Security invoker: RLS rencana & tonggak berlaku.
-- ---------------------------------------------------------------------
create or replace function rencana_grd(p_periode date)
returns table (
  rencana_id    uuid,
  kode          text,
  goal_kode     text,
  goal_judul    text,
  induk_kode    text,
  judul         text,
  jenis         text,
  pic_teks      text,
  pic_nama      text[],
  jadwal_teks   text,
  urutan        smallint,
  boleh_centang boolean,
  tonggak       jsonb
)
language sql
stable
as $$
  select
    r.id, r.kode, g.kode, g.judul, r.induk_kode, r.judul, r.jenis,
    r.pic_teks,
    coalesce((
      select array_agg(u.nama order by array_position(r.pic_ids, u.id))
      from users u where u.id = any (r.pic_ids)
    ), '{}'),
    r.jadwal_teks, r.urutan,
    boleh_centang_tonggak(r.id),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'kunci', t.kunci,
        'judul', t.judul,
        'tenggat', t.tenggat,
        'status', t.status,
        'selesai_pada', t.selesai_pada,
        'catatan', t.catatan
      ) order by t.urutan, t.tenggat)
      from grd_tonggak t where t.rencana_id = r.id
    ), '[]'::jsonb)
  from grd_rencana r
  left join goals g on g.id = r.goal_id
  where r.grd_periode = p_periode
  order by r.urutan, r.kode;
$$;

comment on function rencana_grd(date) is
  'Rencana operasional satu periode GRD beserta tonggak dan hak centang pemanggil (0192).';

-- ---------------------------------------------------------------------
-- Rollback (manual): drop function rencana_grd, tonggak_tepat_waktu, ubah_status_tonggak,
-- jaga_tonggak, boleh_centang_tonggak; drop table grd_tonggak, grd_rencana.
-- ---------------------------------------------------------------------
