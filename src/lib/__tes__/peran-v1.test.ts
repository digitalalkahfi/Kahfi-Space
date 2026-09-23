import { strict as assert } from "node:assert";
import { test } from "node:test";
import { peranV1, statusV1, unitV1 } from "@/lib/peran-v1";

test("sebutan peran lama diterjemahkan ke peran V2", () => {
  assert.equal(peranV1("CEO"), "CEO");
  assert.equal(peranV1("  manajer "), "Manager");
  assert.equal(peranV1("Team  Leader"), "Leader");
  assert.equal(peranV1("co leader"), "Co-Leader");
  assert.equal(peranV1("keuangan"), "Finance");
});

test("peran yang tidak dikenali tidak ditebak jadi Staff", () => {
  // Peran menentukan siapa melihat apa; menebaknya memberi orang akses
  // yang tidak pernah diberikan siapa pun.
  assert.equal(peranV1("Intern"), null);
  assert.equal(peranV1(""), null);
  assert.equal(peranV1(null), null);
  assert.equal(peranV1(42), null);
});

test("divisi lama dipetakan ke kode unit V2", () => {
  assert.equal(unitV1("AFFILIATOR"), "affiliator");
  assert.equal(unitV1("MCN (incl. MMC)"), "mcn");
  assert.equal(unitV1("TikTok Agency Partner"), "tap");
  assert.equal(unitV1("Divisi Baru"), null);
});

test("status aktif dibaca dari berbagai bentuk penandanya", () => {
  assert.equal(statusV1(true), "aktif");
  assert.equal(statusV1(false), "nonaktif");
  assert.equal(statusV1("false"), "nonaktif");
  assert.equal(statusV1("resign"), "nonaktif");
  // Tidak disebutkan berarti masih bekerja.
  assert.equal(statusV1(undefined), "aktif");
  assert.equal(statusV1("aktif"), "aktif");
});
