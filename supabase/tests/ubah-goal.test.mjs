/**
 * Mengubah goal beserta periodenya (migrasi 0177): seluruh isian dan
 * anak tangga bulanan dalam satu transaksi, hanya CEO/Manager, turunan
 * tetap sah, dan setiap perubahan meninggalkan jejak.
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
const { uji, jalankan } = buatSuite("Ubah goal");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu(`select id from users where nama = $1`, [nama])).id;

const MANAGER = await id("Farhan Pratama");
const DEWI = await id("Dewi Lestari"); // Leader Affiliator

/** Baris goal lengkap menurut id-nya (judul ikut diubah tes). */
const goal = async (goalId) =>
  satu(
    `select id, judul, level, pemilik_id, parent_goal_id, unit_id, account_id,
            target_base, target_goal, target_stretch, periode
       from goals where id = $1`,
    [goalId],
  );

const bulan = async (goalId) =>
  (
    await sebagaiAdmin(
      db,
      `select to_char(bulan, 'YYYY-MM-DD') b, target::float8 t
         from goal_months where goal_id = $1 order by bulan`,
      [goalId],
    )
  ).rows.map((r) => [r.b, Number(r.t)]);

/** Panggil ubah_goal dengan isian goal lama, ditimpa `ganti`. */
async function ubah(oleh, g, ganti = {}, pBulan = null) {
  const isi = {
    judul: g.judul,
    level: g.level,
    pemilik: g.pemilik_id,
    induk: g.parent_goal_id,
    unit: g.unit_id,
    akun: g.account_id,
    base: Number(g.target_base),
    target: Number(g.target_goal),
    stretch: Number(g.target_stretch),
    periode: g.periode,
    ...ganti,
  };
  return sebagai(
    db,
    oleh,
    `select ubah_goal($1, $2, $3::level_goal, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
    [
      g.id,
      isi.judul,
      isi.level,
      isi.pemilik,
      isi.induk,
      isi.unit,
      isi.akun,
      isi.base,
      isi.target,
      isi.stretch,
      isi.periode,
      pBulan === null ? null : JSON.stringify(pBulan),
    ],
  );
}

// Goal perusahaan bawaan seed, dicari lewat id-nya.
const KORP = (
  await satu(
    `select id from goals where level = 'company' order by created_at limit 1`,
  )
).id;

uji("memperbaiki judul tanpa menyentuh anak tangga", async () => {
  const g = await goal(KORP);
  const sebelum = await bulan(g.id);
  await ubah(MANAGER, g, { judul: "GMV perusahaan Q4 2024" });

  harusSama(
    (await goal(KORP)).judul,
    "GMV perusahaan Q4 2024",
    "judul baru tersimpan",
  );
  harusSama(await bulan(g.id), sebelum, "anak tangga yang menanjak tetap utuh");
  await terapkanSeed(db);
});

uji("mengganti periode menyusun ulang anak tangga dan labelnya", async () => {
  const g = await goal(KORP);
  await ubah(MANAGER, g, { periode: "Nov 2024" }, [
    { bulan: "2024-11-01", target: 1_200_000_000 },
  ]);
  harusSama(await bulan(g.id), [["2024-11-01", 1_200_000_000]]);
  harusSama((await goal(KORP)).periode, "Nov 2024");
  await terapkanSeed(db);
});

uji("setiap perubahan meninggalkan jejak", async () => {
  const g = await goal(KORP);
  const sebelum = (
    await satu(`select count(*)::int n from audit_logs where entitas_id = $1`, [
      g.id,
    ])
  ).n;
  await ubah(MANAGER, g, { judul: "GMV perusahaan diperbarui" });
  const sesudah = (
    await satu(`select count(*)::int n from audit_logs where entitas_id = $1`, [
      g.id,
    ])
  ).n;
  harus(sesudah > sebelum, "perubahan goal tercatat di audit");
  await terapkanSeed(db);
});

uji("Leader tidak bisa mengubah goal", async () => {
  const g = await goal(KORP);
  await harusDitolak(
    () => ubah(DEWI, g, { judul: "Diubah Leader" }),
    "Leader bukan pengelola goal",
  );
  harusSama((await goal(KORP)).judul, g.judul);
});

uji("periode kosong atau lebih dari 12 bulan ditolak", async () => {
  const g = await goal(KORP);
  await harusDitolak(() => ubah(MANAGER, g, {}, []), "periode kosong");
  const tigaBelas = Array.from({ length: 13 }, (_, i) => ({
    bulan: `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`,
    target: 1,
  }));
  await harusDitolak(() => ubah(MANAGER, g, {}, tigaBelas), "13 bulan");
});

uji("gagal di tengah membatalkan seluruh perubahan", async () => {
  const g = await goal(KORP);
  const sebelum = await bulan(g.id);
  // Bulan kembar melanggar kunci unik anak tangga: judul pun tidak boleh
  // terlanjur berubah.
  await harusDitolak(
    () =>
      ubah(MANAGER, g, { judul: "Seharusnya tidak tersimpan" }, [
        { bulan: "2024-11-01", target: 1 },
        { bulan: "2024-11-01", target: 2 },
      ]),
    "bulan kembar",
  );
  harusSama((await goal(KORP)).judul, g.judul);
  harusSama(await bulan(g.id), sebelum);
});

uji("level tidak bisa diturunkan melewati turunannya", async () => {
  const g = await goal(KORP);
  const anak = await satu(
    `select count(*)::int n from goals where parent_goal_id = $1`,
    [g.id],
  );
  harus(anak.n > 0, "seed: goal perusahaan punya turunan");
  await harusDitolak(
    () => ubah(MANAGER, g, { level: "staff" }),
    "goal berturunan tidak boleh menjadi level staf",
  );
  harusSama((await goal(KORP)).level, "company");
});

uji("unit goal berturunan tidak bisa dipindah ke unit lain", async () => {
  const unitGoal = await satu(
    `select g.id from goals g
      where g.level = 'leader'
        and exists (select 1 from goals c where c.parent_goal_id = g.id and c.account_id is not null)
      limit 1`,
  );
  harus(unitGoal, "seed: goal unit yang punya goal akun");
  const g = await goal(unitGoal.id);
  const lain = (
    await satu(`select id from units where id <> $1 order by kode limit 1`, [
      g.unit_id,
    ])
  ).id;
  await harusDitolak(
    () => ubah(MANAGER, g, { unit: lain }),
    "turunan akun berada di unit lama",
  );
});

uji("tidak bisa dipanggil tanpa login", async () => {
  const g = await goal(KORP);
  await db.exec("reset role;");
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec("set role anon;");
  let ditolak = false;
  try {
    await db.query(
      `select ubah_goal($1, 'x', 'company', null, null, null, null, 0, 0, 0, 'x', null)`,
      [g.id],
    );
  } catch {
    ditolak = true;
  } finally {
    await db.exec("reset role;");
  }
  harus(ditolak, "anon tidak boleh mengeksekusi ubah_goal");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
