import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  jumlahSelisih,
  jumlahTerhitung,
  gayaBanding,
  jumlahTahap2,
  nilaiBanding,
  type BarisBanding,
  type KelompokBanding,
} from "@/lib/banding";
import {
  angkaEksporV1,
  kasBulanV1,
  kehadiranBulanV1,
  targetRujukanV1,
} from "@/lib/banding-v1";

const baris = (
  ukuran: string,
  v1: number | null,
  v2: number | null,
): BarisBanding => ({ ukuran, v1, v2, satuan: "angka" });

test("angka yang bertemu dinyatakan cocok", () => {
  const n = nilaiBanding(baris("anggota", 26, 26));
  assert.equal(n.status, "cocok");
  assert.equal(n.selisih, 0);
});

test("V2 kurang berarti ada data lama yang belum pindah", () => {
  const n = nilaiBanding(baris("laporan", 167, 160));
  assert.equal(n.status, "selisih");
  assert.equal(n.selisih, -7);
  assert.match(n.keterangan, /belum pindah/);
});

test("V2 lebih banyak tetap ditandai, bukan didiamkan", () => {
  // Kelebihan sama mencurigakannya dengan kekurangan: bisa jadi ada yang
  // masuk dua kali.
  const n = nilaiBanding(baris("laporan", 100, 112));
  assert.equal(n.status, "selisih");
  assert.equal(n.selisih, 12);
  assert.match(n.keterangan, /dua kali/);
});

test("sisi yang belum terhitung tidak ditandai merah", () => {
  // Menandai semua yang belum diketahui sebagai masalah hanya membuat
  // orang terbiasa mengabaikan peringatan.
  assert.equal(nilaiBanding(baris("x", 10, null)).status, "belum");
  assert.equal(nilaiBanding(baris("x", null, 10)).status, "belum");
  assert.equal(nilaiBanding(baris("x", null, null)).status, "belum");
  assert.equal(nilaiBanding(baris("x", null, 10)).selisih, null);
});

test("ringkasan hanya menghitung yang kedua sisinya ada", () => {
  const kelompok: KelompokBanding[] = [
    {
      kunci: "a",
      judul: "A",
      keterangan: "",
      baris: [baris("satu", 1, 1), baris("dua", 2, 5), baris("tiga", 3, null)],
    },
  ];
  assert.equal(jumlahSelisih(kelompok), 1);
  assert.equal(jumlahTerhitung(kelompok), 2);
});

test("angka V1 dihitung langsung dari ekspor, termasuk GMV per unit per bulan", () => {
  const isi = JSON.parse(
    readFileSync("supabase/migrasi/ekspor-contoh.json", "utf8"),
  ) as Record<string, unknown>;
  const a = angkaEksporV1(isi);

  assert.equal(a.anggota, (isi["users:list"] as unknown[]).length);
  assert.equal(a.laporan, (isi["daily-reports:all"] as unknown[]).length);
  assert.ok(a.gmv.length > 0);

  // Angka bergaya lama ("4.176.000") harus terbaca sebagai 4176000,
  // bukan 4,176 — salah tafsir di sini mengecilkan GMV sejuta kali.
  assert.ok(a.gmv.every((g) => g.gmv > 1000));
  // Unit laporan Affiliator datang dari akunnya, bukan dari laporannya.
  assert.ok(a.gmv.some((g) => g.unit === "affiliator"));
  assert.ok(a.saldo === a.kasMasuk - a.kasKeluar);
});

test("ekspor kosong tidak menjatuhkan perhitungan", () => {
  const a = angkaEksporV1({});
  assert.equal(a.anggota, 0);
  assert.equal(a.saldo, 0);
  assert.deepEqual(a.gmv, []);
});

test("laporan tanpa tanggal yang sah tidak ikut menghitung GMV", () => {
  // Tanggal rusak lebih baik hilang dari rekap daripada mendarat di
  // bulan yang keliru dan membuat capaian bulan itu tampak lebih besar.
  const a = angkaEksporV1({
    "daily-reports:all": [
      { "Tanggal Laporan": "bukan tanggal", Unit: "mcn", GMV: "1.000.000" },
      { "Tanggal Laporan": "2024-10-01", Unit: "mcn", GMV: "2.000.000" },
    ],
  });
  assert.equal(a.laporan, 2);
  assert.equal(a.gmv.length, 1);
  assert.equal(a.gmv[0].gmv, 2000000);
});

test("target lama dibaca sebagai rujukan, bukan sebagai sesuatu yang ditulis", () => {
  const rujukan = targetRujukanV1({
    "gmv:targets": [
      { division: "affiliator", month: "2024-10-01", target: "620.000.000" },
      { division: "mcn", month: "2024-10-01", target: 310000000 },
    ],
  });

  assert.equal(rujukan.length, 2);
  assert.equal(rujukan[0].unit, "affiliator");
  assert.equal(rujukan[0].bulan, "2024-10");
  assert.equal(rujukan[0].target, 620000000);
});

test("target yang disebut dua kali tidak menjadi dua target", () => {
  const rujukan = targetRujukanV1({
    "gmv:targets": [
      { division: "mcn", month: "2024-10-01", target: 100 },
      { division: "mcn", month: "2024-10-15", target: 200 },
    ],
  });
  // Bulan yang sama, jadi satu baris — yang terbaca belakangan menimpa.
  assert.equal(rujukan.length, 1);
  assert.equal(rujukan[0].target, 200);
});

