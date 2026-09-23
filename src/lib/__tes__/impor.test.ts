import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  keAngka,
  keTanggal,
  ringkasHasil,
  siapkanKunci,
  siapkanSemua,
  type Kamus,
} from "../impor.ts";

/**
 * Kamus memetakan nilai apa adanya dari ekspor lama ke id V2 — id orang
 * lama (`usr_003`) maupun username akun, karena ekspor lama menyebut akun
 * dengan dua bentuk yang berbeda di tempat yang berbeda.
 */
const kamus: Kamus = {
  unit: { affiliator: "unit-aff", mcn: "unit-mcn" },
  program: { "Mabit Scholar": "prog-mabit", Reguler: "prog-reguler" },
  pengguna: { usr_003: "user-rian", usr_005: "user-dewi" },
  akun: { "@skincare_official": "akun-skincare", acc_001: "akun-skincare" },
};

const satu = (kunci: string, catatan: unknown) =>
  siapkanKunci({ key: kunci, value: [catatan] }, kamus)[0];

// --- Angka -----------------------------------------------------------

test("angka bertanda pemisah ribuan dibaca utuh", () => {
  // Salah tafsir di sini mengecilkan GMV sejuta kali lipat tanpa galat.
  assert.equal(keAngka("2.500.000"), 2500000);
  assert.equal(keAngka("1.000"), 1000);
});

test("angka biasa dan numerik tetap jalan", () => {
  assert.equal(keAngka(2500000), 2500000);
  assert.equal(keAngka("2500000"), 2500000);
});

test("koma dibaca sebagai desimal", () => {
  assert.equal(keAngka("1.234,5"), 1234.5);
});

test("bukan angka ditolak, bukan dijadikan nol", () => {
  assert.equal(keAngka("dua juta"), null);
  assert.equal(keAngka(""), null);
  assert.equal(keAngka(null), null);
  assert.equal(keAngka(Number.NaN), null);
});

// --- Tanggal ---------------------------------------------------------

test("tanggal ISO diteruskan", () => {
  assert.equal(keTanggal("2024-10-24"), "2024-10-24");
  assert.equal(keTanggal("2024-10-24T07:48:00+07:00"), "2024-10-24");
});

test("tanggal gaya terbalik dibetulkan", () => {
  assert.equal(keTanggal("24-10-2024"), "2024-10-24");
  assert.equal(keTanggal("05/03/2024"), "2024-03-05");
});

test("tanggal yang tidak ada ditolak", () => {
  assert.equal(keTanggal("31-04-2024"), null);
  assert.equal(keTanggal("2024-13-01"), null);
  assert.equal(keTanggal("kemarin"), null);
});

// --- Entri -----------------------------------------------------------

test("catatan wajar berhasil disiapkan", () => {
  const h = satu("daily-reports:all", {
    id: "rep_001",
    "Tanggal Laporan": "24-10-2024",
    userId: "usr_003",
    Akun: "@skincare_official",
    GMV: "2.500.000",
  });

  assert.equal(h.status, "berhasil");
  assert.equal(h.kunciLama, "daily-reports:all:rep_001");
  assert.deepEqual(h.data, {
    id_lama: "rep_001",
    tanggal: "2024-10-24",
    user_id: "user-rian",
    account_id: "akun-skincare",
    gmv: 2500000,
  });
});

test("rujukan yang sudah hilang jadi gagal, bukan diam-diam kosong", () => {
  const h = satu("daily-reports:all", {
    id: "rep_002",
    "Tanggal Laporan": "2024-10-21",
    userId: "usr_003",
    Akun: "@akun_hilang",
    GMV: 750000,
  });

  assert.equal(h.status, "gagal");
  assert.match(h.pesan, /tidak ditemukan di akun/);
});

test("medan wajib yang kosong jadi gagal", () => {
  const h = satu("daily-reports:all", {
    id: "rep_003",
    "Tanggal Laporan": "2024-10-21",
  });
  assert.equal(h.status, "gagal");
  assert.match(h.pesan, /wajib tapi kosong/);
});

test("medan bertanda gabung ditempel, bukan saling menimpa", () => {
  // Jawaban bebas tersebar di beberapa label; memilih salah satu berarti
  // membuang yang lain tanpa jejak.
  const h = satu("daily-reports:all", {
    id: "rep_004",
    "Tanggal Laporan": "2024-10-21",
    userId: "usr_003",
    Unit: "mcn",
    GMV: 100,
    Kendala: "Sinyal mati",
    Catatan: "Lembur",
  });

  assert.equal(h.status, "berhasil");
  assert.equal(h.data?.catatan, "Sinyal mati\nLembur");
});

test("kunci asing dilewati sekali, bukan gagal beruntun", () => {
  const hasil = siapkanKunci(
    { key: "sellers:all", value: [{ id: "s1" }, { id: "s2" }] },
    kamus,
  );
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].status, "dilewati");
});

test("catatan kosong jadi gagal", () => {
  const h = satu("affiliate-accounts:all", null);
  assert.equal(h.status, "gagal");
});

test("email disimpan huruf kecil", () => {
  const h = satu("users:list", {
    id: "usr_003",
    name: "Rian Hidayat",
    email: "RIAN@contoh.id",
    role: "Staff",
    active: true,
  });
  assert.equal(h.status, "berhasil");
  assert.equal(h.data?.email, "rian@contoh.id");
});

