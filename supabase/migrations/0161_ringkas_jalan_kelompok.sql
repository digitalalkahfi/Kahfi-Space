-- =====================================================================
-- K-Space V2 — Hasil tiap kelompok pada satu jalan migrasi
--
-- `migrasi_catatan` mencatat per entri, dan yang dicatat hanya yang
-- bermasalah — ribuan baris yang berhasil tidak ikut, karena mencatat
-- semuanya berarti menulis dua kali lipat data yang dipindahkan.
--
-- Akibatnya jumlah yang berhasil tidak bisa dihitung dari sana. Tabel
-- ini yang menyimpannya: satu baris per kelompok per jalan, berisi
-- berapa diperiksa, berapa ditulis, berapa tertahan. Sepuluh baris per
-- jalan, dan pertanyaan "migrasi kemarin sampai mana" akhirnya punya
-- jawaban yang tidak perlu ditebak.
-- =====================================================================

create table migrasi_ringkas (
  jalan_id   uuid not null references migrasi_jalan (id) on delete cascade,
  kelompok   text not null,
  diperiksa  integer not null default 0 check (diperiksa >= 0),
  ditulis    integer not null default 0 check (ditulis >= 0),
  tertahan   integer not null default 0 check (tertahan >= 0),
  dicatat_pada timestamptz not null default now(),

  primary key (jalan_id, kelompok)
);

comment on table migrasi_ringkas is
  'Hasil tiap kelompok pada satu jalan migrasi; yang berhasil tidak dicatat per entri.';

alter table migrasi_ringkas enable row level security;

create policy migrasi_ringkas_kelola on migrasi_ringkas
  for all using (lintas_unit()) with check (lintas_unit());

/**
 * Hasil tiap kelompok pada sebuah jalan; tanpa argumen, jalan terbaru.
 */
create or replace function ringkas_jalan_kelompok(p_jalan uuid default null)
returns table (
  kelompok  text,
  diperiksa integer,
  ditulis   integer,
  tertahan  integer
)
language sql
stable
as $$
  select r.kelompok, r.diperiksa, r.ditulis, r.tertahan
  from migrasi_ringkas r
  where r.jalan_id = coalesce(
    p_jalan,
    (select j.id from migrasi_jalan j order by j.dimulai_pada desc limit 1)
  )
  order by r.dicatat_pada, r.kelompok;
$$;
