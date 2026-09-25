import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bacaSaringanPenjual,
  bakukanTelepon,
  izinPenjual,
  komisiDariTeks,
  ringkasPenjual,
  saringPenjual,
  tautanWhatsApp,
  urutkanPenjual,
  type Penjual,
} from "@/lib/penjual";

const bawaan: Penjual = {
  id: "p1",
  namaToko: "Torch.id",
  namaKontak: "Sandi",
  telepon: "0856-2223-2570",
  kategori: "Bag",
  status: "aktif",
  komisiPersen: 10,
  catatan: "",
  unitKode: "tap",
  unitNama: "TAP",
  picId: "u_yoga",
  picNama: "Yoga",
  dibuatOlehId: "u_dimas",
  dibuatPada: "2026-09-01T00:00:00Z",
  diperbaruiPada: "2026-09-01T00:00:00Z",
};
const penjual = (b: Partial<Penjual>): Penjual => ({ ...bawaan, ...b });

test("nomor telepon dibakukan ke 62…; yang bukan nomor jadi null", () => {
  assert.equal(bakukanTelepon("0856-2223-2570"), "6285622232570");
  assert.equal(bakukanTelepon("+62 812 3456 7890"), "6281234567890");
  assert.equal(bakukanTelepon("881-0236-12464"), "6288102361246" + "4");
  assert.equal(bakukanTelepon("Lark"), null);
  assert.equal(bakukanTelepon(""), null);
  assert.equal(tautanWhatsApp("08562223257"), "https://wa.me/628562223257");
  assert.equal(tautanWhatsApp("Lark"), null);
});

test("komisi dibaca dari teks bebas dan dibatasi 0–100", () => {
  assert.equal(komisiDariTeks("17"), 17);
  assert.equal(komisiDariTeks("10%"), 10);
  assert.equal(komisiDariTeks("12,5"), 12.5);
  assert.equal(komisiDariTeks(""), null);
  assert.equal(komisiDariTeks("abc"), null);
  assert.equal(komisiDariTeks("120"), null);
});

test("izin mencerminkan policy: pengelola, leader unitnya, dan PIC", () => {
  const manager = { id: "u_m", role: "Manager", unitId: null };
  const leaderTap = { id: "u_dimas", role: "Leader", unitId: "tap" as const };
  const leaderMcn = { id: "u_galih", role: "Leader", unitId: "mcn" as const };
  const yoga = { id: "u_yoga", role: "Staff", unitId: "tap" as const };
  const stafLain = { id: "u_x", role: "Staff", unitId: "tap" as const };

  assert.deepEqual(izinPenjual(manager, bawaan), {
    pengelola: true,
    tambah: true,
    ubah: true,
    hapus: true,
  });
  assert.equal(izinPenjual(leaderTap, bawaan).ubah, true);
  assert.equal(izinPenjual(leaderTap, bawaan).hapus, true);
  assert.equal(izinPenjual(leaderMcn, bawaan).ubah, false);
  assert.equal(izinPenjual(leaderMcn).tambah, true);
  // PIC boleh memperbarui, tidak boleh menghapus atau menambah.
  assert.equal(izinPenjual(yoga, bawaan).ubah, true);
  assert.equal(izinPenjual(yoga, bawaan).hapus, false);
  assert.equal(izinPenjual(yoga).tambah, false);
  assert.equal(izinPenjual(stafLain, bawaan).ubah, false);
});

test("saringan dari URL menolak nilai asing; pencarian menyentuh kontak dan catatan", () => {
  const s = bacaSaringanPenjual({
    status: "aneh",
    cari: "  torch ",
    unit: "TAP",
  });
  assert.equal(s.status, "semua");
  assert.equal(s.cari, "torch");
  assert.equal(s.unit, "TAP");

  const daftar = [
    bawaan,
    penjual({
      id: "p2",
      namaToko: "Nitron",
      namaKontak: "Firgon",
      status: "prospek",
      catatan: "menunggu respons",
    }),
    penjual({
      id: "p3",
      namaToko: "Manzone",
      unitNama: "Affiliator",
      status: "nonaktif",
    }),
  ];
  assert.deepEqual(
    saringPenjual(daftar, { ...s, cari: "respons" }).map((p) => p.id),
    ["p2"],
  );
  assert.deepEqual(
    saringPenjual(daftar, {
      cari: "",
      status: "nonaktif",
      unit: "semua",
      kategori: "semua",
    }).map((p) => p.id),
    ["p3"],
  );
  assert.deepEqual(
    saringPenjual(daftar, {
      cari: "",
      status: "semua",
      unit: "TAP",
      kategori: "semua",
    }).map((p) => p.id),
    ["p1", "p2"],
  );
});

test("urutan: aktif, prospek, nonaktif; ringkasan menghitung tiap status", () => {
  const daftar = [
    penjual({ id: "n", status: "nonaktif" }),
    penjual({
      id: "p",
      status: "prospek",
      diperbaruiPada: "2026-09-03T00:00:00Z",
    }),
    penjual({
      id: "a-lama",
      status: "aktif",
      diperbaruiPada: "2026-09-01T00:00:00Z",
    }),
    penjual({
      id: "a-baru",
      status: "aktif",
      diperbaruiPada: "2026-09-05T00:00:00Z",
    }),
  ];
  assert.deepEqual(
    urutkanPenjual(daftar).map((p) => p.id),
    ["a-baru", "a-lama", "p", "n"],
  );
  assert.deepEqual(ringkasPenjual(daftar), {
    total: 4,
    prospek: 1,
    aktif: 2,
    nonaktif: 1,
  });
});
