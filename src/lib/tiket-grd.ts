/**
 * Tiket dari tonggak rencana operasional GRD — aturan murni untuk layar
 * dan skrip (0199–0202).
 *
 * Aturan bisnisnya (siapa penerima, siapa pemberi, tonggak mana dilewati,
 * status mengalir ke tonggak) dijaga dan dihitung database; modul ini
 * hanya menerjemahkan hasilnya menjadi tulisan, tautan, dan keputusan
 * tampilan yang sama di semua layar.
 */
import { bulanPanjang } from "@/lib/format";
import type { StatusTonggak } from "@/lib/rencana";

/** Alasan sebuah tonggak tidak dibuatkan tiket (kode dari `buat_tiket_grd`). */
export type AlasanDilewati =
  | "bulan_terkunci"
  | "sudah_punya_tiket"
  | "sudah_selesai"
  | "tanpa_tenggat"
  | "tanpa_pic"
  | "penerima_nonaktif";

export const KETERANGAN_ALASAN: Record<AlasanDilewati, string> = {
  bulan_terkunci: "KPI bulan itu sudah dikunci",
  sudah_punya_tiket: "sudah punya tiket",
  sudah_selesai: "tonggak sudah selesai",
  tanpa_tenggat: "tenggatnya belum ditetapkan",
  tanpa_pic: "tidak ada PIC terdaftar",
  penerima_nonaktif: "PIC-nya sudah nonaktif",
};

/** Laporan `buat_tiket_grd` (0201), apa adanya dari database. */
export type LaporanTiketGrd = {
  periode: string;
  uji: boolean;
  terkunci: boolean;
  rencana_harian: number;
  tonggak_diperiksa: number;
  dibuat: number;
  sudah_ada: number;
  /** Tiket yang begitu dibuat sudah lewat tenggat; tenggatnya tidak digeser. */
  sudah_lewat_tenggat?: number;
  alasan_dilewati: Partial<Record<AlasanDilewati, number>>;
  per_penerima: { penerima: string | null; pemberi: string | null; jumlah: number }[];
  tiket: {
    kode: string;
    tonggak: string;
    judul: string;
    penerima: string | null;
    pemberi: string | null;
    tenggat: string;
    status: string;
    catatan: string | null;
  }[];
  dilewati: { kode: string; tonggak: string; alasan: AlasanDilewati }[];
  perlu_diperiksa: {
    kode: string;
    tonggak: string;
    penerima: string | null;
    catatan: string;
  }[];
};

const keterangan = (a: string) =>
  KETERANGAN_ALASAN[a as AlasanDilewati] ?? a;

/**
 * Laporan dalam bahasa sederhana untuk dicetak skrip: berapa tiket, untuk
 * siapa, dari siapa, dan tonggak mana dilewati beserta alasannya.
 *
 * `rinci` menambah daftar tiket satu per satu (bawaannya hanya ringkasan
 * per orang, karena bulan penuh bisa ratusan tiket).
 */
