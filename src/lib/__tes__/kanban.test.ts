import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  PESAN_TODO_TANPA_REVIEW,
  bolehEditTugas,
  bolehHapusTugas,
  bolehUbahTenggatTugas,
  dapatDigeser,
  kolomMenerima,
  peranLintasUnit,
  periksaPindah,
} from "@/lib/kanban";
import type { StatusTugas, TipeTugas } from "@/lib/types";

const pindah = (
  dari: StatusTugas,
  ke: StatusTugas,
  p: { sayaPenerima?: boolean; hasilKerja?: string; tipe?: TipeTugas } = {},
) =>
  periksaPindah({
    dari,
    ke,
    tipe: p.tipe ?? "tiket",
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
      tipe: "tiket",
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
      tipe: "tiket",
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
      tipe: "tiket",
      dari: "berjalan",
      ke: "selesai",
      sayaPenerima: true,
      hasilKerja: "sudah beres",
    }),
    false,
  );
  assert.equal(
    kolomMenerima({
      tipe: "tiket",
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
      tipe: "tiket",
      dari: "todo",
      ke: "berjalan",
      sayaPenerima: true,
      hasilKerja: "",
    }),
    true,
  );
  assert.equal(
    kolomMenerima({
      tipe: "tiket",
      dari: "menunggu_qc",
      ke: "berjalan",
      sayaPenerima: true,
      hasilKerja: "ringkasan lama",
    }),
    true,
  );
});

// ---------------------------------------------------------------------
// To-do pribadi: tanpa Review/QC (D2)
// ---------------------------------------------------------------------

test("to-do pribadi ke Review ditolak dengan pesan yang jelas", () => {
  const hasil = pindah("berjalan", "menunggu_qc", {
    tipe: "pribadi",
    hasilKerja: "sudah beres semua",
  });
  assert.deepEqual(hasil, {
    boleh: false,
    mintaHasilKerja: false,
    pesan: PESAN_TODO_TANPA_REVIEW,
  });
  assert.match(PESAN_TODO_TANPA_REVIEW, /tidak perlu diperiksa/);
});

test("to-do pribadi boleh diseret langsung ke Selesai", () => {
  assert.deepEqual(pindah("berjalan", "selesai", { tipe: "pribadi" }), {
    boleh: true,
    ke: "selesai",
  });
  assert.deepEqual(pindah("todo", "selesai", { tipe: "pribadi" }), {
    boleh: true,
    ke: "selesai",
  });
});

test("to-do pribadi yang selesai boleh dibuka lagi ke To Do", () => {
  // Sama dengan batal centang.
  assert.deepEqual(pindah("selesai", "todo", { tipe: "pribadi" }), {
    boleh: true,
    ke: "todo",
  });
});

test("to-do pribadi bergeser bebas antara To Do dan Sedang Dikerjakan", () => {
  assert.deepEqual(pindah("todo", "berjalan", { tipe: "pribadi" }), {
    boleh: true,
    ke: "berjalan",
  });
  assert.deepEqual(pindah("berjalan", "todo", { tipe: "pribadi" }), {
    boleh: true,
    ke: "todo",
  });
});

test("to-do orang lain tetap tidak bisa dipindahkan", () => {
  const hasil = pindah("todo", "selesai", {
    tipe: "pribadi",
    sayaPenerima: false,
  });
  assert.equal(hasil.boleh, false);
  assert.match(String("pesan" in hasil && hasil.pesan), /pemilik to-do/);
});

test("kolom Review menolak to-do pribadi; kolom Selesai menerimanya", () => {
  const dasar = {
    dari: "berjalan" as const,
    tipe: "pribadi" as const,
    sayaPenerima: true,
    hasilKerja: "",
  };
  assert.equal(kolomMenerima({ ...dasar, ke: "menunggu_qc" }), false);
  assert.equal(kolomMenerima({ ...dasar, ke: "selesai" }), true);
});

test("aturan tiket tidak berubah oleh aturan to-do", () => {
  // Komitmen mingguan diperlakukan sama dengan tiket.
  for (const tipe of ["tiket", "komitmen_mingguan"] as const) {
    assert.equal(pindah("berjalan", "selesai", { tipe }).boleh, false);
    assert.equal(pindah("selesai", "todo", { tipe }).boleh, false);
    assert.deepEqual(pindah("berjalan", "menunggu_qc", { tipe }), {
      boleh: false,
      mintaHasilKerja: true,
    });
  }
});

