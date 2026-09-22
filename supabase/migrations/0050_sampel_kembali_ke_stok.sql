-- =====================================================================
-- K-Space V2 — Sampel yang dikembalikan bisa kembali menjadi stok
--
-- Aturan di 0048 membuat 'dikembalikan' hampir buntu: dari sana sampel
-- hanya bisa dipegang lagi atau hilang, tidak pernah kembali menjadi
-- 'tersedia'. Padahal itulah yang terjadi sehari-hari — barang kembali,
-- diperiksa, lalu masuk stok. Tanpa jalur itu, hitungan "berapa yang ada
-- di gudang" selamanya salah.
-- =====================================================================

create or replace function perpindahan_sampel_sah(
  p_dari status_sampel,
  p_ke status_sampel
)
returns boolean
language sql
immutable
as $$
  select case
    when p_dari is null then p_ke = 'tersedia'
    when p_dari = p_ke then false
    when p_dari = 'tersedia'     then p_ke in ('dipegang', 'hilang')
    when p_dari = 'dipegang'     then p_ke in ('dikirim', 'tersedia', 'hilang')
    when p_dari = 'dikirim'      then p_ke in ('diterima', 'hilang')
    when p_dari = 'diterima'     then p_ke in ('dikembalikan', 'hilang')
    -- Barang kembali → diperiksa → masuk stok lagi.
    when p_dari = 'dikembalikan' then p_ke in ('tersedia', 'dipegang', 'hilang')
    -- Sampel hilang bisa ditemukan lagi; itu kabar baik, bukan kejanggalan.
    when p_dari = 'hilang'       then p_ke = 'tersedia'
    else false
  end;
$$;
