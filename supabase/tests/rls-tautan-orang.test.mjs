/**
 * Hak atas penautan orang.
 *
 * Penautan menentukan siapa pemilik laporan, tugas, dan kehadiran yang
 * ikut pindah. Salah tautan tidak menimbulkan galat apa pun — datanya
 * tetap masuk, hanya menempel pada orang yang keliru — jadi siapa yang
 * boleh memutuskannya sama pentingnya dengan keputusan itu sendiri.
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
const { uji, jalankan } = buatSuite("Hak penautan orang");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const peran = async (nama) =>
  (await satu(`select id from users where role = $1 and status='aktif' limit 1`, [nama])).id;

const U = {
  ceo: await peran("CEO"),
  manajer: await peran("Manager"),
  finance: await peran("Finance"),
  leader: await peran("Leader"),
  staff: await peran("Staff"),
  dewi: (await satu(`select id from users where nama='Dewi Lestari'`)).id,
  intan: (await satu(`select id from users where nama='Intan Permata'`)).id,
};

uji("Manager boleh mencatat orang yang menunggu", async () => {
  const { rows } = await sebagai(
    db,
    U.manajer,
    `insert into migrasi_orang_pending (id_lama, nama, kemunculan)
     values ('usr_rls', 'Entah Siapa', array['tasks:all'])
     returning id_lama`,
  );
  harusSama(rows.length, 1);
});

uji("Manager boleh menautkan, dan jejaknya tercatat", async () => {
  await sebagai(
    db,
    U.manajer,
    `update migrasi_orang_pending
        set user_id = $1, diputuskan_oleh = $2
      where id_lama = 'usr_rls'`,
    [U.dewi, U.manajer],
  );

  const b = await satu(
    `select user_id, diputuskan_oleh, diputuskan_pada is not null tercatat
       from migrasi_orang_pending where id_lama = 'usr_rls'`,
  );
  harusSama(b.user_id, U.dewi);
  harusSama(b.diputuskan_oleh, U.manajer);
  harus(b.tercatat, "waktu keputusan harus terisi");
});

uji("CEO boleh mencabut keputusan Manager", async () => {
  // Keputusan yang tidak bisa dicabut siapa pun adalah keputusan yang
  // salahnya permanen.
  await sebagai(
    db,
    U.ceo,
    `update migrasi_orang_pending set user_id = null where id_lama = 'usr_rls'`,
  );
  harusSama(
    (await satu(`select user_id from migrasi_orang_pending where id_lama='usr_rls'`)).user_id,
    null,
  );
});

uji("Finance, Leader, dan Staff tidak bisa menautkan siapa pun", async () => {
  for (const orang of [U.finance, U.leader, U.staff]) {
    const { rows } = await sebagai(
      db,
      orang,
      `update migrasi_orang_pending set user_id = $1, diputuskan_oleh = $2
        where id_lama = 'usr_rls' returning id_lama`,
      [U.intan, orang],
    );
    harusSama(rows.length, 0, "penautan oleh peran lain seharusnya tidak kena");
  }

  await harusDitolak(
    () =>
      sebagai(
        db,
        U.staff,
        `insert into migrasi_orang_pending (id_lama) values ('usr_curian')`,
      ),
    "pencatatan oleh Staff seharusnya ditolak",
  );
});

uji("hitungan yang menunggu ikut terkunci per peran", async () => {
  const manajer = await sebagai(db, U.manajer, `select orang_pending_terbuka() n`);
  const staf = await sebagai(db, U.staff, `select orang_pending_terbuka() n`);
  harus(Number(manajer.rows[0].n) > 0, "Manager harus melihat yang menunggu");
  harusSama(Number(staf.rows[0].n), 0);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
