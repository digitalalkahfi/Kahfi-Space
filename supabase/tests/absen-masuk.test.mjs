/**
 * Perhitungan status absen masuk oleh database: tepat waktu, terlambat,
 * dan validitas lokasi terhadap radius kantor.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Absen masuk & status terlambat");

const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;

const ANISA = await idUser("Anisa Larasati");
const KANTOR = { lat: -6.2607, lng: 106.8106 };

/** Absen pada jam tertentu di tanggal uji, lalu kembalikan barisnya. */
async function absen(tanggal, jam, lat = KANTOR.lat, lng = KANTOR.lng) {
  await sebagaiAdmin(db, `delete from attendance where user_id=$1 and tanggal=$2`, [
    ANISA,
    tanggal,
  ]);
  await sebagai(
    db,
    ANISA,
    `insert into attendance (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk)
     values ($1, $2, ($2::date + $3::time) at time zone 'Asia/Jakarta', $4, $5)`,
    [ANISA, tanggal, jam, lat, lng],
  );
  return (
    await sebagaiAdmin(
      db,
      `select status, terlambat, lokasi_valid, jarak_masuk_m
       from attendance where user_id=$1 and tanggal=$2`,
      [ANISA, tanggal],
    )
  ).rows[0];
}

uji("masuk 07:45 → hadir, tidak terlambat", async () => {
  const r = await absen("2024-11-11", "07:45");
  harusSama(r.status, "hadir");
  harusSama(r.terlambat, false);
});

uji("masuk 08:15 (tepat batas toleransi) → masih hadir", async () => {
  const r = await absen("2024-11-12", "08:15");
  harusSama(r.terlambat, false, "08:00 + toleransi 15 menit");
  harusSama(r.status, "hadir");
});

uji("masuk 08:16 → terlambat", async () => {
  const r = await absen("2024-11-13", "08:16");
  harusSama(r.terlambat, true);
  harusSama(r.status, "terlambat");
});

uji("lokasi di kantor → valid, jarak ~0 m", async () => {
  const r = await absen("2024-11-14", "07:50");
  harusSama(r.lokasi_valid, true);
  harus(Number(r.jarak_masuk_m) < 5, `jarak ${r.jarak_masuk_m} m`);
});

uji("lokasi 100 m dari kantor → masih dalam radius 150 m", async () => {
  // ~0,0009 derajat lintang ≈ 100 m
  const r = await absen("2024-11-15", "07:50", KANTOR.lat + 0.0009, KANTOR.lng);
  harusSama(r.lokasi_valid, true);
  harus(
    Number(r.jarak_masuk_m) > 90 && Number(r.jarak_masuk_m) < 110,
    `jarak ${r.jarak_masuk_m} m di luar dugaan`,
  );
});

uji("lokasi 500 m dari kantor → di luar radius", async () => {
  const r = await absen("2024-11-18", "07:50", KANTOR.lat + 0.0045, KANTOR.lng);
  harusSama(r.lokasi_valid, false);
  harus(Number(r.jarak_masuk_m) > 400, `jarak ${r.jarak_masuk_m} m`);
});

uji("perubahan pengaturan jam masuk langsung berlaku", async () => {
  await sebagaiAdmin(db, `update pengaturan set jam_masuk='09:00' where id`);
  const r = await absen("2024-11-19", "08:30");
  harusSama(r.terlambat, false, "08:30 kini lebih awal dari jam masuk 09:00");
  await sebagaiAdmin(db, `update pengaturan set jam_masuk='08:00' where id`);
});

uji("perubahan radius langsung berlaku", async () => {
  await sebagaiAdmin(db, `update pengaturan set radius_meter=600 where id`);
  const r = await absen("2024-11-20", "07:50", KANTOR.lat + 0.0045, KANTOR.lng);
  harusSama(r.lokasi_valid, true, "radius 600 m mencakup jarak ~500 m");
  await sebagaiAdmin(db, `update pengaturan set radius_meter=150 where id`);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
