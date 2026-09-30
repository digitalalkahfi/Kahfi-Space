/**
 * Saringan "tugas ini datang dari mana" di halaman Tugas — modul murni.
 *
 * Setiap tugas yang terlihat masuk tepat satu kelompok, dilihat dari
 * posisi orang yang sedang login (dibandingkan lewat id, bukan nama):
 *   · saya          — to-do pribadi (juga tiket untuk diri sendiri)
 *   · dari-atasan   — tiket yang ia terima dari orang lain
 *   · untuk-bawahan — tiket yang ia berikan kepada orang lain
 *   · tim           — tiket antar orang lain yang terlihat karena
 *                     perannya (Leader/Manager memantau timnya)
 *
 * Saringannya berjalan di layar atas isi papan/daftar yang SUDAH disaring
 * basis data (per tanggal, per cakupan RLS): berpindah pilihan tidak
 * memuat ulang apa pun, dan angka di tiap pilihan selalu cocok dengan
 * isinya.
 */
import type { Peran, StatusTugas, Tugas } from "@/lib/types";

export type SumberTugas = "saya" | "dari-atasan" | "untuk-bawahan" | "tim";

/** Pilihan saringan; "qc" hanya dipakai tampilan Daftar. */
export type LihatTugas = "semua" | SumberTugas | "qc";

export const LABEL_LIHAT: Record<LihatTugas, string> = {
  semua: "Semua",
  saya: "To-do pribadi",
  "dari-atasan": "Dari atasan",
  "untuk-bawahan": "Untuk bawahan",
  tim: "Tim lain",
  qc: "Perlu QC",
};

const URUTAN: LihatTugas[] = [
  "semua",
  "saya",
  "dari-atasan",
  "untuk-bawahan",
  "tim",
  "qc",
];

/** Peran yang memantau tiket orang lain — sama dengan pemeriksa QC. */
const PEMANTAU: readonly Peran[] = ["CEO", "Manager", "Leader", "Co-Leader"];

type TugasSumber = Pick<Tugas, "penerimaId" | "pembuatId"> & {
  status: StatusTugas;
};

export function sumberTugas(
  t: Pick<Tugas, "penerimaId" | "pembuatId">,
  idSaya: string,
): SumberTugas {
  const penerima = t.penerimaId === idSaya;
  const pembuat = t.pembuatId === idSaya;
  if (penerima && pembuat) return "saya";
  if (penerima) return "dari-atasan";
  if (pembuat) return "untuk-bawahan";
  return "tim";
}

export function cocokLihat(
  t: TugasSumber,
  lihat: LihatTugas,
  idSaya: string,
): boolean {
  if (lihat === "semua") return true;
  if (lihat === "qc") return t.status === "menunggu_qc";
  return sumberTugas(t, idSaya) === lihat;
}

/** Jumlah tugas di setiap pilihan, dari daftar yang sama dengan isinya. */
export function hitungLihat(
  tugas: readonly TugasSumber[],
  idSaya: string,
): Record<LihatTugas, number> {
  const jumlah: Record<LihatTugas, number> = {
    semua: tugas.length,
    saya: 0,
    "dari-atasan": 0,
    "untuk-bawahan": 0,
    tim: 0,
    qc: 0,
  };
  for (const t of tugas) {
    jumlah[sumberTugas(t, idSaya)] += 1;
    if (t.status === "menunggu_qc") jumlah.qc += 1;
  }
  return jumlah;
}

/**
 * Pilihan yang ditampilkan, urut tetap.
 *
 * Yang tidak mungkin berisi untuk orang ini disembunyikan — staf tidak
 * punya bawahan, CEO tidak punya atasan, staf tidak memantau tiket orang
 * lain — supaya barisnya tidak dipenuhi pilihan kosong. Tetapi pilihan
 * yang ternyata berisi SELALU tampil: data lama boleh saja tidak
 * mengikuti bagan organisasi hari ini.
 */
export function pilihanLihat(input: {
  peran: Peran;
  punyaAtasan: boolean;
  bisaMemberiTiket: boolean;
  jumlah: Record<LihatTugas, number>;
  /** Tampilan Daftar menambah "Perlu QC". */
  denganQc: boolean;
}): LihatTugas[] {
  const { peran, punyaAtasan, bisaMemberiTiket, jumlah, denganQc } = input;
  const tampil: Record<LihatTugas, boolean> = {
    semua: true,
    saya: true,
    "dari-atasan": punyaAtasan || jumlah["dari-atasan"] > 0,
    "untuk-bawahan": bisaMemberiTiket || jumlah["untuk-bawahan"] > 0,
    tim: PEMANTAU.includes(peran) || jumlah.tim > 0,
    qc: denganQc,
  };
  return URUTAN.filter((k) => tampil[k]);
}

/**
 * `?lihat=` dari URL. Nilai asing — atau pilihan yang tidak tampil untuk
 * orang ini — jatuh ke "semua", supaya tautan lama tidak pernah membuka
 * papan yang tampak kosong tanpa penjelasan.
 */
export function lihatDariParam(
  nilai: string | null | undefined,
  tersedia: readonly LihatTugas[],
): LihatTugas {
  return tersedia.find((k) => k === nilai) ?? "semua";
}
