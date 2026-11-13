/**
 * Tool GRD MCP kspace (gmv_grd, lead_measure_pekan) di atas PGlite.
 *
 * Yang dijaga:
 *  - angka tool SAMA dengan fungsi halaman GRD yang dilihat Manager
 *    (progres_goal, kurva_grd, papan_lead_measure),
 *  - goal 1 = GMV MCN + akun internal belum MCN, dan aturannya tertulis,
 *  - GRD yang dipakai disebut jelas; bulan tanpa GRD diberi peringatan,
 *  - lead measure bersumber komisi tidak muncul,
 *  - input tidak valid ditolak sebelum menyentuh database.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../../scripts/db-harness.mjs";
import { NOV, siapkanGrdContoh } from "../../../scripts/grd-contoh.mjs";
import { panggilTool } from "../lib/server.mjs";
import { ATURAN_GOAL1, CATATAN_GMV, DAFTAR_TOOL, rupiah } from "../lib/tools.mjs";
import { buatDbPglite } from "./db-pglite.mjs";

const pg = await buatDb();
await terapkanSeed(pg);
const grd = await siapkanGrdContoh(pg);
const db = buatDbPglite(pg);
const { uji, jalankan } = buatSuite("MCP kspace — tool GRD vs halaman GRD");

const tool = (nama) => DAFTAR_TOOL.find((t) => t.nama === nama);
const panggil = (nama, argumen = {}) => panggilTool(tool(nama), db, argumen);
const manager = (sql, params = []) => sebagai(pg, grd.MANAGER, sql, params).then((h) => h.rows);
const T = "2024-11-05";

uji("gmv_grd: angka sama dengan progres_goal dan kurva_grd Manager", async () => {
  const h = await panggil("gmv_grd", { tanggal: T });
  harus(h.sukses, h.teks);
  harusSama(h.data.baris.map((b) => b.kode), ["1", "1.1", "1.2"], "goal");
  harusSama(h.data.periode_grd, NOV, "periode GRD");
  const progres = await manager("select goal_id, realisasi::text r, rasio::text x from progres_goal($1, $2)", [NOV, T]);
  const kurva = await manager("select goal_id, titik from kurva_grd($1, $2)", [NOV, T]);
  for (const b of h.data.baris) {
    const id = grd.goal[NOV][b.kode];
    const p = progres.find((r) => r.goal_id === id);
    harusSama([Number(b.realisasi), Number(b.rasio)], [Number(p.r), Number(p.x)], `progres ${b.kode}`);
    const lalu = kurva.find((k) => k.goal_id === id).titik.filter((t) => t.tanggal <= T).at(-1);
    harusSama(
      [b.titik_lalu, Number(b.target_titik_lalu), Number(b.aktual_titik_lalu), b.status_titik_lalu],
      [lalu.tanggal, Number(lalu.target), Number(lalu.aktual), lalu.status],
      `titik kurva ${b.kode}`,
    );
  }
  harusSama(h.data.baris.map((b) => Number(b.realisasi)), [1590, 390, 1200], "goal 1 tanpa hitung dobel");
});

uji("gmv_grd: teks menyebut GRD, rentang, aturan goal 1, angka, dan sumber", async () => {
  const h = await panggil("gmv_grd", { tanggal: T });
  for (const harap of [
    "GRD November 2024; GMV 2024-11-01 s.d. 2024-11-05 (WIB)",
    ATURAN_GOAL1,
    `realisasi ${rupiah(1590)} dari target ${rupiah(2000)} (79,5%)`,
    `titik kurva 2024-11-02: target ${rupiah(400)}, aktual ${rupiah(1060)} (HIJAU)`,
    `titik berikutnya 2024-11-09: target ${rupiah(800)}`,
    "(Perusahaan; pemilik Hafidz Alkahfi)",
    "(Manager; pemilik Farhan Pratama)",
    `Sumber: asisten.gmv_grd('${T}')`,
    CATATAN_GMV,
  ]) {
    harus(h.teks.includes(harap), `teks tanpa: ${harap}\n${h.teks}`);
  }
  harus(!h.teks.includes("Perhatian:"), "peringatan GRD lain muncul padahal GRD bulan ini ada");
});

uji("gmv_grd: bulan tanpa GRD diberi peringatan; sebelum GRD pertama 'tidak ada data'", async () => {
  const des = await panggil("gmv_grd", { tanggal: "2024-12-05" });
  harus(des.sukses, des.teks);
  harus(
    des.teks.includes("Perhatian: GRD Desember 2024 belum diimpor; yang dipakai GRD November 2024, angkanya sampai 2024-11-30."),
    `peringatan Desember hilang\n${des.teks}`,
  );
  harus(des.teks.includes("GMV 2024-11-01 s.d. 2024-11-30"), "rentang tidak berhenti di akhir November");
  harus(des.teks.includes("(MERAH)") && des.teks.includes("tidak ada titik kurva berikutnya"), "titik akhir bulan salah");

  const sep = await panggil("gmv_grd", { tanggal: "2024-09-15" });
  harus(sep.sukses, sep.teks);
  harusSama(sep.baris, 0, "baris September");
  harus(sep.teks.includes("Tidak ada data: belum ada GRD"), "kosong tidak ditulis kosong");
  harus(!sep.teks.includes("Rp0"), "kosong ditulis sebagai nol");
});

uji("lead_measure_pekan: sama dengan papan_lead_measure Manager, komisi tidak ikut", async () => {
  const goalDari = async (judul) =>
    (await sebagaiAdmin(pg, "select goal_id from lead_measures where judul = $1", [judul])).rows[0].goal_id;
  await sebagaiAdmin(
    pg,
    `insert into lead_measures (goal_id, judul, satuan, target_mingguan, urutan, sumber_laporan)
     values ($1, 'Komisi affiliator uji', 'IDR', 1000, 3, 'komisi')`,
    [await goalDari("Creator Binding MMC")],
  );
  const TGL = "2024-10-24";
  const papan = await manager(
    "select judul, realisasi::text r, target::text t, rasio::text x, sumber_laporan from papan_lead_measure($1)",
    [TGL],
  );
  harus(papan.some((m) => m.sumber_laporan === "komisi"), "papan tanpa lead komisi — tes tidak bermakna");
  const h = await panggil("lead_measure_pekan", { tanggal: TGL });
  harus(h.sukses, h.teks);
  const bukanKomisi = papan.filter((m) => m.sumber_laporan !== "komisi");
  harusSama(
    h.data.baris.map((b) => [b.judul, Number(b.realisasi), Number(b.target), Number(b.rasio)]),
    bukanKomisi.map((m) => [m.judul, Number(m.r), Number(m.t), Number(m.x)]),
    "lead measure",
  );
  harus(!h.teks.includes("Komisi affiliator uji"), "lead measure komisi bocor ke teks");
  for (const harap of [
    "Lead measure pekan 2024-10-21 (Senin) s.d. 2024-10-27 (Minggu), WIB — patokan 2024-10-24",
    "Peserta hadir MMC: 85",
    "diisi tangan",
    "Lead measure bersumber komisi tidak ditampilkan (di luar cakupan).",
    `Sumber: asisten.lead_measure_pekan('${TGL}')`,
  ]) {
    harus(h.teks.includes(harap), `teks tanpa: ${harap}\n${h.teks}`);
  }
});

uji("lead_measure_pekan: pekan tanpa isian ditulis 'belum ada isian', bukan nol polos", async () => {
  const h = await panggil("lead_measure_pekan", { tanggal: "2024-10-10" });
  harus(h.sukses, h.teks);
  harus(h.baris > 0, "lead measure seed tidak aktif — tes tidak bermakna");
  harus(h.data.baris.every((b) => Number(b.realisasi) === 0), "pekan ini seharusnya tanpa isian");
  harus(h.teks.includes("(belum ada isian pekan ini, atau memang nol)"), "nol tidak dijelaskan");
});

uji("input tidak valid ditolak sebelum menyentuh database (tool GRD)", async () => {
  const kasus = [
    ["gmv_grd", { tanggal: "2024-13-01" }],
    ["gmv_grd", { tanggal: "bulan ini" }],
    ["gmv_grd", { tgl: "2024-11-05" }],
    ["gmv_grd", { tanggal: "2024-11-05", sql: "select 1" }],
    ["lead_measure_pekan", { tanggal: "2024-02-30" }],
    ["lead_measure_pekan", { tanggal: 20241024 }],
    ["lead_measure_pekan", { tanggal: "2024-10-24'; drop table goals; --" }],
  ];
  const sebelum = db.panggilan;
  for (const [nama, argumen] of kasus) {
    const h = await panggil(nama, argumen);
    harus(!h.sukses, `seharusnya ditolak: ${nama} ${JSON.stringify(argumen)}`);
  }
  harusSama(db.panggilan, sebelum, "database tersentuh oleh input tidak valid");
});

await jalankan();
