import { strict as assert } from "node:assert";
import { test } from "node:test";
import { bentrok, idBentrok, type EntriKalender } from "../kalender.ts";

const e = (b: Partial<EntriKalender>): EntriKalender => ({
  id: b.id ?? "a",
  sumber: "agenda",
  judul: b.judul ?? "Rapat mingguan",
  keterangan: "",
  jenis: b.jenis ?? "rapat",
  tanggal: b.tanggal ?? "2024-10-21",
  // `??` tidak dipakai di sini: null yang disebut sengaja berarti agenda
  // sepanjang hari, bukan "pakai nilai bawaan".
  jamMulai: "jamMulai" in b ? b.jamMulai! : "09:00",
  jamSelesai: "jamSelesai" in b ? b.jamSelesai! : "10:00",
  unitKode: b.unitKode ?? null,
  unitNama: "Semua unit",
  lokasi: "",
  tautan: null,
  dibuatOleh: null,
});

test("jam yang beririsan pada hari sama dianggap bentrok", () => {
  assert.equal(
    bentrok(
      e({ id: "a" }),
      e({ id: "b", jamMulai: "09:30", jamSelesai: "11:00" }),
    ),
    true,
  );
});

test("jam yang bersambungan bukan bentrok", () => {
  // Rapat 09.00–10.00 lalu 10.00–11.00 memang berurutan, bukan tabrakan.
  assert.equal(
    bentrok(
      e({ id: "a" }),
      e({ id: "b", jamMulai: "10:00", jamSelesai: "11:00" }),
    ),
    false,
  );
});

test("agenda dua unit berbeda bukan bentrok", () => {
  // Pesertanya memang orang yang berbeda.
  assert.equal(
    bentrok(
      e({ id: "a", unitKode: "affiliator" }),
      e({ id: "b", unitKode: "mcn", jamMulai: "09:30" }),
    ),
    false,
  );
});

test("agenda seluruh perusahaan bentrok dengan agenda unit mana pun", () => {
  assert.equal(
    bentrok(
      e({ id: "a", unitKode: null }),
      e({ id: "b", unitKode: "mcn", jamMulai: "09:30" }),
    ),
    true,
  );
});

test("libur dan agenda sepanjang hari tidak dihitung bentrok", () => {
  assert.equal(
    bentrok(e({ id: "a", jenis: "libur" }), e({ id: "b", jamMulai: "09:30" })),
    false,
  );
  assert.equal(
    bentrok(
      e({ id: "a", jamMulai: null, jamSelesai: null }),
      e({ id: "b", jamMulai: "09:30" }),
    ),
    false,
  );
});

test("hari berbeda tidak pernah bentrok", () => {
  assert.equal(
    bentrok(e({ id: "a" }), e({ id: "b", tanggal: "2024-10-22" })),
    false,
  );
});

test("daftar bentrok memuat kedua sisinya, bukan hanya satu", () => {
  const id = idBentrok([
    e({ id: "a" }),
    e({ id: "b", jamMulai: "09:30", jamSelesai: "10:30" }),
    e({ id: "c", jamMulai: "14:00", jamSelesai: "15:00" }),
  ]);
  assert.deepEqual([...id].sort(), ["a", "b"]);
});
