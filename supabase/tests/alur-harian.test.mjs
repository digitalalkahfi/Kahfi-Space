/**
 * Alur harian satu staf dari pagi sampai sore (PRD §4).
 * Menguji rantainya, bukan potongannya: absen masuk → kerja → lapor GMV →
 * absen pulang terbuka → angkanya muncul di dasbor Manager.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Alur harian staf");

const HARI = "2024-10-28"; // hari kerja baru, belum ada data
const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;

const RIAN = await idUser("Rian Hidayat");
const MANAGER = await idUser("Farhan Pratama");
const AKUN = (
  await sebagaiAdmin(
    db,
    `select id from accounts where username='@skincare_official'`,
  )
).rows[0].id;

uji("pagi: absen masuk dengan lokasi di dalam radius", async () => {
  await sebagai(
    db,
    RIAN,
    `insert into attendance (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk)
     values ($1, $2, ($2::date + time '07:45') at time zone 'Asia/Jakarta',
             -6.260750, 106.810650)`,
    [RIAN, HARI],
  );

  const { rows } = await sebagaiAdmin(
    db,
    `select status, lokasi_valid, terlambat from attendance
     where user_id=$1 and tanggal=$2`,
    [RIAN, HARI],
  );
  harusSama(rows[0].status, "hadir");
  harusSama(rows[0].lokasi_valid, true);
  harusSama(rows[0].terlambat, false);
});

uji("sore: absen pulang MASIH terkunci sebelum lapor", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        RIAN,
        `update attendance set jam_pulang = now()
         where user_id=$1 and tanggal=$2`,
        [RIAN, HARI],
      ),
    "kunci absen pulang tidak bekerja",
  );
});

uji("sore: kirim laporan harian GMV", async () => {
  await sebagai(
    db,
    RIAN,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, catatan)
     values ($1, $2, $3, 5120000, 'Live 3 jam, bundling serum laku.')`,
    [RIAN, HARI, AKUN],
  );
});

uji("absen pulang TERBUKA setelah laporan masuk", async () => {
  await sebagai(
    db,
    RIAN,
    `update attendance set jam_pulang = ($2::date + time '17:30')
       at time zone 'Asia/Jakarta'
     where user_id=$1 and tanggal=$2`,
    [RIAN, HARI],
  );
  const { rows } = await sebagaiAdmin(
    db,
    `select jam_pulang from attendance where user_id=$1 and tanggal=$2`,
    [RIAN, HARI],
  );
  harus(rows[0].jam_pulang, "jam pulang harus tersimpan");
});

uji("GMV-nya langsung terhitung di dasbor Manager", async () => {
  const { rows } = await sebagai(
    db,
    MANAGER,
    `select kode, gmv_hari_ini from ringkasan_gmv_unit($1::date)`,
    [HARI],
  );
  const aff = rows.find((r) => r.kode === "affiliator");
  harusSama(
    Number(aff.gmv_hari_ini),
    5120000,
    "GMV laporan harus muncul di agregat unit",
  );
});

uji("Manager melihat siapa yang sudah lapor hari itu", async () => {
  const { rows } = await sebagai(
    db,
    MANAGER,
    `select nama, sudah_lapor, wajib_lapor from status_tim_harian($1::date)`,
    [HARI],
  );
  const rian = rows.find((r) => r.nama === "Rian Hidayat");
  harusSama(rian.sudah_lapor, true);

  const belum = rows.filter((r) => r.wajib_lapor && !r.sudah_lapor);
  harus(belum.length > 0, "sasaran lain belum lapor pada hari baru ini");
});

uji("laporan kedua untuk akun yang sama ditolak", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        RIAN,
        `insert into daily_reports (user_id, tanggal, account_id, gmv)
         values ($1, $2, $3, 999000)`,
        [RIAN, HARI, AKUN],
      ),
    "satu sasaran hanya boleh satu laporan per hari",
  );
});

uji("perbaikan angka meninggalkan jejak, bukan menimpa diam-diam", async () => {
  const id = (
    await sebagaiAdmin(
      db,
      `select id from daily_reports where account_id=$1 and tanggal=$2`,
      [AKUN, HARI],
    )
  ).rows[0].id;

  await sebagai(
    db,
    RIAN,
    `select perbaiki_laporan_harian($1, 5400000,
       'Dua pesanan masuk setelah input pertama.')`,
    [id],
  );

  const { rows } = await sebagaiAdmin(
    db,
    `select gmv_lama, gmv_baru from daily_report_revisions where report_id=$1`,
    [id],
  );
  harusSama(rows.length, 1);
  harusSama(Number(rows[0].gmv_lama), 5120000);
  harusSama(Number(rows[0].gmv_baru), 5400000);
});

uji("dasbor ikut menyesuaikan setelah perbaikan", async () => {
  const { rows } = await sebagai(
    db,
    MANAGER,
    `select gmv_hari_ini from ringkasan_gmv_unit($1::date) where kode='affiliator'`,
    [HARI],
  );
  harusSama(Number(rows[0].gmv_hari_ini), 5400000);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
