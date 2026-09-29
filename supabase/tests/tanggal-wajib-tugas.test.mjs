/**
 * Semua tugas baru wajib bertanggal (D3, migrasi 0180).
 *
 * To-do: tanggal wajib (constraint), jam opsional (`tanpa_jam`).
 * Tiket & komitmen baru: tenggat wajib (trigger BEFORE INSERT) — tiket
 * lama tanpa tenggat tetap bisa digeser statusnya.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  pesanDb,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Tanggal wajib untuk tugas (0180)");

const MIGRASI = await readFile(
  path.join(process.cwd(), "supabase", "migrations", "0180_tanggal_wajib_tugas.sql"),
  "utf8",
);

const id = async (nama) =>
  (await sebagaiAdmin(db, `select id from users where nama = $1`, [nama])).rows[0]
    .id;

const DEWI = await id("Dewi Lestari"); // Leader Affiliator
const BAYU = await id("Bayu Nugraha"); // Staff Affiliator, bawahan Dewi
const RIAN = await id("Rian Hidayat");

/** Galat yang dilempar fn, atau null bila berhasil. */
const galatDari = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
};

uji("kolom tanpa_jam ada dan bawaannya false", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select column_default, is_nullable from information_schema.columns
      where table_name = 'tasks' and column_name = 'tanpa_jam'`,
  );
  harusSama(rows.length, 1);
  harusSama(rows[0].is_nullable, "NO");
  harus(String(rows[0].column_default).includes("false"), "bawaan false");
});

uji("to-do baru tanpa tanggal ditolak", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        RIAN,
        `insert into tasks (tipe, judul, pembuat_id, penerima_id)
         values ('pribadi', 'Tanpa tanggal', $1, $1)`,
        [RIAN],
      ),
    "constraint tasks_pribadi_bertenggat tidak bekerja",
  );
});

uji("to-do tanpa jam tersimpan 23:59 WIB di tanggal itu dan ditandai", async () => {
  const { rows } = await sebagai(
    db,
    RIAN,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat, tanpa_jam)
     values ('pribadi', 'To-do 2 Oktober', $1, $1, '2026-10-02T23:59:00+07:00', true)
     returning id`,
    [RIAN],
  );
  const { rows: t } = await sebagaiAdmin(
    db,
    `select (tenggat at time zone 'Asia/Jakarta')::date::text tanggal,
            to_char(tenggat at time zone 'Asia/Jakarta', 'HH24:MI') jam,
            tanpa_jam,
            kelompok_tenggat_dari(tenggat, '2026-10-02') kelompok
       from tasks where id = $1`,
    [rows[0].id],
  );
  harusSama(t[0], {
    tanggal: "2026-10-02",
    jam: "23:59",
    tanpa_jam: true,
    kelompok: "hari_ini",
  });
});

uji("tiket baru tanpa tenggat ditolak database", async () => {
  const e = await galatDari(() =>
    sebagai(
      db,
      DEWI,
      `insert into tasks (tipe, judul, pembuat_id, penerima_id)
       values ('tiket', 'Tiket tanpa tenggat', $1, $2)`,
      [DEWI, BAYU],
    ),
  );
  harus(e, "tiket tanpa tenggat seharusnya ditolak");
  harus(
    pesanDb(e).includes("wajib punya tanggal dan jam"),
    `pesan tidak jelas: ${pesanDb(e)}`,
  );
});

uji("komitmen mingguan baru tanpa tenggat ditolak database", async () => {
  const { rows: g } = await sebagaiAdmin(
    db,
    `select g.id from goals g join units u on u.id = g.unit_id
      where g.level = 'leader' and u.kode = 'affiliator'`,
  );
  await harusDitolak(
    () =>
      sebagai(
        db,
        DEWI,
        `insert into tasks (tipe, goal_id, judul, pembuat_id, penerima_id)
         values ('komitmen_mingguan', $3, 'Komitmen tanpa tenggat', $1, $2)`,
        [DEWI, BAYU, g[0].id],
      ),
    "komitmen tanpa tenggat seharusnya ditolak",
  );
});

