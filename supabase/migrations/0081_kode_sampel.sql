-- =====================================================================
-- K-Space V2 — Kode sampel dibangkitkan, bukan diketik
--
-- Kode sampel adalah isi stikernya: begitu tercetak dan tertempel, ia
-- tidak bisa dikoreksi tanpa mencetak ulang. Selama ini kode diketik
-- tangan, dengan dua akibat yang baru terasa belakangan:
--
--   * kode kembar ditolak indeks unik — tetapi baru setelah stikernya
--     terlanjur dicetak;
--   * penomorannya melompat-lompat, sehingga stok tidak bisa ditelusuri
--     berurutan dan kode yang hilang tidak kelihatan.
--
-- Fungsi ini membangkitkan nomor berikutnya sekaligus menyisipkan
-- barisnya dalam satu langkah, lalu mencoba lagi bila ada yang
-- mendahului. Dengan begitu dua orang yang menambah sampel pada saat
-- yang sama tidak pernah mendapat kode yang sama.
-- =====================================================================

create or replace function kode_sampel_berikutnya(p_awalan text default 'SMP')
returns text
language sql
stable
as $$
  select p_awalan || '-' || lpad((coalesce(max(
    nullif(regexp_replace(kode, '^' || p_awalan || '-', '', 'i'), '')::int
  ), 0) + 1)::text, 4, '0')
  from samples
  where kode ~* ('^' || p_awalan || '-[0-9]+$');
$$;

comment on function kode_sampel_berikutnya(text) is
  'Kode urut berikutnya untuk sebuah awalan, mis. SMP-0011.';

create or replace function buat_sampel(
  p_nama text,
  p_unit uuid,
  p_kategori text default '',
  p_nilai numeric default 0,
  p_catatan text default '',
  p_awalan text default 'SMP'
)
returns samples
language plpgsql
as $$
declare
  sampel samples;
begin
  if p_awalan !~ '^[A-Za-z][A-Za-z0-9]{1,9}$' then
    raise exception 'Awalan kode hanya huruf dan angka, 2–10 karakter'
      using errcode = 'check_violation';
  end if;

  -- Beberapa percobaan: yang kalah cepat mengambil nomor berikutnya,
  -- bukan gagal dengan galat kunci ganda yang tidak berarti apa-apa.
  for i in 1..5 loop
    begin
      insert into samples (kode, nama, kategori, unit_id, nilai, catatan)
      values (
        kode_sampel_berikutnya(p_awalan),
        p_nama, p_kategori, p_unit, p_nilai, p_catatan
      )
      returning * into sampel;

      return sampel;
    exception when unique_violation then
      -- coba lagi dengan nomor terbaru
    end;
  end loop;

  raise exception 'Gagal membangkitkan kode sampel yang unik; coba lagi';
end;
$$;

comment on function buat_sampel(text, uuid, text, numeric, text, text) is
  'Menambah sampel dengan kode urut yang dibangkitkan; aman dari tabrakan.';
