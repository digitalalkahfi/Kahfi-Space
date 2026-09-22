import type {
  AnggotaKehadiran,
  CapaianUnit,
  Peran,
  Pengguna,
} from "@/lib/types";

/** Blok yang bisa muncul di Beranda. */
export type WidgetBeranda =
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
    "wrm",
    "gmvUnit",
    "statusTim",
    "toDo",
    "tugas",
    "agenda",
    "pengumuman",
  ],
  // Staff hanya melihat capaian unitnya sendiri, bukan kehadiran orang lain.
  Staff: ["wrm", "gmvUnit", "toDo", "tugas", "agenda", "pengumuman"],
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

/** CEO/Manager/Finance melihat seluruh unit; sisanya hanya unitnya sendiri. */
export function unitTerlihat(pengguna: Pengguna, unit: CapaianUnit[]) {
  const lintasUnit: Peran[] = ["CEO", "Manager", "Finance"];
  if (lintasUnit.includes(pengguna.role) || pengguna.unitId === null) {
    return unit;
  }
  return unit.filter((u) => u.unitId === pengguna.unitId);
}

/** Leader & Co-Leader hanya memantau anggota di unitnya. */
export function timTerlihat(pengguna: Pengguna, tim: AnggotaKehadiran[]) {
  const lintasUnit: Peran[] = ["CEO", "Manager"];
  if (lintasUnit.includes(pengguna.role) || pengguna.unitId === null) {
    return tim;
  }
  const namaUnit: Record<string, string> = {
    affiliator: "Affiliator",
    mcn: "MCN",
    tap: "TAP",
  };
  return tim.filter((a) => a.unit === namaUnit[pengguna.unitId as string]);
}

/** Judul dasbor menyesuaikan cakupan yang dilihat peran tersebut. */
export function judulCakupan(pengguna: Pengguna, unit: CapaianUnit[]) {
  const terlihat = unitTerlihat(pengguna, unit);
  if (terlihat.length === unit.length) return "seluruh lini bisnis";
  return terlihat.map((u) => u.namaPendek).join(", ");
}
