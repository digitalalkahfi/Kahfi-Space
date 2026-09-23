import { strict as assert } from "node:assert";
import { test } from "node:test";
import { susunanDepartemen } from "@/lib/organisasi";
import type { AnggotaTim, Peran } from "@/lib/types";

const orang = (p: Partial<AnggotaTim>): AnggotaTim => ({
  id: p.id ?? "u1",
  nama: p.nama ?? "Orang",
  email: "o@x.id",
  role: (p.role ?? "Staff") as Peran,
  jabatan: "",
  unitKode: p.unitKode ?? "affiliator",
  unitNama: "Affiliator Network",
  departemenId: null,
  departemen: p.departemen ?? "Affiliator",
  programId: null,
  program: null,
  atasanId: null,
  atasanNama: null,
  inisial: "O",
  status: p.status ?? "aktif",
  akunDipegang: 0,
});

const pilihan = {
  departemen: [
    { id: "1", nama: "Affiliator" },
    { id: "2", nama: "MCN" },
  ],
  unit: [
    { kode: "affiliator" as const, nama: "Affiliator Network" },
    { kode: "mcn" as const, nama: "MCN" },
  ],
  program: [
    { id: "p1", nama: "Mabit Scholar", unitKode: "affiliator" as const },
    { id: "p2", nama: "MMC", unitKode: "mcn" as const },
  ],
};

test("departemen kosong tetap muncul, bukan disembunyikan", () => {
  const hasil = susunanDepartemen([orang({})], pilihan);
  assert.equal(hasil.length, 2);
  const mcn = hasil.find((d) => d.nama === "MCN");
  assert.equal(mcn?.jumlahAktif, 0);
  assert.equal(mcn?.penanggungJawab, null);
});

test("anggota nonaktif tidak ikut dihitung", () => {
  const hasil = susunanDepartemen(
    [orang({ id: "a" }), orang({ id: "b", status: "nonaktif" })],
    pilihan,
  );
  assert.equal(hasil.find((d) => d.nama === "Affiliator")?.jumlahAktif, 1);
});

test("penanggung jawab adalah peran tertinggi di departemennya", () => {
  const hasil = susunanDepartemen(
    [
      orang({ id: "a", nama: "Anisa", role: "Staff" }),
      orang({ id: "b", nama: "Dewi", role: "Leader" }),
      orang({ id: "c", nama: "Rudi", role: "Co-Leader" }),
    ],
    pilihan,
  );
  assert.equal(
    hasil.find((d) => d.nama === "Affiliator")?.penanggungJawab,
    "Dewi (Leader)",
  );
});

test("program diambil dari unit departemennya, bukan dari pesertanya", () => {
  // Program tanpa peserta tetap bagian dari susunan unit itu.
  const hasil = susunanDepartemen([orang({})], pilihan);
  assert.deepEqual(hasil.find((d) => d.nama === "Affiliator")?.program, [
    "Mabit Scholar",
  ]);
});

test("departemen terbesar tampil lebih dulu", () => {
  const hasil = susunanDepartemen(
    [
      orang({ id: "a" }),
      orang({ id: "b", departemen: "MCN", unitKode: "mcn" }),
      orang({ id: "c", departemen: "MCN", unitKode: "mcn" }),
    ],
    pilihan,
  );
  assert.deepEqual(
    hasil.map((d) => d.nama),
    ["MCN", "Affiliator"],
  );
});
