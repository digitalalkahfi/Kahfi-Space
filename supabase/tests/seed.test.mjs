/** Memastikan seed.sql terpasang bersih dan angkanya sesuai PRD. */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
const { uji, jalankan } = buatSuite("Seed data contoh");

const hitung = async (sql) =>
  Number((await sebagaiAdmin(db, sql)).rows[0].n);

uji("seed.sql terpasang tanpa galat", async () => {
  await terapkanSeed(db);
});

uji("seed idempoten — aman dijalankan dua kali", async () => {
  await terapkanSeed(db);
  harusSama(
    await hitung("select count(*)::int as n from users where status = 'aktif'"),
    25,
  );
});

uji("25 anggota tim aktif sesuai PRD", async () => {
  // PRD menghitung 25 orang yang bertugas. Seed juga menyimpan satu bekas
  // anggota berstatus nonaktif supaya riwayat dan lencana statusnya
  // benar-benar terlihat di layar.
  harusSama(
    await hitung("select count(*)::int as n from users where status = 'aktif'"),
    25,
  );
  harusSama(
    await hitung("select count(*)::int as n from users where status = 'nonaktif'"),
    1,
  );
});

uji("tiga unit pelaporan", async () => {
  harusSama(await hitung("select count(*)::int as n from units"), 3);
});

uji("lima departemen", async () => {
  harusSama(await hitung("select count(*)::int as n from departments"), 5);
});

uji("setiap akun punya PIC dan unit", async () => {
  harusSama(
    await hitung(
      "select count(*)::int as n from accounts where pic_user_id is null or unit_id is null",
    ),
    0,
  );
});

uji("tidak ada anggota yang jadi atasan dirinya sendiri", async () => {
  harusSama(
    await hitung("select count(*)::int as n from users where atasan_id = id"),
    0,
  );
});

uji("semua Staff punya atasan", async () => {
  harusSama(
    await hitung(
      "select count(*)::int as n from users where role = 'Staff' and atasan_id is null",
    ),
    0,
  );
});

uji("email unik tanpa peduli huruf besar/kecil", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select lower(email) e, count(*) c from users group by 1 having count(*) > 1",
  );
  harus(rows.length === 0, `email duplikat: ${JSON.stringify(rows)}`);
});

uji("pengumuman tersemat tepat satu", async () => {
  harusSama(
    await hitung(
      "select count(*)::int as n from announcements where disematkan",
    ),
    1,
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
