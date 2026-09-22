/** Jejak pemeriksaan (QC): tiap keputusan tercatat, tidak bisa dihapus. */
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
const { uji, jalankan } = buatSuite("Jejak QC");

const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;

const MANAGER = await idUser("Farhan Pratama");
const MAYA = await idUser("Maya Safitri");
const ANISA = await idUser("Anisa Larasati");

const tugas = (
  await sebagaiAdmin(
    db,
    `select id from tasks where judul = 'Otorisasi Akun MMC Baru'`,
  )
).rows[0].id;

const jejak = async () =>
  (
    await sebagaiAdmin(
      db,
      `select hasil, catatan, hasil_kerja, diperiksa_oleh
       from task_qc_log where task_id=$1 order by created_at`,
      [tugas],
    )
  ).rows;

uji("putaran pertama: minta revisi tercatat", async () => {
  await sebagaiAdmin(
    db,
    `update tasks set hasil_kerja='Token 8 dari 12 kreator sudah dibuat.' where id=$1`,
    [tugas],
  );
  await sebagai(
    db,
    MANAGER,
    `update tasks set qc_status='revisi', qc_note='Lampirkan bukti 4 kreator sisanya.'
     where id=$1`,
    [tugas],
  );

  const j = await jejak();
  harusSama(j.length, 1);
  harusSama(j[0].hasil, "revisi");
  harus(j[0].catatan.includes("4 kreator"), "catatan tersimpan");
  harus(j[0].hasil_kerja.includes("8 dari 12"), "hasil kerja ikut terekam");
  harusSama(j[0].diperiksa_oleh, MANAGER);
});

uji("putaran kedua: lolos tercatat tanpa menimpa yang pertama", async () => {
  await sebagai(
    db,
    MAYA,
    `update tasks set status='menunggu_qc',
       hasil_kerja='Seluruh 12 token selesai, bukti terlampir.'
     where id=$1`,
    [tugas],
  );
  await sebagai(
    db,
    MANAGER,
    `update tasks set qc_status='lolos', qc_note='Lengkap, terima kasih.'
     where id=$1`,
    [tugas],
  );

  const j = await jejak();
  harusSama(j.length, 2, "jejak bertambah, bukan tertimpa");
  harusSama(j[0].hasil, "revisi", "putaran pertama tetap ada");
  harusSama(j[1].hasil, "lolos");
  harus(j[1].hasil_kerja.includes("12 token"), "konteks putaran kedua");
});

uji("tugas menjadi selesai setelah lolos", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select status from tasks where id=$1`,
    [tugas],
  );
  harusSama(rows[0].status, "selesai");
});

uji("penerima bisa membaca jejak QC-nya", async () => {
  const { rows } = await sebagai(
    db,
    MAYA,
    `select count(*)::int n from task_qc_log where task_id=$1`,
    [tugas],
  );
  harusSama(Number(rows[0].n), 2);
});

uji("orang tak terkait tidak bisa membaca jejak QC", async () => {
  const { rows } = await sebagai(
    db,
    ANISA,
    `select count(*)::int n from task_qc_log where task_id=$1`,
    [tugas],
  );
  harusSama(Number(rows[0].n), 0);
});

uji("jejak QC tidak bisa ditulis langsung", async () => {
  let ditolak = false;
  try {
    await sebagai(
      db,
      MANAGER,
      `insert into task_qc_log (task_id, hasil, catatan) values ($1,'lolos','palsu')`,
      [tugas],
    );
  } catch {
    ditolak = true;
  }
  harus(ditolak, "hanya trigger yang boleh menulis jejak QC");
});

uji("jejak QC tidak bisa dihapus", async () => {
  let ditolak = false;
  try {
    const r = await sebagai(db, MANAGER, `delete from task_qc_log`);
    ditolak = (r.affectedRows ?? 0) === 0;
  } catch {
    ditolak = true;
  }
  harus(ditolak, "jejak QC harus kekal");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
