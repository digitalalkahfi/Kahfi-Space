/**
 * Laporan harian memuat GMV KEMARIN (H-1), migrasi 0207.
 *
 * GMV dihitung satu hari penuh, jadi laporan yang dikirim hari ini
 * disimpan bertanggal kemarin. Yang dijaga di sini adalah hal-hal yang
 * bergantung pada "kapan laporan dikirim": penjaga tanggal, kunci Absen
 * Pulang, unggahan di Status Tim, dan kepatuhan minimum. Semua tanggal
 * dihitung relatif terhadap hari ini (WIB) karena aturannya memang
 * menyangkut hari ini.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  pesanDb,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Laporan harian = GMV kemarin (H-1)");

const satu = async (sql, p = []) => (await sebagaiAdmin(db, sql, p)).rows[0];
const idUser = async (n) =>
  (await satu(`select id from users where nama=$1`, [n])).id;
const idAkun = async (u) =>
  (await satu(`select id from accounts where username=$1`, [u])).id;

/** Tanggal WIB relatif terhadap hari ini, "YYYY-MM-DD". */
const tgl = async (selisih) =>
  (
    await satu(
      `select ((now() at time zone 'Asia/Jakarta')::date + $1::int)::text as d`,
      [selisih],
    )
  ).d;

/** Ditolak, dan pesannya memuat pola yang diharapkan. */
async function ditolakDengan(fn, pola, pesan) {
  try {
    await fn();
  } catch (e) {
    harus(pola.test(pesanDb(e)), `${pesan}: pesan tidak sesuai → ${pesanDb(e)}`);
    return;
  }
  throw new Error(`${pesan}: seharusnya ditolak, tapi berhasil`);
}

const NABILA = await idUser("Nabila Putri"); // PIC, wajib lapor
const AKUN = await idAkun("@fashion_hijab");

const HARI_INI = await tgl(0);
const KEMARIN = await tgl(-1);
const KEMARIN_LUSA = await tgl(-2);

uji("tanggal_data_terakhir() adalah kemarin (WIB)", async () => {
  const { d } = await satu(`select tanggal_data_terakhir()::text as d`);
  harusSama(d, KEMARIN, "tanggal data terakhir");
});

uji("laporan bertanggal hari ini ditolak, bertanggal kemarin diterima", async () => {
  await ditolakDengan(
    () =>
      sebagai(
        db,
        NABILA,
        `insert into daily_reports (user_id, tanggal, account_id, gmv)
         values ($1,$2,$3,5000000)`,
        [NABILA, HARI_INI, AKUN],
      ),
    /satu hari penuh/,
    "laporan hari ini",
  );

  await sebagai(
    db,
    NABILA,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, jumlah_upload)
     values ($1,$2,$3,5000000,7)`,
    [NABILA, KEMARIN, AKUN],
  );
  const { n } = await satu(
    `select count(*)::int n from daily_reports
     where account_id=$1 and tanggal=$2`,
    [AKUN, KEMARIN],
  );
  harusSama(n, 1, "laporan kemarin tersimpan");
});

uji("masa depan tetap ditolak", async () => {
  const lusa = await tgl(3);
  await ditolakDengan(
    () =>
      sebagai(
        db,
        NABILA,
        `insert into daily_reports (user_id, tanggal, account_id, gmv)
         values ($1,$2,$3,5000000)`,
        [NABILA, lusa, AKUN],
      ),
    /satu hari penuh/,
    "laporan masa depan",
  );
});

uji("memindahkan laporan ke hari ini juga ditolak", async () => {
  await ditolakDengan(
    () =>
      sebagai(
        db,
        NABILA,
        `update daily_reports set tanggal=$2
         where account_id=$1 and tanggal=$3`,
        [AKUN, HARI_INI, KEMARIN],
      ),
    /satu hari penuh/,
    "memindahkan tanggal ke hari ini",
  );
});

uji("memperbaiki angka laporan lama tidak terhalang aturan tanggal", async () => {
  // Laporan 5–6 Okt dikirim sebelum aturan ini; pelapor memperbaikinya
  // lewat `perbaiki_laporan_harian`, yang tidak menyentuh kolom tanggal.
  const { id } = await satu(
    `select id from daily_reports where account_id=$1 and tanggal=$2`,
    [AKUN, KEMARIN],
  );
  await sebagai(
    db,
    NABILA,
    `select perbaiki_laporan_harian($1, 6200000, $2, null, null, 7)`,
    [id, "GMV hari penuh dari Partner Center"],
  );
  const { gmv } = await satu(`select gmv from daily_reports where id=$1`, [id]);
  harusSama(Number(gmv), 6200000, "angka hasil perbaikan");
});

uji("seed dan skrip migrasi tetap boleh menulis tanggal apa pun", async () => {
  // Tanpa auth.uid() penjaga tidak berlaku (seed, migrasi V1).
  const akunLain = await idAkun("@skincare_official");
  const r = await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv)
     values ($1,$2,$3,1000000) returning tanggal::text`,
    [NABILA, HARI_INI, akunLain],
  );
  harusSama(r.rows[0].tanggal, HARI_INI, "tanggal hari ini lewat jalur sistem");
});

