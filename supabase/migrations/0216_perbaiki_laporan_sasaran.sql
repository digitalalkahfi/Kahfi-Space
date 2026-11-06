-- =====================================================================
-- K-Space V2 — Yang berhak mengirim laporan berhak memperbaikinya
--
-- CEO/Manager boleh mengirim laporan untuk akun milik PIC, dan satu
-- sasaran hanya punya satu laporan per tanggal. PIC yang melihat angkanya
-- keliru tidak bisa mengirim ulang (laporan ganda) dan tidak bisa
-- memperbaiki (hanya pengirim dan CEO/Manager), padahal form, riwayat,
-- dan pesan duplikat mengarahkannya ke sana.
--
-- Aturannya kini mengikuti policy `daily_reports_kirim`: pengirimnya,
-- CEO/Manager, PIC dan Co-Leader akun itu, serta Leader dan Co-Leader
-- unit untuk laporan tingkat unit.
--
-- Hak ini dibuka lewat `perbaiki_laporan_harian` saja, bukan lewat policy
-- `daily_reports_perbaiki`. Policy tidak bisa membatasi kolom: PIC akan
-- bisa mengubah tanggal atau pengirim laporan orang lain langsung ke
-- tabel, dan perubahan itu tidak meninggalkan jejak.
-- =====================================================================

create or replace function boleh_perbaiki_laporan(
  p_pengirim uuid,
  p_account  uuid,
  p_unit     uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    anggota_aktif() and (
      p_pengirim = auth.uid()
      or lintas_unit()
      or (p_account is not null and pic_akun(p_account))
      or (p_unit is not null and memimpin_unit() and p_unit = unit_saya())
    ),
    false
  );
$$;

comment on function boleh_perbaiki_laporan(uuid, uuid, uuid) is
  'Pengguna aktif boleh memperbaiki laporan ini: pengirimnya, CEO/Manager, atau yang berhak mengirim untuk sasarannya (0216).';

revoke execute on function boleh_perbaiki_laporan(uuid, uuid, uuid) from public, anon;
grant execute on function boleh_perbaiki_laporan(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Perbaikan laporan
--
-- Kini security definer: PIC yang bukan pengirim tidak lolos policy
-- `daily_reports_perbaiki`, jadi haknya diperiksa di sini. Sebagai
-- definer, fungsi ini boleh membaca kolom komisi, sehingga dua cabang
-- dari 0210 tidak diperlukan lagi. Komisi kosong tetap berarti tidak
-- diubah, dan trigger jejak tetap mencatat pemanggilnya lewat auth.uid().
--
-- Tanpa sesi pengguna berarti jalur sistem: skrip migrasi V1 memanggil
-- fungsi ini dengan service role, yang memang melewati RLS. Karena `anon`
-- juga tanpa sesi, hak EXECUTE-nya dicabut di bawah.
-- ---------------------------------------------------------------------
create or replace function perbaiki_laporan_harian(
  p_report_id     uuid,
  p_gmv           numeric,
  p_alasan        text,
  p_catatan       text    default null,
  p_komisi        numeric default null,
  p_jumlah_upload integer default null,
  p_gmv_live      numeric default null,
  p_jam_live      numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if length(btrim(coalesce(p_alasan, ''))) < 10 then
    raise exception 'Alasan perbaikan minimal 10 karakter'
      using errcode = 'check_violation';
  end if;

  if p_gmv is null or p_gmv < 0 then
    raise exception 'Nilai GMV tidak sah' using errcode = 'check_violation';
  end if;

  perform set_config('app.alasan_revisi', btrim(p_alasan), true);

  update daily_reports
     set gmv = p_gmv,
         komisi = coalesce(p_komisi, komisi),
         jumlah_upload = p_jumlah_upload,
         gmv_live = coalesce(p_gmv_live, gmv_live),
         jam_live = coalesce(p_jam_live, jam_live),
         catatan = coalesce(p_catatan, catatan)
   where id = p_report_id
     and (
       auth.uid() is null
       or boleh_perbaiki_laporan(user_id, account_id, unit_id)
     )
  returning id into v_id;

  if v_id is null then
    raise exception 'Laporan tidak ditemukan atau bukan milikmu'
      using errcode = 'insufficient_privilege';
  end if;

  return v_id;
end;
$$;

comment on function perbaiki_laporan_harian(uuid, numeric, text, text, numeric, integer, numeric, numeric) is
  'Satu-satunya jalan mengubah angka laporan; alasan wajib dan ikut tercatat. Hak mengikuti boleh_perbaiki_laporan (0216).';

revoke execute on function perbaiki_laporan_harian(uuid, numeric, text, text, numeric, integer, numeric, numeric) from public, anon;
grant execute on function perbaiki_laporan_harian(uuid, numeric, text, text, numeric, integer, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- Yang boleh memperbaiki boleh membaca jejaknya. Tanpa ini PIC melihat
-- "Belum pernah diperbaiki" pada laporan yang baru saja ia perbaiki.
-- ---------------------------------------------------------------------
drop policy if exists revisi_baca on daily_report_revisions;
create policy revisi_baca on daily_report_revisions
  for select
  using (
    exists (
      select 1 from daily_reports r
      where r.id = report_id
        and (
          lintas_angka()
          or r.user_id = auth.uid()
          or boleh_orang(r.user_id)
          or boleh_perbaiki_laporan(r.user_id, r.account_id, r.unit_id)
        )
    )
  );

-- ---------------------------------------------------------------------
-- Riwayat laporan membawa haknya, supaya layar tidak menawarkan perbaikan
-- yang nanti ditolak. Kolom baru di ujung: `create or replace view` hanya
-- boleh menambah, bukan menyisipkan.
-- ---------------------------------------------------------------------
create or replace view riwayat_laporan_minimum
with (security_invoker = true)
as
select
  l.id,
  l.tanggal,
  l.account_id,
  l.unit_id,
  l.gmv,
  l.jumlah_upload,
  l.catatan,
  l.status,
  l.submitted_at,
  a.username as akun_username,
  a.level as akun_level,
  batas_minimum(a.level) as minimum_unggahan,
  au.kode as akun_unit_kode,
  u.kode as unit_kode,
  u.nama as unit_nama,
  p.nama as pelapor_nama,
  l.gmv_live,
  l.jam_live,
  boleh_perbaiki_laporan(l.user_id, l.account_id, l.unit_id) as boleh_perbaiki
from daily_reports l
left join accounts a on a.id = l.account_id
left join units au on au.id = a.unit_id
left join units u on u.id = l.unit_id
left join users p on p.id = l.user_id
where anggota_aktif();
