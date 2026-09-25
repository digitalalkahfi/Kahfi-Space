/**
 * Ekspor K-Space V1 — aturan berkas unggahan, modul murni.
 *
 * Ekspor sistem lama bukan daftar entri seperti contoh karangan yang
 * dipakai selama ini, melainkan satu objek JSON besar: sebuah `_meta`
 * ditambah sekian kunci tingkat atas (`users:list`, `daily-reports:all`,
 * …). Setiap kunci itulah yang menjadi satu baris `kv_store_lama` (0074).
 *
 * Berkas nyatanya berukuran puluhan megabita, jadi batas dan penyaringan
 * di sini dipakai dua kali: di browser sebelum berkas dikirim, dan lagi
 * di server sebelum sebaris pun disimpan. Pemeriksaan browser hanya
 * menghemat waktu orang; yang mengikat tetap yang di server.
 */

/** Batas ukuran unggahan. Ekspor penuh K-Space lama ada di kisaran 20 MB. */
export const BATAS_UNGGAH_MB = 30;
export const BATAS_UNGGAH_BYTE = BATAS_UNGGAH_MB * 1024 * 1024;

/** Tipe berkas yang diterima pemilih berkas. */
export const TIPE_EKSPOR = ["application/json", ".json"] as const;

/**
 * Bagaimana sebuah kunci tingkat atas diperlakukan.
 *
 * Pembedaan ini yang membuat layar jujur: kunci yang diabaikan bukan
 * kegagalan, dan kunci asing bukan sesuatu yang boleh diam-diam dibuang.
 */
export type GolonganKunci = "dikenal" | "referensi" | "diabaikan" | "asing";

export type KunciEkspor = {
  kunci: string;
  label: string;
  /** Apa yang akan terjadi pada isinya saat pemetaan dijalankan. */
  catatan: string;
};

/**
 * Kunci yang benar-benar dipetakan ke skema V2.
 *
 * Urutannya mengikuti ketergantungan data: orang lebih dulu, lalu akun,
 * baru yang menunjuk keduanya.
 */
export const KUNCI_DIKENAL: KunciEkspor[] = [
  {
    kunci: "users:list",
    label: "Anggota tim",
    catatan: "Profil V2; seluruh kolom kata sandi dibuang sebelum disimpan.",
  },
  {
    kunci: "affiliate-accounts:all",
    label: "Akun affiliator",
    catatan: "Akun beserta penanggung jawabnya.",
  },
  {
    kunci: "daily-reports:all",
    label: "Laporan harian",
    catatan: "Tanggal dari medan “Tanggal Laporan”; medan “Target …” dibuang.",
  },
  {
    kunci: "gmv:daily",
    label: "GMV harian",
    catatan: "Entri bertanda autoSynced dilewati supaya tidak dobel.",
  },
  {
    kunci: "affiliate-gmv:daily",
    label: "GMV affiliator harian",
    catatan: "Dipakai untuk unit internal; menggantikan gmv:daily di sana.",
  },
  {
    kunci: "attendance:all",
    label: "Absensi",
    catatan: "Masuk tanpa swafoto, ditandai “bukti di sistem lama”.",
  },
  {
    kunci: "attendance:config",
    label: "Pengaturan absensi",
    catatan: "Jam kerja dan pagar lokasi sistem lama.",
  },
  {
    kunci: "leave-requests:all",
    label: "Pengajuan izin",
    catatan: "Dipindahkan apa adanya; yang masih pending tetap pending.",
  },
  {
    kunci: "tasks:all",
    label: "Tugas & QC",
    catatan: "Tugas beserta jejak QC-nya.",
  },
  {
    kunci: "todos:all",
    label: "Todo",
    catatan: "Mengikuti pola tugas yang sudah ada.",
  },
  {
    kunci: "keuangan:cashflow",
    label: "Arus kas",
    catatan: "Masuk berstatus dibayar, tanpa melewati alur persetujuan.",
  },
  // Tahap 2 (25 Sep 2026): kunci yang punya tempat di V2 tetapi bentuknya
  // berbeda; disesuaikan dengan cara V2, bukan disalin apa adanya.
  {
    kunci: "announcements:all",
    label: "Pengumuman",
    catatan:
      "Masuk sebagai pengumuman terbit untuk semua orang, tanpa notifikasi ulang.",
  },
  {
    kunci: "calendar:all",
    label: "Kalender",
    catatan:
      "Menjadi agenda seluruh perusahaan; nama peserta masuk ke keterangan.",
  },
  {
    kunci: "schedule:all",
    label: "Jadwal lama",
    catatan:
      "Yang sudah disalin ke kalender lama tidak dibawa dua kali; catatannya digabung.",
  },
  {
    kunci: "problems:all",
    label: "Masalah (Kaizen)",
    catatan:
      "5-Why lama diringkas ke konteks dan solusi; penyelesaian tercatat sebagai jejak.",
  },
  {
    kunci: "feedback:all",
    label: "Masukan",
    catatan:
      "Judul dari kalimat pertama; balasan menjadi komentar; lampiran tetap di penyimpanan lama.",
  },
  {
    kunci: "sampel:all",
    label: "Sampel",
    catatan:
      "Masuk sebagai tersedia, penerimanya dicatat sebagai kejadian dipegang.",
  },
  {
    kunci: "sampel-usage:all",
    label: "Riwayat pindai sampel",
    catatan:
      "Menjadi riwayat pindai; kode yang sudah tidak ada tercatat sebagai tak dikenali.",
  },
  {
    kunci: "lms:paths:all",
    label: "Jalur belajar",
    catatan:
      "Jalur menjadi kategori dan ringkasan kursusnya; pendaftaran jalur menjadi pendaftaran kursus.",
  },
  {
    kunci: "lms:courses:all",
    label: "Kursus",
    catatan: "Tiap pelajaran (video/PDF) menjadi satu modul V2.",
  },
  {
    kunci: "lms:enrollments:all",
    label: "Pendaftaran kursus",
    catatan: "Satu pendaftaran per kursus di jalurnya.",
  },
  {
    kunci: "lms:progress:all",
    label: "Kemajuan belajar",
    catatan:
      "Hanya pelajaran yang tuntas; yang setengah jalan dicatat, tidak dibulatkan.",
  },
  {
    kunci: "lms:library:all",
    label: "Perpustakaan belajar",
    catatan: "Tiap berkas menjadi kursus satu modul.",
  },
  {
    kunci: "notes:all",
    label: "Catatan",
    catatan: "Menjadi catatan pribadi penulisnya; tidak dibagikan.",
  },
];