uji("sudah_lapor_harian: laporan kemarin menjadi laporan yang jatuh tempo hari ini", async () => {
  const hariIni = await satu(`select sudah_lapor_harian($1,$2) as ok`, [
    NABILA,
    HARI_INI,
  ]);
  harus(hariIni.ok === true, "laporan bertanggal kemarin memenuhi tagihan hari ini");

  const kemarin = await satu(`select sudah_lapor_harian($1,$2) as ok`, [
    NABILA,
    KEMARIN,
  ]);
  harus(
    kemarin.ok === false,
    "laporan kemarin tidak memenuhi tagihan kemarin (yang ditagih kemarin adalah laporan kemarin lusa)",
  );
  harus(KEMARIN_LUSA < KEMARIN, "urutan tanggal uji");
});

uji("absen pulang hari ini terbuka oleh laporan bertanggal kemarin", async () => {
  await sebagaiAdmin(
    db,
    `insert into attendance (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk)
     values ($1, $2, ($2::date + time '07:50') at time zone 'Asia/Jakarta',
             -6.260700, 106.810600)`,
    [NABILA, HARI_INI],
  );
  await sebagai(
    db,
    NABILA,
    `update attendance set jam_pulang = ($2::date + time '17:40')
       at time zone 'Asia/Jakarta'
     where user_id=$1 and tanggal=$2`,
    [NABILA, HARI_INI],
  );
  const { jam_pulang } = await satu(
    `select jam_pulang from attendance where user_id=$1 and tanggal=$2`,
    [NABILA, HARI_INI],
  );
  harus(jam_pulang, "jam pulang tersimpan");
});

uji("status tim: unggahan yang tampil adalah milik kemarin", async () => {
  const hariIni = await satu(
    `select unggahan_hari_ini from status_tim_harian($1) where user_id=$2`,
    [HARI_INI, NABILA],
  );
  harusSama(hariIni.unggahan_hari_ini, 7, "unggahan laporan kemarin");

  const kemarin = await satu(
    `select unggahan_hari_ini from status_tim_harian($1) where user_id=$2`,
    [KEMARIN, NABILA],
  );
  harusSama(
    kemarin.unggahan_hari_ini,
    null,
    "yang ditagih kemarin adalah laporan kemarin lusa — belum ada",
  );
});

uji("kepatuhan minimum tidak menilai hari ini (belum bisa dilaporkan)", async () => {
  for (const t of [KEMARIN_LUSA, KEMARIN]) {
    await sebagaiAdmin(
      db,
      `insert into attendance (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk)
       values ($1, $2, ($2::date + time '08:00') at time zone 'Asia/Jakarta',
               -6.260700, 106.810600)
       on conflict (user_id, tanggal) do nothing`,
      [NABILA, t],
    );
  }
  const r = await satu(
    `select hari_kerja from kepatuhan_minimum_akun($1, $2, $3)`,
    [AKUN, await tgl(-3), HARI_INI],
  );
  // Absen ada di kemarin lusa, kemarin, dan hari ini; hari ini tidak dinilai.
  harusSama(r.hari_kerja, 2, "hari kerja yang dinilai");
});

