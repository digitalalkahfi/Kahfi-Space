/**
 * Isi tiket hanya bisa diubah pemberi tiket (D1, migrasi 0181).
 *
 * Ini verifikasi izin yang diminta handoff, dijalankan sebagai peran
 * `authenticated` dengan RLS aktif — bukan dibaca dari kode:
 *   · penerima: ubah tenggat/judul → ditolak; ubah status → boleh
 *   · pemberi tiket: ubah tenggat → boleh, pengingat di-reset
 *   · Manager bukan pemberi tiket: ubah tenggat → ditolak
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
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
const { uji, jalankan } = buatSuite("Kunci isi tiket (0181)");

const MIGRASI = await readFile(
  path.join(process.cwd(), "supabase", "migrations", "0181_kunci_isi_tiket.sql"),
  "utf8",
);

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu(`select id from users where nama = $1`, [nama])).id;
const tiket = async (judul) =>
  (await satu(`select id from tasks where judul = $1`, [judul])).id;

const MANAGER = await id("Farhan Pratama");
const DEWI = await id("Dewi Lestari"); // Leader Affiliator
const RIAN = await id("Rian Hidayat"); // Staff, penerima "Audit GMV"
const BAYU = await id("Bayu Nugraha"); // Staff, penerima "QC Tiket Konten FYP"

// Dari Manager (Farhan) untuk Rian, dan dari Leader (Dewi) untuk Bayu.
const AUDIT = await tiket("Audit GMV Akun Beauty");
const QC_FYP = await tiket("QC Tiket Konten FYP");

/** Galat yang dilempar fn, atau null bila berhasil. */
const galatDari = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
};

const harusDikunci = async (e, pesan = "Isi tiket hanya bisa diubah oleh pemberi tiket") => {
  harus(e, "perubahan seharusnya ditolak");
  harusSama(e.code, "42501", `kode galat untuk: ${pesanDb(e)}`);
  harus(pesanDb(e).includes(pesan), `pesan tidak sesuai: ${pesanDb(e)}`);
};

uji("penerima tidak bisa mengubah tenggat tiketnya", async () => {
  const sebelum = await satu(`select tenggat from tasks where id = $1`, [AUDIT]);
  const e = await galatDari(() =>
    sebagai(
      db,
      RIAN,
      `update tasks set tenggat = tenggat + interval '3 days' where id = $1`,
      [AUDIT],
    ),
  );
  await harusDikunci(e);
  const sesudah = await satu(`select tenggat from tasks where id = $1`, [AUDIT]);
  harusSama(String(sesudah.tenggat), String(sebelum.tenggat), "tenggat utuh");
});

uji("penerima tidak bisa mengubah judul tiketnya", async () => {
  const e = await galatDari(() =>
    sebagai(db, RIAN, `update tasks set judul = 'Judul karangan' where id = $1`, [
      AUDIT,
    ]),
  );
  await harusDikunci(e);
});

uji("penerima tidak bisa mengubah kolom isi lainnya", async () => {
  const perubahan = [
    `deskripsi = 'Rincian diganti'`,
    `konteks = 'Konteks diganti'`,
    `tanpa_jam = true`,
    `penerima_id = '${BAYU}'`,
    `pembuat_id = '${RIAN}'`,
    `tipe = 'pribadi'`,
    `goal_id = (select id from goals limit 1)`,
  ];
  for (const set of perubahan) {
    const e = await galatDari(() =>
      sebagai(db, RIAN, `update tasks set ${set} where id = $1`, [AUDIT]),
    );
    harus(e, `perubahan "${set}" seharusnya ditolak`);
    harusSama(e.code, "42501", `kode galat "${set}": ${pesanDb(e)}`);
  }
});

uji("penerima tetap bisa menggeser status dan menulis hasil kerja", async () => {
  const { rows } = await sebagai(
    db,
    RIAN,
    `update tasks set status = 'todo' where id = $1 returning status`,
    [AUDIT],
  );
  harusSama(rows[0]?.status, "todo");
  const { rows: r2 } = await sebagai(
    db,
    RIAN,
    `update tasks set status = 'menunggu_qc',
       hasil_kerja = 'Deviasi komisi sudah dicocokkan ke Partner Center.'
     where id = $1 returning status`,
    [AUDIT],
  );
  harusSama(r2[0]?.status, "menunggu_qc");
});

uji("perubahan campuran status + tenggat ditolak seluruhnya", async () => {
  const e = await galatDari(() =>
    sebagai(
      db,
      RIAN,
      `update tasks set status = 'berjalan', tenggat = now() + interval '9 days'
        where id = $1`,
      [AUDIT],
    ),
  );
  await harusDikunci(e);
  const t = await satu(`select status from tasks where id = $1`, [AUDIT]);
  harusSama(t.status, "menunggu_qc", "status pun tidak ikut berubah");
});

uji("pemberi tiket bisa mengubah tenggat, dan pengingatnya di-reset", async () => {
  await sebagaiAdmin(
    db,
    `insert into notifikasi_tenggat_terkirim (task_id, tahap)
     values ($1, 'mendekat'), ($1, 'lewat') on conflict do nothing`,
    [AUDIT],
  );
  const { rows } = await sebagai(
    db,
    MANAGER,
    `update tasks set tenggat = '2026-10-05T15:00:00+07:00'
      where id = $1 returning id`,
    [AUDIT],
  );
  harusSama(rows.length, 1, "pemberi tiket boleh");
  const penanda = await satu(
    `select count(*)::int n from notifikasi_tenggat_terkirim where task_id = $1`,
    [AUDIT],
  );
  harusSama(penanda.n, 0, "penanda pengingat harus terhapus");
});

