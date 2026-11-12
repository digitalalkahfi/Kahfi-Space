/**
 * Server MCP kspace dilihat dari luar: lewat protokol MCP sungguhan.
 *
 * Yang dijaga:
 *  - klien MCP melihat tepat enam tool, semuanya bertanda hanya-baca,
 *  - log panggilan mencatat nama tool/parameter/jumlah baris, TANPA isi data,
 *  - proses server asli tidak menulis apa pun ke stdout selain pesan protokol,
 *  - sandi dan alamat database tidak pernah muncul di hasil tool, log, atau stderr.
 */
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buatDb, buatSuite, harus, harusDitolak, harusSama, terapkanSeed } from "../../../scripts/db-harness.mjs";
import { bacaSetelan, buatDbPg } from "../lib/db-pg.mjs";
import { galatAman } from "../lib/galat.mjs";
import { buatPencatat } from "../lib/log.mjs";
import { buatServer, panggilTool } from "../lib/server.mjs";
import { DAFTAR_TOOL } from "../lib/tools.mjs";
import { buatDbPglite } from "./db-pglite.mjs";

const DIR_MCP = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pg = await buatDb();
await terapkanSeed(pg);
const { uji, jalankan } = buatSuite("MCP kspace — protokol, log, dan rahasia");

const sementara = await mkdtemp(path.join(os.tmpdir(), "kspace-mcp-tes-"));
const dirLog = path.join(sementara, "log");
const bacaLog = async () =>
  (await readFile(path.join(dirLog, "panggilan.log"), "utf8"))
    .trim()
    .split("\n")
    .map((b) => JSON.parse(b));

async function klienDalamMemori() {
  const server = buatServer({ db: buatDbPglite(pg), catat: buatPencatat(dirLog) });
  const [sisiKlien, sisiServer] = InMemoryTransport.createLinkedPair();
  await server.connect(sisiServer);
  const klien = new Client({ name: "tes-kspace", version: "0.0.0" });
  await klien.connect(sisiKlien);
  return klien;
}

uji("klien MCP melihat tepat enam tool bertanda hanya-baca", async () => {
  const klien = await klienDalamMemori();
  const { tools } = await klien.listTools();
  harusSama(
    tools.map((t) => t.name).sort(),
    ["belum_lapor", "gmv_harian", "gmv_unit", "status_lapor", "tanggal_hari_ini", "tugas_telat"],
    "daftar tool",
  );
  for (const t of tools) {
    harusSama(t.annotations?.readOnlyHint, true, `readOnlyHint ${t.name}`);
    harus(t.description.length > 80, `deskripsi ${t.name} terlalu pendek`);
    harusSama(t.inputSchema.additionalProperties, false, `${t.name} menerima kunci asing`);
  }
  await klien.close();
});