uji("KPI laporan tepat waktu: tenggatnya pukul batas pada hari SESUDAH tanggal laporan", async () => {
  const ANISA = await idUser("Anisa Larasati"); // tanpa laporan di seed
  const BULAN = "2024-11-01";
  const lembar = await satu(
    `insert into kpi_lembar (user_id, periode_bulan, judul, status, asal)
     values ($1, $2, 'uji H-1', 'draft', 'uji-h1') returning id`,
    [ANISA, BULAN],
  );
  const ind = await satu(
    `insert into kpi_indikator
       (lembar_id, urutan, nama, bobot, tangga, sumber, sumber_ref)
     values ($1, 1, 'Laporan tepat waktu', 10,
             '{10,20,30,40,50,60,70,80,90,100}'::numeric[],
             'laporan_tepat', '{"batas":"18:00"}'::jsonb) returning id`,
    [lembar.id],
  );

  // tanggal laporan | dikirim (WIB)
  //   4 Nov  dikirim 5 Nov 09:00  → tepat (sebelum 18:00 hari sesudahnya)
  //   5 Nov  dikirim 6 Nov 20:00  → terlambat
  //   6 Nov  dikirim 6 Nov 15:00  → tepat (cara lama, sebelum batas hari itu juga)
  //   7 Nov  tidak ada            → tidak tepat
  const lapor = async (tanggal, dikirim) =>
    sebagaiAdmin(
      db,
      `insert into daily_reports (user_id, tanggal, account_id, gmv, submitted_at)
       values ($1, $2, $3, 1000000, ($4::timestamp at time zone 'Asia/Jakarta'))`,
      [ANISA, tanggal, AKUN, dikirim],
    );
  // Satu akun: tanggal-tanggal berbeda, jadi tidak bentrok dengan indeks unik.
  await sebagaiAdmin(
    db,
    `delete from daily_reports where account_id=$1 and tanggal between '2024-11-01' and '2024-11-07'`,
    [AKUN],
  );
  await lapor("2024-11-04", "2024-11-05 09:00");
  await lapor("2024-11-05", "2024-11-06 20:00");
  await lapor("2024-11-06", "2024-11-06 15:00");

  const { p } = await satu(`select pencapaian_otomatis($1, '2024-11-07') as p`, [
    ind.id,
  ]);
  // 7 hari (1–7 Nov), 2 laporan tepat waktu.
  harus(
    Math.abs(Number(p) - (2 / 7) * 100) < 0.0001,
    `pencapaian laporan tepat = ${p}, seharusnya ${(2 / 7) * 100}`,
  );
});

uji("penguncian menunggu GMV hari terakhir dilaporkan", async () => {
  const MANAGER = await idUser("Farhan Pratama");

  // KPI bulan lalu tuntas mulai tanggal 2 bulan ini: GMV hari terakhir
  // bulan itu baru dilaporkan tanggal 1 (0207).
  const t = await satu(
    `select (select bulan_tuntas
               from status_kunci_kpi(
                 (date_trunc('month', current_date) - interval '1 month')::date))
              as tuntas,
            extract(day from current_date) >= 2 as seharusnya`,
  );
  harusSama(t.tuntas, t.seharusnya, "bulan_tuntas bulan lalu");

  // Pekan yang hari terakhirnya sudah dilaporkan bisa dibentuk.
  const pekan = (
    await satu(
      `select awal_pekan((now() at time zone 'Asia/Jakarta')::date - 8)::text as p`,
    )
  ).p;
  const r = await sebagai(
    db,
    MANAGER,
    `select buat_laporan_mingguan($1::date) as n`,
    [pekan],
  );
  harus(r.rows[0].n >= 0, "laporan mingguan pekan lengkap terbentuk");
});

uji("fungsi prorata berjalan tanpa galat dengan hari ini sebagai acuan", async () => {
  // Acuan "hari ini" dipotong ke kemarin di dalam fungsi; pada hari Senin
  // atau tanggal 1, potongannya jatuh sebelum awal pekan/bulan dan tidak
  // boleh menimbulkan galat atau pembagian nol.
  await satu(`select * from status_wrm((now() at time zone 'Asia/Jakarta')::date)`);
  await satu(
    `select * from hitung_laporan_mingguan(
       awal_pekan((now() at time zone 'Asia/Jakarta')::date),
       (now() at time zone 'Asia/Jakarta')::date)`,
  );
  await satu(
    `select * from persen_ukuran(
       date_trunc('month', current_date)::date, '{}'::uuid[], current_date)`,
  );
  await satu(
    `select realisasi_gmv_kpi($1, date_trunc('month', current_date)::date, current_date)`,
    [NABILA],
  );
});

await jalankan();
