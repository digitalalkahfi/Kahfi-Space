/**
 * Lapisan query untuk database sungguhan (Supabase Postgres).
 *
 * - Masuk sebagai peran `asisten_baca` — bukan service role, bukan anon,
 *   bukan akun pengguna.
 * - Setelan (alamat, nama pengguna) dibaca dari berkas DI LUAR repo:
 *   ~/.kspace-mcp/config.json. Sandi dibaca dari Keychain macOS.
 * - Tiap panggilan tool = satu sambungan baru + satu transaksi
 *   `READ ONLY` berbatas 15 detik, lalu ROLLBACK. Ini pengaman kedua di
 *   atas setelan peran dari migration 0217.
 * - SSL selalu diverifikasi. Tidak ada pilihan untuk mematikannya.
 */
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import pg from "pg";
import { GalatPengguna } from "./galat.mjs";

const jalankanBerkas = promisify(execFile);

export const LAYANAN_KEYCHAIN = "kspace-mcp";
export const AKUN_KEYCHAIN = "asisten_baca";

export function lokasiSetelan() {
  return process.env.KSPACE_MCP_CONFIG || path.join(os.homedir(), ".kspace-mcp", "config.json");
}

const BELUM_DISETEL =
  "MCP kspace belum disetel di Mac ini. Ikuti bagian 'Cara pasang' di mcp/kspace/README.md.";

export async function bacaSetelan(lokasi = lokasiSetelan()) {
  let mentah;
  try {
    mentah = JSON.parse(await readFile(lokasi, "utf8"));
  } catch {
    throw new GalatPengguna(`${BELUM_DISETEL} (berkas setelan tidak ada atau tidak terbaca)`, "setelan");
  }
  const { host, port = 5432, database = "postgres", user, caPath } = mentah ?? {};
  if (typeof host !== "string" || !host || typeof user !== "string" || !user) {
    throw new GalatPengguna("Berkas setelan kspace tidak lengkap: 'host' dan 'user' wajib diisi.", "setelan");
  }
  // Pagar: server ini HANYA boleh masuk sebagai asisten_baca. Nama lain
  // (postgres, service role, dst.) ditolak sebelum mencoba tersambung.
  if (user !== "asisten_baca" && !user.startsWith("asisten_baca.")) {
    throw new GalatPengguna("Berkas setelan kspace ditolak: 'user' harus asisten_baca (atau asisten_baca.<kode-proyek>).", "setelan");
  }
  if ("password" in mentah || "connectionString" in mentah) {
    throw new GalatPengguna("Berkas setelan kspace tidak boleh berisi sandi atau connection string. Sandi disimpan di Keychain.", "setelan");
  }
  return { host, port: Number(port), database, user, caPath: typeof caPath === "string" ? caPath : null };
}

/** Sandi dari Keychain macOS. Tidak pernah dicetak atau dicatat. */
export async function sandiDariKeychain() {
  try {
    const { stdout } = await jalankanBerkas("/usr/bin/security", [
      "find-generic-password",
      "-s",
      LAYANAN_KEYCHAIN,
      "-a",
      AKUN_KEYCHAIN,
      "-w",
    ]);
    const sandi = stdout.replace(/\n$/, "");
    if (!sandi) throw new Error("kosong");
    return sandi;
  } catch {
    throw new GalatPengguna(
      "Sandi asisten_baca belum ada di Keychain Mac ini. Ikuti bagian 'Cara pasang' di mcp/kspace/README.md.",
      "setelan",
    );
  }
}

export function buatDbPg({ ambilSetelan = bacaSetelan, ambilSandi = sandiDariKeychain } = {}) {
  return {
    async baca(fn) {
      const setelan = await ambilSetelan();
      const ssl = { rejectUnauthorized: true };
      if (setelan.caPath) {
        try {
          ssl.ca = await readFile(setelan.caPath, "utf8");
        } catch {
          throw new GalatPengguna("Sertifikat di 'caPath' berkas setelan kspace tidak terbaca.", "setelan");
        }
      }
      const klien = new pg.Client({
        host: setelan.host,
        port: setelan.port,
        database: setelan.database,
        user: setelan.user,
        password: await ambilSandi(),
        ssl,
        connectionTimeoutMillis: 10_000,
        query_timeout: 20_000,
        application_name: "kspace-mcp",
      });
      // Tanpa pendengar, error sambungan yang datang terlambat akan
      // menjatuhkan proses dan mencetak stack ke stderr.
      klien.on("error", () => {});
      try {
        await klien.connect();
        await klien.query("begin transaction read only");
        await klien.query("set local statement_timeout = '15s'");
        await klien.query("set local timezone = 'Asia/Jakarta'");
        const q = async (sql, params = []) => (await klien.query(sql, params)).rows;
        return await fn(q);
      } finally {
        await klien.query("rollback").catch(() => {});
        await klien.end().catch(() => {});
      }
    },
  };
}
