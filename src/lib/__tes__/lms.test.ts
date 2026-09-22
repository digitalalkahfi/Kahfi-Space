import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  jumlahTuntas,
  minimalBenar,
  percobaanTerbaik,
  modulBerikutnya,
  persenKemajuan,
  ringkasBelajar,
  ringkasProgresTim,
  totalMenit,
  urutkanProgres,
  wajibBagi,
  bacaSaringanProgres,
  progresTersaring,
  saringProgres,
  type Kursus,
  type ProgresOrang,
} from "../lms.ts";

const kursus = (b: Partial<Kursus>): Kursus => ({
  id: Math.random().toString(36),
  judul: "Uji",
  ringkasan: "",
  kategori: "Umum",
  tingkat: "dasar",
  unitKode: null,
  unitNama: "Semua unit",
  wajibUntuk: [],
  aktif: true,
  modul: [],
  terdaftar: false,
  selesaiPada: null,
  ...b,
});

const modul = (n: number, tuntas: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `m${i + 1}`,
    urutan: i + 1,
    judul: `Modul ${i + 1}`,
    isi: "",
    durasiMenit: 10,
    tuntas: i < tuntas,
  }));

test("kemajuan dihitung dari modul yang tuntas", () => {
  assert.equal(persenKemajuan(kursus({ modul: modul(4, 1) })), 25);
  assert.equal(persenKemajuan(kursus({ modul: modul(4, 4) })), 100);
});

test("kursus tanpa modul tidak dianggap sudah jalan", () => {
  assert.equal(persenKemajuan(kursus({ modul: [] })), 0);
});

test("pembulatan kemajuan tidak pernah melebihi 100", () => {
  assert.equal(persenKemajuan(kursus({ modul: modul(3, 3) })), 100);
});

test("total menit menjumlahkan seluruh modul", () => {
  assert.equal(totalMenit(kursus({ modul: modul(3, 0) })), 30);
  assert.equal(jumlahTuntas(kursus({ modul: modul(3, 2) })), 2);
});

test("modul berikutnya adalah yang belum tuntas paling awal", () => {
  assert.equal(modulBerikutnya(kursus({ modul: modul(4, 2) }))?.urutan, 3);
  assert.equal(modulBerikutnya(kursus({ modul: modul(4, 4) })), null);
});

test("urutan acak tidak mengubah modul berikutnya", () => {
  const acak = [...modul(4, 2)].reverse();
  assert.equal(modulBerikutnya(kursus({ modul: acak }))?.urutan, 3);
});

test("kewajiban mengikuti peran", () => {
  const k = kursus({ wajibUntuk: ["Staff", "Leader"] });
  assert.equal(wajibBagi(k, "Staff"), true);
  assert.equal(wajibBagi(k, "Finance"), false);
});

test("ringkasan menyoroti pelatihan wajib yang belum tuntas", () => {
  const r = ringkasBelajar(
    [
      kursus({
        wajibUntuk: ["Staff"],
        terdaftar: true,
        selesaiPada: "2024-10-01T00:00:00Z",
      }),
      kursus({ wajibUntuk: ["Staff"], terdaftar: true }),
      kursus({ terdaftar: true }),
      kursus({}),
    ],
    "Staff",
  );
  assert.equal(r.wajib, 2);
  assert.equal(r.wajibSelesai, 1);
  assert.equal(r.berjalan, 2);
  assert.equal(r.selesai, 1);
});

test("percobaan terbaik yang dipakai, bukan yang terakhir", () => {
  const terbaik = percobaanTerbaik([
    { id: "a", skor: 60, lulus: false, dikerjakanPada: "2024-10-01T00:00:00Z" },
    { id: "b", skor: 100, lulus: true, dikerjakanPada: "2024-10-02T00:00:00Z" },
    { id: "c", skor: 40, lulus: false, dikerjakanPada: "2024-10-03T00:00:00Z" },
  ]);
  assert.equal(terbaik?.id, "b");
});

test("tanpa percobaan tidak ada yang terbaik", () => {
  assert.equal(percobaanTerbaik([]), null);
});

test("minimal benar dibulatkan ke atas", () => {
  // 80% dari 3 soal adalah 2,4 — harus 3 benar, bukan 2.
  assert.equal(minimalBenar(3), 3);
  assert.equal(minimalBenar(5), 4);
  assert.equal(minimalBenar(10), 8);
});

const orang = (b: Partial<ProgresOrang>): ProgresOrang => ({
  userId: Math.random().toString(36),
  nama: "A",
  inisial: "AA",
  jabatan: "Staff",
  unitNama: "Affiliator",
  peran: "Staff",
  wajib: 0,
  wajibSelesai: 0,
  wajibTertunda: [],
  berjalan: 0,
  selesai: 0,
  ...b,
});

