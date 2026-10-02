#!/usr/bin/env node
/**
 * Acuan uji KPI GRD yang dihitung oleh Excel sendiri.
 *
 * Mesin KPI (migrasi 0187, `src/lib/kpi.ts`) harus menghasilkan angka yang
 * SAMA dengan file GRD. Sheet KPI di file belum berisi PENCAPAIAN, jadi
 * tidak ada hasil hitungan yang bisa dicontoh. Skrip ini membuatnya:
 *
 *   1. `siapkan` — menyalin ke-16 blok KPI dari file GRD (tangga, bobot,
 *      dan rumus VALUE / TOTAL / NILAI / PREDIKAT apa adanya) ke beberapa
 *      sheet skenario, mengisi PENCAPAIAN-nya, dan membuang hasil hitungan
 *      lama, lalu menulis berkas kerja `.tmp/grd/acuan-kpi-2026-10.xlsx`
 *      (lokal, bukan sumber GRD; boleh dihapus setelah `ekstrak`).
 *   2. Berkas itu dibuka di Microsoft Excel lalu disimpan (⌘S). Excel
 *      menghitung ulang rumus file GRD dan menyimpan hasilnya.
 *   3. `ekstrak` — memastikan berkasnya memang terakhir disimpan Excel,
 *      lalu menulis tangga, pencapaian, dan hasil hitungan Excel ke
 *      `docs/grd/acuan-kpi-grd.json`. Hanya angka dan alamat sel; nama
 *      orang dan teks indikator tidak ikut, karena repo ini publik.
 *
 *   Bila Excel tidak bisa menyimpan ke folder repo (sandbox macOS), langkah
 *   2–3 diganti `ekstrak --dari-excel`: berkas dibuka di Excel, dihitung
 *   ulang, dan kolom hasil (VALUE, TOTAL, NILAI, PREDIKAT) dibaca langsung
 *   dari Excel lewat AppleScript — tetap hitungan Excel sendiri.
 *
 * Tes `src/lib/__tes__/kpi-acuan-grd.test.ts` (TypeScript) dan
 * `supabase/tests/kpi-acuan-grd.test.mjs` (SQL) membandingkan mesin
 * aplikasi dengan JSON itu.
 *
 * Pemakaian (dari akar repo):
 *   node scripts/acuan-kpi-grd.mjs siapkan [--sumber=docs/GRD-OKTOBER-2026.xlsx]
 *   node scripts/acuan-kpi-grd.mjs ekstrak [--dari-excel]
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

// Build ESM SheetJS tidak membawa akses berkas; diberikan di sini.
XLSX.set_fs(fs);

const AKAR = path.resolve(import.meta.dirname, "..");
// Satu-satunya sumber GRD Oktober 2026 (lokal; .gitignore — repo publik).
const SUMBER_BAWAAN = "docs/GRD-OKTOBER-2026.xlsx";
const ACUAN_XLSX = ".tmp/grd/acuan-kpi-2026-10.xlsx";
const ACUAN_JSON = "docs/grd/acuan-kpi-grd.json";
const SHEET_KPI = ["KPI Manager (Kholid)", "KPI Leader", "KPI Tim"];
const KOLOM_TANGGA = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

/**
 * Skenario pencapaian. `i` = urutan indikator di seluruh blok, supaya
 * tiap indikator mendapat posisi tangga yang berbeda-beda.
 */
const SKENARIO = [
  {
    kode: "U1",
    arti: "tepat di ambang kolom",
    isi: (t, i) => t[(i * 3 + 3) % 10],
  },
  {
    kode: "U2",
    arti: "sedikit di bawah ambang kolom",
    isi: (t, i, d) => t[(i * 7 + 1) % 10] - d,
  },
  {
    kode: "U3",
    arti: "di antara dua kolom",
    isi: (t, i) => {
      const j = (i * 5) % 9;
      return (t[j] + t[j + 1]) / 2;
    },
  },
  {
    kode: "U4",
    arti: "di bawah kolom 1 atau di atas kolom 10",
    isi: (t, i) => (i % 2 === 0 ? t[0] / 2 : t[9] * 1.5),
  },
  {
    kode: "U5",
    arti: "sebagian kosong, sisanya tepat GOAL",
    isi: (t, i) => (i % 2 === 0 ? null : t[7]),
  },
  {
    kode: "U6",
    arti: "semua kosong (BELUM DIISI)",
    isi: () => null,
  },
  {
    kode: "U7",
    arti: "tinggi: GOAL atau STRETCH (ISTIMEWA)",
    isi: (t, i) => (i % 3 === 0 ? t[7] : t[8]),
  },
];

