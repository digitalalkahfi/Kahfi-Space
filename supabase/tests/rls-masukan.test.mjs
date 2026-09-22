/**
 * Otorisasi Masukan & Bug.
 *
 * Melapor, membaca, mendukung, dan berkomentar terbuka bagi semua anggota
 * — laporan yang harus diminta izinnya dulu tidak akan pernah masuk.
 * Yang dipersempit adalah hak mengubah: pengirim hanya isinya sendiri
 * selama belum ditinjau, penanggung jawab hanya statusnya.
 */
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
const { uji, jalankan } = buatSuite("Otorisasi masukan");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

let masukanId;

uji("siapa pun yang masuk boleh melapor dan membacanya", async () => {
  const staf = await id("Nabila Putri");
  masukanId = (
    await sebagai(
      db,
      staf,
      `insert into feedback (jenis, judul, isi, halaman, dilaporkan_oleh)
       values ('bug', 'Judul salah ketiik pada laporan', 'isi laporan', '/laporan-harian', $1)
       returning id`,
      [staf],
    )
  ).rows[0].id;

  const lain = await id("Yoga Saputra");
  const { rows } = await sebagai(
    db,
    lain,
    "select count(*)::int n from feedback where id = $1",
    [masukanId],
  );
  harusSama(Number(rows[0].n), 1, "laporan orang lain tetap terbaca");
});

uji("pengirim boleh membetulkan judul laporannya sendiri", async () => {
  const staf = await id("Nabila Putri");
  await sebagai(db, staf, "update feedback set judul = $1 where id = $2", [
    "Judul salah ketik pada laporan",
    masukanId,
  ]);
  harusSama(
    (await sebagaiAdmin(db, "select judul from feedback where id = $1", [masukanId]))
      .rows[0].judul,
    "Judul salah ketik pada laporan",
  );
});

uji("pengirim tidak bisa menaikkan status laporannya sendiri", async () => {
  const staf = await id("Nabila Putri");
  await harusDitolak(
    () =>
      sebagai(db, staf, "update feedback set status = 'selesai' where id = $1", [
        masukanId,
      ]),
    "pengirim menandai selesai sendiri seharusnya ditolak",
  );
});

uji("orang lain tidak bisa menyunting laporan yang bukan miliknya", async () => {
  const lain = await id("Yoga Saputra");
  await sebagai(db, lain, "update feedback set judul = 'Diambil alih' where id = $1", [
    masukanId,
  ]);
  harus(
    (await sebagaiAdmin(db, "select judul from feedback where id = $1", [masukanId]))
      .rows[0].judul !== "Diambil alih",
    "laporan orang lain tidak boleh tersentuh",
  );
});

uji("penanggung jawab menggerakkan status tugasnya", async () => {
  const staf = await id("Nabila Putri");
  const manajer = await id("Farhan Pratama");
  await sebagai(db, manajer, "update feedback set ditugaskan_ke = $1 where id = $2", [
    staf,
    masukanId,
  ]);

  await sebagai(db, staf, "update feedback set status = 'dikerjakan' where id = $1", [
    masukanId,
  ]);
  harusSama(
    (await sebagaiAdmin(db, "select status from feedback where id = $1", [masukanId]))
      .rows[0].status,
    "dikerjakan",
  );
});

uji("penanggung jawab tidak bisa menulis ulang isinya", async () => {
  const staf = await id("Nabila Putri");
  await harusDitolak(
    () =>
      sebagai(db, staf, "update feedback set isi = 'Diubah penanggung' where id = $1", [
        masukanId,
      ]),
    "penyuntingan isi oleh penanggung jawab seharusnya ditolak",
  );
});

uji("penanggung jawab tidak bisa menolak laporan", async () => {
  // Penolakan adalah keputusan pengelola, dan wajib berisi alasan.
  const staf = await id("Nabila Putri");
  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        "update feedback set status = 'ditolak' where id = $1",
        [masukanId],
      ),
    "penolakan oleh penanggung jawab seharusnya ditolak",
  );
});

uji("pengirim tidak lagi bisa menyunting setelah ditinjau", async () => {
  const staf = await id("Nabila Putri");
  const manajer = await id("Farhan Pratama");
  await sebagai(db, manajer, "update feedback set ditugaskan_ke = null where id = $1", [
    masukanId,
  ]);
  await sebagai(db, manajer, "update feedback set status = 'ditinjau' where id = $1", [
    masukanId,
  ]);

  await sebagai(db, staf, "update feedback set judul = $1 where id = $2", [
    "Judul diubah setelah ditinjau",
    masukanId,
  ]);
  harus(
    (await sebagaiAdmin(db, "select judul from feedback where id = $1", [masukanId]))
      .rows[0].judul !== "Judul diubah setelah ditinjau",
    "laporan yang sudah ditinjau tidak boleh berubah diam-diam",
  );
});

uji("dukungan dan komentar tetap terbuka untuk semua", async () => {
  const lain = await id("Yoga Saputra");
  await sebagai(
    db,
    lain,
    "insert into feedback_votes (feedback_id, user_id) values ($1, $2)",
    [masukanId, lain],
  );
  await sebagai(
    db,
    lain,
    "insert into feedback_comments (feedback_id, oleh_id, isi) values ($1, $2, 'Saya juga mengalaminya')",
    [masukanId, lain],
  );

  harusSama(
    Number(
      (await sebagaiAdmin(
        db,
        "select count(*)::int n from feedback_votes where feedback_id = $1",
        [masukanId],
      )).rows[0].n,
    ),
    1,
  );
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