test("yang paling tertinggal muncul lebih dulu", () => {
  const hasil = urutkanProgres([
    orang({ nama: "Budi", wajibTertunda: [] }),
    orang({ nama: "Ani", wajibTertunda: ["x", "y"] }),
    orang({ nama: "Cita", wajibTertunda: ["x"] }),
  ]);
  assert.deepEqual(
    hasil.map((o) => o.nama),
    ["Ani", "Cita", "Budi"],
  );
});

test("ringkasan menyoroti yang belum mulai sama sekali", () => {
  const r = ringkasProgresTim([
    orang({ wajib: 2, wajibSelesai: 2 }),
    orang({ wajib: 2, wajibSelesai: 1, wajibTertunda: ["x"], berjalan: 1 }),
    orang({ wajib: 2, wajibSelesai: 0, wajibTertunda: ["x", "y"] }),
    orang({}),
  ]);
  assert.equal(r.orang, 4);
  assert.equal(r.tuntasSemua, 1);
  assert.equal(r.tertinggal, 2);
  assert.equal(r.belumMulai, 1);
});

test("orang tanpa kewajiban tidak dihitung tertinggal", () => {
  const r = ringkasProgresTim([orang({}), orang({})]);
  assert.equal(r.tertinggal, 0);
  assert.equal(r.tuntasSemua, 0);
});

test("kursus yang dipensiunkan tidak lagi mewajibkan siapa pun", () => {
  // Kalau tetap dihitung, seluruh tim selamanya tampil punya pelatihan
  // wajib tertunda padahal materinya sudah ditarik.
  const aktif = kursus({ wajibUntuk: ["Staff"], aktif: true });
  const pensiun = kursus({ wajibUntuk: ["Staff"], aktif: false });

  assert.equal(wajibBagi(aktif, "Staff"), true);
  assert.equal(wajibBagi(pensiun, "Staff"), false);

  const r = ringkasBelajar([aktif, pensiun], "Staff");
  assert.equal(r.wajib, 1);
});

const progres = (b: Partial<ProgresOrang>): ProgresOrang => ({
  userId: b.userId ?? "u1",
  nama: b.nama ?? "Nabila Putri",
  inisial: "NP",
  jabatan: b.jabatan ?? "Staff Affiliator",
  unitNama: b.unitNama ?? "Affiliator Network",
  peran: "Staff",
  wajib: b.wajib ?? 2,
  wajibSelesai: b.wajibSelesai ?? 2,
  wajibTertunda: b.wajibTertunda ?? [],
  berjalan: b.berjalan ?? 0,
  selesai: b.selesai ?? 2,
});

test("saringan 'belum tuntas' hanya menyisakan yang wajibnya tertunda", () => {
  const hasil = saringProgres(
    [
      progres({ userId: "a", wajib: 2, wajibSelesai: 2 }),
      progres({
        userId: "b",
        wajib: 2,
        wajibSelesai: 1,
        wajibTertunda: ["Onboarding"],
      }),
      progres({ userId: "c", wajib: 0, wajibSelesai: 0 }),
    ],
    { ...bacaSaringanProgres({}), hanyaTertinggal: true },
  );
  assert.deepEqual(
    hasil.map((p) => p.userId),
    ["b"],
  );
});

test("pencarian menjangkau nama pelatihan yang tertunda", () => {
  // Pengelola lebih sering mencari "siapa yang belum ikut Onboarding"
  // daripada mencari orangnya satu per satu.
  const daftar = [
    progres({
      userId: "a",
      nama: "Anisa",
      wajibTertunda: ["Onboarding K-Space"],
    }),
    progres({ userId: "b", nama: "Bagas", wajibTertunda: ["Keamanan Akun"] }),
  ];

  assert.deepEqual(
    saringProgres(daftar, {
      ...bacaSaringanProgres({}),
      cari: "onboarding",
    }).map((p) => p.userId),
    ["a"],
  );
  assert.deepEqual(
    saringProgres(daftar, { ...bacaSaringanProgres({}), cari: "bagas" }).map(
      (p) => p.userId,
    ),
    ["b"],
  );
});

test("parameter saringan progres yang tidak dikenal diabaikan", () => {
  assert.equal(
    bacaSaringanProgres({ tertinggal: "mungkin" }).hanyaTertinggal,
    false,
  );
  assert.equal(progresTersaring(bacaSaringanProgres({})), false);
  assert.equal(
    progresTersaring(bacaSaringanProgres({ tertinggal: "ya" })),
    true,
  );
});
