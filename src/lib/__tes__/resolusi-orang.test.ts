import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bakuNama,
  resolusiOrang,
  ringkasResolusi,
  saranPadanan,
  type OrangBaru,
  type OrangLama,
} from "@/lib/resolusi-orang";

const v2: OrangBaru[] = [
  { id: "u-rian", nama: "Rian Hidayat", email: "rian@contoh.id" },
  { id: "u-dewi", nama: "Dewi Lestari", email: "dewi@contoh.id" },
  { id: "u-budi1", nama: "Budi Santoso", email: "budi@contoh.id" },
  { id: "u-budi2", nama: "Budi Santoso", email: "budi.s@contoh.id" },
];

test("nama disamakan bentuknya sebelum dibandingkan", () => {
  assert.equal(bakuNama("Dr. Rian  Hidayat, S.Kom"), "dr rian hidayat s kom");
  assert.equal(bakuNama("  RIAN   HIDAYAT "), "rian hidayat");
  assert.equal(bakuNama(""), null);
  assert.equal(bakuNama(null), null);
});

test("surel yang cocok dipakai lebih dulu, meski namanya berbeda", () => {
  // Orang berganti nama lebih sering daripada berganti surel kerja.
  const h = resolusiOrang(
    [{ id: "usr_1", nama: "Rian H.", email: "RIAN@contoh.id" }],
    v2,
  );
  assert.equal(h.belum.length, 0);
  assert.deepEqual(h.padanan[0], {
    idLama: "usr_1",
    idBaru: "u-rian",
    nama: "Rian H.",
    cara: "email",
  });
});

test("tanpa surel, nama yang menunjuk tepat satu orang dipakai", () => {
  const h = resolusiOrang(
    [{ id: "usr_2", nama: "dewi lestari", email: null }],
    v2,
  );
  assert.equal(h.padanan[0]?.idBaru, "u-dewi");
  assert.equal(h.padanan[0]?.cara, "nama");
});

test("nama kembar di V2 tidak pernah ditebak", () => {
  // Menebak salah satunya menukar riwayat kerja dua orang, tanpa galat.
  const h = resolusiOrang(
    [{ id: "usr_3", nama: "Budi Santoso", email: null }],
    v2,
  );
  assert.equal(h.padanan.length, 0);
  assert.equal(h.belum.length, 1);
  assert.match(h.belum[0].alasan, /bernama sama/);
});

test("nama kembar di data lama juga tidak ditebak", () => {
  const h = resolusiOrang(
    [
      { id: "usr_4", nama: "Dewi Lestari", email: null },
      { id: "usr_5", nama: "Dewi Lestari", email: null },
    ],
    v2,
  );
  assert.equal(h.padanan.length, 0);
  assert.equal(h.belum.length, 2);
  assert.match(h.belum[0].alasan, /lebih dari sekali di data lama/);
});

test("satu orang V2 tidak bisa diklaim dua orang V1", () => {
  const h = resolusiOrang(
    [
      { id: "usr_6", nama: "Rian Hidayat", email: "rian@contoh.id" },
      { id: "usr_7", nama: "Rian Hidayat Lama", email: "rian@contoh.id" },
    ],
    v2,
  );
  assert.equal(h.padanan.length, 1);
  assert.equal(h.padanan[0].idLama, "usr_6");
  assert.equal(h.belum.length, 1);
  assert.match(h.belum[0].alasan, /sudah tertaut/);
});

test("surel yang dipakai dua orang V2 dikembalikan ke orang", () => {
  const h = resolusiOrang(
    [{ id: "usr_8", nama: "Siapa Saja", email: "kembar@contoh.id" }],
    [
      { id: "a", nama: "A", email: "kembar@contoh.id" },
      { id: "b", nama: "B", email: "kembar@contoh.id" },
    ],
  );
  assert.equal(h.padanan.length, 0);
  assert.match(h.belum[0].alasan, /lebih dari satu orang/);
});

test("orang yang tidak ada padanannya disebut apa adanya", () => {
  const h = resolusiOrang(
    [{ id: "usr_9", nama: "Karyawan Lama", email: "keluar@contoh.id" }],
    v2,
  );
  assert.equal(h.padanan.length, 0);
  assert.equal(h.belum[0].idLama, "usr_9");
  assert.match(h.belum[0].alasan, /keluar@contoh.id/);
});

test("ringkasan memisahkan cara penautannya", () => {
  const lama: OrangLama[] = [
    { id: "a", nama: "X", email: "rian@contoh.id" },
    { id: "b", nama: "Dewi Lestari", email: null },
    { id: "c", nama: "Tidak Ada", email: null },
  ];
  const r = ringkasResolusi(resolusiOrang(lama, v2));
  assert.equal(r.lewatSurel, 1);
  assert.equal(r.lewatNama, 1);
  assert.equal(r.belum, 1);
  assert.equal(r.total, 3);
});

test("daftar kosong tidak menjatuhkan apa pun", () => {
  const h = resolusiOrang([], v2);
  assert.deepEqual(h.padanan, []);
  assert.deepEqual(h.belum, []);
});

test("saran padanan menyebut yang jelas mirip lebih dulu", () => {
  const saran = saranPadanan("Rian Hidayat Pratama", v2);
  assert.equal(saran[0].id, "u-rian");
  assert.ok(saran[0].skor > 0.3);
});

test("saran tidak muncul untuk nama yang tidak mirip sama sekali", () => {
  assert.deepEqual(saranPadanan("Zulkarnain", v2), []);
  assert.deepEqual(saranPadanan("", v2), []);
});

test("ejaan yang berbeda tipis tetap disarankan, dengan nilai rendah", () => {
  const saran = saranPadanan("Dewii Lestarii", [
    { id: "u-dewi", nama: "Dewi Lestari", email: null },
  ]);
  assert.equal(saran.length, 1);
  assert.ok(saran[0].skor <= 0.3);
});

test("saran dibatasi supaya daftarnya tetap membantu", () => {
  const banyak = Array.from({ length: 10 }, (_, i) => ({
    id: `u${i}`,
    nama: `Budi Santoso ${i}`,
    email: null,
  }));
  assert.equal(saranPadanan("Budi Santoso", banyak).length, 3);
});
