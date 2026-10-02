/**
 * Mesin KPI aplikasi vs hitungan Excel atas file GRD Oktober 2026.
 *
 * `docs/grd/acuan-kpi-grd.json` berisi tangga, bobot, dan pencapaian dari
 * ke-16 blok KPI file GRD, beserta VALUE, TOTAL, NILAI, dan PREDIKAT yang
 * dihitung Microsoft Excel memakai rumus file itu sendiri (lihat
 * `scripts/acuan-kpi-grd.mjs`). Tes ini membuktikan rumus aplikasi
 * menghasilkan angka yang sama — bukan sekadar mirip.
 */
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  hitungLembarKpi,
  nilaiTangga,
  pecahanKePersen,
  type PredikatKpi,
} from "../kpi.ts";

type IndikatorAcuan = {
  sel: string;
  persen: boolean;
  tangga: number[];
  bobot: number;
  pencapaian: number | null;
  value: number;
  total: number;
};

type Acuan = {
  aplikasi: string;
  skenario: Record<string, string>;
  blok: {
    skenario: string;
    sel: string;
    nilai: number;
    predikat: PredikatKpi | null;
    indikator: IndikatorAcuan[];
  }[];
};

const JALUR = "docs/grd/acuan-kpi-grd.json";

if (!existsSync(JALUR)) {
  test("acuan hitungan Excel tersedia", () => {
    assert.fail(
      `${JALUR} belum ada. Jalankan: node scripts/acuan-kpi-grd.mjs siapkan, ` +
        "buka & simpan .tmp/grd/acuan-kpi-2026-10.xlsx di Excel, lalu " +
        "node scripts/acuan-kpi-grd.mjs ekstrak.",
    );
  });
} else {
  const acuan = JSON.parse(readFileSync(JALUR, "utf8")) as Acuan;
  const indikator = acuan.blok.flatMap((b) => b.indikator);

  test("acuan dihitung Excel atas seluruh 16 blok KPI di tiap skenario", () => {
    assert.match(acuan.aplikasi, /Microsoft.*Excel/i);
    assert.equal(acuan.blok.length, 16 * Object.keys(acuan.skenario).length);
    assert.equal(indikator.length, 66 * Object.keys(acuan.skenario).length);
    // Acuan harus menyentuh semua predikat, termasuk "BELUM DIISI".
    const predikat = new Set(acuan.blok.map((b) => b.predikat));
    for (const p of ["Istimewa", "Baik", "Cukup", "Perlu Perbaikan", null]) {
      assert.ok(
        predikat.has(p as PredikatKpi | null),
        `predikat ${p} belum teruji`,
      );
    }
  });

  test("VALUE dan TOTAL tiap indikator sama dengan Excel", () => {
    for (const i of indikator) {
      assert.equal(
        nilaiTangga(i.pencapaian, i.tangga),
        i.value,
        `${i.sel}: pencapaian ${i.pencapaian}`,
      );
      assert.equal(
        nilaiTangga(i.pencapaian, i.tangga) * i.bobot,
        i.total,
        i.sel,
      );
    }
  });

  test("VALUE tetap sama setelah persen ditulis 0–100 seperti di aplikasi", () => {
    for (const i of indikator.filter((x) => x.persen)) {
      assert.equal(
        nilaiTangga(
          i.pencapaian === null ? null : pecahanKePersen(i.pencapaian),
          i.tangga.map(pecahanKePersen),
        ),
        i.value,
        `${i.sel}: pencapaian ${i.pencapaian}`,
      );
    }
  });

  test("NILAI KPI dan PREDIKAT tiap blok sama dengan Excel", () => {
    for (const b of acuan.blok) {
      const hasil = hitungLembarKpi(
        b.indikator.map((i) => ({
          bobot: i.bobot,
          tangga: i.tangga,
          arah: "naik" as const,
          pencapaian: i.pencapaian,
        })),
      );
      assert.equal(hasil.total, b.nilai, `${b.skenario} ${b.sel}: NILAI`);
      assert.equal(
        hasil.predikat,
        b.predikat,
        `${b.skenario} ${b.sel}: PREDIKAT`,
      );
    }
  });
}
