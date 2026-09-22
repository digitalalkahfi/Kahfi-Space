import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  keAngka,
  keTanggal,
  ringkasHasil,
  siapkanEntri,
  siapkanSemua,
  type Kamus,
} from "../impor.ts";

const kamus: Kamus = {
  unit: { affiliator: "unit-aff", mcn: "unit-mcn" },
  program: { "Mabit Scholar": "prog-mabit", Reguler: "prog-reguler" },
  pengguna: { "Rian Hidayat": "user-rian", "Dewi Lestari": "user-dewi" },
  akun: { "@skincare_official": "akun-skincare" },
};

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

test("entri wajar berhasil disiapkan", () => {
  const h = siapkanEntri(
    {
      key: "report:2024-10-24:@skincare_official",
      value: {
        tanggal: "24-10-2024",
        akun: "@skincare_official",
        pelapor: "Rian Hidayat",
        gmv: "2.500.000",
      },
    },
    kamus,
  );
  assert.equal(h.status, "berhasil");
  assert.deepEqual(h.data, {
    tanggal: "2024-10-24",
    account_id: "akun-skincare",
    user_id: "user-rian",
    gmv: 2500000,
  });
});

test("rujukan yang sudah hilang jadi gagal, bukan diam-diam kosong", () => {
  const h = siapkanEntri(
    {
      key: "report:2024-10-21:@akun_hilang",
      value: {
        tanggal: "2024-10-21",
        akun: "@akun_hilang",
        pelapor: "Rian Hidayat",
        gmv: 750000,
      },
    },
    kamus,
  );
  assert.equal(h.status, "gagal");
  assert.match(h.pesan, /tidak ditemukan di akun/);
});

test("medan wajib yang kosong jadi gagal", () => {
  const h = siapkanEntri(
    {
      key: "report:2024-10-21:@skincare_official",
      value: { tanggal: "2024-10-21" },
    },
    kamus,
  );
  assert.equal(h.status, "gagal");
  assert.match(h.pesan, /wajib tapi kosong/);
});

test("entitas asing dilewati, bukan gagal", () => {
  const h = siapkanEntri({ key: "seller:1", value: { nama: "Toko" } }, kamus);
  assert.equal(h.status, "dilewati");
});

test("kunci tanpa pemisah dilewati dengan alasan jelas", () => {
  const h = siapkanEntri({ key: "tanpa_pemisah", value: {} }, kamus);
  assert.equal(h.status, "dilewati");
  assert.match(h.pesan, /pemisah/);
});

test("nilai kosong jadi gagal", () => {
  const h = siapkanEntri({ key: "account:@a", value: null }, kamus);
  assert.equal(h.status, "gagal");
});

test("email disimpan huruf kecil", () => {
  const h = siapkanEntri(
    {
      key: "user:1",
      value: {
        id: "1",
        nama_lengkap: "Rian Hidayat",
        email: "RIAN@alkahfi.co.id",
        role: "Staff",
        aktif: true,
      },
    },
    kamus,
  );
  assert.equal(h.status, "berhasil");
  assert.equal(h.data?.email, "rian@alkahfi.co.id");
});

test("kolom berisi nilai bawaan tidak diambil dari data lama", () => {
  const h = siapkanEntri(
    {
      key: "user:1",
      value: {
        id: "1",
        nama_lengkap: "A",
        email: "a@b.co",
        role: "Staff",
        aktif: true,
        department_id: "jangan-dipakai",
      },
    },
    kamus,
  );
  assert.equal("department_id" in (h.data ?? {}), false);
});

// --- Urutan & ringkasan ----------------------------------------------

test("entri diurutkan sesuai ketergantungan entitas", () => {
  // Laporan menunjuk akun; memindahkannya lebih dulu akan gagal beruntun.
  const hasil = siapkanSemua(
    [
      { key: "report:2024-10-24:@skincare_official", value: {} },
      { key: "user:1", value: {} },
      { key: "account:@x", value: {} },
    ],
    kamus,
  );
  assert.deepEqual(
    hasil.map((h) => h.entitas),
    ["user", "account", "report"],
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
