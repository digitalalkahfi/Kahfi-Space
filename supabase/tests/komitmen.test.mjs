/** Tiket komitmen mingguan: keterikatannya pada goal. */
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
const { uji, jalankan } = buatSuite("Komitmen mingguan & goal");

const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;

const MANAGER = await idUser("Farhan Pratama");
const DEWI = await idUser("Dewi Lestari");
const RIAN = await idUser("Rian Hidayat");

const goalAff = (
  await sebagaiAdmin(
    db,
    `select g.id from goals g join units u on u.id = g.unit_id
     where u.kode='affiliator' and g.account_id is null`,
  )
).rows[0].id;

uji("komitmen tanpa goal ditolak", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        MANAGER,
        `insert into tasks (tipe, judul, pembuat_id, penerima_id)
         values ('komitmen_mingguan', 'Tanpa goal', $1, $2)`,
        [MANAGER, DEWI],
      ),
    "constraint tasks_komitmen_punya_goal tidak bekerja",
  );
});

uji("komitmen dengan goal diterima", async () => {
  await sebagai(
    db,
    MANAGER,
    `insert into tasks (tipe, goal_id, judul, pembuat_id, penerima_id, tenggat)
     values ('komitmen_mingguan', $3, 'Naikkan konversi live 5%', $1, $2,
             '2024-11-02T23:59:00+07:00')`,
    [MANAGER, DEWI, goalAff],
  );

  const { rows } = await sebagaiAdmin(
    db,
    `select goal_id from tasks where judul='Naikkan konversi live 5%'`,
  );
  harusSama(rows[0].goal_id, goalAff);
});

uji("komitmen membawa judul goal saat dibaca", async () => {
  const { rows } = await sebagai(
    db,
    DEWI,
    `select t.judul, g.judul goal_judul, g.periode
     from tasks t join goals g on g.id = t.goal_id
     where t.tipe = 'komitmen_mingguan'`,
  );
  harus(rows.length > 0, "komitmen harus terbaca penerimanya");
  harus(
    rows.every((r) => r.goal_judul && r.periode),
    "judul & periode goal harus ikut",
  );
});

uji("menghapus goal menurunkan komitmennya jadi tiket, bukan menghapusnya", async () => {
  const goalAkun = (
    await sebagaiAdmin(
      db,
      `select id, judul from goals where account_id is not null limit 1`,
    )
  ).rows[0];

  await sebagaiAdmin(
    db,
    `insert into tasks (tipe, goal_id, judul, pembuat_id, penerima_id)
     values ('komitmen_mingguan', $3, 'Komitmen akun', $1, $2)`,
    [MANAGER, RIAN, goalAkun.id],
  );

  await sebagaiAdmin(db, `delete from goals where id=$1`, [goalAkun.id]);

  const { rows } = await sebagaiAdmin(
    db,
    `select tipe, goal_id, konteks from tasks where judul='Komitmen akun'`,
  );
  harusSama(rows.length, 1, "tugasnya harus tetap ada");
  harusSama(rows[0].tipe, "tiket", "diturunkan jadi tiket biasa");
  harusSama(rows[0].goal_id, null);
  harus(
    rows[0].konteks.toLowerCase().includes("bekas komitmen"),
    `asal-usulnya harus tercatat, dapat: ${rows[0].konteks}`,
  );
});

uji("maksimal 3 goal aktif per orang tetap dijaga", async () => {
  const dewiGoals = (
    await sebagaiAdmin(
      db,
      `select count(*)::int n from goals where pemilik_id=$1 and status='aktif'`,
      [DEWI],
    )
  ).rows[0].n;

  // Tambah sampai menyentuh batas.
  for (let i = Number(dewiGoals); i < 3; i += 1) {
    await sebagaiAdmin(
      db,
      `insert into goals (judul, level, pemilik_id, satuan, target_base,
                          target_goal, target_stretch, periode)
       values ($1, 'staff', $2, 'IDR', 1, 2, 3, '2024-Q4')`,
      [`Goal tambahan ${i}`, DEWI],
    );
  }

  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into goals (judul, level, pemilik_id, satuan, target_base,
                            target_goal, target_stretch, periode)
         values ('Goal keempat', 'staff', $1, 'IDR', 1, 2, 3, '2024-Q4')`,
        [DEWI],
      ),
    "batas 3 goal aktif tidak bekerja",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