uji("tiket bertanggal dan berjam diterima", async () => {
  const { rows } = await sebagai(
    db,
    DEWI,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat)
     values ('tiket', 'Audit konten Oktober', $1, $2, '2026-10-02T15:00:00+07:00')
     returning tenggat`,
    [DEWI, BAYU],
  );
  harusSama(rows.length, 1);
});

uji("tiket tidak boleh tanpa jam", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        DEWI,
        `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat, tanpa_jam)
         values ('tiket', 'Tiket tanpa jam', $1, $2,
                 '2026-10-02T23:59:00+07:00', true)`,
        [DEWI, BAYU],
      ),
    "constraint tasks_tanpa_jam_hanya_todo tidak bekerja",
  );
});

uji("tiket lama tanpa tenggat tetap bisa digeser statusnya", async () => {
  // Tiket lama ditulis sistem sebelum aturan ini ada.
  const { rows } = await sebagaiAdmin(
    db,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id)
     values ('tiket', 'Tiket lama tanpa tenggat', $1, $2) returning id`,
    [DEWI, BAYU],
  );
  const { rows: r } = await sebagai(
    db,
    BAYU,
    `update tasks set status = 'berjalan' where id = $1 returning status`,
    [rows[0].id],
  );
  harusSama(r[0]?.status, "berjalan");
});

uji("data lama: to-do tanpa tenggat diisi 23:59 WIB tanggal dibuatnya", async () => {
  // Meniru keadaan sebelum 0180.
  await sebagaiAdmin(
    db,
    `alter table tasks drop constraint tasks_pribadi_bertenggat`,
  );
  // Dibuat 00.30 WIB 30 Sep = 17.30 UTC 29 Sep: tanggalnya harus 30 Sep.
  const { rows: a } = await sebagaiAdmin(
    db,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id, created_at)
     values ('pribadi', 'To-do lama tengah malam', $1, $1,
             '2026-09-29T17:30:00Z') returning id`,
    [RIAN],
  );
  // To-do lama yang sudah jauh lewat: tidak boleh memicu pengingat susulan.
  const { rows: b } = await sebagaiAdmin(
    db,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id, created_at)
     values ('pribadi', 'To-do lama sekali', $1, $1,
             '2024-10-01T03:00:00Z') returning id`,
    [RIAN],
  );

  await sebagaiAdmin(db, MIGRASI);

  const { rows } = await sebagaiAdmin(
    db,
    `select id, tanpa_jam,
            to_char(tenggat at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') wib
       from tasks where id = any($1) order by created_at desc`,
    [[a[0].id, b[0].id]],
  );
  harusSama(
    rows.map((r) => [r.wib, r.tanpa_jam]),
    [
      ["2026-09-30 23:59", true],
      ["2024-10-01 23:59", true],
    ],
  );

  const { rows: penanda } = await sebagaiAdmin(
    db,
    `select task_id, tahap from notifikasi_tenggat_terkirim
      where task_id = any($1)`,
    [[a[0].id, b[0].id]],
  );
  harusSama(
    penanda.map((p) => [p.task_id, p.tahap]),
    [[b[0].id, "lewat"]],
    "hanya to-do yang sudah lewat yang ditandai",
  );

  // Pengingat terjadwal tidak menerbitkan "Tenggat lewat" untuknya.
  await sebagaiAdmin(db, `select terbitkan_notifikasi_tenggat(24)`);
  const { rows: n } = await sebagaiAdmin(
    db,
    `select count(*)::int n from notifications
      where judul = 'Tenggat lewat: To-do lama sekali'`,
  );
  harusSama(n[0].n, 0);
});

uji("migrasi aman dijalankan ulang", async () => {
  await sebagaiAdmin(db, MIGRASI);
  await sebagaiAdmin(db, MIGRASI);
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from pg_constraint
      where conname in ('tasks_pribadi_bertenggat', 'tasks_tanpa_jam_hanya_todo')`,
  );
  harusSama(rows[0].n, 2);
  const { rows: kosong } = await sebagaiAdmin(
    db,
    `select count(*)::int n from tasks where tipe = 'pribadi' and tenggat is null`,
  );
  harusSama(kosong[0].n, 0);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
