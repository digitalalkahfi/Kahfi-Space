/** Masukan & bug: jejak status, alasan penolakan, dan dukungan. */
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
const { uji, jalankan } = buatSuite("Masukan & bug");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const masukanId = async (awalJudul) =>
  (await sebagaiAdmin(db, "select id from feedback where judul like $1", [`${awalJudul}%`]))
    .rows[0].id;

uji("keparahan hanya berlaku untuk bug", async () => {
  // Keparahan pada saran hanya membuat papan prioritas berisik.
  const { rows } = await sebagaiAdmin(
    db,
    "select jenis, keparahan from feedback where jenis <> 'bug'",
  );
  harus(
    rows.every((r) => r.keparahan === null),
    "non-bug tidak boleh punya keparahan",
  );
});

uji("bug tanpa keparahan diberi nilai bawaan", async () => {
  await sebagaiAdmin(
    db,
    `insert into feedback (jenis, judul, dilaporkan_oleh)
     values ('bug', 'Tombol simpan tidak merespons di halaman tugas',
             (select id from users where nama = 'Rian Hidayat'))`,
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select keparahan from feedback where judul like 'Tombol simpan%'",
  );
  harusSama(rows[0].keparahan, "sedang");
});

uji("perubahan status meninggalkan jejak", async () => {
  const m = await masukanId("Izinkan mengunduh rekap");
  await sebagai(db, await id("Farhan Pratama"), "update feedback set status = 'ditinjau' where id = $1", [m]);

  const { rows } = await sebagaiAdmin(
    db,
    "select dari, ke, oleh_id from feedback_events where feedback_id = $1",
    [m],
  );
  harusSama(rows.length, 1);
  harusSama(rows[0].dari, "baru");
  harusSama(rows[0].ke, "ditinjau");
  harusSama(rows[0].oleh_id, await id("Farhan Pratama"));
});

uji("menolak tanpa alasan ditolak database", async () => {
  // Laporan yang ditolak tanpa kabar adalah cara tercepat membuat orang
  // berhenti melapor.
  const m = await masukanId("Izinkan mengunduh rekap");
  await harusDitolak(
    () => sebagaiAdmin(db, "update feedback set status = 'ditolak' where id = $1", [m]),
    "penolakan tanpa alasan seharusnya ditolak",
  );
});

uji("menolak dengan alasan tercatat di jejaknya", async () => {
  const m = await masukanId("Izinkan mengunduh rekap");
  await sebagaiAdmin(
    db,
    "update feedback set status = 'ditolak', alasan_tolak = $2 where id = $1",
    [m, "Sudah tersedia lewat menu ekspor yang ada."],
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select catatan from feedback_events where feedback_id = $1 and ke = 'ditolak'",
    [m],
  );
  harus(rows[0].catatan.length > 0, "alasan penolakan harus ikut tercatat");
  await terapkanSeed(db);
});

uji("satu orang hanya bisa mendukung sekali", async () => {
  const m = await masukanId("Tambahkan pengingat laporan");
  const orang = await id("Rian Hidayat");
  await sebagai(db, orang, "insert into feedback_votes (feedback_id, user_id) values ($1, $2)", [m, orang]);
  await harusDitolak(
    () =>
      sebagai(db, orang, "insert into feedback_votes (feedback_id, user_id) values ($1, $2)", [m, orang]),
    "dukungan ganda seharusnya ditolak",
  );
});

uji("tidak bisa mendukung atas nama orang lain", async () => {
  const m = await masukanId("Tambahkan pengingat laporan");
  await harusDitolak(
    async () =>
      sebagai(
        db,
        await id("Rian Hidayat"),
        "insert into feedback_votes (feedback_id, user_id) values ($1, $2)",
        [m, await id("Farhan Pratama")],
      ),
    "mendukung atas nama orang lain seharusnya ditolak",
  );
});

uji("setiap anggota melihat seluruh masukan", async () => {
  // Menutup masukan orang lain membuat hal yang sama dilaporkan berulang.
  const { rows: staf } = await sebagai(
    db,
    await id("Rian Hidayat"),
    "select count(*)::int n from feedback",
  );
  const { rows: semua } = await sebagaiAdmin(db, "select count(*)::int n from feedback");
  harusSama(staf[0].n, semua[0].n);
});

uji("Staff tidak bisa mengubah status masukan", async () => {
  const m = await masukanId("Tambahkan pengingat laporan");
  await sebagai(db, await id("Rian Hidayat"), "update feedback set status = 'selesai' where id = $1", [m]);
  const { rows } = await sebagaiAdmin(db, "select status from feedback where id = $1", [m]);
  harus(rows[0].status !== "selesai", "Staff seharusnya tidak bisa mengubah status");
});

