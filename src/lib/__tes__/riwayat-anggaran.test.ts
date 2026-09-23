import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  judulPeristiwa,
  riwayatAnggaran,
  ringkasPeriode,
} from "@/lib/riwayat-anggaran";
import type { AlokasiAnggaran, Anggaran } from "@/lib/budget";

const pagu = (
  id: string,
  periode: string,
  jumlah: number,
  unitNama = "Affiliator Network",
): Anggaran => ({
  id,
  periode,
  unitKode: "affiliator",
  unitNama,
  jenis: "beban",
  jumlah,
  catatan: "operasional",
  disetujuiNama: "Farhan",
});

const alokasi = (
  id: string,
  periode: string,
  jumlah: number,
  status: AlokasiAnggaran["status"],
  pada: string,
): AlokasiAnggaran => ({
  id,
  periode,
  unitKode: "affiliator",
  unitNama: "Affiliator Network",
  jenis: "beban",
  jumlah,
  alasan: "tambahan kampanye",
  status,
  diajukanNama: "Rian",
  diputuskanNama: status === "diajukan" ? null : "Hafidz",
  catatanKeputusan: status === "diajukan" ? "" : "disetujui dengan catatan",
  pada,
});

test("riwayat menggabungkan pagu dan alokasi, terbaru lebih dulu", () => {
  const hasil = riwayatAnggaran(
    [pagu("p1", "2024-09", 1_000_000), pagu("p2", "2024-10", 2_000_000)],
    [alokasi("a1", "2024-10", 500_000, "disetujui", "2024-10-20")],
  );

  assert.deepEqual(
    hasil.map((h) => h.id),
    ["alokasi-a1", "pagu-p2", "pagu-p1"],
  );
});

test("pagu diurutkan pada awal periodenya, bukan sekarang", () => {
  // Kalau pagu dianggap "baru saja ditetapkan", pagu bulan lalu akan
  // selalu muncul di atas alokasi bulan ini.
  const hasil = riwayatAnggaran(
    [pagu("p1", "2024-09", 1_000_000)],
    [alokasi("a1", "2024-09", 100_000, "disetujui", "2024-09-20")],
  );

  assert.equal(hasil[0].id, "alokasi-a1");
  assert.equal(hasil[1].pada, "2024-09-01");
});

test("keterangan alokasi mengikuti tahapnya", () => {
  const menunggu = riwayatAnggaran(
    [],
    [alokasi("a1", "2024-10", 100_000, "diajukan", "2024-10-20")],
  )[0];
  assert.equal(menunggu.keterangan, "tambahan kampanye", "belum ada keputusan");
  assert.equal(menunggu.oleh, "Rian", "yang terlihat pengajunya");

  const diputus = riwayatAnggaran(
    [],
    [alokasi("a2", "2024-10", 100_000, "disetujui", "2024-10-20")],
  )[0];
  assert.equal(diputus.keterangan, "disetujui dengan catatan");
  assert.equal(diputus.oleh, "Hafidz", "yang terlihat pemutusnya");
});

test("hanya alokasi yang disetujui menambah pagu berjalan", () => {
  const hasil = ringkasPeriode(
    [pagu("p1", "2024-10", 10_000_000)],
    [
      alokasi("a1", "2024-10", 1_000_000, "disetujui", "2024-10-10"),
      alokasi("a2", "2024-10", 2_000_000, "diajukan", "2024-10-11"),
      alokasi("a3", "2024-10", 4_000_000, "ditolak", "2024-10-12"),
    ],
  );

  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].pagu, 10_000_000);
  assert.equal(hasil[0].tambahan, 1_000_000);
  assert.equal(hasil[0].total, 11_000_000);
  assert.equal(hasil[0].menunggu, 2_000_000, "disebut, tapi tidak dijumlahkan");
});

test("periode yang hanya punya alokasi tetap muncul", () => {
  // Pengajuan untuk pos yang pagunya belum pernah ditetapkan adalah
  // justru keadaan yang paling perlu terlihat.
  const hasil = ringkasPeriode(
    [],
    [alokasi("a1", "2024-11", 500_000, "disetujui", "2024-11-02")],
  );

  assert.equal(hasil[0].periode, "2024-11");
  assert.equal(hasil[0].pagu, 0);
  assert.equal(hasil[0].total, 500_000);
});

test("periode diurutkan dari yang terbaru", () => {
  const hasil = ringkasPeriode(
    [
      pagu("p1", "2024-09", 1),
      pagu("p2", "2024-11", 1),
      pagu("p3", "2024-10", 1),
    ],
    [],
  );
  assert.deepEqual(
    hasil.map((h) => h.periode),
    ["2024-11", "2024-10", "2024-09"],
  );
});

test("judul membedakan pagu dari tambahan", () => {
  const [tambahan] = riwayatAnggaran(
    [],
    [alokasi("a1", "2024-10", 1, "diajukan", "2024-10-01")],
  );
  const [paguBaris] = riwayatAnggaran([pagu("p1", "2024-10", 1)], []);

  assert.match(judulPeristiwa(tambahan), /^Tambahan /);
  assert.match(judulPeristiwa(paguBaris), /^Pagu /);
});
