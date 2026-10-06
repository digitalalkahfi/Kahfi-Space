/**
 * Pemberi boleh menghapus tiket selesai dan tiket GRD (migrasi 0206).
 *
 *   · tiket SELESAI: hanya pemberinya, dan tidak bila tiket itu ikut KPI
 *     bulan yang sudah dikunci; penerima dikabari dengan kalimat yang
 *     pantas untuk pekerjaan yang sudah beres;
 *   · tiket GRD: hanya CEO/Manager yang menjadi pemberinya; tonggaknya
 *     ditandai `tanpa_tiket` sehingga pembuat tiket/impor tidak membuatnya
 *     lagi, dan kembali dikelola manual; bulan GRD terkunci tidak disentuh;
 *   · perbaikan data oleh sistem tidak menandai tonggak.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  pesanDb,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Hapus tiket selesai & tiket GRD (0206)");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const semua = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows;
const id = async (nama) =>
  (await satu("select id from users where nama = $1", [nama])).id;

const MANAGER = await id("Farhan Pratama");
const DEWI = await id("Dewi Lestari"); // Leader, atasan Rian; atasannya Manager
const RIAN = await id("Rian Hidayat");

const galatDari = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
};
const harusDitolak = (e, ket, kode = "42501") => {
  harus(e, `seharusnya ditolak: ${ket}`);
  harusSama(e.code, kode, `${ket}: ${pesanDb(e)}`);
};
const ada = async (tid) =>
  (await satu("select count(*)::int n from tasks where id = $1", [tid])).n === 1;
const notifikasi = async (userId, pola) =>
  (
    await semua(
      `select judul, pesan from notifications where user_id = $1 and judul like $2 order by created_at`,
      [userId, pola],
    )
  );

const buatTiket = async ({
  judul,
  pembuat = DEWI,
  penerima = RIAN,
  status = "todo",
  tenggat = "2099-03-10T17:00:00+07:00",
}) =>
  (
    await satu(
      `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat,
                          kriteria_selesai, status)
       values ('tiket', $1, $2, $3, $4::timestamptz, 'Laporan terkirim lengkap', $5::status_tugas)
       returning id`,
      [judul, pembuat, penerima, tenggat, status],
    )
  ).id;

let nomor = 0;
const periodeDepan = () => {
  nomor += 1;
  return `${2080 + Math.floor((nomor - 1) / 12)}-${String(((nomor - 1) % 12) + 1).padStart(2, "0")}-01`;
};
const hari = (periode, d) => `${periode.slice(0, 8)}${String(d).padStart(2, "0")}`;

async function rencana(periode, { kode, pic = [DEWI], jenis = "pekanan", tonggak }) {
  const r = await satu(
    `insert into grd_rencana (grd_periode, kode, induk_kode, judul, jenis, pic_ids, pic_teks, jadwal_teks, urutan)
     values ($1, $2, '1', $3, $4, $5::uuid[], 'uji', '', 1) returning id`,
    [periode, kode, `Rencana ${kode}`, jenis, `{${pic.join(",")}}`],
  );
  const ids = [];
  for (const [i, t] of tonggak.entries()) {
    ids.push(
      (
        await satu(
          `insert into grd_tonggak (rencana_id, kunci, judul, tenggat, status, urutan)
           values ($1, $2, $3, $4, $5, $6) returning id`,
          [r.id, String(i), t.judul ?? `Tonggak ${kode} ${i}`, t.tenggat, t.status ?? "belum", i + 1],
        )
      ).id,
    );
  }
  return ids;
}
const buat = async (periode, uji = false) =>
  (await satu("select buat_tiket_grd($1::date, $2) r", [periode, uji])).r;
const tiket = async (tonggakId) =>
  satu("select * from tasks where tonggak_id = $1", [tonggakId]);
const tonggak = async (tonggakId) =>
  satu("select status, selesai_pada, tanpa_tiket from grd_tonggak where id = $1", [tonggakId]);

// ---------------------------------------------------------------------
// Tiket selesai
// ---------------------------------------------------------------------
uji("tiket selesai: pemberinya boleh menghapus, jejak QC ikut, penerima dikabari dengan kalimat yang pantas", async () => {
  const tid = await buatTiket({ judul: "Laporan pekan selesai", status: "selesai" });
  await sebagaiAdmin(
    db,
    `insert into task_qc_log (task_id, hasil, catatan, diperiksa_oleh) values ($1, 'lolos', 'bagus', $2)`,
    [tid, DEWI],
  );
  const sebelum = (await notifikasi(RIAN, "Tiket selesai dihapus:%")).length;

  const { rows } = await sebagai(db, DEWI, `delete from tasks where id = $1 returning id`, [tid]);
  harusSama(rows.length, 1, "pemberi boleh");
  harus(!(await ada(tid)), "tiket terhapus");
  harusSama(
    (await satu("select count(*)::int n from task_qc_log where task_id = $1", [tid])).n,
    0,
    "jejak QC ikut terhapus",
  );

  const n = await notifikasi(RIAN, "Tiket selesai dihapus:%");
  harusSama(n.length, sebelum + 1, "penerima dikabari");
  harus(n.at(-1).pesan.includes("sudah kamu selesaikan"), n.at(-1).pesan);
  harus(!n.at(-1).pesan.includes("tidak perlu mengerjakannya"), "bukan kalimat untuk tiket yang belum beres");
});

uji("tiket belum selesai: kalimat kabar tetap yang lama", async () => {
  const tid = await buatTiket({ judul: "Belum selesai dihapus", status: "berjalan" });
  const sebelum = (await notifikasi(RIAN, "Tiket dihapus:%")).length;
  await sebagai(db, DEWI, `delete from tasks where id = $1`, [tid]);
  const n = await notifikasi(RIAN, "Tiket dihapus:%");
  harusSama(n.length, sebelum + 1, "penerima dikabari");
  harus(n.at(-1).pesan.includes("Kamu tidak perlu mengerjakannya lagi"), n.at(-1).pesan);
});

uji("tiket selesai: Manager yang bukan pemberi dan penerima tidak bisa menghapus", async () => {
  const tid = await buatTiket({ judul: "Selesai milik Dewi", status: "selesai" });
  const e = await galatDari(() =>
    sebagai(db, MANAGER, `delete from tasks where id = $1`, [tid]),
  );
  harusDitolak(e, "Manager bukan pemberi menghapus tiket selesai");
  harus(pesanDb(e).includes("hanya bisa dihapus oleh pemberinya"), pesanDb(e));
  // Penerima tidak punya wewenang hapus sama sekali (RLS: tidak ada baris).
  const { rows } = await sebagai(db, RIAN, `delete from tasks where id = $1 returning id`, [tid]);
  harusSama(rows.length, 0, "penerima tidak menyentuh apa pun");
  harus(await ada(tid), "tiket tetap ada");
});

uji("tiket selesai yang ikut KPI bulan terkunci tidak bisa dihapus, bahkan oleh pemberinya", async () => {
  const bulan = periodeDepan();
  const tid = await buatTiket({
    judul: "Selesai di bulan terkunci",
    status: "selesai",
    tenggat: `${hari(bulan, 10)}T17:00:00+07:00`,
  });
  await sebagaiAdmin(
    db,
    `insert into kpi_snapshots (user_id, periode_bulan, skor_total, predikat, dikunci_pada)
     values ($1, $2, 0, predikat_dari_skor(0), now())`,
    [RIAN, bulan],
  );
  const e = await galatDari(() =>
    sebagai(db, DEWI, `delete from tasks where id = $1`, [tid]),
  );
  harusDitolak(e, "menghapus tiket selesai di bulan terkunci", "23514");
  harus(pesanDb(e).includes("KPI bulan yang dikunci"), pesanDb(e));
  harus(await ada(tid), "tiket tetap ada");
});

uji("perbaikan data oleh sistem tetap boleh menghapus tiket apa pun", async () => {
  const tid = await buatTiket({ judul: "Dihapus admin", status: "selesai" });
  await sebagaiAdmin(db, `delete from tasks where id = $1`, [tid]);
  harus(!(await ada(tid)), "terhapus");
});

// ---------------------------------------------------------------------
// Tiket GRD
// ---------------------------------------------------------------------
uji("tiket GRD: Manager yang menjadi pemberinya boleh menghapus; tonggak ditandai dan tak dibuatkan lagi", async () => {
  const p = periodeDepan();
  // PIC = Dewi (Leader) → pemberinya atasannya, yaitu Manager.
  const [t0, t1] = await rencana(p, {
    kode: "H.1",
    tonggak: [
      { tenggat: hari(p, 6), judul: "Senin, 6" },
      { tenggat: hari(p, 13), judul: "Senin, 13" },
    ],
  });
  await buat(p);
  const tk0 = await tiket(t0);
  harusSama(tk0.pembuat_id, MANAGER, "pemberinya Manager");
  await sebagai(db, DEWI, `update tasks set status = 'berjalan' where id = $1`, [tk0.id]);
  harusSama((await tonggak(t0)).status, "progress", "status mengalir sebelum dihapus");

  const { rows } = await sebagai(db, MANAGER, `delete from tasks where id = $1 returning id`, [tk0.id]);
  harusSama(rows.length, 1, "Manager pemberi boleh menghapus tiket GRD");
  harus((await tiket(t0)) === undefined, "tiketnya terhapus");

  const tg = await tonggak(t0);
  harusSama(tg.tanpa_tiket, true, "tonggak ditandai");
  harusSama(tg.status, "progress", "tonggak memegang status terakhirnya");
  harusSama((await tonggak(t1)).tanpa_tiket, false, "tonggak lain tidak terpengaruh");

  // Pembuat tiket tidak membuatnya lagi, dan melaporkan alasannya.
  const lap = await buat(p, true);
  harusSama(lap.alasan_dilewati.tiket_dihapus, 1, "dilaporkan: tiket dihapus");
  harusSama(lap.dibuat, 0, "tidak ada yang akan dibuat");
  harusSama((await buat(p)).dibuat, 0, "dan sungguhan tidak dibuat");
  harus((await tiket(t0)) === undefined, "tetap tanpa tiket");

  // Kembali dikelola manual: PIC/atasan bisa mencentang.
  await sebagai(db, MANAGER, `select ubah_status_tonggak($1, 'selesai')`, [t0]);
  harusSama((await tonggak(t0)).status, "selesai", "tonggak bisa dicentang manual lagi");
});

uji("pulihkan_tiket_grd: tonggak dibuatkan tiket lagi; hanya CEO/Manager/sistem", async () => {
  const p = periodeDepan();
  const [t0] = await rencana(p, { kode: "H.2", tonggak: [{ tenggat: hari(p, 6), judul: "Senin, 6" }] });
  await buat(p);
  const tk = await tiket(t0);
  await sebagai(db, MANAGER, `delete from tasks where id = $1`, [tk.id]);
  harusSama((await buat(p)).dibuat, 0, "tidak dibuat lagi");

  const e = await galatDari(() => sebagai(db, DEWI, `select pulihkan_tiket_grd($1)`, [t0]));
  harusDitolak(e, "Leader memulihkan");

  await sebagai(db, MANAGER, `select pulihkan_tiket_grd($1)`, [t0]);
  harusSama((await tonggak(t0)).tanpa_tiket, false, "penanda dibatalkan");
  harusSama((await buat(p)).dibuat, 1, "dibuatkan tiket lagi");
  harus((await tiket(t0)) !== undefined, "tiket baru ada");
});

uji("tiket GRD yang sudah selesai: dihapus, tonggaknya tetap selesai dengan waktu aslinya", async () => {
  const p = periodeDepan();
  const [t0] = await rencana(p, { kode: "H.3", tonggak: [{ tenggat: hari(p, 6), judul: "Senin, 6" }] });
  await buat(p);
  const tk = await tiket(t0);
  await sebagai(db, DEWI, `update tasks set status = 'menunggu_qc', hasil_kerja = 'hasil kerja siap' where id = $1`, [tk.id]);
  await sebagai(db, MANAGER, `update tasks set qc_status = 'lolos' where id = $1`, [tk.id]);
  const sebelum = await tonggak(t0);
  harusSama(sebelum.status, "selesai", "tonggak selesai lewat QC");

  await sebagai(db, MANAGER, `delete from tasks where id = $1`, [tk.id]);
  const sesudah = await tonggak(t0);
  harusSama(sesudah.status, "selesai", "status selesai tetap");
  harusSama(
    new Date(sesudah.selesai_pada).getTime(),
    new Date(sebelum.selesai_pada).getTime(),
    "waktu selesai (saat diajukan) tidak berubah — KPI tonggak utuh",
  );
  harusSama(sesudah.tanpa_tiket, true, "ditandai");
});

uji("tiket GRD di bulan yang KPI-nya terkunci tidak bisa dihapus", async () => {
  const p = periodeDepan();
  const [t0] = await rencana(p, { kode: "H.4", tonggak: [{ tenggat: hari(p, 6), judul: "Senin, 6" }] });
  await buat(p);
  const tk = await tiket(t0);
  await sebagaiAdmin(
    db,
    `insert into kpi_snapshots (user_id, periode_bulan, skor_total, predikat, dikunci_pada)
     values ($1, $2, 0, predikat_dari_skor(0), now())`,
    [RIAN, p],
  );
  const e = await galatDari(() => sebagai(db, MANAGER, `delete from tasks where id = $1`, [tk.id]));
  harusDitolak(e, "menghapus tiket GRD di bulan terkunci", "23514");
  harus(pesanDb(e).includes("sudah dikunci"), pesanDb(e));
  harus((await tiket(t0)) !== undefined, "tiket tetap ada");
  harusSama((await tonggak(t0)).tanpa_tiket, false, "tonggak tidak ditandai");
});

uji("tiket GRD: pemberi biasa (Leader) tidak bisa menghapus", async () => {
  const p = periodeDepan();
  // PIC = Rian → pemberinya Dewi (Leader).
  const [t0] = await rencana(p, { kode: "H.5", pic: [RIAN], tonggak: [{ tenggat: hari(p, 6), judul: "Senin, 6" }] });
  await buat(p);
  const tk = await tiket(t0);
  harusSama(tk.pembuat_id, DEWI, "pemberinya Leader");
  const e = await galatDari(() => sebagai(db, DEWI, `delete from tasks where id = $1`, [tk.id]));
  harusDitolak(e, "Leader menghapus tiket GRD");
  harus(pesanDb(e).includes("CEO atau Manager yang menjadi pemberinya"), pesanDb(e));
  harusSama((await tonggak(t0)).tanpa_tiket, false, "tonggak tidak ditandai");
});

uji("penghapusan oleh sistem tidak menandai tonggak", async () => {
  const p = periodeDepan();
  const [t0] = await rencana(p, { kode: "H.6", tonggak: [{ tenggat: hari(p, 6), judul: "Senin, 6" }] });
  await buat(p);
  const tk = await tiket(t0);
  await sebagaiAdmin(db, `delete from tasks where id = $1`, [tk.id]);
  harusSama((await tonggak(t0)).tanpa_tiket, false, "tidak ditandai");
  harusSama((await buat(p)).dibuat, 1, "dibuatkan lagi (perbaikan data, bukan keputusan pemberi)");
});

uji("migrasi 0206 aman dijalankan ulang", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase", "migrations", "0206_hapus_tiket_selesai_dan_grd.sql"),
    "utf8",
  );
  await sebagaiAdmin(db, sql);
  await sebagaiAdmin(db, sql);
  const tid = await buatTiket({ judul: "Setelah migrasi diulang", status: "selesai" });
  const { rows } = await sebagai(db, DEWI, `delete from tasks where id = $1 returning id`, [tid]);
  harusSama(rows.length, 1, "masih berfungsi");
});

await jalankan();
