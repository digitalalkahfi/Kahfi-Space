import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  SEMUA,
  awalSelesaiSemua,
  lewatDeadline,
  masukPapan,
  masukPapanSemua,
  masukToDoHariIni,
  penandaPapan,
  pilihanPapanDariParam,
  rentangHariWib,
  rentangTanggalWib,
  ringkasToDoTanggal,
  susunPapan,
  tanggalDariParam,
  urutkanKolom,
  type TugasPapan,
} from "@/lib/papan-tanggal";

const HARI_INI = "2026-09-29";

type Uji = TugasPapan & { judul: string; tipe: string };

const buat = (judul: string, p: Partial<Uji> = {}): Uji => ({
  judul,
  tipe: "tiket",
  status: "todo",
  statusAsli: p.status ?? "todo",
  tenggat: `${HARI_INI}T15:00:00+07:00`,
  selesaiPada: null,
  prioritas: "sedang",
  ...p,
});

const judulKolom = (tugas: Uji[], tanggal: string, hariIni = HARI_INI) => {
  const kolom = susunPapan(
    tugas.filter((t) => masukPapan(t, tanggal, hariIni)),
    tanggal,
    hariIni,
  );
  return {
    todo: kolom.todo.map((t) => t.judul),
    berjalan: kolom.berjalan.map((t) => t.judul),
    menunggu_qc: kolom.menunggu_qc.map((t) => t.judul),
    selesai: kolom.selesai.map((t) => t.judul),
  };
};

const DATA: Uji[] = [
  buat("16 Sep todo", { tenggat: "2026-09-16T10:00:00+07:00" }),
  buat("16 Sep berjalan", {
    status: "berjalan",
    tenggat: "2026-09-16T23:59:00+07:00",
  }),
  buat("16 Sep revisi", {
    status: "berjalan",
    statusAsli: "revisi",
    tenggat: "2026-09-16T12:00:00+07:00",
  }),
  buat("16 Sep review", {
    status: "menunggu_qc",
    tenggat: "2026-09-16T17:00:00+07:00",
  }),
  buat("Selesai 16 Sep, tenggat 10 Sep", {
    status: "selesai",
    tenggat: "2026-09-10T17:00:00+07:00",
    selesaiPada: "2026-09-16T09:00:00+07:00",
  }),
  buat("Tenggat 16 Sep, selesai 15 Sep", {
    status: "selesai",
    tenggat: "2026-09-16T17:00:00+07:00",
    selesaiPada: "2026-09-15T20:00:00+07:00",
  }),
  buat("17 Sep dini hari WIB", {
    // 17:00 UTC 16 Sep = 00:00 WIB 17 Sep.
    tenggat: "2026-09-16T17:00:00Z",
  }),
  buat("Dibatalkan 16 Sep", {
    statusAsli: "dibatalkan",
    tenggat: "2026-09-16T11:00:00+07:00",
  }),
];

test("tanggal biasa: kolom aktif berisi tenggat tanggal itu, Selesai memakai selesai_at", () => {
  assert.deepEqual(judulKolom(DATA, "2026-09-16"), {
    todo: ["16 Sep todo"],
    berjalan: ["16 Sep revisi", "16 Sep berjalan"],
    menunggu_qc: ["16 Sep review"],
    selesai: ["Selesai 16 Sep, tenggat 10 Sep"],
  });
});

test("tenggat 23:59 WIB masuk tanggal itu; 00:00 WIB masuk tanggal berikutnya", () => {
  const b = buat("x", { tenggat: "2026-09-16T23:59:00+07:00" });
  assert.equal(masukPapan(b, "2026-09-16", HARI_INI), true);
  assert.equal(masukPapan(b, "2026-09-17", HARI_INI), false);
  assert.deepEqual(judulKolom(DATA, "2026-09-17").todo, [
    "17 Sep dini hari WIB",
  ]);
});