const argumen = new Map(
  process.argv
    .slice(3)
    .map((a) => /^--([a-z-]+)(?:=(.*))?$/.exec(a))
    .filter(Boolean)
    .map((m) => [m[1], m[2] ?? "true"]),
);

const sel = (ws, alamat) => ws[alamat];
const nilaiSel = (ws, alamat) => ws[alamat]?.v;

/** Blok KPI di satu sheet: baris judul kolom, baris indikator, baris hasil. */
function cariBlok(ws) {
  const rentang = XLSX.utils.decode_range(ws["!ref"]);
  const blok = [];
  for (let r = rentang.s.r + 1; r <= rentang.e.r + 1; r += 1) {
    if (nilaiSel(ws, `B${r}`) !== "Indicator" || nilaiSel(ws, `C${r}`) !== 1)
      continue;

    const indikator = [];
    let b = r + 1;
    for (; nilaiSel(ws, `F${b}`) !== "BASE"; b += 1) {
      if (typeof nilaiSel(ws, `C${b}`) === "number") indikator.push(b);
      if (b > r + 30) throw new Error(`Blok di baris ${r} tidak berujung BASE`);
    }
    // NILAI dan PREDIKAT ada di dua baris setelah baris BASE.
    const nilai = b + 1;
    const predikat = b + 2;
    if (nilaiSel(ws, `M${nilai}`) !== "NILAI KPI (maks 1.000)")
      throw new Error(`Baris NILAI blok ${r} tidak ditemukan`);
    if (nilaiSel(ws, `M${predikat}`) !== "PREDIKAT")
      throw new Error(`Baris PREDIKAT blok ${r} tidak ditemukan`);

    blok.push({ judul: r, indikator, nilai, predikat });
  }
  return blok;
}

function siapkan() {
  const sumber = path.join(AKAR, argumen.get("sumber") ?? SUMBER_BAWAAN);
  if (!existsSync(sumber)) {
    console.error(`File GRD tidak ditemukan: ${path.relative(AKAR, sumber)}`);
    process.exit(1);
  }

  const asal = XLSX.readFile(sumber, { cellFormula: true, cellNF: true });
  const baru = XLSX.utils.book_new();
  let jumlahBlok = 0;
  let jumlahIndikator = 0;

  for (const { kode, arti } of SKENARIO) {
    let i = 0;
    for (const nama of SHEET_KPI) {
      const ws = structuredClone(asal.Sheets[nama]);
      if (!ws) throw new Error(`Sheet "${nama}" tidak ada di file GRD`);

      for (const b of cariBlok(ws)) {
        if (kode === "U1") jumlahBlok += 1;
        for (const r of b.indikator) {
          if (kode === "U1") jumlahIndikator += 1;
          const t = KOLOM_TANGGA.map((k) => Number(nilaiSel(ws, `${k}${r}`)));
          const persen = /%/.test(sel(ws, `C${r}`).z ?? "");
          // Selisih "sedikit di bawah": 0,01 poin persen, atau 0,01 satuan.
          const d = persen ? 0.0001 : 0.01;
          const isi = SKENARIO.find((s) => s.kode === kode).isi(t, i, d);
          i += 1;

          const alamat = `M${r}`;
          if (isi === null) delete ws[alamat];
          else ws[alamat] = { t: "n", v: Number(isi.toFixed(10)) };
        }
      }

      // Hasil hitungan lama dibuang: yang tersimpan nanti harus hasil Excel.
      for (const [alamat, c] of Object.entries(ws)) {
        if (!alamat.startsWith("!") && c?.f) {
          delete c.v;
          delete c.w;
          c.t = "n";
        }
      }

      const namaBaru = `${kode} ${nama.replace(" (Kholid)", "")}`.slice(0, 31);
      XLSX.utils.book_append_sheet(baru, ws, namaBaru);
    }
    console.log(`  · ${kode}: ${arti}`);
  }

  // Asal file GRD ikut tersimpan (Subject) supaya JSON-nya bisa dilacak.
  baru.Props = { Subject: path.relative(AKAR, sumber) };
  const keluaran = path.join(AKAR, ACUAN_XLSX);
  mkdirSync(path.dirname(keluaran), { recursive: true });
  XLSX.writeFile(baru, keluaran);
  console.log(
    `\n✓ ${ACUAN_XLSX}: ${SKENARIO.length} skenario × ${jumlahBlok} blok KPI ` +
      `(${jumlahIndikator} indikator per skenario).`,
  );
  console.log(
    "\nLangkah berikutnya: buka berkas itu di Microsoft Excel, simpan (⌘S),\n" +
      "tutup, lalu jalankan:\n  node scripts/acuan-kpi-grd.mjs ekstrak",
  );
}

