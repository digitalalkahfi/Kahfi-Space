/**
 * Lapisan query untuk TES: PGlite (Postgres di dalam proses).
 *
 * Bentuknya sama dengan lib/db-pg.mjs — satu transaksi hanya-baca
 * sebagai peran asisten_baca per panggilan — jadi tool yang diuji di
 * sini adalah kode yang sama persis dengan yang berjalan ke produksi.
 */
export function buatDbPglite(db) {
  let panggilan = 0;
  return {
    get panggilan() {
      return panggilan;
    },
    async baca(fn) {
      panggilan += 1;
      await db.exec("reset role;");
      await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
      await db.exec("begin; set transaction read only; set local role asisten_baca;");
      try {
        return await fn(async (sql, params = []) => (await db.query(sql, params)).rows);
      } finally {
        await db.exec("rollback;");
        await db.exec("reset role;");
      }
    },
  };
}
