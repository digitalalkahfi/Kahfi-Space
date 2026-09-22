/** Riwayat pemindaian QR: tercatat apa adanya, termasuk kode asing. */
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
const { uji, jalankan } = buatSuite("Riwayat scan sampel");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const sampelId = async (kode) =>
  (await sebagaiAdmin(db, "select id from samples where kode = $1", [kode]))
    .rows[0].id;

uji("pemindaian yang dikenali menyebut sampelnya", async () => {
  const staf = await id("Nabila Putri");
  const sampel = await sampelId("SMP-0003");
  await sebagai(
    db,
    staf,
    `insert into sample_scans (kode, sample_id, oleh_id, dikenali)
     values ('SMP-0003', $1, $2, true)`,
    [sampel, staf],
  );

  const { rows } = await sebagaiAdmin(
    db,
    "select dikenali, sample_id from sample_scans where kode = 'SMP-0003'",
  );
  harusSama(rows[0].dikenali, true);
  harusSama(rows[0].sample_id, sampel);
});

uji("kode asing ikut tercatat, tanpa sampel", async () => {
  // Kode inilah yang menunjukkan label tertukar atau stiker lama.
  const staf = await id("Nabila Putri");
  for (let i = 0; i < 2; i += 1) {
    await sebagai(
      db,
      staf,
      `insert into sample_scans (kode, oleh_id, dikenali)
       values ('SMP-LAMA-9', $1, false)`,
      [staf],
    );
  }

  // Data contoh sudah memuat kode asingnya sendiri; yang diuji di sini
  // hanya kode yang baru saja dipindai.
  const { rows } = await sebagaiAdmin(
    db,
    "select * from kode_asing() where kode = 'SMP-LAMA-9'",
  );
  harusSama(rows.length, 1);
  harusSama(rows[0].jumlah, 2);
});

uji("dikenali tanpa sampel ditolak", async () => {
  const staf = await id("Nabila Putri");
  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        `insert into sample_scans (kode, oleh_id, dikenali) values ('SMP-X', $1, true)`,
        [staf],
      ),
    "dikenali tanpa sampel seharusnya ditolak",
  );
});

uji("pemindaian tidak bisa diatasnamakan orang lain", async () => {
  const staf = await id("Nabila Putri");
  const lain = await id("Anisa Larasati");
  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        `insert into sample_scans (kode, oleh_id, dikenali) values ('SMP-Y', $1, false)`,
        [lain],
      ),
    "pemindaian atas nama orang lain seharusnya ditolak",
  );
});

uji("isi pemindaian tidak bisa disunting", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "update sample_scans set kode = 'SMP-DIUBAH' where kode = 'SMP-LAMA-9'",
      ),
    "penyuntingan riwayat pemindaian seharusnya ditolak",
  );
});

uji("perpindahan yang menyusul boleh disambungkan sekali", async () => {
  const staf = await id("Nabila Putri");
  const sampel = await sampelId("SMP-0003");
  const kejadian = (
    await sebagaiAdmin(
      db,
      `insert into sample_events (sample_id, ke, oleh_id) values ($1, 'tersedia', $2)
       returning id`,
      [sampel, staf],
    )
  ).rows[0].id;

  const scan = (
    await sebagaiAdmin(
      db,
      "select id from sample_scans where kode = 'SMP-0003' limit 1",
    )
  ).rows[0].id;

  await sebagai(db, staf, "update sample_scans set kejadian_id = $1 where id = $2", [
    kejadian,
    scan,
  ]);
  harusSama(
    (await sebagaiAdmin(db, "select kejadian_id from sample_scans where id = $1", [scan]))
      .rows[0].kejadian_id,
    kejadian,
  );

  // Sekali tersambung, tidak bisa dialihkan ke perpindahan lain.
  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update sample_scans set kejadian_id = null where id = $1", [scan]),
    "melepas sambungan seharusnya ditolak",
  );
});

uji("riwayat pemindaian tidak bisa dihapus", async () => {
  await harusDitolak(
    () => sebagaiAdmin(db, "delete from sample_scans where kode = 'SMP-LAMA-9'"),
    "penghapusan riwayat pemindaian seharusnya ditolak",
  );
  harus(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from sample_scans")).rows[0].n,
    ) > 0,
    "riwayatnya harus tetap ada",
  );
});

uji("orang lain tidak membaca pemindaian kode asing", async () => {
  // Kode asing belum tentu menyangkut unit mana pun, jadi hanya pemindai
  // dan pengelola sampel yang melihatnya.
  const lain = await id("Yoga Saputra"); // Staff TAP
  const { rows } = await sebagai(
    db,
    lain,
    "select count(*)::int n from sample_scans where dikenali = false",
  );
  harusSama(Number(rows[0].n), 0);
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