test("kolom berisi nilai bawaan tidak diambil dari data lama", () => {
  const h = satu("users:list", {
    id: "usr_003",
    name: "A",
    email: "a@b.co",
    role: "Staff",
    active: true,
    department_id: "jangan-dipakai",
  });
  assert.equal("department_id" in (h.data ?? {}), false);
});

test("catatan tanpa id tetap punya kunci lama yang khas", () => {
  // Tanpa penanda, dua catatan yang sama-sama tanpa id tidak bisa
  // dibedakan saat unggahan diulang.
  const hasil = siapkanKunci(
    {
      key: "attendance:config",
      value: { jamMasuk: "08:00", jamPulang: "17:00" },
    },
    kamus,
  );
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].kunciLama, "attendance:config:#0");
});

// --- Urutan & ringkasan ----------------------------------------------

test("kunci diurutkan sesuai ketergantungannya", () => {
  // Laporan menunjuk akun; memetakannya lebih dulu akan gagal beruntun.
  const hasil = siapkanSemua(
    [
      { key: "daily-reports:all", value: [] },
      { key: "users:list", value: [] },
      { key: "affiliate-accounts:all", value: [] },
    ],
    kamus,
  );
  // Kunci kosong tidak menghasilkan baris, jadi yang diperiksa urutan
  // kuncinya lewat kunci berisi satu catatan.
  const berisi = siapkanSemua(
    [
      { key: "daily-reports:all", value: [{ id: "r" }] },
      { key: "users:list", value: [{ id: "u" }] },
      { key: "affiliate-accounts:all", value: [{ id: "a" }] },
    ],
    kamus,
  );
  assert.deepEqual(hasil, []);
  assert.deepEqual(
    berisi.map((h) => h.entitas),
    ["users:list", "affiliate-accounts:all", "daily-reports:all"],
  );
});

test("ringkasan menghitung tiap status per entitas", () => {
  const r = ringkasHasil([
    {
      entitas: "user",
      kunciLama: "a",
      status: "berhasil",
      pesan: "",
      data: {},
    },
    {
      entitas: "user",
      kunciLama: "b",
      status: "gagal",
      pesan: "x",
      data: null,
    },
    {
      entitas: "seller",
      kunciLama: "c",
      status: "dilewati",
      pesan: "",
      data: null,
    },
  ]);
  assert.equal(r.length, 2);
  const user = r.find((x) => x.entitas === "user");
  assert.equal(user?.berhasil, 1);
  assert.equal(user?.gagal, 1);
});

// --- Ejaan medan lama -------------------------------------------------

test("medan camelCase dibaca apa adanya, tidak diubah bentuknya", () => {
  // Ekspor lama memakai camelCase; mengubahnya menjadi snake_case dulu
  // akan membuat seluruh pencarian medan meleset.
  const h = satu("affiliate-accounts:all", {
    id: "acc_001",
    username: "@skincare_official",
    division: "affiliator",
    picId: "usr_003",
    coLeaderId: "usr_005",
    active: true,
  });

  assert.equal(h.status, "berhasil");
  assert.equal(h.data?.pic_user_id, "user-rian");
  assert.equal(h.data?.co_leader_id, "user-dewi");
  assert.equal(h.data?.id_lama, "acc_001");
});

test("medan berlabel berspasi dibaca utuh, bukan dipotong", () => {
  // Formulir lama memakai judul pertanyaan sebagai nama medan.
  const h = satu("daily-reports:all", {
    id: "rep_9",
    "Tanggal Laporan": "2024-10-24",
    userId: "usr_003",
    Unit: "mcn",
    GMV: "13.160.000",
    "Jumlah Upload": "7",
  });

  assert.equal(h.status, "berhasil");
  assert.equal(h.data?.gmv, 13160000);
  assert.equal(h.data?.jumlah_upload, 7);
  assert.equal(h.data?.unit_id, "unit-mcn");
});

test("medan yang tidak ada di pemetaan tidak ikut tertulis", () => {
  // Kolom tujuan hanya yang disebut pemetaan; medan lain yang kebetulan
  // bernama sama dengan kolom V2 tidak boleh menyelinap masuk.
  const h = satu("users:list", {
    id: "usr_003",
    name: "Rian",
    email: "rian@contoh.id",
    role: "Staff",
    active: true,
    status: "diretas",
    department_id: "jangan-dipakai",
  });

  assert.equal(h.status, "berhasil");
  assert.equal("department_id" in (h.data ?? {}), false);
  // `status` memang kolom tujuan, tetapi sumbernya `active` — bukan
  // medan bernama status di data lama.
  assert.equal(h.data?.status, true);
});

test("ejaan medan yang berbeda tipis tidak dianggap sama", () => {
  // `userid` bukan `userId`: yang pertama akan membuat laporannya tidak
  // punya pelapor sama sekali.
  const h = satu("daily-reports:all", {
    id: "rep_10",
    "Tanggal Laporan": "2024-10-24",
    userid: "usr_003",
    Unit: "mcn",
    GMV: 1000,
  });

  assert.equal(h.status, "gagal");
  assert.match(h.pesan, /userId wajib tapi kosong/);
});