/**
 * Kunci yang dibaca tetapi tidak dipetakan — hanya dicatat sebagai
 * rujukan angka lama supaya selisih pada layar verifikasi bisa dijelaskan.
 */
export const KUNCI_REFERENSI = ["gmv:targets", "affiliate:goal"] as const;

/**
 * Kunci yang sengaja tidak dibawa sama sekali.
 *
 * Isinya lampiran, cadangan, dan sisa alat bantu sistem lama. Menyimpannya
 * hanya membuat `kv_store_lama` membengkak tanpa satu pun barisnya pernah
 * dipetakan.
 */
export const KUNCI_DIABAIKAN = [
  "img:store",
  "activities",
  "activities:all",
  "backup",
  "backup:last",
  "backup:drive-last",
  "drive",
  "drive:auto-backup",
  "template",
  "daily-report-templates:all",
  "reports",
  "reports:all",
  "targets",
  "targets:all",
  "app:settings",
  // Turunan yang V2 hitung sendiri, atau yang isinya kosong di ekspor.
  "sampel-stat:all",
  // Daftar seller lama: diputuskan pemilik (25 Sep 2026) tidak dibawa,
  // fitur penjualnya pun dihapus dari V2 (0169).
  "sellers:all",
  "lms:lesson-bodies:all",
  "attendance:selfie-index",
] as const;

/** Kunci yang memuat keterangan ekspor, bukan data. */
export const KUNCI_META = "_meta";

export function golonganKunci(kunci: string): GolonganKunci {
  if (KUNCI_DIKENAL.some((k) => k.kunci === kunci)) return "dikenal";
  if ((KUNCI_REFERENSI as readonly string[]).includes(kunci))
    return "referensi";
  if ((KUNCI_DIABAIKAN as readonly string[]).includes(kunci))
    return "diabaikan";
  return "asing";
}

export const LABEL_GOLONGAN: Record<GolonganKunci, string> = {
  dikenal: "Dipetakan",
  referensi: "Rujukan saja",
  diabaikan: "Diabaikan",
  asing: "Belum dikenali",
};

