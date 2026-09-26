import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  daftarHariKerja,
  hariKerja,
  ringkasRekapOrang,
  statusHari,
  susunRekapOrang,
  urutkanRekapOrang,
  wajibAbsen,
  type BarisKehadiranOrang,
} from "@/lib/rekap-kehadiran";

test("hanya Leader ke bawah yang wajib absen", () => {
  assert.equal(wajibAbsen("CEO"), false);
  assert.equal(wajibAbsen("Manager"), false);
  assert.equal(wajibAbsen("Finance"), false);
  assert.equal(wajibAbsen("Leader"), true);
  assert.equal(wajibAbsen("Co-Leader"), true);
  assert.equal(wajibAbsen("Staff"), true);
});

test("hari kerja: Senin–Sabtu, Minggu dan libur perusahaan bukan", () => {
  assert.equal(hariKerja("2024-10-26"), true, "Sabtu hari kerja");
  assert.equal(hariKerja("2024-10-27"), false, "Minggu libur");
  assert.equal(hariKerja("2024-10-28", new Set(["2024-10-28"])), false);
  assert.equal(hariKerja("bukan-tanggal"), false);
});

test("daftar hari kerja melewati Minggu dan libur", () => {
  const libur = new Set(["2024-10-29"]);
  assert.deepEqual(daftarHariKerja("2024-10-25", "2024-10-30", libur), [
    "2024-10-25",
    "2024-10-26",
    "2024-10-28",
    "2024-10-30",
  ]);
  assert.deepEqual(daftarHariKerja("2024-10-30", "2024-10-25"), []);
});

test("status hari: kosong = tanpa keterangan, hari ini = belum absen", () => {
  const hariIni = "2024-10-24";
  const b = (
    status: BarisKehadiranOrang["status"],
    tanggal: string,
    persetujuan: BarisKehadiranOrang["persetujuan"] = null,
  ) => ({ status, tanggal, persetujuan });

  assert.equal(statusHari(b(null, "2024-10-23"), hariIni), "tanpa_keterangan");
  assert.equal(statusHari(b(null, hariIni), hariIni), "belum_absen");
  assert.equal(
    statusHari(b("alpa", "2024-10-23"), hariIni),
    "tanpa_keterangan",
  );
  assert.equal(
    statusHari(b("izin", "2024-10-23", "disetujui"), hariIni),
    "izin",
  );
  assert.equal(
    statusHari(b("sakit", "2024-10-23", "diajukan"), hariIni),
    "sakit",
  );
  assert.equal(
    statusHari(b("izin", "2024-10-23", "ditolak"), hariIni),
    "tanpa_keterangan",
    "izin yang ditolak tidak diterima sebagai keterangan",
  );
  assert.equal(statusHari(b("terlambat", "2024-10-23"), hariIni), "terlambat");
});

function baris(
  sebagian: Partial<BarisKehadiranOrang> & { tanggal: string },
): BarisKehadiranOrang {
  return {
    userId: "u1",
    nama: "Anisa",
    unit: "Affiliator",
    role: "Staff",
    wajibAbsen: true,
    status: "hadir",
    jamMasuk: null,
    jamPulang: null,
    menitTelat: 0,
    izinJenis: null,
    izinSelesai: null,
    lokasiValid: true,
    alasan: "",
    persetujuan: null,
    ...sebagian,
  };
}

test("rekap per orang menjumlahkan hari dan menghitung persen hadir", () => {
  const hariIni = "2024-10-26";
  const [o] = susunRekapOrang(
    [
      baris({ tanggal: "2024-10-21", status: "hadir" }),
      baris({ tanggal: "2024-10-22", status: "terlambat", menitTelat: 12 }),
      baris({ tanggal: "2024-10-23", status: null }),
      baris({
        tanggal: "2024-10-24",
        status: "izin",
        persetujuan: "disetujui",
      }),
      baris({ tanggal: "2024-10-25", status: "sakit", persetujuan: "ditolak" }),
      baris({ tanggal: hariIni, status: null }),
    ],
    hariIni,
  );

  assert.deepEqual(o.jumlah, {
    hariKerja: 5,
    hadir: 1,
    terlambat: 1,
    izin: 1,
    sakit: 0,
    tanpaKeterangan: 2,
    belumAbsen: 1,
  });
  // 2 hari masuk dari 4 hari yang seharusnya masuk; izin tidak ikut pembagi.
  assert.equal(o.persenHadir, 50);
  assert.equal(o.totalMenitTelat, 12);
  assert.equal(o.hari[0].tanggal, hariIni, "terbaru dulu");
});

test("orang tanpa hari yang dinilai tidak punya persen", () => {
  const [o] = susunRekapOrang(
    [baris({ tanggal: "2024-10-24", status: null })],
    "2024-10-24",
  );
  assert.equal(o.persenHadir, null);
  assert.equal(o.jumlah.hariKerja, 0);
});

test("izin berjam yang disetujui membawa jam selesainya", () => {
  const [o] = susunRekapOrang(
    [
      baris({
        tanggal: "2024-10-23",
        status: "hadir",
        izinJenis: "jam",
        izinSelesai: "10:00:00",
        persetujuan: "disetujui",
      }),
      baris({
        tanggal: "2024-10-22",
        status: "hadir",
        izinJenis: "jam",
        izinSelesai: "10:00:00",
        persetujuan: "diajukan",
      }),
    ],
    "2024-10-24",
  );
  assert.equal(o.hari[0].izinSelesai, "10:00:00");
  assert.equal(
    o.hari[1].izinSelesai,
    null,
    "yang belum disetujui tidak dihitung",
  );
});

test("ringkasan hanya merata-ratakan yang wajib absen", () => {
  const daftar = susunRekapOrang(
    [
      baris({
        userId: "a",
        nama: "Anisa",
        tanggal: "2024-10-21",
        status: "hadir",
      }),
      baris({
        userId: "a",
        nama: "Anisa",
        tanggal: "2024-10-22",
        status: null,
      }),
      baris({
        userId: "c",
        nama: "CEO",
        role: "CEO",
        wajibAbsen: false,
        tanggal: "2024-10-21",
        status: "hadir",
      }),
    ],
    "2024-10-24",
  );
  const r = ringkasRekapOrang(daftar);
  assert.equal(r.orang, 2);
  assert.equal(r.wajib, 1);
  assert.equal(r.rataHadir, 50, "CEO yang 100% tidak mengangkat rata-rata");
  assert.equal(r.tanpaKeterangan, 1);
  assert.equal(r.hadir, 2);
});

test("urutan tampil: wajib dulu, tanpa keterangan terbanyak di atas", () => {
  const daftar = susunRekapOrang(
    [
      baris({
        userId: "a",
        nama: "Anisa",
        tanggal: "2024-10-21",
        status: "hadir",
      }),
      baris({ userId: "b", nama: "Bayu", tanggal: "2024-10-21", status: null }),
      baris({ userId: "b", nama: "Bayu", tanggal: "2024-10-22", status: null }),
      baris({
        userId: "c",
        nama: "Aa Manager",
        role: "Manager",
        wajibAbsen: false,
        tanggal: "2024-10-21",
        status: "hadir",
      }),
    ],
    "2024-10-24",
  );
  assert.deepEqual(
    urutkanRekapOrang(daftar).map((o) => o.nama),
    ["Bayu", "Anisa", "Aa Manager"],
  );
});