test("hari ini: yang terlambat ikut tampil paling atas bertanda", () => {
  const data = [
    buat("Hari ini tinggi", { prioritas: "tinggi" }),
    buat("Hari ini rendah", { prioritas: "rendah" }),
    buat("Terlambat kemarin", {
      prioritas: "rendah",
      tenggat: "2026-09-28T17:00:00+07:00",
    }),
    buat("Terlambat lama", {
      status: "berjalan",
      tenggat: "2026-09-01T09:00:00+07:00",
    }),
    buat("Terlambat tapi selesai", {
      status: "selesai",
      tenggat: "2026-09-28T17:00:00+07:00",
      selesaiPada: "2026-09-28T18:00:00+07:00",
    }),
  ];
  assert.deepEqual(judulKolom(data, HARI_INI), {
    todo: ["Terlambat kemarin", "Hari ini tinggi", "Hari ini rendah"],
    berjalan: ["Terlambat lama"],
    menunggu_qc: [],
    selesai: [],
  });
  assert.deepEqual(penandaPapan(data[2], HARI_INI, HARI_INI), {
    jenis: "terlambat",
    tanggal: "2026-09-28",
  });
  assert.equal(penandaPapan(data[0], HARI_INI, HARI_INI), null);
});

test("tanggal besok: yang terlambat tidak ikut tampil", () => {
  const data = [
    buat("Terlambat kemarin", { tenggat: "2026-09-28T17:00:00+07:00" }),
    buat("Besok", { tenggat: "2026-09-30T08:00:00+07:00" }),
  ];
  assert.deepEqual(judulKolom(data, "2026-09-30").todo, ["Besok"]);
  assert.equal(penandaPapan(data[0], "2026-09-30", HARI_INI), null);
});

test("tanggal lampau: hanya isi tanggal itu, tanpa tambahan terlambat", () => {
  const data = [
    buat("Terlambat lebih lama", { tenggat: "2026-09-20T17:00:00+07:00" }),
    buat("Tanggal 25", { tenggat: "2026-09-25T17:00:00+07:00" }),
  ];
  assert.deepEqual(judulKolom(data, "2026-09-25").todo, ["Tanggal 25"]);
});

test("tiket lama tanpa tenggat hanya tampil di hari ini, bertanda", () => {
  const lama = buat("Tiket lama", { tenggat: "" });
  assert.equal(masukPapan(lama, HARI_INI, HARI_INI), true);
  assert.equal(masukPapan(lama, "2026-09-30", HARI_INI), false);
  assert.equal(masukPapan(lama, "2026-09-28", HARI_INI), false);
  assert.deepEqual(penandaPapan(lama, HARI_INI, HARI_INI), {
    jenis: "tanpa_tenggat",
  });
});

test("kolom Selesai: yang baru saja beres paling atas", () => {
  const selesai = [
    buat("Pagi", {
      status: "selesai",
      selesaiPada: `${HARI_INI}T08:00:00+07:00`,
    }),
    buat("Sore", {
      status: "selesai",
      selesaiPada: `${HARI_INI}T16:00:00+07:00`,
    }),
  ];
  assert.deepEqual(
    urutkanKolom(selesai, "selesai", HARI_INI, HARI_INI).map((t) => t.judul),
    ["Sore", "Pagi"],
  );
});

test("tanggal tanpa tugas: semua kolom kosong", () => {
  assert.deepEqual(judulKolom(DATA, "2027-01-01"), {
    todo: [],
    berjalan: [],
    menunggu_qc: [],
    selesai: [],
  });
});

test("?tanggal= yang kosong atau rusak jatuh ke hari ini", () => {
  assert.equal(tanggalDariParam(undefined, HARI_INI), HARI_INI);
  assert.equal(tanggalDariParam("", HARI_INI), HARI_INI);
  assert.equal(tanggalDariParam("abc", HARI_INI), HARI_INI);
  assert.equal(tanggalDariParam("2026-02-30", HARI_INI), HARI_INI);
  assert.equal(tanggalDariParam("2026-09-16", HARI_INI), "2026-09-16");
  assert.equal(
    tanggalDariParam(["2026-09-16", "2026-09-17"], HARI_INI),
    "2026-09-16",
  );
});

