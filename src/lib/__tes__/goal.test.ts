import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  akhirBulan,
  bandingKodeGrd,
  kelompokKurva,
  batasSelesaiGoal,
  bolehJadiInduk,
  kalimatDampakHapus,
  keteranganTenggat,
  labelPeriode,
  lengkapiRentang,
  periksaPeriode,
  periodeDariTangga,
  periodeKuartal,
  potongPerBulan,
  satuBulanPenuh,
  selesaiSetelah,
  statusPeriode,
  susunAnakTangga,
  tampilNilaiGoal,
  tanggalSah,
  tebakModeTarget,
} from "../goal.ts";
import { geserBulan } from "../kalender.ts";

test("geser bulan menyeberangi pergantian tahun", () => {
  assert.equal(geserBulan("2024-10-01", 0), "2024-10-01");
  assert.equal(geserBulan("2024-10-01", 3), "2025-01-01");
  assert.equal(geserBulan("2024-01-01", 11), "2024-12-01");
});

test("induk goal harus lebih tinggi di tangga roll-down", () => {
  assert.equal(bolehJadiInduk("leader", "manager"), true);
  assert.equal(bolehJadiInduk("account", "company"), true);
  assert.equal(bolehJadiInduk("manager", "leader"), false);
  assert.equal(bolehJadiInduk("leader", "leader"), false);
});

test("periode goal mengikuti kuartal tanggalnya", () => {
  assert.equal(periodeKuartal("2024-10-21"), "2024-Q4");
  assert.equal(periodeKuartal("2024-01-01"), "2024-Q1");
  assert.equal(periodeKuartal("2025-06-30"), "2025-Q2");
});

test("periode dipotong per bulan kalender beserta rentang tanggalnya", () => {
  assert.deepEqual(potongPerBulan("2026-10-15", "2026-12-14"), [
    { bulan: "2026-10-01", dari: "2026-10-15", sampai: "2026-10-31" },
    { bulan: "2026-11-01", dari: "2026-11-01", sampai: "2026-11-30" },
    { bulan: "2026-12-01", dari: "2026-12-01", sampai: "2026-12-14" },
  ]);
  assert.deepEqual(potongPerBulan("2026-10-01", "2026-10-31"), [
    { bulan: "2026-10-01", dari: "2026-10-01", sampai: "2026-10-31" },
  ]);
  assert.deepEqual(
    potongPerBulan("2026-10-20", "2026-10-20"),
    [{ bulan: "2026-10-01", dari: "2026-10-20", sampai: "2026-10-20" }],
    "periode satu hari pun sah",
  );
  assert.deepEqual(potongPerBulan("2026-10-20", "2026-10-19"), []);
});

test("periode paling lama 12 bulan dihitung dari tanggalnya", () => {
  assert.equal(batasSelesaiGoal("2026-10-01"), "2027-09-30");
  assert.equal(batasSelesaiGoal("2026-10-15"), "2027-10-14");
  // 29 Feb + 12 bulan jatuh ke 28 Feb — sama dengan PostgreSQL.
  assert.equal(batasSelesaiGoal("2024-02-29"), "2025-02-27");
  assert.equal(
    potongPerBulan("2026-10-15", "2027-10-14").length,
    13,
    "setahun yang mulai di tengah bulan menyentuh 13 bulan kalender",
  );
  assert.equal(periksaPeriode("2026-10-15", "2027-10-14"), null);
  assert.match(periksaPeriode("2026-10-15", "2027-10-15") ?? "", /12 bulan/);
});

test("tanggal dan periode yang tidak sah ditolak dengan alasannya", () => {
  assert.equal(tanggalSah("2026-02-29"), false);
  assert.equal(tanggalSah("2024-02-29"), true);
  assert.equal(tanggalSah(""), false);
  assert.match(periksaPeriode("", "2026-10-31") ?? "", /mulai/);
  assert.match(periksaPeriode("2026-10-01", "") ?? "", /selesai/);
  assert.match(periksaPeriode("2026-10-01", "2026-09-30") ?? "", /sebelum/);
});

test("pintasan lama periode menghitung tanggal selesai dari tanggal mulai", () => {
  assert.equal(selesaiSetelah("2026-10-01", 1), "2026-10-31");
  assert.equal(selesaiSetelah("2026-10-15", 1), "2026-11-14");
  assert.equal(selesaiSetelah("2026-10-01", 3), "2026-12-31");
  assert.equal(selesaiSetelah("2026-10-01", 12), "2027-09-30");
});

