/**
 * Menyamakan sebutan tugas sistem lama — modul murni.
 *
 * Status dan prioritas di V1 ditulis campur bahasa Inggris dan
 * Indonesia. Yang tidak dikenali tidak ditebak menjadi "selesai":
 * tugas yang salah ditandai selesai berhenti muncul di layar siapa pun
 * dan tidak akan pernah dikerjakan.
 */

export type StatusTugas =
  "todo" | "berjalan" | "menunggu_qc" | "revisi" | "selesai" | "dibatalkan";

const STATUS: Record<string, StatusTugas> = {
  todo: "todo",
  "to do": "todo",
  baru: "todo",
  open: "todo",
  berjalan: "berjalan",
  "in progress": "berjalan",
  in_progress: "berjalan",
  "in-progress": "berjalan",
  dikerjakan: "berjalan",
  doing: "berjalan",
  menunggu_qc: "menunggu_qc",
  "menunggu qc": "menunggu_qc",
  review: "menunggu_qc",
  revisi: "revisi",
  rejected: "revisi",
  selesai: "selesai",
  done: "selesai",
  completed: "selesai",
  dibatalkan: "dibatalkan",
  cancelled: "dibatalkan",
  canceled: "dibatalkan",
};

export function statusTugasV1(nilai: unknown): StatusTugas {
  const teks = typeof nilai === "string" ? nilai.trim().toLowerCase() : "";
  return STATUS[teks] ?? "todo";
}

const PRIORITAS: Record<string, "rendah" | "sedang" | "tinggi"> = {
  rendah: "rendah",
  low: "rendah",
  sedang: "sedang",
  medium: "sedang",
  normal: "sedang",
  tinggi: "tinggi",
  high: "tinggi",
  urgent: "tinggi",
};

export function prioritasV1(nilai: unknown): "rendah" | "sedang" | "tinggi" {
  const teks = typeof nilai === "string" ? nilai.trim().toLowerCase() : "";
  return PRIORITAS[teks] ?? "sedang";
}

export type JejakQc = {
  status: "belum" | "lolos" | "revisi";
  olehLama: string | null;
  pada: string | null;
  catatan: string;
};

/**
 * Membaca jejak QC sebuah tugas lama.
 *
 * Bentuknya tidak seragam: kadang objek, kadang hanya teks hasilnya,
 * kadang tidak ada sama sekali. Yang tidak jelas dianggap belum
 * diperiksa — menandainya lolos berarti meloloskan pekerjaan yang tidak
 * pernah ditinjau siapa pun.
 */
export function jejakQcV1(nilai: unknown): JejakQc {
  const kosong: JejakQc = {
    status: "belum",
    olehLama: null,
    pada: null,
    catatan: "",
  };

  const bacaHasil = (teks: string): JejakQc["status"] => {
    const t = teks.trim().toLowerCase();
    if (["lolos", "pass", "passed", "ok", "approved"].includes(t))
      return "lolos";
    if (["revisi", "revision", "failed", "rejected"].includes(t))
      return "revisi";
    return "belum";
  };

  if (typeof nilai === "string") return { ...kosong, status: bacaHasil(nilai) };
  if (nilai === null || typeof nilai !== "object" || Array.isArray(nilai)) {
    return kosong;
  }

  const o = nilai as Record<string, unknown>;
  const status =
    typeof o.result === "string"
      ? bacaHasil(o.result)
      : typeof o.status === "string"
        ? bacaHasil(o.status)
        : "belum";

  return {
    status,
    olehLama: typeof o.checkedById === "string" ? o.checkedById : null,
    pada: typeof o.checkedAt === "string" ? o.checkedAt : null,
    catatan: typeof o.notes === "string" ? o.notes : "",
  };
}

/**
 * Jejak QC yang ditulis rata di baris tugasnya (`qcResult`, `qcNote`,
 * `qcDecidedById`, `qcDecidedAt`) — bentuk ekspor K-Space lama yang
 * sebenarnya. Dikembalikan dalam bentuk objek yang dikenal `jejakQcV1`,
 * atau null bila tidak satu pun medannya ada.
 */
export function jejakQcDatar(
  baris: Record<string, unknown>,
): Record<string, unknown> | null {
  const ada = ["qcResult", "qcNote", "qcDecidedById", "qcDecidedAt"].some(
    (m) => baris[m] !== undefined && baris[m] !== null && baris[m] !== "",
  );
  if (!ada) return null;
  return {
    result: baris.qcResult,
    notes: baris.qcNote,
    checkedById: baris.qcDecidedById,
    checkedAt: baris.qcDecidedAt,
  };
}
