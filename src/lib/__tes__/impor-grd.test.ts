import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as XLSX from "xlsx";
import {
  bacaRencanaGrd,
  bacaRupiahTeks,
  bacaTenggat,
  indukKode,
  pisahKode,
  satuanAplikasi,
  satuanIndikator,
  susunRencana,
  type LembarXlsx,
} from "../impor-grd.ts";

test("angka rupiah dari teks file GRD", () => {
  assert.equal(bacaRupiahTeks("32,2 M"), 32_200_000_000);
  assert.equal(bacaRupiahTeks("5,3 M"), 5_300_000_000);
  assert.equal(bacaRupiahTeks("150 jt"), 150_000_000);
  assert.equal(bacaRupiahTeks("Rp 2,8 juta"), 2_800_000);
  assert.equal(bacaRupiahTeks(4_950_000_000), 4_950_000_000);
  assert.equal(bacaRupiahTeks("belum diukur"), null);
});

test("tenggat dari rumusan goal", () => {
  const p = "2026-10-01";
  assert.equal(
    bacaTenggat("… menjadi 7 creator pada 17 Oktober 2026", p),
    "2026-10-17",
  );
  assert.equal(
    bacaTenggat("… menjadi 50 creator pada 4 November 2026", p),
    "2026-11-04",
  );
  // Acara dua hari: tanggal terakhir yang disebut.
  assert.equal(
    bacaTenggat("… pada MMC 40 (31 Oktober – 1 November 2026)", p),
    "2026-11-01",
  );
  // Tanpa tanggal hari: akhir bulan periode.
  assert.equal(
    bacaTenggat("… menjadi 5,3 M pada Oktober 2026", p),
    "2026-10-31",
  );
});

test("kode, satuan, dan induk goal GRD", () => {
  assert.deepEqual(pisahKode("1.1.3 — Menaikkan GMV 7 akun utama"), {
    kode: "1.1.3",
    judul: "Menaikkan GMV 7 akun utama",
  });
  assert.equal(pisahKode("S.2.1 — Menyelesaikan MDM").kode, "S.2.1");
  assert.equal(pisahKode("Menaikkan GMV bulanan").kode, null);
  assert.equal(satuanAplikasi("Rupiah"), "IDR");
  assert.equal(satuanAplikasi("Seller"), "Seller");
  assert.equal(indukKode("1.1.3"), "1.1");
  assert.equal(indukKode("1"), null);
  assert.equal(
    satuanIndikator("Seller mitra aktif — jumlah seller", false),
    "seller",
  );
  assert.equal(satuanIndikator("SOP lulus NPS — isi jumlah SOP", false), "SOP");
  assert.equal(
    satuanIndikator("Rata-rata video terupload per hari", false),
    "video/hari",
  );
  assert.equal(satuanIndikator("GMV vs target — % realisasi", true), "%");
});

/** Lembar dari baris-baris; sel bertanda {persen} diberi format 0%. */
function lembar(baris: unknown[][]): LembarXlsx {
  const ws = XLSX.utils.aoa_to_sheet(
    baris.map((r) =>
      r.map((c) =>
        c && typeof c === "object" && "persen" in (c as object)
          ? (c as { persen: number }).persen
          : c,
      ),
    ),
  ) as LembarXlsx;
  baris.forEach((r, i) =>
    r.forEach((c, j) => {
      if (c && typeof c === "object" && "persen" in (c as object)) {
        const alamat = XLSX.utils.encode_cell({ r: i, c: j });
        (ws[alamat] as { z?: string }).z = "0%";
      }
    }),
  );
  return ws;
}

const p = (x: number) => ({ persen: x });
const GMV = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.98, 1, 1.05, 1.1].map(p);

