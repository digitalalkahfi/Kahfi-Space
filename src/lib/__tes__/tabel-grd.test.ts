import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  daftarDepartemen,
  departemenBaris,
  rentangBlok,
  saringDepartemen,
  statusBaris,
  type BarisTabelGrd,
  type BlokSel,
} from "../tabel-grd.ts";
import type { Tonggak } from "../rencana.ts";

const b = (id: string): BlokSel => ({ id, kode: id, teks: id, label: "" });
const baris = (p: string, m: string, l: string | null): BarisTabelGrd => ({
  rencanaId: `${p}${m}${l}`,
  kode: "",
  judul: "",
  jenis: "sekali",
  picTeks: "",
  jadwalTeks: "",
  tonggak: [],
  blok: { perusahaan: b(p), manager: b(m), leader: l ? b(l) : null },
});

test("sel digabung seperti spreadsheet: blok berurutan satu sel", () => {
  const r = rentangBlok([
    baris("1", "1.1", "1.1.0"),
    baris("1", "1.1", "1.1.0"),
    baris("1", "1.1", "1.1.1"),
    baris("1", "1.2", "1.2.1"),
    baris("M", "—a", "—b"),
  ]);
  assert.deepEqual(
    r.map((x) => [x.perusahaan, x.manager, x.leader]),
    [
      [4, 3, 2],
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
    ],
  );
});

test("baris tanpa blok tidak digabung dengan tetangganya", () => {
  const r = rentangBlok([baris("1", "1.1", null), baris("1", "1.1", null)]);
  assert.deepEqual(
    r.map((x) => x.leader),
    [1, 1],
  );
});

const t = (p: Partial<Tonggak>): Tonggak => ({
  id: "t",
  kunci: "",
  judul: "",
  tenggat: "2026-10-10",
  status: "belum",
  selesaiPada: null,
  catatan: "",
  ...p,
});

test("status dari tonggak; tanpa tonggak = tidak ada status", () => {
  assert.equal(statusBaris([], "2026-10-05"), null);
  assert.equal(statusBaris([t({})], "2026-10-05")?.status, "belum");
  assert.equal(
    statusBaris([t({ status: "progress" })], "2026-10-05")?.status,
    "berjalan",
  );
  assert.equal(statusBaris([t({})], "2026-10-11")?.status, "terlambat");
  assert.deepEqual(
    statusBaris(
      [
        t({ status: "selesai", selesaiPada: "2026-10-09T03:00:00Z" }),
        t({ tenggat: "2026-10-20" }),
      ],
      "2026-10-12",
    ),
    { status: "berjalan", selesai: 1, total: 2 },
  );
  assert.equal(
    statusBaris(
      [t({ status: "selesai", selesaiPada: "2026-10-12T03:00:00Z" })],
      "2026-10-15",
    )?.status,
    "selesai",
  );
});

const berlabel = (
  kode: string,
  p: string,
  l: string,
  label: string,
): BarisTabelGrd => ({
  ...baris(p, "m", l),
  kode,
  blok: {
    perusahaan: b(p),
    manager: b("m"),
    leader: { id: l, kode: l, teks: l, label },
  },
});

test("departemen dari label blok Goal Leader persis sheet", () => {
  const daftar = [
    berlabel("1.1.0.1", "1", "1.1.0", ""),
    berlabel("1.1.1.1", "1", "1.1.1", "GOAL LEADER AFFILIATOR (Siti)"),
    berlabel("1.1.4.1", "1", "1.1.4", "GOAL LEADER MABIT SCHOLAR (Agung)"),
    berlabel("1.1.5.1", "1", "1.1.5", "GOAL LEADER TAP (Fajar)"),
    berlabel("1.1.5.2", "1", "1.1.5", "GOAL LEADER TAP (Fajar)"),
    berlabel("M.1", "M", "—", ""),
    berlabel("S.1.1.1", "S", "S.1.1", "TATA KELOLA (Wildan)"),
  ];
  assert.deepEqual(departemenBaris(daftar[1]), {
    kunci: "affiliator",
    label: "Affiliator · Siti",
  });
  assert.deepEqual(
    daftarDepartemen(daftar).map((d) => [d.kunci, d.label, d.jumlah]),
    [
      ["umum", "Umum", 1],
      ["affiliator", "Affiliator · Siti", 1],
      ["mabit-scholar", "Mabit Scholar · Agung", 1],
      ["tap", "TAP · Fajar", 2],
      ["tonggak-manager", "Tonggak Manager", 1],
      ["tata-kelola", "Tata Kelola · Wildan", 1],
    ],
  );
  assert.deepEqual(
    saringDepartemen(daftar, "tap").map((x) => x.kode),
    ["1.1.5.1", "1.1.5.2"],
  );
  // Kunci tak dikenal: semua baris tetap tampil.
  assert.equal(saringDepartemen(daftar, "tidak-ada").length, daftar.length);
  assert.equal(saringDepartemen(daftar, null).length, daftar.length);
});