uji("panggilan lewat protokol: berhasil, input salah → isError, log tanpa isi data", async () => {
  const klien = await klienDalamMemori();
  const baik = await klien.callTool({ name: "belum_lapor", arguments: { tanggal: "2024-10-30" } });
  harus(!baik.isError, "panggilan sah gagal");
  const teks = baik.content[0].text;
  harus(teks.includes("Sumber: asisten.belum_lapor('2024-10-30')"), "sumber hilang");

  const gmv = await klien.callTool({ name: "gmv_unit", arguments: { tanggal: "2024-10-24" } });
  harus(!gmv.isError, "gmv_unit gagal");

  const buruk = await klien.callTool({ name: "belum_lapor", arguments: { tanggal: "besok" } });
  harus(buruk.isError, "input salah tidak ditandai error");

  const asing = await klien.callTool({ name: "jalankan_sql", arguments: { sql: "select 1" } }).catch((e) => e);
  harus(asing instanceof Error || asing.isError, "tool tak dikenal seharusnya ditolak");
  harus(!JSON.stringify(asing.content ?? "").includes("select 1"), "isi permintaan asing dipantulkan");

  const log = await bacaLog();
  const sah = log.find((l) => l.tool === "belum_lapor" && l.sukses);
  harus(sah, "panggilan sah tidak tercatat");
  harusSama(sah.parameter, { tanggal: "2024-10-30" }, "parameter di log");
  harus(typeof sah.baris === "number" && sah.baris > 0, "jumlah baris tidak tercatat");
  harus(typeof sah.waktu === "string" && typeof sah.ms === "number", "waktu/lama tidak tercatat");
  harus(log.some((l) => l.tool === "belum_lapor" && !l.sukses && l.galat === "input"), "kegagalan tidak tercatat");

  // Isi data tidak boleh ikut: tidak ada nama orang, tidak ada angka GMV.
  const mentah = await readFile(path.join(dirLog, "panggilan.log"), "utf8");
  const { rows: orang } = await pg.query("select nama from users");
  for (const { nama } of orang) harus(!mentah.includes(nama), `nama "${nama}" bocor ke log`);
  const angka = gmv.content[0].text.match(/Rp[\d.]{6,}/g) ?? [];
  harus(angka.length > 0, "tidak ada angka GMV untuk dibandingkan");
  for (const a of angka) {
    harus(!mentah.includes(a) && !mentah.includes(a.replace(/\D/g, "")), `angka ${a} bocor ke log`);
  }
  for (const l of log) {
    harusSama(
      Object.keys(l).filter((k) => !["waktu", "tool", "parameter", "baris", "sukses", "galat", "ms"].includes(k)),
      [],
      "kolom log di luar daftar",
    );
  }
  await klien.close();
});

// -------------------------------------------------------------------
// Proses server asli (index.mjs), tanpa setelan: stdout harus murni MCP.
// -------------------------------------------------------------------
function jalankanServerAsli(pesan) {
  return new Promise((selesai, gagal) => {
    const anak = spawn(process.execPath, [path.join(DIR_MCP, "index.mjs")], {
      env: {
        PATH: process.env.PATH,
        HOME: sementara, // tidak ada ~/.kspace-mcp di sini
        KSPACE_MCP_CONFIG: path.join(sementara, "tidak-ada.json"),
        KSPACE_MCP_LOG_DIR: path.join(sementara, "log-asli"),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let keluar = "";
    let galat = "";
    anak.stdout.on("data", (d) => {
      keluar += d;
      // Tutup setelah balasan terakhir datang.
      if (keluar.includes(`"id":${pesan.at(-1).id}`)) anak.stdin.end();
    });
    anak.stderr.on("data", (d) => (galat += d));
    anak.on("error", gagal);
    anak.on("close", () => selesai({ keluar, galat }));
    for (const p of pesan) anak.stdin.write(JSON.stringify(p) + "\n");
    setTimeout(() => anak.kill(), 15_000).unref();
  });
}

uji("server asli: stdout hanya pesan protokol MCP; tanpa setelan menjawab rapi", async () => {
  const { keluar, galat } = await jalankanServerAsli([
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "tes", version: "0" } },
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "belum_lapor", arguments: {} } },
  ]);
  const baris = keluar.split("\n").filter((b) => b.trim() !== "");
  harus(baris.length >= 3, `balasan kurang: ${baris.length}`);
  const pesan = baris.map((b) => {
    try {
      return JSON.parse(b);
    } catch {
      throw new Error(`stdout berisi teks bukan protokol: ${b.slice(0, 80)}`);
    }
  });
  for (const p of pesan) harusSama(p.jsonrpc, "2.0", "baris stdout bukan JSON-RPC");

  harusSama(pesan.find((p) => p.id === 1)?.result?.serverInfo?.name, "kspace", "nama server");
  harusSama(pesan.find((p) => p.id === 2)?.result?.tools?.length, 6, "jumlah tool");
  const panggilan = pesan.find((p) => p.id === 3)?.result;
  harus(panggilan?.isError === true, "tanpa setelan seharusnya error rapi");
  harus(panggilan.content[0].text.includes("belum disetel"), "pesan 'belum disetel' tidak muncul");
  harus(galat.includes("[kspace]"), "pesan siap seharusnya ke stderr");
  harus(!/at .+\.mjs:\d+/.test(galat), "stack trace bocor ke stderr");
});

