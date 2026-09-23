import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gabungGmv, ringkasGabungGmv, sebabDilewati } from "@/lib/gmv-v1";

test("angka yang sama dari tiga sumber hanya dipakai sekali", () => {
  const h = gabungGmv({
    "daily-reports:all": [
      {
        id: "rep_1",
        "Tanggal Laporan": "2024-10-01",
        Akun: "@a",
        GMV: "1.000.000",
      },
    ],
    "affiliate-gmv:daily": [
      { id: "agm_1", date: "2024-10-01", accountId: "@a", gmv: "1.000.000" },
    ],
    "gmv:daily": [
      {
        id: "gmv_1",
        date: "2024-10-01",
        accountId: "@a",
        gmv: "1.000.000",
        autoSynced: true,
      },
    ],
  });

  assert.equal(h.baris.length, 1);
  assert.equal(h.baris[0].sumber, "laporan");
  assert.equal(h.baris[0].gmv, 1000000);
  assert.equal(h.dilewati.length, 2);
});

test("entri autoSynced selalu dilewati beserta alasannya", () => {
  const h = gabungGmv({
    "gmv:daily": [
      {
        id: "g1",
        date: "2024-10-01",
        division: "mcn",
        gmv: 100,
        autoSynced: true,
      },
      {
        id: "g2",
        date: "2024-10-01",
        division: "tap",
        gmv: 200,
        autoSynced: false,
      },
    ],
  });

  assert.equal(h.baris.length, 1);
  assert.equal(h.baris[0].idLama, "g2");
  assert.match(h.dilewati[0].alasan, /autoSynced/);
});

test("tanpa laporan, rekap affiliator yang dipakai", () => {
  // Rekap affiliator membawa komisi dan jumlah unggahan; rekap harian
  // hanya totalnya.
  const h = gabungGmv({
    "affiliate-gmv:daily": [
      {
        id: "agm_1",
        date: "2024-10-02",
        accountId: "acc_1",
        gmv: "500.000",
        commission: "50.000",
        uploads: 4,
      },
    ],
    "gmv:daily": [
      {
        id: "gmv_1",
        date: "2024-10-02",
        accountId: "acc_1",
        gmv: "500.000",
        autoSynced: false,
      },
    ],
  });

  assert.equal(h.baris.length, 1);
  assert.equal(h.baris[0].sumber, "affiliate");
  assert.equal(h.baris[0].komisi, 50000);
  assert.equal(h.baris[0].upload, 4);
});

test("akun dan unit pada hari yang sama adalah dua sasaran berbeda", () => {
  const h = gabungGmv({
    "gmv:daily": [
      { id: "g1", date: "2024-10-01", accountId: "acc_1", gmv: 100 },
      { id: "g2", date: "2024-10-01", division: "mcn", gmv: 200 },
    ],
  });
  assert.equal(h.baris.length, 2);
  assert.equal(h.dilewati.length, 0);
});

test("entri tanpa sasaran atau tanpa tanggal dilaporkan, bukan dibuang diam-diam", () => {
  const h = gabungGmv({
    "gmv:daily": [
      { id: "g1", date: "2024-10-01", gmv: 100 },
      { id: "g2", date: "kemarin", division: "mcn", gmv: 100 },
    ],
    "affiliate-gmv:daily": [{ id: "a1", date: "2024-10-01", gmv: 100 }],
  });

  assert.equal(h.baris.length, 0);
  assert.equal(h.dilewati.length, 3);
});

test("angka bergaya lama dibaca utuh", () => {
  // "4.176.000" adalah empat juta, bukan empat koma satu.
  const h = gabungGmv({
    "gmv:daily": [
      { id: "g1", date: "2024-10-01", division: "mcn", gmv: "4.176.000" },
    ],
  });
  assert.equal(h.baris[0].gmv, 4176000);
});

test("contoh ekspor tidak menyisakan sasaran ganda", () => {
  const isi = JSON.parse(
    readFileSync("supabase/migrasi/ekspor-contoh.json", "utf8"),
  ) as Record<string, unknown>;

  const h = gabungGmv(isi);
  const r = ringkasGabungGmv(h);

  // Laporan yang diketik orang menang atas seluruh angka turunan.
  assert.ok(r.laporan > 0);
  assert.ok(r.dilewati > 0);
  assert.equal(r.total, r.dipakai + r.dilewati);

  const kunci = h.baris.map(
    (b) => `${b.tanggal}|${b.akun ?? ""}|${b.unit ?? ""}`,
  );
  assert.equal(new Set(kunci).size, kunci.length);
});

test("sebab dilewati dikelompokkan, bukan ditumpahkan satu per satu", () => {
  // Daftar mentah berisi ribuan baris dan tidak terbaca siapa pun.
  const h = gabungGmv({
    "daily-reports:all": [
      { id: "r1", "Tanggal Laporan": "2024-10-01", Akun: "@a", GMV: 1 },
      { id: "r2", "Tanggal Laporan": "2024-10-02", Akun: "@a", GMV: 1 },
    ],
    "affiliate-gmv:daily": [
      { id: "a1", date: "2024-10-01", accountId: "@a", gmv: 1 },
      { id: "a2", date: "2024-10-02", accountId: "@a", gmv: 1 },
    ],
    "gmv:daily": [
      {
        id: "g1",
        date: "2024-10-01",
        accountId: "@a",
        gmv: 1,
        autoSynced: true,
      },
    ],
  });

  const sebab = sebabDilewati(h);
  // Dua baris dengan sebab yang sama menjadi satu kelompok.
  const diwakili = sebab.find((s) => s.sebab.includes("sudah diwakili"));
  assert.equal(diwakili?.jumlah, 2);
  assert.equal(diwakili?.contoh.length, 2);

  const auto = sebab.find((s) => s.sebab.includes("autoSynced"));
  assert.equal(auto?.jumlah, 1);
  // Yang terbanyak disebut lebih dulu.
  assert.equal(sebab[0].jumlah >= sebab[sebab.length - 1].jumlah, true);
});

test("contoh id dibatasi supaya daftarnya tetap terbaca", () => {
  const laporan = Array.from({ length: 12 }, (_, i) => ({
    id: `r${i}`,
    "Tanggal Laporan": "2024-10-01",
    Akun: `@a${i}`,
    GMV: 1,
  }));
  const harian = laporan.map((l, i) => ({
    id: `g${i}`,
    date: "2024-10-01",
    accountId: `@a${i}`,
    gmv: 1,
  }));

  const sebab = sebabDilewati(
    gabungGmv({ "daily-reports:all": laporan, "gmv:daily": harian }),
  );
  assert.equal(sebab[0].jumlah, 12);
  assert.equal(sebab[0].contoh.length, 5);
});
