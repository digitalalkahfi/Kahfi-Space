/**
 * Delegasi to-do ke bawahan (migrasi 0186).
 *
 * Dijalankan sebagai peran `authenticated` dengan RLS aktif: to-do berubah
 * menjadi tiket dari pemiliknya, hanya ke orang yang boleh ia tugasi, dan
 * setelahnya berjalan seperti tiket biasa — termasuk QC oleh pemberinya.
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
const { uji, jalankan } = buatSuite("Delegasi to-do ke bawahan (0186)");

const MIGRASI = await readFile(
  path.join(process.cwd(), "supabase", "migrations", "0186_delegasi_todo.sql"),
  "utf8",
);

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu(`select id from users where nama = $1`, [nama])).id;

const MANAGER = await id("Farhan Pratama");
const DEWI = await id("Dewi Lestari"); // Leader Affiliator
const NABILA = await id("Nabila Putri"); // Staff, bawahan Dewi
const RIAN = await id("Rian Hidayat"); // Staff, bawahan Dewi
const RIZKY = await id("Rizky Ananda"); // Staff MCN — di luar cakupan Dewi

const buatToDo = async (pemilik, judul, status = "todo", tanpaJam = false) =>
  (
    await satu(
      `insert into tasks (tipe, judul, deskripsi, pembuat_id, penerima_id,
                          tenggat, tanpa_jam, status)
       values ('pribadi', $1, 'Langkah: cek data, rekap, kirim ke grup.',
               $2, $2, $3, $4, $5)
       returning id`,
      [
        judul,
        pemilik,
        tanpaJam ? "2026-10-02T23:59:00+07:00" : "2026-10-02T15:00:00+07:00",
        tanpaJam,
        status,
      ],
    )
  ).id;

/** Delegasi seperti yang dikirim aplikasi: tiket, penerima baru, To Do. */
const delegasikan = (oleh, tid, penerima, tambahan = "") =>
  sebagai(
    db,
    oleh,
    `update tasks set tipe = 'tiket', penerima_id = $2, status = 'todo',
            tanpa_jam = false ${tambahan}
      where id = $1 returning id`,
    [tid, penerima],
  );

/** Galat yang dilempar fn, atau null bila berhasil. */
const galatDari = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
};

const harusGalat = (e, potongan) => {
  harus(e, `seharusnya ditolak (${potongan})`);
  harus(pesanDb(e).includes(potongan), `pesan tidak sesuai: ${pesanDb(e)}`);
};

const baris = (tid) =>
  satu(
    `select tipe, pembuat_id, penerima_id, status, deskripsi, tanpa_jam
       from tasks where id = $1`,
    [tid],
  );

uji(
  "Leader mendelegasikan to-do-nya ke bawahan; bawahan dikabari",
  async () => {
    const tid = await buatToDo(
      DEWI,
      "Rekap order pending pekan ini",
      "berjalan",
    );
    const { rows } = await delegasikan(DEWI, tid, NABILA);
    harusSama(rows.length, 1, "delegasi berhasil");

    harusSama(await baris(tid), {
      tipe: "tiket",
      pembuat_id: DEWI,
      penerima_id: NABILA,
      status: "todo",
      deskripsi: "Langkah: cek data, rekap, kirim ke grup.",
      tanpa_jam: false,
    });

    const { judul } = await satu(
      `select judul from notifications
      where user_id = $1 and kategori = 'tugas'
      order by created_at desc, id limit 1`,
      [NABILA],
    );
    harusSama(judul, "Tugas dialihkan kepadamu: Rekap order pending pekan ini");
  },
);

uji(
  "tiket hasil delegasi berjalan seperti tiket biasa, sampai QC",
  async () => {
    const tid = await buatToDo(DEWI, "Kurasi 5 kreator skincare");
    await delegasikan(DEWI, tid, NABILA);

    await sebagai(
      db,
      NABILA,
      `update tasks set status = 'menunggu_qc',
            hasil_kerja = 'Lima kreator sudah dihubungi dan setuju.'
      where id = $1`,
      [tid],
    );
    const { rows } = await sebagai(
      db,
      DEWI,
      `update tasks set qc_status = 'lolos' where id = $1 returning status`,
      [tid],
    );
    harusSama(rows[0]?.status, "selesai", "pemilik to-do memeriksa hasilnya");
  },
);

