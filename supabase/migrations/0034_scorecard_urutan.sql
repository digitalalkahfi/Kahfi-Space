-- =====================================================================
-- K-Space V2 — Urutan scorecard mendahulukan yang terukur penuh
--
-- Dengan cakupan parsial, skor 1.000 dari satu indikator ringan
-- mengalahkan 774 yang dinilai lengkap. Mengurutkan murni per skor
-- menaruh orang yang paling sedikit terukur di puncak papan.
--
-- Urutan sekarang: cakupan penuh dulu, baru skor. Orang berdata tipis
-- turun ke bawah sebagai daftar "data belum lengkap", bukan juara.
-- =====================================================================

drop function if exists scorecard_tim(date, date);

create function scorecard_tim(p_bulan date, p_sampai date default current_date)
returns table (
  user_id uuid, nama text, inisial text, jabatan text, unit text,
  skor numeric, predikat predikat_kpi, cakupan numeric,
  detail jsonb, terkunci boolean
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
      coalesce(s.predikat, h.predikat, 'Perlu Perbaikan'::predikat_kpi) as predikat,
      case when s.dikunci_pada is not null then 100 else coalesce(h.cakupan, 0) end as cakupan,
      coalesce(s.detail, h.detail, '[]'::jsonb) as detail,
      s.dikunci_pada is not null as terkunci
    from users u
    left join units un on un.id = u.unit_id
    left join kpi_snapshots s on s.user_id = u.id and s.periode_bulan = p_bulan
    left join lateral hitung_kpi(u.id, p_bulan, p_sampai) h on true
    where u.status = 'aktif'
  )
  select user_id, nama, inisial, jabatan, unit, skor, predikat, cakupan, detail, terkunci
  from baris
  order by (cakupan >= 100) desc, skor desc, nama;
$$;
