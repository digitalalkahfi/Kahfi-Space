/**
 * Merakit server MCP `kspace` dari daftar tool.
 *
 * Tidak tahu apa-apa soal cara tersambung ke database: `db` disuntikkan
 * (Postgres sungguhan atau PGlite saat tes). Setiap panggilan dicatat ke
 * log lokal, dan setiap error diganti dengan pesan aman.
 */
import { Server } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { galatAman } from "./galat.mjs";
import { DAFTAR_TOOL } from "./tools.mjs";

export const NAMA_SERVER = "kspace";
export const VERSI = "1.0.0";

/** Jalankan satu tool: validasi → query → catat. Dipakai server dan tes. */
export async function panggilTool(tool, db, argumen, catat = async () => {}) {
  const mulai = Date.now();
  let parameter = {};
  try {
    const hasilValidasi = tool.skema.safeParse(argumen ?? {});
    if (!hasilValidasi.success) {
      const pesan = hasilValidasi.error.issues
        .map((i) => `${i.path.join(".") || "parameter"}: ${i.message}`)
        .join("; ");
      await catat({ tool: tool.nama, parameter: {}, sukses: false, galat: "input", ms: Date.now() - mulai });
      return { sukses: false, teks: `Parameter tidak valid — ${pesan}` };
    }
    parameter = hasilValidasi.data;
    const hasil = await tool.jalankan(db, parameter);
    await catat({ tool: tool.nama, parameter, baris: hasil.baris, sukses: true, ms: Date.now() - mulai });
    return { sukses: true, ...hasil };
  } catch (e) {
    const { kode, pesan } = galatAman(e);
    await catat({ tool: tool.nama, parameter, sukses: false, galat: kode, ms: Date.now() - mulai });
    return { sukses: false, teks: `Gagal membaca data K-Space — ${pesan}` };
  }
}

export function buatServer({ db, catat }) {
  // Server tingkat rendah dipakai dengan sengaja: validasi parameter
  // dilakukan di `panggilTool`, sehingga panggilan yang DITOLAK (input
  // salah, nama tool tak dikenal) pun ikut tercatat di log.
  const server = new Server(
    { name: NAMA_SERVER, version: VERSI },
    {
      capabilities: { tools: {} },
      instructions: [
        "Data K-Space V2 (hanya-baca): lapor harian, GMV per unit vs target, dan tugas lewat tenggat.",
        "Setiap jawaban harus menyebut tanggal (WIB) dan fungsi sumber yang tertulis di hasil tool.",
        "Angka GMV adalah input manual K-Space; acuan resmi tetap Partner Center.",
        "Data di luar tool ini (keuangan/kas, gaji, absensi, lokasi, selfie, email, nomor HP, alamat) TIDAK bisa diakses: katakan 'data ini tidak bisa diakses', jangan menebak.",
        "Bila hasil menulis 'tidak ada laporan' atau 'tidak ada data', sampaikan apa adanya — jangan diganti nol.",
      ].join(" "),
    },
  );

  const daftar = DAFTAR_TOOL.map((tool) => ({
    name: tool.nama,
    title: tool.judul,
    description: tool.deskripsi,
    inputSchema: z.toJSONSchema(tool.skema),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }));
  server.setRequestHandler("tools/list", async () => ({ tools: daftar }));

  server.setRequestHandler("tools/call", async (permintaan) => {
    const nama = permintaan.params?.name;
    const tool = DAFTAR_TOOL.find((t) => t.nama === nama);
    if (!tool) {
      // Nama dari pemanggil tidak dicatat mentah: cukup tanda "tak dikenal".
      await catat({ tool: "(tak dikenal)", parameter: {}, sukses: false, galat: "tool", ms: 0 });
      return {
        content: [{ type: "text", text: `Tool tidak ada. Yang tersedia: ${DAFTAR_TOOL.map((t) => t.nama).join(", ")}.` }],
        isError: true,
      };
    }
    const hasil = await panggilTool(tool, db, permintaan.params.arguments, catat);
    return { content: [{ type: "text", text: hasil.teks }], isError: !hasil.sukses };
  });
  return server;
}