test("ringkasan to-do dihitung untuk tanggal terpilih saja", () => {
  const data = [
    buat("A", { tipe: "pribadi", tenggat: "2026-09-16T23:59:00+07:00" }),
    buat("B", {
      tipe: "pribadi",
      status: "selesai",
      tenggat: "2026-09-16T10:00:00+07:00",
      selesaiPada: "2026-09-15T10:00:00+07:00",
    }),
    buat("C", { tipe: "pribadi", tenggat: "2026-09-17T10:00:00+07:00" }),
    buat("Tiket", { tenggat: "2026-09-16T10:00:00+07:00" }),
  ];
  assert.deepEqual(ringkasToDoTanggal(data, "2026-09-16"), {
    total: 2,
    selesai: 1,
  });
});

test("rentang satu hari WIB dalam UTC", () => {
  assert.deepEqual(rentangHariWib("2026-09-30"), {
    awal: "2026-09-29T17:00:00.000Z",
    akhir: "2026-09-30T17:00:00.000Z",
  });
  // Pergantian bulan & tahun.
  assert.equal(rentangHariWib("2026-12-31").akhir, "2026-12-31T17:00:00.000Z");
});

test("rentang beberapa hari WIB dalam UTC", () => {
  assert.deepEqual(rentangTanggalWib("2026-10-01", "2026-10-31"), {
    awal: "2026-09-30T17:00:00.000Z",
    akhir: "2026-10-31T17:00:00.000Z",
  });
  // Satu hari sama dengan `rentangHariWib`.
  assert.deepEqual(
    rentangTanggalWib("2026-09-30", "2026-09-30"),
    rentangHariWib("2026-09-30"),
  );
  assert.equal(
    rentangTanggalWib("2026-12-01", "2026-12-31").akhir,
    "2026-12-31T17:00:00.000Z",
  );
});

test("To-do hari ini di Beranda: hari ini + yang terlambat belum selesai", () => {
  const cek = (status: string, tenggat: string) =>
    masukToDoHariIni({ status, tenggat }, HARI_INI);
  assert.equal(cek("todo", `${HARI_INI}T23:59:00+07:00`), true);
  // Yang sudah dicentang hari ini tetap tampil (tercoret).
  assert.equal(cek("selesai", `${HARI_INI}T09:00:00+07:00`), true);
  assert.equal(cek("berjalan", "2026-09-27T23:59:00+07:00"), true);
  assert.equal(cek("selesai", "2026-09-27T23:59:00+07:00"), false);
  assert.equal(cek("todo", "2026-09-30T08:00:00+07:00"), false);
  assert.equal(cek("dibatalkan", `${HARI_INI}T09:00:00+07:00`), false);
});

// ---------------------------------------------------------------------
// Papan "Semua" & deadline yang jamnya sudah lewat
// ---------------------------------------------------------------------

test("?tanggal=: kosong/rusak = papan Semua, hari-ini = hari ini", () => {
  assert.equal(pilihanPapanDariParam(undefined, HARI_INI), SEMUA);
  assert.equal(pilihanPapanDariParam("", HARI_INI), SEMUA);
  assert.equal(pilihanPapanDariParam("2026-02-30", HARI_INI), SEMUA);
  assert.equal(pilihanPapanDariParam("semua", HARI_INI), SEMUA);
  assert.equal(pilihanPapanDariParam("hari-ini", HARI_INI), HARI_INI);
  assert.equal(pilihanPapanDariParam("2026-10-05", HARI_INI), "2026-10-05");
  assert.equal(pilihanPapanDariParam(["2026-10-05"], HARI_INI), "2026-10-05");
});

