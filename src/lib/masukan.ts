/**
 * Masukan & bug — tipe & aturan murni.
 */

export type JenisMasukan = "bug" | "saran" | "pertanyaan";

export type StatusMasukan =
  | "baru"
  | "ditinjau"
  | "dikerjakan"
  | "selesai"
  | "ditolak";

export type Keparahan = "ringan" | "sedang" | "berat" | "kritis";

export type KomentarMasukan = {
  id: string;
  olehNama: string | null;
  isi: string;
  pada: string;
};

export type JejakMasukan = {
  id: string;
  dari: StatusMasukan | null;
  ke: StatusMasukan;
  olehNama: string | null;
  catatan: string;
  pada: string;
};

export type Masukan = {
  id: string;
  jenis: JenisMasukan;
  judul: string;
  isi: string;
  keparahan: Keparahan | null;
  halaman: string;
  status: StatusMasukan;
  alasanTolak: string;
  pelaporId: string | null;
  pelaporNama: string | null;
  ditugaskanId: string | null;
  ditugaskanNama: string | null;
  dukungan: number;
  sayaDukung: boolean;
  komentar: KomentarMasukan[];
  jejak: JejakMasukan[];
  dibuatPada: string;
};

export const LABEL_JENIS: Record<JenisMasukan, string> = {
  bug: "Bug",
  saran: "Saran",
  pertanyaan: "Pertanyaan",
};

export const GAYA_JENIS: Record<JenisMasukan, string> = {
  bug: "bg-danger-fill text-danger-text",
  saran: "bg-info-fill text-info-text",
  pertanyaan: "bg-muted text-muted-foreground",
};

