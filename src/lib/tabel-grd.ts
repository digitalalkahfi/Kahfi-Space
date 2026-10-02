/**
 * Tabel GRD — tampilan sheet "GRD Cascade" di halaman Goal & Roll-down.
 *
 * Murni: pengelompokan sel (rowspan) dan status baris. Datanya dari
 * `tabel_grd` (0197) — goal, rencana operasional, dan tonggak yang sama
 * dengan tampilan hierarki dan halaman Rencana operasional.
 */
import { keadaanTonggak, type JenisRencana, type Tonggak } from "@/lib/rencana";

export type KolomBlok = "perusahaan" | "manager" | "leader";

export type BlokSel = {
  id: string;
  kode: string;
  teks: string;
  label: string;
};

export type BarisTabelGrd = {
  rencanaId: string;
  kode: string;
  judul: string;
  jenis: JenisRencana;
  picTeks: string;
  jadwalTeks: string;
  tonggak: Tonggak[];
  blok: Record<KolomBlok, BlokSel | null>;
};

export type TabelGrd = {
  /** Judul sheet, mis. "GOALS ROLL DOWN — AL-KAHFI CORP OKTOBER 2026 (…)". */
  judul: string;
  /** Catatan kaki sheet ("Cara baca: …"). */
  catatan: string;
  baris: BarisTabelGrd[];
};

export const KOLOM_BLOK: KolomBlok[] = ["perusahaan", "manager", "leader"];

/**
 * Rentang baris tiap sel blok, seperti sel gabungan di spreadsheet: angka
 * > 0 di baris pertama blok, 0 di baris yang tertutup sel di atasnya.
 * Blok yang sama hanya digabung bila barisnya berurutan.
 */
export function rentangBlok(
  baris: BarisTabelGrd[],
): Record<KolomBlok, number>[] {
  const hasil = baris.map(() => ({ perusahaan: 1, manager: 1, leader: 1 }));
  for (const kolom of KOLOM_BLOK) {
    let awal = 0;
    for (let i = 1; i <= baris.length; i += 1) {
      const sama =
        i < baris.length &&
        baris[i].blok[kolom] !== null &&
        baris[i].blok[kolom]?.id === baris[awal].blok[kolom]?.id;
      if (sama) {
        hasil[awal][kolom] += 1;
        hasil[i][kolom] = 0;
      } else {
        awal = i;
      }
    }
  }
  return hasil;
}

export type StatusBaris = "belum" | "berjalan" | "selesai" | "terlambat";

export const LABEL_STATUS_BARIS: Record<StatusBaris, string> = {
  belum: "Belum mulai",
  berjalan: "Berjalan",
  selesai: "Selesai",
  terlambat: "Terlambat",
};

/**
 * Status satu operational plan dari tonggaknya. Null bila memang tidak
 * ada data status — pekerjaan HARIAN dicek di DRM, bukan dicentang —
 * supaya tabel tidak menampilkan status yang tidak pernah dicatat.
 *
 *   terlambat — ada tonggak lewat tenggat yang belum selesai
 *   selesai   — semua tonggak selesai
 *   berjalan  — sebagian selesai atau sedang dikerjakan
 *   belum     — belum ada yang dimulai
 */
export function statusBaris(
  tonggak: Tonggak[],
  hariIni: string,
): { status: StatusBaris; selesai: number; total: number } | null {
  if (tonggak.length === 0) return null;
  const keadaan = tonggak.map((t) => keadaanTonggak(t, hariIni));
  const selesai = tonggak.filter((t) => t.status === "selesai").length;
  const total = tonggak.length;
  const status: StatusBaris = keadaan.includes("lewat")
    ? "terlambat"
    : selesai === total
      ? "selesai"
      : selesai > 0 || tonggak.some((t) => t.status === "progress")
        ? "berjalan"
        : "belum";
  return { status, selesai, total };
}

// ---------------------------------------------------------------------
// Departemen — filter Tabel GRD
// ---------------------------------------------------------------------

export type Departemen = { kunci: string; label: string };

/** "MABIT SCHOLAR" → "Mabit Scholar"; singkatan pendek (TAP, MCN) tetap. */
function rapikanNama(t: string): string {
  return t
    .trim()
    .split(/\s+/)
    .map((k) => (k.length <= 3 ? k : k[0] + k.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Departemen satu baris, dari label blok Goal Leader persis seperti sheet:
 * "GOAL LEADER AFFILIATOR (Siti)" → Affiliator · Siti; "TATA KELOLA
 * (Wildan)" → Tata Kelola · Wildan. Baris tonggak Manager (blok M) dan
 * baris UMUM berdiri sendiri.
 */
export function departemenBaris(b: BarisTabelGrd): Departemen {
  const label = b.blok.leader?.label ?? "";
  const m = /^(?:GOAL LEADER\s+)?(.+?)\s*\(([^)]+)\)\s*$/i.exec(label);
  if (m) {
    return {
      kunci: m[1]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      label: `${rapikanNama(m[1])} · ${m[2].trim()}`,
    };
  }
  if (b.blok.perusahaan?.kode === "M")
    return { kunci: "tonggak-manager", label: "Tonggak Manager" };
  return { kunci: "umum", label: "Umum" };
}

/** Departemen yang ada di tabel, urut kemunculan, beserta jumlah barisnya. */
export function daftarDepartemen(
  baris: BarisTabelGrd[],
): (Departemen & { jumlah: number })[] {
  const peta = new Map<string, Departemen & { jumlah: number }>();
  for (const b of baris) {
    const d = departemenBaris(b);
    const ada = peta.get(d.kunci);
    if (ada) ada.jumlah += 1;
    else peta.set(d.kunci, { ...d, jumlah: 1 });
  }
  return [...peta.values()];
}

/** Baris satu departemen; kunci kosong atau tak dikenal = semua baris. */
export function saringDepartemen(
  baris: BarisTabelGrd[],
  kunci: string | null,
): BarisTabelGrd[] {
  if (!kunci) return baris;
  const hasil = baris.filter((b) => departemenBaris(b).kunci === kunci);
  return hasil.length > 0 ? hasil : baris;
}