uji("hanya ke orang yang boleh ditugasi", async () => {
  const tid = await buatToDo(DEWI, "To-do lintas unit");
  harusGalat(
    await galatDari(() => delegasikan(DEWI, tid, RIZKY)),
    "boleh kamu tugasi",
  );
  harusSama((await baris(tid)).tipe, "pribadi", "to-do tetap to-do");

  // Staf tanpa bawahan tidak bisa mendelegasikan ke rekannya.
  const milikRian = await buatToDo(RIAN, "To-do Rian");
  harusGalat(
    await galatDari(() => delegasikan(RIAN, milikRian, NABILA)),
    "boleh kamu tugasi",
  );

  // Manager boleh menugasi lintas unit — begitu juga mendelegasikan.
  const milikManager = await buatToDo(MANAGER, "To-do Manager");
  const { rows } = await delegasikan(MANAGER, milikManager, RIZKY);
  harusSama(rows.length, 1);
});

uji(
  "tidak ke diri sendiri, tidak sebagai komitmen, tidak yang sudah selesai",
  async () => {
    const tid = await buatToDo(DEWI, "To-do Dewi");
    harusGalat(
      await galatDari(() => delegasikan(DEWI, tid, DEWI)),
      "Pilih bawahan",
    );
    harusGalat(
      await galatDari(() =>
        sebagai(
          db,
          DEWI,
          `update tasks set tipe = 'komitmen_mingguan', penerima_id = $2,
                goal_id = (select id from goals limit 1), tanpa_jam = false
          where id = $1`,
          [tid, NABILA],
        ),
      ),
      "tiket biasa",
    );

    const beres = await buatToDo(DEWI, "To-do Dewi yang beres", "selesai");
    harusGalat(
      await galatDari(() => delegasikan(DEWI, beres, NABILA)),
      "sudah selesai",
    );
  },
);

uji("pemberi tiket hasil delegasi tetap pemilik to-do", async () => {
  const tid = await buatToDo(DEWI, "To-do berpindah pemberi");
  harusGalat(
    await galatDari(() =>
      delegasikan(DEWI, tid, NABILA, `, pembuat_id = '${MANAGER}'`),
    ),
    "pemilik to-do",
  );
});

uji("orang lain tidak bisa mendelegasikan to-do seseorang", async () => {
  const tid = await buatToDo(RIAN, "To-do milik Rian");
  const e = await galatDari(() => delegasikan(MANAGER, tid, NABILA));
  harusGalat(e, "Isi to-do hanya bisa diubah pemiliknya");
});

uji("tiket wajib berjam: to-do tanpa jam harus diberi jam", async () => {
  const tid = await buatToDo(DEWI, "To-do tanpa jam", "todo", true);
  const e = await galatDari(() =>
    sebagai(
      db,
      DEWI,
      `update tasks set tipe = 'tiket', penerima_id = $2 where id = $1`,
      [tid, NABILA],
    ),
  );
  harusGalat(e, "tasks_tanpa_jam_hanya_todo");

  const { rows } = await delegasikan(
    DEWI,
    tid,
    NABILA,
    `, tenggat = '2026-10-02T17:00:00+07:00'`,
  );
  harusSama(rows.length, 1, "dengan jam, delegasi diterima");
});

uji("migrasi aman dijalankan ulang", async () => {
  await sebagaiAdmin(db, MIGRASI);
  await sebagaiAdmin(db, MIGRASI);
  const tid = await buatToDo(DEWI, "To-do sesudah diulang");
  harusGalat(
    await galatDari(() => delegasikan(DEWI, tid, RIZKY)),
    "boleh kamu tugasi",
  );
  // Aturan 0184 tetap ada: tiket selesai terkunci.
  const selesai = (
    await satu(
      `select id from tasks where judul = 'Rapikan stok sampel skincare'`,
    )
  ).id;
  harusGalat(
    await galatDari(() =>
      sebagai(db, DEWI, `update tasks set judul = 'Diganti' where id = $1`, [
        selesai,
      ]),
    ),
    "sudah selesai",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