test("baris rujukan yang tidak lengkap dilewati tanpa menjatuhkan sisanya", () => {
  const rujukan = targetRujukanV1({
    "gmv:targets": [
      { division: "mcn", target: 100 },
      { month: "2024-10-01", target: 100 },
      { division: "tap", month: "2024-10-01", target: "bukan angka" },
      { division: "tap", month: "2024-11-01", target: 500 },
    ],
  });
  assert.equal(rujukan.length, 1);
  assert.equal(rujukan[0].unit, "tap");
});

test("ekspor tanpa kunci rujukan menghasilkan daftar kosong", () => {
  assert.deepEqual(targetRujukanV1({}), []);
  assert.deepEqual(targetRujukanV1({ "gmv:targets": "bukan larik" }), []);
});

test("kehadiran dihitung per bulan, izin dihitung per hari", () => {
  // Di V2 satu izin tiga hari menjadi tiga baris kehadiran; kalau di
  // sini dihitung satu, pembandingnya akan selalu berselisih.
  const per = kehadiranBulanV1({
    "attendance:all": [
      { id: "a1", date: "2024-10-01" },
      { id: "a2", date: "2024-10-02" },
      { id: "a3", date: "2024-11-01" },
    ],
    "leave-requests:all": [
      { id: "l1", startDate: "2024-10-05", endDate: "2024-10-07" },
    ],
  });

  const peta = Object.fromEntries(per.map((p) => [p.bulan, p]));
  assert.equal(peta["2024-10"].hadir, 2);
  assert.equal(peta["2024-10"].izin, 3);
  assert.equal(peta["2024-11"].hadir, 1);
});

test("izin yang melewati pergantian bulan terbagi ke dua bulan", () => {
  const per = kehadiranBulanV1({
    "leave-requests:all": [
      { id: "l1", startDate: "2024-10-30", endDate: "2024-11-02" },
    ],
  });
  const peta = Object.fromEntries(per.map((p) => [p.bulan, p]));
  assert.equal(peta["2024-10"].izin, 2);
  assert.equal(peta["2024-11"].izin, 2);
});

test("izin tanpa tanggal selesai dihitung satu hari", () => {
  const per = kehadiranBulanV1({
    "leave-requests:all": [{ id: "l1", startDate: "2024-10-05" }],
  });
  assert.equal(per[0].izin, 1);
});

test("tanggal rusak tidak menjatuhkan hitungan bulan", () => {
  const per = kehadiranBulanV1({
    "attendance:all": [{ id: "a1", date: "kemarin" }],
    "leave-requests:all": [{ id: "l1", startDate: "bukan tanggal" }],
  });
  assert.deepEqual(per, []);
});

test("kurang dan lebih dibedakan arah dan warnanya", () => {
  // Kurang berarti data lama hilang; lebih berarti ada yang berlebih.
  // Menyamakan warnanya membuat yang gawat dan yang perlu dijelaskan
  // terlihat sama mendesaknya.
  const kurang = nilaiBanding(baris("laporan", 100, 90));
  const lebih = nilaiBanding(baris("laporan", 100, 110));

  assert.equal(kurang.arah, "kurang");
  assert.equal(lebih.arah, "lebih");
  assert.notEqual(gayaBanding(kurang), gayaBanding(lebih));
  assert.match(gayaBanding(kurang), /danger/);
  assert.match(gayaBanding(lebih), /warn/);
});

test("yang cocok dan yang belum terhitung tidak berarah", () => {
  assert.equal(nilaiBanding(baris("x", 10, 10)).arah, null);
  assert.equal(nilaiBanding(baris("x", 10, null)).arah, null);
  assert.match(gayaBanding(nilaiBanding(baris("x", 10, 10))), /ok-fill/);
});

test("tidak ada lagi entitas tahap 2: semua kunci lama sudah dipetakan", () => {
  // Bila daftarnya kosong, jumlahnya pun kosong — bukan nol untuk kunci
  // yang sudah tidak ada.
  const jumlah = jumlahTahap2([
    { kunci: "notes:all", jumlah: 6 },
    { kunci: "sellers:all", jumlah: 3 },
    { kunci: "users:list", jumlah: 26 },
  ]);
  assert.deepEqual(jumlah, {});
});

test("arus kas dipisah per bulan dan per arah", () => {
  // Saldo yang cocok belum berarti arus kasnya utuh: satu masuk dan
  // satu keluar yang sama-sama hilang akan saling meniadakan.
  const per = kasBulanV1({
    "keuangan:cashflow": [
      { id: "c1", date: "2024-10-01", type: "in", amount: "1.000.000" },
      { id: "c2", date: "2024-10-15", type: "out", amount: "400.000" },
      { id: "c3", date: "2024-11-02", type: "out", amount: 100 },
    ],
  });

  const peta = Object.fromEntries(per.map((p) => [p.bulan, p]));
  assert.equal(peta["2024-10"].masuk, 1000000);
  assert.equal(peta["2024-10"].keluar, 400000);
  assert.equal(peta["2024-11"].keluar, 100);
});

test("arah yang tidak dikenali dihitung keluar, bukan masuk", () => {
  // Saldo tidak boleh pernah tampak lebih besar dari yang sebenarnya.
  const per = kasBulanV1({
    "keuangan:cashflow": [
      { id: "c1", date: "2024-10-01", type: "entah", amount: 500 },
    ],
  });
  assert.equal(per[0].masuk, 0);
  assert.equal(per[0].keluar, 500);
});

test("transaksi tanpa tanggal yang sah tidak masuk hitungan bulan", () => {
  assert.deepEqual(
    kasBulanV1({
      "keuangan:cashflow": [
        { id: "c1", date: "kemarin", type: "in", amount: 1 },
      ],
    }),
    [],
  );
});
