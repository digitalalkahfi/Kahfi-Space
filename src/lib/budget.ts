/**
 * Anggaran (budget) — tipe & perhitungan murni, tanpa akses database.
 *
 * Anggaran hanya berarti bila disandingkan dengan realisasinya, dan
 * realisasi itu tidak dicatat ulang: ia dihitung dari transaksi yang
 * sudah ada (PRD Fase 3). Dengan begitu tidak ada dua versi angka
 * belanja yang bisa berselisih.
 *
 * Satu baris anggaran = satu periode × satu unit × satu jenis
 * pengeluaran. Kombinasi itulah yang dipakai memutuskan: "beban MCN
 * bulan ini" adalah pertanyaan yang bisa dijawab, "beban" saja tidak.
 */
import {
  LABEL_JENIS_KELUAR,
  menggerakkanKas,
  type JenisKeluar,
  type Transaksi,
} from "@/lib/keuangan";
import type { KodeUnit } from "@/lib/types";

const POLA_PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;

export type Anggaran = {
  id: string;
  /** Bulan anggaran, bentuk "2024-10". */
  periode: string;
  /** Null berarti anggaran perusahaan, bukan milik satu unit. */
  unitKode: KodeUnit | null;
  unitNama: string;
  jenis: JenisKeluar;
  jumlah: number;
  catatan: string;
  disetujuiNama: string | null;
};

export type StatusAnggaran = "aman" | "waspada" | "lewat" | "belum";

export const LABEL_STATUS_ANGGARAN: Record<StatusAnggaran, string> = {
  aman: "Aman",
  waspada: "Mepet",
  lewat: "Lewat anggaran",
  belum: "Belum terpakai",
};

export const GAYA_STATUS_ANGGARAN: Record<StatusAnggaran, string> = {
  aman: "bg-ok-fill text-ok-text",
  waspada: "bg-warn-fill text-warn-text",
  lewat: "bg-danger-fill text-danger-text",
  belum: "bg-muted text-muted-foreground",
};

/**
 * Ambang "mepet": 85% dari anggaran.
 *
 * Diberi nama supaya angkanya bisa ditelusuri, bukan tersebar sebagai
 * 0.85 di beberapa tempat. Memberi peringatan tepat saat anggaran habis
 * sudah terlambat — yang berguna adalah peringatan sebelum itu.
 */
export const AMBANG_WASPADA = 0.85;

export function statusAnggaran(
  anggaran: number,
  realisasi: number,
): StatusAnggaran {
  if (realisasi === 0) return "belum";
  if (anggaran <= 0) return realisasi > 0 ? "lewat" : "belum";
  const rasio = realisasi / anggaran;
  if (rasio > 1) return "lewat";
  return rasio >= AMBANG_WASPADA ? "waspada" : "aman";
}

export type BarisAnggaran = {
  anggaran: Anggaran;
  /** Belanja yang sudah benar-benar keluar pada periode itu. */
  realisasi: number;
  /** Pengajuan periode itu yang disetujui tetapi belum dibayar. */
  tertahan: number;
  sisa: number;
  /** Realisasi ÷ anggaran, dalam persen. */
  rasio: number;
  status: StatusAnggaran;
};

/** Apakah sebuah transaksi masuk hitungan satu baris anggaran. */
function cocok(t: Transaksi, a: Anggaran) {
  if (t.arah !== "keluar" || t.jenis !== a.jenis) return false;
  if (!t.tanggal.startsWith(a.periode)) return false;
  // Anggaran perusahaan menampung pengeluaran yang memang tidak
  // menempel pada unit mana pun.
  return a.unitKode === null ? t.unitKode === null : t.unitKode === a.unitKode;
}

/**
 * Menyandingkan tiap baris anggaran dengan realisasinya.
 *
 * Yang dihitung sebagai realisasi hanya transaksi berstatus 'dibayar' —
 * sama dengan aturan kas di modul Keuangan. Pengajuan yang baru
 * disetujui ditampilkan terpisah sebagai "tertahan": uangnya belum
 * keluar, tetapi anggarannya sudah terikat.
 */
