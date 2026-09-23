import { bulanPanjang } from "@/lib/format";
import { LABEL_JENIS_KELUAR, type JenisKeluar } from "@/lib/keuangan";
import type { AlokasiAnggaran, Anggaran, StatusAlokasi } from "@/lib/budget";

/**
 * Satu peristiwa pada riwayat anggaran.
 *
 * Pagu yang ditetapkan dan alokasi yang diputuskan adalah dua tabel
 * berbeda, tapi satu cerita: berapa pagu sebuah pos, dan kenapa ia
 * berubah. Disatukan di sini supaya bisa dibaca berurutan, bukan
 * dibolak-balik antara dua daftar.
 */
export type PeristiwaAnggaran = {
  id: string;
  jenisPeristiwa: "pagu" | "alokasi";
  /** Kunci pengurutan; untuk pagu memakai periodenya. */
  pada: string;
  periode: string;
  unitNama: string;
  jenis: JenisKeluar;
  jumlah: number;
  keterangan: string;
  /** Siapa yang menetapkan atau memutuskan; null bila belum diputuskan. */
  oleh: string | null;
  /** Hanya untuk alokasi. */
  status: StatusAlokasi | null;
};

/** Judul satu baris riwayat, mis. "Pagu Beban · Affiliator Network". */
export function judulPeristiwa(p: PeristiwaAnggaran) {
  const jenis = LABEL_JENIS_KELUAR[p.jenis];
  return p.jenisPeristiwa === "pagu"
    ? `Pagu ${jenis} · ${p.unitNama}`
    : `Tambahan ${jenis} · ${p.unitNama}`;
}

/** Keterangan periode yang sudah dibaca manusia, mis. "Oktober 2024". */
export function periodePanjang(periode: string) {
  return bulanPanjang(`${periode}-01`);
}

/**
 * Gabungkan pagu dan alokasi menjadi satu riwayat, terbaru lebih dulu.
 *
 * Pagu tidak menyimpan waktu penetapannya — yang ada hanya periodenya —
 * jadi ia diurutkan pada awal bulan periode itu. Tidak persis, tapi
 * jujur: menempatkannya di "sekarang" akan membuat pagu bulan lalu
 * terlihat baru saja ditetapkan.
 */
export function riwayatAnggaran(
  anggaran: readonly Anggaran[],
  alokasi: readonly AlokasiAnggaran[],
): PeristiwaAnggaran[] {
  const dariPagu: PeristiwaAnggaran[] = anggaran.map((a) => ({
    id: `pagu-${a.id}`,
    jenisPeristiwa: "pagu",
    pada: `${a.periode}-01`,
    periode: a.periode,
    unitNama: a.unitNama,
    jenis: a.jenis,
    jumlah: a.jumlah,
    keterangan: a.catatan,
    oleh: a.disetujuiNama,
    status: null,
  }));

  const dariAlokasi: PeristiwaAnggaran[] = alokasi.map((a) => ({
    id: `alokasi-${a.id}`,
    jenisPeristiwa: "alokasi",
    pada: a.pada,
    periode: a.periode,
    unitNama: a.unitNama,
    jenis: a.jenis,
    jumlah: a.jumlah,
    // Catatan keputusan lebih menjelaskan daripada alasan pengajuan
    // begitu keputusannya ada; sebelum itu, alasannyalah yang berguna.
    keterangan:
      a.status === "diajukan" || a.catatanKeputusan === ""
        ? a.alasan
        : a.catatanKeputusan,
    oleh: a.status === "diajukan" ? a.diajukanNama : a.diputuskanNama,
    status: a.status,
  }));

  return [...dariPagu, ...dariAlokasi].sort(
    (x, y) =>
      y.pada.localeCompare(x.pada) || x.unitNama.localeCompare(y.unitNama),
  );
}

/** Ringkasan satu periode: pagu awal, tambahan disetujui, dan totalnya. */
export type RingkasPeriode = {
  periode: string;
  pagu: number;
  tambahan: number;
  total: number;
  menunggu: number;
};

/**
 * Pagu berjalan per periode.
 *
 * Yang ditambahkan hanya alokasi yang DISETUJUI — pengajuan yang masih
 * menunggu bukan uang, dan menghitungnya sebagai pagu adalah cara
 * tercepat membelanjakan sesuatu yang belum disetujui siapa pun.
 */
export function ringkasPeriode(
  anggaran: readonly Anggaran[],
  alokasi: readonly AlokasiAnggaran[],
): RingkasPeriode[] {
  const per = new Map<string, RingkasPeriode>();
  const ambil = (periode: string) => {
    const ada = per.get(periode) ?? {
      periode,
      pagu: 0,
      tambahan: 0,
      total: 0,
      menunggu: 0,
    };
    per.set(periode, ada);
    return ada;
  };

  for (const a of anggaran) ambil(a.periode).pagu += a.jumlah;
  for (const a of alokasi) {
    const baris = ambil(a.periode);
    if (a.status === "disetujui") baris.tambahan += a.jumlah;
    if (a.status === "diajukan") baris.menunggu += a.jumlah;
  }

  return [...per.values()]
    .map((b) => ({ ...b, total: b.pagu + b.tambahan }))
    .sort((x, y) => y.periode.localeCompare(x.periode));
}
