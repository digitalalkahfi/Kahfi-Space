/**
 * Matriks hak akses per peran — modul murni.
 *
 * Aturannya tidak ditulis ulang di sini: tiap baris memanggil fungsi
 * yang dipakai halaman sungguhan, jadi matriks ini tidak bisa
 * mengatakan sesuatu yang berbeda dari perilaku aplikasinya. Kalau
 * suatu saat sebuah aturan berubah, matriksnya ikut berubah sendiri.
 *
 * Yang ditampilkan di sini lapisan tampilan; pembatasan sebenarnya
 * tetap Row Level Security di database.
 */
import { bolehLihat } from "@/lib/akses";
import { bolehLihatKeuangan } from "@/lib/keuangan";
import type { Peran } from "@/lib/types";

export const DAFTAR_PERAN: Peran[] = [
  "CEO",
  "Manager",
  "Leader",
  "Co-Leader",
  "Staff",
  "Finance",
];

/** Satu kemampuan yang dinilai per peran. */
export type BarisHak = {
  kunci: string;
  label: string;
  /** Kenapa batasnya begitu; ditampilkan sebagai keterangan barisnya. */
  alasan: string;
  punya: (peran: Peran) => boolean;
};

export const HAK_AKSES: BarisHak[] = [
  {
    kunci: "angkaPerusahaan",
    label: "Membuka modul Keuangan",
    alasan:
      "Angka perusahaan — kas, transaksi, anggaran — bukan bagian pekerjaan harian unit.",
    punya: (p) => bolehLihatKeuangan(p),
  },
  {
    kunci: "posisiKas",
    label: "Melihat posisi kas di Beranda",
    alasan: "Ikut aturan modul Keuangan; Leader melihat capaian, bukan kas.",
    punya: (p) => bolehLihat(p, "posisiKas"),
  },
  {
    kunci: "pantauKehadiran",
    label: "Memantau kehadiran orang lain",
    alasan:
      "Hanya yang memimpin orang. Finance memantau angka, bukan operasional harian.",
    punya: (p) => bolehLihat(p, "pantauKehadiran"),
  },
  {
    kunci: "statusTim",
    label: "Melihat status tim harian",
    alasan: "Ringkasan kehadiran & laporan unit yang ia pimpin.",
    punya: (p) => bolehLihat(p, "statusTim"),
  },
  {
    kunci: "capaianPribadi",
    label: "Melihat kartu capaian pribadi",
    alasan:
      "Hanya yang punya sasaran laporan sendiri; jajaran manajemen melihat capaian unit.",
    punya: (p) => bolehLihat(p, "capaianPribadi"),
  },
  {
    kunci: "kelolaAnggota",
    label: "Mengubah data anggota & perannya",
    alasan: "Sejalan policy `users_kelola`: hanya CEO dan Manager.",
    punya: (p) => bolehKelolaPeran(p),
  },
  {
    kunci: "kelolaAkun",
    label: "Mengubah akun, PIC, dan levelnya",
    alasan: "Sejalan policy `accounts_kelola`: hanya CEO dan Manager.",
    punya: (p) => bolehKelolaPeran(p),
  },
];

/**
 * Peran yang boleh menyetel peran orang lain.
 *
 * Sengaja memanggil helper yang sama dengan halaman Anggota Tim — satu
 * aturan, bukan dua yang kebetulan sama hari ini.
 */
export function bolehKelolaPeran(peran: Peran) {
  return peran === "CEO" || peran === "Manager";
}

/** Matriks siap gambar: satu baris kemampuan × enam kolom peran. */
export function matriksHakAkses() {
  return HAK_AKSES.map((h) => ({
    ...h,
    per: Object.fromEntries(DAFTAR_PERAN.map((p) => [p, h.punya(p)])) as Record<
      Peran,
      boolean
    >,
  }));
}

/** Kemampuan yang dimiliki satu peran, untuk keterangan ringkas. */
export function hakPeran(peran: Peran) {
  return HAK_AKSES.filter((h) => h.punya(peran)).map((h) => h.label);
}
