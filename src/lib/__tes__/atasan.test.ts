import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  adaManagerAktif,
  atasanDisarankan,
  calonAtasan,
  periksaStruktur,
  peringatanAtasan,
  petaBawahan,
  petaRantai,
  sebabAtasanTakSah,
} from "../atasan.ts";
import type { AnggotaTim } from "../types.ts";

const orang = (
  id: string,
  nama: string,
  role: AnggotaTim["role"],
  unitNama: string,
  status: AnggotaTim["status"] = "aktif",
  atasanId: string | null = null,
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
  atasanId,
  atasanNama: null,
  inisial: "XX",
  status,
  akunDipegang: 0,
});

const ceo = orang("c1", "Azka", "CEO", "Manajemen");
const manager = orang("m1", "Farhan", "Manager", "Manajemen");
const leader = orang("l1", "Dewi", "Leader", "Affiliator");
const leaderLain = orang("l2", "Galih", "Leader", "MCN");
const coLeader = orang("k1", "Naima", "Co-Leader", "Affiliator");
const staf = orang("s1", "Anisa", "Staff", "Affiliator");
const finance = orang("f1", "Laras", "Finance", "Manajemen");

// Hierarki: CEO → Manager → Leader → Co-Leader → Staff.

test("garis pelaporan yang mengikuti hierarki tidak memunculkan peringatan", () => {
  assert.deepEqual(peringatanAtasan(manager, ceo), []);
  assert.deepEqual(peringatanAtasan(leader, manager), []);
  assert.deepEqual(peringatanAtasan(coLeader, leader), []);
  assert.deepEqual(peringatanAtasan(staf, coLeader), []);
  assert.deepEqual(peringatanAtasan(staf, leader), []);
  assert.deepEqual(peringatanAtasan(finance, ceo), []);
  assert.deepEqual(peringatanAtasan(finance, manager), []);
});

test("melompati jenjang ditandai salah", () => {
  // Leader langsung ke CEO padahal ada Manager.
  const p = peringatanAtasan(leader, ceo, { adaManager: true });
  assert.equal(p.length, 1);
  assert.equal(p[0].nada, "salah");
  assert.ok(p[0].pesan.includes("Manager"));

  // Staff langsung ke Manager.
  assert.equal(peringatanAtasan(staf, manager)[0]?.nada, "salah");
  // Manager ke Leader: terbalik.
  assert.equal(peringatanAtasan(manager, leader)[0]?.nada, "salah");
});

test("tanpa Manager aktif, Leader boleh melapor ke CEO", () => {
  assert.deepEqual(peringatanAtasan(leader, ceo, { adaManager: false }), []);
  assert.equal(adaManagerAktif([ceo, leader]), false);
  assert.equal(adaManagerAktif([ceo, manager]), true);
  assert.equal(
    adaManagerAktif([ceo, { ...manager, status: "nonaktif" }]),
    false,
  );
});

test("Co-Leader dan Staff melapor ke pimpinan unitnya sendiri", () => {
  assert.equal(sebabAtasanTakSah(staf, leaderLain)?.includes("unit"), true);
  assert.equal(sebabAtasanTakSah(coLeader, leaderLain) !== null, true);
  assert.equal(sebabAtasanTakSah(staf, leader), null);
});

test("garis pelaporan terbalik dan atasan diri sendiri ditolak", () => {
  assert.equal(peringatanAtasan(leader, staf)[0]?.nada, "salah");
  assert.equal(peringatanAtasan(staf, staf)[0]?.nada, "salah");
  assert.equal(peringatanAtasan(ceo, manager)[0]?.nada, "salah");
});

test("Finance melapor ke CEO atau Manager, bukan ke Staff", () => {
  assert.equal(peringatanAtasan(finance, staf)[0]?.nada, "salah");
  assert.equal(peringatanAtasan(staf, finance)[0]?.nada, "salah");
});

test("tanpa atasan tetap diberi catatan, kecuali untuk CEO", () => {
  const p = peringatanAtasan(staf, null);
  assert.equal(p.length, 1);
  assert.equal(p[0].nada, "hati-hati");
  assert.deepEqual(peringatanAtasan(ceo, null), []);
});

