/**
 * Siaran perubahan agenda.
 *
 * PGlite tidak punya publication `supabase_realtime`, jadi yang bisa
 * diuji di sini adalah dua hal yang menentukan siaran itu benar saat
 * dipasang di Supabase: migrasinya tidak gagal tanpa publication itu,
 * dan replica identity-nya penuh supaya siaran UPDATE/DELETE membawa
 * isi barisnya, bukan hanya kunci primer.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Siaran agenda");

uji("migrasi tetap jalan tanpa publication Supabase", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int n from pg_publication where pubname = 'supabase_realtime'",
  );
  harusSama(rows[0].n, 0, "lingkungan uji memang tanpa publication itu");

  // Seed tetap terpasang — artinya seluruh migrasi lolos.
  harus(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from agenda")).rows[0].n,
    ) > 0,
    "agenda contoh harus terpasang",
  );
});

uji("replica identity agenda penuh", async () => {
  // 'f' = full. Tanpa ini, siaran UPDATE hanya membawa id dan layar tidak
  // tahu tanggal mana yang berubah.
  const { rows } = await sebagaiAdmin(
    db,
    "select relreplident from pg_class where oid = 'agenda'::regclass",
  );
  harusSama(rows[0].relreplident, "f");
});

uji("RLS agenda tetap menyala — siaran ikut aturannya", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select relrowsecurity from pg_class where oid = 'agenda'::regclass",
  );
  harusSama(rows[0].relrowsecurity, true);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
