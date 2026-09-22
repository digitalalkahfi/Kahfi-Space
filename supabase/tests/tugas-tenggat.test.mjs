/** Pengelompokan tenggat & penyaringan tugas di sisi database. */
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
const { uji, jalankan } = buatSuite("Tenggat & penyaringan tugas");

const ACUAN = "2024-10-24";
const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;

const MANAGER = await idUser("Farhan Pratama");
const RIAN = await idUser("Rian Hidayat");

const daftar = async (id, saringan = "semua") =>
  (
    await sebagai(db, id, `select * from daftar_tugas($1::date, $2)`, [
      ACUAN,
      saringan,
    ])
  ).rows;

uji("kelompok tenggat dihitung benar", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select
       kelompok_tenggat_dari('2024-10-23T10:00:00+07:00'::timestamptz, $1::date) a,
       kelompok_tenggat_dari('2024-10-24T10:00:00+07:00'::timestamptz, $1::date) b,
       kelompok_tenggat_dari('2024-10-25T10:00:00+07:00'::timestamptz, $1::date) c,
       kelompok_tenggat_dari('2024-11-01T10:00:00+07:00'::timestamptz, $1::date) d,
       kelompok_tenggat_dari(null, $1::date) e`,
    [ACUAN],
  );
  harusSama(rows[0].a, "terlambat");
  harusSama(rows[0].b, "hari_ini");
  harusSama(rows[0].c, "besok");
  harusSama(rows[0].d, "nanti");
  harusSama(rows[0].e, "tanpa_tenggat");
});

uji("saringan 'saya' hanya to-do pribadi yang belum selesai", async () => {
  const r = await daftar(MANAGER, "saya");
  harus(r.length > 0, "Manager punya to-do pribadi");
  harus(
    r.every((t) => t.tipe === "pribadi" && t.status !== "selesai"),
    "saringan bocor",
  );
});

uji("saringan 'tiket' hanya tiket", async () => {
  const r = await daftar(MANAGER, "tiket");
  harus(r.every((t) => t.tipe === "tiket"), "saringan bocor");
});

uji("saringan 'qc' hanya yang menunggu pemeriksaan", async () => {
  const r = await daftar(MANAGER, "qc");
  harus(r.every((t) => t.status === "menunggu_qc"), "saringan bocor");
});

uji("saringan 'selesai' hanya yang sudah selesai", async () => {
  const r = await daftar(MANAGER, "selesai");
  harus(r.every((t) => t.status === "selesai"), "saringan bocor");
});

uji("urutan mendahulukan prioritas tinggi", async () => {
  const r = await daftar(MANAGER, "tiket");
  const prioritas = r.map((t) => t.prioritas);
  const bobot = { tinggi: 0, sedang: 1, rendah: 2 };
  const urut = [...prioritas].sort((a, b) => bobot[a] - bobot[b]);
  harusSama(prioritas, urut, "urutan prioritas salah");
});

uji("tugas yang lewat tenggat naik ke atas", async () => {
  await sebagaiAdmin(
    db,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat, prioritas)
     values ('tiket', 'Tugas telat kemarin', $1, $2,
             '2024-10-23T17:00:00+07:00', 'rendah')`,
    [MANAGER, RIAN],
  );
  const r = await daftar(MANAGER, "tiket");
  harusSama(r[0].judul, "Tugas telat kemarin", "yang telat harus paling atas");
  harusSama(r[0].kelompok, "terlambat");
});

uji("hitungan lencana cocok dengan daftarnya", async () => {
  const { rows } = await sebagai(db, MANAGER, `select * from hitung_tugas($1::date)`, [
    ACUAN,
  ]);
  const h = rows[0];
  harusSama(Number(h.semua), (await daftar(MANAGER, "semua")).length);
  harusSama(Number(h.tiket), (await daftar(MANAGER, "tiket")).length);
  harusSama(Number(h.qc), (await daftar(MANAGER, "qc")).length);
  harusSama(Number(h.terlambat), 1, "satu tugas telat yang baru dibuat");
});

uji("cakupan peran tetap berlaku pada daftar tersaring", async () => {
  const manager = await daftar(MANAGER, "semua");
  const rian = await daftar(RIAN, "semua");
  harus(
    rian.length < manager.length,
    `Staff ${rian.length} vs Manager ${manager.length}`,
  );
  harus(
    !rian.some((t) => t.judul === "Cek 14 sesi live sore"),
    "to-do pribadi Manager bocor",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
