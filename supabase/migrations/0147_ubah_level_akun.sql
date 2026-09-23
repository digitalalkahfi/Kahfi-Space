-- =====================================================================
-- K-Space V2 — Mengubah level akun beserta alasannya
--
-- Triggernya sudah membaca `app.alasan_level` (migrasi 0137), tapi tidak
-- ada satu pun jalan resmi untuk mengisinya: pemanggil harus menyetel
-- GUC lalu meng-update dalam transaksi yang sama, dan jalan seperti itu
-- selalu berakhir dengan seseorang lupa menyetelnya.
--
-- Fungsi ini menutup celah itu — satu panggilan, satu transaksi, alasan
-- selalu ikut. Alasan wajib sepanjang minimal 10 karakter: "naik" bukan
-- penjelasan, dan jejak yang tidak menjelaskan apa-apa sama saja dengan
-- tidak ada jejak.
--
-- Bukan `security definer`: haknya tetap hak pemanggil, jadi RLS
-- `accounts` yang menentukan siapa boleh mengubah level akun mana.
-- =====================================================================

create or replace function ubah_level_akun(
  p_account_id uuid,
  p_level smallint,
  p_alasan text
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_lama smallint;
begin
  select level into v_lama from accounts where id = p_account_id;
  if not found then
    raise exception 'Akun tidak ditemukan';
  end if;

  if v_lama is not distinct from p_level then
    raise exception 'Level akun tidak berubah';
  end if;

  if btrim(coalesce(p_alasan, '')) = '' or length(btrim(p_alasan)) < 10 then
    raise exception 'Alasan perubahan level minimal 10 karakter';
  end if;

  -- `true` = lokal transaksi ini saja; nilai ini tidak boleh bocor ke
  -- perubahan level berikutnya pada koneksi yang sama.
  perform set_config('app.alasan_level', btrim(p_alasan), true);
  update accounts set level = p_level where id = p_account_id;
end;
$$;

comment on function ubah_level_akun(uuid, smallint, text) is
  'Mengubah level akun beserta alasannya; jejaknya ditulis trigger catat_level_akun.';