export function realisasiAnggaran(
  anggaran: Anggaran[],
  transaksi: Transaksi[],
): BarisAnggaran[] {
  return anggaran
    .map((a) => {
      const terkait = transaksi.filter((t) => cocok(t, a));
      const realisasi = terkait
        .filter(menggerakkanKas)
        .reduce((n, t) => n + t.jumlah, 0);
      const tertahan = terkait
        .filter((t) => t.status === "disetujui")
        .reduce((n, t) => n + t.jumlah, 0);

      return {
        anggaran: a,
        realisasi,
        tertahan,
        sisa: a.jumlah - realisasi,
        rasio: a.jumlah > 0 ? (realisasi / a.jumlah) * 100 : 0,
        status: statusAnggaran(a.jumlah, realisasi),
      } satisfies BarisAnggaran;
    })
    .sort((x, y) => y.rasio - x.rasio);
}

export type RingkasAnggaran = {
  jumlahBaris: number;
  anggaran: number;
  realisasi: number;
  tertahan: number;
  sisa: number;
  rasio: number;
  /** Baris yang belanjanya sudah melewati anggarannya. */
  lewat: number;
  waspada: number;
};

export function ringkasAnggaran(baris: BarisAnggaran[]): RingkasAnggaran {
  const anggaran = baris.reduce((n, b) => n + b.anggaran.jumlah, 0);
  const realisasi = baris.reduce((n, b) => n + b.realisasi, 0);

  return {
    jumlahBaris: baris.length,
    anggaran,
    realisasi,
    tertahan: baris.reduce((n, b) => n + b.tertahan, 0),
    sisa: anggaran - realisasi,
    rasio: anggaran > 0 ? (realisasi / anggaran) * 100 : 0,
    lewat: baris.filter((b) => b.status === "lewat").length,
    waspada: baris.filter((b) => b.status === "waspada").length,
  };
}

export type SelDivisi = {
  anggaran: number;
  realisasi: number;
  rasio: number;
  status: StatusAnggaran;
};

export type BarisDivisi = {
  unitNama: string;
  /** Satu sel per periode, kunci "2024-10". */
  perPeriode: Record<string, SelDivisi>;
  total: SelDivisi;
};

function sel(anggaran: number, realisasi: number): SelDivisi {
  return {
    anggaran,
    realisasi,
    rasio: anggaran > 0 ? (realisasi / anggaran) * 100 : 0,
    status: statusAnggaran(anggaran, realisasi),
  };
}

/**
 * Rekap anggaran per divisi × periode.
 *
 * Daftar per pos menjawab "pos mana yang jebol"; tabel ini menjawab
 * pertanyaan yang lain — "divisi mana yang belanjanya memburuk dari
 * bulan ke bulan". Keduanya dibangun dari baris yang sama supaya
 * angkanya tidak pernah berselisih.
 */
export function rekapDivisi(
  anggaran: Anggaran[],
  transaksi: Transaksi[],
  periode: string[],
): BarisDivisi[] {
  const baris = realisasiAnggaran(anggaran, transaksi);
  const unit = [...new Set(anggaran.map((a) => a.unitNama))].sort();

  return unit.map((unitNama) => {
    const miliknya = baris.filter((b) => b.anggaran.unitNama === unitNama);

    const perPeriode = Object.fromEntries(
      periode.map((p) => {
        const dalamPeriode = miliknya.filter((b) => b.anggaran.periode === p);
        return [
          p,
          sel(
            dalamPeriode.reduce((n, b) => n + b.anggaran.jumlah, 0),
            dalamPeriode.reduce((n, b) => n + b.realisasi, 0),
          ),
        ];
      }),
    );

    return {
      unitNama,
      perPeriode,
      total: sel(
        miliknya.reduce((n, b) => n + b.anggaran.jumlah, 0),
        miliknya.reduce((n, b) => n + b.realisasi, 0),
      ),
    } satisfies BarisDivisi;
  });
}

