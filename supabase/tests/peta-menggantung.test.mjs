/**
 * Peta yang menunjuk baris yang sudah tidak ada.
 *
 * Kalau dibiarkan, pemetaan berikutnya melihat catatan itu "sudah
 * pernah dipindahkan" lalu melewatinya — selamanya. Datanya hilang
 * tanpa satu pun galat.
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
const { uji, jalankan } = buatSuite("Peta menggantung");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  manajer: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
  staff: (await satu(`select id from users where nama='Nabila Putri'`)).id,
};

let akunId;

uji("peta yang tujuannya masih ada tidak dianggap menggantung", async () => {
  akunId = (
    await satu(
      `insert into accounts (platform, username, unit_id)
       values ('TikTok Shop', '@uji_peta', (select id from units where kode='affiliator'))
       returning id`,
    )
  ).id;

  await sebagaiAdmin(
    db,
    `insert into migrasi_peta (kelompok, id_lama, id_baru, tabel) values
       ('affiliate-accounts:all', 'acc_uji', $1, 'accounts'),
       ('users:list', 'usr_uji', $2, 'users')`,
    [akunId, U.staff],
  );

  const { rows } = await sebagaiAdmin(db, `select * from peta_menggantung()`);
  harusSama(rows.length, 0);
});

uji("peta yang tujuannya terhapus terlihat sebagai menggantung", async () => {
  await sebagaiAdmin(db, `delete from accounts where id = $1`, [akunId]);

  const { rows } = await sebagaiAdmin(db, `select * from peta_menggantung()`);
  harusSama(rows.length, 1);
  harusSama(rows[0].id_lama, "acc_uji");
  harusSama(rows[0].tabel, "accounts");
});

uji("membersihkannya mengembalikan catatan ke keadaan belum dipindahkan", async () => {
  const n = await sebagai(db, U.manajer, `select bersihkan_peta_menggantung() n`);
  harusSama(Number(n.rows[0].n), 1);

  // Petanya hilang, jadi pemetaan berikutnya akan memprosesnya lagi.
  harusSama(
    (await satu(`select peta_id('affiliate-accounts:all', 'acc_uji') id`)).id,
    null,
  );
  // Yang tujuannya masih ada tidak ikut terbawa.
  harus(
    (await satu(`select peta_id('users:list', 'usr_uji') id`)).id !== null,
    "peta yang sehat tidak boleh ikut dibuang",
  );
});

uji("hanya Owner/Manager yang boleh membersihkannya", async () => {
  await harusDitolak(
    () => sebagai(db, U.staff, `select bersihkan_peta_menggantung()`),
    "pembersihan oleh Staff seharusnya ditolak",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
