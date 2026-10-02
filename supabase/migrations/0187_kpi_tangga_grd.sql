-- =====================================================================
-- K-Space V2 — KPI GRD: lembar per orang per bulan, tangga 10 kolom
--
-- KPI selama ini didefinisikan per jabatan (`kpi_definitions`, 0024) dan
-- dinilai dengan interpolasi lurus base → 500, goal → 800, stretch →
-- 1.000. GRD Oktober 2026 (sheet KPI di docs/GRD-OKTOBER-2026.xlsx) bekerja
-- lain, dan file GRD adalah sumber kebenarannya:
--
--   * tiap ORANG punya lembar KPI sendiri tiap BULAN — lima Leader GRD
--     punya indikator yang berbeda-beda;
--   * tiap indikator punya tangga 10 kolom. VALUE = banyaknya kolom yang
--     sudah dilampaui, persis `COUNTIF(C:L,"<="&M)` di file. Kolom 4 =
--     BASE, 8 = GOAL, 9–10 = STRETCH;
--   * NILAI KPI = Σ VALUE × bobot (Σ bobot = 100, maksimal 1.000);
--   * PENCAPAIAN yang kosong bernilai 0 dan bobotnya tetap dihitung.
--     "BELUM DIISI" hanya bila SEMUA indikator kosong;
--   * PENCAPAIAN diisi penilai — atasan menurut hierarki, atau CEO/
--     Manager — tidak pernah oleh orangnya sendiri.
--
-- Bulan yang sudah punya lembar aktif adalah "bulan GRD": setiap orang
-- dinilai dari lembarnya (yang tanpa lembar tampil belum dinilai). Bulan
-- lain tetap memakai rumus per jabatan apa adanya. Snapshot yang sudah
-- dikunci tidak tersentuh: scorecard membacanya dari `kpi_snapshots`, dan
-- lembar bulan yang terkunci tidak bisa diubah lagi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tangga: 10 ambang, menaik (makin besar makin baik) atau menurun
-- (makin kecil makin baik). Kolom yang sama berturut-turut boleh —
-- indikator kepatuhan memakai 100%, 100%, 100% di kolom 8–10.
-- ---------------------------------------------------------------------
create or replace function tangga_sah(p_tangga numeric[], p_arah text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    array_ndims(p_tangga) = 1
    and array_length(p_tangga, 1) = 10
    and array_position(p_tangga, null) is null
    and p_arah in ('naik', 'turun')
    and not exists (
      select 1
      from generate_series(1, 9) i
      where case
        when p_arah = 'turun' then p_tangga[i] < p_tangga[i + 1]
        else p_tangga[i] > p_tangga[i + 1]
      end
    ),
    false);
$$;

comment on function tangga_sah(numeric[], text) is
  'Tangga KPI GRD sah: tepat 10 angka, tanpa kosong, tidak berbalik arah (0187).';

/**
 * VALUE GRD satu indikator: banyaknya kolom tangga yang sudah dilampaui.
 *
 * Arah naik  : kolom yang angkanya ≤ pencapaian — `COUNTIF(C:L,"<="&M)`.
 * Arah turun : kolom yang angkanya ≥ pencapaian (makin kecil makin baik).
 * Pencapaian kosong bernilai 0, sama dengan `IF(M="",0,…)` di file.
 *
 * Untuk tangga yang sah (tidak berbalik arah) hitungan ini sama dengan
 * "kolom paling kanan yang terpenuhi".
 */
create or replace function nilai_tangga(
  p_pencapaian numeric,
  p_tangga numeric[],
  p_arah text default 'naik'
)
returns integer
language sql
immutable
as $$
  select case
    when p_pencapaian is null then 0
    when p_arah = 'turun' then
      (select count(*)::int from unnest(p_tangga) t where t >= p_pencapaian)
    else
      (select count(*)::int from unnest(p_tangga) t where t <= p_pencapaian)
  end;
$$;

comment on function nilai_tangga(numeric, numeric[], text) is
  'VALUE GRD 0–10: kolom tangga yang dilampaui pencapaian; kosong = 0 (0187).';

