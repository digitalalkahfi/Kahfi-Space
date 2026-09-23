-- =====================================================================
-- K-Space V2 — Medan apa saja yang benar-benar ada di ekspor lama
--
-- Layar pemetaan harus bisa menjawab satu pertanyaan: adakah medan di
-- data lama yang tidak disebut pemetaan sama sekali? Medan yang
-- terlewat tidak menimbulkan galat apa pun — ia hanya tidak ikut pindah,
-- dan baru ketahuan berbulan-bulan kemudian saat datanya dicari.
--
-- Pemeriksaannya dikerjakan di sini, bukan di aplikasi, karena satu
-- kunci ekspor bisa berisi belasan megabita: menariknya ke aplikasi
-- hanya untuk membaca nama medannya berarti memindahkan seluruh data
-- lama lewat jaringan setiap kali halaman dibuka.
-- =====================================================================

create or replace function medan_kunci_lama(p_contoh integer default 200)
returns table (kunci text, medan text[])
language plpgsql
stable
as $$
declare
  r record;
  m text[];
begin
  for r in select k.key, k.value from kv_store_lama k loop
    if jsonb_typeof(r.value) = 'array' then
      -- Cukup sebagian entri: ekspor lama memuat ribuan baris dengan
      -- bentuk yang sama, dan memindai semuanya tidak menambah satu
      -- nama medan pun. Entri menyimpang tetap tertangkap selama ia
      -- muncul di antara yang pertama.
      select coalesce(array_agg(distinct nama order by nama), '{}')
        into m
        from (
          select el
          from jsonb_array_elements(r.value) as t(el)
          where jsonb_typeof(el) = 'object'
          limit p_contoh
        ) s,
        lateral jsonb_object_keys(s.el) as nama;
    elsif jsonb_typeof(r.value) = 'object' then
      -- Kunci seperti attendance:config berisi satu objek pengaturan.
      select coalesce(array_agg(distinct nama order by nama), '{}')
        into m
        from jsonb_object_keys(r.value) as nama;
    else
      m := '{}';
    end if;

    kunci := r.key;
    medan := m;
    return next;
  end loop;
end;
$$;

comment on function medan_kunci_lama(integer) is
  'Nama medan yang benar-benar muncul di tiap kunci ekspor lama; dipakai layar pemetaan.';
