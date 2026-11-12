/**
 * Asisten Manager tidak melihat to-do pribadi orang lain (0219).
 *
 * Yang dijaga: daftar `asisten.tugas_telat` SAMA dengan yang ditampilkan
 * halaman Tugas kepada Manager — semua tiket/komitmen lewat tenggat,
 * tetapi to-do pribadi hanya milik Manager sendiri.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  idPeran,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Asisten Manager — to-do pribadi orang lain");

const WAKTU = "2024-10-24T08:00:00+07:00";
const manager = await idPeran(db, "Manager");
const staff = await idPeran(db, "Staff");
const leader = await idPeran(db, "Leader");

await sebagaiAdmin(
  db,
  `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat, status) values
     ('pribadi', 'uji0219 todo manager', $1, $1, '2024-10-20T10:00:00+07', 'todo'),
     ('pribadi', 'uji0219 todo staff',   $2, $2, '2024-10-20T10:00:00+07', 'todo'),
     ('pribadi', 'uji0219 todo leader',  $3, $3, '2024-10-20T10:00:00+07', 'berjalan'),
     ('tiket',   'uji0219 tiket staff',  $1, $2, '2024-10-20T10:00:00+07', 'todo'),
     ('tiket',   'uji0219 tiket leader', $1, $3, '2024-10-20T10:00:00+07', 'berjalan')`,
  [manager, staff, leader],
);

async function asisten() {
  await db.exec("reset role;");
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec("begin; set transaction read only; set local role asisten_baca;");
  try {
    return (await db.query("select judul, tipe, penerima from asisten.tugas_telat($1::timestamptz)", [WAKTU])).rows;
  } finally {
    await db.exec("rollback;");
    await db.exec("reset role;");
  }
}

uji("to-do pribadi orang lain tidak muncul; milik Manager dan semua tiket tetap", async () => {
  const judul = (await asisten()).map((r) => r.judul).filter((j) => j.startsWith("uji0219"));
  harusSama(
    judul.sort(),
    ["uji0219 tiket leader", "uji0219 tiket staff", "uji0219 todo manager"],
    "tugas uji yang terlihat",
  );
});

uji("tidak ada satu pun to-do milik selain Manager", async () => {
  const { rows: namaManager } = await sebagaiAdmin(
    db,
    `select nama from users where role = 'Manager'`,
  );
  const boleh = new Set(namaManager.map((r) => r.nama));
  const todo = (await asisten()).filter((r) => r.tipe === "To-do");
  harus(todo.length > 0, "tidak ada to-do sama sekali — tes tidak bermakna");
  harus(todo.every((r) => boleh.has(r.penerima)), "ada to-do pribadi milik selain Manager");
});

uji("daftar sama dengan saringan halaman Tugas untuk Manager", async () => {
  // Saringan halaman: tipe <> 'pribadi' or penerima_id = saya, lewat RLS Manager.
  const halaman = (
    await sebagai(
      db,
      manager,
      `select t.judul from tasks t join users pe on pe.id = t.penerima_id
       where t.tenggat is not null and t.tenggat < $1::timestamptz
         and t.status in ('todo', 'berjalan', 'revisi', 'menunggu_qc')
         and pe.status = 'aktif'
         and (t.tipe <> 'pribadi' or t.penerima_id = $2)
       order by 1`,
      [WAKTU, manager],
    )
  ).rows.map((r) => r.judul);
  const tool = (await asisten()).map((r) => r.judul).sort();
  harusSama(tool, [...halaman].sort(), "daftar tugas lewat tenggat");
});

await jalankan();
