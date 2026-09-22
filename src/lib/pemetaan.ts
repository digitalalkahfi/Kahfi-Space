/**
 * Pemetaan medan `kv_store` lama ke kolom skema baru — modul murni.
 *
 * Ditulis sebagai data, bukan kode bercabang, supaya bisa ditampilkan
 * apa adanya di layar dan disetujui orang sebelum dijalankan. Migrasi
 * yang pemetaannya hanya hidup di dalam kode tidak bisa ditinjau siapa
 * pun kecuali yang menulisnya.
 */

export type Ubahan =
  | "apa-adanya"
  | "angka-berpemisah"
  | "tanggal"
  | "cari-id"
  | "huruf-kecil"
  | "bawaan";

export const KETERANGAN_UBAHAN: Record<Ubahan, string> = {
  "apa-adanya": "Disalin apa adanya.",
  "angka-berpemisah":
    "Teks berpemisah ribuan ('2.500.000') diubah menjadi angka.",
  tanggal: "Beragam gaya tanggal disatukan ke YYYY-MM-DD.",
  "cari-id": "Nama atau kode lama dicari padanannya, disimpan sebagai id.",
  "huruf-kecil": "Disimpan dalam huruf kecil supaya pembandingannya konsisten.",
  bawaan: "Tidak ada di data lama; diisi nilai bawaan.",
};

export type BarisPemetaan = {
  medanLama: string | null;
  kolomBaru: string;
  ubahan: Ubahan;
  wajib: boolean;
  catatan?: string;
};

export type PemetaanEntitas = {
  kunci: string;
  label: string;
  tabelBaru: string;
  baris: BarisPemetaan[];
  /** Medan lama yang sengaja tidak dipindahkan, beserta alasannya. */
  dibuang: { medanLama: string; alasan: string }[];
};

export const PEMETAAN: PemetaanEntitas[] = [
  {
    kunci: "user",
    label: "Anggota tim",
    tabelBaru: "users",
    baris: [
      { medanLama: "id", kolomBaru: "id", ubahan: "apa-adanya", wajib: true },
      { medanLama: "nama_lengkap", kolomBaru: "nama", ubahan: "apa-adanya", wajib: true },
      {
        medanLama: "email",
        kolomBaru: "email",
        ubahan: "huruf-kecil",
        wajib: true,
        catatan: "Kunci yang menyambungkan profil ke akun Supabase Auth.",
      },
      { medanLama: "role", kolomBaru: "role", ubahan: "apa-adanya", wajib: true },
      { medanLama: "jabatan", kolomBaru: "jabatan", ubahan: "apa-adanya", wajib: false },
      { medanLama: "unit", kolomBaru: "unit_id", ubahan: "cari-id", wajib: false },
      { medanLama: "atasan", kolomBaru: "atasan_id", ubahan: "cari-id", wajib: false },
      {
        medanLama: "aktif",
        kolomBaru: "status",
        ubahan: "apa-adanya",
        wajib: true,
        catatan: "true → aktif, false → nonaktif.",
      },
      {
        medanLama: null,
        kolomBaru: "department_id",
        ubahan: "bawaan",
        wajib: false,
        catatan: "Sistem lama tidak memisahkan departemen; diisi belakangan.",
      },
    ],
    dibuang: [],
  },
  {
    kunci: "account",
    label: "Akun affiliator",
    tabelBaru: "accounts",
    baris: [
      { medanLama: "username", kolomBaru: "username", ubahan: "apa-adanya", wajib: true },
      { medanLama: "pic", kolomBaru: "pic_user_id", ubahan: "cari-id", wajib: false },
      { medanLama: "unit", kolomBaru: "unit_id", ubahan: "cari-id", wajib: true },
      { medanLama: "program", kolomBaru: "program_id", ubahan: "cari-id", wajib: false },
      {
        medanLama: null,
        kolomBaru: "platform",
        ubahan: "bawaan",
        wajib: true,
        catatan: "Seluruh akun lama berasal dari TikTok Shop.",
      },
    ],
    dibuang: [
      {
        medanLama: "target_harian",
        alasan:
          "Target kini hidup di goal & anak tangga bulanan, bukan menempel pada akun.",
      },
    ],
  },
  {
    kunci: "goal",
    label: "Goal & target bulanan",
    tabelBaru: "goals + goal_months",
    baris: [
      { medanLama: "id", kolomBaru: "id", ubahan: "apa-adanya", wajib: true },
      { medanLama: "judul", kolomBaru: "judul", ubahan: "apa-adanya", wajib: true },
      { medanLama: "level", kolomBaru: "level", ubahan: "apa-adanya", wajib: true },
      { medanLama: "pemilik", kolomBaru: "pemilik_id", ubahan: "cari-id", wajib: true },
      { medanLama: "unit", kolomBaru: "unit_id", ubahan: "cari-id", wajib: false },
      { medanLama: "account", kolomBaru: "account_id", ubahan: "cari-id", wajib: false },
      { medanLama: "base", kolomBaru: "target_base", ubahan: "angka-berpemisah", wajib: true },
      { medanLama: "goal", kolomBaru: "target_goal", ubahan: "angka-berpemisah", wajib: true },
      { medanLama: "stretch", kolomBaru: "target_stretch", ubahan: "angka-berpemisah", wajib: true },
      {
        medanLama: "target_bulan",
        kolomBaru: "goal_months.target",
        ubahan: "angka-berpemisah",
        wajib: false,
        catatan: "Menjadi baris terpisah di goal_months.",
      },
    ],
    dibuang: [],
  },
  {
    kunci: "report",
    label: "Laporan harian GMV",
    tabelBaru: "daily_reports",
    baris: [
      { medanLama: "tanggal", kolomBaru: "tanggal", ubahan: "tanggal", wajib: true },
      { medanLama: "akun", kolomBaru: "account_id", ubahan: "cari-id", wajib: false },
      { medanLama: "unit", kolomBaru: "unit_id", ubahan: "cari-id", wajib: false },
      { medanLama: "pelapor", kolomBaru: "user_id", ubahan: "cari-id", wajib: true },
      {
        medanLama: "gmv",
        kolomBaru: "gmv",
        ubahan: "angka-berpemisah",
        wajib: true,
        catatan: "Sumber kebenaran GMV; kesalahan di sini merusak seluruh KPI.",
      },
      { medanLama: "catatan", kolomBaru: "catatan", ubahan: "apa-adanya", wajib: false },
    ],
    dibuang: [],
  },
  {
    kunci: "attendance",
    label: "Absensi",
    tabelBaru: "attendance",
    baris: [
      { medanLama: "tanggal", kolomBaru: "tanggal", ubahan: "tanggal", wajib: true },
      { medanLama: "user", kolomBaru: "user_id", ubahan: "cari-id", wajib: true },
      { medanLama: "status", kolomBaru: "status", ubahan: "apa-adanya", wajib: true },
      { medanLama: "jam_masuk", kolomBaru: "jam_masuk", ubahan: "apa-adanya", wajib: false },
      { medanLama: "jam_pulang", kolomBaru: "jam_pulang", ubahan: "apa-adanya", wajib: false },
      {
        medanLama: null,
        kolomBaru: "selfie_path",
        ubahan: "bawaan",
        wajib: false,
        catatan: "Sistem lama tidak menyimpan selfie; dibiarkan kosong.",
      },
    ],
    dibuang: [],
  },
  {
    kunci: "task",
    label: "Tugas & tiket",
    tabelBaru: "tasks",
    baris: [
      { medanLama: "judul", kolomBaru: "judul", ubahan: "apa-adanya", wajib: true },
      { medanLama: "tipe", kolomBaru: "tipe", ubahan: "apa-adanya", wajib: true },
      { medanLama: "pembuat", kolomBaru: "pembuat_id", ubahan: "cari-id", wajib: true },
      { medanLama: "penerima", kolomBaru: "penerima_id", ubahan: "cari-id", wajib: true },
      { medanLama: "tenggat", kolomBaru: "tenggat", ubahan: "tanggal", wajib: false },
      { medanLama: "status", kolomBaru: "status", ubahan: "apa-adanya", wajib: true },
      {
        medanLama: null,
        kolomBaru: "qc_status",
        ubahan: "bawaan",
        wajib: true,
        catatan: "QC belum ada di sistem lama; semuanya masuk sebagai 'belum'.",
      },
    ],
    dibuang: [],
  },
];