const PREDIKAT = {
  ISTIMEWA: "Istimewa",
  BAIK: "Baik",
  CUKUP: "Cukup",
  "PERLU PERBAIKAN": "Perlu Perbaikan",
  "BELUM DIISI": null,
};

/**
 * Hasil hitungan langsung dari Excel yang membuka berkas kerja: kolom N–P
 * tiap sheet (VALUE, BOBOT/PREDIKAT, TOTAL/NILAI) dibaca lewat AppleScript
 * dan menimpa sel yang sama di salinan SheetJS. Mengembalikan nama dan
 * versi Excel yang menghitung.
 */
function bacaHitunganExcel(wb, berkas) {
  const nama = path.basename(berkas);
  const as = (skrip) =>
    execFileSync("osascript", ["-s", "s", "-e", skrip], {
      encoding: "utf8",
    }).trim();
  const terbuka = () =>
    as(`tell application "Microsoft Excel" to exists workbook "${nama}"`) ===
    "true";
  if (!terbuka()) {
    execFileSync("open", ["-g", "-a", "Microsoft Excel", berkas]);
    for (let i = 0; i < 30 && !terbuka(); i += 1) execFileSync("sleep", ["1"]);
    if (!terbuka()) throw new Error(`Excel tidak membuka ${nama}`);
  }

  const baris = Math.max(
    ...wb.SheetNames.map(
      (n) => XLSX.utils.decode_range(wb.Sheets[n]["!ref"]).e.r + 1,
    ),
  );
  // Bentuk sumber AppleScript ({…}, "…") cukup diubah kurungnya jadi JSON.
  const keluaran = as(`tell application "Microsoft Excel"
    calculate full
    set wb to workbook "${nama}"
    set hasil to {}
    repeat with i from 1 to (count of worksheets of wb)
      set ws to worksheet i of wb
      set end of hasil to {name of ws, value of range "N1:P${baris}" of ws}
    end repeat
    return {version, hasil}
  end tell`);
  const [versi, lembar] = JSON.parse(
    keluaran.replaceAll("{", "[").replaceAll("}", "]"),
  );
  for (const [namaSheet, isi] of lembar) {
    const ws = wb.Sheets[namaSheet];
    isi.forEach((barisSel, i) =>
      barisSel.forEach((v, j) => {
        const alamat = `${"NOP"[j]}${i + 1}`;
        if (v === "") delete ws[alamat];
        else ws[alamat] = typeof v === "number" ? { t: "n", v } : { t: "s", v };
      }),
    );
  }

  try {
    as(
      `tell application "Microsoft Excel" to close workbook "${nama}" saving no`,
    );
  } catch {
    console.warn(`(Tutup ${nama} di Excel tanpa menyimpan.)`);
  }
  return `Microsoft Excel ${versi}`;
}