// ---------------------------------------------------------------------
// Siapa boleh apa di kartu (0205)
// ---------------------------------------------------------------------
const dasar = {
  tipe: "tiket" as TipeTugas,
  selesai: false,
  dariGrd: false,
  sayaPenerima: false,
  sayaPembuat: false,
  lintasUnit: false,
};

test("hanya CEO dan Manager yang lintas unit", () => {
  assert.equal(peranLintasUnit("CEO"), true);
  assert.equal(peranLintasUnit("Manager"), true);
  for (const peran of ["Leader", "Co-Leader", "Staff", "Finance"]) {
    assert.equal(peranLintasUnit(peran), false, peran);
  }
});

test("edit tiket: pemberi, CEO, atau Manager; penerima tidak", () => {
  assert.equal(bolehEditTugas({ ...dasar, sayaPembuat: true }), true);
  assert.equal(bolehEditTugas({ ...dasar, lintasUnit: true }), true);
  assert.equal(bolehEditTugas({ ...dasar, sayaPenerima: true }), false);
  // Leader atasan yang bukan pemberi: tidak.
  assert.equal(bolehEditTugas({ ...dasar }), false);
});

test("edit tiket: yang sudah selesai terkunci untuk semua, termasuk CEO/Manager", () => {
  assert.equal(
    bolehEditTugas({ ...dasar, selesai: true, sayaPembuat: true, lintasUnit: true }),
    false,
  );
});

test("edit tiket GRD sama dengan tiket biasa (yang dikunci hanya tenggatnya)", () => {
  // Aturan edit tidak membedakan asal tiket; tenggat GRD punya aturannya
  // sendiri di `bolehUbahTenggatTugas`, dan form edit mengunci tanggalnya.
  const grd = { ...dasar, dariGrd: true };
  assert.equal(bolehEditTugas({ ...grd, lintasUnit: true }), true);
  assert.equal(bolehEditTugas({ ...grd, sayaPembuat: true }), true);
  assert.equal(bolehEditTugas({ ...grd, sayaPenerima: true }), false);
});

test("to-do: hanya pemiliknya, siapa pun perannya", () => {
  const todo = { ...dasar, tipe: "pribadi" as TipeTugas };
  assert.equal(bolehEditTugas({ ...todo, sayaPenerima: true }), true);
  assert.equal(bolehEditTugas({ ...todo, lintasUnit: true }), false);
  assert.equal(bolehEditTugas({ ...todo, sayaPembuat: true }), false);
});

test("hapus tetap hanya pemberi; CEO/Manager bukan pemberi tidak mendapat tombol hapus", () => {
  assert.equal(bolehHapusTugas({ ...dasar, sayaPembuat: true }), true);
  assert.equal(bolehHapusTugas({ ...dasar, sayaPenerima: true }), false);
  assert.equal(bolehHapusTugas({ ...dasar }), false);
  // Tiket GRD tidak bisa dihapus siapa pun; yang selesai pun tidak.
  assert.equal(bolehHapusTugas({ ...dasar, dariGrd: true, sayaPembuat: true }), false);
  assert.equal(bolehHapusTugas({ ...dasar, selesai: true, sayaPembuat: true }), false);
  assert.equal(
    bolehHapusTugas({ ...dasar, tipe: "pribadi", sayaPenerima: true, selesai: true }),
    true,
  );
});

test("ubah deadline: tiket biasa oleh pemberi atau CEO/Manager; GRD oleh CEO/Manager saja", () => {
  assert.equal(bolehUbahTenggatTugas({ ...dasar, sayaPembuat: true }), true);
  assert.equal(bolehUbahTenggatTugas({ ...dasar, lintasUnit: true }), true);
  assert.equal(bolehUbahTenggatTugas({ ...dasar, sayaPenerima: true }), false);

  const grd = { ...dasar, dariGrd: true };
  assert.equal(bolehUbahTenggatTugas({ ...grd, lintasUnit: true }), true);
  // Pemberi GRD yang bukan CEO/Manager (atasan langsung): tidak.
  assert.equal(bolehUbahTenggatTugas({ ...grd, sayaPembuat: true }), false);
  assert.equal(bolehUbahTenggatTugas({ ...grd, sayaPenerima: true }), false);

  assert.equal(
    bolehUbahTenggatTugas({ ...dasar, selesai: true, sayaPembuat: true, lintasUnit: true }),
    false,
  );
  assert.equal(
    bolehUbahTenggatTugas({ ...dasar, tipe: "pribadi", sayaPenerima: true }),
    true,
  );
  assert.equal(
    bolehUbahTenggatTugas({ ...dasar, tipe: "pribadi", lintasUnit: true }),
    false,
  );
});
