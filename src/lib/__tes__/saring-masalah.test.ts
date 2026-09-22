import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bacaSaringanMasalah,
  masalahTersaring,
  saringMasalah,
} from "../saring-masalah.ts";
import type { Masalah } from "../masalah.ts";

const masalah = (b: Partial<Masalah>): Masalah => ({
  id: b.id ?? "m1",
  judul: b.judul ?? "GMV turun di akhir pekan",
  konteks: b.konteks ?? "",
  unitKode: null,
  unitNama: b.unitNama ?? "Affiliator Network",
  pelaporNama: b.pelaporNama ?? "Nabila Putri",
  dampak: b.dampak ?? "sedang",
  status: b.status ?? "diproses",
  solusi: b.solusi ?? "",
  ditutupAlasan: b.ditutupAlasan ?? "",
  dibuatPada: "2024-10-20T09:00:00Z",
});

test("saringan 'masih terbuka' menyingkirkan yang sudah selesai dan ditutup", () => {
  const hasil = saringMasalah(
    [
      masalah({ id: "a", status: "baru" }),
      masalah({ id: "b", status: "selesai" }),
      masalah({ id: "c", status: "ditutup" }),
      masalah({ id: "d", status: "diproses" }),
    ],
    { ...bacaSaringanMasalah({}), status: "terbuka" },
  );
  assert.deepEqual(
    hasil.map((m) => m.id),
    ["a", "d"],
  );
});

test("saringan 'belum ada solusi' hanya menyisakan yang menunggu jawaban", () => {
  // Yang masih 'baru' tidak masuk: ia belum diterima siapa pun, jadi
  // belum ada yang bisa disalahkan karena solusinya kosong.
  const hasil = saringMasalah(
    [
      masalah({ id: "menunggu", status: "diproses", solusi: "" }),
      masalah({
        id: "terjawab",
        status: "diproses",
        solusi: "Grup khusus dibuat dan batas jam 17.00 diumumkan.",
      }),
      masalah({ id: "baru", status: "baru", solusi: "" }),
      masalah({ id: "selesai", status: "selesai", solusi: "Sudah diganti." }),
    ],
    { ...bacaSaringanMasalah({}), tanpaSolusi: true },
  );
  assert.deepEqual(
    hasil.map((m) => m.id),
    ["menunggu"],
  );
});

test("solusi sepatah kata tetap dihitung belum terjawab", () => {
  const hasil = saringMasalah(
    [masalah({ id: "asal", status: "diproses", solusi: "oke" })],
    { ...bacaSaringanMasalah({}), tanpaSolusi: true },
  );
  assert.deepEqual(
    hasil.map((m) => m.id),
    ["asal"],
  );
});

test("pencarian menjangkau solusinya, bukan judulnya saja", () => {
  // Di situlah nilai arsip ini: orang mencari kalimat penyelesaiannya.
  const daftar = [
    masalah({ id: "a", solusi: "Jadwal pelatihan host dibuat bulanan." }),
    masalah({ id: "b", judul: "Stok sampel kosong", konteks: "Gudang habis" }),
  ];

  const cari = (kata: string) =>
    saringMasalah(daftar, { ...bacaSaringanMasalah({}), cari: kata }).map(
      (m) => m.id,
    );

  assert.deepEqual(cari("pelatihan host"), ["a"]);
  assert.deepEqual(cari("gudang"), ["b"]);
  assert.deepEqual(cari("stok"), ["b"]);
});

test("nilai parameter yang tidak dikenal diabaikan", () => {
  const dibaca = bacaSaringanMasalah({
    status: "entah",
    dampak: "gawat",
    solusi: "ya",
  });
  assert.equal(dibaca.status, "semua");
  assert.equal(dibaca.dampak, "semua");
  assert.equal(dibaca.tanpaSolusi, false);
  assert.equal(masalahTersaring(dibaca), false);
  assert.equal(
    masalahTersaring(bacaSaringanMasalah({ solusi: "kosong" })),
    true,
  );
});

test("status lama dari tautan yang tersimpan tidak menyaring apa pun", () => {
  // Tautan "?status=dianalisis" masih beredar di catatan orang; yang
  // benar adalah menampilkan semuanya, bukan daftar kosong.
  assert.equal(bacaSaringanMasalah({ status: "dianalisis" }).status, "semua");
  assert.equal(bacaSaringanMasalah({ status: "ditindak" }).status, "semua");
  assert.equal(bacaSaringanMasalah({ status: "diproses" }).status, "diproses");
});