function ekstrak() {
  const berkas = path.join(AKAR, ACUAN_XLSX);
  if (!existsSync(berkas)) {
    console.error(
      `${ACUAN_XLSX} belum ada; jalankan dulu: node scripts/acuan-kpi-grd.mjs siapkan`,
    );
    process.exit(1);
  }

  const wb = XLSX.readFile(berkas, { cellFormula: true, cellNF: true });
  const aplikasi =
    argumen.get("dari-excel") === "true"
      ? bacaHitunganExcel(wb, berkas)
      : (wb.Props?.Application ?? "");
  if (!/Microsoft.*Excel/i.test(aplikasi)) {
    console.error(
      `Berkas terakhir disimpan oleh "${aplikasi || "tidak diketahui"}", bukan Microsoft Excel.\n` +
        "Buka di Excel, simpan (⌘S), lalu ulangi — hasil rumusnya harus hitungan Excel.",
    );
    process.exit(1);
  }

  const blok = [];
  for (const nama of wb.SheetNames) {
    const ws = wb.Sheets[nama];
    const [kode] = nama.split(" ");
    for (const b of cariBlok(ws)) {
      const indikator = b.indikator.map((r) => {
        const angka = (alamat) => {
          const v = nilaiSel(ws, alamat);
          if (typeof v !== "number")
            throw new Error(
              `${nama}!${alamat} tidak berisi hasil hitungan Excel`,
            );
          return v;
        };
        const m = nilaiSel(ws, `M${r}`);
        return {
          sel: `${nama}!B${r}`,
          persen: /%/.test(sel(ws, `C${r}`).z ?? ""),
          tangga: KOLOM_TANGGA.map((k) => angka(`${k}${r}`)),
          bobot: angka(`O${r}`),
          pencapaian: typeof m === "number" ? m : null,
          value: angka(`N${r}`),
          total: angka(`P${r}`),
        };
      });

      const teksPredikat = nilaiSel(ws, `O${b.predikat}`);
      if (!(teksPredikat in PREDIKAT))
        throw new Error(
          `${nama}!O${b.predikat} berisi predikat tak dikenal: ${teksPredikat}`,
        );

      blok.push({
        skenario: kode,
        sel: `${nama}!A${b.judul - 3}`,
        nilai: nilaiSel(ws, `P${b.nilai}`),
        predikat: PREDIKAT[teksPredikat],
        indikator,
      });
    }
  }

  // Sel NILAI yang tidak terhitung berarti Excel belum menghitung ulang.
  const takTerhitung = blok.filter((b) => typeof b.nilai !== "number");
  if (takTerhitung.length > 0)
    throw new Error(
      `NILAI belum terhitung di: ${takTerhitung.map((b) => b.sel).join(", ")}`,
    );

  const isi = {
    _catatan:
      "Dihasilkan scripts/acuan-kpi-grd.mjs dari file GRD Oktober 2026 yang dihitung ulang " +
      "Microsoft Excel. Hanya angka; jangan disunting tangan.",
    sumber: wb.Props?.Subject ?? "",
    aplikasi,
    skenario: Object.fromEntries(SKENARIO.map((s) => [s.kode, s.arti])),
    blok,
  };
  writeFileSync(
    path.join(AKAR, ACUAN_JSON),
    JSON.stringify(isi, null, 2) + "\n",
  );

  const indikator = blok.reduce((a, b) => a + b.indikator.length, 0);
  const sebaran = blok.reduce((a, b) => {
    const k = b.predikat ?? "BELUM DIISI";
    a[k] = (a[k] ?? 0) + 1;
    return a;
  }, {});
  console.log(
    `✓ ${ACUAN_JSON}: ${blok.length} blok, ${indikator} indikator (hitungan ${aplikasi}).`,
  );
  console.log(`  Sebaran predikat: ${JSON.stringify(sebaran)}`);
}

const perintah = process.argv[2];
if (perintah === "siapkan") siapkan();
else if (perintah === "ekstrak") ekstrak();
else {
  console.error("Pemakaian: node scripts/acuan-kpi-grd.mjs siapkan|ekstrak");
  process.exit(2);
}
