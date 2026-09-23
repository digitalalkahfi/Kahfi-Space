import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dapatDigeser, kolomMenerima, periksaPindah } from "@/lib/kanban";
import type { StatusTugas } from "@/lib/types";

const pindah = (
  dari: StatusTugas,
  ke: StatusTugas,
  p: { sayaPenerima?: boolean; hasilKerja?: string } = {},
) =>
  periksaPindah({
    dari,
    ke,
    sayaPenerima: p.sayaPenerima ?? true,
    hasilKerja: p.hasilKerja ?? "",
  });

test("penerima boleh menggeser antara To Do dan Sedang Dikerjakan", () => {
  assert.deepEqual(pindah("todo", "berjalan"), {
    boleh: true,
    ke: "berjalan",
  });
  assert.deepEqual(pindah("berjalan", "todo"), { boleh: true, ke: "todo" });
});

test("bukan penerima tidak bisa memindahkan kartu siapa pun", () => {
  const hasil = pindah("todo", "berjalan", { sayaPenerima: false });
  assert.equal(hasil.boleh, false);
  assert.match(String("pesan" in hasil && hasil.pesan), /penerima tugas/);
});

test("menuju Review meminta ringkasan hasil kerja dulu", () => {
  assert.deepEqual(pindah("berjalan", "menunggu_qc"), {
    boleh: false,
    mintaHasilKerja: true,
  });
  assert.deepEqual(pindah("berjalan", "menunggu_qc", { hasilKerja: "abcd" }), {
    boleh: false,
    mintaHasilKerja: true,
  });
  assert.deepEqual(
    pindah("berjalan", "menunggu_qc", { hasilKerja: "sudah tayang 4 konten" }),
    { boleh: true, ke: "menunggu_qc" },
  );
});

test("Selesai bukan tujuan seretan — itu keputusan pemeriksa", () => {
  const hasil = pindah("menunggu_qc", "selesai");
  assert.equal(hasil.boleh, false);
  assert.match(String("pesan" in hasil && hasil.pesan), /pemeriksa/);
});

test("kartu yang sudah selesai tidak bisa ditarik mundur", () => {
  const hasil = pindah("selesai", "berjalan");
  assert.equal(hasil.boleh, false);
  assert.match(String("pesan" in hasil && hasil.pesan), /lewat QC/);
});

test("menjatuhkan kartu di kolom asalnya bukan perpindahan", () => {
  const hasil = pindah("berjalan", "berjalan");
  assert.equal(hasil.boleh, false);
  assert.equal("pesan" in hasil && hasil.pesan, "", "tanpa pesan galat");
});

test("dapatDigeser hanya benar untuk status yang diterima Server Action", () => {
  assert.equal(dapatDigeser("todo"), true);
  assert.equal(dapatDigeser("berjalan"), true);
  assert.equal(dapatDigeser("menunggu_qc"), true);
  assert.equal(dapatDigeser("selesai"), false);
});

test("kolom asal kartu bukan pertanyaan menerima atau menolak", () => {
  // null, bukan false: kolom asalnya tidak boleh ditandai merah hanya
  // karena kartunya memang sedang ada di sana.
  assert.equal(
    kolomMenerima({
      dari: "berjalan",
      ke: "berjalan",
      sayaPenerima: true,
      hasilKerja: "",
    }),
    null,
  );
});

test("kolom Review menerima meski hasil kerjanya belum ditulis", () => {
  // Menjatuhkan kartu di sana memang membuka kolom isian; menandainya
  // menolak akan menghalangi orang melakukan hal yang benar.
  assert.equal(
    kolomMenerima({
      dari: "berjalan",
      ke: "menunggu_qc",
      sayaPenerima: true,
      hasilKerja: "",
    }),
    true,
  );
});

test("kolom yang memang menolak tetap menolak", () => {
  // Selesai bukan tujuan seretan, dan bukan penerima tidak boleh sama
  // sekali — keduanya harus terbaca merah sebelum kartunya dilepas.
  assert.equal(
    kolomMenerima({
      dari: "berjalan",
      ke: "selesai",
      sayaPenerima: true,
      hasilKerja: "sudah beres",
    }),
    false,
  );
  assert.equal(
    kolomMenerima({
      dari: "todo",
      ke: "berjalan",
      sayaPenerima: false,
      hasilKerja: "",
    }),
    false,
  );
});

test("perpindahan biasa diterima", () => {
  assert.equal(
    kolomMenerima({
      dari: "todo",
      ke: "berjalan",
      sayaPenerima: true,
      hasilKerja: "",
    }),
    true,
  );
  assert.equal(
    kolomMenerima({
      dari: "menunggu_qc",
      ke: "berjalan",
      sayaPenerima: true,
      hasilKerja: "ringkasan lama",
    }),
    true,
  );
});
