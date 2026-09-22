-- =====================================================================
-- K-Space V2 — Kaizen: lapor → diproses → selesai
--
-- 5-Why dilepas. Metodenya benar di atas kertas, tapi alurnya menuntut
-- waktu duduk bersama yang tidak pernah ada di lapangan: masalah lalu
-- berhenti di 'baru' bukan karena tidak ditangani, melainkan karena
-- formulirnya tidak terisi. Papan yang macet begitu bercerita lebih
-- buruk daripada papan yang sederhana.
--
-- Yang tersisa adalah alur yang memang dijalankan orang: seseorang
-- melapor, manajemen menerimanya (diproses), lalu menulis solusinya dan
-- menandainya selesai.
--
-- Tindakan yang terlanjur tercatat TIDAK dibuang begitu saja: isinya
-- dipindahkan ke kolom `solusi` sebelum tabelnya dihapus. Rantai
-- "mengapa" memang tidak dipindahkan — ia analisis, bukan solusi, dan
-- justru itu yang diminta hilang.
-- =====================================================================

alter table problems
  add column if not exists solusi text not null default '';

comment on column problems.solusi is
  'Solusi dari manajemen; wajib terisi sebelum status boleh selesai.';

-- Tindakan lama jadi solusi, satu baris per tindakan.
update problems p
   set solusi = k.teks
  from (
    select problem_id,
           string_agg(tindakan, E'\n' order by created_at) as teks
      from problem_actions
     group by problem_id
  ) k
 where k.problem_id = p.id
   and p.solusi = '';

-- ---------------------------------------------------------------------
-- Status: empat keadaan, bukan lima.
--
-- 'dianalisis' dan 'ditindak' sama-sama berarti "sudah diterima dan
-- sedang dikerjakan" dalam alur baru, jadi keduanya jadi 'diproses'.
-- ---------------------------------------------------------------------
drop trigger if exists jaga_status_masalah_trg on problems;
drop trigger if exists catat_status_masalah_trg on problems;

alter type status_masalah rename to status_masalah_5why;

create type status_masalah as enum (
  'baru',      -- dilaporkan, belum dilihat manajemen
  'diproses',  -- diterima manajemen, sedang dikerjakan
  'selesai',   -- solusinya ditulis dan dijalankan
  'ditutup'    -- tidak dilanjutkan, dengan alasan
);

alter table problems
  alter column status drop default,
  alter column status type status_masalah
    using (
      case status::text
        when 'dianalisis' then 'diproses'
        when 'ditindak' then 'diproses'
        else status::text
      end
    )::status_masalah,
  alter column status set default 'baru';

alter table problem_events
  alter column dari type status_masalah
    using (
      case dari::text
        when 'dianalisis' then 'diproses'
        when 'ditindak' then 'diproses'
        else dari::text
      end
    )::status_masalah,
  alter column ke type status_masalah
    using (
      case ke::text
        when 'dianalisis' then 'diproses'
        when 'ditindak' then 'diproses'
        else ke::text
      end
    )::status_masalah;

drop type status_masalah_5why;

-- ---------------------------------------------------------------------
-- Perkakas 5-Why dilepas seluruhnya.
--
-- `tambah_why` disebut lebih dulu karena tipe kembaliannya adalah tabel
-- yang dihapus setelahnya.
-- ---------------------------------------------------------------------
drop function if exists tambah_why(uuid, text);
drop function if exists akar_ditangani(uuid);

drop table if exists problem_actions;
drop table if exists problem_whys;

drop function if exists jaga_urutan_why();
drop function if exists jaga_hapus_why();
drop function if exists gerakkan_status_masalah();
drop function if exists jaga_sebab_tindakan();
drop function if exists jaga_ubah_tindakan();
drop function if exists catat_tindakan_tuntas();

-- ---------------------------------------------------------------------
-- Status tetap harus jujur pada isinya — hanya syaratnya yang berubah.
-- ---------------------------------------------------------------------
create or replace function jaga_status_masalah()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  -- Selesai berarti ada jawabannya. Tanpa syarat ini, papan bisa
  -- menghijau tanpa satu kalimat pun yang bisa dibaca orang berikutnya
  -- yang kena masalah sama — dan itulah satu-satunya gunanya Kaizen.
  if new.status = 'selesai'
     and length(trim(coalesce(new.solusi, ''))) < 10
  then
    raise exception 'Tulis solusinya dulu (minimal 10 huruf) sebelum menandai selesai'
      using errcode = 'check_violation';
  end if;

  -- Menutup tanpa solusi selalu perlu alasan: itulah satu-satunya jejak
  -- mengapa masalahnya tidak dikerjakan.
  if new.status = 'ditutup'
     and length(trim(coalesce(new.ditutup_alasan, ''))) < 10
  then
    raise exception 'Sebutkan alasan penutupan (minimal 10 huruf)'
      using errcode = 'check_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger jaga_status_masalah_trg
  before update of status on problems
  for each row execute function jaga_status_masalah();

create trigger catat_status_masalah_trg
  after update of status on problems
  for each row execute function catat_status_masalah();

-- ---------------------------------------------------------------------
-- Pelapor melapor; status dan solusi milik manajemen.
--
-- `problems_lapor` (0052) mengizinkan siapa pun menyisipkan barisnya
-- sendiri, dan RLS tidak bisa membatasi kolom. Tanpa penjaga ini siapa
-- pun bisa memasukkan masalah yang sudah "selesai" lengkap dengan
-- solusi karangan — dan papannya tidak lagi bisa dipercaya.
--
-- `auth.uid() is null` berarti tidak ada sesi sama sekali: pengisian
-- data contoh dan tugas terjadwal. Keduanya bukan pelapor, dan memaksa
-- mereka lewat jalur "baru" akan menghapus status yang memang sengaja
-- disiapkan.
-- ---------------------------------------------------------------------
create or replace function jaga_lapor_masalah()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and not lintas_unit() then
    new.status := 'baru';
    new.solusi := '';
  end if;
  return new;
end;
$$;

drop trigger if exists jaga_lapor_masalah_trg on problems;

create trigger jaga_lapor_masalah_trg
  before insert on problems
  for each row execute function jaga_lapor_masalah();

comment on table problems is
  'Laporan Kaizen: dilaporkan siapa pun, diproses dan diselesaikan manajemen.';
