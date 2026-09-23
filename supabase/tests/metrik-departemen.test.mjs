/**
 * Acuan metrik per departemen: database harus sepakat dengan kode.
 *
 * Kolom mana yang diisi tiap departemen ditulis di dua tempat —
 * `KOLOM_PER_UNIT` untuk form, dan tabel ini untuk siapa pun yang
 * membaca dari SQL. Berkas ini yang menjaga keduanya tidak melenceng.
 */
import { KOLOM_PER_UNIT, kolomLaporan } from "@/lib/laporan";
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
const { uji, jalankan } = buatSuite("Metrik per departemen");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
  farhan: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
};

const dariSql = async (unit) =>
  (
    await sebagai(db, U.rian, `select metrik from metrik_unit($1)`, [unit])
  ).rows.map((r) => r.metrik);

uji("tiap unit memuat kolom yang sama dengan kode aplikasi", async () => {
  for (const unit of ["affiliator", "mcn", "tap"]) {
    harusSama(await dariSql(unit), [...KOLOM_PER_UNIT[unit]], unit);
  }
});

uji("urutannya sama dengan urutan tampil di form", async () => {
  // `metrik_unit` mengurutkan sendiri; yang diperiksa di sini bahwa
  // urutannya bukan kebetulan sama dengan urutan abjad.
  const affiliator = await dariSql("affiliator");
  harusSama(affiliator[0], "gmv", "GMV selalu lebih dulu");
  harus(
    affiliator.join(",") !== [...affiliator].sort().join(","),
    "urutannya memang disengaja, bukan urutan abjad",
  );
});

uji("kolomLaporan dan metrik_unit menjawab sama untuk tiap unit", async () => {
  for (const unit of ["affiliator", "mcn", "tap"]) {
    harusSama(await dariSql(unit), [...kolomLaporan(unit)], unit);
  }
});

uji("hanya GMV yang wajib", async () => {
  const { rows } = await sebagai(
    db,
    U.rian,
    `select metrik from metrik_departemen where wajib order by metrik`,
  );
  harusSama([...new Set(rows.map((r) => r.metrik))], ["gmv"]);
});

uji("metrik yang tidak dikenal ditolak", async () => {
  await harusDitolak(() =>
    sebagaiAdmin(
      db,
      `insert into metrik_departemen (unit_kode, metrik, urutan)
       values ('mcn', 'engagement', 9)`,
    ),
  );
});

uji("unit yang tidak dikenal ditolak", async () => {
  await harusDitolak(() =>
    sebagaiAdmin(
      db,
      `insert into metrik_departemen (unit_kode, metrik, urutan)
       values ('keuangan', 'gmv', 1)`,
    ),
  );
});

uji("satu metrik hanya sekali per unit", async () => {
  await harusDitolak(() =>
    sebagaiAdmin(
      db,
      `insert into metrik_departemen (unit_kode, metrik, urutan)
       values ('mcn', 'gmv', 9)`,
    ),
  );
});

uji("semua yang sudah masuk boleh membaca acuannya", async () => {
  const { rows } = await sebagai(
    db,
    U.rian,
    `select count(*)::int as n from metrik_departemen`,
  );
  harus(rows[0].n > 0, "Staff pun perlu tahu kolom apa yang harus ia isi");
});

uji("hanya manajemen yang boleh mengubah acuannya", async () => {
  const { rows } = await sebagai(
    db,
    U.rian,
    `update metrik_departemen set wajib=true
      where unit_kode='mcn' and metrik='catatan' returning metrik`,
  );
  harusSama(rows.length, 0, "Staff tidak menyentuh satu baris pun");

  const manajemen = await sebagai(
    db,
    U.farhan,
    `update metrik_departemen set wajib=true
      where unit_kode='mcn' and metrik='catatan' returning metrik`,
  );
  harusSama(manajemen.rows.length, 1);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
