/**
 * Catatan panggilan tool.
 *
 * Satu baris JSON per panggilan: waktu, nama tool, parameter, jumlah
 * baris, sukses/gagal, lama. ISI DATA TIDAK DICATAT — berkas ini boleh
 * dibaca kapan saja tanpa membuka angka GMV atau nama orang.
 *
 * Lokasi: ~/Library/Logs/kspace-mcp/panggilan.log (di luar repo).
 */
import { appendFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function dirLog() {
  return process.env.KSPACE_MCP_LOG_DIR || path.join(os.homedir(), "Library", "Logs", "kspace-mcp");
}

export function buatPencatat(dir = dirLog()) {
  const berkas = path.join(dir, "panggilan.log");
  let siap = null;

  return async function catat(entri) {
    try {
      siap ??= mkdir(dir, { recursive: true, mode: 0o700 });
      await siap;
      await appendFile(berkas, JSON.stringify({ waktu: new Date().toISOString(), ...entri }) + "\n", {
        mode: 0o600,
      });
    } catch {
      // Gagal mencatat tidak boleh menggagalkan jawaban. stderr saja —
      // stdout adalah saluran protokol MCP.
      console.error("[kspace] gagal menulis log panggilan");
    }
  };
}
