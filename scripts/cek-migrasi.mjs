/** Memastikan seluruh migrasi bisa dijalankan dari nol. */
import { buatDb, daftarMigrasi } from "./db-harness.mjs";

console.log("Menjalankan migrasi di PostgreSQL (PGlite)…");
for (const f of await daftarMigrasi()) console.log(`  · ${f}`);

let db;
try {
  db = await buatDb({ diam: false });
} catch (e) {
  console.error(`\n${e.message}`);
  process.exit(1);
}

const { rows } = await db.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name
`);
console.log(`\n${rows.length} tabel dibuat:`);
console.log(rows.map((r) => `  · ${r.table_name}`).join("\n"));

const { rows: rls } = await db.query(`
  select c.relname as tabel, c.relrowsecurity as rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname
`);
const tanpaRls = rls.filter((r) => !r.rls).map((r) => r.tabel);
console.log(
  tanpaRls.length
    ? `\n⚠ Tabel tanpa RLS: ${tanpaRls.join(", ")}`
    : "\n✓ Semua tabel mengaktifkan RLS",
);

await db.close();
