-- =====================================================================
-- K-Space V2 — Identitas produk pada sampel (PRD Fase 2)
--
-- Sampel selama ini hanya tahu dirinya sebagai barang: nama, kategori,
-- nilai, dan di tangan siapa. Yang hilang adalah produk yang diwakilinya
-- — brand/seller-nya, dan etalase tempat produk itu dijual.
--
-- Tautan etalase sengaja disimpan di kolomnya sendiri, bukan ikut ke
-- dalam kode QR: stiker menempel pada barang selama bertahun-tahun,
-- sedangkan link produk berpindah jauh lebih sering. Memasukkannya ke
-- QR berarti mencetak ulang stiker setiap kali tokonya pindah.
-- =====================================================================

alter table samples
  add column brand text not null default '',
  add column link_produk text;

comment on column samples.brand is
  'Brand atau seller pemilik produk; kosong bila belum diketahui.';
comment on column samples.link_produk is
  'Tautan etalase produk (TikTok Shop/Shopee); bisa diganti tanpa mencetak ulang QR.';

-- Hanya http(s) yang diterima: `javascript:` dan `data:` pada kolom yang
-- berakhir di atribut href adalah jalan masuk skrip asing.
alter table samples
  add constraint sampel_tautan_produk_sah check (
    link_produk is null
    or link_produk ~* '^https?://[^\s]+$'
  );