export const GAYA_GOLONGAN: Record<GolonganKunci, string> = {
  dikenal: "bg-ok-fill text-ok-text",
  referensi: "bg-info-fill text-info-text",
  diabaikan: "bg-muted text-muted-foreground",
  asing: "bg-warn-fill text-warn-text",
};

/** Ukuran berkas dalam satuan yang enak dibaca orang. */
export function ukuranBerkas(byte: number) {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Alasan sebuah berkas tidak bisa diunggah, atau `null` bila boleh.
 *
 * Dipakai browser maupun server dengan aturan yang sama persis, supaya
 * tidak ada berkas yang lolos di satu sisi lalu ditolak di sisi lain
 * dengan kalimat yang berbeda.
 */
export function tolakBerkas(berkas: {
  nama: string;
  ukuran: number;
}): string | null {
  if (!/\.json$/i.test(berkas.nama)) {
    return "Yang bisa dibaca hanya berkas .json hasil ekspor K-Space lama.";
  }
  if (berkas.ukuran === 0) {
    return "Berkasnya kosong.";
  }
  if (berkas.ukuran > BATAS_UNGGAH_BYTE) {
    return `Berkasnya ${ukuranBerkas(berkas.ukuran)}, melewati batas ${BATAS_UNGGAH_MB} MB.`;
  }
  return null;
}

/**
 * Hasil satu kali unggah — bentuk balasan Server Action `unggahEksporV1`.
 *
 * Yang dilaporkan bukan sekadar "berhasil": tiap kunci disebut beserta
 * golongannya, supaya orang tahu persis apa yang tersimpan dan apa yang
 * sengaja dilewatkan sebelum pemetaan dijalankan.
 */
export type BarisUnggah = {
  kunci: string;
  golongan: GolonganKunci;
  /** Jumlah entri di dalam nilainya; 0 bila nilainya bukan larik. */
  jumlah: number;
  disimpan: boolean;
};

export type RingkasUnggah = {
  berkas: string;
  /** Keterangan ekspor dari `_meta`, bila ada. */
  meta: MetaEkspor | null;
  baris: BarisUnggah[];
};

export type RingkasanUnggahan = {
  /** Kunci tingkat atas di berkas, di luar `_meta`. */
  kunci: number;
  entri: number;
  kunciDisimpan: number;
  entriDisimpan: number;
  kunciDilewati: number;
  entriDilewati: number;
  /** Kunci yang tidak ada di ketiga daftar dan menunggu keputusan orang. */
  kunciAsing: number;
};

/**
 * Menjumlahkan hasil satu unggahan.
 *
 * Yang dipisah bukan "berhasil" dan "gagal" melainkan yang disimpan dan
 * yang sengaja dilewatkan: pada ekspor lama, kunci yang tidak terbawa
 * adalah hal yang normal dan harus terbaca sebagai pilihan, bukan sebagai
 * kerusakan.
 */
export function ringkasanUnggahan(baris: BarisUnggah[]): RingkasanUnggahan {
  const hasil: RingkasanUnggahan = {
    kunci: baris.length,
    entri: 0,
    kunciDisimpan: 0,
    entriDisimpan: 0,
    kunciDilewati: 0,
    entriDilewati: 0,
    kunciAsing: 0,
  };

  for (const b of baris) {
    hasil.entri += b.jumlah;
    if (b.disimpan) {
      hasil.kunciDisimpan += 1;
      hasil.entriDisimpan += b.jumlah;
    } else {
      hasil.kunciDilewati += 1;
      hasil.entriDilewati += b.jumlah;
    }
    if (b.golongan === "asing") hasil.kunciAsing += 1;
  }

  return hasil;
}

/**
 * Medan kata sandi yang wajib dibuang sebelum apa pun disimpan.
 *
 * Ekspor K-Space lama membawa hash kata sandi seluruh karyawan. Tidak ada
 * satu pun alasan data itu mendarat di basis data baru — bahkan sebagai
 * bahan mentah yang "nanti dibuang saat pemetaan", karena nanti itu
 * sering tidak datang.
 */
export const MEDAN_KREDENSIAL = [
  "password",
  "passwordHash",
  "password_hash",
  "confirmPassword",
  "salt",
] as const;

const KREDENSIAL = new Set<string>(
  MEDAN_KREDENSIAL.map((m) => m.toLowerCase()),
);

/**
 * Menyalin nilai tanpa medan kata sandi, sedalam apa pun letaknya.
 *
 * Perbandingan namanya mengabaikan besar-kecil huruf: ejaan di ekspor
 * lama tidak seragam, dan penjagaan terakhir di basis data (0152) hanya
 * mengenali kelima ejaan baku — jadi yang di sini harus lebih longgar,
 * bukan lebih ketat.
 */
export function buangKredensial<T>(nilai: T): T {
  if (Array.isArray(nilai)) {
    return nilai.map((v) => buangKredensial(v)) as unknown as T;
  }
  if (nilai !== null && typeof nilai === "object") {
    const hasil: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(nilai)) {
      if (KREDENSIAL.has(k.toLowerCase())) continue;
      hasil[k] = buangKredensial(v);
    }
    return hasil as unknown as T;
  }
  return nilai;
}

