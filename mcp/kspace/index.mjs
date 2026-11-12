#!/usr/bin/env node
/**
 * MCP server lokal `kspace` (stdio) — HANYA-BACA.
 *
 * Dijalankan oleh Claude Code / Claude Desktop di Mac ini. stdout adalah
 * saluran protokol MCP: tidak boleh ada `console.log` di mana pun.
 * Semua pesan untuk manusia lewat stderr.
 */
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { buatDbPg } from "./lib/db-pg.mjs";
import { buatPencatat } from "./lib/log.mjs";
import { buatServer, NAMA_SERVER, VERSI } from "./lib/server.mjs";

// Error tak terduga tidak boleh mencetak rincian (bisa memuat alamat
// database) dan tidak boleh menyentuh stdout.
process.on("uncaughtException", () => console.error("[kspace] error tak terduga"));
process.on("unhandledRejection", () => console.error("[kspace] error tak terduga"));

const db = buatDbPg();
const catat = buatPencatat();

serveStdio(() => buatServer({ db, catat }));
console.error(`[kspace] server MCP ${NAMA_SERVER} v${VERSI} siap (hanya-baca)`);
