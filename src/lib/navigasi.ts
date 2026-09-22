import {
  Boxes,
  CalendarDays,
  CircleAlert,
  DatabaseZap,
  Fingerprint,
  GraduationCap,
  Home,
  ListChecks,
  MessageSquare,
  NotebookPen,
  Package,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type MenuUtama = {
  label: string;
  labelPendek: string;
  href: string;
  icon: LucideIcon;
};

/** Lima menu Rilis 1, tampil datar tanpa sub-menu (PRD §2). */
export const menuUtama: MenuUtama[] = [
  { label: "Beranda", labelPendek: "Beranda", href: "/beranda", icon: Home },
  {
    label: "Absensi",
    labelPendek: "Absensi",
    href: "/absensi",
    icon: Fingerprint,
  },
  { label: "Tugas", labelPendek: "Tugas", href: "/tugas", icon: ListChecks },
  {
    label: "Laporan Harian",
    labelPendek: "Laporan",
    href: "/laporan-harian",
    icon: NotebookPen,
  },
  { label: "GRD", labelPendek: "GRD", href: "/grd", icon: TrendingUp },
];

/** Izin yang menentukan sebuah menu pendamping tampil atau tidak. */
export type IzinMenu = "keuangan" | "migrasi";

export type MenuPendamping = {
  label: string;
  /** Penjelasan singkat; dipakai di laci menu mobile. */
  keterangan: string;
  href: string;
  icon: LucideIcon;
  izin?: IzinMenu;
  /**
   * Sudah punya pintasan di app-bar atas (NavigasiAtas).
   *
   * Rail ikon desktop melewatkannya supaya pintu masuknya cuma satu —
   * dua tombol ke halaman yang sama membuat orang mengira keduanya
   * berbeda. Laci "Lainnya" di mobile tetap menampilkannya, karena
   * app-bar atas itu desktop saja; kalau ikut disembunyikan, halamannya
   * jadi tidak bisa dibuka sama sekali dari ponsel.
   */
  diAppBar?: boolean;
};

/**
 * Menu Rilis 2 & 3 — di luar lima menu utama PRD §2.
 *
 * Satu daftar dipakai dua tempat: rail ikon desktop dan laci "Lainnya" di
 * mobile. Sebelumnya rail menuliskannya satu per satu dan mobile tidak
 * menuliskannya sama sekali, sehingga separuh aplikasi hanya bisa dibuka
 * dari desktop — padahal PRD §2 menyebut aplikasinya mobile-first.
 */
export const menuPendamping: MenuPendamping[] = [
  {
    label: "Kalender",
    keterangan: "Agenda unit dan perusahaan",
    href: "/kalender",
    icon: CalendarDays,
    diAppBar: true,
  },
  {
    label: "Keuangan",
    keterangan: "Transaksi, laporan, dan posisi kas",
    href: "/keuangan",
    icon: Wallet,
    izin: "keuangan",
  },
  {
    label: "Aset & inventaris",
    keterangan: "Barang perusahaan, pemegang, dan nilai bukunya",
    href: "/aset",
    icon: Boxes,
  },
  {
    label: "Sampel produk",
    keterangan: "Pelacakan sampel lewat kode QR",
    href: "/sampel",
    icon: Package,
  },
  {
    label: "Kaizen",
    keterangan: "Lapor masalah, manajemen menuliskan solusinya",
    href: "/masalah",
    icon: CircleAlert,
    diAppBar: true,
  },
  {
    label: "Pembelajaran",
    keterangan: "Kursus, modul, dan kuis",
    href: "/lms",
    icon: GraduationCap,
  },
  {
    label: "Masukan & bug",
    keterangan: "Laporkan kendala aplikasi",
    href: "/masukan",
    icon: MessageSquare,
  },
  {
    label: "Anggota tim",
    keterangan: "Struktur, penempatan, dan akun",
    href: "/tim",
    icon: Users,
  },
  {
    label: "Migrasi data lama",
    keterangan: "Pemindahan isi kv_store K-Space lama",
    href: "/migrasi",
    icon: DatabaseZap,
    izin: "migrasi",
  },
];

/**
 * Menu pendamping yang boleh dibuka pengguna ini.
 *
 * `kecualiAppBar` dipakai rail desktop: menu yang sudah punya pintasan di
 * app-bar atas tidak diulang di rail. Laci mobile memanggilnya tanpa
 * opsi itu, karena app-bar atas tidak ada di layar kecil.
 */
export function menuPendampingTerlihat(
  izin: Record<IzinMenu, boolean>,
  { kecualiAppBar = false }: { kecualiAppBar?: boolean } = {},
) {
  return menuPendamping.filter(
    (m) => (!m.izin || izin[m.izin]) && !(kecualiAppBar && m.diAppBar),
  );
}
