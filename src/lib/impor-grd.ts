/**
 * Pembaca file GRD (Excel) menjadi rencana impor — modul murni.
 *
 * Masukannya lembar SheetJS (objek alamat → sel), keluarannya rencana
 * berisi NAMA orang dan akun seperti tertulis di file. Pemetaan nama ke
 * id database, beserta penerapannya, dikerjakan `scripts/impor-grd.mjs`
 * dan fungsi `impor_grd` (0190).
 *
 * Bagian file ditemukan lewat labelnya ("GOAL MANAGER", "DEPARTEMEN …",
 * "B. KURVA MINGGUAN", blok "Indicator"), bukan alamat sel tetap, supaya
 * file bulan berikutnya dengan templat yang sama tetap terbaca. Angka
 * diambil apa adanya; persen ditulis 0–100 seperti di aplikasi.
 */
import { pecahanKePersen } from "@/lib/kpi";

export type Sel = { v?: unknown; z?: string; f?: string };
export type LembarXlsx = Record<string, unknown>;

export type JenisGmv = "semua" | "live" | "video";
export type KodeUnit = "affiliator" | "mcn" | "tap";

export type GoalMentah = {
  kode: string;
  judul: string;
  level: "company" | "manager" | "leader" | "account" | "staff";
  induk: string | null;
  /** Nama orang seperti di file, mis. "Siti". */
  pemilik: string | null;
  unit: KodeUnit | null;
  /** Username akun seperti di file, untuk goal akun. */
  akun: string | null;
  satuan: string;
  base: number | null;
  target: number;
  tenggat: string;
  jenisRealisasi: "gmv" | "isian";
  keterangan: string;
  status: "aktif" | "draft";
};

export type LingkupMentah =
  | { akun: string; jenisGmv: JenisGmv; faktor: 1 | -1 }
  | { unit: KodeUnit; jenisGmv: JenisGmv; faktor: 1 | -1 }
  | { sumberKode: string; faktor: 1 | -1 };

export type UkuranMentah = {
  kode: string;
  judul: string;
  satuan: string;
  sumber: "gmv" | "isian";
  goal: string | null;
  pic: string | null;
  picTeks: string;
  urutan: number;
  lingkup: LingkupMentah[];
  titik: { tanggal: string; target: number }[];
};

export type IndikatorMentah = {
  urutan: number;
  nama: string;
  satuan: string;
  bobot: number;
  arah: "naik" | "turun";
  tangga: number[];
  asal: string;
};

export type LembarMentah = {
  orang: string;
  judul: string;
  status: "aktif" | "draft";
  asal: string;
  indikator: IndikatorMentah[];
};

export type RencanaMentah = {
  periode: string;
  periodeLabel: string;
  goals: GoalMentah[];
  ukuran: UkuranMentah[];
  lembar: LembarMentah[];
  /** Hal yang dilewati pembaca beserta alasannya. */
  catatan: string[];
};

// ---------------------------------------------------------------------
// Pembantu sel
// ---------------------------------------------------------------------
const KOLOM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function sel(ws: LembarXlsx, alamat: string): Sel | undefined {
  return ws[alamat] as Sel | undefined;
}

export function nilai(ws: LembarXlsx, alamat: string): unknown {
  return sel(ws, alamat)?.v;
}

function teks(ws: LembarXlsx, alamat: string): string {
  const v = nilai(ws, alamat);
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

function persenSel(ws: LembarXlsx, alamat: string): boolean {
  return /%/.test(sel(ws, alamat)?.z ?? "");
}

function barisTerakhir(ws: LembarXlsx): number {
  const ref = String(ws["!ref"] ?? "A1:A1");
  const m = /:([A-Z]+)(\d+)$/.exec(ref);
  return m ? Number(m[2]) : 1;
}

/** Angka sel; persen ditulis 0–100 seperti di aplikasi. */
function angkaSel(ws: LembarXlsx, alamat: string): number | null {
  const v = nilai(ws, alamat);
  if (typeof v !== "number") return null;
  return persenSel(ws, alamat) ? pecahanKePersen(v) : v;
}

// ---------------------------------------------------------------------
// Pembaca teks
// ---------------------------------------------------------------------
const BULAN: Record<string, number> = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  agu: 8,
  sep: 9,
  okt: 10,
  nov: 11,
  des: 12,
};

