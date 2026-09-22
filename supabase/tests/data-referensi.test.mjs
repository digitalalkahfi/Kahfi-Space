/**
 * Data referensi organisasi: ada tanpa data contoh.
 *
 * Suite ini sengaja TIDAK memanggil `terapkanSeed`: yang diuji adalah
 * pemasangan yang benar — migrasi saja — sebab lingkungan sungguhan tidak
 * memasang nama-nama karangan di seed.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagaiAdmin,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
const { uji, jalankan } = buatSuite("Data referensi");

uji("lima departemen PRD tersedia", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select nama from departments order by nama",
  );
  harusSama(
    rows.map((r) => r.nama).join(", "),
    "Affiliator, MCN, MMC, Mabit Scholar, TAP",
  );
});

uji("tiga unit pelaporan tersedia beserta departemennya", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select u.kode, d.nama departemen from units u
       left join departments d on d.id = u.department_id order by u.kode`,
  );
  harusSama(rows.length, 3);
  for (const r of rows) {
    harus(r.departemen !== null, `unit ${r.kode} harus punya departemen`);
  }
});

uji("tiap unit punya program Reguler", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select u.kode from units u
      where not exists (
        select 1 from programs p where p.unit_id = u.id and p.nama = 'Reguler')`,
  );
  harusSama(rows.length, 0, "unit tanpa program bawaan: " + rows.map((r) => r.kode));
});

uji("program khusus menempel pada unitnya", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select p.nama, u.kode from programs p join units u on u.id = p.unit_id
      where p.nama in ('Mabit Scholar', 'MMC') order by p.nama`,
  );
  harusSama(
    rows.map((r) => `${r.nama}:${r.kode}`).join(", "),
    "MMC:mcn, Mabit Scholar:affiliator",
  );
});

uji("tiap peran PRD punya definisi KPI-nya", async () => {
  // Enum peran tidak ada gunanya tanpa indikator yang menilainya.
  const { rows } = await sebagaiAdmin(
    db,
    `select e.peran from unnest(enum_range(null::peran_pengguna)) e(peran)
      where not exists (
        select 1 from kpi_definitions k where k.jabatan = e.peran::text and k.aktif)`,
  );
  harusSama(rows.length, 0, "peran tanpa KPI: " + rows.map((r) => r.peran));
});

uji("memasang ulang data referensi tidak menggandakan", async () => {
  // Migrasi dijalankan sekali, tetapi seed contoh menimpa baris yang sama —
  // keduanya harus hidup berdampingan tanpa baris kembar.
  const sebelum = (
    await sebagaiAdmin(
      db,
      "select (select count(*) from units) u, (select count(*) from programs) p",
    )
  ).rows[0];

  await sebagaiAdmin(db, `
    insert into departments (nama) values ('MCN'), ('Affiliator')
      on conflict (nama) do nothing;
    insert into units (id, kode, nama) values
      ('19570324-4683-5829-9eb5-4c69aa62222a', 'affiliator', 'Affiliator Network')
      on conflict (id) do update set nama = excluded.nama;
  `);

  const sesudah = (
    await sebagaiAdmin(
      db,
      "select (select count(*) from units) u, (select count(*) from programs) p",
    )
  ).rows[0];
  harusSama(Number(sesudah.u), Number(sebelum.u));
  harusSama(Number(sesudah.p), Number(sebelum.p));
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
