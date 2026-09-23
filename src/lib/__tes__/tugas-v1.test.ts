import { strict as assert } from "node:assert";
import { test } from "node:test";
import { jejakQcV1, prioritasV1, statusTugasV1 } from "@/lib/tugas-v1";

test("status tugas dikenali dalam dua bahasa", () => {
  assert.equal(statusTugasV1("in progress"), "berjalan");
  assert.equal(statusTugasV1("DONE"), "selesai");
  assert.equal(statusTugasV1("dibatalkan"), "dibatalkan");
  assert.equal(statusTugasV1("review"), "menunggu_qc");
});

test("status yang tidak dikenali jatuh ke todo, bukan selesai", () => {
  // Tugas yang salah ditandai selesai berhenti muncul di layar siapa pun
  // dan tidak akan pernah dikerjakan.
  assert.equal(statusTugasV1("entah"), "todo");
  assert.equal(statusTugasV1(null), "todo");
});

test("prioritas yang tidak dikenali jatuh ke sedang", () => {
  assert.equal(prioritasV1("urgent"), "tinggi");
  assert.equal(prioritasV1("low"), "rendah");
  assert.equal(prioritasV1("entah"), "sedang");
});

test("jejak QC terbaca dari objek maupun dari teks hasilnya", () => {
  const objek = jejakQcV1({
    result: "lolos",
    checkedById: "usr_003",
    checkedAt: "2024-10-23T17:00:00+07:00",
    notes: "Sesuai standar.",
  });
  assert.equal(objek.status, "lolos");
  assert.equal(objek.olehLama, "usr_003");
  assert.equal(objek.catatan, "Sesuai standar.");

  assert.equal(jejakQcV1("passed").status, "lolos");
  assert.equal(jejakQcV1("revisi").status, "revisi");
});

test("QC yang tidak jelas dianggap belum diperiksa", () => {
  // Menandainya lolos berarti meloloskan pekerjaan yang tidak pernah
  // ditinjau siapa pun.
  assert.equal(jejakQcV1(null).status, "belum");
  assert.equal(jejakQcV1({}).status, "belum");
  assert.equal(jejakQcV1("belum").status, "belum");
  assert.equal(jejakQcV1(["lolos"]).status, "belum");
});
