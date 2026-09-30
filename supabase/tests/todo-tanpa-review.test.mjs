/**
 * To-do pribadi tanpa tahap Review/QC (D2, migrasi 0179).
 *
 * Yang diuji: constraint menolak to-do masuk Review, pemilik tetap bisa
 * mencentang dan membuka lagi, data lama yang terjebak di Review
 * dipindah ke "Sedang Dikerjakan" (bukan "Selesai"), dan migrasinya aman
 * dijalankan ulang.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
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
const { uji, jalankan } = buatSuite("To-do pribadi tanpa Review (0179)");

const MIGRASI = await readFile(
  path.join(process.cwd(), "supabase", "migrations", "0179_todo_tanpa_review.sql"),
  "utf8",
);

const id = async (nama) =>
  (await sebagaiAdmin(db, `select id from users where nama = $1`, [nama])).rows[0]
    .id;

const RIAN = await id("Rian Hidayat");
const DEWI = await id("Dewi Lestari");

const buatToDo = async (judul, status = "todo") =>
  (
    await sebagaiAdmin(
      db,
      `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat, status)
       values ('pribadi', $1, $2, $2, now() + interval '1 day', $3) returning id`,
      [judul, RIAN, status],
    )
  ).rows[0].id;

const status = async (tid) =>
  (await sebagaiAdmin(db, `select status, qc_status from tasks where id = $1`, [tid]))
    .rows[0];

uji("pemilik tidak bisa mengajukan to-do ke Review", async () => {
  const tid = await buatToDo("To-do mau di-review", "berjalan");
  await harusDitolak(
    () =>
      sebagai(
        db,
        RIAN,
        `update tasks set status = 'menunggu_qc', hasil_kerja = 'sudah beres semua'
         where id = $1`,
        [tid],
      ),
    "to-do pribadi seharusnya tidak bisa masuk Review",
  );
  harusSama((await status(tid)).status, "berjalan", "status tidak berubah");
});

uji("to-do juga tidak bisa berstatus revisi", async () => {
  const tid = await buatToDo("To-do revisi");
  await harusDitolak(
    () =>
      sebagai(db, RIAN, `update tasks set status = 'revisi' where id = $1`, [tid]),
    "status revisi hanya lahir dari QC tiket",
  );
});

uji("pemilik mencentang to-do dari Sedang Dikerjakan → Selesai", async () => {
  const tid = await buatToDo("Centang saya", "berjalan");
  const { rows } = await sebagai(
    db,
    RIAN,
    `update tasks set status = 'selesai' where id = $1 returning id`,
    [tid],
  );
  harusSama(rows.length, 1);
  const { rows: s } = await sebagaiAdmin(
    db,
    `select status, selesai_at from tasks where id = $1`,
    [tid],
  );
  harusSama(s[0].status, "selesai");
  harus(s[0].selesai_at, "selesai_at terisi oleh trigger");

  // Batal centang: kembali ke To Do.
  await sebagai(db, RIAN, `update tasks set status = 'todo' where id = $1`, [tid]);
  harusSama((await status(tid)).status, "todo");
});

uji("tiket tetap bisa diajukan ke Review", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id from tasks where judul = 'Audit GMV Akun Beauty'`,
  );
  await sebagai(
    db,
    RIAN,
    `update tasks set status = 'menunggu_qc',
       hasil_kerja = 'Deviasi komisi 5 kreator sudah dicocokkan.'
     where id = $1`,
    [rows[0].id],
  );
  harusSama((await status(rows[0].id)).status, "menunggu_qc");
});

uji("data lama: to-do di Review/revisi dipindah ke berjalan, bukan selesai", async () => {
  // Meniru keadaan sebelum 0179: constraint belum ada, to-do terjebak.
  await sebagaiAdmin(
    db,
    `alter table tasks drop constraint tasks_pribadi_tanpa_review`,
  );
  const terjebak = await buatToDo("To-do terjebak di Review", "menunggu_qc");
  const direvisi = await buatToDo("To-do berstatus revisi", "revisi");
  await sebagaiAdmin(
    db,
    `update tasks set qc_status = 'revisi' where id = $1`,
    [direvisi],
  );

  await sebagaiAdmin(db, MIGRASI);

  harusSama(await status(terjebak), { status: "berjalan", qc_status: "belum" });
  harusSama(await status(direvisi), { status: "berjalan", qc_status: "belum" });

  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from tasks
      where tipe = 'pribadi' and status in ('menunggu_qc', 'revisi')`,
  );
  harusSama(rows[0].n, 0, "tidak ada to-do tersisa di Review/revisi");

  // Setelah dipindah, pemiliknya bisa langsung mencentang.
  await sebagai(db, RIAN, `update tasks set status = 'selesai' where id = $1`, [
    terjebak,
  ]);
  harusSama((await status(terjebak)).status, "selesai");
});

uji("constraint kembali terpasang setelah migrasi dijalankan ulang", async () => {
  await sebagaiAdmin(db, MIGRASI);
  await sebagaiAdmin(db, MIGRASI);
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from pg_constraint
      where conname = 'tasks_pribadi_tanpa_review'`,
  );
  harusSama(rows[0].n, 1);
  await harusDitolak(
    () => buatToDo("Langsung Review", "menunggu_qc"),
    "constraint harus menolak insert to-do berstatus Review",
  );
});

uji("QC tiket oleh pemberi tiket tetap berjalan", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id from tasks where judul = 'QC Tiket Konten FYP'`,
  );
  await sebagai(db, DEWI, `update tasks set qc_status = 'lolos' where id = $1`, [
    rows[0].id,
  ]);
  harusSama((await status(rows[0].id)).status, "selesai");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