/** Kolom total tabel divisi: satu sel per periode, ditambah totalnya. */
export function totalDivisi(
  baris: BarisDivisi[],
  periode: string[],
): BarisDivisi {
  const kumpul = (ambil: (b: BarisDivisi) => SelDivisi) =>
    sel(
      baris.reduce((n, b) => n + ambil(b).anggaran, 0),
      baris.reduce((n, b) => n + ambil(b).realisasi, 0),
    );

  return {
    unitNama: "Total",
    perPeriode: Object.fromEntries(
      periode.map((p) => [p, kumpul((b) => b.perPeriode[p])]),
    ),
    total: kumpul((b) => b.total),
  };
}

/** Periode yang punya baris anggaran, terbaru dulu. */
export function periodeAnggaran(anggaran: Anggaran[]): string[] {
  return [...new Set(anggaran.map((a) => a.periode))].sort((a, b) =>
    b.localeCompare(a),
  );
}

// ---------------------------------------------------------------------
// Alokasi anggaran
// ---------------------------------------------------------------------

export type StatusAlokasi = "diajukan" | "disetujui" | "ditolak";

export const LABEL_STATUS_ALOKASI: Record<StatusAlokasi, string> = {
  diajukan: "Menunggu keputusan",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
};

export const GAYA_STATUS_ALOKASI: Record<StatusAlokasi, string> = {
  diajukan: "bg-warn-fill text-warn-text",
  disetujui: "bg-ok-fill text-ok-text",
  ditolak: "bg-danger-fill text-danger-text",
};

/**
 * Permintaan tambahan pagu untuk satu pos anggaran.
 *
 * Bukan penambahan langsung: pagu yang bisa dinaikkan sendiri oleh yang
 * membelanjakannya bukan anggaran, melainkan saran. Karena itu ia
 * berstatus 'diajukan' sampai ada yang memutuskan.
 */
export type AlokasiAnggaran = {
  id: string;
  periode: string;
  unitKode: KodeUnit | null;
  unitNama: string;
  jenis: JenisKeluar;
  jumlah: number;
  alasan: string;
  status: StatusAlokasi;
  diajukanNama: string | null;
  diputuskanNama: string | null;
  catatanKeputusan: string;
  pada: string;
};

export type MasukanAlokasi = {
  periode: string;
  unitKode: KodeUnit | null;
  jenis: JenisKeluar;
  jumlah: number;
  alasan: string;
};

/**
 * Pemeriksaan pengajuan alokasi.
 *
 * Alasan diwajibkan — bukan formalitas: yang memutuskan tidak ikut
 * menjalankan pekerjaannya, jadi tanpa alasan ia hanya bisa menebak.
 */
export function periksaAlokasi(input: MasukanAlokasi): string | null {
  if (!POLA_PERIODE.test(input.periode)) {
    return "Periode diisi dalam bentuk bulan, mis. 2024-10.";
  }
  if (!Number.isFinite(input.jumlah) || input.jumlah <= 0) {
    return "Jumlah tambahan harus lebih dari nol.";
  }
  if (input.jumlah > 100_000_000_000) {
    return "Jumlah di luar batas wajar, periksa lagi.";
  }
  if (input.alasan.trim().length < 15) {
    return "Tulis alasannya (minimal 15 huruf) supaya bisa diputuskan tanpa menebak.";
  }
  return null;
}

/** Keputusan yang masuk akal atas sebuah pengajuan. */
export function perpindahanAlokasiSah(
  dari: StatusAlokasi,
  ke: StatusAlokasi,
): boolean {
  // Yang sudah diputuskan tidak diputar balik diam-diam; pengajuan baru
  // meninggalkan jejaknya sendiri.
  return dari === "diajukan" && ke !== "diajukan";
}