uji("Staff tidak bisa melapor atas nama orang lain", async () => {
  await harusDitolak(
    async () =>
      sebagai(
        db,
        await id("Rian Hidayat"),
        "insert into feedback (judul, dilaporkan_oleh) values ('Laporan atas nama orang lain', $1)",
        [await id("Farhan Pratama")],
      ),
    "melapor atas nama orang lain seharusnya ditolak",
  );
});

uji("bug tanpa keparahan diisi 'sedang', bukan ditolak", async () => {
  // Melaporkan bug harus semudah mungkin; keparahannya bisa dirapikan
  // pengelola kemudian.
  const staf = (
    await sebagaiAdmin(db, "select id from users where nama = 'Nabila Putri'")
  ).rows[0].id;
  await sebagai(
    db,
    staf,
    `insert into feedback (jenis, judul, isi, dilaporkan_oleh)
     values ('bug', 'Tombol simpan tidak merespons', 'di halaman laporan', $1)`,
    [staf],
  );

  harusSama(
    (await sebagaiAdmin(
      db,
      "select keparahan from feedback where judul = 'Tombol simpan tidak merespons'",
    )).rows[0].keparahan,
    "sedang",
  );
});

uji("keparahan pada saran dibersihkan, bukan ditolak", async () => {
  const staf = (
    await sebagaiAdmin(db, "select id from users where nama = 'Nabila Putri'")
  ).rows[0].id;
  await sebagai(
    db,
    staf,
    `insert into feedback (jenis, judul, isi, keparahan, dilaporkan_oleh)
     values ('saran', 'Tambahkan pintasan ke laporan harian', '', 'kritis', $1)`,
    [staf],
  );

  harusSama(
    (await sebagaiAdmin(
      db,
      "select keparahan from feedback where judul = 'Tambahkan pintasan ke laporan harian'",
    )).rows[0].keparahan,
    null,
  );
});

uji("tugas tidak bisa diberikan ke orang nonaktif", async () => {
  const nonaktif = (
    await sebagaiAdmin(db, "select id from users where status = 'nonaktif' limit 1")
  ).rows[0].id;
  const masukan = (
    await sebagaiAdmin(db, "select id from feedback limit 1")
  ).rows[0].id;

  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update feedback set ditugaskan_ke = $1 where id = $2", [
        nonaktif,
        masukan,
      ]),
    "penugasan ke orang nonaktif seharusnya ditolak",
  );
});

uji("menonaktifkan penerima tugas melepaskan masukannya", async () => {
  const orang = (
    await sebagaiAdmin(db, "select id from users where nama = 'Anisa Larasati'")
  ).rows[0].id;
  const masukan = (
    await sebagaiAdmin(db, "select id from feedback limit 1")
  ).rows[0].id;

  await sebagaiAdmin(db, "update feedback set ditugaskan_ke = $1 where id = $2", [
    orang,
    masukan,
  ]);
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [orang]);

  const sesudah = (
    await sebagaiAdmin(
      db,
      "select ditugaskan_ke, status from feedback where id = $1",
      [masukan],
    )
  ).rows[0];
  harusSama(
    sesudah.ditugaskan_ke,
    null,
    "laporan tidak boleh menggantung atas nama orang yang sudah pergi",
  );
  harus(
    sesudah.status !== "dikerjakan",
    "laporan tanpa penanggung jawab tidak boleh tampak sedang dikerjakan",
  );
  await terapkanSeed(db);
});

uji("menandai dikerjakan tanpa penanggung jawab ditolak", async () => {
  // Status yang menenangkan tanpa ada yang mengerjakan adalah bentuk
  // paling halus dari laporan yang menghilang.
  const masukan = (
    await sebagaiAdmin(
      db,
      "select id from feedback where status = 'baru' limit 1",
    )
  ).rows[0].id;

  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update feedback set status = 'dikerjakan' where id = $1", [
        masukan,
      ]),
    "dikerjakan tanpa penanggung jawab seharusnya ditolak",
  );
});

uji("menandai dikerjakan sekaligus menunjuk penanggung jawab", async () => {
  const manajer = (
    await sebagaiAdmin(db, "select id from users where nama = 'Farhan Pratama'")
  ).rows[0].id;
  const masukan = (
    await sebagaiAdmin(
      db,
      "select id from feedback where status = 'baru' limit 1",
    )
  ).rows[0].id;

  await sebagaiAdmin(
    db,
    "update feedback set status = 'dikerjakan', ditugaskan_ke = $1 where id = $2",
    [manajer, masukan],
  );
  harusSama(
    (await sebagaiAdmin(db, "select status from feedback where id = $1", [masukan]))
      .rows[0].status,
    "dikerjakan",
  );
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
