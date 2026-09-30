/**
 * Edit & hapus tugas (migrasi 0184).
 *
 * Dijalankan sebagai peran `authenticated` dengan RLS aktif:
 *   · pemberi tiket mengedit isi → penerima dikabari apa yang berubah
 *   · tiket selesai terkunci: tidak bisa diedit, tidak bisa dihapus
 *   · penerima diganti hanya selama To Do, dan hanya ke orang dalam
 *     cakupan pemberinya; penerima lama & baru sama-sama dikabari
 *   · hapus tiket oleh pemberinya → penerima dikabari
 *   · to-do: pemiliknya bebas mengedit & menghapus, tanpa notifikasi
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
const { uji, jalankan } = buatSuite("Edit & hapus tugas (0184)");

const MIGRASI = await readFile(
  path.join(process.cwd(), "supabase", "migrations", "0184_edit_hapus_tugas.sql"),
  "utf8",
);

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu(`select id from users where nama = $1`, [nama])).id;

const MANAGER = await id("Farhan Pratama");
const DEWI = await id("Dewi Lestari"); // Leader Affiliator
const NABILA = await id("Nabila Putri"); // Staff, bawahan Dewi
const BAYU = await id("Bayu Nugraha"); // Staff, bawahan Dewi
const RIAN = await id("Rian Hidayat"); // Staff, bawahan Dewi
const INTAN = await id("Intan Permata"); // Staff, bawahan Dewi
const DIMAS = await id("Dimas Maulana"); // Leader TAP
const RIZKY = await id("Rizky Ananda"); // Staff MCN — di luar cakupan Dewi

/** Tiket baru lewat proses sistem, siap diuji. */
const buatTiket = async (pembuat, penerima, judul, status = "todo") =>
  (
    await satu(
      `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat,
                          kriteria_selesai, status)
       values ('tiket', $1, $2, $3, '2026-10-01T17:00:00+07:00',
               'Laporan lengkap terkirim', $4)
       returning id`,
      [judul, pembuat, penerima, status],
    )
  ).id;

const buatToDo = async (pemilik, judul, status = "todo") =>
  (
    await satu(
      `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat, status)
       values ('pribadi', $1, $2, $2, '2026-10-01T23:59:00+07:00', $3)
       returning id`,
      [judul, pemilik, status],
    )
  ).id;

/** Notifikasi tugas seseorang, terbaru lebih dulu. */
const notif = async (untuk) =>
  (
    await sebagaiAdmin(
      db,
      `select judul, pesan from notifications
        where user_id = $1 and kategori = 'tugas'
        order by created_at desc, id`,
      [untuk],
    )
  ).rows;

/** Galat yang dilempar fn, atau null bila berhasil. */
const galatDari = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
};

const harusGalat = (e, potongan, kode) => {
  harus(e, `seharusnya ditolak (${potongan})`);
  harus(pesanDb(e).includes(potongan), `pesan tidak sesuai: ${pesanDb(e)}`);
  if (kode) harusSama(e.code, kode, `kode galat: ${pesanDb(e)}`);
};

const ada = async (tid) =>
  (await satu(`select count(*)::int n from tasks where id = $1`, [tid])).n === 1;

uji("pemberi tiket mengedit isinya; penerima dikabari apa yang berubah", async () => {
  const tid = await buatTiket(DEWI, NABILA, "Rekap order pending");
  const sebelum = (await notif(NABILA)).length;

  const { rows } = await sebagai(
    db,
    DEWI,
    `update tasks set judul = 'Rekap order pending pekan ini',
       kriteria_selesai = 'Rekap 20 order terkirim ke grup',
       tenggat = '2026-10-02T17:00:00+07:00', prioritas = 'tinggi'
     where id = $1 returning id`,
    [tid],
  );
  harusSama(rows.length, 1, "pemberi tiket boleh mengedit");

  const n = await notif(NABILA);
  harusSama(n.length, sebelum + 1, "satu notifikasi untuk penerima");
  harusSama(n[0].judul, "Tiket diubah: Rekap order pending pekan ini");
  harusSama(
    n[0].pesan,
    "Yang berubah: judul, kriteria selesai, tenggat (kini 2 Okt 17.00 WIB), prioritas.",
  );
});

uji("perubahan oleh penerima sendiri atau oleh sistem tidak dikabarkan", async () => {
  const tid = await buatTiket(DEWI, NABILA, "Cek stok sampel");
  const sebelum = (await notif(NABILA)).length;

  // Prioritas bukan bagian isi yang dikunci (0181): penerima boleh.
  await sebagai(db, NABILA, `update tasks set prioritas = 'tinggi' where id = $1`, [
    tid,
  ]);
  await sebagaiAdmin(db, `update tasks set judul = 'Cek stok sampel (sistem)' where id = $1`, [
    tid,
  ]);
  harusSama((await notif(NABILA)).length, sebelum, "tidak ada notifikasi");
});

