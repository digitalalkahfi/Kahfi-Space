/**
 * Penjual: kendala tabel, penjaga PIC, dan otorisasi per peran (0166).
 *
 * Mitra milik unit: anggota unit membacanya, leader unit dan PIC yang
 * merawatnya, CEO/Manager lintas unit. Staf unit lain tidak melihat.
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
const { uji, jalankan } = buatSuite("Penjual");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;
const unitId = async (kode) =>
  (await sebagaiAdmin(db, "select id from units where kode = $1", [kode]))
    .rows[0].id;
const hitung = async (userId, sql, params = []) =>
  Number((await sebagai(db, userId, sql, params)).rows[0].n);

const U = {
  manager: await id("Farhan Pratama"),
  finance: await id("Laras Ayuningtyas"),
  leaderTap: await id("Dimas Maulana"),
  leaderMcn: await id("Galih Prakoso"),
  yoga: await id("Yoga Saputra"), // Staff TAP, PIC Torch.id
  hendra: await id("Hendra Kusuma"), // Staff TAP
  rian: await id("Rian Hidayat"), // Staff Affiliator
};
const TAP = await unitId("tap");
const MCN = await unitId("mcn");

uji("seed: mitra TAP terbaca anggota TAP, tidak oleh staf unit lain", async () => {
  harusSama(await hitung(U.hendra, "select count(*)::int n from sellers where unit_id = $1", [TAP]), 3);
  harusSama(await hitung(U.rian, "select count(*)::int n from sellers where unit_id = $1", [TAP]), 0);
  // Finance melihat semua unit (angka lintas unit).
  harusSama(await hitung(U.finance, "select count(*)::int n from sellers"), 4);
});

uji("nama toko wajib dan komisi dibatasi 0–100", async () => {
  await harusDitolak(
    () => sebagaiAdmin(db, `insert into sellers (nama_toko, unit_id) values ('x', $1)`, [TAP]),
    "nama toko satu huruf seharusnya ditolak",
  );
  await harusDitolak(
    () => sebagaiAdmin(db, `insert into sellers (nama_toko, unit_id, komisi_persen) values ('Toko', $1, 120)`, [TAP]),
    "komisi 120% seharusnya ditolak",
  );
});

uji("PIC harus anggota aktif dari unit mitra itu", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into sellers (nama_toko, unit_id, pic_user_id) values ('Toko MCN', $1, $2)`,
        [MCN, U.yoga],
      ),
    "PIC dari unit lain seharusnya ditolak",
  );
  const nonaktif = await id("Yusuf Ramadhan");
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into sellers (nama_toko, unit_id, pic_user_id) values ('Toko', $1, $2)`,
        [TAP, nonaktif],
      ),
    "PIC nonaktif seharusnya ditolak",
  );
  // Manager tanpa unit boleh memegang mitra unit mana pun.
  const { rows } = await sebagaiAdmin(
    db,
    `insert into sellers (nama_toko, unit_id, pic_user_id) values ('Toko Manager', $1, $2) returning id`,
    [TAP, U.manager],
  );
  harus(rows[0].id, "PIC tanpa unit harus diterima");
});

uji("leader unit boleh menambah untuk unitnya, tidak untuk unit lain", async () => {
  await sebagai(
    db,
    U.leaderTap,
    `insert into sellers (nama_toko, unit_id, dibuat_oleh) values ('Mitra Dimas', $1, $2)`,
    [TAP, U.leaderTap],
  );
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.leaderTap,
        `insert into sellers (nama_toko, unit_id, dibuat_oleh) values ('Mitra salah unit', $1, $2)`,
        [MCN, U.leaderTap],
      ),
    "leader TAP menambah mitra MCN seharusnya ditolak",
  );
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.hendra,
        `insert into sellers (nama_toko, unit_id, dibuat_oleh) values ('Mitra staf', $1, $2)`,
        [TAP, U.hendra],
      ),
    "staf biasa menambah mitra seharusnya ditolak",
  );
});

uji("PIC boleh memperbarui catatan mitranya; staf lain tidak (RLS diam)", async () => {
  const torch = (
    await sebagaiAdmin(db, "select id from sellers where nama_toko = 'Torch.id'")
  ).rows[0].id;

  await sebagai(db, U.yoga, "update sellers set catatan = 'dari PIC' where id = $1", [torch]);
  harusSama(
    (await sebagaiAdmin(db, "select catatan from sellers where id = $1", [torch])).rows[0].catatan,
    "dari PIC",
  );

  await sebagai(db, U.hendra, "update sellers set catatan = 'dari staf lain' where id = $1", [torch]);
  harusSama(
    (await sebagaiAdmin(db, "select catatan from sellers where id = $1", [torch])).rows[0].catatan,
    "dari PIC",
    "staf bukan PIC tidak boleh mengubah",
  );

  // Leader unit lain pun tidak bisa.
  await sebagai(db, U.leaderMcn, "update sellers set status = 'nonaktif' where id = $1", [torch]);
  harusSama(
    (await sebagaiAdmin(db, "select status from sellers where id = $1", [torch])).rows[0].status,
    "aktif",
  );
});

uji("hanya pengelola dan leader unitnya yang bisa menghapus", async () => {
  const torch = (
    await sebagaiAdmin(db, "select id from sellers where nama_toko = 'Torch.id'")
  ).rows[0].id;
  await sebagai(db, U.yoga, "delete from sellers where id = $1", [torch]);
  harusSama(await hitung(U.manager, "select count(*)::int n from sellers where id = $1", [torch]), 1, "PIC tidak boleh menghapus");
  await sebagai(db, U.leaderTap, "delete from sellers where id = $1", [torch]);
  harusSama(await hitung(U.manager, "select count(*)::int n from sellers where id = $1", [torch]), 0, "leader unitnya boleh menghapus");
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
