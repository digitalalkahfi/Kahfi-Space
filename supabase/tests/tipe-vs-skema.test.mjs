/**
 * Penjaga hanyutnya tipe.
 *
 * `src/lib/supabase/types.ts` ditulis tangan. Test ini membandingkannya dengan
 * skema PostgreSQL yang sebenarnya, supaya kolom yang ditambah di migrasi tapi
 * lupa ditambah di tipe (atau sebaliknya) langsung ketahuan.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buatDb, buatSuite, harus, sebagaiAdmin } from "../../scripts/db-harness.mjs";

const db = await buatDb();
const { uji, jalankan } = buatSuite("Tipe TypeScript vs skema database");

const sumber = await readFile(
  path.join(process.cwd(), "src/lib/supabase/types.ts"),
  "utf8",
);

/** Ambil { tabel: [kolom…] } dari anotasi @tabel di types.ts. */
function kolomDariTipe() {
  const hasil = {};
  const pola = /\/\*\* @tabel (\w+) \*\/\s*export type \w+ = \{([\s\S]*?)\n\};/g;
  let cocok;
  while ((cocok = pola.exec(sumber))) {
    const [, tabel, isi] = cocok;
    hasil[tabel] = isi
      .split("\n")
      .map((b) => b.trim())
      .filter((b) => b && !b.startsWith("//") && !b.startsWith("/*") && !b.startsWith("*"))
      .map((b) => b.match(/^([a-z_0-9]+)\??:/i)?.[1])
      .filter(Boolean);
  }
  return hasil;
}

const dariTipe = kolomDariTipe();

const { rows } = await sebagaiAdmin(
  db,
  `select table_name, column_name
   from information_schema.columns
   where table_schema = 'public'
   order by table_name, ordinal_position`,
);
const dariDb = {};
for (const r of rows) {
  (dariDb[r.table_name] ??= []).push(r.column_name);
}

uji("setiap tabel database punya tipe TypeScript", () => {
  const kurang = Object.keys(dariDb).filter((t) => !dariTipe[t]);
  harus(
    kurang.length === 0,
    `tabel tanpa tipe di types.ts: ${kurang.join(", ")}`,
  );
});

uji("tidak ada tipe untuk tabel yang tidak ada", () => {
  const berlebih = Object.keys(dariTipe).filter((t) => !dariDb[t]);
  harus(
    berlebih.length === 0,
    `tipe menyebut tabel yang tidak ada: ${berlebih.join(", ")}`,
  );
});

for (const tabel of Object.keys(dariDb)) {
  uji(`kolom \`${tabel}\` cocok`, () => {
    const ts = new Set(dariTipe[tabel] ?? []);
    const pg = new Set(dariDb[tabel]);
    const kurang = [...pg].filter((k) => !ts.has(k));
    const berlebih = [...ts].filter((k) => !pg.has(k));
    harus(
      kurang.length === 0 && berlebih.length === 0,
      [
        kurang.length ? `belum ada di types.ts: ${kurang.join(", ")}` : "",
        berlebih.length ? `tidak ada di database: ${berlebih.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    );
  });
}

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
