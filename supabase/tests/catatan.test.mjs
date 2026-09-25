/**
 * Catatan: lingkup baca (pribadi / unit / perusahaan) dan kepemilikan (0167).
 *
 * Yang pribadi tidak terbaca siapa pun selain penulisnya — termasuk
 * CEO/Manager. Yang dibagikan terbaca sesuai lingkupnya, tetapi hanya
 * penulisnya yang boleh mengubah atau menghapus.
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
const { uji, jalankan } = buatSuite("Catatan");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;
const unitId = async (kode) =>
  (await sebagaiAdmin(db, "select id from units where kode = $1", [kode]))
    .rows[0].id;
const judulTerbaca = async (userId) =>
  (await sebagai(db, userId, "select judul from notes order by judul")).rows.map((r) => r.judul);

const U = {
  ceo: await id("Hafidz Alkahfi"),
  manager: await id("Farhan Pratama"),
  galih: await id("Galih Prakoso"), // Leader MCN
  rizky: await id("Rizky Ananda"), // Staff MCN
  rian: await id("Rian Hidayat"), // Staff Affiliator
};
const MCN = await unitId("mcn");

uji("seed: catatan pribadi hanya terbaca penulisnya, unit oleh unitnya, perusahaan oleh semua", async () => {
  harusSama(await judulTerbaca(U.manager), [
    "Lima jenis dokumen di bawah SOP",
    "Review harian 24 Oktober",
    "Templat chat admin kreator",
  ]);
  // CEO tidak melihat catatan pribadi Manager; melihat catatan unit (lintas unit).
  harusSama(await judulTerbaca(U.ceo), [
    "Lima jenis dokumen di bawah SOP",
    "Templat chat admin kreator",
  ]);
  harusSama(await judulTerbaca(U.rizky), [
    "Lima jenis dokumen di bawah SOP",
    "Templat chat admin kreator",
  ]);
  harusSama(await judulTerbaca(U.rian), ["Lima jenis dokumen di bawah SOP"]);
});

uji("menulis atas nama orang lain ditolak; unit wajib bila dibagikan ke unit", async () => {
  await harusDitolak(
    () =>
      sebagai(db, U.rian, `insert into notes (judul, dibuat_oleh) values ('Catatan palsu', $1)`, [U.rizky]),
    "menulis atas nama orang lain seharusnya ditolak",
  );
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.rian,
        `insert into notes (judul, visibilitas, dibuat_oleh) values ('Tanpa unit', 'unit', $1)`,
        [U.rian],
      ),
    "dibagikan ke unit tanpa unit seharusnya ditolak",
  );
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.rian,
        `insert into notes (judul, lampiran, dibuat_oleh) values ('Lampiran salah', array['bukan tautan'], $1)`,
        [U.rian],
      ),
    "lampiran bukan tautan seharusnya ditolak",
  );
});

uji("catatan pribadi dan unit yang dibagikan ke unit lain tidak bocor", async () => {
  await sebagai(
    db,
    U.rian,
    `insert into notes (judul, visibilitas, dibuat_oleh) values ('Rahasia Rian', 'pribadi', $1)`,
    [U.rian],
  );
  const { rows } = await sebagai(
    db,
    U.rizky,
    "select count(*)::int n from notes where judul = 'Rahasia Rian'",
  );
  harusSama(Number(rows[0].n), 0);
  // Unit dinolkan otomatis untuk catatan pribadi.
  const baris = (
    await sebagaiAdmin(db, "select unit_id from notes where judul = 'Rahasia Rian'")
  ).rows[0];
  harusSama(baris.unit_id, null);
});

uji("hanya penulis yang bisa mengubah dan menghapus, walau catatannya dibagikan", async () => {
  const templat = (
    await sebagaiAdmin(db, "select id from notes where judul = 'Templat chat admin kreator'")
  ).rows[0].id;
  await sebagai(db, U.rizky, "update notes set judul = 'Diubah staf' where id = $1", [templat]);
  await sebagai(db, U.manager, "update notes set judul = 'Diubah manager' where id = $1", [templat]);
  harusSama(
    (await sebagaiAdmin(db, "select judul from notes where id = $1", [templat])).rows[0].judul,
    "Templat chat admin kreator",
  );
  await sebagai(db, U.manager, "delete from notes where id = $1", [templat]);
  harus(
    (await sebagaiAdmin(db, "select 1 from notes where id = $1", [templat])).rows.length === 1,
    "manager tidak boleh menghapus catatan orang lain",
  );
  await sebagai(db, U.galih, "update notes set disematkan = false, unit_id = $2 where id = $1", [templat, MCN]);
  harusSama(
    (await sebagaiAdmin(db, "select disematkan from notes where id = $1", [templat])).rows[0].disematkan,
    false,
  );
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