/** Berapa entri di balik satu kunci ekspor. */
export function jumlahEntri(nilai: unknown): number {
  if (Array.isArray(nilai)) return nilai.length;
  // `attendance:config` dan sejenisnya berisi satu objek pengaturan,
  // bukan larik. Menghitungnya nol membuatnya terbaca seolah kosong.
  return nilai === null || nilai === undefined ? 0 : 1;
}

export type IsiKunci = BarisUnggah & { nilai: unknown };

export type BacaEkspor =
  | { ok: false; sebab: string }
  | {
      ok: true;
      meta: MetaEkspor | null;
      isi: IsiKunci[];
    };

/**
 * Membaca objek ekspor K-Space lama menjadi daftar kunci beserta isinya.
 *
 * Bentuk ekspornya satu objek: sebuah `_meta` berisi keterangan ekspor,
 * lalu kunci-kunci datanya. Setiap kunci itu menjadi satu baris
 * `kv_store_lama`; `_meta` tidak, ia menjadi keterangan berkasnya.
 *
 * Kunci yang diabaikan tetap dilaporkan — supaya orang tahu isinya ada
 * di berkas dan sengaja tidak dibawa, bukan hilang tanpa jejak.
 */
function objekBiasa(nilai: unknown): nilai is Record<string, unknown> {
  return nilai !== null && typeof nilai === "object" && !Array.isArray(nilai);
}

export function bacaEksporV1(mentah: unknown): BacaEkspor {
  if (mentah === null || typeof mentah !== "object" || Array.isArray(mentah)) {
    return {
      ok: false,
      sebab:
        "Isi berkasnya bukan objek ekspor K-Space lama — yang diharapkan satu objek berisi _meta dan kunci-kunci datanya.",
    };
  }

  const objek = mentah as Record<string, unknown>;
  const metaMentah = objek[KUNCI_META];
  const meta = objekBiasa(metaMentah)
    ? bacaMeta(buangKredensial(metaMentah))
    : null;

  // Sebagian ekspor meletakkan kuncinya langsung di sebelah `_meta`,
  // sebagian lagi membungkusnya di dalam `data`. Keduanya diterima —
  // tetapi pembungkus hanya dikenali bila memang tidak ada kunci lain di
  // tingkat atas, supaya ekspor yang kebetulan punya kunci bernama
  // `data` tidak salah dibaca.
  const pembungkus = objek.data;
  const sumber =
    objekBiasa(pembungkus) &&
    Object.keys(objek).every((k) => k === KUNCI_META || k === "data")
      ? pembungkus
      : objek;

  const isi: IsiKunci[] = [];
  for (const [kunci, nilai] of Object.entries(sumber)) {
    if (kunci === KUNCI_META) continue;
    const golongan = golonganKunci(kunci);
    isi.push({
      kunci,
      golongan,
      jumlah: jumlahEntri(nilai),
      // Yang diabaikan tidak disimpan sama sekali; yang belum dikenali
      // tetap disimpan mentah supaya keputusannya bisa diambil nanti
      // tanpa perlu mengunggah ulang.
      disimpan: golongan !== "diabaikan",
      nilai: buangKredensial(nilai),
    });
  }

  if (isi.length === 0) {
    return {
      ok: false,
      sebab: "Berkasnya tidak memuat satu pun kunci data di luar _meta.",
    };
  }

  // Urutan tampil: yang dipetakan lebih dulu, yang diabaikan paling akhir.
  const urutan: Record<GolonganKunci, number> = {
    dikenal: 1,
    referensi: 2,
    asing: 3,
    diabaikan: 4,
  };
  isi.sort(
    (a, b) =>
      urutan[a.golongan] - urutan[b.golongan] || a.kunci.localeCompare(b.kunci),
  );

  return { ok: true, meta, isi };
}

