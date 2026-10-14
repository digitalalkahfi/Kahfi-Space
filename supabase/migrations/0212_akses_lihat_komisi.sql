-- =====================================================================
-- K-Space V2 — Akses lihat komisi per orang, diatur CEO/Manager
-- (docs/KOMISI-DETAIL-AKUN-AFFILIATOR.md §4.5, keputusan K5–K7)
--
-- MENGISI komisi dan MELIHAT komisi adalah dua hak berbeda (K5). Sejak
-- 0210, Staff otomatis melihat komisi laporan yang ia kirim sendiri.
-- Aturan itu diganti: tidak ada yang otomatis melihat komisi kecuali
-- CEO dan Manager. Selain mereka, akses lihat diberikan per orang oleh
-- CEO/Manager dengan cakupan:
--
--   (tanpa baris)  tidak ada — bawaan untuk semua orang
--   pegangan       akun Affiliator yang SAAT INI ia pegang sebagai PIC
--   tertentu       akun Affiliator yang dipilih satu per satu
--   semua          seluruh akun Affiliator
--
-- Kartu total Komisi dan halaman detail per akun tetap hanya untuk
-- CEO/Manager (K7) — `boleh_lihat_komisi()` tanpa argumen (0210) tidak
-- berubah. Penentu per akun adalah `boleh_lihat_komisi(account_id)`,
-- dan seluruh pintu baca komisi per laporan memakainya.
--
-- Orang yang dinonaktifkan otomatis kehilangan aksesnya lewat
-- `anggota_aktif()` (0208); barisnya tidak perlu dihapus.
-- =====================================================================

create type cakupan_akses_komisi as enum ('pegangan', 'tertentu', 'semua');

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------
create table akses_komisi (
  user_id     uuid primary key
                references users (id) on update cascade on delete cascade,
  cakupan     cakupan_akses_komisi not null,
  diberi_oleh uuid references users (id) on update cascade on delete set null,
  diberi_pada timestamptz not null default now()
);

comment on table akses_komisi is
  'Akses lihat komisi per orang (0212). Tanpa baris = tidak ada akses. CEO/Manager selalu melihat semua.';

create table akses_komisi_akun (
  user_id    uuid not null
               references akses_komisi (user_id) on update cascade on delete cascade,
  account_id uuid not null references accounts (id) on delete cascade,
  primary key (user_id, account_id)
);

comment on table akses_komisi_akun is
  'Akun yang boleh dilihat komisinya untuk cakupan "tertentu" (0212).';

create table riwayat_akses_komisi (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on update cascade,
  -- {"cakupan": …, "akun": [{"id": …, "username": …}]}; null = tidak ada akses.
  sebelum jsonb,
  sesudah jsonb,
  oleh    uuid references users (id) on update cascade on delete set null,
  pada    timestamptz not null default now()
);

comment on table riwayat_akses_komisi is
  'Jejak setiap pemberian, perubahan, dan pencabutan akses lihat komisi (0212). Tidak bisa diubah atau dihapus.';

create index riwayat_akses_komisi_user_idx
  on riwayat_akses_komisi (user_id, pada desc);

-- Riwayat tidak bisa diubah atau dihapus, bahkan oleh pemilik tabel
-- lewat jalur aplikasi. (Perpindahan id profil menonaktifkan trigger ini
-- sementara, lihat `pindahkan_id_profil`, 0209.)
create or replace function larang_ubah_riwayat_akses_komisi()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Riwayat akses komisi tidak bisa diubah atau dihapus'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger riwayat_akses_komisi_tetap
  before update or delete on riwayat_akses_komisi
  for each row execute function larang_ubah_riwayat_akses_komisi();

-- ---------------------------------------------------------------------
-- Hak akses tabel
--
-- Ketiganya hanya terbaca CEO/Manager aktif; orangnya sendiri boleh
-- membaca baris `akses_komisi` miliknya. Klien tidak menulis langsung:
-- satu-satunya jalan mengubah akses adalah `atur_akses_komisi`, supaya
-- setiap perubahan pasti tercatat di riwayat dalam transaksi yang sama.
-- ---------------------------------------------------------------------
alter table akses_komisi enable row level security;
alter table akses_komisi_akun enable row level security;
alter table riwayat_akses_komisi enable row level security;

revoke all on akses_komisi, akses_komisi_akun, riwayat_akses_komisi from anon, authenticated;
grant select on akses_komisi, akses_komisi_akun, riwayat_akses_komisi to authenticated;

create policy akses_komisi_baca on akses_komisi
  for select to authenticated
  using (user_id = auth.uid() or lintas_unit());

create policy akses_komisi_akun_baca on akses_komisi_akun
  for select to authenticated
  using (lintas_unit());

create policy riwayat_akses_komisi_baca on riwayat_akses_komisi
  for select to authenticated
  using (lintas_unit());

-- Gerbang anggota aktif (0208) untuk tabel baru.
do $$
declare
  t text;
