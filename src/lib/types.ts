/**
 * Tipe domain K-Space V2 — mengikuti skema PostgreSQL di PRD §6.
 *
 * Modul murni: tidak mengimpor apa pun dari sisi server maupun klien,
 * sehingga aman dipakai Server Component dan komponen browser sekaligus.
 * Kedua mode data (`supabase` dan `demo`) memetakan ke tipe yang sama,
 * jadi berganti sumber data tidak mengubah kontraknya.
 */

export type Peran =
  "CEO" | "Manager" | "Leader" | "Co-Leader" | "Staff" | "Finance";

/** Tiga unit pelaporan (PRD §2). */
export type KodeUnit = "affiliator" | "mcn" | "tap";

export type Pengguna = {
  id: string;
  nama: string;
  email: string;
  role: Peran;
  jabatan: string;
  unitId: KodeUnit | null;
  fotoUrl: string | null;
  inisial: string;
};

export type Unit = {
  id: KodeUnit;
  nama: string;
  keterangan: string;
};

/** Keputusan matriks WRM (PRD §3 — Laporan Mingguan). */
export type KeputusanWrm = "LANJUT" | "SABAR" | "ALARM" | "UBAH CARA";

export type StatusTugas = "todo" | "berjalan" | "menunggu_qc" | "selesai";
export type TipeTugas = "pribadi" | "tiket" | "komitmen_mingguan";
export type Prioritas = "tinggi" | "sedang" | "rendah";

export type Tugas = {
  id: string;
  tipe: TipeTugas;
  judul: string;
  deskripsi: string;
  /** Nama pendek penerima, mis. "Rian H." */
  penerima: string;
  penerimaLengkap: string;
  pembuat: string;
  tenggat: string;
  prioritas: Prioritas;
  status: StatusTugas;
  /** Status apa adanya dari database, termasuk "revisi" & "dibatalkan". */
  statusAsli: StatusTugas | "revisi" | "dibatalkan";
  qcStatus: "belum" | "lolos" | "revisi";
  qcNote: string;
  /** Ringkasan hasil dari penerima tugas, dibaca pemeriksa. */
  hasilKerja: string;
  /** Goal induk untuk komitmen mingguan; null untuk tugas biasa. */
  goalJudul: string | null;
  goalPeriode: string | null;
  /** Waktu tugas ditandai selesai; null bila belum. */
  selesaiPada: string | null;
  label: string;
};

export type Pengumuman = {
  id: string;
  judul: string;
  /** Kalimat pembuka untuk kartu beranda. */
  ringkasan: string;
  /** Isi lengkap, per paragraf, untuk halaman detail. */
  isi: string[];
  /** Peran yang dituju; "Semua" berarti tampil untuk seluruh tim. */
  targetPeran: Peran | "Semua";
  targetUnit: string | null;
  dibuatOleh: string;
  jabatanPembuat: string;
  publishedAt: string;
  /** Ditempel di atas daftar dan tampil sebagai kartu utama di beranda. */
  disematkan: boolean;
};

/** Baris "GMV vs target" per unit untuk dasbor Beranda. */
export type CapaianUnit = {
  unitId: KodeUnit;
  nama: string;
  /** Nama singkat untuk legenda & ruang sempit. */
  namaPendek: string;
  keterangan: string;
  gmv: number;
  target: number;
  gmvKemarin: number;
  /** Akumulasi GMV unit sepanjang bulan berjalan. */
  gmvBulanIni: number;
  /** Anak tangga bulanan unit ini. */
  targetBulanan: number;
};

/** Status absensi harian seseorang (kolom `status` pada tabel `attendance`). */
export type StatusAbsen =
  "hadir" | "terlambat" | "izin" | "sakit" | "belum_absen";

/** Baris pantau kehadiran: satu anggota tim pada hari berjalan. */
export type AnggotaKehadiran = {
  id: string;
  nama: string;
  inisial: string;
  fotoUrl: string | null;
  unit: string;
  statusAbsen: StatusAbsen;
  jamMasuk: string | null;
  /** Orang ini memang punya sasaran laporan (PIC akun / Leader unit). */
  wajibLapor: boolean;
  /** Laporan harian hari ini sudah terkirim atau belum. */
  sudahLapor: boolean;
};

/** Butir to-do pribadi yang tampil di Beranda. */
export type ToDo = {
  id: string;
  judul: string;
  /** Konteks singkat: unit, akun, atau goal yang terkait. */
  konteks: string;
  jam: string | null;
  prioritas: Prioritas;
  selesai: boolean;
  /** Waktu tugas ditandai selesai; null bila belum. */
  selesaiPada: string | null;
};

export type RingkasanBeranda = {
  tanggal: string;
  disinkronPada: string;
  pengguna: Pengguna;
  gmvHariIni: number;
  gmvKemarin: number;
  targetHarian: number;
  targetBulanan: number;
  gmvBulanIni: number;
  sisaHariBulanIni: number;
  keputusanWrm: KeputusanWrm;
  catatanWrm: string;
  unit: CapaianUnit[];
  kehadiranTim: AnggotaKehadiran[];
  tugasMendesak: Tugas[];
  toDoHariIni: ToDo[];
  pengumuman: Pengumuman[];
};

/** Akun affiliator yang dipegang seorang PIC (tabel `accounts`). */
export type AkunAffiliator = {
  id: string;
  platform: string;
  username: string;
  picNama: string;
  unitId: KodeUnit;
  program: string | null;
  /** Target GMV harian akun ini, turunan dari GRD. */
  targetHarian: number;
  status: "aktif" | "nonaktif";
};

/** Sasaran laporan: per akun (Affiliator) atau per unit (MCN & TAP). */
export type SasaranLaporan =
  | { jenis: "akun"; akun: AkunAffiliator }
  | { jenis: "unit"; unitId: KodeUnit; nama: string; targetHarian: number };

/** Satu baris laporan harian (tabel `daily_reports`). */
export type LaporanHarian = {
  id: string;
  tanggal: string;
  akunId: string | null;
  unitId: KodeUnit | null;
  label: string;
  gmv: number;
  target: number;
  catatan: string;
  status: "terkirim" | "revisi";
  submittedAt: string;
  /** Jumlah revisi yang tercatat di `daily_report_revisions`. */
  jumlahRevisi: number;
};

/** Satu jejak perubahan angka GMV (tabel `daily_report_revisions`). */
export type RevisiLaporan = {
  id: string;
  reportId: string;
  gmvLama: number;
  gmvBaru: number;
  alasan: string;
  diubahOleh: string;
  createdAt: string;
};

export type PilihanOrganisasi = {
  departemen: { id: string; nama: string }[];
  unit: { kode: KodeUnit; nama: string }[];
  program: { id: string; nama: string; unitKode: KodeUnit | null }[];
  /** Akun affiliator aktif; dipakai mengaitkan sampel ke akunnya. */
  akun: { id: string; username: string; unitKode: KodeUnit | null }[];
};

export type AnggotaTim = {
  id: string;
  nama: string;
  email: string;
  role: Peran;
  jabatan: string;
  unitKode: KodeUnit | null;
  unitNama: string;
  departemenId: string | null;
  departemen: string | null;
  programId: string | null;
  program: string | null;
  atasanId: string | null;
  atasanNama: string | null;
  inisial: string;
  status: "aktif" | "nonaktif";
  /** Akun affiliator yang ia pegang sebagai PIC. */
  akunDipegang: number;
};

export type MataRantai = {
  tingkat: number;
  userId: string;
  nama: string;
  jabatan: string;
  role: Peran;
};
