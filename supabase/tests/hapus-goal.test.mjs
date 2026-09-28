/**
 * Menghapus goal dari layar (tombol Hapus di pohon goal): hanya CEO/
 * Manager, dan seluruh akibatnya terjadi di database dalam satu
 * pernyataan — anak tangga dan lead measure ikut terhapus, goal turunan
 * dilepas, komitmen mingguan menjadi tiket (0022), jejak tetap di audit.
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
const { uji, jalankan } = buatSuite("Hapus goal");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu(`select id from users where nama = $1`, [nama])).id;

const MANAGER = await id("Farhan Pratama");
const DEWI = await id("Dewi Lestari"); // Leader Affiliator
const RIAN = await id("Rian Hidayat"); // Staff Affiliator

// Goal unit Affiliator: punya goal akun turunan, lead measure bercatatan,
// dan komitmen mingguan di data contoh.
const GOAL = (
  await satu(
    `select g.id from goals g join units u on u.id = g.unit_id
      where g.level = 'leader' and u.kode = 'affiliator'`,
  )
).id;

/** Hitungan yang juga dipakai dialog konfirmasi (`dampakHapusGoal`). */
const DAMPAK = `
  select
    (select count(*) from goal_months where goal_id = $1)::int anak_tangga,
    (select count(*) from goals where parent_goal_id = $1)::int turunan,
    (select count(*) from lead_measures where goal_id = $1)::int lead_measure,
    (select count(*) from lead_measure_entries e
       join lead_measures lm on lm.id = e.lead_measure_id
      where lm.goal_id = $1)::int catatan,
    (select count(*) from tasks
      where goal_id = $1 and tipe = 'komitmen_mingguan')::int komitmen`;

uji(
  "Manager melihat semua yang akan terdampak, jadi dialog tidak kurang hitung",
  async () => {
    const semua = await satu(DAMPAK, [GOAL]);
    harus(semua.anak_tangga > 0, "seed: goal punya anak tangga");
    harus(semua.turunan > 0, "seed: goal punya turunan");
    harus(
      semua.lead_measure > 0 && semua.catatan > 0,
      "seed: lead measure bercatatan",
    );
    harus(semua.komitmen > 0, "seed: goal punya komitmen mingguan");
    const manager = (await sebagai(db, MANAGER, DAMPAK, [GOAL])).rows[0];
    harusSama(manager, semua);
  },
);

uji("Leader dan Staff tidak bisa menghapus goal", async () => {
  for (const orang of [DEWI, RIAN]) {
    const { rows } = await sebagai(
      db,
      orang,
      `delete from goals where id = $1 returning id`,
      [GOAL],
    );
    harusSama(rows.length, 0, "tidak ada baris yang terhapus");
  }
  harus(
    await satu(`select id from goals where id = $1`, [GOAL]),
    "goal masih ada",
  );
});

uji(
  "Manager menghapus goal beserta akibatnya dalam satu pernyataan",
  async () => {
    const sebelum = await satu(DAMPAK, [GOAL]);
    const idTurunan = (
      await sebagaiAdmin(db, `select id from goals where parent_goal_id = $1`, [
        GOAL,
      ])
    ).rows.map((r) => r.id);
    const idLead = (
      await sebagaiAdmin(
        db,
        `select id from lead_measures where goal_id = $1`,
        [GOAL],
      )
    ).rows.map((r) => r.id);
    const idKomitmen = (
      await sebagaiAdmin(
        db,
        `select id from tasks where goal_id = $1 and tipe = 'komitmen_mingguan'`,
        [GOAL],
      )
    ).rows.map((r) => r.id);

    const { rows } = await sebagai(
      db,
      MANAGER,
      `delete from goals where id = $1 returning judul`,
      [GOAL],
    );
    harusSama(rows.length, 1, "goal terhapus");

    harusSama(await satu(DAMPAK, [GOAL]), {
      anak_tangga: 0,
      turunan: 0,
      lead_measure: 0,
      catatan: 0,
      komitmen: 0,
    });

    const turunan = await satu(
      `select count(*)::int n,
            count(*) filter (where parent_goal_id is null and status = 'aktif')::int lepas
       from goals where id = any($1)`,
      [idTurunan],
    );
    harusSama(
      [turunan.n, turunan.lepas],
      [idTurunan.length, idTurunan.length],
      "turunan tetap ada, tanpa induk",
    );

    const catatan = await satu(
      `select count(*)::int n from lead_measure_entries where lead_measure_id = any($1)`,
      [idLead],
    );
    harusSama(catatan.n, 0, "catatan lead measure ikut terhapus");

    const komitmen = (
      await sebagaiAdmin(
        db,
        `select tipe, goal_id, konteks from tasks where id = any($1)`,
        [idKomitmen],
      )
    ).rows;
    harusSama(komitmen.length, sebelum.komitmen, "komitmen tidak dihapus");
    harus(
      komitmen.every(
        (t) =>
          t.tipe === "tiket" &&
          t.goal_id === null &&
          /bekas komitmen/i.test(t.konteks),
      ),
      "komitmen menjadi tiket dengan catatan asal-usulnya",
    );

    const jejak = await satu(
      `select user_id, nilai_lama ->> 'judul' judul from audit_logs
      where entitas = 'goals' and entitas_id = $1 and aksi = 'delete'`,
      [GOAL],
    );
    harus(jejak, "penghapusan tercatat di audit");
    harusSama(jejak.user_id, MANAGER, "pelakunya tercatat");
    harusSama(jejak.judul, rows[0].judul, "isi lama goal tersimpan");
    await terapkanSeed(db);
  },
);

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
