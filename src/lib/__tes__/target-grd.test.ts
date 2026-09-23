import { strict as assert } from "node:assert";
import { test } from "node:test";
import seed from "../../../supabase/seed/data.json" with { type: "json" };
import { targetHarianGrd } from "../goal.ts";

const ACUAN = seed.tanggalAcuan;

test("target harian adalah anak tangga bulan itu dibagi jumlah harinya", () => {
  const tangga = [{ bulan: "2024-10-01", target: 310_000 }];
  assert.equal(targetHarianGrd(tangga, "2024-10-24"), 10_000);
  // Februari kabisat: pembaginya 29, bukan 28 atau 30.
  assert.equal(
    targetHarianGrd([{ bulan: "2024-02-01", target: 290 }], "2024-02-15"),
    10,
  );
});

test("anak tangga bulan lain tidak ikut dihitung", () => {
  const tangga = [
    { bulan: "2024-10-01", target: 310_000 },
    { bulan: "2024-11-01", target: 900_000 },
  ];
  assert.equal(targetHarianGrd(tangga, "2024-10-24"), 10_000);
  assert.equal(targetHarianGrd(tangga, "2024-11-05"), 30_000);
});

test("bulan tanpa anak tangga bernilai nol, bukan NaN", () => {
  assert.equal(targetHarianGrd([], "2024-10-24"), 0);
  assert.equal(
    targetHarianGrd([{ bulan: "2024-10-01", target: 0 }], "2024-10-24"),
    0,
  );
  assert.equal(targetHarianGrd([], "2024-12-31"), 0);
});

test("beberapa goal pada bulan yang sama dijumlahkan dulu", () => {
  // Satu unit bisa punya lebih dari satu goal aktif; SQL menjumlahkannya.
  const tangga = [
    { bulan: "2024-10-01", target: 155_000 },
    { bulan: "2024-10-01", target: 155_000 },
  ];
  assert.equal(targetHarianGrd(tangga, "2024-10-10"), 10_000);
});

test("target akun di data contoh memang turunan GRD-nya", () => {
  // Kalau angka pintasan di seed dan anak tangga GRD berbeda, mode demo
  // memperlihatkan target yang tidak akan pernah muncul di mode Supabase.
  for (const akun of seed.accounts) {
    const goal = seed.goals.find(
      (g) => g.level === "account" && g.account === akun.username,
    );
    assert.ok(goal, `akun ${akun.username} belum punya goal GRD`);
    assert.equal(
      Math.round(targetHarianGrd(goal.bulan_list ?? [], ACUAN)),
      akun.target_harian,
      `target harian ${akun.username} tidak sama dengan anak tangga GRD-nya`,
    );
  }
});

test("target unit di data contoh juga turunan GRD-nya", () => {
  const harian = seed.targetUnitHarian as Record<string, number>;
  for (const [kode, nilai] of Object.entries(harian)) {
    const goal = seed.goals.find(
      (g) => g.level === "leader" && g.unit === kode,
    );
    assert.ok(goal, `unit ${kode} belum punya goal GRD`);
    assert.equal(
      Math.round(targetHarianGrd(goal.bulan_list ?? [], ACUAN)),
      nilai,
      `target harian unit ${kode} tidak sama dengan anak tangga GRD-nya`,
    );
  }
});
