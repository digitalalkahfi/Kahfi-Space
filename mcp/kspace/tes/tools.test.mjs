/**
 * Tool MCP kspace di atas PGlite.
 *
 * Yang dijaga:
 *  - angka tiap tool SAMA dengan fungsi Beranda yang dilihat Manager,
 *  - input tidak valid ditolak SEBELUM menyentuh database,
 *  - peran asisten_baca tidak bisa menulis atau membaca tabel,
 *  - daftar tool tepat delapan, tanpa tool di luar cakupan.
 * Tool GRD (gmv_grd, lead_measure_pekan) diuji di grd.test.mjs.
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
} from "../../../scripts/db-harness.mjs";
import { panggilTool } from "../lib/server.mjs";
import { CATATAN_GMV, DAFTAR_TOOL, rupiah } from "../lib/tools.mjs";
import { buatDbPglite } from "./db-pglite.mjs";

const pg = await buatDb();
await terapkanSeed(pg);
const db = buatDbPglite(pg);
const { uji, jalankan } = buatSuite("MCP kspace — tool vs fungsi Beranda");

const tool = (nama) => DAFTAR_TOOL.find((t) => t.nama === nama);
const panggil = (nama, argumen = {}) => panggilTool(tool(nama), db, argumen);
const manager = await idPeran(pg, "Manager");
const beranda = async (sql, params = []) => (await sebagai(pg, manager, sql, params)).rows;

// Data contoh: laporan 1–24 Okt 2024; 24 Okt lengkap, 30 Okt belum ada.
const TGL = "2024-10-24";
const TGL_KOSONG = "2024-10-30";

uji("daftar tool tepat delapan dan semuanya hanya memanggil asisten.*", async () => {
  harusSama(
    DAFTAR_TOOL.map((t) => t.nama).sort(),
    [
      "belum_lapor",
      "gmv_grd",
      "gmv_harian",
      "gmv_unit",
      "lead_measure_pekan",
      "status_lapor",
      "tanggal_hari_ini",
      "tugas_telat",
    ],
    "nama tool",
  );
  const terlarang = /sql|query|kas|keuangan|gaji|absen|selfie|lokasi|email|telepon|alamat|komisi/i;
  for (const t of DAFTAR_TOOL) {
    harus(!terlarang.test(t.nama), `tool di luar cakupan: ${t.nama}`);
    harus(t.deskripsi.includes("Sumber: asisten."), `deskripsi ${t.nama} tanpa fungsi sumber`);
  }
});

uji("tanggal_hari_ini = asisten.hari_ini() dan hari_kerja_terakhir()", async () => {
  const h = await panggil("tanggal_hari_ini");
  const [asli] = (
    await sebagaiAdmin(
      pg,
      `select asisten.hari_ini()::text a, asisten.hari_kerja_terakhir(asisten.hari_ini())::text b`,
    )
  ).rows;
  harus(h.sukses, h.teks);
  harusSama([h.data.hari_ini, h.data.hari_kerja_terakhir], [asli.a, asli.b], "tanggal");
  harus(h.teks.includes(asli.a) && h.teks.includes("Sumber: asisten.hari_ini()"), "teks tanpa tanggal/sumber");
});

uji("status_lapor: jumlah & nama sama dengan status_tim_harian Manager", async () => {
  for (const t of [TGL, TGL_KOSONG]) {
    const asli = await beranda("select nama, wajib_lapor, sudah_lapor from status_tim_harian($1::date)", [t]);
    const h = await panggil("status_lapor", { tanggal: t });
    harus(h.sukses, h.teks);
    const wajib = asli.filter((r) => r.wajib_lapor);
    harusSama(
      h.data.ringkas,
      {
        wajib: wajib.length,
        sudah: wajib.filter((r) => r.sudah_lapor).length,
        belum: wajib.filter((r) => !r.sudah_lapor).length,
        tidak_wajib: asli.length - wajib.length,
      },
      `ringkasan ${t}`,
    );
    harus(h.teks.includes(`Sumber: asisten.status_lapor('${t}')`), "sumber tidak tertulis");
    harus(h.teks.includes(`hari tagih ${t}`), "tanggal tidak tertulis");
    for (const r of wajib) harus(h.teks.includes(r.nama), `nama ${r.nama} hilang dari teks`);
  }
});

uji("belum_lapor: daftar sama dengan Beranda, tanggal H-1 tertulis", async () => {
  for (const t of [TGL, TGL_KOSONG]) {
    const asli = (
      await beranda("select nama from status_tim_harian($1::date) where wajib_lapor and not sudah_lapor", [t])
    )
      .map((r) => r.nama)
      .sort();
    const h = await panggil("belum_lapor", { tanggal: t });
    harus(h.sukses, h.teks);
    harusSama(h.data.baris.map((b) => b.nama).sort(), asli, `belum lapor ${t}`);
    harusSama(h.baris, asli.length, "jumlah baris");
  }
  const kosong = await panggil("belum_lapor", { tanggal: TGL_KOSONG });
  harus(kosong.baris > 0, "kasus belum lapor kosong — tes tidak bermakna");
  harus(kosong.teks.includes("GMV tanggal 2024-10-29 (H-1)"), "tanggal H-1 tidak tertulis");
  harus(/Leader .+ \(\d+\):/.test(kosong.teks), "tidak dikelompokkan per Leader");
});

uji("tanggal kosong = hari ini WIB dari asisten.hari_ini()", async () => {
  const [{ t }] = (await sebagaiAdmin(pg, "select asisten.hari_ini()::text t")).rows;
  for (const nama of ["status_lapor", "belum_lapor", "gmv_unit"]) {
    const h = await panggil(nama);
    harus(h.sukses, h.teks);
    harusSama(h.data.tanggal, t, `tanggal default ${nama}`);
  }
});

uji("gmv_unit: GMV, target, dan persen sama dengan fungsi aslinya", async () => {
  const asli = await beranda("select * from ringkasan_gmv_unit($1::date) order by kode", [TGL]);
  const [{ porsi }] = await beranda(
    "select porsi_bulan_berjalan(date_trunc('month', $1::date)::date, $1::date) as porsi",
    [TGL],
  );
  const h = await panggil("gmv_unit", { tanggal: TGL });
  harus(h.sukses, h.teks);
  harusSama(
    h.data.baris.map((b) => [b.kode, Number(b.gmv_tanggal), Number(b.gmv_bulan)]),
    asli.map((r) => [r.kode, Number(r.gmv_hari_ini), Number(r.gmv_bulan_ini)]),
    "GMV per unit",
  );
  let adaTarget = false;
  for (const [i, b] of h.data.baris.entries()) {
    const target = Number(asli[i].target_bulanan);
    if (target > 0) {
      adaTarget = true;
      harusSama(Number(b.target_bulanan), target, `target bulanan ${b.kode}`);
      harusSama(Number(b.target_prorata), Math.round(target * Number(porsi)), `target prorata ${b.kode}`);
      harus(h.teks.includes(String(b.rasio_prorata).replace(".", ",") + "%"), `persen ${b.kode} hilang`);
    } else {
      harusSama(b.rasio_prorata, null, `rasio ${b.kode} tanpa target`);
    }
    harus(h.teks.includes(rupiah(b.gmv_bulan)), `GMV bulan ${b.kode} hilang dari teks`);
  }
  harus(adaTarget, "tidak ada unit bertarget — tes tidak bermakna");
  harus(h.teks.includes(CATATAN_GMV), "catatan GMV hilang");
  harus(h.teks.includes(`Sumber: asisten.gmv_unit('${TGL}')`), "sumber hilang");
  harus(h.teks.includes(`2024-10-01 s.d. ${TGL}`), "rentang bulan berjalan hilang");
});

uji("gmv_unit pada tanggal tanpa laporan: 'tidak ada laporan', bukan nol", async () => {
  const h = await panggil("gmv_unit", { tanggal: TGL_KOSONG });
  harus(h.sukses, h.teks);
  harus(h.data.baris.every((b) => b.ada_laporan === false), "seharusnya tidak ada laporan");
  harus(h.teks.includes(`GMV ${TGL_KOSONG} = tidak ada laporan`), "tidak tertulis 'tidak ada laporan'");
  harus(!h.teks.includes(`GMV ${TGL_KOSONG} = Rp0`), "GMV kosong tertulis sebagai nol");
});

uji("gmv_harian: sama dengan gmv_harian_per_unit; tanggal kosong disebut kosong", async () => {
  const asli = await beranda(
    "select tanggal::text, kode, gmv, jumlah_laporan from gmv_harian_per_unit($1::date, $2::date) order by tanggal, kode",
    ["2024-10-18", TGL_KOSONG],
  );
  const h = await panggil("gmv_harian", { dari: "2024-10-18", sampai: TGL_KOSONG });
  harus(h.sukses, h.teks);
  harus(asli.length > 0, "data contoh kosong — tes tidak bermakna");
  harusSama(
    h.data.baris.map((b) => [b.tanggal, b.kode, Number(b.gmv), Number(b.jumlah_laporan)]),
    asli.map((r) => [r.tanggal, r.kode, Number(r.gmv), Number(r.jumlah_laporan)]),
    "GMV harian",
  );
  const adaTanggal = new Set(asli.map((r) => r.tanggal));
  harus(h.data.tanggal_tanpa_laporan.includes(TGL_KOSONG), "30 Okt seharusnya tanpa laporan");
  harus(h.data.tanggal_tanpa_laporan.every((t) => !adaTanggal.has(t)), "tanggal berlaporan disebut kosong");
  harus(h.teks.includes("Tidak ada laporan (bukan nol)"), "kosong tidak ditulis kosong");
  harus(!h.teks.includes(`\n${TGL_KOSONG} (`), "tanggal kosong ditampilkan seolah ada angka");
  harus(h.teks.includes(CATATAN_GMV), "catatan GMV hilang");
});

uji("gmv_harian: saringan unit hanya menyaring, angka tidak berubah", async () => {
  const semua = await panggil("gmv_harian", { dari: "2024-10-18", sampai: TGL });
  const aff = await panggil("gmv_harian", { dari: "2024-10-18", sampai: TGL, unit: "Affiliator" });
  harus(aff.sukses && aff.baris > 0, "saringan Affiliator kosong");
  harusSama(
    aff.data.baris,
    semua.data.baris.filter((b) => b.kode === "affiliator"),
    "baris Affiliator",
  );
  const asing = await panggil("gmv_harian", { dari: "2024-10-18", sampai: TGL, unit: "tidak-ada" });
  harus(asing.sukses && asing.baris === 0, "unit tak dikenal seharusnya kosong");
  harus(asing.teks.includes("Tidak ada laporan untuk unit"), "unit tak dikenal tidak dijelaskan");
});

uji("tugas_telat: menunggu QC dipisah, selesai/batal/belum tenggat tidak ikut", async () => {
  await sebagaiAdmin(
    pg,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat, status) values
       ('pribadi', 'mcp uji telat',   $1, $1, '2024-10-20T10:00:00+07', 'berjalan'),
       ('pribadi', 'mcp uji baru',    $1, $1, '2024-10-23T10:00:00+07', 'todo'),
       ('pribadi', 'mcp uji selesai', $1, $1, '2024-10-20T10:00:00+07', 'selesai'),
       ('pribadi', 'mcp uji batal',   $1, $1, '2024-10-20T10:00:00+07', 'dibatalkan'),
       ('pribadi', 'mcp uji besok',   $1, $1, '2024-10-30T10:00:00+07', 'todo')`,
    [manager],
  );
  const WAKTU = "2024-10-24T08:00:00+07:00";
  const asli = (
    await sebagaiAdmin(pg, "select judul, kelompok, hari_telat from asisten.tugas_telat($1::timestamptz)", [WAKTU])
  ).rows;
  const h = await panggil("tugas_telat", { waktu: WAKTU });
  harus(h.sukses, h.teks);
  harusSama(h.baris, asli.length, "jumlah tugas");
  harusSama(h.data.telat.length, asli.filter((r) => r.kelompok === "telat").length, "kelompok telat");
  harusSama(h.data.menunggu_qc.length, asli.filter((r) => r.kelompok === "menunggu_qc").length, "kelompok QC");
  harus(h.data.telat.every((b) => b.status !== "menunggu_qc"), "menunggu QC bocor ke kelompok telat");
  harus(h.data.menunggu_qc.every((b) => b.status === "menunggu_qc"), "kelompok QC berisi status lain");

  const semua = [...h.data.telat, ...h.data.menunggu_qc].map((b) => b.judul);
  harus(semua.includes("mcp uji telat") && semua.includes("mcp uji baru"), "tugas telat tidak muncul");
  harus(!semua.some((j) => /mcp uji (selesai|batal|besok)/.test(j)), "tugas selesai/batal/belum tenggat ikut");
  harusSama(h.data.telat.find((b) => b.judul === "mcp uji telat").hari_telat, 4, "hari telat (WIB)");
  harus(h.teks.includes("MENUNGGU QC") && h.teks.includes("TELAT"), "dua kelompok tidak tertulis");

  // "Telat lebih dari 3 hari" = min_hari_telat 4.
  const lama = await panggil("tugas_telat", { waktu: WAKTU, min_hari_telat: 4 });
  const judulLama = [...lama.data.telat, ...lama.data.menunggu_qc].map((b) => b.judul);
  harus(judulLama.includes("mcp uji telat") && !judulLama.includes("mcp uji baru"), "saringan min_hari_telat salah");
  harusSama(lama.baris, asli.filter((r) => r.hari_telat >= 4).length, "jumlah setelah disaring");
});

uji("input tidak valid ditolak sebelum menyentuh database", async () => {
  const kasus = [
    ["status_lapor", { tanggal: "2024-13-01" }],
    ["status_lapor", { tanggal: "2024-02-30" }],
    ["status_lapor", { tanggal: "24-10-2024" }],
    ["status_lapor", { tanggal: "2024-10-24'; drop table users; --" }],
    ["status_lapor", { tanggal: 20241024 }],
    ["belum_lapor", { tanggal: "kemarin" }],
    ["belum_lapor", { tgl: "2024-10-24" }],
    ["gmv_unit", { tanggal: "2024-10-24", sql: "select 1" }],
    ["gmv_harian", { dari: "2024-10-01" }],
    ["gmv_harian", { dari: "2024-10-24", sampai: "2024-10-01" }],
    ["gmv_harian", { dari: "2024-01-01", sampai: "2024-10-01" }],
    ["gmv_harian", { dari: "2024-10-01", sampai: "2024-10-02", unit: "" }],
    ["tugas_telat", { waktu: "2024-10-24 08:00" }],
    ["tugas_telat", { waktu: "2024-10-24T08:00:00" }],
    ["tugas_telat", { min_hari_telat: -1 }],
    ["tugas_telat", { min_hari_telat: 1.5 }],
    ["tugas_telat", { min_hari_telat: "3" }],
    ["tanggal_hari_ini", { apa: "saja" }],
  ];
  const sebelum = db.panggilan;
  for (const [nama, argumen] of kasus) {
    const h = await panggil(nama, argumen);
    harus(!h.sukses, `seharusnya ditolak: ${nama} ${JSON.stringify(argumen)}`);
  }
  harusSama(db.panggilan, sebelum, "database tersentuh oleh input tidak valid");
  const [{ n }] = (await sebagaiAdmin(pg, "select count(*)::int n from users")).rows;
  harus(n > 0, "tabel users hilang");
});

uji("batas 92 hari: tepat 92 diterima, database tetap penjaga terakhir", async () => {
  const pas = await panggil("gmv_harian", { dari: "2024-07-24", sampai: "2024-10-24" });
  harus(pas.sukses, `92 hari seharusnya diterima: ${pas.teks}`);
  await harusDitolak(() => db.baca((q) => q("select * from asisten.gmv_harian('2024-01-01', '2024-10-01')")));
});

uji("asisten_baca tidak bisa membaca tabel atau menulis lewat lapisan query MCP", async () => {
  const dilarang = [
    "select * from users limit 1",
    "select * from daily_reports limit 1",
    "select * from transactions limit 1",
    "select * from attendance limit 1",
    "select * from auth.users limit 1",
    "insert into tasks (judul, pembuat_id, penerima_id) select 'x', id, id from users limit 1",
    "update units set nama = 'x'",
    "delete from tasks",
    "create table asisten.coba (a int)",
    "create table public.coba (a int)",
  ];
  for (const sql of dilarang) {
    await harusDitolak(() => db.baca((q) => q(sql)), `seharusnya ditolak: ${sql}`);
  }
});

await jalankan();