/**
 * Ambang alokasi yang wewenangnya naik ke CEO (PRD Fase 3:
 * persetujuan berjenjang).
 *
 * Di bawah angka ini Manager cukup; di atasnya tambahan pagu sudah
 * cukup besar untuk menggeser posisi kas perusahaan, dan keputusan
 * seperti itu bukan lagi urusan operasional.
 */
export const BATAS_ALOKASI_CEO = 10_000_000;

export function penyetujuAlokasi(jumlah: number): "CEO" | "Manager" {
  return jumlah >= BATAS_ALOKASI_CEO ? "CEO" : "Manager";
}

export type IzinAlokasi = {
  bolehPutuskan: boolean;
  /** Alasan singkat bila tidak boleh; dipakai layar apa adanya. */
  alasan: string;
};

/**
 * Siapa yang boleh memutuskan sebuah pengajuan alokasi.
 *
 * Dua aturan: tidak seorang pun memutuskan pengajuannya sendiri, dan
 * tambahan besar hanya diputuskan CEO. Pembandingnya nama pengaju —
 * data contoh belum menyimpan idnya, dan aturan ini harus tetap berlaku
 * di kedua mode.
 */
export function izinPutusAlokasi(
  peran: string,
  namaSaya: string,
  alokasi: Pick<AlokasiAnggaran, "jumlah" | "status" | "diajukanNama">,
): IzinAlokasi {
  if (alokasi.status !== "diajukan") {
    return {
      bolehPutuskan: false,
      alasan: "Pengajuan ini sudah diputuskan.",
    };
  }

  if (alokasi.diajukanNama && alokasi.diajukanNama === namaSaya) {
    return {
      bolehPutuskan: false,
      alasan: "Pengajuanmu sendiri diputuskan orang lain.",
    };
  }

  const wajib = penyetujuAlokasi(alokasi.jumlah);

  if (wajib === "CEO") {
    return peran === "CEO"
      ? { bolehPutuskan: true, alasan: "" }
      : {
          bolehPutuskan: false,
          alasan: `Tambahan sebesar ini diputuskan CEO (batas ${BATAS_ALOKASI_CEO.toLocaleString("id-ID")}).`,
        };
  }

  return peran === "CEO" || peran === "Manager"
    ? { bolehPutuskan: true, alasan: "" }
    : {
        bolehPutuskan: false,
        alasan: "Hanya Manager atau CEO yang memutuskan alokasi.",
      };
}

/** Total tambahan pagu yang sudah disetujui untuk sebuah pos. */
export function alokasiDisetujui(
  alokasi: AlokasiAnggaran[],
  a: Pick<Anggaran, "periode" | "unitKode" | "jenis">,
): number {
  return alokasi
    .filter(
      (x) =>
        x.status === "disetujui" &&
        x.periode === a.periode &&
        x.unitKode === a.unitKode &&
        x.jenis === a.jenis,
    )
    .reduce((n, x) => n + x.jumlah, 0);
}

export type SaringanAnggaran = {
  periode: string;
  /** "semua" berarti seluruh divisi, termasuk pos perusahaan. */
  unit: string;
};

/** Membaca saringan anggaran dari URL; nilai asing diabaikan. */
export function bacaSaringanAnggaran(
  params: { periode?: string | string[]; unit?: string | string[] },
  periodeTersedia: string[],
  bawaan: string,
): SaringanAnggaran {
  const satu = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";

  const periode = satu(params.periode);
  return {
    periode: periodeTersedia.includes(periode) ? periode : bawaan,
    unit: satu(params.unit) || "semua",
  };
}

export function saringAnggaran(
  daftar: Anggaran[],
  saringan: SaringanAnggaran,
): Anggaran[] {
  return daftar.filter(
    (a) =>
      a.periode === saringan.periode &&
      (saringan.unit === "semua" || a.unitNama === saringan.unit),
  );
}

