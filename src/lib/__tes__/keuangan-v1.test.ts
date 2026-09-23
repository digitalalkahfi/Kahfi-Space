import { strict as assert } from "node:assert";
import { test } from "node:test";
import { arahV1, jenisKeluarV1, keteranganKas } from "@/lib/keuangan-v1";

test("arah hanya dikenali dari penanda masuk", () => {
  // Salah menandai pengeluaran sebagai pemasukan membuat saldo tampak
  // lebih besar dari yang sebenarnya.
  assert.equal(arahV1("in"), "masuk");
  assert.equal(arahV1("MASUK"), "masuk");
  assert.equal(arahV1("out"), "keluar");
  assert.equal(arahV1("entah"), "keluar");
  assert.equal(arahV1(null), "keluar");
});

test("kategori lama dipetakan ke jenis keluar V2", () => {
  assert.equal(jenisKeluarV1("Operasional"), "beban");
  assert.equal(jenisKeluarV1("creator share"), "creator_share");
  assert.equal(jenisKeluarV1("HPP"), "direct_cost");
  assert.equal(jenisKeluarV1("Inventaris"), "aset");
});

test("kategori yang tidak dikenali tidak ditebak", () => {
  assert.equal(jenisKeluarV1("Biaya Aneh"), null);
  assert.equal(jenisKeluarV1(null), null);
});

test("kategori yang tidak dikenali ikut ditulis di keterangan", () => {
  // Kalau tidak, satu-satunya jejak kategori aslinya hilang saat ia
  // dipaksa menjadi beban.
  assert.equal(
    keteranganKas("Bayar vendor", "Biaya Aneh", false),
    "Bayar vendor (kategori lama: Biaya Aneh)",
  );
  // Yang sudah punya padanan tidak perlu diulang.
  assert.equal(
    keteranganKas("Bayar vendor", "Operasional", true),
    "Bayar vendor",
  );
});

test("transaksi tanpa keterangan tetap punya keterangan", () => {
  assert.equal(keteranganKas("", null, true), "Transaksi dari K-Space lama");
});
