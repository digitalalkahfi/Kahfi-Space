/**
 * Tim manajemen (0164): Staff boleh tanpa unit hanya bila atasan
 * langsungnya CEO atau Manager. Leader dan Co-Leader tetap wajib punya
 * unit.
 */
import {
  buatDb,
  buatSuite,
  harusDitolak,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Tim manajemen");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const MANAJER = (
  await satu(`select id from users where role = 'Manager' limit 1`)
).id;
const CEO = (await satu(`select id from users where role = 'CEO' limit 1`)).id;
const LEADER = (
  await satu(`select id from users where role = 'Leader' limit 1`)
).id;

const tambah = (email, atasan, role = "Staff") =>
  sebagai(
    db,
    MANAJER,
    `insert into users (id, nama, email, role, jabatan, unit_id, atasan_id, status)
     values (gen_random_uuid(), 'Staf Tim Manajemen', $1, $2, 'Administrasi', null, $3, 'aktif')
     returning id`,
    [email, role, atasan],
  );

uji("Staff aktif tanpa unit diterima bila atasannya Manager", async () => {
  const { rows } = await tambah("tm-manager@alkahfi.co.id", MANAJER);
  harusSama(rows.length, 1);
});

uji("Staff aktif tanpa unit diterima bila atasannya CEO", async () => {
  const { rows } = await tambah("tm-ceo@alkahfi.co.id", CEO);
  harusSama(rows.length, 1);
});

uji("Staff aktif tanpa unit ditolak bila tanpa atasan", async () => {
  await harusDitolak(
    () => tambah("tm-kosong@alkahfi.co.id", null),
    "Staff tanpa unit dan tanpa atasan seharusnya ditolak",
  );
});

uji("Staff aktif tanpa unit ditolak bila atasannya Leader", async () => {
  // Tanpa unit ia tidak terjaring lingkup Leader itu; ini bukan tim
  // manajemen, melainkan staf yang belum ditempatkan.
  await harusDitolak(
    () => tambah("tm-leader@alkahfi.co.id", LEADER),
    "Staff tanpa unit di bawah Leader seharusnya ditolak",
  );
});

uji("Leader tetap wajib punya unit", async () => {
  await harusDitolak(
    () => tambah("tm-leader-baru@alkahfi.co.id", MANAJER, "Leader"),
    "Leader tanpa unit seharusnya ditolak",
  );
});

uji(
  "Staff tim manajemen yang dipindahkan ke unit ikut aturan unit",
  async () => {
    const { rows } = await tambah("tm-pindah@alkahfi.co.id", MANAJER);
    const unit = (await satu(`select id from units where kode = 'affiliator'`))
      .id;
    const ubah = await sebagai(
      db,
      MANAJER,
      `update users set unit_id = $1 where id = $2 returning department_id`,
      [unit, rows[0].id],
    );
    harusSama(ubah.rows.length, 1);
    harusSama(
      ubah.rows[0].department_id !== null,
      true,
      "departemen ikut unit barunya",
    );
  },
);

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
