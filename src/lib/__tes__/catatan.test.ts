import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bacaSaringanCatatan,
  cuplikanCatatan,
  izinCatatan,
  saringCatatan,
  urutkanCatatan,
  type Catatan,
} from "@/lib/catatan";

const bawaan: Catatan = {
  id: "c1",
  judul: "Templat chat admin",
  isi: "Halo Kak, terima kasih.",
  kategori: "sop",
  visibilitas: "unit",
  unitKode: "mcn",
  unitNama: "MCN",
  disematkan: false,
  lampiran: [],
  pemilikId: "u_galih",
  pemilikNama: "Galih",
  dibuatPada: "2026-09-01T00:00:00Z",
  diperbaruiPada: "2026-09-01T00:00:00Z",
};
const catatan = (b: Partial<Catatan>): Catatan => ({ ...bawaan, ...b });

test("hanya penulisnya yang boleh mengubah dan menghapus", () => {
  assert.deepEqual(izinCatatan({ id: "u_galih" }, bawaan), {
    milik: true,
    ubah: true,
    hapus: true,
  });
  assert.equal(izinCatatan({ id: "u_manager" }, bawaan).ubah, false);
});

test("cuplikan tidak memutus kata dan meratakan baris", () => {
  const isi =
    "Baris satu\n\nBaris dua yang cukup panjang untuk dipotong di tengah kalimat";
  const c = cuplikanCatatan(isi, 30);
  assert.ok(c.endsWith("…"));
  assert.ok(!c.includes("\n"));
  assert.ok(c.length <= 31);
  assert.equal(cuplikanCatatan("pendek"), "pendek");
});

test("saringan lingkup memisahkan tulisan sendiri dan yang dibagikan", () => {
  const daftar = [
    bawaan,
    catatan({
      id: "c2",
      pemilikId: "u_saya",
      pemilikNama: "Saya",
      kategori: "rapat",
      judul: "Review harian",
    }),
    catatan({
      id: "c3",
      pemilikId: "u_ceo",
      visibilitas: "perusahaan",
      kategori: "dokumentasi",
    }),
  ];
  const s = bacaSaringanCatatan({ lingkup: "milikku", kategori: "asing" });
  assert.equal(s.kategori, "semua");
  assert.deepEqual(
    saringCatatan(daftar, s, "u_saya").map((c) => c.id),
    ["c2"],
  );
  assert.deepEqual(
    saringCatatan(
      daftar,
      { cari: "", kategori: "semua", lingkup: "dibagikan" },
      "u_saya",
    ).map((c) => c.id),
    ["c1", "c3"],
  );
  assert.deepEqual(
    saringCatatan(
      daftar,
      { cari: "review", kategori: "semua", lingkup: "semua" },
      "u_saya",
    ).map((c) => c.id),
    ["c2"],
  );
});

test("sematan sendiri naik ke atas; sematan orang lain tidak", () => {
  const daftar = [
    catatan({ id: "lama", diperbaruiPada: "2026-09-01T00:00:00Z" }),
    catatan({
      id: "sematan-orang",
      disematkan: true,
      pemilikId: "u_lain",
      diperbaruiPada: "2026-09-02T00:00:00Z",
    }),
    catatan({
      id: "sematan-saya",
      disematkan: true,
      pemilikId: "u_saya",
      diperbaruiPada: "2026-08-01T00:00:00Z",
    }),
    catatan({ id: "baru", diperbaruiPada: "2026-09-05T00:00:00Z" }),
  ];
  assert.deepEqual(
    urutkanCatatan(daftar, "u_saya").map((c) => c.id),
    ["sematan-saya", "baru", "sematan-orang", "lama"],
  );
});