-- ---------------------------------------------------------------------
-- Lembar KPI: satu per orang per bulan
-- ---------------------------------------------------------------------
create table kpi_lembar (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  periode_bulan date not null check (extract(day from periode_bulan) = 1),
  judul         text not null default '',
  -- 'draft' untuk yang masih usulan; hanya lembar 'aktif' yang dinilai.
  status        text not null default 'draft'
                  check (status in ('draft', 'aktif')),
  -- Asal-usul lembar, mis. sheet dan baris file GRD — dipakai skrip impor
  -- supaya menjalankannya ulang memperbarui, bukan menggandakan.
  asal          text not null default '',
  dibuat_oleh   uuid references users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, periode_bulan)
);

create index kpi_lembar_periode_idx on kpi_lembar (periode_bulan, status);

comment on table kpi_lembar is
  'Lembar KPI GRD seseorang untuk satu bulan; padanan satu blok di sheet KPI file GRD (0187).';

create trigger kpi_lembar_set_updated_at
  before update on kpi_lembar
  for each row execute function set_updated_at();

create table kpi_indikator (
  id         uuid primary key default gen_random_uuid(),
  lembar_id  uuid not null references kpi_lembar (id) on delete cascade,
  urutan     smallint not null check (urutan between 1 and 20),
  nama       text not null check (length(btrim(nama)) >= 3),
  -- '%' berarti pencapaian dan tangganya ditulis 0–100, bukan pecahan.
  satuan     text not null default '%',
  bobot      smallint not null check (bobot between 1 and 100),
  arah       text not null default 'naik',
  -- Tanpa pembulatan: Excel membandingkan angka penuh, dan pembulatan di
  -- sini bisa menggeser pencapaian yang tepat di batas kolom.
  tangga     numeric[] not null,
  -- Tahap berikutnya menambah sumber otomatis; kini semuanya diisi penilai.
  sumber     text not null default 'manual' check (sumber in ('manual')),
  asal       text not null default '',
  created_at timestamptz not null default now(),
  unique (lembar_id, urutan),
  constraint kpi_indikator_tangga_sah check (tangga_sah(tangga, arah))
);

comment on column kpi_indikator.tangga is
  'Ambang kolom 1–10. Kolom 4 = BASE, 8 = GOAL, 9–10 = STRETCH (0187).';

create table kpi_pencapaian (
  id           uuid primary key default gen_random_uuid(),
  indikator_id uuid not null unique references kpi_indikator (id) on delete cascade,
  nilai        numeric not null check (nilai >= 0),
  catatan      text not null default '',
  -- Diisi trigger dari sesi, bukan dari klien.
  diisi_oleh   uuid references users (id) on delete set null,
  diisi_pada   timestamptz not null default now()
);

comment on table kpi_pencapaian is
  'PENCAPAIAN satu indikator; tanpa baris berarti kosong (bernilai 0). Diisi penilai (0187).';

-- ---------------------------------------------------------------------
-- Pembantu
-- ---------------------------------------------------------------------

-- Bulan yang sudah memakai GRD. Definer supaya jawabannya sama bagi
-- semua orang, tidak bergantung lembar siapa yang kebetulan terlihat.
create or replace function bulan_grd(p_bulan date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from kpi_lembar
    where periode_bulan = p_bulan and status = 'aktif'
  );
$$;

comment on function bulan_grd(date) is
  'Bulan yang dinilai dengan lembar KPI GRD: ada lembar aktif pada bulan itu (0187).';

create or replace function kpi_terkunci(p_user uuid, p_bulan date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from kpi_snapshots
    where user_id = p_user
      and periode_bulan = p_bulan
      and dikunci_pada is not null
  );
$$;

/**
 * Penilai seseorang: atasannya (langsung maupun berjenjang) atau CEO/
 * Manager — tidak pernah dirinya sendiri. Sejalan kolom "Penilai" di file
 * GRD dan hierarki akses 0173.
 */
