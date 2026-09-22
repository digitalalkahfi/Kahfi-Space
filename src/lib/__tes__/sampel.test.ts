import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  LANJUTAN,
  etalaseProduk,
  perpindahanSah,
  ringkasPerjalanan,
  ringkasSampel,
  selisihHari,
  tautanProdukSah,
  type KejadianSampel,
  type Sampel,
  type StatusSampel,
} from "../sampel.ts";
import dataContoh from "../../../supabase/seed/data.json" with { type: "json" };

const sampel = (status: StatusSampel, nilai = 100000): Sampel => ({
  id: `s-${status}-${nilai}`,
  kode: "SMP-0001",
  nama: "Contoh",
  kategori: "Uji",
  unitKode: null,
  unitNama: "Affiliator",
  nilai,
  status,
  pemegangId: null,
  pemegangNama: null,
  akunId: null,
  akunUsername: null,
  kreator: "",
  brand: "",
  linkProduk: null,
  catatan: "",
  diperbaruiPada: "2024-10-24T10:00:00Z",
});

test("perpindahan yang masuk akal diterima", () => {
  assert.equal(perpindahanSah("tersedia", "dipegang"), true);
  assert.equal(perpindahanSah("dikirim", "diterima"), true);
  assert.equal(perpindahanSah("diterima", "dikembalikan"), true);
});

test("lompatan yang tidak masuk akal ditolak", () => {
  // Barang tidak melompat dari gudang langsung ke tangan kreator.
  assert.equal(perpindahanSah("tersedia", "diterima"), false);
  assert.equal(perpindahanSah("tersedia", "dikembalikan"), false);
  assert.equal(perpindahanSah("dikembalikan", "diterima"), false);
  assert.equal(perpindahanSah("dikirim", "dikembalikan"), false);
});

test("barang yang kembali bisa masuk stok lagi", () => {
  // Tanpa jalur ini, hitungan isi gudang selamanya kurang.
  assert.equal(perpindahanSah("dikembalikan", "tersedia"), true);
});

test("sampel hilang bisa ditemukan lagi", () => {
  assert.equal(perpindahanSah("hilang", "tersedia"), true);
  assert.equal(perpindahanSah("hilang", "diterima"), false);
});

test("tidak ada status yang berpindah ke dirinya sendiri", () => {
  for (const [dari, tujuan] of Object.entries(LANJUTAN)) {
    assert.equal(
      tujuan.includes(dari as StatusSampel),
      false,
      `${dari} tidak boleh berpindah ke dirinya sendiri`,
    );
  }
});

test("setiap status punya jalan keluar", () => {
  for (const [dari, tujuan] of Object.entries(LANJUTAN)) {
    assert.equal(tujuan.length > 0, true, `${dari} buntu`);
  }
});

test("ringkasan menghitung nilai yang sedang di luar gudang", () => {
  const r = ringkasSampel([
    sampel("tersedia", 50000),
    sampel("dipegang", 100000),
    sampel("dikirim", 200000),
    sampel("diterima", 300000),
    sampel("dikembalikan", 400000),
  ]);
  assert.equal(r.total, 5);
  assert.equal(r.diLuar, 3);
  assert.equal(r.nilaiDiLuar, 600000);
});

test("yang hilang dihitung terpisah dari yang di luar", () => {
  const r = ringkasSampel([sampel("hilang", 410000), sampel("dikirim", 90000)]);
  assert.equal(r.hilang, 1);
  assert.equal(r.nilaiHilang, 410000);
  assert.equal(r.diLuar, 1);
  assert.equal(r.nilaiDiLuar, 90000);
});

test("hanya tautan http(s) yang boleh dibuka", () => {
  assert.equal(tautanProdukSah("https://shopee.co.id/produk-i.1.2"), true);
  assert.equal(tautanProdukSah("http://toko.example/produk"), true);
  assert.equal(tautanProdukSah("  https://www.tiktok.com/@a/video/1  "), true);

  // Jalan masuk skrip asing lewat kolom yang diisi pengguna.
  assert.equal(tautanProdukSah("javascript:alert(1)"), false);
  assert.equal(tautanProdukSah("data:text/html,<script>"), false);
  assert.equal(tautanProdukSah("shopee.co.id/tanpa-protokol"), false);
  assert.equal(tautanProdukSah(""), false);
  assert.equal(tautanProdukSah(null), false);
});