test("target sama setiap bulan penuh tidak dibagi", () => {
  const tangga = susunAnakTangga(
    "2026-10-01",
    "2026-12-31",
    32_000_000_000,
    "bulanan",
  );
  assert.deepEqual(
    tangga.map((t) => t.bulan),
    ["2026-10-01", "2026-11-01", "2026-12-01"],
  );
  assert.ok(tangga.every((t) => t.target === 32_000_000_000));
});

test("bulan yang terpakai sebagian mendapat bagian menurut harinya", () => {
  // 15–31 Okt = 17 dari 31 hari; 1–14 Des = 14 dari 31 hari.
  const tangga = susunAnakTangga(
    "2026-10-15",
    "2026-12-14",
    310_000,
    "bulanan",
  );
  assert.deepEqual(
    tangga.map((t) => t.target),
    [170_000, 310_000, 140_000],
  );
});

test("target total dibagi per hari dan jumlahnya tetap persis", () => {
  // 61 hari: 17 + 30 + 14.
  const tangga = susunAnakTangga("2026-10-15", "2026-12-14", 610_000, "total");
  assert.deepEqual(
    tangga.map((t) => t.target),
    [170_000, 300_000, 140_000],
  );
  // Pembagian yang menyisakan pecahan tidak boleh menguapkan target:
  // sisa pembulatan jatuh ke anak tangga terakhir.
  for (const target of [1_000_000, 1_162_500_000, 7, 999]) {
    for (const [mulai, selesai] of [
      ["2024-10-01", "2024-10-31"],
      ["2024-10-01", "2024-12-31"],
      ["2024-10-15", "2025-10-14"],
      ["2024-02-29", "2024-03-01"],
    ]) {
      const jumlah = susunAnakTangga(mulai, selesai, target, "total").reduce(
        (a, t) => a + t.target,
        0,
      );
      assert.equal(jumlah, target, `${target} untuk ${mulai} – ${selesai}`);
    }
  }
});

test("cara baca target ditebak dari anak tangganya", () => {
  const b = (bulan: string, target: number) => ({ bulan, target });
  assert.equal(tebakModeTarget([b("2026-10-01", 5)], 5), "bulanan");
  assert.equal(
    tebakModeTarget([b("2026-10-01", 5), b("2026-11-01", 5)], 5),
    "bulanan",
  );
  assert.equal(
    tebakModeTarget([b("2026-10-01", 3), b("2026-11-01", 7)], 10),
    "total",
  );
  assert.equal(
    tebakModeTarget(
      [b("2026-10-01", 1), b("2026-11-01", 2), b("2026-12-01", 4)],
      1,
    ),
    "kustom",
    "target menanjak ala data lama",
  );
  // Rentang tengah bulan: bagian per hari dibaca "bulanan", angka utuh
  // untuk rentang itu dibaca "total".
  assert.equal(
    tebakModeTarget(
      susunAnakTangga("2026-10-15", "2026-12-14", 310_000, "bulanan"),
      310_000,
    ),
    "bulanan",
  );
  assert.equal(
    tebakModeTarget(
      susunAnakTangga("2026-10-15", "2026-10-31", 50_000, "total"),
      50_000,
    ),
    "total",
  );
});

test("label periode lengkap dengan tanggalnya", () => {
  assert.equal(labelPeriode("2026-10-01", "2026-10-31"), "1 – 31 Okt 2026");
  assert.equal(
    labelPeriode("2026-10-15", "2026-12-14"),
    "15 Okt – 14 Des 2026",
  );
  assert.equal(
    labelPeriode("2026-11-15", "2027-01-14"),
    "15 Nov 2026 – 14 Jan 2027",
  );
  assert.equal(labelPeriode("2026-10-20", "2026-10-20"), "20 Okt 2026");
});

test("status dan keterangan tenggat terhadap tanggal acuan", () => {
  assert.equal(
    statusPeriode("2026-10-15", "2026-10-31", "2026-10-14"),
    "belum",
  );
  assert.equal(
    statusPeriode("2026-10-15", "2026-10-31", "2026-10-15"),
    "berjalan",
  );
  assert.equal(
    statusPeriode("2026-10-15", "2026-10-31", "2026-11-01"),
    "lewat",
  );
  assert.equal(
    keteranganTenggat("2026-10-15", "2026-10-31", "2026-10-01"),
    "Mulai 15 Okt 2026",
  );
  assert.equal(
    keteranganTenggat("2026-10-01", "2026-10-31", "2026-10-28"),
    "Sisa 3 hari",
  );
  assert.equal(
    keteranganTenggat("2026-10-01", "2026-10-31", "2026-10-31"),
    "Hari terakhir",
  );
  assert.equal(
    keteranganTenggat("2026-09-01", "2026-09-30", "2026-10-02"),
    "Berakhir 30 Sep 2026",
  );
});

