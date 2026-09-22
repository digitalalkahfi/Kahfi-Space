/**
 * Laporan mingguan: keputusan WRM dibentuk dari data harian, bukan diketik.
 *
 * Mengimpor modul aplikasi, jadi butuh hook alias "@/" — `npm run db:test`
 * memasangnya; menjalankan berkas ini sendiri perlu
 * `node --import ./scripts/alias-ts.mjs supabase/tests/laporan-mingguan.test.mjs`.
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
import { keputusanWrm } from "../../src/lib/wrm.ts";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Laporan mingguan");

const PEKAN = "2024-10-14"; // Senin pekan yang sudah lewat di data contoh.

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const bentuk = async (nama, pekan = PEKAN) =>
  sebagai(db, await id(nama), "select buat_laporan_mingguan($1) n", [pekan]);

uji("periode harus hari Senin", async () => {
  await harusDitolak(
    () => bentuk("Farhan Pratama", "2024-10-15"),
    "periode selain Senin seharusnya ditolak",
  );
});

uji("pekan berjalan belum boleh dibentuk", async () => {
  const seninIni = (
    await sebagaiAdmin(db, "select awal_pekan(current_date) s")
  ).rows[0].s;
  await harusDitolak(
    () => bentuk("Farhan Pratama", new Date(seninIni).toISOString().slice(0, 10)),
    "pekan yang belum selesai seharusnya ditolak",
  );
});

uji("Leader tidak boleh membentuk laporan mingguan", async () => {
  await harusDitolak(
    () => bentuk("Dewi Lestari"),
    "pembentukan oleh Leader seharusnya ditolak",
  );
});

uji("Manager membentuk laporan tiap unit", async () => {
  const { rows } = await bentuk("Farhan Pratama");
  const unit = (await sebagaiAdmin(db, "select count(*)::int n from units"))
    .rows[0].n;
  harusSama(Number(rows[0].n), unit);

  const tersimpan = await sebagaiAdmin(
    db,
    "select count(*)::int n from weekly_reports where periode = $1",
    [PEKAN],
  );
  harusSama(tersimpan.rows[0].n, unit);
});

uji("GMV laporan sama dengan penjumlahan laporan harian pekan itu", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select w.gmv_total,
            (select coalesce(sum(r.gmv), 0)
               from daily_reports r
               left join accounts a on a.id = r.account_id
              where coalesce(r.unit_id, a.unit_id) = w.unit_id
                and r.tanggal between $1 and $1::date + 6) harian
       from weekly_reports w where w.periode = $1`,
    [PEKAN],
  );
  harus(rows.length > 0, "laporan pekan itu harus ada");
  for (const r of rows) {
    harusSama(Number(r.gmv_total), Number(r.harian));
  }
});

uji("keputusan mengikuti dua sumbunya, sama dengan rumus aplikasi", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select status_hasil, status_kri, keputusan from weekly_reports where periode = $1",
    [PEKAN],
  );
  for (const r of rows) {
    harusSama(
      r.keputusan,
      keputusanWrm(r.status_hasil === "hijau", r.status_kri === "hijau"),
    );
  }
});

uji("membentuk ulang memperbarui, bukan menggandakan", async () => {
  const unit = (await sebagaiAdmin(db, "select count(*)::int n from units"))
    .rows[0].n;
  await bentuk("Farhan Pratama");
  harusSama(
    (await sebagaiAdmin(
      db,
      "select count(*)::int n from weekly_reports where periode = $1",
      [PEKAN],
    )).rows[0].n,
    unit,
  );
});

uji("koreksi laporan harian tercermin saat dibentuk ulang", async () => {
  const unitId = (
    await sebagaiAdmin(db, "select id from units where kode = 'affiliator'")
  ).rows[0].id;
  const sebelum = (
    await sebagaiAdmin(
      db,
      "select gmv_total from weekly_reports where periode = $1 and unit_id = $2",
      [PEKAN, unitId],
    )
  ).rows[0].gmv_total;

  const akun = (
    await sebagaiAdmin(db, "select id from accounts where username = '@fashion_hijab'")
  ).rows[0].id;
  await sebagaiAdmin(
    db,
    "update daily_reports set gmv = gmv + 1000000 where account_id = $1 and tanggal = $2",
    [akun, PEKAN],
  );

  await bentuk("Farhan Pratama");
  const sesudah = (
    await sebagaiAdmin(
      db,
      "select gmv_total from weekly_reports where periode = $1 and unit_id = $2",
      [PEKAN, unitId],
    )
  ).rows[0].gmv_total;

  harusSama(Number(sesudah), Number(sebelum) + 1000000);
  await terapkanSeed(db);
});

uji("merah beruntun bertambah saat dua pekan berturut merah", async () => {
  // Penandaannya dipakai matriks WRM untuk menyorot masalah yang menetap.
  const unitId = (
    await sebagaiAdmin(db, "select id from units where kode = 'mcn'")
  ).rows[0].id;

  await bentuk("Farhan Pratama", "2024-10-07");
  await bentuk("Farhan Pratama", "2024-10-14");

  const { rows } = await sebagaiAdmin(
    db,
    `select periode, status_hasil, merah_beruntun from weekly_reports
      where unit_id = $1 and periode in ('2024-10-07','2024-10-14')
      order by periode`,
    [unitId],
  );
  harusSama(rows.length, 2);
  if (rows.every((r) => r.status_hasil === "merah")) {
    harusSama(rows[1].merah_beruntun, rows[0].merah_beruntun + 1);
  }
});

uji("hitungan pekan berjalan berhenti di hari berjalan", async () => {
  // Pekan berjalan tampil dari hitungan langsung; targetnya tidak boleh
  // memakai hari yang belum tiba.
  const penuh = await sebagaiAdmin(
    db,
    "select sum(target) t from hitung_laporan_mingguan($1, $1::date + 6)",
    [PEKAN],
  );
  const separuh = await sebagaiAdmin(
    db,
    "select sum(target) t from hitung_laporan_mingguan($1, $1::date + 2)",
    [PEKAN],
  );
  harus(
    Number(separuh.rows[0].t) < Number(penuh.rows[0].t),
    "target pekan berjalan harus lebih kecil dari target pekan penuh",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