export function susunLaporanTiketGrd(
  l: LaporanTiketGrd,
  { rinci = false, uji = l.uji }: { rinci?: boolean; uji?: boolean } = {},
): string[] {
  const baris: string[] = [];
  const bulan = bulanPanjang(l.periode);
  const akan = uji ? "akan dibuat" : "dibuat";

  baris.push(
    `Tiket dari rencana operasional GRD ${bulan}${
      uji ? " — UJI COBA, belum ada yang disimpan" : ""
    }`,
  );
  if (l.terkunci) {
    baris.push(
      "  KPI bulan ini sudah dikunci: tidak ada tiket yang dibuat dan tonggaknya tidak disentuh.",
    );
  }

  const dilewati = Object.values(l.alasan_dilewati).reduce(
    (t, n) => t + (n ?? 0),
    0,
  );
  baris.push(
    `  ${l.tonggak_diperiksa} tonggak sekali/pekanan diperiksa · ${l.dibuat} tiket ${akan}` +
      ` · ${l.sudah_ada} sudah bertiket · ${dilewati - l.sudah_ada} dilewati`,
  );
  if ((l.sudah_lewat_tenggat ?? 0) > 0) {
    baris.push(
      `  ${l.sudah_lewat_tenggat} di antaranya sudah lewat tenggat: tenggatnya tidak digeser, tetapi tidak memicu pengingat "Tenggat lewat" massal.`,
    );
  }
  if (l.rencana_harian > 0) {
    baris.push(
      `  ${l.rencana_harian} rencana harian tidak dibuatkan tiket (diukur dari laporan harian).`,
    );
  }

  const perOrang = l.per_penerima ?? [];
  if (perOrang.length > 0) {
    baris.push("", `Untuk siapa, dari siapa (${l.dibuat} tiket):`);
    for (const p of perOrang) {
      baris.push(
        `  ${p.penerima ?? "—"} ← dari ${p.pemberi ?? "—"}: ${p.jumlah} tiket`,
      );
    }
  }

  const lewat = l.dilewati ?? [];
  if (lewat.length > 0) {
    baris.push("", `Dilewati (${lewat.length}):`);
    for (const d of lewat) {
      baris.push(`  - ${d.kode} "${d.tonggak}" — ${keterangan(d.alasan)}`);
    }
  }

  const periksa = l.perlu_diperiksa ?? [];
  if (periksa.length > 0) {
    baris.push("", `Perlu diperiksa (${periksa.length}):`);
    for (const d of periksa) {
      baris.push(`  - ${d.kode} (${d.penerima ?? "tanpa penerima"}): ${d.catatan}`);
    }
  }

  const daftar = l.tiket ?? [];
  if (rinci && daftar.length > 0) {
    baris.push("", `Daftar tiket (${daftar.length}):`);
    for (const t of daftar) {
      baris.push(
        `  - ${t.judul} · ${t.penerima ?? "—"} ← ${t.pemberi ?? "—"} · tenggat ${t.tenggat.replace("T", " ")} WIB`,
      );
    }
  }

  return baris;
}

// ---------------------------------------------------------------------
// Tampilan
// ---------------------------------------------------------------------

/** Id jangkar kartu tiket di papan, tujuan tautan "Buka tiket". */
export const idKartuTiket = (tiketId: string) => `tiket-${tiketId}`;

/** Tautan "Buka tiket" dari tonggak: papan Semua, langsung ke kartunya. */
export const tautanBukaTiket = (tiketId: string) =>
  `/tugas#${idKartuTiket(tiketId)}`;

/** Halaman rencana operasional, tujuan tautan dari kartu tiket GRD. */
export const TAUTAN_RENCANA_GRD = "/grd/rencana";

/** Tenggat tiket GRD hanya diubah CEO/Manager (aturan tonggak, 0192). */
export function bolehUbahTenggatTiketGrd(role: string): boolean {
  return role === "CEO" || role === "Manager";
}

/** Pesan baku saat tenggat tiket GRD diubah selain oleh CEO/Manager. */
export const PESAN_TENGGAT_GRD =
  "Tenggat tiket dari rencana GRD hanya bisa diubah CEO atau Manager — sama seperti tenggat tonggaknya.";

/** Pesan baku saat tiket GRD dihapus. */
export const PESAN_HAPUS_TIKET_GRD =
  "Tiket dari rencana GRD tidak bisa dihapus. Betulkan lewat rencana operasional GRD.";

/** Pesan baku saat status tonggak ber-tiket diubah manual. */
export const PESAN_TONGGAK_MENGIKUTI_TIKET =
  "Status tonggak ini mengikuti tiketnya. Ubah lewat halaman Tugas.";

const NAMA_STATUS: Record<StatusTonggak, string> = {
  belum: "Belum",
  progress: "Progress",
  selesai: "Selesai",
};

/** Keterangan di chip tonggak yang punya tiket. */
export function keteranganTonggakBertiket(status: StatusTonggak): string {
  return `${NAMA_STATUS[status]} — mengikuti tiketnya`;
}
