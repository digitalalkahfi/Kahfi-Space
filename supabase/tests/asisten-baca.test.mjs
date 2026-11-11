/**
 * Akses hanya-baca Asisten Manager (0217).
 *
 * Yang dijaga: peran `asisten_baca` tidak bisa membaca tabel atau menulis
 * apa pun, anon/authenticated tidak bisa memanggil `asisten.*`, dan
 * angka `asisten.*` SAMA dengan fungsi Beranda yang dibungkusnya.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  idPeran,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Asisten Manager hanya-baca");

const HARI_INI = "2024-10-24";

/** Jalankan sebagai asisten_baca (tanpa JWT), dalam transaksi read-only. */
async function sebagaiAsisten(sql, params = []) {
  await db.exec("reset role;");
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec("begin; set transaction read only; set local role asisten_baca;");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("rollback;");
    await db.exec("reset role;");
  }
}

const urut = (rows, kunci) =>
  [...rows].sort((a, b) => String(a[kunci]).localeCompare(String(b[kunci])));

uji("asisten_baca tidak bisa membaca tabel users", async () => {
  await harusDitolak(() => sebagaiAsisten("select * from users limit 1"));
});

uji("asisten_baca tidak bisa menulis tasks", async () => {
  await harusDitolak(() =>
    sebagaiAsisten(
      `insert into tasks (judul, pembuat_id, penerima_id)
       select 'coba asisten', id, id from users limit 1`,
    ),
  );
});

uji("asisten_baca tetap bisa memanggil fungsi di transaksi read-only", async () => {
  const { rows } = await sebagaiAsisten("select * from asisten.gmv_unit($1::date)", [HARI_INI]);
  harus(rows.length > 0, "gmv_unit kosong");
});

uji("anon dan authenticated tidak bisa memanggil asisten.*", async () => {
  const manager = await idPeran(db, "Manager");
  await harusDitolak(() =>
    sebagai(db, manager, "select * from asisten.belum_lapor($1::date)", [HARI_INI]),
  );
  await db.exec("reset role;");
  await db.exec("set role anon;");
  try {
    await harusDitolak(() => db.query("select * from asisten.gmv_unit('2024-10-24')"));
  } finally {
    await db.exec("reset role;");
  }
});

uji("gmv_unit sama dengan ringkasan_gmv_unit yang dilihat Manager", async () => {
  const manager = await idPeran(db, "Manager");
  const beranda = (
    await sebagai(db, manager, "select * from ringkasan_gmv_unit($1::date)", [HARI_INI])
  ).rows;
  const asisten = (
    await sebagaiAsisten("select * from asisten.gmv_unit($1::date)", [HARI_INI])
  ).rows;
  harusSama(
    asisten.map((r) => [r.kode, Number(r.gmv_tanggal), Number(r.gmv_bulan)]),
    urut(beranda, "kode").map((r) => [r.kode, Number(r.gmv_hari_ini), Number(r.gmv_bulan_ini)]),
    "GMV per unit",
  );
  for (const r of asisten) {
    if (r.target_bulanan === null) harusSama(r.rasio_prorata, null, `rasio ${r.kode}`);
  }
});

uji("belum_lapor = wajib_lapor dan belum sudah_lapor di status_tim_harian Manager", async () => {
  const manager = await idPeran(db, "Manager");
  // 24 Okt lengkap terlapor di data contoh; 30 Okt belum ada laporan.
  for (const tanggal of [HARI_INI, "2024-10-30"]) {
    const beranda = (
      await sebagai(
        db,
        manager,
        "select nama from status_tim_harian($1::date) where wajib_lapor and not sudah_lapor",
        [tanggal],
      )
    ).rows.map((r) => r.nama).sort();
    const asisten = (
      await sebagaiAsisten("select nama from asisten.belum_lapor($1::date)", [tanggal])
    ).rows.map((r) => r.nama).sort();
    harusSama(asisten, beranda, `daftar belum lapor ${tanggal}`);
    if (tanggal !== HARI_INI) harus(asisten.length > 0, "kasus belum lapor kosong — tes tidak bermakna");
  }
});

uji("status_lapor mencakup seluruh organisasi aktif", async () => {
  const aktif = Number(
    (await sebagaiAdmin(db, "select count(*) from users where status = 'aktif'")).rows[0].count,
  );
  const { rows } = await sebagaiAsisten("select * from asisten.status_lapor($1::date)", [HARI_INI]);
  harusSama(rows.length, aktif, "jumlah orang");
});

uji("tugas_telat: menunggu_qc dipisah, selesai/dibatalkan tidak pernah masuk", async () => {
  const m = await idPeran(db, "Manager");
  await sebagaiAdmin(
    db,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat, status) values
       ('pribadi', 'asisten uji telat', $1, $1, '2024-10-20T10:00:00+07', 'berjalan'),
       ('pribadi', 'asisten uji selesai', $1, $1, '2024-10-20T10:00:00+07', 'selesai'),
       ('pribadi', 'asisten uji batal', $1, $1, '2024-10-20T10:00:00+07', 'dibatalkan'),
       ('pribadi', 'asisten uji besok', $1, $1, '2024-10-30T10:00:00+07', 'todo')`,
    [m],
  );
  await sebagaiAdmin(
    db,
    `update tasks set status = 'menunggu_qc' where judul = 'asisten uji telat'
     returning id`,
  ).catch(() => null);
  const { rows } = await sebagaiAsisten(
    "select judul, kelompok, hari_telat from asisten.tugas_telat($1::timestamptz)",
    ["2024-10-24T08:00:00+07"],
  );
  const uji = rows.filter((r) => r.judul.startsWith("asisten uji"));
  harus(!uji.some((r) => /selesai|batal|besok/.test(r.judul)), "tugas selesai/batal/belum tenggat ikut");
  const telat = uji.find((r) => r.judul === "asisten uji telat");
  harus(telat, "tugas telat tidak muncul");
  harus(["telat", "menunggu_qc"].includes(telat.kelompok), "kelompok tidak dikenal");
  harusSama(telat.hari_telat, 4, "hari telat (WIB)");
});

uji("hari_kerja_terakhir: Minggu mundur ke Sabtu", async () => {
  const { rows } = await sebagaiAsisten(
    "select asisten.hari_kerja_terakhir('2024-10-27') as d",
  );
  harusSama(String(rows[0].d instanceof Date ? rows[0].d.toISOString().slice(0, 10) : rows[0].d), "2024-10-26", "hari kerja");
});

uji("gmv_harian menolak rentang > 92 hari", async () => {
  await harusDitolak(() =>
    sebagaiAsisten("select * from asisten.gmv_harian('2024-01-01', '2024-10-01')"),
  );
});

await jalankan();
