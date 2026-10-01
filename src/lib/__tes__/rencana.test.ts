import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  kelompokRencana,
  keadaanTonggak,
  ringkasTonggak,
  type Rencana,
  type Tonggak,
} from "../rencana.ts";

const t = (p: Partial<Tonggak>): Tonggak => ({
  id: "t",
  kunci: "",
  judul: "Tonggak",
  tenggat: "2026-10-05",
  status: "belum",
  selesaiPada: null,
  catatan: "",
  ...p,
});

test("tepat waktu menurut tanggal WIB, sama dengan tonggak_tepat_waktu", () => {
  // 23.30 WIB tanggal 5 = 16.30 UTC: masih tepat.
  assert.equal(
    keadaanTonggak(
      t({ status: "selesai", selesaiPada: "2026-10-05T16:30:00Z" }),
      "2026-10-20",
    ),
    "tepat",
  );
  // 00.30 WIB tanggal 6 = 17.30 UTC tanggal 5: sudah terlambat.
  assert.equal(
    keadaanTonggak(
      t({ status: "selesai", selesaiPada: "2026-10-05T17:30:00Z" }),
      "2026-10-20",
    ),
    "terlambat",
  );
});

test("tonggak bertenggat hari ini belum terlambat; kemarin sudah lewat", () => {
  assert.equal(keadaanTonggak(t({}), "2026-10-05"), "menunggu");
  assert.equal(
    keadaanTonggak(t({ status: "progress" }), "2026-10-06"),
    "lewat",
  );
  assert.equal(
    keadaanTonggak(t({ tenggat: null }), "2026-10-06"),
    "tanpa_tenggat",
  );
});

test("ringkasan: jatuh = lewat tenggat atau sudah selesai", () => {
  const r = ringkasTonggak(
    [
      t({ status: "selesai", selesaiPada: "2026-10-04T03:00:00Z" }),
      t({
        tenggat: "2026-10-07",
        status: "selesai",
        selesaiPada: "2026-10-08T03:00:00Z",
      }),
      t({ tenggat: "2026-10-09" }),
      t({ tenggat: "2026-10-20" }),
      // Selesai lebih awal walau belum jatuh tempo: ikut dihitung tepat.
      t({
        tenggat: "2026-10-25",
        status: "selesai",
        selesaiPada: "2026-10-10T03:00:00Z",
      }),
      t({ tenggat: null }),
    ],
    "2026-10-15",
  );
  assert.deepEqual(r, {
    jatuh: 4,
    tepat: 2,
    terlambat: 1,
    lewat: 1,
    menunggu: 1,
    persen: 50,
  });
  assert.equal(ringkasTonggak([], "2026-10-15").persen, null);
});

test("rencana dikelompokkan per goal; tonggak Manager tersendiri", () => {
  const r = (
    kode: string,
    goalKode: string | null,
    indukKode: string,
  ): Rencana => ({
    id: kode,
    kode,
    goalKode,
    goalJudul: goalKode ? `Goal ${goalKode}` : null,
    indukKode,
    judul: kode,
    jenis: "sekali",
    picTeks: "",
    picNama: [],
    jadwalTeks: "",
    bolehCentang: false,
    tonggak: [],
  });
  const k = kelompokRencana([
    r("1.1.3.1", "1.1.3", "1.1.3"),
    r("M.1", null, "M"),
    r("1.1.3.2", "1.1.3", "1.1.3"),
  ]);
  assert.deepEqual(
    k.map((x) => [x.judul, x.rencana.map((y) => y.kode)]),
    [
      ["1.1.3 · Goal 1.1.3", ["1.1.3.1", "1.1.3.2"]],
      ["Tonggak Manager", ["M.1"]],
    ],
  );
});
