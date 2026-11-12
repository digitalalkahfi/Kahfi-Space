/**
 * Memasang (atau memperbarui) salinan server MCP kspace di luar repo:
 *   ~/.kspace-mcp/server
 *
 * Claude Code dan Claude Desktop menjalankan SALINAN ini, bukan berkas
 * di repo — supaya berpindah branch di repo tidak mematikan MCP.
 * Jalankan ulang setiap kali kode MCP berubah:  npm run pasang
 *
 * Tidak menyentuh database dan tidak menyentuh sandi.
 */
import { execFileSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUMBER = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TUJUAN = path.join(os.homedir(), ".kspace-mcp", "server");

await mkdir(TUJUAN, { recursive: true, mode: 0o700 });
await rm(path.join(TUJUAN, "lib"), { recursive: true, force: true });
for (const nama of ["index.mjs", "lib", "package.json", "package-lock.json"]) {
  await cp(path.join(SUMBER, nama), path.join(TUJUAN, nama), { recursive: true });
}
console.log("Memasang dependensi (sekitar setengah menit)…");
execFileSync("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], { cwd: TUJUAN, stdio: "inherit" });

console.log(`\n✓ Server MCP kspace terpasang di ${TUJUAN}`);
console.log(`  Perintah untuk Claude: ${process.execPath} ${path.join(TUJUAN, "index.mjs")}`);
