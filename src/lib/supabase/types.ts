/**
 * Tipe skema database.
 *
 * Ditulis tangan mengikuti `supabase/migrations/*.sql`. Agar tidak pelan-pelan
 * melenceng dari SQL-nya, `npm run db:test` menjalankan pemeriksaan yang
 * membandingkan tipe di sini dengan skema nyata di PostgreSQL.
 */

export type PeranDb =
  "CEO" | "Manager" | "Leader" | "Co-Leader" | "Staff" | "Finance";

export type StatusAktifDb = "aktif" | "nonaktif";

export type StatusLaporanDb = "terkirim" | "revisi";

export type LevelGoalDb =
  "company" | "manager" | "leader" | "account" | "staff";

export type StatusGoalDb = "draft" | "aktif" | "selesai" | "dibatalkan";

export type TipeTugasDb = "pribadi" | "tiket" | "komitmen_mingguan";

export type StatusTugasDb =
  "todo" | "berjalan" | "menunggu_qc" | "revisi" | "selesai" | "dibatalkan";

export type PrioritasTugasDb = "rendah" | "sedang" | "tinggi";

export type StatusQcDb = "belum" | "lolos" | "revisi";

export type StatusKehadiranDb =
  "hadir" | "terlambat" | "izin" | "sakit" | "alpa";

export type StatusPersetujuanDb = "diajukan" | "disetujui" | "ditolak";

export type SumberKpiDb =
  "gmv" | "lead_measure" | "absensi" | "tiket" | "manual";

export type StatusMigrasiDb = "menunggu" | "berhasil" | "dilewati" | "gagal";

export type TahapMigrasiDb = "uji_coba" | "sungguhan";

export type JenisAgendaDb = "rapat" | "libur" | "pelatihan" | "lainnya";

export type JenisMasukanDb = "bug" | "saran" | "pertanyaan";

export type StatusMasukanDb =
  "baru" | "ditinjau" | "dikerjakan" | "selesai" | "ditolak";

export type KeparahanBugDb = "ringan" | "sedang" | "berat" | "kritis";

export type TingkatKursusDb = "dasar" | "menengah" | "lanjutan";

export type StatusMasalahDb = "baru" | "diproses" | "selesai" | "ditutup";

export type DampakMasalahDb = "rendah" | "sedang" | "tinggi";

export type StatusSampelDb =
  "tersedia" | "dipegang" | "dikirim" | "diterima" | "dikembalikan" | "hilang";

export type ArahTransaksiDb = "masuk" | "keluar";

export type JenisKeluarDb =
  "beban" | "aset" | "direct_cost" | "creator_share" | "dividen";

export type StatusTransaksiDb =
  "diajukan" | "disetujui" | "ditolak" | "dibayar";

export type StatusAsetDb =
  "dipakai" | "cadangan" | "perbaikan" | "hilang" | "dilepas";

export type PredikatKpiDb = "Istimewa" | "Baik" | "Cukup" | "Perlu Perbaikan";

export type WarnaWrmDb = "hijau" | "merah";

export type KeputusanWrmDb = "LANJUT" | "SABAR" | "ALARM" | "UBAH CARA";

export type KelompokTenggatDb =
  "terlambat" | "hari_ini" | "besok" | "nanti" | "tanpa_tenggat";

/** @tabel departments */
export type BarisDepartment = {
  id: string;
  nama: string;
  created_at: string;
};

/** @tabel units */
export type BarisUnit = {
  id: string;
  kode: "affiliator" | "mcn" | "tap";
  nama: string;
  department_id: string | null;
  deskripsi: string;
  created_at: string;
};

/** @tabel programs */
export type BarisProgram = {
  id: string;
  nama: string;
  unit_id: string;
  aktif: boolean;
  created_at: string;
};

/** @tabel users */
export type BarisUser = {
  id: string;
  nama: string;
  email: string | null;
  role: PeranDb;
  jabatan: string;
  department_id: string | null;
  unit_id: string | null;
  program_id: string | null;
  atasan_id: string | null;
  foto_url: string | null;
  /** Nomor WhatsApp dalam bentuk baku +62… (migrasi 0108). */
  kontak: string | null;
  /** Kapan nomor itu dibuktikan milik orangnya (migrasi 0117). */
  kontak_terverifikasi_pada: string | null;
  /** Persetujuan dihubungi lewat WhatsApp (migrasi 0117). */
  whatsapp_optin: boolean;
  status: StatusAktifDb;
  created_at: string;
  updated_at: string;
};

/** Kategori peristiwa notifikasi (migrasi 0111). */
export type KategoriNotifikasiDb =
  | "tugas"
  | "tenggat"
  | "pengumuman"
  | "izin"
  | "transaksi"
  | "anggaran"
  | "masukan";

/** @tabel notifications */
export type BarisNotification = {
  id: string;
  user_id: string;
  kategori: KategoriNotifikasiDb;
  judul: string;
  pesan: string;
  tautan: string;
  dibaca_pada: string | null;
  created_at: string;
};

export type StatusKirimWaDb = "antre" | "terkirim" | "gagal";

// Antrean dan riwayat pengiriman WhatsApp (migrasi 0117).
/** @tabel notification_delivery */
export type BarisNotificationDelivery = {
  id: string;
  notification_id: string;
  tujuan: string;
  status: StatusKirimWaDb;
  percobaan: number;
  galat: string;
  dikirim_pada: string | null;
  created_at: string;
};

// Satu baris per percobaan kirim WhatsApp (migrasi 0118).
/** @tabel notification_delivery_attempts */
export type BarisNotificationDeliveryAttempt = {
  id: string;
  delivery_id: string;
  urutan: number;
  status: StatusKirimWaDb;
  galat: string;
  balasan: string;
  created_at: string;
};

// Preferensi per pengguna per kategori (migrasi 0115). Baris yang tidak
// ada berarti ikut bawaan: in-app menyala, WhatsApp mati.
/** @tabel notification_preferences */
export type BarisNotificationPreference = {
  user_id: string;
  kategori: KategoriNotifikasiDb;
  in_app: boolean;
  whatsapp: boolean;
  updated_at: string;
};

