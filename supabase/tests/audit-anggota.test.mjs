/** Jejak perubahan data anggota: siapa mengubah apa, dari apa ke apa. */
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
const { uji, jalankan } = buatSuite("Jejak anggota");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const jejakTerakhir = async (orangId) =>
  (
    await sebagaiAdmin(
      db,
      `select aksi, user_id, nilai_lama, nilai_baru from audit_logs
        where entitas = 'users' and entitas_id = $1
        order by created_at desc limit 1`,
      [orangId],
    )
  ).rows[0];

uji("penambahan anggota terekam", async () => {
  const manajer = await id("Farhan Pratama");
  const unit = (await sebagaiAdmin(db, "select id from units where kode = 'tap'"))
    .rows[0].id;

  await sebagai(
    db,
    manajer,
    `insert into users (id, nama, email, role, jabatan, unit_id)
     values (gen_random_uuid(), 'Rekrutan Jejak', 'jejak@alkahfi.co.id',
             'Staff', 'Staff TAP', $1)`,
    [unit],
  );

  const orang = await id("Rekrutan Jejak");
  const j = await jejakTerakhir(orang);
  harusSama(j.aksi, "insert");
  harusSama(j.user_id, manajer, "pencatat jejak harus orang yang mengubah");
  harusSama(j.nilai_lama, null);
  harusSama(j.nilai_baru.nama, "Rekrutan Jejak");
});

uji("kenaikan peran terekam lengkap dengan nilai lamanya", async () => {
  const orang = await id("Rekrutan Jejak");
  const manajer = await id("Farhan Pratama");
  await sebagai(db, manajer, "update users set role = 'Co-Leader' where id = $1", [orang]);

  const j = await jejakTerakhir(orang);
  harusSama(j.aksi, "update");
  harusSama(j.nilai_lama.role, "Staff");
  harusSama(j.nilai_baru.role, "Co-Leader");
});

uji("perpindahan atasan dan unit ikut terekam", async () => {
  const orang = await id("Rekrutan Jejak");
  const manajer = await id("Farhan Pratama");
  const affiliator = (
    await sebagaiAdmin(db, "select id from units where kode = 'affiliator'")
  ).rows[0].id;

  await sebagai(
    db,
    manajer,
    "update users set unit_id = $1, atasan_id = $2 where id = $3",
    [affiliator, manajer, orang],
  );

  const j = await jejakTerakhir(orang);
  harus(j.nilai_lama.unit_id !== j.nilai_baru.unit_id, "unitnya harus tercatat berubah");
  harusSama(j.nilai_baru.atasan_id, manajer);
});

uji("suntingan yang tidak mengubah kolom berarti tidak dicatat", async () => {
  const orang = await id("Rekrutan Jejak");
  const sebelum = Number(
    (
      await sebagaiAdmin(
        db,
        "select count(*)::int n from audit_logs where entitas = 'users' and entitas_id = $1",
        [orang],
      )
    ).rows[0].n,
  );

  await sebagaiAdmin(db, "update users set foto_url = 'https://contoh/x.jpg' where id = $1", [
    orang,
  ]);

  harusSama(
    Number(
      (
        await sebagaiAdmin(
          db,
          "select count(*)::int n from audit_logs where entitas = 'users' and entitas_id = $1",
          [orang],
        )
      ).rows[0].n,
    ),
    sebelum,
    "perubahan foto tidak menambah jejak",
  );
});

uji("penonaktifan terekam sebagai perubahan status", async () => {
  const orang = await id("Rekrutan Jejak");
  const manajer = await id("Farhan Pratama");
  await sebagai(db, manajer, "update users set status = 'nonaktif' where id = $1", [orang]);

  const j = await jejakTerakhir(orang);
  harusSama(j.nilai_lama.status, "aktif");
  harusSama(j.nilai_baru.status, "nonaktif");
});

uji("jejak hanya terbaca pengelola angka", async () => {
  const staf = await id("Nabila Putri");
  const { rows } = await sebagai(
    db,
    staf,
    "select count(*)::int n from audit_logs where entitas = 'users'",
  );
  harusSama(Number(rows[0].n), 0, "Staff tidak boleh membaca jejak kepegawaian");

  const manajer = await id("Farhan Pratama");
  const pengelola = await sebagai(
    db,
    manajer,
    "select count(*)::int n from audit_logs where entitas = 'users'",
  );
  harus(Number(pengelola.rows[0].n) > 0, "Manager harus bisa membacanya");
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