function workbook() {
  const goal = lembar([
    [],
    [null, "GOAL OKTOBER 2026"],
    [
      null,
      "No",
      "Sasaran",
      "Target",
      null,
      "Base",
      "Satuan Pengukuran",
      "Keterangan",
    ],
    [null, 1, "Menaikkan GMV bulanan", "32,2 M", null, "23,3 M", "Rupiah", ""],
    [null, "PLANNING"],
    [
      null,
      1,
      "Menaikkan GMV bulanan dari Rp 23,3 M menjadi Rp 32,2 M bulan Oktober 2026",
    ],
    [null, "GOAL MANAGER"],
    [null, "No", "Sasaran", "Target", null, "Base", "Satuan", "Ket"],
    [
      null,
      1,
      "Menaikkan GMV internal menjadi 5,3 M pada Oktober 2026",
      "5,3 M",
      null,
      "3,8 M",
      "Rupiah",
      "",
    ],
    [null, "GOAL LEADER — TACTICAL PLAN"],
    [null, "DEPARTEMEN AFFILIATOR — Leader: Siti (Blok Internal)"],
    [
      null,
      1,
      "1.1.3 — Menaikkan GMV 2 akun utama pada 31 Oktober 2026",
      4_950_000_000,
      null,
      3_598_455_622,
      "Rupiah",
      "PIC: Siti",
    ],
    [null, "DEPARTEMEN TAP — Leader: Fajar (Blok Internal)"],
    [
      null,
      2,
      "1.1.5 — Menambah seller pada 17 Oktober 2026",
      15,
      null,
      10,
      "Seller",
      "",
    ],
    [null, "GOAL STAF PENDUKUNG MANAGER"],
    [null, "SEKRETARIAT — Alma"],
    [
      null,
      3,
      "S.2.1 — Menyelesaikan MDM pada 17 Oktober 2026",
      p(1),
      null,
      "sebagian",
      "%",
      "",
    ],
    [null, "CEK PATUNGAN"],
  ]);
  const kurva = lembar([
    [null, "TARGET PER AKUN"],
    [],
    [null, "A. TARGET PER AKUN — usulan, difinalkan di WRM"],
    [
      null,
      "Akun",
      "Pemegang",
      "Level",
      "Base",
      "Target",
      "Vid",
      "Target vid",
      "Aktual",
      "%",
      "Catatan",
    ],
    [null, "AKUN UTAMA — Goal 1.1.3 (GMV di luar LIVE)"],
    [
      null,
      "alkahfihome_",
      "Siti",
      "Utama",
      1_809_485_389,
      2_489_000_000,
      40,
      50,
    ],
    [null, "taokspill", "Agnes", "Utama", 21_036_771, 29_000_000, 8, 10],
    [null, "TOTAL — Goal 1.1.3", null, null, 1, 2],
    [],
    [null, "B. KURVA MINGGUAN — target KUMULATIF"],
    [null, "Goal / Ukuran", "PIC", "Satuan", "Sab 3 Okt", "Sab 10 Okt"],
    [
      null,
      "1.1.3 GMV 2 akun utama (di luar LIVE)",
      "Siti",
      "TARGET",
      480_000_000,
      1_600_000_000,
      null,
      null,
      null,
      null,
      "Rp",
    ],
    [null, null, null, "AKTUAL"],
    [
      null,
      "1.1.5 Seller mitra aktif (kumulatif)",
      "Fajar",
      "TARGET",
      10,
      11,
      null,
      null,
      null,
      null,
      "Seller",
    ],
    [
      null,
      "1.1.5 Klik pendukung (kumulatif)",
      "Fajar",
      "TARGET",
      0,
      5,
      null,
      null,
      null,
      null,
      "Orang",
    ],
    [
      null,
      "TOTAL GMV INTERNAL (1.1.3)",
      null,
      "TARGET",
      490_000_000,
      1_665_000_000,
      null,
      null,
      null,
      null,
      "Jumlah baris Rp di atas",
    ],
  ]);
  const kpiTim = lembar([
    ["KPI CO-LEADER — AGNES"],
    ["Akun serbaaada.store & taokspill"],
    ["Penilai: Siti"],
    [
      "No",
      "Indicator",
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      "PENCAPAIAN",
      "VALUE",
      "BOBOT",
      "TOTAL",
    ],
    [1, "GMV 2 akun vs target — % realisasi", ...GMV, null, 0, 60, 0],
    [
      2,
      "Komplain — jumlah temuan",
      9,
      8,
      7,
      6,
      5,
      4,
      3,
      2,
      1,
      0,
      null,
      0,
      40,
      0,
    ],
    [null, null, null, null, null, "BASE", null, null, null, "GOAL"],
    [],
    [],
    ["KPI TIM KONTEN — TEMPLATE (1 lembar per orang)"],
    ["Raka · sinirakaspill_"],
    ["Penilai: Co-Leader"],
    ["NAMA:"],
    [
      "No",
      "Indicator",
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      "PENCAPAIAN",
      "VALUE",
      "BOBOT",
      "TOTAL",
    ],
    [
      1,
      "GMV akun sendiri vs target akun — % realisasi",
      ...GMV,
      null,
      0,
      100,
      0,
    ],
    [null, null, null, null, null, "BASE"],
    [],
    [],
    ["TABEL REFERENSI — target per orang"],
    ["No", "Nama · Akun / Level", "Target GMV Okt"],
    [1, "Raka · sinirakaspill_", 20_000_000],
  ]);
  return {
    Sheets: {
      GOAL: goal,
      "Target & Kurva WRM": kurva,
      "KPI Tim": kpiTim,
    } as Record<string, LembarXlsx>,
  };
}

