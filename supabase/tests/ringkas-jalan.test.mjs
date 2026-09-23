/**
 * Hasil tiap kelompok pada satu jalan migrasi.
 *
 * Catatan migrasi hanya memuat yang bermasalah — jumlah yang berhasil
 * tidak ada di sana sama sekali. Tanpa tabel ini, pertanyaan "migrasi
 * kemarin sampai mana" hanya bisa dijawab dengan menjalankannya lagi.
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
const { uji, jalankan } = buatSuite("Ringkasan jalan migrasi");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  manajer: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
  staff: (await satu(`select id from users where nama='Nabila Putri'`)).id,
};

let jalan;

uji("ringkasan tersimpan per kelompok", async () => {
  jalan = (
    await sebagai(
      db,
      U.manajer,
      `select (mulai_migrasi_jalan('uji_coba'::tahap_migrasi)).id id`,
    )
  ).rows[0].id;

  await sebagaiAdmin(
    db,
    `insert into migrasi_ringkas (jalan_id, kelompok, diperiksa, ditulis, tertahan)
     values ($1, 'users:list', 26, 24, 2),
            ($1, 'daily-reports:all', 167, 160, 7)`,
    [jalan],
  );

  const { rows } = await sebagaiAdmin(
    db,
    `select * from ringkas_jalan_kelompok($1)`,
    [jalan],
  );
  const peta = Object.fromEntries(rows.map((r) => [r.kelompok, r]));
  harusSama(peta["users:list"].ditulis, 24);
  harusSama(peta["daily-reports:all"].tertahan, 7);
});

uji("tanpa jalan yang disebut, yang dipakai jalan terbaru", async () => {
  const { rows } = await sebagaiAdmin(db, `select * from ringkas_jalan_kelompok()`);
  harus(rows.length === 2, "jalan terbaru harus terbaca sendiri");
});

uji("satu kelompok hanya punya satu ringkasan per jalan", async () => {
  // Kalau bisa ganda, angkanya berlipat tanpa ada yang menyadarinya.
  let ditolak = false;
  try {
    await sebagaiAdmin(
      db,
      `insert into migrasi_ringkas (jalan_id, kelompok) values ($1, 'users:list')`,
      [jalan],
    );
  } catch {
    ditolak = true;
  }
  harus(ditolak, "ringkasan kembar seharusnya ditolak");
});

uji("ringkasan ikut terhapus bersama jalannya", async () => {
  // Ringkasan yang menunjuk jalan yang sudah tidak ada hanya membingungkan.
  await sebagaiAdmin(db, `delete from migrasi_jalan where id = $1`, [jalan]);
  harusSama(
    (await satu(`select count(*)::int n from migrasi_ringkas where jalan_id = $1`, [jalan])).n,
    0,
  );
});

uji("bukan Owner/Manager tidak melihat ringkasannya", async () => {
  const { rows } = await sebagai(
    db,
    U.staff,
    `select count(*)::int n from migrasi_ringkas`,
  );
  harusSama(Number(rows[0].n), 0);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