// Penanda agar pengingat tenggat tidak terbit dua kali (migrasi 0113).
// Milik sistem: RLS menutupnya untuk semua pengguna.
/** @tabel notifikasi_tenggat_terkirim */
export type BarisNotifikasiTenggatTerkirim = {
  task_id: string;
  tahap: "mendekat" | "lewat";
  terkirim: string;
};

/** @tabel accounts */
export type BarisAccount = {
  id: string;
  platform: string;
  username: string;
  pic_user_id: string | null;
  co_leader_id: string | null;
  unit_id: string;
  program_id: string | null;
  status: StatusAktifDb;
  created_at: string;
};

/** @tabel announcements */
export type BarisAnnouncement = {
  id: string;
  slug: string;
  judul: string;
  ringkasan: string;
  isi: string[];
  target_role: PeranDb | null;
  target_unit_id: string | null;
  disematkan: boolean;
  dibuat_oleh: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Metadata relasi dipakai supabase-js untuk mengetik hasil join
 * (`select("…, units:unit_id (kode)")`). Bentuknya mengikuti keluaran
 * `supabase gen types`; tanpa ini hasil join bertipe `never`.
 */
/** @tabel daily_reports */
export type BarisDailyReport = {
  id: string;
  user_id: string;
  tanggal: string;
  account_id: string | null;
  unit_id: string | null;
  gmv: number;
  catatan: string;
  status: StatusLaporanDb;
  submitted_at: string;
  updated_at: string;
};

/** @tabel daily_report_revisions */
export type BarisDailyReportRevision = {
  id: string;
  report_id: string;
  gmv_lama: number;
  gmv_baru: number;
  alasan: string;
  diubah_oleh: string | null;
  created_at: string;
};

/** @tabel goals */
export type BarisGoal = {
  id: string;
  judul: string;
  level: LevelGoalDb;
  pemilik_id: string | null;
  unit_id: string | null;
  account_id: string | null;
  parent_goal_id: string | null;
  satuan: string;
  target_base: number;
  target_goal: number;
  target_stretch: number;
  bobot: number;
  periode: string;
  dibuat_oleh: string | null;
  status: StatusGoalDb;
  created_at: string;
  updated_at: string;
};

/** @tabel goal_months */
export type BarisGoalMonth = {
  id: string;
  goal_id: string;
  bulan: string;
  target: number;
};

/** @tabel tasks */
export type BarisTask = {
  id: string;
  tipe: TipeTugasDb;
  goal_id: string | null;
  judul: string;
  deskripsi: string;
  konteks: string;
  pembuat_id: string;
  penerima_id: string;
  tenggat: string | null;
  prioritas: PrioritasTugasDb;
  status: StatusTugasDb;
  qc_status: StatusQcDb;
  qc_by: string | null;
  qc_note: string;
  hasil_kerja: string;
  qc_at: string | null;
  selesai_at: string | null;
  created_at: string;
  updated_at: string;
};

/** @tabel pengaturan */
export type BarisPengaturan = {
  id: boolean;
  kantor_lat: number;
  kantor_lng: number;
  radius_meter: number;
  jam_masuk: string;
  toleransi_menit: number;
  lama_readonly: boolean;
  lama_readonly_pada: string | null;
  lama_readonly_oleh: string | null;
  lama_url: string;
  updated_at: string;
};

/** @tabel attendance */
export type BarisAttendance = {
  id: string;
  user_id: string;
  tanggal: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  foto_masuk_url: string | null;
  foto_pulang_url: string | null;
  lat_masuk: number | null;
  lng_masuk: number | null;
  lat_pulang: number | null;
  lng_pulang: number | null;
  jarak_masuk_m: number | null;
  lokasi_valid: boolean;
  terlambat: boolean;
  status: StatusKehadiranDb;
  alasan: string;
  persetujuan: StatusPersetujuanDb | null;
  disetujui_oleh: string | null;
  disetujui_pada: string | null;
  created_at: string;
  updated_at: string;
};

/** @tabel task_qc_log */
export type BarisTaskQcLog = {
  id: string;
  task_id: string;
  hasil: Exclude<StatusQcDb, "belum">;
  catatan: string;
  hasil_kerja: string;
  diperiksa_oleh: string | null;
  created_at: string;
};

/** @tabel lead_measures */
export type BarisLeadMeasure = {
  id: string;
  goal_id: string;
  judul: string;
  satuan: string;
  target_mingguan: number;
  label_pendukung: string | null;
  aktif: boolean;
  urutan: number;
  created_at: string;
};

/** @tabel lead_measure_entries */
export type BarisLeadMeasureEntry = {
  id: string;
  lead_measure_id: string;
  user_id: string | null;
  tanggal: string;
  nilai: number;
  nilai_pendukung: number | null;
  catatan: string;
  created_at: string;
};

/** @tabel kpi_definitions */
export type BarisKpiDefinition = {
  id: string;
  jabatan: string;
  nama_kpi: string;
  periode: string;
  bobot: number;
  satuan: string;
  skala: number;
  target_base: number;
  target_goal: number;
  target_stretch: number;
  sumber_data: SumberKpiDb;
  aktif: boolean;
  created_at: string;
};

/** @tabel agenda */
export type BarisAgenda = {
  id: string;
  judul: string;
  keterangan: string;
  jenis: JenisAgendaDb;
  tanggal: string;
  jam_mulai: string | null;
  jam_selesai: string | null;
  unit_id: string | null;
  lokasi: string;
  dibuat_oleh: string | null;
  created_at: string;
};

/** @tabel feedback */
export type BarisFeedback = {
  id: string;
  jenis: JenisMasukanDb;
  judul: string;
  isi: string;
  keparahan: KeparahanBugDb | null;
  halaman: string;
  status: StatusMasukanDb;
  alasan_tolak: string;
  dilaporkan_oleh: string | null;
  ditugaskan_ke: string | null;
  created_at: string;
  updated_at: string;
};

/** @tabel feedback_votes */
export type BarisFeedbackVote = {
  feedback_id: string;
  user_id: string;
  created_at: string;
};

/** @tabel feedback_comments */
export type BarisFeedbackComment = {
  id: string;
  feedback_id: string;
  oleh_id: string | null;
  isi: string;
  created_at: string;
};

/** @tabel feedback_events */
export type BarisFeedbackEvent = {
  id: string;
  feedback_id: string;
  dari: StatusMasukanDb | null;
  ke: StatusMasukanDb;
  oleh_id: string | null;
  catatan: string;
  pada: string;
};

/** @tabel quiz_questions */
export type BarisQuizQuestion = {
  id: string;
  module_id: string;
  urutan: number;
  pertanyaan: string;
  pilihan: string[];
  created_at: string;
};

/** @tabel quiz_keys */
export type BarisQuizKey = {
  question_id: string;
  jawaban_benar: number;
  penjelasan: string;
};

/** @tabel quiz_attempts */
export type BarisQuizAttempt = {
  id: string;
  enrollment_id: string;
  module_id: string;
  skor: number;
  lulus: boolean;
  dikerjakan_pada: string;
};

/** @tabel courses */
export type BarisCourse = {
  id: string;
  judul: string;
  ringkasan: string;
  kategori: string;
  tingkat: TingkatKursusDb;
  unit_id: string | null;
  wajib_untuk: PeranDb[];
  aktif: boolean;
  dibuat_oleh: string | null;
  created_at: string;
};

/** @tabel course_modules */
export type BarisCourseModule = {
  id: string;
  course_id: string;
  urutan: number;
  judul: string;
  isi: string;
  durasi_menit: number;
  created_at: string;
};

/** @tabel course_enrollments */
export type BarisCourseEnrollment = {
  id: string;
  course_id: string;
  user_id: string;
  dimulai_pada: string;
  selesai_pada: string | null;
};

/** @tabel module_progress */
export type BarisModuleProgress = {
  id: string;
  enrollment_id: string;
  module_id: string;
  selesai_pada: string;
};

/** @tabel problems */
export type BarisProblem = {
  id: string;
  judul: string;
  konteks: string;
  unit_id: string | null;
  dilaporkan_oleh: string | null;
  dampak: DampakMasalahDb;
  status: StatusMasalahDb;
  /** Jawaban manajemen; wajib terisi sebelum status selesai (0121). */
  solusi: string;
  ditutup_alasan: string;
  created_at: string;
  updated_at: string;
};

/** @tabel problem_events */
export type BarisProblemEvent = {
  id: string;
  problem_id: string;
  dari: StatusMasalahDb | null;
  ke: StatusMasalahDb;
  oleh_id: string | null;
  catatan: string;
  pada: string;
};

/** @tabel samples */
export type BarisSample = {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  unit_id: string | null;
  nilai: number;
  status: StatusSampelDb;
  pemegang_id: string | null;
  /** Akun affiliator yang memakai sampel ini. */
  account_id: string | null;
  kreator: string;
  /** Brand atau seller pemilik produk. */
  brand: string;
  /** Tautan etalase produk; bisa diganti tanpa mencetak ulang QR. */
  link_produk: string | null;
  catatan: string;
  created_at: string;
  updated_at: string;
};

/** @tabel transactions */
export type BarisTransaction = {
  id: string;
  tanggal: string;
  arah: ArahTransaksiDb;
  /** Wajib untuk arah keluar, kosong untuk arah masuk. */
  jenis: JenisKeluarDb | null;
  unit_id: string | null;
  account_id: string | null;
  keterangan: string;
  jumlah: number;
  status: StatusTransaksiDb;
  diajukan_id: string | null;
  disetujui_id: string | null;
  diputuskan_pada: string | null;
  catatan_keputusan: string;
  created_at: string;
  updated_at: string;
};

/** @tabel assets */
export type BarisAsset = {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  unit_id: string | null;
  /** Tanggal perolehan — awal masa penyusutan. */
  tanggal: string;
  nilai_perolehan: number;
  /** Masa manfaat dalam bulan; 0 berarti tidak disusutkan. */
  masa_manfaat: number;
  residu: number;
  status: StatusAsetDb;
  pemegang_id: string | null;
  lokasi: string;
  /** Tanggal berhenti disusutkan: dilepas atau dinyatakan hilang. */
  berakhir: string | null;
  transaction_id: string | null;
  catatan: string;
  created_at: string;
  updated_at: string;
};

/** @tabel asset_events */
export type BarisAssetEvent = {
  id: string;
  asset_id: string;
  dari: StatusAsetDb | null;
  ke: StatusAsetDb;
  oleh_id: string | null;
  pemegang_id: string | null;
  lokasi: string;
  catatan: string;
  pada: string;
};

// View tanpa kolom rupiah; dipakai pengguna yang tidak berhak melihat
// angka perusahaan (migrasi 0102).
/** @tabel aset_publik */
export type BarisAsetPublik = {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  unit_id: string | null;
  unit_kode: string | null;
  unit_nama: string;
  tanggal: string;
  status: StatusAsetDb;
  pemegang_id: string | null;
  pemegang_nama: string | null;
  lokasi: string;
  berakhir: string | null;
  catatan: string;
};

/** @tabel transaction_approvals */
export type BarisTransactionApproval = {
  id: string;
  transaction_id: string;
  dari: StatusTransaksiDb | null;
  ke: StatusTransaksiDb;
  oleh_id: string | null;
  catatan: string;
  /** Posisi kas saat keputusan diambil — dasar ambang wewenang CEO. */
  saldo_kas: number;
  penyetuju_wajib: PeranDb | null;
  pada: string;
};

/** @tabel keuangan_pengaturan */
export type BarisKeuanganPengaturan = {
  id: boolean;
  kas_awal: number;
  /** Masa manfaat bawaan (bulan) untuk aset yang lahir dari transaksi. */
  masa_manfaat_bawaan: number;
  updated_at: string;
};

/** @tabel sample_events */
export type BarisSampleEvent = {
  id: string;
  sample_id: string;
  dari: StatusSampelDb | null;
  ke: StatusSampelDb;
  oleh_id: string | null;
  pemegang_id: string | null;
  kreator: string;
  catatan: string;
  pada: string;
};

/** @tabel migrasi_persetujuan */
export type BarisMigrasiPersetujuan = {
  id: string;
  entitas: string;
  versi: string;
  disetujui_oleh: string;
  disetujui_pada: string;
  catatan: string;
  /** Salinan isi pemetaan saat disetujui. */
  pemetaan: unknown;
};

/** @tabel migrasi_jalan */
export type BarisMigrasiJalan = {
  id: string;
  tahap: TahapMigrasiDb;
  sumber: string;
  dijalankan_oleh: string | null;
  dimulai_pada: string;
  selesai_pada: string | null;
  catatan: string;
  /** Pemetaan seluruh entitas yang dipakai jalan ini. */
  pemetaan: unknown;
  created_at: string;
};

/** @tabel migrasi_catatan */
export type BarisMigrasiCatatan = {
  id: string;
  jalan_id: string;
  entitas: string;
  kunci_lama: string;
  id_baru: string | null;
  status: StatusMigrasiDb;
  pesan: string;
  created_at: string;
};

/** @tabel sample_scans */
export type BarisSampleScan = {
  id: string;
  kode: string;
  sample_id: string | null;
  oleh_id: string;
  dikenali: boolean;
  kejadian_id: string | null;
  pada: string;
};

/** @tabel kspace_lama_log */
export type BarisKspaceLamaLog = {
  id: string;
  readonly: boolean;
  oleh: string | null;
  pada: string;
  catatan: string;
};

/** @tabel kv_store_lama */
export type BarisKvStoreLama = {
  key: string;
  value: unknown;
  /** Diturunkan database dari awalan kunci; tidak pernah ditulis aplikasi. */
  entitas: string;
  dimuat_pada: string;
};

/** @tabel kpi_snapshots */
export type BarisKpiSnapshot = {
  id: string;
  user_id: string;
  periode_bulan: string;
  skor_total: number;
  predikat: PredikatKpiDb;
  cakupan: number;
  detail: unknown;
  dikunci_oleh: string | null;
  dikunci_pada: string | null;
  created_at: string;
};

/** @tabel weekly_reports */
export type BarisWeeklyReport = {
  id: string;
  user_id: string | null;
  unit_id: string | null;
  periode: string;
  target_mingguan: number;
  gmv_total: number;
  rasio_hasil: number;
  rasio_kri: number;
  status_hasil: WarnaWrmDb;
  status_kri: WarnaWrmDb;
  keputusan: KeputusanWrmDb;
  merah_beruntun: number;
  ringkasan: string;
  skor_kpi: number | null;
  generated_at: string;
};

/** @tabel audit_logs */
export type BarisAuditLog = {
  id: string;
  user_id: string | null;
  aksi: string;
  entitas: string;
  entitas_id: string | null;
  nilai_lama: unknown;
  nilai_baru: unknown;
  created_at: string;
};

type Relasi<
  Nama extends string,
  Kolom extends string,
  Tujuan extends string,
> = {
  foreignKeyName: Nama;
  columns: [Kolom];
  isOneToOne: false;
  referencedRelation: Tujuan;
  referencedColumns: ["id"];
};

type Tabel<Baris, Rel extends readonly unknown[] = []> = {
  Row: Baris;
  Insert: Partial<Baris>;
  Update: Partial<Baris>;
  Relationships: Rel;
};

export type Database = {
  public: {
    Tables: {
      notifications: Tabel<
        BarisNotification,
        [Relasi<"notifications_user_id_fkey", "user_id", "users">]
      >;
      notification_delivery: Tabel<
        BarisNotificationDelivery,
        [
          Relasi<
            "notification_delivery_notification_id_fkey",
            "notification_id",
            "notifications"
          >,
        ]
      >;
      notification_delivery_attempts: Tabel<
        BarisNotificationDeliveryAttempt,
        [
          Relasi<
            "notification_delivery_attempts_delivery_id_fkey",
            "delivery_id",
            "notification_delivery"
          >,
        ]
      >;
      notification_preferences: Tabel<
        BarisNotificationPreference,
        [Relasi<"notification_preferences_user_id_fkey", "user_id", "users">]
      >;
      notifikasi_tenggat_terkirim: Tabel<
        BarisNotifikasiTenggatTerkirim,
        [Relasi<"notifikasi_tenggat_terkirim_task_id_fkey", "task_id", "tasks">]
      >;
      departments: Tabel<BarisDepartment>;
      units: Tabel<
        BarisUnit,
        [Relasi<"units_department_id_fkey", "department_id", "departments">]
      >;
      programs: Tabel<
        BarisProgram,
        [Relasi<"programs_unit_id_fkey", "unit_id", "units">]
      >;
      users: Tabel<
        BarisUser,
        [
          Relasi<"users_unit_id_fkey", "unit_id", "units">,
          Relasi<"users_department_id_fkey", "department_id", "departments">,
          Relasi<"users_program_id_fkey", "program_id", "programs">,
          Relasi<"users_atasan_id_fkey", "atasan_id", "users">,
        ]
      >;
      accounts: Tabel<
        BarisAccount,
        [
          Relasi<"accounts_unit_id_fkey", "unit_id", "units">,
          Relasi<"accounts_pic_user_id_fkey", "pic_user_id", "users">,
          Relasi<"accounts_co_leader_id_fkey", "co_leader_id", "users">,
          Relasi<"accounts_program_id_fkey", "program_id", "programs">,
        ]
      >;
      daily_reports: Tabel<
        BarisDailyReport,
        [
          Relasi<"daily_reports_user_id_fkey", "user_id", "users">,
          Relasi<"daily_reports_account_id_fkey", "account_id", "accounts">,
          Relasi<"daily_reports_unit_id_fkey", "unit_id", "units">,
        ]
      >;
      daily_report_revisions: Tabel<
        BarisDailyReportRevision,
        [
          Relasi<
            "daily_report_revisions_report_id_fkey",
            "report_id",
            "daily_reports"
          >,
          Relasi<
            "daily_report_revisions_diubah_oleh_fkey",
            "diubah_oleh",
            "users"
          >,
        ]
      >;
      goals: Tabel<
        BarisGoal,
        [
          Relasi<"goals_pemilik_id_fkey", "pemilik_id", "users">,
          Relasi<"goals_unit_id_fkey", "unit_id", "units">,
          Relasi<"goals_account_id_fkey", "account_id", "accounts">,
          Relasi<"goals_parent_goal_id_fkey", "parent_goal_id", "goals">,
        ]
      >;
      goal_months: Tabel<
        BarisGoalMonth,
        [Relasi<"goal_months_goal_id_fkey", "goal_id", "goals">]
      >;
      pengaturan: Tabel<
        BarisPengaturan,
        [
          Relasi<
            "pengaturan_lama_readonly_oleh_fkey",
            "lama_readonly_oleh",
            "users"
          >,
        ]
      >;
      attendance: Tabel<
        BarisAttendance,
        [
          Relasi<"attendance_user_id_fkey", "user_id", "users">,
          Relasi<"attendance_disetujui_oleh_fkey", "disetujui_oleh", "users">,
        ]
      >;
      lead_measures: Tabel<
        BarisLeadMeasure,
        [Relasi<"lead_measures_goal_id_fkey", "goal_id", "goals">]
      >;
      lead_measure_entries: Tabel<
        BarisLeadMeasureEntry,
        [
          Relasi<
            "lead_measure_entries_lead_measure_id_fkey",
            "lead_measure_id",
            "lead_measures"
          >,
          Relasi<"lead_measure_entries_user_id_fkey", "user_id", "users">,
        ]
      >;
      agenda: Tabel<
        BarisAgenda,
        [
          Relasi<"agenda_unit_id_fkey", "unit_id", "units">,
          Relasi<"agenda_dibuat_oleh_fkey", "dibuat_oleh", "users">,
        ]
      >;
      feedback: Tabel<
        BarisFeedback,
        [
          Relasi<"feedback_dilaporkan_oleh_fkey", "dilaporkan_oleh", "users">,
          Relasi<"feedback_ditugaskan_ke_fkey", "ditugaskan_ke", "users">,
        ]
      >;
      feedback_votes: Tabel<
        BarisFeedbackVote,
        [
          Relasi<"feedback_votes_feedback_id_fkey", "feedback_id", "feedback">,
          Relasi<"feedback_votes_user_id_fkey", "user_id", "users">,
        ]
      >;
      feedback_comments: Tabel<
        BarisFeedbackComment,
        [
          Relasi<
            "feedback_comments_feedback_id_fkey",
            "feedback_id",
            "feedback"
          >,
          Relasi<"feedback_comments_oleh_id_fkey", "oleh_id", "users">,
        ]
      >;
      feedback_events: Tabel<
        BarisFeedbackEvent,
        [
          Relasi<"feedback_events_feedback_id_fkey", "feedback_id", "feedback">,
          Relasi<"feedback_events_oleh_id_fkey", "oleh_id", "users">,
        ]
      >;
      quiz_questions: Tabel<
        BarisQuizQuestion,
        [Relasi<"quiz_questions_module_id_fkey", "module_id", "course_modules">]
      >;
      quiz_keys: Tabel<
        BarisQuizKey,
        [Relasi<"quiz_keys_question_id_fkey", "question_id", "quiz_questions">]
      >;
      quiz_attempts: Tabel<
        BarisQuizAttempt,
        [
          Relasi<
            "quiz_attempts_enrollment_id_fkey",
            "enrollment_id",
            "course_enrollments"
          >,
          Relasi<"quiz_attempts_module_id_fkey", "module_id", "course_modules">,
        ]
      >;
      courses: Tabel<
        BarisCourse,
        [
          Relasi<"courses_unit_id_fkey", "unit_id", "units">,
          Relasi<"courses_dibuat_oleh_fkey", "dibuat_oleh", "users">,
        ]
      >;
      course_modules: Tabel<
        BarisCourseModule,
        [Relasi<"course_modules_course_id_fkey", "course_id", "courses">]
      >;
      course_enrollments: Tabel<
        BarisCourseEnrollment,
        [
          Relasi<"course_enrollments_course_id_fkey", "course_id", "courses">,
          Relasi<"course_enrollments_user_id_fkey", "user_id", "users">,
        ]
      >;
      module_progress: Tabel<
        BarisModuleProgress,
        [
          Relasi<
            "module_progress_enrollment_id_fkey",
            "enrollment_id",
            "course_enrollments"
          >,
          Relasi<
            "module_progress_module_id_fkey",
            "module_id",
            "course_modules"
          >,
        ]
      >;
      problems: Tabel<
        BarisProblem,
        [
          Relasi<"problems_unit_id_fkey", "unit_id", "units">,
          Relasi<"problems_dilaporkan_oleh_fkey", "dilaporkan_oleh", "users">,
        ]
      >;
      problem_events: Tabel<
        BarisProblemEvent,
        [
          Relasi<"problem_events_problem_id_fkey", "problem_id", "problems">,
          Relasi<"problem_events_oleh_id_fkey", "oleh_id", "users">,
        ]
      >;
      samples: Tabel<
        BarisSample,
        [
          Relasi<"samples_unit_id_fkey", "unit_id", "units">,
          Relasi<"samples_pemegang_id_fkey", "pemegang_id", "users">,
          Relasi<"samples_account_id_fkey", "account_id", "accounts">,
        ]
      >;
      transactions: Tabel<
        BarisTransaction,
        [
          Relasi<"transactions_unit_id_fkey", "unit_id", "units">,
          Relasi<"transactions_account_id_fkey", "account_id", "accounts">,
          Relasi<"transactions_diajukan_id_fkey", "diajukan_id", "users">,
          Relasi<"transactions_disetujui_id_fkey", "disetujui_id", "users">,
        ]
      >;
      transaction_approvals: Tabel<
        BarisTransactionApproval,
        [
          Relasi<
            "transaction_approvals_transaction_id_fkey",
            "transaction_id",
            "transactions"
          >,
          Relasi<"transaction_approvals_oleh_id_fkey", "oleh_id", "users">,
        ]
      >;
      keuangan_pengaturan: Tabel<BarisKeuanganPengaturan, []>;
      assets: Tabel<
        BarisAsset,
        [
          Relasi<"assets_unit_id_fkey", "unit_id", "units">,
          Relasi<"assets_pemegang_id_fkey", "pemegang_id", "users">,
          Relasi<
            "assets_transaction_id_fkey",
            "transaction_id",
            "transactions"
          >,
        ]
      >;
      aset_publik: Tabel<BarisAsetPublik, []>;
      asset_events: Tabel<
        BarisAssetEvent,
        [
          Relasi<"asset_events_asset_id_fkey", "asset_id", "assets">,
          Relasi<"asset_events_oleh_id_fkey", "oleh_id", "users">,
          Relasi<"asset_events_pemegang_id_fkey", "pemegang_id", "users">,
        ]
      >;
      sample_events: Tabel<
        BarisSampleEvent,
        [
          Relasi<"sample_events_sample_id_fkey", "sample_id", "samples">,
          Relasi<"sample_events_oleh_id_fkey", "oleh_id", "users">,
          Relasi<"sample_events_pemegang_id_fkey", "pemegang_id", "users">,
        ]
      >;
      migrasi_persetujuan: Tabel<
        BarisMigrasiPersetujuan,
        [
          Relasi<
            "migrasi_persetujuan_disetujui_oleh_fkey",
            "disetujui_oleh",
            "users"
          >,
        ]
      >;
      migrasi_jalan: Tabel<
        BarisMigrasiJalan,
        [
          Relasi<
            "migrasi_jalan_dijalankan_oleh_fkey",
            "dijalankan_oleh",
            "users"
          >,
        ]
      >;
      migrasi_catatan: Tabel<
        BarisMigrasiCatatan,
        [Relasi<"migrasi_catatan_jalan_id_fkey", "jalan_id", "migrasi_jalan">]
      >;
      kv_store_lama: Tabel<BarisKvStoreLama>;
      sample_scans: Tabel<
        BarisSampleScan,
        [
          Relasi<"sample_scans_sample_id_fkey", "sample_id", "samples">,
          Relasi<"sample_scans_oleh_id_fkey", "oleh_id", "users">,
        ]
      >;
      kspace_lama_log: Tabel<
        BarisKspaceLamaLog,
        [Relasi<"kspace_lama_log_oleh_fkey", "oleh", "users">]
      >;
      kpi_definitions: Tabel<BarisKpiDefinition>;
      kpi_snapshots: Tabel<
        BarisKpiSnapshot,
        [
          Relasi<"kpi_snapshots_user_id_fkey", "user_id", "users">,
          Relasi<"kpi_snapshots_dikunci_oleh_fkey", "dikunci_oleh", "users">,
        ]
      >;
      weekly_reports: Tabel<
        BarisWeeklyReport,
        [
          Relasi<"weekly_reports_user_id_fkey", "user_id", "users">,
          Relasi<"weekly_reports_unit_id_fkey", "unit_id", "units">,
        ]
      >;
      audit_logs: Tabel<
        BarisAuditLog,
        [Relasi<"audit_logs_user_id_fkey", "user_id", "users">]
      >;
      task_qc_log: Tabel<
        BarisTaskQcLog,
        [
          Relasi<"task_qc_log_task_id_fkey", "task_id", "tasks">,
          Relasi<"task_qc_log_diperiksa_oleh_fkey", "diperiksa_oleh", "users">,
        ]
      >;
      tasks: Tabel<
        BarisTask,
        [
          Relasi<"tasks_pembuat_id_fkey", "pembuat_id", "users">,
          Relasi<"tasks_penerima_id_fkey", "penerima_id", "users">,
          Relasi<"tasks_goal_id_fkey", "goal_id", "goals">,
          Relasi<"tasks_qc_by_fkey", "qc_by", "users">,
        ]
      >;
      announcements: Tabel<
        BarisAnnouncement,
        [
          Relasi<"announcements_dibuat_oleh_fkey", "dibuat_oleh", "users">,
          Relasi<
            "announcements_target_unit_id_fkey",
            "target_unit_id",
            "units"
          >,
        ]
      >;
    };
    Views: Record<string, never>;
    Functions: {
      /** Ringkasan keuangan satu periode; NPM terhadap net revenue. */
      ringkas_keuangan: {
        Args: { p_dari?: string | null; p_sampai?: string | null };
        Returns: {
          pendapatan: number;
          direct_cost: number;
          creator_share: number;
          net_revenue: number;
          beban: number;
          aset: number;
          dividen: number;
          laba_bersih: number;
          npm: number;
          saldo_kas: number;
          menunggu_persetujuan: number;
        }[];
      };
      /** Pendapatan bersih tiap unit beserta porsinya. */
      kontribusi_unit: {
        Args: { p_dari?: string | null; p_sampai?: string | null };
        Returns: {
          unit_id: string;
          unit_kode: string;
          unit_nama: string;
          pendapatan: number;
          direct_cost: number;
          creator_share: number;
          net_revenue: number;
          porsi: number;
        }[];
      };
      /** Arus kas satu periode, sudah berurut. */
      laporan_cash_flow: {
        Args: { p_dari?: string | null; p_sampai?: string | null };
        Returns: {
          urutan: number;
          label: string;
          nilai: number;
          total: boolean;
          catatan: string;
        }[];
      };
      /** Laba rugi satu periode. */
      laporan_laba_rugi: {
        Args: { p_dari?: string | null; p_sampai?: string | null };
        Returns: {
          urutan: number;
          label: string;
          nilai: number;
          total: boolean;
          catatan: string;
        }[];
      };
      /** Langkah dari pendapatan ke laba bersih. */
      waterfall_manajemen: {
        Args: { p_dari?: string | null; p_sampai?: string | null };
        Returns: {
          urutan: number;
          label: string;
          nilai: number;
          total: boolean;
        }[];
      };
      /** Riwayat perpindahan aset tanpa angka rupiah. */
      riwayat_aset: {
        Args: { p_kode?: string | null; p_batas?: number | null };
        Returns: {
          id: string;
          asset_id: string;
          kode: string;
          nama_aset: string;
          unit_nama: string;
          dari: StatusAsetDb | null;
          ke: StatusAsetDb;
          pemegang_nama: string | null;
          oleh_nama: string | null;
          lokasi: string;
          catatan: string;
          pada: string;
        }[];
      };
      /** Nilai buku tiap aset pada satu tanggal. */
      nilai_buku_aset: {
        Args: { p_sampai?: string | null };
        Returns: {
          id: string;
          kode: string;
          nama: string;
          kategori: string;
          unit_nama: string;
          status: StatusAsetDb;
          tanggal: string;
          nilai_perolehan: number;
          akumulasi_penyusutan: number;
          nilai_buku: number;
          sisa_masa_manfaat: number;
        }[];
      };
      /** Ringkasan nilai seluruh aset yang masih dimiliki. */
      ringkas_nilai_aset: {
        Args: { p_sampai?: string | null };
        Returns: {
          dimiliki: number;
          total: number;
          nilai_perolehan: number;
          akumulasi_penyusutan: number;
          nilai_buku: number;
          perlu_perhatian: number;
          tanpa_pemegang: number;
          nilai_hilang: number;
          susut_bulan_ini: number;
        }[];
      };
      /** Aset yang datanya belum utuh — biasanya bawaan dari transaksi. */
      aset_perlu_dilengkapi: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          kode: string;
          nama: string;
          tanggal: string;
          nilai_perolehan: number;
          alasan: string;
        }[];
      };
      /** Jejak perubahan data aset (nilai, masa manfaat, status). */
      audit_aset: {
        Args: { p_aset?: string | null; p_batas?: number | null };
        Returns: {
          id: string;
          aset_id: string | null;
          kode: string | null;
          nama_aset: string | null;
          aksi: string;
          oleh_nama: string | null;
          nilai_lama: Record<string, unknown> | null;
          nilai_baru: Record<string, unknown> | null;
          pada: string;
        }[];
      };
      /** Aset yang sedang dipegang seseorang. */
      aset_dipegang: {
        Args: { p_user?: string | null };
        Returns: {
          id: string;
          kode: string;
          nama: string;
          kategori: string;
          unit_nama: string;
          status: StatusAsetDb;
          lokasi: string;
          sejak: string | null;
        }[];
      };
      /** Kas awal + seluruh mutasi berstatus dibayar. */
      saldo_kas: {
        Args: Record<string, never>;
        Returns: number;
      };
      /** Satu baris per unit: GMV hari ini & kemarin vs target. */
      /** Kehadiran + status laporan tiap anggota pada satu tanggal. */
      status_tim_harian: {
        Args: { p_tanggal: string };
        Returns: {
          user_id: string;
          nama: string;
          inisial: string;
          unit_nama: string;
          status: StatusKehadiranDb;
          jam_masuk: string | null;
          terlambat: boolean;
          lokasi_valid: boolean;
          persetujuan: StatusPersetujuanDb | null;
          wajib_lapor: boolean;
          sudah_lapor: boolean;
        }[];
      };
      /** Scorecard KPI seluruh tim yang terlihat pemanggil. */
      scorecard_tim: {
        Args: { p_bulan: string; p_sampai?: string };
        Returns: {
          user_id: string;
          nama: string;
          inisial: string;
          jabatan: string;
          unit: string;
          skor: number;
          predikat: PredikatKpiDb;
          cakupan: number;
          detail: unknown;
          terkunci: boolean;
        }[];
      };
      /** Skor KPI satu orang beserta rincian indikatornya. */
      hitung_kpi: {
        Args: { p_user: string; p_bulan: string; p_sampai?: string };
        Returns: {
          skor_total: number;
          predikat: PredikatKpiDb;
          cakupan: number;
          detail: unknown;
        }[];
      };
      /** Status penguncian KPI sebuah bulan. */
      status_kunci_kpi: {
        Args: { p_bulan: string };
        Returns: {
          terkunci: number;
          belum: number;
          dikunci_oleh: string | null;
          dikunci_pada: string | null;
          bulan_tuntas: boolean;
        }[];
      };
      /** Kunci KPI satu bulan; mengembalikan jumlah snapshot baru. */
      kunci_kpi_bulan: {
        Args: { p_bulan: string };
        Returns: number;
      };
      /** Ringkasan status migrasi per entitas. */
      ringkas_migrasi: {
        Args: { p_jalan?: string };
        Returns: {
          entitas: string;
          total: number;
          berhasil: number;
          dilewati: number;
          gagal: number;
          menunggu: number;
        }[];
      };
      /** Menilai kuis satu modul; kunci jawabannya tidak pernah dikembalikan. */
      nilai_kuis: {
        Args: { p_module: string; p_jawaban: number[] };
        Returns: {
          skor: number;
          lulus: boolean;
          benar: number;
          total: number;
        }[];
      };
      hitung_laporan_mingguan: {
        Args: { p_pekan: string; p_sampai?: string };
        Returns: {
          unit_id: string;
          unit_kode: string;
          target: number;
          gmv: number;
          rasio_hasil: number;
          rasio_kri: number;
          status_hasil: WarnaWrmDb;
          status_kri: WarnaWrmDb;
        }[];
      };
      verifikasi_migrasi: {
        Args: { p_jalan?: string };
        Returns: {
          entitas: string;
          berhasil: number;
          ada_di_tujuan: number;
          tanpa_id: number;
          hilang: number;
        }[];
      };
      kode_sampel_berikutnya: {
        Args: { p_awalan?: string };
        Returns: string;
      };
      buat_sampel: {
        Args: {
          p_nama: string;
          p_unit: string;
          p_kategori?: string;
          p_nilai?: number;
          p_catatan?: string;
          p_awalan?: string;
        };
        Returns: BarisSample;
      };
      pindah_urutan_modul: {
        Args: { p_modul: string; p_arah: number };
        Returns: BarisCourseModule;
      };
      kode_asing: {
        Args: { p_sejak?: string };
        Returns: { kode: string; jumlah: number; terakhir: string }[];
      };
      ringkas_kv_lama: {
        Args: Record<string, never>;
        Returns: { entitas: string; jumlah: number }[];
      };
      mulai_migrasi_jalan: {
        Args: {
          p_tahap: TahapMigrasiDb;
          p_sumber?: string;
          p_pemetaan?: unknown;
          p_catatan?: string;
        };
        Returns: BarisMigrasiJalan;
      };
      tutup_migrasi_jalan: {
        Args: { p_jalan: string };
        Returns: BarisMigrasiJalan;
      };
      buat_laporan_mingguan: {
        Args: { p_pekan: string };
        Returns: number;
      };
      progres_goal: {
        Args: { p_bulan: string; p_sampai?: string };
        Returns: {
          goal_id: string;
          target_bulan: number;
          realisasi: number;
          rasio: number;
        }[];
      };
      goal_korporasi: {
        Args: { p_tanggal: string };
        Returns: {
          goal_id: string;
          judul: string;
          periode: string;
          target_base: number;
          target_goal: number;
          target_stretch: number;
          target_bulan: number;
          realisasi: number;
          rasio: number;
        }[];
      };
      papan_lead_measure: {
        Args: { p_tanggal: string };
        Returns: {
          lead_id: string;
          judul: string;
          satuan: string;
          unit_kode: "affiliator" | "mcn" | "tap" | null;
          realisasi: number;
          target: number;
          rasio: number;
          pendukung: number | null;
          label_pendukung: string | null;
        }[];
      };
      anak_tangga_target: {
        Args: { p_tanggal: string };
        Returns: {
          goal_id: string;
          judul: string;
          level: LevelGoalDb;
          pemilik: string | null;
          jabatan: string | null;
          unit_kode: "affiliator" | "mcn" | "tap" | null;
          target: number;
          realisasi: number;
          rasio: number;
        }[];
      };
      status_wrm: {
        Args: { p_tanggal: string };
        Returns: {
          rasio_hasil: number;
          rasio_kri: number;
          status_hasil: WarnaWrmDb;
          status_kri: WarnaWrmDb;
          keputusan: KeputusanWrmDb;
        }[];
      };
      /** Angka ringkas rekap kehadiran, dihitung di database. */
      ringkas_absensi: {
        Args: { p_dari: string; p_sampai: string; p_user?: string | null };
        Returns: {
          jumlah_baris: number;
          hadir: number;
          terlambat: number;
          izin: number;
          sakit: number;
          luar_radius: number;
          sudah_lapor: number;
          orang: number;
        }[];
      };
      /** Rekap kehadiran untuk ekspor Excel. */
      rekap_absensi: {
        Args: { p_dari: string; p_sampai: string; p_user?: string | null };
        Returns: {
          user_id: string;
          nama: string;
          unit_nama: string;
          tanggal: string;
          status: StatusKehadiranDb;
          jam_masuk: string | null;
          jam_pulang: string | null;
          terlambat: boolean;
          lokasi_valid: boolean;
          jarak_masuk_m: number | null;
          alasan: string;
          persetujuan: StatusPersetujuanDb | null;
          sudah_lapor: boolean;
        }[];
      };
      /** Akun/unit yang boleh dilaporkan pengguna aktif, beserta targetnya. */
      sasaran_laporan_saya: {
        Args: { p_tanggal: string };
        Returns: {
          jenis: "akun" | "unit";
          akun_id: string | null;
          unit_kode: "affiliator" | "mcn" | "tap";
          label: string;
          program: string | null;
          pic_nama: string | null;
          target_harian: number;
          sudah_lapor: boolean;
        }[];
      };
      /** Satu-satunya jalan mengubah GMV; alasan wajib & ikut tercatat. */
      perbaiki_laporan_harian: {
        Args: {
          p_report_id: string;
          p_gmv: number;
          p_alasan: string;
          p_catatan?: string | null;
        };
        Returns: BarisDailyReport;
      };
      /** Migrasi 0119 — verifikasi nomor oleh CEO/Manager. */
      verifikasi_kontak: {
        Args: { p_user: string };
        Returns: string;
      };
      cabut_verifikasi_kontak: {
        Args: { p_user: string };
        Returns: undefined;
      };
      /** Migrasi 0118 — mencatat satu percobaan kirim WhatsApp. */
      catat_percobaan_kirim: {
        Args: {
          p_delivery: string;
          p_status: StatusKirimWaDb;
          p_galat?: string;
          p_balasan?: string;
        };
        Returns: number;
      };
      /** Migrasi 0115 — preferensi yang benar-benar berlaku. */
      preferensi_notifikasi_berlaku: {
        Args: { p_user: string };
        Returns: {
          kategori: KategoriNotifikasiDb;
          in_app: boolean;
          whatsapp: boolean;
        }[];
      };
      ringkasan_gmv_unit: {
        Args: { p_tanggal: string };
        Returns: {
          unit_id: string;
          kode: "affiliator" | "mcn" | "tap";
          nama: string;
          deskripsi: string;
          gmv_hari_ini: number;
          gmv_kemarin: number;
          target_harian: number;
          gmv_bulan_ini: number;
          target_bulanan: number;
        }[];
      };
      /** Migrasi 0110 — agregat untuk dasbor Analitik GMV. */
      gmv_harian: {
        Args: { p_dari: string; p_sampai: string };
        Returns: {
          tanggal: string;
          gmv: number;
          jumlah_laporan: number;
        }[];
      };
      /** Migrasi 0120 — GMV harian dipecah per unit. */
      gmv_harian_per_unit: {
        Args: { p_dari: string; p_sampai: string };
        Returns: {
          tanggal: string;
          unit_id: string;
          kode: "affiliator" | "mcn" | "tap";
          nama: string;
          gmv: number;
          jumlah_laporan: number;
        }[];
      };
      gmv_harian_unit: {
        Args: { p_dari: string; p_sampai: string };
        Returns: {
          unit_id: string;
          kode: "affiliator" | "mcn" | "tap";
          nama: string;
          gmv: number;
        }[];
      };
    };
    Enums: {
      peran_pengguna: PeranDb;
      kategori_notifikasi: KategoriNotifikasiDb;
      status_kirim_wa: StatusKirimWaDb;
      status_aktif: StatusAktifDb;
      status_laporan: StatusLaporanDb;
      level_goal: LevelGoalDb;
      status_goal: StatusGoalDb;
      tipe_tugas: TipeTugasDb;
      status_tugas: StatusTugasDb;
      prioritas_tugas: PrioritasTugasDb;
      status_qc: StatusQcDb;
      status_kehadiran: StatusKehadiranDb;
      status_persetujuan: StatusPersetujuanDb;
      sumber_kpi: SumberKpiDb;
      predikat_kpi: PredikatKpiDb;
      status_migrasi: StatusMigrasiDb;
      status_sampel: StatusSampelDb;
      arah_transaksi: ArahTransaksiDb;
      jenis_keluar: JenisKeluarDb;
      status_transaksi: StatusTransaksiDb;
      status_aset: StatusAsetDb;
      status_masalah: StatusMasalahDb;
      dampak_masalah: DampakMasalahDb;
      tingkat_kursus: TingkatKursusDb;
      jenis_masukan: JenisMasukanDb;
      jenis_agenda: JenisAgendaDb;
      status_masukan: StatusMasukanDb;
      keparahan_bug: KeparahanBugDb;
      tahap_migrasi: TahapMigrasiDb;
      warna_wrm: WarnaWrmDb;
      keputusan_wrm: KeputusanWrmDb;
      kelompok_tenggat: KelompokTenggatDb;
    };
    CompositeTypes: Record<string, never>;
  };
};
