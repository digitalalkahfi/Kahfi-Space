import type { CapaianUnit, Peran, Pengguna } from "@/lib/types";

/** Blok yang bisa muncul di Beranda. */
export type WidgetBeranda =
  | "capaianPribadi"
  | "wrm"
  | "targetBulanan"
  | "gmvUnit"
  | "statusTim"
  | "pantauKehadiran"
  | "toDo"
  | "tugas"
  | "agenda"
  | "posisiKas"
  | "pengumuman";

/**
 * Peta peran → blok Beranda (PRD §2: "Beranda menampilkan dasbor sesuai peran").
 * Ini lapisan tampilan; pembatasan sebenarnya tetap di Row Level Security
 * Supabase saat backend dipasang.
 */
export const widgetPerPeran: Record<Peran, WidgetBeranda[]> = {
  CEO: [
    "posisiKas",
    "wrm",
    "targetBulanan",
    "gmvUnit",
    "statusTim",
    "pantauKehadiran",
    "toDo",
    "tugas",
    "agenda",
    "pengumuman",
  ],
  Manager: [
    "posisiKas",
    "wrm",
    "targetBulanan",
    "gmvUnit",
    "statusTim",
    "pantauKehadiran",
    "toDo",
    "tugas",
    "agenda",
    "pengumuman",
  ],
  Leader: [
    "capaianPribadi",
    "wrm",
    "targetBulanan",
    "gmvUnit",
    "statusTim",
    "pantauKehadiran",
    "toDo",
    "tugas",
    "agenda",
    "pengumuman",
  ],
  "Co-Leader": [
    "capaianPribadi",
    "wrm",
    "gmvUnit",
    "statusTim",
    "toDo",
    "tugas",
    "agenda",
    "pengumuman",
  ],
  // Staff hanya melihat capaian unitnya sendiri, bukan kehadiran orang lain.
  Staff: [
    "capaianPribadi",
    "wrm",
    "gmvUnit",
    "toDo",
    "tugas",
    "agenda",
    "pengumuman",
  ],
  // Finance memantau angka, bukan kehadiran operasional harian.
  Finance: [
    "posisiKas",
    "wrm",
    "targetBulanan",
    "gmvUnit",
    "toDo",
    "tugas",
    "agenda",
    "pengumuman",
  ],
};

export function bolehLihat(peran: Peran, widget: WidgetBeranda) {
  return widgetPerPeran[peran].includes(widget);
}

/**
 * CEO/Manager/Finance melihat seluruh unit; sisanya hanya unitnya sendiri.
 * Staff tim manajemen (tanpa unit) tidak melihat kartu unit mana pun —
 * bukan lintas unit hanya karena tidak ditempatkan (migrasi 0173).
 */
export function unitTerlihat(pengguna: Pengguna, unit: CapaianUnit[]) {
  const lintasUnit: Peran[] = ["CEO", "Manager", "Finance"];
  if (lintasUnit.includes(pengguna.role)) return unit;
  return unit.filter((u) => u.unitId === pengguna.unitId);
}

/**
 * Boleh melihat baris tingkat unit berkode ini? CEO/Manager/Finance semua;
 * yang lain hanya unitnya sendiri. Baris tanpa unit (tingkat perusahaan)
 * hanya untuk yang lintas unit.
 */
export function unitKodeTerlihat(
  pengguna: Pengguna,
  kode: string | null | undefined,
) {
  const lintasUnit: Peran[] = ["CEO", "Manager", "Finance"];
  if (lintasUnit.includes(pengguna.role)) return true;
  return kode != null && kode === pengguna.unitId;
}

/** Judul dasbor menyesuaikan cakupan yang dilihat peran tersebut. */
export function judulCakupan(pengguna: Pengguna, unit: CapaianUnit[]) {
  const terlihat = unitTerlihat(pengguna, unit);
  if (terlihat.length === unit.length) return "seluruh lini bisnis";
  return terlihat.map((u) => u.namaPendek).join(", ");
}