test("etalase dikenali dari nama hostnya", () => {
  assert.equal(
    etalaseProduk("https://www.tiktok.com/@akun/video/7301122334455667788"),
    "TikTok Shop",
  );
  assert.equal(
    etalaseProduk("https://shopee.co.id/produk-i.112233.445566"),
    "Shopee",
  );
  assert.equal(etalaseProduk("https://tokolain.example/produk"), "Lainnya");
  // Tautan yang tidak sah tidak boleh diberi nama etalase yang meyakinkan.
  assert.equal(etalaseProduk("javascript:alert(1)"), "Lainnya");
});

test("data contoh sampel membawa brand dan tautan produk", () => {
  const contoh = dataContoh.samples;
  assert.ok(contoh.every((s) => typeof s.brand === "string"));
  assert.ok(
    contoh.some((s) => tautanProdukSah(s.link)),
    "sebagian sampel memang punya tautan etalase",
  );
  assert.ok(
    contoh.some((s) => !s.link),
    "sebagian lagi sengaja kosong, supaya keadaan itu ikut teruji",
  );
});

const kejadian = (
  ke: StatusSampel,
  pada: string,
  dari: StatusSampel | null = null,
): KejadianSampel => ({
  id: `${ke}-${pada}`,
  dari,
  ke,
  olehNama: "Farhan Pratama",
  pemegangNama: null,
  kreator: "",
  catatan: "",
  pada,
});

test("selisih hari dihitung penuh dan tidak pernah minus", () => {
  assert.equal(
    selisihHari("2024-10-20T10:00:00+07:00", "2024-10-23T10:00:00+07:00"),
    3,
  );
  assert.equal(
    selisihHari("2024-10-20T10:00:00+07:00", "2024-10-20T23:00:00+07:00"),
    0,
  );
  // Urutan terbalik berarti data keliru, bukan alasan menampilkan minus.
  assert.equal(
    selisihHari("2024-10-23T10:00:00+07:00", "2024-10-20T10:00:00+07:00"),
    0,
  );
});

test("perjalanan menghitung lama di keadaan sekarang dan total di luar", () => {
  const acuan = "2024-10-24T12:00:00+07:00";
  const riwayat = [
    kejadian("dikembalikan", "2024-10-23T10:00:00+07:00", "diterima"),
    kejadian("diterima", "2024-10-22T10:00:00+07:00", "dikirim"),
    kejadian("dikirim", "2024-10-21T10:00:00+07:00", "dipegang"),
    kejadian("dipegang", "2024-10-20T10:00:00+07:00", "tersedia"),
  ];

  const p = ringkasPerjalanan(riwayat, acuan);
  assert.equal(p.perpindahan, 4);
  assert.equal(p.lamaHari, 1, "sudah sehari sejak dikembalikan");
  // dipegang→dikirim→diterima masing-masing sehari; dikembalikan tidak
  // dihitung karena barangnya sudah di gudang.
  assert.equal(p.hariDiLuar, 3);
  assert.equal(p.pernahKeKreator, true);
});

test("sampel yang masih di luar tetap menghitung harinya sampai acuan", () => {
  const p = ringkasPerjalanan(
    [kejadian("dipegang", "2024-10-20T10:00:00+07:00", "tersedia")],
    "2024-10-24T10:00:00+07:00",
  );
  assert.equal(
    p.hariDiLuar,
    4,
    "rentangnya belum ditutup perpindahan berikutnya",
  );
  assert.equal(p.pernahKeKreator, false);
});

test("sampel tanpa riwayat tidak mengarang angka", () => {
  const p = ringkasPerjalanan([], "2024-10-24T10:00:00+07:00");
  assert.deepEqual(p, {
    perpindahan: 0,
    sejak: null,
    lamaHari: 0,
    hariDiLuar: 0,
    pernahKeKreator: false,
  });
});