test("rencana GRD dibaca dari templat file: goal, target akun, kurva, lembar", () => {
  const r = bacaRencanaGrd(workbook());
  assert.equal(r.periode, "2026-10-01");

  const goal = Object.fromEntries(r.goals.map((g) => [g.kode, g]));
  assert.equal(goal["1"].target, 32_200_000_000);
  assert.match(goal["1"].judul, /dari Rp 23,3 M/);
  assert.equal(goal["1.1"].induk, "1");
  assert.equal(goal["1.1.3"].induk, "1.1");
  assert.equal(goal["1.1.3"].pemilik, "Siti");
  assert.equal(goal["1.1.5"].unit, "tap");
  assert.equal(goal["1.1.5"].tenggat, "2026-10-17");
  assert.equal(goal["1.1.5"].jenisRealisasi, "isian");
  assert.equal(goal["S.2.1"].target, 100);
  assert.equal(goal["S.2.1"].base, null);
  assert.equal(goal["S.2.1"].pemilik, "Alma");
  assert.equal(goal["1.1.3:alkahfihome_"].status, "draft");
  assert.equal(goal["1.1.3:alkahfihome_"].target, 2_489_000_000);

  const ukuran = Object.fromEntries(r.ukuran.map((u) => [u.kode, u]));
  assert.deepEqual(ukuran["1.1.3"].lingkup, [
    { akun: "alkahfihome_", jenisGmv: "video", faktor: 1 },
    { akun: "taokspill", jenisGmv: "video", faktor: 1 },
  ]);
  assert.deepEqual(ukuran["1.1.3"].titik, [
    { tanggal: "2026-10-03", target: 480_000_000 },
    { tanggal: "2026-10-10", target: 1_600_000_000 },
  ]);
  assert.equal(ukuran["1.1.5"].sumber, "isian");
  assert.equal(ukuran["1.1.5"].goal, "1.1.5");
  // Baris pendukung dengan satuan lain menjadi ukuran sendiri.
  assert.equal(ukuran["1.1.5-klik"].goal, null);
  assert.equal(ukuran["1.1.5-klik"].sumber, "isian");
  // Total dibaca sebagai rupiah walau kolom satuannya berisi catatan.
  assert.equal(ukuran["1.1"].sumber, "gmv");
  assert.deepEqual(ukuran["1.1"].lingkup, [{ sumberKode: "1.1.3", faktor: 1 }]);

  const agnes = r.lembar.find((l) => l.orang === "Agnes")!;
  assert.equal(agnes.indikator[0].tangga[0], 70);
  assert.equal(agnes.indikator[0].satuan, "%");
  assert.equal(agnes.indikator[1].arah, "turun");
  assert.equal(agnes.indikator[1].satuan, "temuan");
  const raka = r.lembar.find((l) => l.orang === "Raka")!;
  assert.match(raka.indikator[0].nama, /sinirakaspill_ vs target Rp 20 jt/);
});

test("pemetaan: nama yang belum tercantum menghentikan, null dilaporkan dan dilewati", () => {
  const mentah = bacaRencanaGrd(workbook());
  const data = {
    users: [
      { id: "u-siti", nama: "Siti Sa'adah", status: "aktif" },
      { id: "u-agnes", nama: "agneskrimh", status: "aktif" },
    ],
    accounts: [{ id: "a-home", username: "alkahfihome_" }],
    units: [
      { id: "unit-aff", kode: "affiliator" },
      { id: "unit-tap", kode: "tap" },
    ],
    goalLama: [
      { id: "g-lama", judul: "Coba-coba", periode: "26 Sep – 25 Okt 2026" },
      { id: "g-lain", judul: "Lain", periode: "2026-Q3" },
    ],
  };
  const { rencana, laporan } = susunRencana(
    mentah,
    {
      orang: { Siti: "Siti Sa'adah", Agnes: "agneskrimh", Fajar: null },
      akun: { alkahfihome_: "alkahfihome_", taokspill: null },
      hapus_goal_periode: ["26 Sep – 25 Okt 2026"],
    },
    data,
  );

  // Azka, Kholid, Alma, Raka tidak tercantum sama sekali.
  for (const n of ["Azka", "Kholid", "Alma", "Raka"]) {
    assert.ok(
      laporan.belumDipetakan.includes(`orang "${n}"`),
      `${n} seharusnya belum dipetakan`,
    );
  }
  assert.ok(laporan.tidakDitemukan.some((t) => t.includes('"Fajar"')));
  // Goal akun tanpa akun di database dilewati; yang ada tetap masuk.
  assert.ok(rencana.goals.some((g) => g.kode === "1.1.3:alkahfihome_"));
  assert.ok(!rencana.goals.some((g) => g.kode === "1.1.3:taokspill"));
  // Goal milik orang yang belum terdaftar tetap masuk, tanpa pemilik.
  const seller = rencana.goals.find((g) => g.kode === "1.1.5")!;
  assert.equal(seller.pemilik_id, null);
  assert.match(String(seller.keterangan), /PIC: Fajar \(belum terdaftar/);
  // Urutan level: perusahaan lebih dulu, akun paling akhir.
  assert.equal(rencana.goals[0].kode, "1");
  assert.equal(rencana.goals.at(-1)!.level, "account");
  assert.deepEqual(rencana.hapus_goal, ["g-lama"]);
  assert.deepEqual(
    rencana.lembar.map((l) => l.user_id),
    ["u-agnes"],
  );
});