uji("tiket selesai terkunci — pemberinya pun tidak bisa mengedit", async () => {
  const tid = (
    await satu(`select id from tasks where judul = 'Rapikan stok sampel skincare'`)
  ).id;
  for (const set of [
    `judul = 'Judul diganti'`,
    `tenggat = '2026-10-05T17:00:00+07:00'`,
    `kriteria_selesai = 'Kriteria diganti belakangan'`,
    `penerima_id = '${NABILA}'`,
  ]) {
    const e = await galatDari(() =>
      sebagai(db, DEWI, `update tasks set ${set} where id = $1`, [tid]),
    );
    harusGalat(e, "sudah selesai tidak bisa diubah", "42501");
  }
  const t = await satu(`select judul, penerima_id from tasks where id = $1`, [tid]);
  harusSama(t, { judul: "Rapikan stok sampel skincare", penerima_id: INTAN });
});

uji("to-do yang sudah dicentang tetap bisa diedit pemiliknya", async () => {
  const tid = await buatToDo(RIAN, "Balas chat kreator", "selesai");
  const { rows } = await sebagai(
    db,
    RIAN,
    `update tasks set judul = 'Balas chat 5 kreator' where id = $1 returning judul`,
    [tid],
  );
  harusSama(rows[0]?.judul, "Balas chat 5 kreator");
});

uji("penerima diganti selama To Do; penerima lama & baru dikabari", async () => {
  const tid = await buatTiket(DEWI, NABILA, "Kurasi kreator fashion");
  const { rows } = await sebagai(
    db,
    DEWI,
    `update tasks set penerima_id = $2 where id = $1 returning penerima_id`,
    [tid, BAYU],
  );
  harusSama(rows[0]?.penerima_id, BAYU);

  const lama = await notif(NABILA);
  harusSama(lama[0].judul, "Tiket dialihkan: Kurasi kreator fashion");
  harus(lama[0].pesan.includes("Bayu Nugraha"), `pesan: ${lama[0].pesan}`);

  // Penerima baru dikabari trigger lama (0112) — sekali saja, bukan
  // ditambah "Tiket diubah".
  const baru = await notif(BAYU);
  harusSama(baru[0].judul, "Tugas dialihkan kepadamu: Kurasi kreator fashion");
  harus(
    !baru.some((x) => x.judul.startsWith("Tiket diubah: Kurasi kreator fashion")),
    "penerima baru tidak perlu notifikasi kedua",
  );
});

uji("penerima tidak bisa diganti setelah tiket mulai dikerjakan", async () => {
  for (const status of ["berjalan", "menunggu_qc"]) {
    const tid = await buatTiket(DEWI, NABILA, `Tiket ${status}`, status);
    const e = await galatDari(() =>
      sebagai(db, DEWI, `update tasks set penerima_id = $2 where id = $1`, [
        tid,
        BAYU,
      ]),
    );
    harusGalat(e, "belum mulai dikerjakan");
    const t = await satu(`select penerima_id from tasks where id = $1`, [tid]);
    harusSama(t.penerima_id, NABILA, `penerima tetap (${status})`);
  }
});

uji("penerima baru harus dalam cakupan pemberi tiket", async () => {
  const tid = await buatTiket(DEWI, NABILA, "Tiket lintas unit");
  const e = await galatDari(() =>
    sebagai(db, DEWI, `update tasks set penerima_id = $2 where id = $1`, [
      tid,
      RIZKY,
    ]),
  );
  harusGalat(e, "boleh kamu tugasi", "42501");

  // Manager boleh menugasi lintas unit — begitu juga mengalihkannya.
  const milikManager = await buatTiket(MANAGER, DIMAS, "Tiket Manager");
  const { rows } = await sebagai(
    db,
    MANAGER,
    `update tasks set penerima_id = $2 where id = $1 returning id`,
    [milikManager, RIZKY],
  );
  harusSama(rows.length, 1, "Manager boleh mengalihkan ke unit lain");
});

uji("penerima tidak bisa mengalihkan tiketnya sendiri", async () => {
  const tid = await buatTiket(DEWI, NABILA, "Tiket untuk Nabila");
  const e = await galatDari(() =>
    sebagai(db, NABILA, `update tasks set penerima_id = $2 where id = $1`, [
      tid,
      BAYU,
    ]),
  );
  harusGalat(e, "hanya bisa diubah oleh pemberi tiket", "42501");
});

uji("pemberi menghapus tiket; penerima dikabari, jejak QC ikut terhapus", async () => {
  const tid = await buatTiket(DEWI, NABILA, "Susun brief live", "berjalan");
  // Satu putaran QC supaya ada jejaknya.
  await sebagai(
    db,
    NABILA,
    `update tasks set status = 'menunggu_qc', hasil_kerja = 'Brief sudah dibagikan.'
      where id = $1`,
    [tid],
  );
  await sebagai(
    db,
    DEWI,
    `update tasks set qc_status = 'revisi', qc_note = 'Tambah jadwalnya.' where id = $1`,
    [tid],
  );
  const jejak = await satu(
    `select count(*)::int n from task_qc_log where task_id = $1`,
    [tid],
  );
  harusSama(jejak.n, 1, "jejak QC tercatat");

  const { rows } = await sebagai(
    db,
    DEWI,
    `delete from tasks where id = $1 returning id`,
    [tid],
  );
  harusSama(rows.length, 1, "pemberi tiket boleh menghapus");
  harus(!(await ada(tid)), "barisnya hilang");

  const sisa = await satu(
    `select count(*)::int n from task_qc_log where task_id = $1`,
    [tid],
  );
  harusSama(sisa.n, 0, "jejak QC ikut terhapus");

  const n = await notif(NABILA);
  harusSama(n[0].judul, "Tiket dihapus: Susun brief live");
  harusSama(
    n[0].pesan,
    "Dewi Lestari menghapusnya. Kamu tidak perlu mengerjakannya lagi.",
  );
});