/** Medan lama yang muncul di data tapi tidak ada di pemetaan. */
export function medanTakTerpetakan(
  pemetaan: PemetaanEntitas,
  medanDitemukan: string[],
): string[] {
  const dikenal = new Set(
    pemetaan.baris
      .map((b) => b.medanLama)
      .filter((m): m is string => m !== null)
      .concat(pemetaan.dibuang.map((d) => d.medanLama)),
  );
  return medanDitemukan.filter((m) => !dikenal.has(m)).sort();
}

/** Ringkasan sebuah pemetaan untuk ditampilkan tanpa membuka rinciannya. */
export function ringkasPemetaan(p: PemetaanEntitas) {
  return {
    dipindahkan: p.baris.filter((b) => b.medanLama !== null).length,
    bawaan: p.baris.filter((b) => b.medanLama === null).length,
    dibuang: p.dibuang.length,
    wajib: p.baris.filter((b) => b.wajib).length,
  };
}

/**
 * Sidik isi sebuah pemetaan.
 *
 * Dipakai untuk menandai persetujuan: begitu satu baris pemetaan
 * disunting, sidiknya berubah dan persetujuan lama tidak lagi berlaku.
 * Tanpa ini, pemetaan bisa diam-diam berubah setelah disetujui.
 */
export function versiPemetaan(p: PemetaanEntitas): string {
  const isi = [
    p.kunci,
    p.tabelBaru,
    ...p.baris.map((b) =>
      [b.medanLama ?? "-", b.kolomBaru, b.ubahan, b.wajib ? "w" : "o"].join(">"),
    ),
    ...p.dibuang.map((d) => `buang:${d.medanLama}`),
  ].join("|");

  // FNV-1a 32-bit: cukup untuk menandai perubahan, bukan untuk keamanan.
  let sidik = 0x811c9dc5;
  for (let i = 0; i < isi.length; i++) {
    sidik ^= isi.charCodeAt(i);
    sidik = Math.imul(sidik, 0x01000193) >>> 0;
  }
  return sidik.toString(16).padStart(8, "0");
}