// ---------------------------------------------------------------------
// Keterangan ekspor (`_meta`)
// ---------------------------------------------------------------------

/**
 * Keterangan yang ikut di kepala berkas ekspor.
 *
 * Isinya yang menjawab pertanyaan paling penting sebelum data lama
 * dipercaya: ekspor ini dibuat kapan. Ekspor yang diambil sebelum orang
 * berhenti memakai sistem lama akan kekurangan baris, dan satu-satunya
 * cara mengetahuinya adalah membandingkan waktunya dengan catatan
 * pembekuan K-Space lama (0078).
 */
export type MetaEkspor = {
  versi: string | null;
  diekspor: string | null;
  oleh: string | null;
  sumber: string | null;
  /** Medan `_meta` lain, ditampilkan apa adanya. */
  lainnya: { medan: string; nilai: string }[];
  /** Isi `_meta` utuh; inilah yang disimpan ke `kv_unggahan.meta`. */
  mentah: Record<string, unknown>;
};

/**
 * Ejaan medan `_meta` yang pernah dipakai sistem lama.
 *
 * Sengaja dicoba berurutan, bukan dipaksa satu ejaan: ekspor lama dibuat
 * beberapa versi aplikasi yang berbeda, dan menolak yang ejaannya lain
 * berarti menolak data yang isinya baik-baik saja.
 */
const MEDAN_META = {
  versi: ["version", "versi", "appVersion", "schemaVersion"],
  diekspor: ["exportedAt", "exported_at", "dibuatPada", "createdAt", "date"],
  oleh: ["exportedBy", "exported_by", "oleh", "by", "user"],
  sumber: ["source", "sumber", "app", "application"],
} as const;

/** Nilai `_meta` menjadi teks yang layak ditampilkan. */
function teksMeta(nilai: unknown): string | null {
  if (nilai === null || nilai === undefined) return null;
  if (typeof nilai === "string") return nilai.trim() || null;
  if (typeof nilai === "number" || typeof nilai === "boolean") {
    return String(nilai);
  }
  const teks = JSON.stringify(nilai);
  if (!teks) return null;
  return teks.length > 120 ? `${teks.slice(0, 117)}…` : teks;
}

/** Membaca `_meta` menjadi keterangan yang bisa ditampilkan. */
export function bacaMeta(mentah: Record<string, unknown>): MetaEkspor {
  const terpakai = new Set<string>();
  const ambil = (medan: readonly string[]) => {
    for (const m of medan) {
      if (!(m in mentah)) continue;
      const teks = teksMeta(mentah[m]);
      if (teks === null) continue;
      terpakai.add(m);
      return teks;
    }
    return null;
  };

  const versi = ambil(MEDAN_META.versi);
  const diekspor = ambil(MEDAN_META.diekspor);
  const oleh = ambil(MEDAN_META.oleh);
  const sumber = ambil(MEDAN_META.sumber);

  const lainnya: { medan: string; nilai: string }[] = [];
  for (const [medan, nilai] of Object.entries(mentah)) {
    if (terpakai.has(medan)) continue;
    const teks = teksMeta(nilai);
    if (teks !== null) lainnya.push({ medan, nilai: teks });
  }

  return { versi, diekspor, oleh, sumber, lainnya, mentah };
}

/**
 * Nama medan yang benar-benar muncul di balik satu kunci ekspor.
 *
 * Padanan aplikasi dari `medan_kunci_lama()` (0153) — dipakai mode demo,
 * yang membaca contoh ekspor dari repositori dan tidak punya database
 * untuk memindainya.
 */
export function medanEkspor(nilai: unknown, contoh = 200): string[] {
  const nama = new Set<string>();

  const kumpulkan = (o: unknown) => {
    if (o === null || typeof o !== "object" || Array.isArray(o)) return;
    for (const k of Object.keys(o)) nama.add(k);
  };

  if (Array.isArray(nilai)) {
    for (const el of nilai.slice(0, contoh)) kumpulkan(el);
  } else {
    kumpulkan(nilai);
  }

  return [...nama].sort();
}
