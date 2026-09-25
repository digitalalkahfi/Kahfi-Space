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
  SlidersHorizontal,
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
   * Sudah punya pintu masuk lain di layar desktop.
   *
   * Dua sumbernya: pintasan di app-bar atas (`pintasanAtas`), dan
   * sub-menu akun di balik kartu profil. Rail ikon desktop
   * melewatkan keduanya supaya pintu masuknya cuma satu — dua tombol
   * ke halaman yang sama membuat orang mengira keduanya berbeda.
   *
   * Laci "Lainnya" di mobile tetap menampilkannya: pintu-pintu itu
   * desktop atau tersembunyi di balik kartu profil, dan kalau di laci
   * pun disembunyikan, halamannya jadi sulit ditemukan dari ponsel.
   */
  pintuLainDiDesktop?: boolean;
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
    pintuLainDiDesktop: true,
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
    pintuLainDiDesktop: true,
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
    label: "Catatan",
    keterangan: "Catatan kerja pribadi, bisa dibagikan ke unit",
    href: "/catatan",
    icon: NotebookPen,
  },
  {
    label: "Anggota tim",
    keterangan: "Struktur, penempatan, dan akun",
    href: "/tim",
    icon: Users,
  },
  {
    label: "Pengaturan tampilan",
    keterangan: "Pilih menu dan widget yang tampil untukmu",
    href: "/tampilan",
    icon: SlidersHorizontal,
    pintuLainDiDesktop: true,
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
 * `railDesktop` dipakai rail ikon kiri: menu yang sudah punya pintu
 * masuk lain di desktop tidak diulang di sana. Laci mobile
 * memanggilnya tanpa opsi itu, karena pintu-pintu itu tidak ada atau
 * tersembunyi di layar kecil.
 */
export function menuPendampingTerlihat(
  izin: Record<IzinMenu, boolean>,
  { railDesktop = false }: { railDesktop?: boolean } = {},
) {
  return menuPendamping.filter(
    (m) => (!m.izin || izin[m.izin]) && !(railDesktop && m.pintuLainDiDesktop),
  );
}

/**
 * Pintasan di app-bar atas — desktop saja.
 *
 * Tinggal di sini, bukan di komponennya, sejak halaman Pengaturan
 * Tampilan ikut menawarkannya untuk dicentang: dua daftar yang harus
 * sama persis pasti melenceng, dan yang melenceng di sini berarti
 * orang mencentang pintasan yang tidak pernah ada.
 */
export type PintasanAtas = {
  label: string;
  keterangan: string;
  href: string;
};

export const pintasanAtas: PintasanAtas[] = [
  {
    label: "Scan Sampel",
    keterangan: "Buka pemindai QR sampel",
    href: "/sampel/scan",
  },
  {
    label: "Kalender",
    keterangan: "Agenda unit dan perusahaan",
    href: "/kalender",
  },
  {
    label: "Goal",
    keterangan: "Pohon goal dan lead measure",
    href: "/grd/goal",
  },
  {
    label: "Kaizen",
    keterangan: "Lapor masalah dan solusinya",
    href: "/masalah",
  },
];