uji("tiket selesai tidak bisa dihapus — pemberinya maupun Manager", async () => {
  const tid = (
    await satu(`select id from tasks where judul = 'Rapikan stok sampel skincare'`)
  ).id;
  for (const siapa of [DEWI, MANAGER]) {
    const e = await galatDari(() =>
      sebagai(db, siapa, `delete from tasks where id = $1`, [tid]),
    );
    harusGalat(e, "sudah selesai tidak bisa dihapus", "42501");
  }
  harus(await ada(tid), "tiket selesai tetap ada");

  // Proses sistem (perbaikan data oleh admin) tetap boleh.
  const salinan = await buatTiket(DEWI, INTAN, "Tiket selesai uji", "selesai");
  await sebagaiAdmin(db, `delete from tasks where id = $1`, [salinan]);
  harus(!(await ada(salinan)), "proses sistem boleh menghapus");
});

uji("penerima tidak bisa menghapus tiket dari atasannya", async () => {
  const tid = await buatTiket(DEWI, NABILA, "Tiket jangan dihapus");
  const { rows } = await sebagai(
    db,
    NABILA,
    `delete from tasks where id = $1 returning id`,
    [tid],
  );
  harusSama(rows.length, 0, "RLS menyaring baris tanpa galat");
  harus(await ada(tid), "tiket tetap ada");
});

uji("pemilik menghapus to-do-nya tanpa notifikasi; Leader tidak bisa", async () => {
  const tid = await buatToDo(RIAN, "To-do yang dihapus");
  const sebelum = (await notif(RIAN)).length;

  const { rows: olehLeader } = await sebagai(
    db,
    DEWI,
    `delete from tasks where id = $1 returning id`,
    [tid],
  );
  harusSama(olehLeader.length, 0, "Leader bukan pemilik to-do");

  const { rows } = await sebagai(
    db,
    RIAN,
    `delete from tasks where id = $1 returning id`,
    [tid],
  );
  harusSama(rows.length, 1);
  harusSama((await notif(RIAN)).length, sebelum, "tanpa notifikasi");

  // To-do yang sudah dicentang juga boleh dihapus.
  const selesai = await buatToDo(RIAN, "To-do beres", "selesai");
  const { rows: r2 } = await sebagai(
    db,
    RIAN,
    `delete from tasks where id = $1 returning id`,
    [selesai],
  );
  harusSama(r2.length, 1, "to-do selesai boleh dihapus");
});

uji("goal dihapus tetap melepas komitmen yang sudah selesai, tanpa notifikasi", async () => {
  const goal = (
    await satu(
      `select g.id from goals g join units u on u.id = g.unit_id
        where g.level = 'leader' and u.kode = 'mcn'`,
    )
  ).id;
  const komitmen = (
    await satu(
      `insert into tasks (tipe, goal_id, judul, pembuat_id, penerima_id, tenggat,
                          kriteria_selesai, status)
       values ('komitmen_mingguan', $1, 'Komitmen selesai', $2, $3, now(),
               'Konversi naik 5%', 'selesai')
       returning id`,
      [goal, DEWI, RIAN],
    )
  ).id;
  const sebelum = (await notif(RIAN)).length;

  const { rows } = await sebagai(
    db,
    MANAGER,
    `delete from goals where id = $1 returning id`,
    [goal],
  );
  harusSama(rows.length, 1, "goal terhapus");

  const t = await satu(`select tipe, goal_id from tasks where id = $1`, [komitmen]);
  harusSama(t, { tipe: "tiket", goal_id: null });
  harusSama((await notif(RIAN)).length, sebelum, "rembetan tidak dikabarkan");
});

uji("migrasi aman dijalankan ulang", async () => {
  await sebagaiAdmin(db, MIGRASI);
  await sebagaiAdmin(db, MIGRASI);
  const { n } = await satu(
    `select count(*)::int n from pg_trigger
      where tgname in ('tasks_jaga_hapus', 'notifikasi_tiket_diubah_trg',
                       'notifikasi_tiket_dihapus_trg', 'tasks_a_kunci_isi_tiket')`,
  );
  harusSama(n, 4);

  const tid = (
    await satu(`select id from tasks where judul = 'Rapikan stok sampel skincare'`)
  ).id;
  const e = await galatDari(() =>
    sebagai(db, DEWI, `delete from tasks where id = $1`, [tid]),
  );
  harusGalat(e, "sudah selesai tidak bisa dihapus");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
