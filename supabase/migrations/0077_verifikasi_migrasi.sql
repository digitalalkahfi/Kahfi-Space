-- =====================================================================
-- K-Space V2 — Verifikasi jumlah baris yang benar-benar berarti
--
-- Verifikasi sebelumnya membandingkan jumlah entri sumber dengan jumlah
-- SELURUH baris tabel tujuan. Perbandingan itu hanya benar sekali: pada
-- basis data yang masih kosong. Begitu orang mulai bekerja — menambah
-- anggota, membuat akun, mengisi laporan — jumlah tabel tujuan membengkak
-- oleh baris yang tidak ada hubungannya dengan migrasi, dan angka
-- "cocok" berhenti membuktikan apa pun.
--
-- Yang ingin dijawab sebenarnya: dari entri yang tercatat berhasil
-- dipindahkan, berapa yang benar-benar ada sekarang di tabel tujuan?
-- Pertanyaan itu hanya bisa dijawab bila tiap catatan menyimpan id baris
-- barunya (`migrasi_catatan.id_baru`) — dan di sinilah id itu dipakai.
--
-- Entri yang id-nya kosong ikut dilaporkan terpisah: tercatat berhasil
-- tanpa menyebut baris mana, dan karena itu tidak bisa dibuktikan.
-- =====================================================================

create or replace function verifikasi_migrasi(p_jalan uuid default null)
returns table (
  entitas       text,
  berhasil      integer,
  ada_di_tujuan integer,
  tanpa_id      integer,
  hilang        integer
)
language sql
stable
as $$
  with terpilih as (
    select coalesce(
      p_jalan,
      (select id from migrasi_jalan order by dimulai_pada desc limit 1)
    ) as id
  ),
  catatan as (
    select c.entitas, c.id_baru
    from migrasi_catatan c
    where c.jalan_id = (select id from terpilih) and c.status = 'berhasil'
  ),
  diperiksa as (
    select
      c.entitas,
      c.id_baru,
      case c.entitas
        when 'user' then exists (select 1 from users t where t.id = c.id_baru)
        when 'account' then exists (select 1 from accounts t where t.id = c.id_baru)
        when 'goal' then exists (select 1 from goals t where t.id = c.id_baru)
        when 'report' then exists (select 1 from daily_reports t where t.id = c.id_baru)
        when 'attendance' then exists (select 1 from attendance t where t.id = c.id_baru)
        when 'task' then exists (select 1 from tasks t where t.id = c.id_baru)
        else false
      end as ada
    from catatan c
  )
  select
    d.entitas,
    count(*)::int,
    count(*) filter (where d.id_baru is not null and d.ada)::int,
    count(*) filter (where d.id_baru is null)::int,
    count(*) filter (where d.id_baru is not null and not d.ada)::int
  from diperiksa d
  group by d.entitas
  order by d.entitas;
$$;

comment on function verifikasi_migrasi(uuid) is
  'Dari entri yang tercatat berhasil, berapa yang benar-benar ada di tabel tujuannya.';