// -------------------------------------------------------------------
// Rahasia
// -------------------------------------------------------------------
const SANDI = "S4ndi-RAHASIA-jangan-bocor-9f3a";
const HOST = "rahasia-host.example.invalid";

uji("pesan error tidak pernah memuat sandi, alamat, atau connection string", async () => {
  const bahan = [
    Object.assign(new Error(`password authentication failed for user "asisten_baca.abc" ${SANDI}`), { code: "28P01" }),
    Object.assign(new Error(`getaddrinfo ENOTFOUND ${HOST}`), { code: "ENOTFOUND" }),
    Object.assign(new Error(`connect ECONNREFUSED postgresql://asisten_baca:${SANDI}@${HOST}:5432/postgres`), {
      code: "ECONNREFUSED",
    }),
    Object.assign(new Error(`permission denied for table users ${SANDI}`), { code: "42501" }),
    Object.assign(new Error(`${SANDI} sesuatu yang aneh di ${HOST}`), { code: "XX000" }),
    Object.assign(new Error(`self-signed certificate in chain ${HOST}`), { code: "SELF_SIGNED_CERT_IN_CHAIN" }),
    Object.assign(new Error(`pesan rekaan ${SANDI}`), { code: "P0001" }),
    new Error(`postgresql://asisten_baca:${SANDI}@${HOST}/postgres`),
    SANDI,
    null,
  ];
  for (const e of bahan) {
    const { pesan } = galatAman(e);
    harus(!pesan.includes(SANDI) && !pesan.includes(HOST) && !pesan.includes("postgresql://"), `bocor: ${pesan}`);
  }
  // Pesan `raise exception` milik asisten.* tetap diteruskan apa adanya.
  harusSama(
    galatAman(Object.assign(new Error("Rentang maksimal 92 hari"), { code: "P0001" })).pesan,
    "Rentang maksimal 92 hari",
    "pesan fungsi asisten",
  );
});

uji("sambungan gagal: sandi & alamat tidak muncul di hasil tool maupun log", async () => {
  const dir = path.join(sementara, "log-rahasia");
  const db = buatDbPg({
    ambilSetelan: async () => ({ host: "127.0.0.1", port: 1, database: "postgres", user: "asisten_baca.abc", caPath: null }),
    ambilSandi: async () => SANDI,
  });
  const h = await panggilTool(
    DAFTAR_TOOL.find((t) => t.nama === "gmv_unit"),
    db,
    { tanggal: "2024-10-24" },
    buatPencatat(dir),
  );
  harus(!h.sukses, "sambungan ke port mati seharusnya gagal");
  const log = await readFile(path.join(dir, "panggilan.log"), "utf8");
  for (const teks of [h.teks, log]) {
    harus(!teks.includes(SANDI), "sandi bocor");
    harus(!teks.includes("127.0.0.1") && !teks.includes("asisten_baca.abc"), "alamat/pengguna bocor");
  }
});

uji("berkas setelan: hanya asisten_baca, tanpa sandi di dalamnya", async () => {
  const tulis = async (isi) => {
    const p = path.join(sementara, `setelan-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(p, JSON.stringify(isi));
    return p;
  };
  const sah = await bacaSetelan(await tulis({ host: "h.example", user: "asisten_baca.abcd" }));
  harusSama([sah.port, sah.database, sah.user], [5432, "postgres", "asisten_baca.abcd"], "nilai bawaan");

  for (const user of ["postgres", "postgres.abcd", "service_role", "authenticator.abcd", "asisten_baca2"]) {
    await harusDitolak(async () => bacaSetelan(await tulis({ host: "h.example", user })), `user ${user} diterima`);
  }
  await harusDitolak(async () =>
    bacaSetelan(await tulis({ host: "h.example", user: "asisten_baca.abcd", password: SANDI })),
  );
  await harusDitolak(async () =>
    bacaSetelan(await tulis({ host: "h.example", user: "asisten_baca.abcd", connectionString: "x" })),
  );
  await harusDitolak(() => bacaSetelan(path.join(sementara, "tidak-ada.json")));
});

await jalankan();