test("anak tangga lama tanpa rentang dibaca bulan penuh", () => {
  assert.deepEqual(lengkapiRentang({ bulan: "2024-02-01", target: 5 }), {
    bulan: "2024-02-01",
    dari: "2024-02-01",
    sampai: "2024-02-29",
    target: 5,
  });
  assert.equal(akhirBulan("2026-09-28"), "2026-09-30");
  assert.equal(satuBulanPenuh("2026-10-01", "2026-10-31"), true);
  assert.equal(satuBulanPenuh("2026-10-02", "2026-10-31"), false);
  assert.deepEqual(
    periodeDariTangga([
      { bulan: "2026-11-01", target: 1 },
      { bulan: "2026-10-01", target: 1, dari: "2026-10-15" },
    ]),
    { mulai: "2026-10-15", selesai: "2026-11-30" },
  );
  assert.equal(periodeDariTangga([]), null);
});

test("dialog hapus goal hanya menyebut dampak yang memang ada", () => {
  const kosong = {
    anakTangga: 0,
    turunan: 0,
    leadMeasure: 0,
    catatanLeadMeasure: 0,
    komitmen: 0,
  };
  assert.deepEqual(kalimatDampakHapus(kosong), [
    "Riwayat perubahan goal ini tetap tersimpan di jejak audit.",
  ]);

  const lengkap = kalimatDampakHapus({
    anakTangga: 2,
    turunan: 1,
    leadMeasure: 3,
    catatanLeadMeasure: 45,
    komitmen: 1,
  });
  assert.equal(lengkap.length, 5);
  assert.match(lengkap[0], /2 anak tangga/);
  assert.match(lengkap[1], /3 lead measure beserta 45 catatan/);
  assert.match(
    lengkap[2],
    /tidak ikut terhapus/,
    "turunan dilepas, bukan dihapus",
  );
  assert.match(lengkap[3], /tiket biasa/, "komitmen diturunkan, bukan dihapus");

  assert.match(
    kalimatDampakHapus({ ...kosong, leadMeasure: 1 })[0],
    /^1 lead measure-nya ikut terhapus/,
    "lead measure tanpa catatan",
  );
});

test("nilai goal GRD tampil menurut satuannya", () => {
  assert.equal(tampilNilaiGoal(4_950_000_000, "IDR"), "Rp 4,95 M");
  assert.equal(tampilNilaiGoal(2_489_000_000, "IDR"), "Rp 2,489 M");
  assert.equal(tampilNilaiGoal(150_000_000, "IDR"), "Rp 150 Jt");
  assert.equal(tampilNilaiGoal(15, "Seller"), "15 seller");
  assert.equal(tampilNilaiGoal(100, "%"), "100%");
  assert.equal(tampilNilaiGoal(null, "%"), "belum diukur");
});

test("kode GRD diurutkan alami, bukan sebagai teks", () => {
  const kode = ["1.1.10", "S.1.1", "1.2", "1.1.2", "1", "1.1", "T.INTERNAL"];
  assert.deepEqual([...kode].sort(bandingKodeGrd), [
    "1",
    "1.1",
    "1.1.2",
    "1.1.10",
    "1.2",
    "S.1.1",
    "T.INTERNAL",
  ]);
});

test("baris kurva dikelompokkan per blok seperti sheet Target & Kurva WRM", () => {
  assert.equal(kelompokKurva("1.1.3"), "internal");
  assert.equal(kelompokKurva("T.INTERNAL"), "internal");
  assert.equal(kelompokKurva("1.2.1-gmv"), "eksternal");
  assert.equal(kelompokKurva("T.EKSTERNAL"), "eksternal");
  assert.equal(kelompokKurva("T.PERUSAHAAN"), "perusahaan");
  // Total kurva di file = ukuran goal 1, 1.1, dan 1.2 sendiri.
  assert.equal(kelompokKurva("1"), "perusahaan");
  assert.equal(kelompokKurva("1.1"), "internal");
  assert.equal(kelompokKurva("1.2"), "eksternal");
  assert.equal(kelompokKurva("S.1.1"), "lain");
});
