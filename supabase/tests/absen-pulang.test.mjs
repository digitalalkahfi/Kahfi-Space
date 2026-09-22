/** Kunci absen pulang: kapan terkunci, kapan terbuka, dan batas wajarnya. */
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
const { uji, jalankan } = buatSuite("Absen pulang & kuncinya");

const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;
const idAkun = async (u) =>
  (await sebagaiAdmin(db, `select id from accounts where username=$1`, [u]))
    .rows[0].id;

const NABILA = await idUser("Nabila Putri"); // PIC, wajib lapor
const ANISA = await idUser("Anisa Larasati"); // tidak wajib lapor
const AKUN = await idAkun("@fashion_hijab");
const HARI = "2024-11-25";

uji("absen pulang tanpa absen masuk tidak mengubah apa pun", async () => {
  const r = await sebagai(
    db,
    ANISA,
    `update attendance set jam_pulang = now()
     where user_id=$1 and tanggal=$2`,
    [ANISA, HARI],
  );
  harusSama(r.affectedRows ?? 0, 0, "tidak ada baris yang cocok");
});

uji("yang wajib lapor: pulang terkunci sebelum laporan", async () => {
  await sebagai(
    db,
    NABILA,
    `insert into attendance (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk)
     values ($1, $2, ($2::date + time '07:50') at time zone 'Asia/Jakarta',
             -6.260700, 106.810600)`,
    [NABILA, HARI],
  );

  await harusDitolak(
    () =>
      sebagai(
        db,
        NABILA,
        `update attendance set jam_pulang = now()
         where user_id=$1 and tanggal=$2`,
        [NABILA, HARI],
      ),
    "kunci absen pulang tidak bekerja",
  );
});

uji("pulang terbuka setelah laporan hari itu masuk", async () => {
  await sebagai(
    db,
    NABILA,
    `insert into daily_reports (user_id, tanggal, account_id, gmv)
     values ($1, $2, $3, 3250000)`,
    [NABILA, HARI, AKUN],
  );

  await sebagai(
    db,
    NABILA,
    `update attendance set jam_pulang = ($2::date + time '17:40')
       at time zone 'Asia/Jakarta'
     where user_id=$1 and tanggal=$2`,
    [NABILA, HARI],
  );

  const { rows } = await sebagaiAdmin(
    db,
    `select jam_pulang from attendance where user_id=$1 and tanggal=$2`,
    [NABILA, HARI],
  );
  harus(rows[0].jam_pulang, "jam pulang harus tersimpan");
});

uji("laporan hari LAIN tidak membuka kunci", async () => {
  const besok = "2024-11-26";
  await sebagai(
    db,
    NABILA,
    `insert into attendance (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk)
     values ($1, $2, ($2::date + time '07:55') at time zone 'Asia/Jakarta',
             -6.260700, 106.810600)`,
    [NABILA, besok],
  );

  await harusDitolak(
    () =>
      sebagai(
        db,
        NABILA,
        `update attendance set jam_pulang = now()
         where user_id=$1 and tanggal=$2`,
        [NABILA, besok],
      ),
    "laporan kemarin seharusnya tidak membuka kunci hari ini",
  );
});

uji("jam pulang tidak boleh mendahului jam masuk", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `update attendance
           set jam_pulang = ($2::date + time '05:00') at time zone 'Asia/Jakarta'
         where user_id=$1 and tanggal=$2`,
        [NABILA, HARI],
      ),
    "constraint attendance_pulang_setelah_masuk tidak bekerja",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
