/** Rekap kehadiran per periode: cakupan peran dan angka ringkasnya. */
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
const { uji, jalankan } = buatSuite("Rekap kehadiran per periode");

const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;

const U = {
  ceo: await idUser("Hafidz Alkahfi"),
  manager: await idUser("Farhan Pratama"),
  leaderTap: await idUser("Dimas Maulana"),
  anisa: await idUser("Anisa Larasati"),
};

const BULAN = ["2024-10-01", "2024-10-31"];

const rekap = async (id, user = null) =>
  (
    await sebagai(db, id, `select * from rekap_absensi($1::date,$2::date,$3::uuid)`, [
      ...BULAN,
      user,
    ])
  ).rows;

const ringkas = async (id, user = null) =>
  (
    await sebagai(db, id, `select * from ringkas_absensi($1::date,$2::date,$3::uuid)`, [
      ...BULAN,
      user,
    ])
  ).rows[0];

uji("Manager melihat rekap seluruh tim", async () => {
  const r = await rekap(U.manager);
  harus(r.length >= 24, `hanya ${r.length} baris`);
  const nama = new Set(r.map((x) => x.nama));
  harus(nama.size > 5, "harus mencakup banyak orang");
});

uji("Staff hanya melihat rekap dirinya", async () => {
  const r = await rekap(U.anisa);
  const nama = new Set(r.map((x) => x.nama));
  harusSama([...nama], ["Anisa Larasati"]);
});

uji("Leader melihat unitnya saja", async () => {
  const r = await rekap(U.leaderTap);
  const unit = new Set(r.map((x) => x.unit_nama));
  harus(
    [...unit].every((u) => u === "TAP"),
    `unit yang terlihat: ${[...unit].join(", ")}`,
  );
});

uji("penyaringan p_user membatasi ke satu orang", async () => {
  const r = await rekap(U.manager, U.anisa);
  const nama = new Set(r.map((x) => x.nama));
  harusSama([...nama], ["Anisa Larasati"]);
});

uji("periode di luar rentang mengembalikan kosong", async () => {
  const { rows } = await sebagai(
    db,
    U.manager,
    `select * from rekap_absensi('2023-01-01','2023-01-31')`,
  );
  harusSama(rows.length, 0);
});

uji("ringkasan cocok dengan jumlah barisnya", async () => {
  const r = await rekap(U.manager);
  const s = await ringkas(U.manager);
  harusSama(Number(s.jumlah_baris), r.length);
  harusSama(
    Number(s.hadir),
    r.filter((x) => ["hadir", "terlambat"].includes(x.status)).length,
  );
  harusSama(Number(s.terlambat), r.filter((x) => x.terlambat).length);
  harusSama(
    Number(s.luar_radius),
    r.filter((x) => x.jam_masuk && !x.lokasi_valid).length,
  );
});

uji("ringkasan menghormati cakupan peran", async () => {
  const manager = await ringkas(U.manager);
  const staff = await ringkas(U.anisa);
  harus(
    Number(staff.jumlah_baris) < Number(manager.jumlah_baris),
    "Staff harus melihat lebih sedikit",
  );
  harusSama(Number(staff.orang), 1, "Staff hanya dirinya sendiri");
});

uji("CEO melihat cakupan terluas", async () => {
  const ceo = await ringkas(U.ceo);
  const leader = await ringkas(U.leaderTap);
  harus(
    Number(ceo.orang) > Number(leader.orang),
    `CEO ${ceo.orang} orang vs Leader ${leader.orang}`,
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