export const LABEL_STATUS_MASUKAN: Record<StatusMasukan, string> = {
  baru: "Baru",
  ditinjau: "Ditinjau",
  dikerjakan: "Dikerjakan",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

export const GAYA_STATUS_MASUKAN: Record<
  StatusMasukan,
  { kelas: string; titik: string }
> = {
  baru: { kelas: "bg-warn-fill text-warn-text", titik: "bg-warn" },
  ditinjau: { kelas: "bg-info-fill text-info-text", titik: "bg-secondary" },
  dikerjakan: {
    kelas: "bg-accentmuted-fill text-accentmuted-text",
    titik: "bg-unit-tap",
  },
  selesai: { kelas: "bg-ok-fill text-ok-text", titik: "bg-ok" },
  ditolak: {
    kelas: "bg-muted text-muted-foreground",
    titik: "bg-muted-foreground/50",
  },
};

export const LABEL_KEPARAHAN: Record<Keparahan, string> = {
  ringan: "Ringan",
  sedang: "Sedang",
  berat: "Berat",
  kritis: "Kritis",
};

export const GAYA_KEPARAHAN: Record<Keparahan, string> = {
  ringan: "bg-muted text-muted-foreground",
  sedang: "bg-info-fill text-info-text",
  berat: "bg-warn-fill text-warn-text",
  kritis: "bg-danger-fill text-danger-text",
};

/** Masukan yang masih menunggu keputusan atau pengerjaan. */
export function terbuka(m: Masukan) {
  return m.status !== "selesai" && m.status !== "ditolak";
}

const BOBOT_KEPARAHAN: Record<Keparahan, number> = {
  kritis: 40,
  berat: 25,
  sedang: 10,
  ringan: 3,
};

/**
 * Urutan prioritas.
 *
 * Bug kritis selalu di atas saran sepopuler apa pun — banyaknya orang
 * yang menginginkan sesuatu tidak mengubah fakta bahwa ada yang rusak.
 * Di antara hal yang setara, dukungan orang menjadi penentunya.
 */
export function skorPrioritas(m: Masukan) {
  const dasar = m.keparahan ? BOBOT_KEPARAHAN[m.keparahan] : 0;
  return dasar + m.dukungan;
}

export function urutkanMasukan(daftar: Masukan[]): Masukan[] {
  return [...daftar].sort((a, b) => {
    // Yang sudah tuntas atau ditolak turun ke bawah.
    if (terbuka(a) !== terbuka(b)) return terbuka(a) ? -1 : 1;
    return (
      skorPrioritas(b) - skorPrioritas(a) ||
      b.dibuatPada.localeCompare(a.dibuatPada)
    );
  });
}

export type RingkasMasukan = {
  total: number;
  baru: number;
  bugTerbuka: number;
  bugKritis: number;
};

export function ringkasMasukan(daftar: Masukan[]): RingkasMasukan {
  const buka = daftar.filter(terbuka);
  return {
    total: daftar.length,
    baru: daftar.filter((m) => m.status === "baru").length,
    bugTerbuka: buka.filter((m) => m.jenis === "bug").length,
    bugKritis: buka.filter((m) => m.keparahan === "kritis").length,
  };
}

export type RingkasKirimanSaya = {
  total: number;
  menunggu: number;
  ditindaklanjuti: number;
  selesai: number;
  ditolak: number;
  dukunganDiterima: number;
};

/**
 * Ringkasan kiriman seseorang.
 *
 * Yang ditonjolkan adalah berapa yang benar-benar ditindaklanjuti —
 * itulah yang menentukan apakah orang mau melapor lagi lain kali.
 */
export function ringkasKirimanSaya(daftar: Masukan[]): RingkasKirimanSaya {
  return {
    total: daftar.length,
    menunggu: daftar.filter((m) => m.status === "baru" || m.status === "ditinjau")
      .length,
    ditindaklanjuti: daftar.filter((m) => m.status === "dikerjakan").length,
    selesai: daftar.filter((m) => m.status === "selesai").length,
    ditolak: daftar.filter((m) => m.status === "ditolak").length,
    dukunganDiterima: daftar.reduce((a, m) => a + m.dukungan, 0),
  };
}

// ---------------------------------------------------------------------
// Penyaringan
// ---------------------------------------------------------------------

export type SaringanMasukan = {
  cari: string;
  jenis: JenisMasukan | "semua";
  status: StatusMasukan | "semua" | "terbuka";
  keparahan: Keparahan | "semua";
};

const JENIS_SAH: JenisMasukan[] = ["bug", "saran", "pertanyaan"];
const STATUS_SAH: StatusMasukan[] = [
  "baru",
  "ditinjau",
  "dikerjakan",
  "selesai",
  "ditolak",
];
const KEPARAHAN_SAH: Keparahan[] = ["ringan", "sedang", "berat", "kritis"];

/** Membaca saringan dari parameter URL, menolak nilai yang tidak dikenal. */
export function bacaSaringanMasukan(params: {
  cari?: string | string[];
  jenis?: string | string[];
  status?: string | string[];
  keparahan?: string | string[];
}): SaringanMasukan {
  const satu = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";

  const jenis = satu(params.jenis);
  const status = satu(params.status);
  const keparahan = satu(params.keparahan);

  return {
    cari: satu(params.cari).trim().slice(0, 60),
    jenis: JENIS_SAH.includes(jenis as JenisMasukan)
      ? (jenis as JenisMasukan)
      : "semua",
    status:
      status === "terbuka" || STATUS_SAH.includes(status as StatusMasukan)
        ? (status as StatusMasukan | "terbuka")
        : "semua",
    keparahan: KEPARAHAN_SAH.includes(keparahan as Keparahan)
      ? (keparahan as Keparahan)
      : "semua",
  };
}

export function masukanTersaring(s: SaringanMasukan) {
  return (
    s.cari !== "" ||
    s.jenis !== "semua" ||
    s.status !== "semua" ||
    s.keparahan !== "semua"
  );
}

/**
 * Menyaring daftar masukan.
 *
 * Pilihan "terbuka" sengaja ada: yang paling sering dicari bukan satu
 * status tertentu, melainkan "apa saja yang belum tuntas".
 */
export function saringMasukan(
  daftar: Masukan[],
  s: SaringanMasukan,
): Masukan[] {
  const kata = s.cari.toLowerCase();

  return daftar.filter((m) => {
    if (s.jenis !== "semua" && m.jenis !== s.jenis) return false;
    if (s.keparahan !== "semua" && m.keparahan !== s.keparahan) return false;

    if (s.status === "terbuka") {
      if (!terbuka(m)) return false;
    } else if (s.status !== "semua" && m.status !== s.status) {
      return false;
    }

    if (kata === "") return true;
    return [m.judul, m.isi, m.pelaporNama ?? "", m.halaman].some((t) =>
      t.toLowerCase().includes(kata),
    );
  });
}

/**
 * Apa yang boleh dilakukan seseorang pada sebuah masukan.
 *
 * Cerminan policy dan trigger 0093: pengirim membetulkan isinya selama
 * belum ditinjau, penanggung jawab menggerakkan statusnya, pengelola
 * bebas. Datanya saja, tanpa fungsi — bentuk ini menyeberang dari Server
 * ke Client Component.
 */
export type IzinMasukan = {
  pengelola: boolean;
  bolehSunting: boolean;
  bolehGerakkanStatus: boolean;
};

export function izinMasukan(
  penggunaId: string,
  pengelola: boolean,
  masukan: Pick<Masukan, "pelaporId" | "ditugaskanId" | "status">,
): IzinMasukan {
  return {
    pengelola,
    bolehSunting:
      pengelola ||
      (masukan.pelaporId === penggunaId && masukan.status === "baru"),
    bolehGerakkanStatus: pengelola || masukan.ditugaskanId === penggunaId,
  };
}

/** Kata yang terlalu umum untuk membedakan satu laporan dari yang lain. */
const KATA_UMUM = new Set([
  "yang", "untuk", "dari", "pada", "dengan", "tidak", "bisa", "saat",
  "ada", "dan", "atau", "ini", "itu", "di", "ke", "ada", "belum", "sudah",
]);

function kataKunci(teks: string): Set<string> {
  return new Set(
    teks
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((k) => k.length > 2 && !KATA_UMUM.has(k)),
  );
}

/**
 * Seberapa mirip dua judul laporan, 0–1.
 *
 * Dihitung dari irisan kata kunci (Jaccard) — cukup untuk menangkap
 * "tombol simpan tidak merespons" vs "tombol simpan gagal", dan tidak
 * mengarang kemiripan dari kata sambung yang sama.
 */
export function kemiripanJudul(a: string, b: string): number {
  const x = kataKunci(a);
  const y = kataKunci(b);
  if (x.size === 0 || y.size === 0) return 0;

  let irisan = 0;
  for (const kata of x) if (y.has(kata)) irisan += 1;

  return irisan / (x.size + y.size - irisan);
}

/** Ambang kemiripan yang dianggap "kemungkinan laporan yang sama". */
export const AMBANG_SERUPA = 0.34;

/**
 * Laporan yang kemungkinan sudah melaporkan hal yang sama.
 *
 * Ditampilkan sebelum mengirim supaya dukungan menumpuk pada satu
 * laporan alih-alih terpecah ke beberapa kembaran — persis alasan daftar
 * masukan dibuat terbuka bagi semua orang.
 */
export function masukanSerupa(
  judul: string,
  daftar: Masukan[],
  batas = 3,
): { masukan: Masukan; kemiripan: number }[] {
  return daftar
    .filter((m) => terbuka(m))
    .map((m) => ({ masukan: m, kemiripan: kemiripanJudul(judul, m.judul) }))
    .filter((x) => x.kemiripan >= AMBANG_SERUPA)
    .sort((a, b) => b.kemiripan - a.kemiripan)
    .slice(0, batas);
}
