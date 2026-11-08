-- =====================================================================
-- K-Space V2 — KPI "laporan tepat waktu" dinilai per sasaran
--
-- Indikator ini hanya mencari laporan dengan user_id = pemilik lembar.
-- Padahal satu akun hanya boleh punya satu laporan per tanggal, dan Manager,
-- CEO, serta co-leader boleh mengirimnya. Begitu mereka melapor, PIC tidak
-- bisa lagi mengirim apa pun dan harinya tercatat tidak melapor tanpa jalan
-- keluar. Akar masalahnya sama dengan kunci pulang (0214).
--
-- Keputusan pemilik (6 Nov 2026): laporan dinilai per sasaran. Sebuah hari
-- dihitung tepat bila ada laporan sebelum tenggat yang dikirim orang itu
-- sendiri, untuk akun yang PIC-nya orang itu, atau untuk unit yang ia pimpin
-- sebagai Leader. Tenggatnya dibaca dari `submitted_at` laporan itu, siapa pun
-- pengirimnya: laporan orang lain yang lewat tenggat tetap terlambat.
--
-- Sengaja berbeda dari kunci pulang (0214):
--   - Satu laporan cukup, walau PIC memegang beberapa akun dan laporan itu
--     kiriman orang lain. 0214 menahan kunci sampai semua akun terlapor supaya
--     tagihan akun berikutnya tidak hilang dari layar; KPI tidak menagih apa
--     pun, dan laporan sendiri pun cukup satu sejak 0194.
--   - Harus ada laporan nyata. "Tidak ada lagi yang bisa dilapor" membuka
--     kunci, tetapi tidak menghasilkan nilai.
--   - Status akun dan "unit tanpa akun" tidak diperiksa. Keduanya keadaan hari
--     ini, sedangkan nilai hari lampau tidak boleh hilang saat akun
--     dinonaktifkan atau unit mendapat akun pertamanya. Aplikasi hanya
--     menawarkan laporan unit untuk unit tanpa akun aktif
--     (`sasaran_laporan_saya`).
--
-- Sama dengan 0214: akun dibaca dari PIC saat ini karena riwayat PIC tidak
-- tersimpan, jadi PIC baru ikut menerima hari sebelum serah terima. Pengirim
-- lama tidak kehilangan nilai.
--
-- Dampak: persentase tidak pernah turun, karena syarat lama tetap berlaku.
-- Bulan yang belum dikunci langsung terhitung ulang; bulan yang sudah dikunci
-- tidak berubah karena scorecard membaca `kpi_snapshots`.
--
-- Isi fungsi sama dengan definisi 0207; yang berubah hanya cabang
-- `laporan_tepat`.
-- =====================================================================

create or replace function pencapaian_otomatis(p_indikator uuid, p_sampai date)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ind kpi_indikator;
  v_bulan date;
  v_pemilik uuid;
  ref jsonb;
  akhir_bulan date;
  d_awal date;
  d_akhir date;
  n_hari integer;
  v_akun uuid[];
  hasil numeric;
  r record;
  tgl date;
