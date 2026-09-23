-- =====================================================================
-- K-Space V2 — Mengganti susunan satu permukaan dalam satu langkah
--
-- Aplikasi menyimpan susunan dengan hapus-lalu-sisip: seluruh daftar
-- sebuah permukaan diganti sekaligus, karena yang disimpan adalah
-- URUTAN dan urutan yang diperbarui sebagian menghasilkan campuran
-- antara susunan lama dan baru.
--
-- Lewat PostgREST, dua langkah itu dua permintaan terpisah. Bila yang
-- kedua gagal — koneksi putus, tab ditutup, baris ditolak batasan —
-- yang tersisa adalah permukaan tanpa satu baris pun, dan menurut
-- aturan tabel ini "tanpa baris" berarti ikut bawaan. Orangnya
-- kehilangan susunan yang baru saja ia atur, tanpa pesan apa pun.
--
-- Fungsi ini menyatukan keduanya jadi satu pernyataan, jadi satu
-- transaksi. Ia SENGAJA bukan `security definer`: seluruh isinya
-- menyentuh baris milik pemanggil, dan RLS yang sudah ada (0123)
-- adalah penjaganya. `security definer` di sini hanya akan melewati
-- penjaga itu tanpa alasan.
-- =====================================================================

create or replace function simpan_susunan_tampilan(
  p_permukaan permukaan_tampilan,
  p_item jsonb
)
returns setof preferensi_tampilan
language plpgsql
as $$
declare
  pemilik uuid := auth.uid();
begin
  if pemilik is null then
    raise exception 'Tidak ada sesi; susunan tidak bisa disimpan'
      using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_item) is distinct from 'array' then
    raise exception 'Daftar item harus berupa array JSON'
      using errcode = 'check_violation';
  end if;

  delete from preferensi_tampilan
   where pengguna_id = pemilik and permukaan = p_permukaan;

  return query
  insert into preferensi_tampilan
    (pengguna_id, permukaan, kunci_item, tampil, urutan)
  select
    pemilik,
    p_permukaan,
    baris.value ->> 'kunci',
    coalesce((baris.value ->> 'tampil')::boolean, true),
    (baris.urutan - 1)::int
  from jsonb_array_elements(p_item) with ordinality as baris(value, urutan)
  returning *;
end;
$$;

comment on function simpan_susunan_tampilan(permukaan_tampilan, jsonb) is
  'Mengganti seluruh susunan satu permukaan milik pemanggil, dalam satu transaksi.';