uji("Manager yang bukan pemberi tiket tidak bisa mengubah tenggat", async () => {
  const e = await galatDari(() =>
    sebagai(
      db,
      MANAGER,
      `update tasks set tenggat = now() + interval '2 days' where id = $1`,
      [QC_FYP],
    ),
  );
  await harusDikunci(e);
});

uji("Manager yang bukan pemberi tiket tetap bisa melakukan QC", async () => {
  // Alur QC tidak berubah (non-scope): lolos/revisi oleh atasan tetap sah.
  const { rows } = await sebagai(
    db,
    MANAGER,
    `update tasks set qc_status = 'revisi', qc_note = 'Lampirkan tautan videonya.'
      where id = $1 returning status`,
    [QC_FYP],
  );
  harusSama(rows[0]?.status, "revisi");
});

uji("Leader pemberi tiket bisa mengubah isi tiketnya", async () => {
  const { rows } = await sebagai(
    db,
    DEWI,
    `update tasks set judul = 'QC 12 video FYP batch Ramadan',
       tenggat = '2026-10-06T10:00:00+07:00'
      where id = $1 returning judul`,
    [QC_FYP],
  );
  harusSama(rows[0]?.judul, "QC 12 video FYP batch Ramadan");
});

uji("proses sistem (tanpa pengguna) tetap boleh mengubah isi", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `update tasks set tenggat = tenggat + interval '1 hour' where id = $1
     returning id`,
    [AUDIT],
  );
  harusSama(rows.length, 1);
});

uji("isi to-do hanya bisa diubah pemiliknya", async () => {
  const todo = (
    await satu(
      `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat)
       values ('pribadi', 'To-do Rian', $1, $1, now() + interval '1 day')
       returning id`,
      [RIAN],
    )
  ).id;

  // Pemilik bebas menjadwal ulang dan mengganti judul.
  const { rows } = await sebagai(
    db,
    RIAN,
    `update tasks set tenggat = now() + interval '3 days', judul = 'To-do Rian (geser)'
      where id = $1 returning id`,
    [todo],
  );
  harusSama(rows.length, 1);

  // Manager bisa membaca/menulis baris itu lewat RLS, tetapi isinya dikunci.
  const e = await galatDari(() =>
    sebagai(
      db,
      MANAGER,
      `update tasks set tenggat = now() + interval '5 days' where id = $1`,
      [todo],
    ),
  );
  await harusDikunci(e, "Isi to-do hanya bisa diubah pemiliknya");
});

uji("penerima tetap tidak bisa meluluskan QC-nya sendiri", async () => {
  const e = await galatDari(() =>
    sebagai(db, BAYU, `update tasks set qc_status = 'lolos' where id = $1`, [
      QC_FYP,
    ]),
  );
  harus(e && pesanDb(e).includes("Pemeriksaan (QC)"), "larang_qc_sendiri utuh");
});

uji("menghapus goal tetap melepas komitmen & tiket buatan orang lain", async () => {
  const goal = (
    await satu(
      `select g.id from goals g join units u on u.id = g.unit_id
        where g.level = 'leader' and u.kode = 'mcn'`,
    )
  ).id;
  const komitmen = (
    await satu(
      `insert into tasks (tipe, goal_id, judul, pembuat_id, penerima_id, tenggat)
       values ('komitmen_mingguan', $1, 'Komitmen buatan Dewi', $2, $3, now())
       returning id`,
      [goal, DEWI, RIAN],
    )
  ).id;
  const bergoal = (
    await satu(
      `insert into tasks (tipe, goal_id, judul, pembuat_id, penerima_id, tenggat)
       values ('tiket', $1, 'Tiket bergoal buatan Dewi', $2, $3, now())
       returning id`,
      [goal, DEWI, RIAN],
    )
  ).id;

  // Manager bukan pemberi keduanya, tetapi berwenang menghapus goal.
  const { rows } = await sebagai(
    db,
    MANAGER,
    `delete from goals where id = $1 returning id`,
    [goal],
  );
  harusSama(rows.length, 1, "goal terhapus");

  const hasil = (
    await sebagaiAdmin(
      db,
      `select id, tipe, goal_id from tasks where id = any($1) order by judul`,
      [[komitmen, bergoal]],
    )
  ).rows;
  harusSama(
    hasil.map((t) => [t.tipe, t.goal_id]),
    [
      ["tiket", null],
      ["tiket", null],
    ],
  );
});

uji("migrasi aman dijalankan ulang", async () => {
  await sebagaiAdmin(db, MIGRASI);
  await sebagaiAdmin(db, MIGRASI);
  const t = await satu(
    `select count(*)::int n from pg_trigger
      where tgname in ('tasks_a_kunci_isi_tiket', 'reset_pengingat_tenggat_pengguna_trg')`,
  );
  harusSama(t.n, 2);
  const e = await galatDari(() =>
    sebagai(db, RIAN, `update tasks set judul = 'Coba lagi' where id = $1`, [AUDIT]),
  );
  await harusDikunci(e);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