create or replace function boleh_menilai(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and p_user is not null
     and p_user <> auth.uid()
     and (
       lintas_unit()
       or exists (select 1 from bawahan_saya() b where b = p_user)
     );
$$;

comment on function boleh_menilai(uuid) is
  'Pemanggil boleh mengisi PENCAPAIAN KPI orang ini: atasannya atau CEO/Manager, bukan dirinya (0187).';

create or replace function pemilik_indikator(p_indikator uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select l.user_id
  from kpi_indikator i
  join kpi_lembar l on l.id = i.lembar_id
  where i.id = p_indikator;
$$;

-- ---------------------------------------------------------------------
-- Penjaga: bulan terkunci final, lembar aktif membeku, Σ bobot = 100
-- ---------------------------------------------------------------------
create or replace function jaga_kpi_lembar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jumlah_bobot integer;
  jumlah_indikator integer;
begin
  if tg_op in ('UPDATE', 'DELETE')
     and kpi_terkunci(old.user_id, old.periode_bulan) then
    raise exception 'KPI % bulan ini sudah dikunci dan tidak bisa diubah',
      to_char(old.periode_bulan, 'Mon YYYY')
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'aktif' then
      raise exception 'Lembar KPI aktif tidak bisa dihapus; jadikan draft dulu'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if kpi_terkunci(new.user_id, new.periode_bulan) then
    raise exception 'KPI % bulan ini sudah dikunci dan tidak bisa diubah',
      to_char(new.periode_bulan, 'Mon YYYY')
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' and old.status = 'aktif' and new.status = 'aktif'
     and (new.user_id <> old.user_id or new.periode_bulan <> old.periode_bulan) then
    raise exception 'Pemilik dan bulan lembar KPI aktif tidak bisa diubah'
      using errcode = 'check_violation';
  end if;

  -- Menjadi aktif = mulai dinilai: indikatornya harus lengkap dan bobotnya
  -- genap 100, sama dengan "Σ bobot" di file.
  if new.status = 'aktif'
     and (tg_op = 'INSERT' or old.status is distinct from 'aktif') then
    select coalesce(sum(bobot), 0), count(*)
      into jumlah_bobot, jumlah_indikator
      from kpi_indikator where lembar_id = new.id;

    if jumlah_indikator = 0 or jumlah_bobot <> 100 then
      raise exception
        'Lembar KPI baru bisa aktif bila bobot indikatornya berjumlah 100 (sekarang %)',
        jumlah_bobot
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger kpi_lembar_jaga
  before insert or update or delete on kpi_lembar
  for each row execute function jaga_kpi_lembar();

-- Indikator hanya disusun selama lembarnya draft: lembar aktif sedang
-- dipakai menilai, dan mengubah tangganya di tengah jalan akan mengubah
-- arti angka yang sudah diisi penilai.
create or replace function jaga_kpi_indikator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lembar kpi_lembar;
begin
  select * into lembar from kpi_lembar
  where id = case when tg_op = 'DELETE' then old.lembar_id else new.lembar_id end;

  -- Lembarnya sedang ikut terhapus (cascade dari lembar draft).
  if lembar.id is null then
    return coalesce(new, old);
  end if;

  if kpi_terkunci(lembar.user_id, lembar.periode_bulan) then
    raise exception 'KPI bulan ini sudah dikunci dan tidak bisa diubah'
      using errcode = 'check_violation';
  end if;

  if lembar.status = 'aktif' then
    raise exception 'Indikator lembar KPI aktif tidak bisa diubah; jadikan draft dulu'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' and new.lembar_id <> old.lembar_id then
    raise exception 'Indikator tidak bisa dipindah ke lembar lain'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger kpi_indikator_jaga
  before insert or update or delete on kpi_indikator
  for each row execute function jaga_kpi_indikator();

create or replace function jaga_kpi_pencapaian()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lembar kpi_lembar;
begin
  select l.* into lembar
  from kpi_indikator i
  join kpi_lembar l on l.id = i.lembar_id
  where i.id = case when tg_op = 'DELETE' then old.indikator_id else new.indikator_id end;

  if lembar.id is not null
     and kpi_terkunci(lembar.user_id, lembar.periode_bulan) then
    raise exception 'KPI bulan ini sudah dikunci; pencapaiannya tidak bisa diubah'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if lembar.status is distinct from 'aktif' then
    raise exception 'Pencapaian hanya diisi pada lembar KPI yang aktif'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' and new.indikator_id <> old.indikator_id then
    raise exception 'Pencapaian tidak bisa dipindah ke indikator lain'
      using errcode = 'check_violation';
  end if;

  new.diisi_oleh := auth.uid();
  new.diisi_pada := now();
  return new;
end;
$$;

create trigger kpi_pencapaian_jaga
  before insert or update or delete on kpi_pencapaian
  for each row execute function jaga_kpi_pencapaian();

-- Angka penilaian tidak boleh berubah diam-diam: jejaknya ke audit_logs.
create trigger kpi_lembar_audit
  after insert or update or delete on kpi_lembar
  for each row execute function catat_audit_goal();

create trigger kpi_indikator_audit
  after insert or update or delete on kpi_indikator
  for each row execute function catat_audit_goal();

create trigger kpi_pencapaian_audit
  after insert or update or delete on kpi_pencapaian
  for each row execute function catat_audit_goal();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table kpi_lembar enable row level security;
alter table kpi_indikator enable row level security;
alter table kpi_pencapaian enable row level security;

-- Dibaca orangnya sendiri, atasannya, dan CEO/Manager (0173).
create policy kpi_lembar_baca on kpi_lembar
  for select using (boleh_orang(user_id));

-- Disusun CEO/Manager — sejalan `kpi_def_kelola` (0024).
create policy kpi_lembar_kelola on kpi_lembar
  for all using (lintas_unit()) with check (lintas_unit());

create policy kpi_indikator_baca on kpi_indikator
  for select using (exists (select 1 from kpi_lembar l where l.id = lembar_id));

create policy kpi_indikator_kelola on kpi_indikator
  for all using (lintas_unit()) with check (lintas_unit());

create policy kpi_pencapaian_baca on kpi_pencapaian
  for select using (exists (select 1 from kpi_indikator i where i.id = indikator_id));

create policy kpi_pencapaian_isi on kpi_pencapaian
  for insert with check (boleh_menilai(pemilik_indikator(indikator_id)));

create policy kpi_pencapaian_ubah on kpi_pencapaian
  for update
  using (boleh_menilai(pemilik_indikator(indikator_id)))
  with check (boleh_menilai(pemilik_indikator(indikator_id)));

create policy kpi_pencapaian_hapus on kpi_pencapaian
  for delete using (boleh_menilai(pemilik_indikator(indikator_id)));

-- ---------------------------------------------------------------------
-- Penilaian
-- ---------------------------------------------------------------------

/**
 * Nilai KPI GRD seseorang pada satu bulan dari lembar aktifnya.
 *
 * skor_total = Σ VALUE × bobot (bilangan bulat, maks 1.000).
 * predikat   = NULL bila belum satu pun pencapaian diisi ("BELUM DIISI").
 * cakupan    = persentase bobot yang sudah diisi — keterangan saja; yang
 *              kosong tetap dihitung 0 di skor_total, sama dengan file.
 */
create or replace function hitung_kpi_grd(p_user uuid, p_bulan date)
returns table (
  skor_total numeric,
  predikat predikat_kpi,
  cakupan numeric,
  detail jsonb
)
language sql
stable
as $$
  with lembar as (
    select l.id
    from kpi_lembar l
    where l.user_id = p_user
      and l.periode_bulan = p_bulan
      and l.status = 'aktif'
      and boleh_orang(p_user)
  ),
  baris as (
    select
      i.id, i.urutan, i.nama, i.satuan, i.bobot, i.arah, i.tangga, i.sumber,
      p.nilai as pencapaian,
      nilai_tangga(p.nilai, i.tangga, i.arah) as nilai
    from kpi_indikator i
    join lembar l on l.id = i.lembar_id
    left join kpi_pencapaian p on p.indikator_id = i.id
  )
  select
    coalesce(sum(b.nilai * b.bobot), 0)::numeric,
    case when count(b.pencapaian) > 0
      then predikat_dari_skor(coalesce(sum(b.nilai * b.bobot), 0))
    end,
    case when coalesce(sum(b.bobot), 0) > 0
      then round(
        coalesce(sum(b.bobot) filter (where b.pencapaian is not null), 0)::numeric
        / sum(b.bobot) * 100, 0)
      else 0
    end,
    coalesce(jsonb_agg(jsonb_build_object(
      'indikator_id', b.id,
      'urutan', b.urutan,
      'nama', b.nama,
      'satuan', b.satuan,
      'bobot', b.bobot,
      'arah', b.arah,
      'tangga', to_jsonb(b.tangga),
      'sumber', b.sumber,
      'pencapaian', b.pencapaian,
      'nilai', b.nilai,
      'total', b.nilai * b.bobot
    ) order by b.urutan) filter (where b.id is not null), '[]'::jsonb)
  from baris b;
$$;

comment on function hitung_kpi_grd(uuid, date) is
  'Nilai KPI GRD dari lembar aktif: Σ VALUE × bobot, kosong = 0, predikat NULL bila belum diisi (0187).';

/**
 * Rumus lama per jabatan — isi `hitung_kpi` 0173 apa adanya, hanya
 * dipindah namanya supaya `hitung_kpi` bisa memilih rumus per bulan.
 */
create or replace function hitung_kpi_jabatan(
  p_user uuid,
  p_bulan date,
  p_sampai date default current_date
)
returns table (
  skor_total numeric,
  predikat predikat_kpi,
  cakupan numeric,
  detail jsonb
)
language sql
stable
as $$
  with dinilai as (
    select
      k.nama_kpi, k.bobot, k.satuan, k.sumber_data,
      r.realisasi,
      case when r.realisasi is null then null
        else skor_kpi(r.realisasi, k.target_base, k.target_goal, k.target_stretch)
      end as skor
    from users u
    join kpi_definitions k on k.jabatan = u.role::text and k.aktif
    cross join lateral (
      select realisasi_kpi(u.id, k.sumber_data, p_bulan, p_sampai) as realisasi
    ) r
    where u.id = p_user
      and boleh_orang(u.id)
  ),
  hasil as (
    select
      case when sum(bobot) filter (where skor is not null) > 0
        then round(
          sum(skor * bobot) filter (where skor is not null)
          / sum(bobot) filter (where skor is not null), 1)
        else 0 end as total,
      case when sum(bobot) > 0
        then round(
          coalesce(sum(bobot) filter (where skor is not null), 0)
          / sum(bobot) * 100, 0)
        else 0 end as cakupan,
      jsonb_agg(jsonb_build_object(
        'nama', nama_kpi, 'bobot', bobot, 'satuan', satuan,
        'sumber', sumber_data,
        'realisasi', case when realisasi is null then null else round(realisasi, 1) end,
        'skor', skor,
        'berlaku', skor is not null
      ) order by bobot desc, nama_kpi) as rincian
    from dinilai
  )
  select total, predikat_dari_skor(total), cakupan, coalesce(rincian, '[]'::jsonb)
  from hasil;
$$;

comment on function hitung_kpi_jabatan(uuid, date, date) is
  'Rumus KPI per jabatan (0024–0173) untuk bulan yang belum memakai lembar GRD (0187).';

drop function if exists hitung_kpi(uuid, date, date);

/** Skor KPI seseorang: rumus GRD pada bulan GRD, rumus jabatan selain itu. */
create function hitung_kpi(
  p_user uuid,
  p_bulan date,
  p_sampai date default current_date
)
returns table (
  skor_total numeric,
  predikat predikat_kpi,
  cakupan numeric,
  detail jsonb,
  metode text
)
language plpgsql
stable
as $$
begin
  if bulan_grd(p_bulan) then
    return query
      select g.skor_total, g.predikat, g.cakupan, g.detail, 'grd'::text
      from hitung_kpi_grd(p_user, p_bulan) g;
  else
    return query
      select j.skor_total, j.predikat, j.cakupan, j.detail, 'jabatan'::text
      from hitung_kpi_jabatan(p_user, p_bulan, p_sampai) j;
  end if;
end;
$$;

comment on function hitung_kpi(uuid, date, date) is
  'Skor KPI seseorang; bulan GRD dinilai dari lembar KPI, bulan lain per jabatan (0187).';

-- ---------------------------------------------------------------------
-- Snapshot menyimpan rumus yang dipakai saat dikunci
-- ---------------------------------------------------------------------
alter table kpi_snapshots
  add column metode text not null default 'jabatan'
    check (metode in ('jabatan', 'grd'));

comment on column kpi_snapshots.metode is
  'Rumus saat dikunci: jabatan (0024–0173) atau grd (lembar tangga 10 kolom, 0187).';

-- Sama dengan 0063, kini ikut menyimpan metode. Orang tanpa satu pun
-- pencapaian (cakupan 0, "BELUM DIISI") tetap dilewati.
create or replace function kunci_kpi_bulan(p_bulan date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  akhir_bulan date := (p_bulan + interval '1 month - 1 day')::date;
  jumlah integer := 0;
begin
  if extract(day from p_bulan) <> 1 then
    raise exception 'Periode harus tanggal 1 sebuah bulan';
  end if;

  if not lintas_unit() then
    raise exception 'Hanya CEO atau Manager yang boleh mengunci KPI'
      using errcode = 'insufficient_privilege';
  end if;

  if akhir_bulan >= current_date then
    raise exception 'Bulan % belum selesai; KPI baru bisa dikunci setelah bulan berakhir',
      to_char(p_bulan, 'Mon YYYY')
      using errcode = 'check_violation';
  end if;

  insert into kpi_snapshots
    (user_id, periode_bulan, skor_total, predikat, cakupan, detail, metode,
     dikunci_oleh, dikunci_pada)
  select
    u.id, p_bulan, h.skor_total, h.predikat, h.cakupan, h.detail, h.metode,
    auth.uid(), now()
  from users u
  cross join lateral hitung_kpi(u.id, p_bulan, akhir_bulan) h
  where u.status = 'aktif'
    and h.cakupan > 0
    and not exists (
      select 1 from kpi_snapshots s
      where s.user_id = u.id and s.periode_bulan = p_bulan
    );

  get diagnostics jumlah = row_count;

  if jumlah = 0 and not exists (
    select 1 from kpi_snapshots s where s.periode_bulan = p_bulan
  ) then
    raise exception 'Tidak ada data KPI pada %; tidak ada yang bisa dikunci',
      to_char(p_bulan, 'Mon YYYY')
      using errcode = 'check_violation';
  end if;

  return jumlah;
end;
$$;

-- ---------------------------------------------------------------------
-- Scorecard: metode, predikat kosong untuk "BELUM DIISI", dan siapa
-- yang boleh mengisi pencapaian.
-- ---------------------------------------------------------------------
drop function if exists scorecard_tim(date, date);

create function scorecard_tim(p_bulan date, p_sampai date default current_date)
returns table (
  user_id uuid, nama text, inisial text, jabatan text, unit text,
  skor numeric, predikat predikat_kpi, cakupan numeric,
  detail jsonb, terkunci boolean, metode text, boleh_menilai boolean
)
language sql
stable
as $$
  with baris as (
    select
      u.id as user_id, u.nama,
      upper(left(split_part(u.nama, ' ', 1), 1)
            || left(split_part(u.nama, ' ', array_length(string_to_array(u.nama, ' '), 1)), 1)) as inisial,
      u.jabatan,
      coalesce(split_part(un.nama, ' (', 1), 'Manajemen') as unit,
      coalesce(s.skor_total, h.skor_total, 0) as skor,
      case
        when s.id is not null then s.predikat
        -- GRD: kosong berarti "BELUM DIISI", bukan "Perlu Perbaikan".
        when h.metode = 'grd' then h.predikat
        else coalesce(h.predikat, 'Perlu Perbaikan'::predikat_kpi)
      end as predikat,
      coalesce(s.cakupan, h.cakupan, 0) as cakupan,
      coalesce(s.detail, h.detail, '[]'::jsonb) as detail,
      s.dikunci_pada is not null as terkunci,
      coalesce(s.metode, h.metode, 'jabatan') as metode
    from users u
    left join units un on un.id = u.unit_id
    left join kpi_snapshots s on s.user_id = u.id and s.periode_bulan = p_bulan
    left join lateral hitung_kpi(u.id, p_bulan, p_sampai) h on true
    where u.status = 'aktif'
      and boleh_orang(u.id)
  )
  select
    b.user_id, b.nama, b.inisial, b.jabatan, b.unit, b.skor, b.predikat,
    b.cakupan, b.detail, b.terkunci, b.metode,
    b.metode = 'grd'
      and not b.terkunci
      and jsonb_array_length(b.detail) > 0
      and boleh_menilai(b.user_id) as boleh_menilai
  from baris b
  order by
    -- GRD: yang sudah dinilai di atas; yang kosong = 0 tetap dihitung,
    -- jadi tidak ada lagi pengurutan berdasarkan cakupan.
    case when b.metode = 'grd' then b.predikat is not null
         else b.cakupan >= 100 end desc,
    b.skor desc,
    b.nama;
$$;

comment on function scorecard_tim(date, date) is
  'Scorecard KPI orang-orang dalam cakupan pemanggil; snapshot bila terkunci, GRD atau jabatan menurut bulannya (0187).';

-- ---------------------------------------------------------------------
-- Pengisian pencapaian oleh penilai — satu transaksi untuk satu lembar.
--
-- Security invoker: RLS `kpi_pencapaian_*` dan trigger penjaga tetap
-- berlaku, fungsi ini hanya merangkai beberapa isian jadi satu simpan.
-- Isian berbentuk [{"indikator_id": "…", "nilai": 90, "catatan": ""}];
-- nilai null mengosongkan pencapaian indikator itu.
-- ---------------------------------------------------------------------
create or replace function isi_pencapaian_kpi(
  p_user uuid,
  p_bulan date,
  p_isian jsonb
)
returns integer
language plpgsql
as $$
declare
  v_lembar uuid;
  v_indikator uuid;
  v_isian jsonb;
  jumlah integer := 0;
begin
  if not boleh_menilai(p_user) then
    raise exception 'Kamu bukan penilai KPI orang ini'
      using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_isian) is distinct from 'array' then
    raise exception 'Isian pencapaian harus berupa daftar'
      using errcode = 'check_violation';
  end if;

  select id into v_lembar
  from kpi_lembar
  where user_id = p_user and periode_bulan = p_bulan and status = 'aktif';

  if v_lembar is null then
    raise exception 'Belum ada lembar KPI aktif untuk bulan ini'
      using errcode = 'no_data_found';
  end if;

  for v_isian in select * from jsonb_array_elements(p_isian) loop
    v_indikator := (v_isian ->> 'indikator_id')::uuid;

    if not exists (
      select 1 from kpi_indikator
      where id = v_indikator and lembar_id = v_lembar
    ) then
      raise exception 'Indikator % bukan bagian lembar KPI ini', v_indikator
        using errcode = 'check_violation';
    end if;

    if coalesce(jsonb_typeof(v_isian -> 'nilai'), 'null') = 'null' then
      delete from kpi_pencapaian where indikator_id = v_indikator;
    else
      insert into kpi_pencapaian (indikator_id, nilai, catatan)
      values (
        v_indikator,
        (v_isian ->> 'nilai')::numeric,
        coalesce(btrim(v_isian ->> 'catatan'), '')
      )
      on conflict (indikator_id) do update
        set nilai = excluded.nilai,
            catatan = excluded.catatan;
    end if;

    jumlah := jumlah + 1;
  end loop;

  return jumlah;
end;
$$;

comment on function isi_pencapaian_kpi(uuid, date, jsonb) is
  'Penilai mengisi atau mengosongkan PENCAPAIAN lembar KPI aktif seseorang dalam satu transaksi (0187).';

-- ---------------------------------------------------------------------
-- Rollback (manual): drop isi_pencapaian_kpi, scorecard_tim, hitung_kpi,
-- hitung_kpi_jabatan, hitung_kpi_grd, tabel kpi_pencapaian/kpi_indikator/
-- kpi_lembar beserta fungsi pembantunya, kolom kpi_snapshots.metode;
-- lalu jalankan ulang definisi hitung_kpi & scorecard_tim dari 0173 dan
-- kunci_kpi_bulan dari 0063.
-- ---------------------------------------------------------------------
