/**
 * Hitungan pemetaan per kelompok dan daftar orang yang menunggu.
 *
 * Angka inilah yang dipakai orang memutuskan migrasi sudah sampai mana.
 * Kalau ia menghitung baris tabel tujuan alih-alih catatan yang benar-
 * benar dipetakan, migrasi yang belum dijalankan akan tampak selesai.
 */
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
const { uji, jalankan } = buatSuite("Ringkasan peta");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  manajer: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
  nabila: (await satu(`select id from users where nama='Nabila Putri'`)).id,
  // Satu orang V2 hanya boleh menjadi padanan satu orang V1 (0160),
  // dan usr_001/usr_002 sudah memakai Rian dan Nabila di uji pertama.
  dewi: (await satu(`select id from users where nama='Dewi Lestari'`)).id,
};

uji("hitungan dikelompokkan per kunci ekspor dan tabel tujuannya", async () => {
  await sebagaiAdmin(
    db,
    `insert into migrasi_peta (kelompok, id_lama, id_baru, tabel) values
       ('users:list', 'usr_001', $1, 'users'),
       ('users:list', 'usr_002', $2, 'users'),
       ('affiliate-accounts:all', 'acc_001',
         (select id from accounts limit 1), 'accounts')`,
    [U.rian, U.nabila],
  );

  const { rows } = await sebagaiAdmin(db, `select * from ringkas_peta_kelompok()`);
  const peta = Object.fromEntries(rows.map((r) => [r.kelompok, r]));
  harusSama(peta["users:list"].jumlah, 2);
  harusSama(peta["users:list"].tabel, "users");
  harusSama(peta["affiliate-accounts:all"].jumlah, 1);
  harus(peta["users:list"].terakhir !== null, "waktu terakhir harus terisi");
});

uji("kelompok yang belum dipetakan tidak muncul sebagai nol palsu", async () => {
  // Nol yang tidak ada bedanya dengan nol yang berarti "belum
  // dijalankan"; layar yang menentukan mana yang ditampilkan.
  const { rows } = await sebagaiAdmin(
    db,
    `select kelompok from ringkas_peta_kelompok() where kelompok = 'tasks:all'`,
  );
  harusSama(rows.length, 0);
});

uji("daftar orang menunggu diurutkan: yang belum diputuskan lebih dulu", async () => {
  await sebagaiAdmin(
    db,
    `insert into migrasi_orang_pending (id_lama, nama, kemunculan) values
       ('usr_900', 'Zulkarnain', array['tasks:all']),
       ('usr_901', 'Ahmad', array['daily-reports:all', 'attendance:all'])`,
  );
  await sebagaiAdmin(
    db,
    `update migrasi_orang_pending set user_id = $1, diputuskan_oleh = $2
      where id_lama = 'usr_901'`,
    [U.dewi, U.manajer],
  );

  const { rows } = await sebagaiAdmin(db, `select * from daftar_orang_pending()`);
  harusSama(rows[0].id_lama, "usr_900");
  harusSama(rows[0].user_id, null);
  // Kemunculannya ikut terbawa supaya dampaknya bisa dinilai.
  harusSama(rows[1].kemunculan.length, 2);
});

uji("hitungan dan daftarnya ikut terkunci untuk bukan Owner/Manager", async () => {
  const peta = await sebagai(db, U.nabila, `select * from ringkas_peta_kelompok()`);
  harusSama(peta.rows.length, 0);

  const orang = await sebagai(db, U.nabila, `select * from daftar_orang_pending()`);
  harusSama(orang.rows.length, 0);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