export type BandingPeriode = {
  /** Periode pembanding; kosong bila memang tidak ada sebelumnya. */
  periode: string | null;
  selisihRealisasi: number;
  selisihAnggaran: number;
  /** Selisih persentase serapan, dalam poin persen. */
  selisihRasio: number;
};

/**
 * Perbandingan serapan dengan periode sebelumnya.
 *
 * Satu angka serapan tidak memberi tahu apa pun tentang arah: 93%
 * terpakai bisa berarti membaik atau memburuk, tergantung bulan lalu.
 */
export function bandingPeriode(
  sekarang: BarisAnggaran[],
  sebelumnya: BarisAnggaran[],
  periodeSebelumnya: string | null,
): BandingPeriode {
  const a = ringkasAnggaran(sekarang);
  const b = ringkasAnggaran(sebelumnya);

  return {
    periode: sebelumnya.length > 0 ? periodeSebelumnya : null,
    selisihRealisasi: a.realisasi - b.realisasi,
    selisihAnggaran: a.anggaran - b.anggaran,
    selisihRasio: a.rasio - b.rasio,
  };
}

export type SelisihAnggaran = {
  baris: BarisAnggaran;
  /** Realisasi − anggaran; positif berarti belanja melebihi pagunya. */
  selisih: number;
};

/**
 * Pos anggaran diurutkan dari selisih rupiah terbesar.
 *
 * Persentase menyesatkan saat pagunya kecil: pos Rp 2 juta yang jebol
 * 200% menggeser perhatian dari pos Rp 200 juta yang lewat 5% — padahal
 * yang kedua memakan kas sepuluh kali lipat lebih banyak.
 */
export function selisihTerbesar(baris: BarisAnggaran[]): SelisihAnggaran[] {
  return baris
    .map((b) => ({ baris: b, selisih: b.realisasi - b.anggaran.jumlah }))
    .sort((x, y) => Math.abs(y.selisih) - Math.abs(x.selisih));
}

export type MasukanAnggaran = {
  periode: string;
  unitKode: KodeUnit | null;
  jenis: JenisKeluar;
  jumlah: number;
  catatan: string;
};

/**
 * Pemeriksaan isian anggaran — satu tempat, dipakai layar maupun server.
 *
 * Pagu nol sengaja ditolak: "dianggarkan nol" dan "belum dianggarkan"
 * terlihat sama di layar tetapi berarti sebaliknya bagi orang yang
 * membelanjakannya.
 */
export function periksaAnggaran(input: MasukanAnggaran): string | null {
  if (!POLA_PERIODE.test(input.periode)) {
    return "Periode diisi dalam bentuk bulan, mis. 2024-10.";
  }
  if (!Number.isFinite(input.jumlah) || input.jumlah <= 0) {
    return "Pagu anggaran harus lebih dari nol.";
  }
  if (input.jumlah > 100_000_000_000) {
    return "Pagu di luar batas wajar, periksa lagi.";
  }
  if (input.catatan.trim().length > 200) {
    return "Keterangan terlalu panjang (maksimal 200 huruf).";
  }
  return null;
}

/**
 * Anggaran yang sama tidak boleh dipagu dua kali.
 *
 * Satu periode × unit × jenis hanya punya satu pagu; dua baris untuk
 * kombinasi yang sama membuat "sisa anggaran" bergantung pada baris mana
 * yang kebetulan dibaca.
 */
export function anggaranBentrok(
  daftar: Anggaran[],
  input: MasukanAnggaran,
  kecualiId?: string,
): boolean {
  return daftar.some(
    (a) =>
      a.id !== kecualiId &&
      a.periode === input.periode &&
      a.unitKode === input.unitKode &&
      a.jenis === input.jenis,
  );
}

/** Judul baris yang bisa dibaca sendiri tanpa melihat kolom lain. */
export function judulAnggaran(a: Anggaran): string {
  return `${LABEL_JENIS_KELUAR[a.jenis]} · ${a.unitNama}`;
}
