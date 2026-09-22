import { strict as assert } from "node:assert";
import { test } from "node:test";
import { bacaTab } from "../masukan-masalah.ts";

test("tab dibaca apa adanya dari URL", () => {
  assert.equal(bacaTab("bug"), "bug");
  assert.equal(bacaTab("masalah"), "masalah");
});

test("tautan lama ke tab tindakan tidak menampilkan halaman kosong", () => {
  // Tab itu hilang bersama tabel tindakan (migrasi 0121), tapi
  // tautannya masih beredar di catatan orang.
  assert.equal(bacaTab("tindakan"), "masukan");
});

test("tab yang tidak dikenal jatuh ke tab pertama", () => {
  // Parameter URL bisa diisi siapa saja; menampilkan halaman kosong
  // untuk nilai asing hanya membuat orang mengira datanya hilang.
  assert.equal(bacaTab("entah"), "masukan");
  assert.equal(bacaTab(undefined), "masukan");
  assert.equal(bacaTab(""), "masukan");
});

test("parameter ganda memakai yang pertama", () => {
  assert.equal(bacaTab(["masalah", "bug"]), "masalah");
});
