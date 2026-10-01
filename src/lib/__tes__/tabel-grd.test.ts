import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  rentangBlok,
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