begin
  select * into ind from kpi_indikator where id = p_indikator;
  if ind.id is null or ind.sumber = 'manual' then
    return null;
  end if;

  select l.periode_bulan, l.user_id into v_bulan, v_pemilik
  from kpi_lembar l where l.id = ind.lembar_id;

  ref := ind.sumber_ref;
  akhir_bulan := (v_bulan + interval '1 month - 1 day')::date;
  d_awal := greatest(v_bulan, coalesce((ref ->> 'mulai')::date, v_bulan));
  d_akhir := hari_terakhir_lengkap(v_bulan, p_sampai);
  n_hari := d_akhir - d_awal + 1;

  case ind.sumber

  -- -------------------------------------------------------------------
  when 'ukuran_persen' then
    return (
      select p.persen
      from persen_ukuran(
        v_bulan,
        array(
          select u.id from grd_ukuran u
          where u.grd_periode = v_bulan
            and u.kode in (select jsonb_array_elements_text(ref -> 'ukuran'))
        ),
        p_sampai
      ) p
    );

  -- -------------------------------------------------------------------
  when 'ukuran_nilai' then
    select u.id, g.tenggat into r
    from grd_ukuran u
    left join goals g on g.id = u.goal_id
    where u.grd_periode = v_bulan and u.kode = ref ->> 'ukuran';
    if r.id is null then
      return null;
    end if;
    -- "Dinilai 4 Nov": angka pada tenggat goal, walau melewati akhir bulan.
    tgl := case when p_sampai >= akhir_bulan
                then coalesce(r.tenggat, akhir_bulan)
                else least(p_sampai, coalesce(r.tenggat, akhir_bulan)) end;
    return realisasi_ukuran(r.id, tgl);

  -- -------------------------------------------------------------------
  when 'tonggak' then
    return tonggak_tepat_waktu(
      v_bulan,
      array(select jsonb_array_elements_text(ref -> 'rencana')),
      least(p_sampai, akhir_bulan)
    );

  -- -------------------------------------------------------------------
  when 'upload_rata' then
    v_akun := uuid_dari_json(ref -> 'akun');
    if n_hari <= 0 or cardinality(v_akun) = 0 then
      return null;
    end if;
    select coalesce(sum(r2.jumlah_upload), 0) into hasil
    from daily_reports r2
    where r2.account_id = any (v_akun)
      and r2.tanggal between d_awal and d_akhir;
    return hasil / n_hari;

  -- -------------------------------------------------------------------
  when 'hari_standar' then
    if n_hari <= 0 or jsonb_array_length(coalesce(ref -> 'akun', '[]')) = 0 then
      return null;
    end if;
    select count(*) filter (where lolos)::numeric / count(*) * 100 into hasil
    from (
      select bool_and(coalesce(h.upload, 0) >= (a ->> 'min')::numeric) as lolos
      from generate_series(d_awal, d_akhir, interval '1 day') d(hari)
      cross join jsonb_array_elements(ref -> 'akun') a
      left join lateral (
        select sum(r2.jumlah_upload) as upload
        from daily_reports r2
        where r2.account_id = (a ->> 'id')::uuid
          and r2.tanggal = d.hari::date
      ) h on true
      group by d.hari
    ) x;
    return hasil;

  -- -------------------------------------------------------------------
  when 'hari_live' then
    v_akun := uuid_dari_json(ref -> 'akun');
    if n_hari <= 0 or cardinality(v_akun) = 0 then
      return null;
    end if;
    select count(*) filter (where lolos)::numeric / count(*) * 100 into hasil
    from (
      select bool_and(coalesce(h.jam, 0) >= coalesce((ref ->> 'jam')::numeric, 0)) as lolos
      from generate_series(d_awal, d_akhir, interval '1 day') d(hari)
      cross join unnest(v_akun) a(id)
      left join lateral (
        select sum(r2.jam_live) as jam
        from daily_reports r2
        where r2.account_id = a.id and r2.tanggal = d.hari::date
      ) h on true
      group by d.hari
    ) x;
    return hasil;

  -- -------------------------------------------------------------------
  when 'laporan_tepat' then
    -- H-1: laporan bertanggal X dikirim paling lambat pukul `batas`
    -- pada X + 1. Hari yang tenggatnya belum lewat belum dinilai.
    d_akhir := least(d_akhir, tanggal_data_terakhir() - 1);
    n_hari := d_akhir - d_awal + 1;
    if n_hari <= 0 then
      return null;
    end if;
    select count(*) filter (where exists (
             select 1 from daily_reports r2
             left join accounts ak on ak.id = r2.account_id
             where r2.tanggal = d.hari::date
               -- Per sasaran: pengirimnya, PIC akunnya, atau Leader unitnya.
               and (r2.user_id = v_pemilik
                    or ak.pic_user_id = v_pemilik
                    or exists (
                      select 1 from users u
                      where u.id = v_pemilik
                        and u.role = 'Leader'
                        and u.unit_id = r2.unit_id
                    ))
               and (ref ->> 'batas' is null
                    or r2.submitted_at
                       <= ((d.hari::date + 1 + (ref ->> 'batas')::time)
                           at time zone 'Asia/Jakarta'))
           ))::numeric / count(*) * 100
      into hasil
    from generate_series(d_awal, d_akhir, interval '1 day') d(hari);
    return hasil;

  -- -------------------------------------------------------------------
  when 'lead_rata', 'lead_jumlah' then
    select min(coalesce(lm.mulai, v_bulan)), max(coalesce(lm.selesai, akhir_bulan))
      into d_awal, tgl
    from lead_measures lm
    join goals g on g.id = lm.goal_id
    where g.grd_periode = v_bulan
      and lm.kode in (select jsonb_array_elements_text(ref -> 'lead'));
    if d_awal is null then
      return null;
    end if;
    d_awal := greatest(d_awal, v_bulan);
    d_akhir := least(d_akhir, tgl);
    n_hari := d_akhir - d_awal + 1;
    if n_hari <= 0 then
      return null;
    end if;
    select coalesce(sum(e.nilai), 0) into hasil
    from lead_measure_entries e
    join lead_measures lm on lm.id = e.lead_measure_id
    join goals g on g.id = lm.goal_id
    where g.grd_periode = v_bulan
      and lm.kode in (select jsonb_array_elements_text(ref -> 'lead'))
      and e.tanggal between d_awal and d_akhir;
    return case when ind.sumber = 'lead_rata' then hasil / n_hari else hasil end;

  else
    return null;
  end case;
end;
$$;

-- Rollback (manual): kembalikan pencapaian_otomatis ke definisi 0207.