test("papan Semua: semua yang belum selesai, dari tanggal mana pun", () => {
  const lusaDepan = buat("Deadline pekan depan", {
    tenggat: "2026-10-06T17:00:00+07:00",
  });
  const telat = buat("Terlambat sepekan", {
    tenggat: "2026-09-22T17:00:00+07:00",
  });
  const tanpa = buat("Tiket lama tanpa deadline", { tenggat: "" });
  const batal = buat("Dibatalkan", { statusAsli: "dibatalkan" });
  assert.equal(masukPapanSemua(lusaDepan, HARI_INI), true);
  assert.equal(masukPapanSemua(telat, HARI_INI), true);
  assert.equal(masukPapanSemua(tanpa, HARI_INI), true);
  assert.equal(masukPapanSemua(batal, HARI_INI), false);
});

test("papan Semua: kolom Selesai hanya 7 hari terakhir (WIB)", () => {
  assert.equal(awalSelesaiSemua(HARI_INI), "2026-09-23");
  const beres = (selesaiPada: string) =>
    buat("Beres", { status: "selesai", statusAsli: "selesai", selesaiPada });
  // 23 Sep 00.30 WIB masih masuk; 22 Sep 23.59 WIB tidak.
  assert.equal(masukPapanSemua(beres("2026-09-22T17:30:00Z"), HARI_INI), true);
  assert.equal(masukPapanSemua(beres("2026-09-22T16:59:00Z"), HARI_INI), false);
});

test("papan Semua: urut dari deadline terdekat, prioritas penentu seri", () => {
  const daftar = [
    buat("Pekan depan", { tenggat: "2026-10-06T17:00:00+07:00" }),
    buat("Tanpa deadline", { tenggat: "" }),
    buat("Besok rendah", {
      tenggat: "2026-09-30T17:00:00+07:00",
      prioritas: "rendah",
    }),
    buat("Terlambat", { tenggat: "2026-09-25T17:00:00+07:00" }),
    buat("Besok tinggi", {
      tenggat: "2026-09-30T17:00:00+07:00",
      prioritas: "tinggi",
    }),
  ];
  assert.deepEqual(
    urutkanKolom(daftar, "todo", SEMUA, HARI_INI).map((t) => t.judul),
    [
      "Terlambat",
      "Besok tinggi",
      "Besok rendah",
      "Pekan depan",
      "Tanpa deadline",
    ],
  );
});

test("deadline hari ini yang jamnya sudah lewat langsung bertanda terlambat", () => {
  const sekarang = "2026-09-29T20:39:00+07:00";
  const pagi = buat("Deadline 05.30", { tenggat: "2026-09-29T05:30:00+07:00" });
  const malam = buat("Deadline 23.00", {
    tenggat: "2026-09-29T23:00:00+07:00",
  });
  const tanpaJam = buat("To-do tanpa jam", {
    tipe: "pribadi",
    tenggat: "2026-09-29T23:59:00+07:00",
  });

  assert.equal(lewatDeadline(pagi.tenggat, sekarang), true);
  assert.deepEqual(penandaPapan(pagi, SEMUA, HARI_INI, sekarang), {
    jenis: "terlambat",
    tanggal: HARI_INI,
  });
  assert.deepEqual(penandaPapan(pagi, HARI_INI, HARI_INI, sekarang), {
    jenis: "terlambat",
    tanggal: HARI_INI,
  });
  assert.equal(penandaPapan(malam, SEMUA, HARI_INI, sekarang), null);
  // Tanpa jam = batas akhir hari, jadi belum terlambat.
  assert.equal(penandaPapan(tanpaJam, SEMUA, HARI_INI, sekarang), null);
  // Tanpa `sekarang`, tetap aturan lama: per tanggal.
  assert.equal(penandaPapan(pagi, HARI_INI, HARI_INI), null);
  // Di papan tanggal lain tidak ada tanda.
  assert.equal(penandaPapan(pagi, "2026-09-30", HARI_INI, sekarang), null);
});
