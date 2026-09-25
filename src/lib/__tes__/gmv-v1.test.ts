import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  gabungGmv,
  gmvLaporanAkun,
  petaRekapAkun,
  ringkasGabungGmv,
  sebabDilewati,
} from "@/lib/gmv-v1";

test("angka yang sama dari tiga sumber hanya dipakai sekali; rekap affiliator yang menang", () => {
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
  // Angka yang diketik di laporan menunjuk hari sebelumnya; rekap
  // affiliator adalah angka yang dipakai dasbor lama sendiri.
  assert.equal(h.baris[0].sumber, "affiliate");
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
  assert.equal(h.baris[0].unit, "tap");
  assert.match(h.dilewati[0].alasan, /autoSynced/);
});

test("rekap affiliator lebih dipercaya daripada rekap harian per akun", () => {
  const h = gabungGmv({
    "affiliate-gmv:daily": [
      {
        id: "agm_1",
        date: "2024-10-02",
        accountId: "acc_1",
        gmv: "500.000",
        commission: "50.000",
        uploads: 4,
        orders: 12,
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
  assert.equal(h.baris[0].pesanan, 12);
});

test("akun rekap dicari lewat daftar akun lama, bukan id mentahnya", () => {
  // Ekspor sungguhan menunjuk akun lewat accountId; mesin migrasi
  // mencari akun V2 lewat username bakunya.
  const h = gabungGmv({
    "affiliate-accounts:all": [
      { id: "mpyf66yatnhs7", username: "alkahfihome_" },
    ],
    "affiliate-gmv:daily": [
      {
        id: "a1",
        date: "2026-06-01",
        accountId: "mpyf66yatnhs7",
        accountName: "alkahfihome_",
        gmv: 17100000,
        orders: 262,
        inputById: "mpvyvxu96atqo",
      },
    ],
  });
  assert.equal(h.baris[0].akun, "alkahfihome");
  assert.equal(h.baris[0].pencatat, "mpvyvxu96atqo");
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

test("rekap divisi internal tidak dibawa: GMV unit affiliator dihitung dari akun", () => {
  const h = gabungGmv({
    "gmv:daily": [
      { id: "g1", date: "2026-06-01", division: "internal", gmv: 100 },
      { id: "g2", date: "2026-06-01", division: "event", gmv: 100 },
    ],
  });
  assert.equal(h.baris.length, 0);
  assert.match(h.dilewati[0].alasan, /dihitung V2 dari akun/);
  assert.match(h.dilewati[1].alasan, /tidak punya unit/);
});

test("entri ganda dalam satu sumber: yang terakhir diperbarui yang dipakai", () => {
  const h = gabungGmv({
    "gmv:daily": [
      {
        id: "lama",
        date: "2026-07-27",
        division: "mcn",
        gmv: 100,
        createdAt: "2026-07-27T07:48:16Z",
      },
      {
        id: "koreksi",
        date: "2026-07-27",
        division: "mcn",
        gmv: 150,
        createdAt: "2026-07-27T07:48:17Z",
        updatedAt: "2026-08-04T08:06:40Z",
      },
    ],
  });
  assert.equal(h.baris.length, 1);
  assert.equal(h.baris[0].idLama, "koreksi");
  assert.equal(h.baris[0].gmv, 150);
  assert.match(h.dilewati[0].alasan, /Entri ganda/);
});

test("laporan bentuk mentah (fieldsSnapshot) terbaca sebagai kandidat", () => {
  const h = gabungGmv({
    "users:list": [{ id: "u_mcn", division: "mcn" }],
    "daily-reports:all": [
      {
        id: "r1",
        date: "2026-06-14",
        authorId: "u1",
        fieldsSnapshot: [
          { label: "Nama Akun", value: "naimanurr" },
          { label: "Tercapai GMV Berapa? (Kemarin)", value: "4.176.000" },
        ],
      },
      // Tanpa akun: unitnya diambil dari divisi pelapor.
      {
        id: "r2",
        date: "2026-06-14",
        authorId: "u_mcn",
        fieldsSnapshot: [{ label: "GMV Hari Ini (Rp)", value: 900 }],
      },
    ],
  });
  assert.equal(h.baris.length, 2);
  const akun = h.baris.find((b) => b.akun === "naimanurr");
  assert.equal(akun?.gmv, 4176000);
  assert.equal(akun?.sumber, "laporan");
  assert.equal(h.baris.find((b) => b.unit === "mcn")?.gmv, 900);
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

test("GMV laporan akun diambil dari rekap tanggal yang sama, atau nol", () => {
  const rekap = petaRekapAkun(
    gabungGmv({
      "affiliate-gmv:daily": [
        { id: "a1", date: "2026-06-01", accountId: "@toko", gmv: 17100000 },
      ],
    }),
  );
  assert.equal(rekap.size, 1);

  // Rekap ada dan angka yang diketik berbeda: rekap yang dipakai.
  const beda = gmvLaporanAkun(rekap, "toko", "2026-06-01", 15500000);
  assert.equal(beda.gmv, 17100000);
  assert.match(beda.keterangan ?? "", /15500000/);

  // Rekap ada dan sama: tidak perlu keterangan.
  assert.equal(
    gmvLaporanAkun(rekap, "toko", "2026-06-01", 17100000).keterangan,
    null,
  );

  // Tidak ada rekap: nol, dan angka yang diketik tetap tercatat.
  const kosong = gmvLaporanAkun(rekap, "toko", "2026-06-02", 17100000);
  assert.equal(kosong.gmv, 0);
  assert.match(kosong.keterangan ?? "", /nol/);
  assert.equal(
    gmvLaporanAkun(rekap, "toko", "2026-06-02", null).keterangan,
    null,
  );
});

test("contoh ekspor tidak menyisakan sasaran ganda", () => {
  const isi = JSON.parse(
    readFileSync("supabase/migrasi/ekspor-contoh.json", "utf8"),
  ) as Record<string, unknown>;

  const h = gabungGmv(isi);
  const r = ringkasGabungGmv(h);

  assert.ok(r.dipakai > 0);
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