test("calon atasan hanya yang memenuhi hierarki, aktif, dan bukan bawahannya", () => {
  const semua = [ceo, manager, leader, leaderLain, coLeader, staf, finance];

  assert.deepEqual(
    calonAtasan(semua, staf, new Set()).map((c) => c.id),
    ["l1", "k1"],
    "Staff: Leader dan Co-Leader unitnya, urut cakupan",
  );
  assert.deepEqual(
    calonAtasan(semua, leader, new Set()).map((c) => c.id),
    ["m1"],
  );
  assert.deepEqual(
    calonAtasan(semua, coLeader, new Set()).map((c) => c.id),
    ["l1"],
  );
  assert.deepEqual(
    calonAtasan(semua, manager, new Set()).map((c) => c.id),
    ["c1"],
  );
  assert.deepEqual(calonAtasan(semua, ceo, new Set()), []);

  // Bawahan tidak ikut: memilihnya membuat rantai berputar.
  assert.deepEqual(
    calonAtasan(semua, leader, new Set(["m1"])).map((c) => c.id),
    [],
  );

  const pensiun = orang("l3", "Bekas", "Leader", "Affiliator", "nonaktif");
  assert.equal(
    calonAtasan([...semua, pensiun], staf, new Set()).some(
      (c) => c.id === "l3",
    ),
    false,
  );
});

test("usulan atasan hanya bila jawabannya tunggal", () => {
  const semua = [ceo, manager, leader, coLeader, staf];
  assert.equal(atasanDisarankan(semua, coLeader)?.id, "l1");
  assert.equal(atasanDisarankan(semua, leader)?.id, "m1");
  assert.equal(atasanDisarankan(semua, manager)?.id, "c1");
  assert.equal(atasanDisarankan(semua, ceo), null);

  // Unit dengan Leader dan Co-Leader sekaligus: Staff-nya bukan urusan
  // mesin — sebagian melapor ke Leader, sebagian ke Co-Leader.
  assert.equal(atasanDisarankan(semua, staf), null);
  // Tanpa Co-Leader, Staff ke Leader; tanpa Leader, ke Co-Leader.
  assert.equal(atasanDisarankan([ceo, manager, leader, staf], staf)?.id, "l1");
  assert.equal(
    atasanDisarankan([ceo, manager, coLeader, staf], staf)?.id,
    "k1",
  );

  // Tanpa Manager, Leader diusulkan ke CEO.
  assert.equal(atasanDisarankan([ceo, leader], leader)?.id, "c1");
});

test("program di dalam unit mempersempit usulan", () => {
  // Leader Mabit Scholar dan Leader affiliator internal ada di unit yang
  // sama; Staff Mabit Scholar diarahkan ke Leader seprogramnya.
  const leaderMabit = {
    ...orang("l5", "Agung", "Leader", "Affiliator"),
    programId: "mabit",
  };
  const stafMabit = {
    ...orang("s5", "Rusydan", "Staff", "Affiliator"),
    programId: "mabit",
  };
  const semua = [ceo, manager, leader, leaderMabit, stafMabit, staf];
  assert.equal(atasanDisarankan(semua, stafMabit)?.id, "l5");
  // Staff tanpa program: Leader tanpa program.
  assert.equal(atasanDisarankan(semua, staf)?.id, "l1");
});

test("pemeriksaan struktur membiarkan yang sah dan mengusulkan yang kosong", () => {
  const semua = [
    ceo,
    { ...manager, atasanId: "c1" },
    leader, // belum punya atasan → diusulkan Manager
    { ...coLeader, atasanId: "l1" },
    { ...staf, atasanId: "m1" }, // melanggar: Staff ke Manager; Leader & Co-Leader ada → butuh keputusan
    finance, // kosong → CEO lebih dulu daripada Manager
    orang("s2", "Arif", "Staff", "MCN"), // tanpa pimpinan unit: butuh keputusan
  ];
  const hasil = periksaStruktur(semua);

  assert.deepEqual(
    hasil.ubah.map((u) => [u.id, u.ke?.id ?? null]),
    [
      ["l1", "m1"],
      ["f1", "c1"],
    ],
  );
  assert.deepEqual(
    hasil.butuhKeputusan.map((b) => b.id),
    ["s1", "s2"],
  );
});

test("CEO yang tercatat punya atasan dilepas oleh pemeriksaan", () => {
  // Rantai terbalik (CEO → Manager → Leader) baru bisa disusun ulang
  // setelah puncaknya dilepas.
  const hasil = periksaStruktur([
    { ...ceo, atasanId: "m1" },
    { ...manager, atasanId: "c1" },
  ]);
  assert.deepEqual(
    hasil.ubah.map((u) => [u.id, u.ke]),
    [["c1", null]],
  );
});

test("pemeriksaan struktur menandai atasan yang sudah nonaktif", () => {
  const pensiun = orang("l9", "Bekas", "Leader", "Affiliator", "nonaktif");
  const hasil = periksaStruktur([
    ceo,
    { ...manager, atasanId: "c1" },
    pensiun,
    leader,
    { ...staf, atasanId: "l9" },
  ]);
  assert.deepEqual(
    hasil.ubah.map((u) => [u.id, u.dari, u.ke?.id ?? null]),
    [
      ["l1", null, "m1"],
      ["s1", "Bekas", "l1"],
    ],
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
