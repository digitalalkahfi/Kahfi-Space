/**
 * Mesin KPI di database vs hitungan Excel atas file GRD Oktober 2026.
 *
 * Padanan SQL `src/lib/__tes__/kpi-acuan-grd.test.ts`. Setiap blok acuan
 * dipasang sebagai lembar KPI sungguhan — persen ditulis 0–100 seperti
 * yang akan dilakukan skrip impor — lalu `hitung_kpi_grd` harus memberi
 * NILAI dan PREDIKAT yang sama dengan Excel.
 */
import { existsSync, readFileSync } from "node:fs";
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";
import { pecahanKePersen } from "../../src/lib/kpi.ts";

const JALUR = "docs/grd/acuan-kpi-grd.json";
const { uji, jalankan } = buatSuite("KPI GRD vs hitungan Excel");

if (!existsSync(JALUR)) {
  uji("acuan hitungan Excel tersedia", () => {
    throw new Error(
      `${JALUR} belum ada; lihat scripts/acuan-kpi-grd.mjs (siapkan → simpan di Excel → ekstrak)`,
    );
  });
  process.exit((await jalankan()) > 0 ? 1 : 0);
}

const acuan = JSON.parse(readFileSync(JALUR, "utf8"));
const db = await buatDb();
await terapkanSeed(db);

const angkaApp = (i, x) => (i.persen ? pecahanKePersen(x) : x);
const larik = (xs) => `{${xs.join(",")}}`;

uji("VALUE tiap indikator sama dengan Excel", async () => {
  let n = 0;
  for (const b of acuan.blok) {
    for (const i of b.indikator) {
      const { rows } = await sebagaiAdmin(
        db,
        "select nilai_tangga($1::numeric, $2::numeric[]) v",
        [
          i.pencapaian === null ? null : angkaApp(i, i.pencapaian),
          larik(i.tangga.map((t) => angkaApp(i, t))),
        ],
      );
      harusSama(rows[0].v, i.value, `${i.sel} (${b.skenario})`);
      n += 1;
    }
  }
  harus(n > 0, "acuan tidak berisi indikator");
});

uji("NILAI dan PREDIKAT lembar sama dengan Excel", async () => {
  const { rows: orang } = await sebagaiAdmin(
    db,
    "select id from users where nama = 'Bayu Nugraha'",
  );
  const user = orang[0].id;

  for (const [k, b] of acuan.blok.entries()) {
    // Satu bulan untuk tiap blok, jauh dari bulan data contoh.
    const bulan = new Date(Date.UTC(2001, k, 1)).toISOString().slice(0, 10);
    const { rows } = await sebagaiAdmin(
      db,
      `insert into kpi_lembar (user_id, periode_bulan, asal)
       values ($1, $2, $3) returning id`,
      [user, bulan, `${b.skenario} ${b.sel}`],
    );
    const lembar = rows[0].id;

    for (const [n, i] of b.indikator.entries()) {
      await sebagaiAdmin(
        db,
        `insert into kpi_indikator (lembar_id, urutan, nama, satuan, bobot, tangga)
         values ($1, $2, $3, $4, $5, $6::numeric[])`,
        [
          lembar,
          n + 1,
          `Indikator ${i.sel}`,
          i.persen ? "%" : "angka",
          i.bobot,
          larik(i.tangga.map((t) => angkaApp(i, t))),
        ],
      );
    }
    await sebagaiAdmin(
      db,
      "update kpi_lembar set status = 'aktif' where id = $1",
      [lembar],
    );

    for (const [n, i] of b.indikator.entries()) {
      if (i.pencapaian === null) continue;
      await sebagaiAdmin(
        db,
        `insert into kpi_pencapaian (indikator_id, nilai)
         select id, $3 from kpi_indikator where lembar_id = $1 and urutan = $2`,
        [lembar, n + 1, angkaApp(i, i.pencapaian)],
      );
    }

    const hasil = (
      await sebagaiAdmin(db, "select * from hitung_kpi_grd($1, $2)", [
        user,
        bulan,
      ])
    ).rows[0];
    harusSama(
      Number(hasil.skor_total),
      b.nilai,
      `${b.skenario} ${b.sel}: NILAI`,
    );
    harusSama(hasil.predikat, b.predikat, `${b.skenario} ${b.sel}: PREDIKAT`);
  }
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