/** "32,2 M" → 32.200.000.000; "150 jt" → 150.000.000; angka apa adanya. */
export function bacaRupiahTeks(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const m = /^\s*(?:Rp\s*)?([\d.,]+)\s*(M|jt|juta|rb|ribu)?\s*$/i.exec(v);
  if (!m) return null;
  const angka = Number(m[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(angka)) return null;
  const pengali: Record<string, number> = {
    m: 1e9,
    jt: 1e6,
    juta: 1e6,
    rb: 1e3,
    ribu: 1e3,
  };
  const hasil = angka * (m[2] ? pengali[m[2].toLowerCase()] : 1);
  return Math.round(hasil * 100) / 100;
}

/** Tanggal "YYYY-MM-DD" tanpa geser zona waktu. */
function tanggal(tahun: number, bulan: number, hari: number): string {
  return `${tahun}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
}

export function akhirBulanIso(periode: string): string {
  const [t, b] = periode.split("-").map(Number);
  return tanggal(t, b, new Date(Date.UTC(t, b, 0)).getUTCDate());
}

/**
 * Tenggat dari rumusan "… pada 17 Oktober 2026" — tanggal lengkap terakhir
 * yang disebut. "pada Oktober 2026" (tanpa hari) berarti akhir bulan.
 */
export function bacaTenggat(rumusan: string, periode: string): string {
  const semua = [
    ...rumusan.matchAll(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/g),
  ].filter((m) => BULAN[m[2].toLowerCase()]);
  const akhir = semua.at(-1);
  if (akhir) {
    return tanggal(
      Number(akhir[3]),
      BULAN[akhir[2].toLowerCase()],
      Number(akhir[1]),
    );
  }
  return akhirBulanIso(periode);
}

/** "1.1.3 — Menaikkan …" → { kode: "1.1.3", judul: "Menaikkan …" }. */
export function pisahKode(rumusan: string): {
  kode: string | null;
  judul: string;
} {
  const m = /^\s*([0-9S]+(?:\.[0-9]+)*)\s+—\s+([\s\S]+)$/.exec(rumusan);
  return m
    ? { kode: m[1], judul: m[2].trim() }
    : { kode: null, judul: rumusan.trim() };
}

/** Satuan file → satuan aplikasi: "Rupiah"/"Rp" → "IDR". */
export function satuanAplikasi(satuan: string): string {
  const s = satuan.trim();
  if (/^(rupiah|rp)$/i.test(s)) return "IDR";
  return s || "unit";
}

/** Induk sebuah kode GRD: "1.1.3" → "1.1"; "1" tidak berinduk. */
export function indukKode(kode: string): string | null {
  const bagian = kode.split(".");
  return bagian.length > 1 ? bagian.slice(0, -1).join(".") : null;
}

const UNIT_DEPARTEMEN: Record<string, KodeUnit> = {
  AFFILIATOR: "affiliator",
  "MABIT SCHOLAR": "affiliator",
  TAP: "tap",
  MCN: "mcn",
  MMC: "mcn",
};

/** Kata pertama yang berupa nama: "Siti (Leader Affiliator)" → "Siti". */
export function namaPertama(t: string): string | null {
  const m = /^\s*([A-Za-z][A-Za-z.'_]*)/.exec(t);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------
// Sheet GOAL
// ---------------------------------------------------------------------
function bacaGoalSheet(ws: LembarXlsx, catatan: string[]) {
  const akhir = barisTerakhir(ws);
  let periode: string | null = null;
  let periodeLabel = "";
  let bagian: "perusahaan" | "planning" | "manager" | "leader" | "staf" | null =
    null;
  let departemen: { unit: KodeUnit; leader: string | null } | null = null;
  let stafPemilik: string | null = null;
  const goals: GoalMentah[] = [];
  let rumusanPerusahaan: string | null = null;

  for (let r = 1; r <= akhir; r += 1) {
    const b = teks(ws, `B${r}`);
    const judulPeriode = /^GOAL ([A-Za-z]+) (\d{4})$/.exec(b);
    if (judulPeriode && BULAN[judulPeriode[1].toLowerCase()]) {
      const bln = BULAN[judulPeriode[1].toLowerCase()];
      periode = tanggal(Number(judulPeriode[2]), bln, 1);
      periodeLabel = `${judulPeriode[1][0]}${judulPeriode[1].slice(1).toLowerCase()} ${judulPeriode[2]}`;
      bagian = "perusahaan";
      continue;
    }
    if (b === "PLANNING") {
      bagian = "planning";
      continue;
    }
    if (b === "GOAL MANAGER") {
      bagian = "manager";
      continue;
    }
    if (b.startsWith("GOAL LEADER")) {
      bagian = "leader";
      continue;
    }
    if (b.startsWith("GOAL STAF PENDUKUNG")) {
      bagian = "staf";
      continue;
    }
    if (b.startsWith("CEK PATUNGAN")) {
      bagian = null;
      continue;
    }

    const dep = /^DEPARTEMEN (.+?) — Leader: ([A-Za-z]+)/.exec(b);
    if (dep) {
      const unit = UNIT_DEPARTEMEN[dep[1].trim()];
      if (!unit)
        catatan.push(`Departemen "${dep[1]}" tidak dikenal (baris ${r}).`);
      departemen = unit ? { unit, leader: dep[2] } : null;
      continue;
    }
    const staf = /^(TATA KELOLA|SEKRETARIAT) — ([A-Za-z]+)/.exec(b);
    if (staf) {
      stafPemilik = staf[2];
      continue;
    }

    if (!periode || typeof nilai(ws, `B${r}`) !== "number") continue;
    const c = teks(ws, `C${r}`);
    const satuan = satuanAplikasi(teks(ws, `G${r}`));
    const ket = teks(ws, `H${r}`);
    const target =
      satuan === "IDR"
        ? bacaRupiahTeks(nilai(ws, `D${r}`))
        : angkaSel(ws, `D${r}`);
    const baseMentah = nilai(ws, `F${r}`);
    const base =
      typeof baseMentah === "number" || satuan === "IDR"
        ? satuan === "IDR"
          ? bacaRupiahTeks(baseMentah)
          : angkaSel(ws, `F${r}`)
        : null;

    if (bagian === "planning") {
      if (Number(nilai(ws, `B${r}`)) === 1 && c) rumusanPerusahaan = c;
      continue;
    }
    if (target === null) {
      if (bagian)
        catatan.push(`Baris ${r} sheet GOAL tanpa target angka, dilewati.`);
      continue;
    }

    const umum = {
      satuan,
      base,
      target,
      keterangan: ket,
      jenisRealisasi: (satuan === "IDR" ? "gmv" : "isian") as "gmv" | "isian",
      status: "aktif" as const,
      akun: null,
    };

    if (bagian === "perusahaan") {
      goals.push({
        ...umum,
        kode: "1",
        judul: c,
        level: "company",
        induk: null,
        pemilik: "Azka",
        unit: null,
        tenggat: akhirBulanIso(periode),
      });
    } else if (bagian === "manager") {
      const kode = `1.${Number(nilai(ws, `B${r}`))}`;
      goals.push({
        ...umum,
        kode,
        judul: c,
        level: "manager",
        induk: "1",
        pemilik: "Kholid",
        unit: null,
        tenggat: bacaTenggat(c, periode),
      });
    } else if (bagian === "leader" || bagian === "staf") {
      const { kode, judul } = pisahKode(c);
      if (!kode) {
        catatan.push(`Goal baris ${r} tanpa kode GRD, dilewati.`);
        continue;
      }
      goals.push({
        ...umum,
        kode,
        judul,
        level: bagian === "leader" ? "leader" : "staff",
        induk: bagian === "leader" ? indukKode(kode) : "1",
        pemilik:
          bagian === "leader" ? (departemen?.leader ?? null) : stafPemilik,
        unit: bagian === "leader" ? (departemen?.unit ?? null) : null,
        tenggat: bacaTenggat(judul, periode),
      });
    }
  }

  if (!periode)
    throw new Error('Sheet GOAL tidak berisi judul "GOAL <BULAN> <TAHUN>".');

  // Rumusan lengkap goal perusahaan ada di bagian PLANNING.
  const perusahaan = goals.find((g) => g.kode === "1");
  if (perusahaan && rumusanPerusahaan) perusahaan.judul = rumusanPerusahaan;

  return { periode, periodeLabel, goals };
}

// ---------------------------------------------------------------------
// Sheet Target & Kurva WRM
// ---------------------------------------------------------------------
type AkunTarget = {
  goalKode: string;
  jenis: JenisGmv;
  akun: string | null;
  pemegang: string;
  baris: number;
};

function bacaTargetAkun(
  ws: LembarXlsx,
  periode: string,
  goalInduk: Map<string, GoalMentah>,
  catatan: string[],
) {
  const akhir = barisTerakhir(ws);
  const goals: GoalMentah[] = [];
  const akun: AkunTarget[] = [];
  let usulan = false;
  let bagian: { goalKode: string; jenis: JenisGmv } | null = null;

  for (let r = 1; r <= akhir; r += 1) {
    const b = teks(ws, `B${r}`);
    if (/^A\. TARGET PER AKUN/.test(b)) {
      usulan = /usulan/i.test(b);
      continue;
    }
    if (/^B\. KURVA/.test(b)) break;
    const sec = /Goal (\d+(?:\.\d+)+)/.exec(b);
    if (
      sec &&
      !b.startsWith("TOTAL") &&
      typeof nilai(ws, `F${r}`) !== "number"
    ) {
      const jenis: JenisGmv = /di luar LIVE/i.test(b)
        ? "video"
        : /^LIVE\b/.test(b)
          ? "live"
          : "semua";
      bagian = { goalKode: sec[1], jenis };
      continue;
    }
    if (
      !bagian ||
      b.startsWith("TOTAL") ||
      typeof nilai(ws, `F${r}`) !== "number"
    )
      continue;

    const pemegang = teks(ws, `C${r}`);
    const nama = b.replace(/^LIVE\s+/, "");
    const tanpaUsername = /^Akun\s+\d+K/i.test(nama);
    const username = tanpaUsername ? null : nama;
    const induk = goalInduk.get(bagian.goalKode);
    if (!induk) {
      catatan.push(
        `Target akun baris ${r}: goal ${bagian.goalKode} tidak ditemukan.`,
      );
      continue;
    }

    const label = username ?? `${nama} ${namaPertama(pemegang) ?? ""}`.trim();
    const jenisTeks =
      bagian.jenis === "live"
        ? "LIVE"
        : bagian.jenis === "video"
          ? "di luar LIVE"
          : "";
    const level = teks(ws, `D${r}`);
    const video = nilai(ws, `H${r}`);
    goals.push({
      kode: `${bagian.goalKode}:${username ?? namaPertama(pemegang) ?? `baris${r}`}`,
      judul: `Target GMV ${label}${jenisTeks ? ` ${jenisTeks}` : ""}`,
      level: "account",
      induk: bagian.goalKode,
      pemilik: null,
      unit: induk.unit,
      akun: username,
      satuan: "IDR",
      base: angkaSel(ws, `E${r}`),
      target: angkaSel(ws, `F${r}`) as number,
      tenggat: akhirBulanIso(periode),
      jenisRealisasi: "gmv",
      keterangan: [
        `Pemegang: ${pemegang}`,
        level ? `level ${level}` : "",
        typeof video === "number" || (typeof video === "string" && video)
          ? `target video/hari ${video}`
          : "",
        teks(ws, `K${r}`),
      ]
        .filter(Boolean)
        .join(" · "),
      status: usulan ? "draft" : "aktif",
    });
    akun.push({
      goalKode: bagian.goalKode,
      jenis: bagian.jenis,
      akun: username,
      pemegang,
      baris: r,
    });
  }

  return { goals, akun };
}

/** Kode ukuran baris kurva: goal itu sendiri, atau ukuran tambahan. */
function kodeUkuranKurva(
  label: string,
  satuanKurva: string,
  goalPerKode: Map<string, GoalMentah>,
): { kode: string; goal: string | null } | null {
  if (/^TOTAL GMV INTERNAL/i.test(label)) return { kode: "1.1", goal: "1.1" };
  if (/^TOTAL GMV EKSTERNAL/i.test(label)) return { kode: "1.2", goal: "1.2" };
  if (/^TOTAL GMV AL-KAHFI/i.test(label)) return { kode: "1", goal: "1" };
  const m = /^(\d+(?:\.\d+)+)\s+(\S+)/.exec(label);
  if (!m) return null;
  const goal = goalPerKode.get(m[1]);
  if (goal && goal.satuan === satuanKurva) return { kode: m[1], goal: m[1] };
  // Baris pendukung goal itu dengan satuan lain (klik, pendaftar, GMV
  // creator baru, pemakai studio): ukuran tersendiri tanpa goal.
  const slug = m[2]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12);
  return { kode: `${m[1]}-${slug}`, goal: null };
}

function satuanKurva(k: string): string {
  return /^rp$/i.test(k.trim()) ? "IDR" : k.trim();
}

/** Lingkup khusus yang rumusnya tertulis di keterangan file, bukan sel. */
const LINGKUP_KHUSUS: Record<string, LingkupMentah[]> = {
  // GAP §9 no. 8: creator existing = GMV unit MCN − GMV creator besar baru.
  "1.2.2": [
    { unit: "mcn", jenisGmv: "semua", faktor: 1 },
    { sumberKode: "1.2.1-gmv", faktor: -1 },
  ],
  // "TOTAL GMV EKSTERNAL (creator existing + creator besar baru)".
  "1.2": [
    { sumberKode: "1.2.2", faktor: 1 },
    { sumberKode: "1.2.1-gmv", faktor: 1 },
  ],
  // "TOTAL GMV AL-KAHFI CORP" = total internal + total eksternal.
  "1": [
    { sumberKode: "1.1", faktor: 1 },
    { sumberKode: "1.2", faktor: 1 },
  ],
};

function bacaKurva(
  ws: LembarXlsx,
  periode: string,
  goalPerKode: Map<string, GoalMentah>,
  catatan: string[],
): UkuranMentah[] {
  const akhir = barisTerakhir(ws);
  let mulai = 0;
  for (let r = 1; r <= akhir; r += 1) {
    if (/^B\. KURVA/.test(teks(ws, `B${r}`))) {
      mulai = r;
      break;
    }
  }
  if (!mulai) {
    catatan.push("Bagian B. KURVA MINGGUAN tidak ditemukan.");
    return [];
  }

  // Baris judul kolom: "Sab 3 Okt", "Sab 10 Okt", …
  const [tahun, bulan] = periode.split("-").map(Number);
  let kolomTitik: { kolom: string; tanggal: string }[] = [];
  for (let r = mulai; r <= mulai + 3 && kolomTitik.length === 0; r += 1) {
    kolomTitik = [...KOLOM]
      .map((k) => ({ k, t: teks(ws, `${k}${r}`) }))
      .map(({ k, t }) => ({ k, m: /^Sab\s+(\d{1,2})\s+([A-Za-z]+)/.exec(t) }))
      .filter((x) => x.m)
      .map(({ k, m }) => ({
        kolom: k,
        tanggal: tanggal(
          tahun,
          BULAN[m![2].toLowerCase()] ?? bulan,
          Number(m![1]),
        ),
      }));
  }

  const ukuran: UkuranMentah[] = [];
  for (let r = mulai; r <= akhir; r += 1) {
    if (teks(ws, `D${r}`) !== "TARGET") continue;
    const label = teks(ws, `B${r}`);
    // Baris TOTAL memakai kolom K untuk catatan, bukan satuan: selalu rupiah.
    const satuan = /^TOTAL GMV/i.test(label)
      ? "IDR"
      : satuanKurva(teks(ws, `K${r}`) || "Rp");
    const kode = kodeUkuranKurva(label, satuan, goalPerKode);
    if (!kode) {
      catatan.push(`Baris kurva ${r} ("${label}") tidak dikenali, dilewati.`);
      continue;
    }
    const pic = teks(ws, `C${r}`);
    ukuran.push({
      kode: kode.kode,
      judul: label.replace(/^\d+(?:\.\d+)+\s+/, ""),
      satuan,
      sumber: "gmv",
      goal: kode.goal,
      pic: namaPertama(pic),
      picTeks: pic,
      urutan: r,
      lingkup: [],
      titik: kolomTitik
        .map(({ kolom, tanggal: t }) => ({
          tanggal: t,
          target: nilai(ws, `${kolom}${r}`),
        }))
        .filter(
          (x): x is { tanggal: string; target: number } =>
            typeof x.target === "number",
        ),
    });
  }
  return ukuran;
}

// ---------------------------------------------------------------------
// Sheet KPI
// ---------------------------------------------------------------------
const KOLOM_TANGGA = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

/** Satuan indikator dari rumusannya: "— jumlah seller" → "seller". */
export function satuanIndikator(nama: string, persen: boolean): string {
  if (persen) return "%";
  const jumlah = /—\s*(?:isi\s+)?jumlah\s+([A-Za-z]+)/i.exec(nama);
  if (jumlah)
    return jumlah[1].toLowerCase() === "sop" ? "SOP" : jumlah[1].toLowerCase();
  if (/rata-rata video/i.test(nama)) return "video/hari";
  if (/rata-rata produk/i.test(nama)) return "produk/hari";
  return "angka";
}

type BlokKpi = { judul: string; baris: number; indikator: number[] };

function cariBlokKpi(ws: LembarXlsx): BlokKpi[] {
  const akhir = barisTerakhir(ws);
  const blok: BlokKpi[] = [];
  for (let r = 1; r <= akhir; r += 1) {
    if (teks(ws, `B${r}`) !== "Indicator" || nilai(ws, `C${r}`) !== 1) continue;
    // Judul blok: baris "KPI …" terdekat di atasnya.
    let judul = "";
    for (let j = r - 1; j >= Math.max(1, r - 6); j -= 1) {
      if (/^(KPI|KEY PERFORMANCE INDICATOR) /.test(teks(ws, `A${j}`))) {
        judul = teks(ws, `A${j}`);
        break;
      }
    }
    const indikator: number[] = [];
    for (let b = r + 1; teks(ws, `F${b}`) !== "BASE" && b <= r + 30; b += 1) {
      if (typeof nilai(ws, `C${b}`) === "number") indikator.push(b);
    }
    blok.push({ judul, baris: r, indikator });
  }
  return blok;
}

function bacaIndikator(
  ws: LembarXlsx,
  sheet: string,
  baris: number[],
): IndikatorMentah[] {
  return baris.map((r) => {
    const nama = teks(ws, `B${r}`);
    const persen = persenSel(ws, `C${r}`);
    const tangga = KOLOM_TANGGA.map((k) => angkaSel(ws, `${k}${r}`) as number);
    const naik = tangga.every((t, i) => i === 0 || tangga[i - 1] <= t);
    return {
      urutan: Number(nilai(ws, `A${r}`)),
      nama,
      satuan: satuanIndikator(nama, persen),
      bobot: Number(nilai(ws, `O${r}`)),
      arah: naik ? "naik" : "turun",
      tangga,
      asal: `${sheet}!B${r}`,
    };
  });
}

/** Tabel referensi templat: "Raka · sinirakaspill_ | 20000000 | 7 video/hari". */
function tabelReferensi(ws: LembarXlsx, setelah: number) {
  const akhir = barisTerakhir(ws);
  const hasil: {
    orang: string;
    akun: string;
    target: number | null;
    video: string;
  }[] = [];
  let mulai = 0;
  for (let r = setelah; r <= akhir; r += 1) {
    if (/^TABEL REFERENSI/.test(teks(ws, `A${r}`))) {
      mulai = r + 2;
      break;
    }
    if (r > setelah && /^KPI /.test(teks(ws, `A${r}`))) break;
  }
  if (!mulai) return hasil;
  for (let r = mulai; typeof nilai(ws, `A${r}`) === "number"; r += 1) {
    const [orang, akun] = teks(ws, `B${r}`)
      .split("·")
      .map((x) => x.trim());
    hasil.push({
      orang,
      akun: akun ?? "",
      target: angkaSel(ws, `C${r}`),
      video: teks(ws, `F${r}`),
    });
  }
  return hasil;
}

function rupiahPendek(n: number): string {
  return n >= 1e9
    ? `Rp ${(n / 1e9).toLocaleString("id-ID")} M`
    : `Rp ${(n / 1e6).toLocaleString("id-ID")} jt`;
}

function bacaKpi(
  workbook: { Sheets: Record<string, LembarXlsx> },
  catatan: string[],
): LembarMentah[] {
  const lembar: LembarMentah[] = [];

  for (const sheet of ["KPI Manager (Kholid)", "KPI Leader", "KPI Tim"]) {
    const ws = workbook.Sheets[sheet];
    if (!ws) {
      catatan.push(`Sheet "${sheet}" tidak ada.`);
      continue;
    }
    for (const blok of cariBlokKpi(ws)) {
      const indikator = bacaIndikator(ws, sheet, blok.indikator);
      const bobot = indikator.reduce((a, i) => a + i.bobot, 0);
      if (bobot !== 100) {
        catatan.push(`${sheet} "${blok.judul}": bobot ${bobot}, bukan 100.`);
      }
      // Usulan: judul atau baris keterangan di bawahnya menyebut "USULAN".
      const usulan = [blok.baris - 4, blok.baris - 3, blok.baris - 2].some(
        (r) => /USULAN/.test(teks(ws, `A${r}`)),
      );

      if (/TEMPLATE/.test(blok.judul)) {
        const ref = tabelReferensi(ws, blok.baris);
        if (ref.length === 0) {
          catatan.push(
            `Templat "${blok.judul}" tanpa tabel referensi: tidak ada orang yang bisa diberi lembar.`,
          );
          continue;
        }
        for (const o of ref) {
          lembar.push({
            orang: o.orang,
            judul: `${blok.judul.replace(/\s*—\s*TEMPLATE.*$/, "")} — ${o.orang}`,
            status: usulan ? "draft" : "aktif",
            asal: `${sheet}!A${blok.baris} · ${o.orang}`,
            indikator: indikator.map((i) => {
              // Templat dipersonalkan tanpa mengubah angka: target akunnya
              // dan standar videonya disebut di nama indikator.
              let nama = i.nama;
              // Templat santri menulis level ("L3") di tempat username.
              const akun =
                o.akun && !/\s/.test(o.akun) && !/^L\d+$/.test(o.akun)
                  ? o.akun
                  : o.orang;
              if (o.target !== null && /^GMV akun/.test(nama)) {
                nama = `GMV akun ${akun} vs target ${rupiahPendek(o.target)} — % realisasi`;
              } else if (o.video && /standar video/i.test(nama)) {
                nama = `${nama.replace(/\s*\(.*?\)/, "")} (${o.video})`;
              }
              return { ...i, nama };
            }),
          });
        }
        continue;
      }

      const orang = /—\s*([A-Za-z]+)/.exec(blok.judul)?.[1];
      if (!orang) {
        catatan.push(`Blok "${blok.judul}" tanpa nama orang, dilewati.`);
        continue;
      }
      lembar.push({
        orang: orang[0] + orang.slice(1).toLowerCase(),
        judul: blok.judul,
        status: usulan ? "draft" : "aktif",
        asal: `${sheet}!A${blok.baris}`,
        indikator,
      });
    }
  }
  return lembar;
}

// ---------------------------------------------------------------------
// Rencana lengkap
// ---------------------------------------------------------------------
export function bacaRencanaGrd(workbook: {
  Sheets: Record<string, LembarXlsx>;
}): RencanaMentah {
  const catatan: string[] = [];
  const goalWs = workbook.Sheets["GOAL"];
  const kurvaWs = workbook.Sheets["Target & Kurva WRM"];
  if (!goalWs) throw new Error('Sheet "GOAL" tidak ada.');
  if (!kurvaWs) throw new Error('Sheet "Target & Kurva WRM" tidak ada.');

  const { periode, periodeLabel, goals } = bacaGoalSheet(goalWs, catatan);
  const goalPerKode = new Map(goals.map((g) => [g.kode, g]));

  const targetAkun = bacaTargetAkun(kurvaWs, periode, goalPerKode, catatan);
  const semuaGoal = [...goals, ...targetAkun.goals];

  // Ukuran: baris kurva lebih dulu (membawa titik), lalu setiap goal yang
  // belum punya ukuran.
  const ukuran = bacaKurva(kurvaWs, periode, goalPerKode, catatan);
  const punyaUkuran = new Set(ukuran.map((u) => u.goal).filter(Boolean));
  let urutan = 1000;
  for (const g of semuaGoal) {
    if (punyaUkuran.has(g.kode)) continue;
    ukuran.push({
      kode: g.kode,
      judul: g.judul,
      satuan: g.satuan,
      sumber: g.jenisRealisasi,
      goal: g.kode,
      pic: g.pemilik,
      picTeks: g.pemilik ?? "",
      urutan: (urutan += 1),
      lingkup: [],
      titik: [],
    });
  }

  // Sumber dan lingkup tiap ukuran.
  for (const u of ukuran) {
    const goal = u.goal
      ? (goalPerKode.get(u.goal) ?? semuaGoal.find((g) => g.kode === u.goal))
      : null;
    if (u.satuan !== "IDR") {
      u.sumber = "isian";
      continue;
    }
    if (!goal) {
      // Baris rupiah tanpa goal (GMV creator besar baru): dicatat tangan.
      u.sumber = LINGKUP_KHUSUS[u.kode] ? "gmv" : "isian";
      u.lingkup = LINGKUP_KHUSUS[u.kode] ?? [];
      continue;
    }
    u.sumber = "gmv";
    if (LINGKUP_KHUSUS[u.kode]) {
      u.lingkup = LINGKUP_KHUSUS[u.kode];
    } else if (goal.level === "account") {
      const a = targetAkun.akun.find(
        (x) =>
          `${x.goalKode}:${x.akun ?? namaPertama(x.pemegang)}` === goal.kode,
      );
      u.lingkup = a?.akun
        ? [{ akun: a.akun, jenisGmv: a.jenis, faktor: 1 }]
        : [];
    } else {
      const daftar = targetAkun.akun.filter((a) => a.goalKode === goal.kode);
      const total = /\(([\d.\s+]+)\)/.exec(u.judul);
      if (daftar.length > 0) {
        u.lingkup = daftar
          .filter((a) => a.akun)
          .map((a) => ({
            akun: a.akun as string,
            jenisGmv: a.jenis,
            faktor: 1 as const,
          }));
        for (const a of daftar.filter((x) => !x.akun)) {
          catatan.push(
            `Goal ${goal.kode}: akun "${a.pemegang}" belum punya username di file, belum ikut dihitung.`,
          );
        }
      } else if (total) {
        // "TOTAL GMV INTERNAL (1.1.1 + 1.1.2 + 1.1.3 + 1.1.4)"
        u.lingkup = total[1]
          .split("+")
          .map((k) => k.trim())
          .filter(Boolean)
          .map((k) => ({ sumberKode: k, faktor: 1 as const }));
      } else {
        catatan.push(
          `Ukuran ${u.kode} tidak punya lingkup GMV yang bisa dibaca.`,
        );
      }
    }
  }

  const lembar = bacaKpi(workbook, catatan);

  return { periode, periodeLabel, goals: semuaGoal, ukuran, lembar, catatan };
}

// ---------------------------------------------------------------------
// Penyusunan rencana dengan id database
// ---------------------------------------------------------------------

/**
 * Pemetaan nama di file → nama/username di database. Setiap nama di file
 * WAJIB tercantum; nilai null berarti sengaja tidak dipetakan (orang atau
 * akun belum ada di K-Space). Tidak ada tebakan otomatis.
 */
export type PemetaanGrd = {
  orang: Record<string, string | null>;
  akun: Record<string, string | null>;
  struktur?: {
    orang: string;
    role?: string;
    atasan?: string;
    jabatan?: string;
  }[];
  hapus_goal_periode?: string[];
};

export type DataDb = {
  users: { id: string; nama: string; status: string }[];
  accounts: { id: string; username: string }[];
  units: { id: string; kode: string }[];
  /** Goal di luar GRD (tanpa kode) beserta label periodenya. */
  goalLama: { id: string; judul: string; periode: string }[];
};

export type RencanaImpor = {
  periode: string;
  hapus_goal: string[];
  struktur: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  ukuran: Record<string, unknown>[];
  lembar: Record<string, unknown>[];
};

export type LaporanSusun = {
  /** Nama di file yang belum tercantum di pemetaan sama sekali. */
  belumDipetakan: string[];
  /** Nama yang sengaja tidak dipetakan (null) atau tidak ada di database. */
  tidakDitemukan: string[];
  dilewati: string[];
  goalLamaDihapus: string[];
};

const URUTAN_LEVEL = ["company", "manager", "leader", "staff", "account"];

export function susunRencana(
  mentah: RencanaMentah,
  pemetaan: PemetaanGrd,
  data: DataDb,
): { rencana: RencanaImpor; laporan: LaporanSusun } {
  const laporan: LaporanSusun = {
    belumDipetakan: [],
    tidakDitemukan: [],
    dilewati: [...mentah.catatan],
    goalLamaDihapus: [],
  };
  const catatOnce = (daftar: string[], t: string) => {
    if (!daftar.includes(t)) daftar.push(t);
  };

  const userPerNama = new Map(data.users.map((u) => [u.nama, u]));
  const akunPerNama = new Map(
    data.accounts.map((a) => [a.username.toLowerCase(), a]),
  );
  const unitPerKode = new Map(data.units.map((u) => [u.kode, u.id]));

  const orangId = (nama: string | null): string | null => {
    if (!nama) return null;
    if (!(nama in pemetaan.orang)) {
      catatOnce(laporan.belumDipetakan, `orang "${nama}"`);
      return null;
    }
    const tujuan = pemetaan.orang[nama];
    const u = tujuan ? userPerNama.get(tujuan) : undefined;
    if (!u) {
      catatOnce(
        laporan.tidakDitemukan,
        tujuan
          ? `orang "${nama}" → "${tujuan}" tidak ada di database`
          : `orang "${nama}" (belum terdaftar di K-Space)`,
      );
      return null;
    }
    if (u.status !== "aktif") {
      catatOnce(laporan.dilewati, `orang "${nama}" berstatus ${u.status}`);
    }
    return u.id;
  };

  const akunId = (nama: string | null): string | null => {
    if (!nama) return null;
    if (!(nama in pemetaan.akun)) {
      catatOnce(laporan.belumDipetakan, `akun "${nama}"`);
      return null;
    }
    const tujuan = pemetaan.akun[nama];
    const a = tujuan ? akunPerNama.get(tujuan.toLowerCase()) : undefined;
    if (!a) {
      catatOnce(
        laporan.tidakDitemukan,
        tujuan
          ? `akun "${nama}" → "${tujuan}" tidak ada di database`
          : `akun "${nama}" (belum terdaftar di K-Space)`,
      );
      return null;
    }
    return a.id;
  };

  // Goal: goal akun tanpa akun di database dilewati (tidak ada yang bisa
  // diukur), sisanya masuk dengan pemilik kosong bila orangnya belum ada.
  const goalDilewati = new Set<string>();
  const goals = [...mentah.goals]
    .sort(
      (a, b) => URUTAN_LEVEL.indexOf(a.level) - URUTAN_LEVEL.indexOf(b.level),
    )
    .flatMap((g) => {
      const account_id = g.level === "account" ? akunId(g.akun) : null;
      if (g.level === "account" && !account_id) {
        goalDilewati.add(g.kode);
        laporan.dilewati.push(
          `Goal ${g.kode} dilewati: akunnya belum ada di K-Space.`,
        );
        return [];
      }
      const pemilik_id = orangId(g.pemilik);
      const ketPemilik =
        g.pemilik && !pemilik_id
          ? `PIC: ${g.pemilik} (belum terdaftar di K-Space). `
          : "";
      return [
        {
          kode: g.kode,
          judul: g.judul,
          level: g.level,
          induk: g.induk,
          pemilik_id,
          unit_id: g.unit ? (unitPerKode.get(g.unit) ?? null) : null,
          account_id,
          satuan: g.satuan,
          base: g.base,
          target: g.target,
          stretch: g.target,
          periode_label: mentah.periodeLabel,
          tenggat: g.tenggat,
          jenis_realisasi: g.jenisRealisasi,
          keterangan: `${ketPemilik}${g.keterangan}`.trim(),
          status: g.status,
          bulan:
            g.jenisRealisasi === "gmv"
              ? [
                  {
                    bulan: mentah.periode,
                    dari: mentah.periode,
                    sampai: akhirBulanIso(mentah.periode),
                    target: g.target,
                  },
                ]
              : [],
        },
      ];
    });

  const ukuran = mentah.ukuran
    .filter((u) => !(u.goal && goalDilewati.has(u.goal)))
    .map((u) => ({
      kode: u.kode,
      judul: u.judul,
      satuan: u.satuan,
      sumber: u.sumber,
      goal: u.goal,
      pic_id: orangId(u.pic),
      pic_teks: u.picTeks,
      urutan: u.urutan,
      asal: "",
      lingkup: u.lingkup.flatMap((l): Record<string, unknown>[] => {
        if ("sumberKode" in l) {
          return [{ sumber_kode: l.sumberKode, faktor: l.faktor }];
        }
        if ("unit" in l) {
          return [
            {
              unit_id: unitPerKode.get(l.unit) ?? null,
              jenis_gmv: l.jenisGmv,
              faktor: l.faktor,
            },
          ];
        }
        const account_id = akunId(l.akun);
        if (!account_id) {
          laporan.dilewati.push(
            `Ukuran ${u.kode}: akun "${l.akun}" belum ada di K-Space, belum ikut dihitung.`,
          );
          return [];
        }
        return [{ account_id, jenis_gmv: l.jenisGmv, faktor: l.faktor }];
      }),
      titik: u.titik,
    }));

  const lembar = mentah.lembar.flatMap((l) => {
    const user_id = orangId(l.orang);
    if (!user_id) {
      laporan.dilewati.push(
        `Lembar KPI "${l.judul}" dilewati: orangnya belum dipetakan.`,
      );
      return [];
    }
    return [
      {
        user_id,
        judul: l.judul,
        status: l.status,
        asal: l.asal,
        indikator: l.indikator,
      },
    ];
  });

  const struktur = (pemetaan.struktur ?? []).flatMap((s) => {
    const user_id = orangId(s.orang);
    if (!user_id) return [];
    const baris: Record<string, unknown> = { user_id };
    if (s.role) baris.role = s.role;
    if (s.jabatan) baris.jabatan = s.jabatan;
    if (s.atasan) {
      const atasan = orangId(s.atasan);
      if (!atasan) return [];
      baris.atasan_id = atasan;
    }
    return [baris];
  });

  const periodeHapus = new Set(pemetaan.hapus_goal_periode ?? []);
  const hapus = data.goalLama.filter((g) => periodeHapus.has(g.periode));
  laporan.goalLamaDihapus = hapus.map((g) => `${g.judul} (${g.periode})`);

  return {
    rencana: {
      periode: mentah.periode,
      hapus_goal: hapus.map((g) => g.id),
      struktur,
      goals,
      ukuran,
      lembar,
    },
    laporan,
  };
}
