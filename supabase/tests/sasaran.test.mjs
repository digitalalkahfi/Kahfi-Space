/** Daftar akun/unit yang berhak dilaporkan tiap peran. */
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
const { uji, jalankan } = buatSuite("Sasaran laporan & visibilitas akun");

const TGL = "2024-10-24";
const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;

const U = {
  manager: await idUser("Farhan Pratama"),
  leaderAff: await idUser("Dewi Lestari"),
  leaderMcn: await idUser("Galih Prakoso"),
  rian: await idUser("Rian Hidayat"),   // PIC 2 akun
  anisa: await idUser("Anisa Larasati"), // Staff Affiliator tanpa akun
  finance: await idUser("Laras Ayuningtyas"),
};

const sasaran = async (id) =>
  (await sebagai(db, id, `select * from sasaran_laporan_saya($1::date)`, [TGL]))
    .rows;

uji("Staff hanya melihat akun yang ia pegang", async () => {
  const r = await sasaran(U.rian);
  harusSama(
    r.map((x) => x.label).sort(),
    ["@beauty_daily.id", "@skincare_official"],
    "Rian PIC dua akun",
  );
});

uji("Staff tanpa akun tidak punya sasaran laporan", async () => {
  harusSama((await sasaran(U.anisa)).length, 0);
});

uji("Leader unit berakun tidak melapor di tingkat unit", async () => {
  const r = await sasaran(U.leaderAff);
  harus(
    !r.some((x) => x.jenis === "unit"),
    "Affiliator punya akun, jadi tidak ada sasaran unit",
  );
});

uji("Leader MCN melapor untuk unitnya", async () => {
  const r = await sasaran(U.leaderMcn);
  harusSama(r.length, 1);
  harusSama(r[0].jenis, "unit");
  harusSama(r[0].unit_kode, "mcn");
  harusSama(Number(r[0].target_harian), 12_500_000);
});

uji("Manager melihat seluruh sasaran", async () => {
  const r = await sasaran(U.manager);
  harusSama(r.filter((x) => x.jenis === "akun").length, 6);
  harusSama(r.filter((x) => x.jenis === "unit").length, 2, "MCN & TAP");
});

uji("target akun ikut terbawa", async () => {
  const r = await sasaran(U.rian);
  const skincare = r.find((x) => x.label === "@skincare_official");
  harusSama(Number(skincare.target_harian), 4_500_000);
});

uji("program non-Reguler ditandai", async () => {
  const r = await sasaran(U.rian);
  const beauty = r.find((x) => x.label === "@beauty_daily.id");
  harusSama(beauty.program, "Mabit Scholar");
  const skincare = r.find((x) => x.label === "@skincare_official");
  harusSama(skincare.program, null, "Reguler tidak perlu ditampilkan");
});

uji("sasaran yang sudah dilapor hari ini ditandai", async () => {
  const r = await sasaran(U.rian);
  harus(
    r.every((x) => x.sudah_lapor),
    "kedua akun Rian sudah dilapor pada tanggal acuan",
  );
});

uji("Staff tidak bisa melihat akun rekan sejawat", async () => {
  const { rows } = await sebagai(
    db,
    U.anisa,
    `select count(*)::int n from accounts`,
  );
  harusSama(Number(rows[0].n), 0, "Staff tanpa akun tidak melihat akun apa pun");
});

uji("Leader unit melihat akun unitnya", async () => {
  const { rows } = await sebagai(
    db,
    U.leaderAff,
    `select count(*)::int n from accounts`,
  );
  harusSama(Number(rows[0].n), 6);
});

uji("Finance melihat akun untuk kebutuhan angka", async () => {
  const { rows } = await sebagai(
    db,
    U.finance,
    `select count(*)::int n from accounts`,
  );
  harusSama(Number(rows[0].n), 6);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
