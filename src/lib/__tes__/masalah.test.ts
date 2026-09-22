import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  adaSolusi,
  izinMasalah,
  MIN_SOLUSI,
  ringkasMasalah,
  type Masalah,
} from "../masalah.ts";

const masalah = (b: Partial<Masalah>): Masalah => ({
  id: Math.random().toString(36),
  judul: "Uji",
  konteks: "",
  unitKode: null,
  unitNama: "Affiliator",
  pelaporNama: "A",
  dampak: "sedang",
  status: "diproses",
  solusi: "",
  ditutupAlasan: "",
  dibuatPada: "2024-10-20T10:00:00Z",
  ...b,
});

test("solusi sepatah kata bukan solusi", () => {
  // Ambangnya sama dengan trigger 0121; kalau layar menganggap "oke"
  // cukup, tombolnya menyala lalu database menolaknya.
  assert.equal(adaSolusi({ solusi: "sudah" }), false);
  assert.equal(adaSolusi({ solusi: "   " }), false);
  assert.equal(adaSolusi({ solusi: "a".repeat(MIN_SOLUSI) }), true);
});

test("ringkasan menghitung yang menggantung, bukan totalnya saja", () => {
  const r = ringkasMasalah([
    masalah({ status: "baru" }),
    masalah({ status: "baru" }),
    masalah({ status: "diproses" }),
    masalah({ status: "selesai", solusi: "Jadwal pelatihan dibuat bulanan." }),
    masalah({ status: "ditutup", ditutupAlasan: "Bukan masalah kami." }),
  ]);

  assert.equal(r.total, 5);
  assert.equal(r.belumDiterima, 2);
  assert.equal(r.diproses, 1);
  assert.equal(r.selesai, 1);
});

test("yang ditutup tidak ikut terhitung sebagai menggantung", () => {
  const r = ringkasMasalah([masalah({ status: "ditutup" })]);
  assert.equal(r.belumDiterima, 0);
  assert.equal(r.diproses, 0);
});

test("hanya CEO dan Manager yang boleh menulis solusi", () => {
  const laporan = masalah({ status: "diproses" });

  for (const role of ["CEO", "Manager"]) {
    const izin = izinMasalah({ id: "u1", role }, laporan);
    assert.equal(izin.isiSolusi, true, role);
    assert.equal(izin.ubahStatus, true, role);
  }

  for (const role of ["Staff", "Leader", "Finance"]) {
    const izin = izinMasalah({ id: "u2", role }, laporan);
    assert.equal(izin.isiSolusi, false, role);
    assert.equal(izin.ubahStatus, false, role);
    assert.ok(izin.alasanTakBisaIsi, role);
  }
});

test("laporan yang ditutup tidak bisa disunting sebelum dibuka lagi", () => {
  // Solusinya masih boleh dibaca; yang dikunci hanya penyuntingannya —
  // dan alasannya disebut supaya orang tahu apa yang harus dilakukan.
  const izin = izinMasalah(
    { id: "u1", role: "Manager" },
    masalah({ status: "ditutup" }),
  );
  assert.equal(izin.isiSolusi, false);
  assert.equal(izin.ubahStatus, true);
  assert.match(izin.alasanTakBisaIsi ?? "", /ditutup/i);
});
