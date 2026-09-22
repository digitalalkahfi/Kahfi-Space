import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  calonAtasan,
  peringatanAtasan,
  petaBawahan,
  petaRantai,
} from "../atasan.ts";
import type { AnggotaTim } from "../types.ts";

const orang = (
  id: string,
  nama: string,
  role: AnggotaTim["role"],
  unitNama: string,
  status: AnggotaTim["status"] = "aktif",
): AnggotaTim => ({
  id,
  nama,
  email: `${id}@alkahfi.co.id`,
  role,
  jabatan: `${role} ${unitNama}`,
  unitKode: null,
  unitNama,
  departemenId: null,
  departemen: null,
  programId: null,
  program: null,
  atasanId: null,
  atasanNama: null,
  inisial: "XX",
  status,
  akunDipegang: 0,
});

const staf = orang("s1", "Anisa", "Staff", "Affiliator");
const leader = orang("l1", "Dewi", "Leader", "Affiliator");
const leaderLain = orang("l2", "Galih", "Leader", "MCN");
const manager = orang("m1", "Farhan", "Manager", "Manajemen");

test("atasan yang wajar tidak memunculkan peringatan", () => {
  assert.deepEqual(peringatanAtasan(staf, leader), []);
  assert.deepEqual(peringatanAtasan(leader, manager), []);
});

test("garis pelaporan terbalik ditandai salah", () => {
  const p = peringatanAtasan(leader, staf);
  assert.equal(p.length, 1);
  assert.equal(p[0].nada, "salah");
});

test("atasan diri sendiri ditolak", () => {
  const p = peringatanAtasan(staf, staf);
  assert.equal(p[0].nada, "salah");
});

test("peran setara diperingatkan, tidak dilarang", () => {
  const rekan = orang("s2", "Arif", "Staff", "Affiliator");
  const p = peringatanAtasan(staf, rekan);
  assert.equal(
    p.some((x) => x.nada === "salah"),
    false,
  );
  assert.equal(
    p.some((x) => x.nada === "hati-hati"),
    true,
  );
});

test("lintas unit diperingatkan, tidak dilarang", () => {
  const p = peringatanAtasan(staf, leaderLain);
  assert.equal(
    p.some((x) => x.nada === "salah"),
    false,
  );
  assert.equal(
    p.some((x) => x.pesan.includes("lintas unit")),
    true,
  );
});

test("tanpa atasan tetap diberi catatan", () => {
  const p = peringatanAtasan(staf, null);
  assert.equal(p.length, 1);
  assert.equal(p[0].nada, "hati-hati");
});

test("bawahan tidak boleh jadi calon atasan", () => {
  // Kalau ikut terdaftar, memilihnya akan membuat rantai berputar.
  const calon = calonAtasan([staf, leader, manager], leader, new Set(["s1"]));
  assert.deepEqual(
    calon.map((c) => c.id),
    ["m1"],
  );
});

test("anggota nonaktif tidak jadi calon atasan", () => {
  const pensiun = orang("l3", "Bekas", "Leader", "TAP", "nonaktif");
  const calon = calonAtasan([staf, leader, pensiun], staf, new Set());
  assert.equal(
    calon.some((c) => c.id === "l3"),
    false,
  );
});

test("calon diurutkan dari cakupan terluas", () => {
  const calon = calonAtasan([staf, leader, manager], staf, new Set());
  assert.deepEqual(
    calon.map((c) => c.id),
    ["m1", "l1"],
  );
});

test("peta rantai menyusun garis pelaporan berjenjang", () => {
  const staf2 = { ...staf, atasanId: "l1" };
  const leader2 = { ...leader, atasanId: "m1" };
  const peta = petaRantai([staf2, leader2, manager]);
  assert.deepEqual(
    peta["s1"].map((m) => m.nama),
    ["Dewi", "Farhan"],
  );
  assert.deepEqual(
    peta["l1"].map((m) => m.nama),
    ["Farhan"],
  );
  assert.deepEqual(peta["m1"], []);
});

test("data yang terlanjur berputar tidak menggantung", () => {
  // Database menolak siklus, tapi tampilan tidak boleh bergantung pada itu.
  const a = { ...staf, id: "a", atasanId: "b" };
  const b = { ...leader, id: "b", atasanId: "a" };
  const peta = petaRantai([a, b]);
  assert.equal(peta["a"].length <= 2, true);
});

test("peta bawahan mencakup cabang tidak langsung", () => {
  const staf2 = { ...staf, atasanId: "l1" };
  const leader2 = { ...leader, atasanId: "m1" };
  const peta = petaBawahan([staf2, leader2, manager]);
  assert.deepEqual(peta["m1"].sort(), ["l1", "s1"]);
  assert.deepEqual(peta["l1"], ["s1"]);
  assert.deepEqual(peta["s1"], []);
});

test("Finance disetarakan dengan Staff, bukan di bawahnya", () => {
  // Database memakai peringkat yang sama (0070); kalau layar memakai
  // urutan enum apa adanya, peringatannya akan bercerita berbeda.
  const finance = {
    id: "f",
    nama: "Laras Ayuningtyas",
    role: "Finance" as const,
    unitNama: "Manajemen",
  };
  const staf = {
    id: "s",
    nama: "Nabila Putri",
    role: "Staff" as const,
    unitNama: "Affiliator Network",
  };

  const keStaf = peringatanAtasan(finance, staf);
  assert.equal(
    keStaf.some((p) => p.nada === "salah"),
    false,
    "Staff sebagai atasan Finance bukan pembalikan",
  );

  const keFinance = peringatanAtasan(staf, finance);
  assert.equal(
    keFinance.some((p) => p.nada === "salah"),
    false,
    "Finance sebagai atasan Staff juga bukan pembalikan",
  );
});
