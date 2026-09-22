import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  GAYA_STATUS_KIRIM,
  LABEL_STATUS_KIRIM,
  MAKS_PERCOBAAN,
  bacaSaringanKirim,
  bisaCobaLagi,
  ringkasKirim,
  samarkanNomor,
  saringKirim,
  type Pengiriman,
} from "@/lib/kirim-wa";

const kirim = (
  status: Pengiriman["status"],
  percobaan = 1,
  id: string = status,
): Pengiriman => ({
  id,
  notifikasiId: "n1",
  kategori: "tugas",
  judul: "Judul",
  tujuan: "+628123456789",
  status,
  percobaan,
  galat: status === "gagal" ? "Gateway menolak." : "",
  dikirimPada: status === "terkirim" ? "2024-10-24T09:00:00+07:00" : null,
  dibuatPada: "2024-10-24T08:00:00+07:00",
});

test("keberhasilan dihitung dari yang selesai dicoba, bukan seluruhnya", () => {
  // Antrean panjang tidak boleh membuat angkanya terlihat buruk.
  const r = ringkasKirim([
    kirim("terkirim", 1, "a"),
    kirim("gagal", 3, "b"),
    kirim("antre", 0, "c"),
    kirim("antre", 0, "d"),
  ]);
  assert.equal(r.total, 4);
  assert.equal(r.terkirim, 1);
  assert.equal(r.gagal, 1);
  assert.equal(r.antre, 2);
  assert.equal(r.keberhasilan, 50);
});

test("riwayat kosong tidak melempar dan tidak mengarang persentase", () => {
  const r = ringkasKirim([]);
  assert.equal(r.total, 0);
  assert.equal(r.keberhasilan, 0);
});

test("semuanya masih antre berarti belum ada keberhasilan untuk dihitung", () => {
  const r = ringkasKirim([kirim("antre", 0, "a"), kirim("antre", 0, "b")]);
  assert.equal(r.keberhasilan, 0);
});

test("yang gagal masih dicoba sampai batasnya", () => {
  assert.equal(bisaCobaLagi(kirim("gagal", 1)), true);
  assert.equal(bisaCobaLagi(kirim("gagal", MAKS_PERCOBAAN - 1)), true);
  assert.equal(bisaCobaLagi(kirim("gagal", MAKS_PERCOBAAN)), false);
  // Yang sudah terkirim atau masih antre bukan urusan percobaan ulang.
  assert.equal(bisaCobaLagi(kirim("terkirim", 1)), false);
  assert.equal(bisaCobaLagi(kirim("antre", 0)), false);
});

test("nomor disamarkan tapi masih bisa dikenali pemiliknya", () => {
  assert.equal(samarkanNomor("+628123456789"), "+628••••6789");
  // Terlalu pendek untuk disamarkan; ditampilkan apa adanya.
  assert.equal(samarkanNomor("+628"), "+628");
});

test("saringan status menyaring tepat", () => {
  const daftar = [
    kirim("terkirim", 1, "a"),
    kirim("gagal", 2, "b"),
    kirim("antre", 0, "c"),
  ];
  assert.equal(saringKirim(daftar, "semua").length, 3);
  assert.deepEqual(
    saringKirim(daftar, "gagal").map((p) => p.id),
    ["b"],
  );
});

test("saringan dari URL menolak nilai yang tidak dikenal", () => {
  assert.equal(bacaSaringanKirim("gagal"), "gagal");
  assert.equal(bacaSaringanKirim("karangan"), "semua");
  assert.equal(bacaSaringanKirim(undefined), "semua");
  assert.equal(bacaSaringanKirim(["antre", "gagal"]), "antre");
});

test("setiap status punya label dan gaya", () => {
  for (const s of ["antre", "terkirim", "gagal"] as const) {
    assert.ok(LABEL_STATUS_KIRIM[s].length > 0, s);
    assert.ok(GAYA_STATUS_KIRIM[s].length > 0, s);
  }
});
