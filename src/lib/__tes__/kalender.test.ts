import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  awalPetak,
  bulanDari,
  dalamBulan,
  geserBulan,
  perTanggal,
  petakBulan,
  type EntriKalender,
} from "../kalender.ts";

const entri = (b: Partial<EntriKalender>): EntriKalender => ({
  id: Math.random().toString(36),
  sumber: "agenda",
  judul: "Uji",
  keterangan: "",
  jenis: "rapat",
  tanggal: "2024-10-24",
  jamMulai: null,
  jamSelesai: null,
  unitKode: null,
  unitNama: "Semua unit",
  lokasi: "",
  tautan: null,
  dibuatOleh: null,
  ...b,
});

test("petak dimulai pada Senin", () => {
  // 1 Oktober 2024 jatuh Selasa, jadi petaknya mulai 30 September.
  assert.equal(awalPetak("2024-10-01"), "2024-09-30");
  // 1 September 2024 jatuh Minggu; Senin sebelumnya 26 Agustus.
  assert.equal(awalPetak("2024-09-01"), "2024-08-26");
});

test("bulan yang dimulai Senin tidak mundur", () => {
  // 1 Juli 2024 jatuh Senin.
  assert.equal(awalPetak("2024-07-01"), "2024-07-01");
});

test("petak selalu enam pekan penuh", () => {
  for (const bulan of ["2024-02-01", "2024-09-01", "2024-10-01"]) {
    const petak = petakBulan(bulan);
    assert.equal(petak.length, 6);
    for (const pekan of petak) assert.equal(pekan.length, 7);
  }
});

test("petak berurutan tanpa lompatan", () => {
  const rata = petakBulan("2024-10-01").flat();
  for (let i = 1; i < rata.length; i++) {
    const sebelum = new Date(`${rata[i - 1]}T00:00:00Z`);
    sebelum.setUTCDate(sebelum.getUTCDate() + 1);
    assert.equal(rata[i], sebelum.toISOString().slice(0, 10));
  }
});

test("geser bulan melintasi pergantian tahun", () => {
  assert.equal(geserBulan("2024-12-01", 1), "2025-01-01");
  assert.equal(geserBulan("2024-01-01", -1), "2023-12-01");
});

test("geser bulan tidak meluber pada bulan pendek", () => {
  // 31 Januari + 1 bulan tidak boleh menjadi 2 Maret.
  assert.equal(geserBulan("2024-01-01", 1), "2024-02-01");
});

test("bulan dan keanggotaan tanggal", () => {
  assert.equal(bulanDari("2024-10-24"), "2024-10-01");
  assert.equal(dalamBulan("2024-10-31", "2024-10-01"), true);
  assert.equal(dalamBulan("2024-11-01", "2024-10-01"), false);
});

test("entri dikelompokkan dan diurutkan per jam", () => {
  const peta = perTanggal([
    entri({ judul: "Siang", jamMulai: "13:00" }),
    entri({ judul: "Pagi", jamMulai: "09:00" }),
    entri({ judul: "Sepanjang hari" }),
    entri({ judul: "Besok", tanggal: "2024-10-25" }),
  ]);
  assert.deepEqual(
    peta["2024-10-24"].map((e) => e.judul),
    ["Sepanjang hari", "Pagi", "Siang"],
  );
  assert.equal(peta["2024-10-25"].length, 1);
});
