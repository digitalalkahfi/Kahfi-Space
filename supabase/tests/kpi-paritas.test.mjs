/**
 * Paritas rumus KPI: `skor_kpi` di database vs `skorKpi` di aplikasi.
 *
 * Mode demo memakai rumus TypeScript, mode Supabase memakai SQL. Dua
 * salinan rumus yang sama adalah tempat paling gampang bagi keduanya untuk
 * diam-diam berbeda, jadi keduanya diadu langsung di sini.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";
import { predikatDariSkor, skorKpi } from "../../src/lib/kpi.ts";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Paritas rumus KPI");

const KASUS = [
  // realisasi, base, goal, stretch
  [0, 100, 200, 300],
  [-50, 100, 200, 300],
  [50, 100, 200, 300],
  [100, 100, 200, 300],
  [150, 100, 200, 300],
  [200, 100, 200, 300],
  [250, 100, 200, 300],
  [300, 100, 200, 300],
  [400, 100, 200, 300],
  [1, 0, 200, 300],
  [160, 0, 200, 300],
  [500, 0, 200, 300],
  [95.5, 90, 100, 120],
  [1_162_500_000, 930_000_000, 1_162_500_000, 1_453_125_000],
  [747_300_000, 930_000_000, 1_162_500_000, 1_453_125_000],
];

uji("skor tiap kasus sama persis di SQL dan TypeScript", async () => {
  for (const [realisasi, base, goal, stretch] of KASUS) {
    const { rows } = await sebagaiAdmin(db, "select skor_kpi($1,$2,$3,$4) s", [
      realisasi,
      base,
      goal,
      stretch,
    ]);
    harusSama(
      skorKpi(realisasi, base, goal, stretch),
      Number(rows[0].s),
      `skor(${realisasi}, ${base}, ${goal}, ${stretch})`,
    );
  }
});

uji("predikat tiap ambang sama di SQL dan TypeScript", async () => {
  for (const skor of [0, 499.9, 500, 649.9, 650, 799.9, 800, 1000]) {
    const { rows } = await sebagaiAdmin(db, "select predikat_dari_skor($1) p", [
      skor,
    ]);
    harusSama(predikatDariSkor(skor), rows[0].p, `predikat(${skor})`);
  }
});

uji("skala selalu 1.000, tidak pernah melewatinya", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select max(skor_kpi(g * 1000, 100, 200, 300)) t from generate_series(1, 50) g",
  );
  harusSama(Number(rows[0].t), 1000);
});

uji("rincian hitung_kpi bisa ditelusuri balik ke rumusnya", async () => {
  // Skor gabungan di scorecard harus bisa ditelusuri balik ke tiap indikator.
  // `realisasi` pada rincian dibulatkan satu angka di belakang koma untuk
  // dibaca manusia, sedangkan skornya dihitung dari angka penuh — jadi
  // penelusuran ulang boleh meleset sepersekian poin, bukan lebih.
  const { rows } = await sebagaiAdmin(
    db,
    `select d->>'nama' nama,
            (d->>'realisasi')::numeric realisasi,
            (d->>'skor')::numeric skor,
            k.target_base, k.target_goal, k.target_stretch
       from users u
       cross join lateral hitung_kpi(u.id, '2024-10-01', '2024-10-24') h
       cross join lateral jsonb_array_elements(h.detail) d
       join kpi_definitions k
         on k.jabatan = u.role::text and k.nama_kpi = d->>'nama'
      where u.nama = 'Nabila Putri' and (d->>'skor') is not null`,
  );

  harus(rows.length > 0, "rincian KPI harus ada untuk ditelusuri");
  for (const r of rows) {
    const ulang = skorKpi(
      Number(r.realisasi),
      Number(r.target_base),
      Number(r.target_goal),
      Number(r.target_stretch),
    );
    const selisih = Math.abs(ulang - Number(r.skor));
    harus(
      selisih <= 1,
      `${r.nama}: skor ${r.skor} vs penelusuran ${ulang} (selisih ${selisih})`,
    );
  }
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