begin
  foreach t in array array['akses_komisi', 'akses_komisi_akun', 'riwayat_akses_komisi'] loop
    execute format(
      'create policy gerbang_anggota_aktif on public.%I as restrictive
         for all to public
         using ((select anggota_aktif()))
         with check ((select anggota_aktif()))',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Penentu: boleh melihat komisi satu akun?
-- ---------------------------------------------------------------------
create or replace function boleh_lihat_komisi(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select boleh_lihat_komisi()
      or (
        p_account is not null
        and anggota_aktif()
        and exists (
          select 1
          from akses_komisi k
          join accounts a on a.id = p_account
          join units u on u.id = a.unit_id and u.kode = 'affiliator'
          where k.user_id = auth.uid()
            and (
              k.cakupan = 'semua'
              or (k.cakupan = 'pegangan' and a.pic_user_id = auth.uid())
              or (
                k.cakupan = 'tertentu'
                and exists (
                  select 1 from akses_komisi_akun x
                  where x.user_id = k.user_id and x.account_id = p_account
                )
              )
            )
        )
      );
$$;

comment on function boleh_lihat_komisi(uuid) is
  'Pemanggil boleh melihat komisi akun ini: CEO/Manager aktif, atau akses lihat komisi yang mencakupnya (0212).';

-- Akun Affiliator yang komisinya terlihat oleh pemanggil — dipakai
-- aplikasi untuk memutuskan kolom mana yang digambar.
create or replace function akun_komisi_terlihat()
returns table (account_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select a.id
  from accounts a
  join units u on u.id = a.unit_id and u.kode = 'affiliator'
  where boleh_lihat_komisi(a.id);
$$;

-- ---------------------------------------------------------------------
-- Pintu baca komisi per laporan: kini mengikuti akses per akun
--
-- Tidak ada lagi jalur khusus "pelapor membaca laporannya sendiri"
-- (§4.1 no. 3). Laporan tingkat unit (tanpa akun) hanya terbaca
-- CEO/Manager.
-- ---------------------------------------------------------------------
create or replace function komisi_laporan(p_ids uuid[])
returns table (report_id uuid, komisi numeric)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.komisi
  from daily_reports r
  where r.id = any (p_ids)
    and boleh_lihat_komisi(r.account_id);
$$;

comment on function komisi_laporan(uuid[]) is
  'Komisi laporan yang akunnya boleh dilihat pemanggil (0212). Laporan lain tidak dikembalikan sama sekali.';

-- Dipakai capaian pribadi. Namanya dipertahankan; isinya kini laporan
-- dalam rentang yang akunnya terlihat oleh pemanggil.
create or replace function komisi_laporan_saya(p_dari date, p_sampai date)
returns table (report_id uuid, tanggal date, account_id uuid, komisi numeric)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.tanggal, r.account_id, r.komisi
  from daily_reports r
  where r.tanggal between p_dari and p_sampai
    and r.account_id in (select account_id from akun_komisi_terlihat());
$$;

create or replace function komisi_revisi(p_report_ids uuid[])
returns table (revisi_id uuid, komisi_lama numeric, komisi_baru numeric)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.komisi_lama, v.komisi_baru
  from daily_report_revisions v
  join daily_reports r on r.id = v.report_id
  where v.report_id = any (p_report_ids)
    and boleh_lihat_komisi(r.account_id);
$$;

-- Komisi per akun per hari, hanya akun yang terlihat (Kelola Akun,
-- riwayat). `p_account` opsional untuk satu akun saja.
create or replace function komisi_akun(
  p_dari    date,
  p_sampai  date,
  p_account uuid default null
)
returns table (
  account_id uuid,
  tanggal    date,
  komisi     numeric,
  laporan    integer,
  berkomisi  integer
)
language sql
stable
security definer
set search_path = public
as $$
  select r.account_id, r.tanggal,
         coalesce(sum(r.komisi), 0),
         count(*)::int,
         count(r.komisi)::int
  from daily_reports r
  where r.tanggal between p_dari and p_sampai
    and (p_account is null or r.account_id = p_account)
    and r.account_id in (select account_id from akun_komisi_terlihat())
  group by r.account_id, r.tanggal
  order by r.account_id, r.tanggal;
$$;

revoke execute on function boleh_lihat_komisi(uuid) from anon;
revoke execute on function akun_komisi_terlihat() from anon;
revoke execute on function komisi_akun(date, date, uuid) from anon;

-- ---------------------------------------------------------------------
-- GRD: lead measure bersumber komisi (§4.1 no. 6)
--
-- Angkanya terlihat bila pemanggil boleh melihat komisi SELURUH akun di
-- cakupan lead measure itu: akun yang didaftarkan padanya, atau — bila
-- tidak ada — seluruh akun unit goal-nya. Cakupan kosong hanya untuk
-- CEO/Manager.
-- ---------------------------------------------------------------------
create or replace function lead_komisi_terlihat(p_lead uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with cakupan as (
    select x.account_id from lead_measure_akun x where x.lead_measure_id = p_lead
    union
    select a.id
    from lead_measures m
    join goals g on g.id = m.goal_id
    join accounts a on a.unit_id = g.unit_id
    where m.id = p_lead
      and not exists (select 1 from lead_measure_akun x where x.lead_measure_id = p_lead)
  )
  select boleh_lihat_komisi()
      or (
        exists (select 1 from cakupan)
        and not exists (select 1 from cakupan c where not boleh_lihat_komisi(c.account_id))
      );
$$;

drop policy if exists lme_komisi_rahasia on lead_measure_entries;
create policy lme_komisi_rahasia on lead_measure_entries
  as restrictive
  for select to public
  using (
    boleh_lihat_komisi()
    or not exists (
      select 1 from lead_measures m
      where m.id = lead_measure_entries.lead_measure_id
        and m.sumber_laporan = 'komisi'
    )
    or lead_komisi_terlihat(lead_measure_entries.lead_measure_id)
  );

-- Lead measure bersumber komisi yang angkanya terlihat oleh pemanggil.
create or replace function lead_komisi_terlihat_semua()
returns table (lead_measure_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select m.id from lead_measures m
  where m.sumber_laporan = 'komisi' and lead_komisi_terlihat(m.id);
$$;

revoke execute on function lead_komisi_terlihat(uuid) from anon;
revoke execute on function lead_komisi_terlihat_semua() from anon;

-- ---------------------------------------------------------------------
-- Mengatur akses — hanya CEO/Manager aktif (AC15), selalu tercatat (AC16)
-- ---------------------------------------------------------------------
create or replace function potret_akses_komisi(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when k.user_id is null then null else jsonb_build_object(
    'cakupan', k.cakupan,
    'akun', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'username', a.username)
                       order by a.username)
      from akses_komisi_akun x join accounts a on a.id = x.account_id
      where x.user_id = k.user_id
    ), '[]'::jsonb)
  ) end
  from (select p_user as id) s
  left join akses_komisi k on k.user_id = s.id;
$$;

create or replace function atur_akses_komisi(
  p_user    uuid,
  p_cakupan cakupan_akses_komisi,
  p_akun    uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sebelum jsonb;
  sesudah jsonb;
  bukan_affiliator text;
begin
  if not coalesce(lintas_unit(), false) then
    raise exception 'Hanya CEO atau Manager yang boleh mengatur akses komisi.'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from users where id = p_user) then
    raise exception 'Anggota tidak ditemukan.';
  end if;

  if p_cakupan = 'tertentu' then
    if coalesce(array_length(p_akun, 1), 0) = 0 then
      raise exception 'Pilih minimal satu akun untuk cakupan "akun tertentu".';
    end if;
    select string_agg(coalesce(a.username, x::text), ', ') into bukan_affiliator
    from unnest(p_akun) x
    left join accounts a on a.id = x
    left join units u on u.id = a.unit_id
    where u.kode is distinct from 'affiliator';
    if bukan_affiliator is not null then
      raise exception 'Akses komisi hanya untuk akun Affiliator: %.', bukan_affiliator;
    end if;
  end if;

  -- Kunci baris orang ini supaya dua pengatur yang menyimpan
  -- bersamaan tidak saling menimpa riwayatnya.
  perform 1 from users where id = p_user for update;
  sebelum := potret_akses_komisi(p_user);

  if p_cakupan is null then
    delete from akses_komisi where user_id = p_user;
  else
    insert into akses_komisi (user_id, cakupan, diberi_oleh, diberi_pada)
    values (p_user, p_cakupan, auth.uid(), now())
    on conflict (user_id) do update
      set cakupan = excluded.cakupan,
          diberi_oleh = excluded.diberi_oleh,
          diberi_pada = excluded.diberi_pada;

    delete from akses_komisi_akun where user_id = p_user;
    if p_cakupan = 'tertentu' then
      insert into akses_komisi_akun (user_id, account_id)
      select p_user, x from unnest(p_akun) x
      on conflict do nothing;
    end if;
  end if;

  sesudah := potret_akses_komisi(p_user);

  if sebelum is distinct from sesudah then
    insert into riwayat_akses_komisi (user_id, sebelum, sesudah, oleh)
    values (p_user, sebelum, sesudah, auth.uid());
  end if;
end;
$$;

comment on function atur_akses_komisi(uuid, cakupan_akses_komisi, uuid[]) is
  'Memberi, mengubah, atau mencabut (p_cakupan null) akses lihat komisi seseorang. Hanya CEO/Manager aktif; tercatat di riwayat (0212).';

revoke execute on function potret_akses_komisi(uuid) from public, anon, authenticated;
revoke execute on function atur_akses_komisi(uuid, cakupan_akses_komisi, uuid[]) from anon;
