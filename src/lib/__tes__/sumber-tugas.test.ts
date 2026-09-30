import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  cocokLihat,
  hitungLihat,
  lihatDariParam,
  pilihanLihat,
  sumberTugas,
} from "@/lib/sumber-tugas";
import type { StatusTugas } from "@/lib/types";

const SAYA = "saya";

const buat = (
  pembuatId: string,
  penerimaId: string,
  status: StatusTugas = "todo",
) => ({ pembuatId, penerimaId, status });

const TUGAS = [
  buat(SAYA, SAYA), // to-do pribadi
  buat(SAYA, SAYA, "selesai"), // to-do yang sudah dicentang
  buat("atasan", SAYA), // tiket dari atasan
  buat("atasan", SAYA, "menunggu_qc"),
  buat(SAYA, "staf-1"), // tiket untuk bawahan
  buat(SAYA, "staf-2", "menunggu_qc"),
  buat(SAYA, "staf-3"),
  buat("leader-lain", "staf-9"), // tiket tim lain
];

test("setiap tugas masuk tepat satu kelompok asal", () => {
  assert.equal(sumberTugas(buat(SAYA, SAYA), SAYA), "saya");
  assert.equal(sumberTugas(buat("atasan", SAYA), SAYA), "dari-atasan");
  assert.equal(sumberTugas(buat(SAYA, "staf-1"), SAYA), "untuk-bawahan");
  assert.equal(sumberTugas(buat("a", "b"), SAYA), "tim");
});

test("hitungan tiap pilihan menjumlah ke Semua", () => {
  const j = hitungLihat(TUGAS, SAYA);
  assert.deepEqual(j, {
    semua: 8,
    saya: 2,
    "dari-atasan": 2,
    "untuk-bawahan": 3,
    tim: 1,
    qc: 2,
  });
  assert.equal(j.saya + j["dari-atasan"] + j["untuk-bawahan"] + j.tim, j.semua);
});

test("saringan memilih tugas yang sesuai hitungannya", () => {
  const j = hitungLihat(TUGAS, SAYA);
  for (const lihat of [
    "semua",
    "saya",
    "dari-atasan",
    "untuk-bawahan",
    "tim",
    "qc",
  ] as const) {
    assert.equal(
      TUGAS.filter((t) => cocokLihat(t, lihat, SAYA)).length,
      j[lihat],
      lihat,
    );
  }
});

test("staf tanpa bawahan tidak melihat Untuk bawahan maupun Tim lain", () => {
  const jumlah = hitungLihat([buat("atasan", SAYA)], SAYA);
  assert.deepEqual(
    pilihanLihat({
      peran: "Staff",
      punyaAtasan: true,
      bisaMemberiTiket: false,
      jumlah,
      denganQc: false,
    }),
    ["semua", "saya", "dari-atasan"],
  );
});

test("Leader melihat kelima pilihan; Daftar menambah Perlu QC", () => {
  const jumlah = hitungLihat([], SAYA);
  const dasar = {
    peran: "Leader" as const,
    punyaAtasan: true,
    bisaMemberiTiket: true,
    jumlah,
  };
  assert.deepEqual(pilihanLihat({ ...dasar, denganQc: false }), [
    "semua",
    "saya",
    "dari-atasan",
    "untuk-bawahan",
    "tim",
  ]);
  assert.deepEqual(pilihanLihat({ ...dasar, denganQc: true }).at(-1), "qc");
});

test("CEO tanpa atasan tidak melihat Dari atasan — kecuali memang ada isinya", () => {
  const dasar = {
    peran: "CEO" as const,
    punyaAtasan: false,
    bisaMemberiTiket: true,
    denganQc: false,
  };
  assert.equal(
    pilihanLihat({ ...dasar, jumlah: hitungLihat([], SAYA) }).includes(
      "dari-atasan",
    ),
    false,
  );
  assert.equal(
    pilihanLihat({
      ...dasar,
      jumlah: hitungLihat([buat("manager", SAYA)], SAYA),
    }).includes("dari-atasan"),
    true,
  );
});

test("?lihat= yang asing atau tidak tersedia jatuh ke Semua", () => {
  const tersedia = ["semua", "saya", "dari-atasan"] as const;
  assert.equal(lihatDariParam("dari-atasan", tersedia), "dari-atasan");
  assert.equal(lihatDariParam("untuk-bawahan", tersedia), "semua");
  assert.equal(lihatDariParam("<script>", tersedia), "semua");
  assert.equal(lihatDariParam(null, tersedia), "semua");
});
