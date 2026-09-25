/**
 * Pembanding V1 vs V2 — modul murni.
 *
 * Migrasi yang berjalan tanpa pesan galat belum berarti datanya utuh.
 * Yang membuktikannya cuma satu: angka yang sama dihitung dari dua sisi
 * dan hasilnya bertemu. Karena itu setiap baris di sini memuat angka V1
 * dan angka V2 apa adanya — bukan satu angka "hasil migrasi" yang tidak
 * bisa dibantah siapa pun.
 */

export type Satuan = "angka" | "rupiah";

export type BarisBanding = {
  /** Nama ukurannya, mis. "Jumlah anggota". */
  ukuran: string;
  /** Angka dari ekspor K-Space lama; null bila belum terbaca. */
  v1: number | null;
  /** Angka dari basis data V2; null bila belum dihitung. */
  v2: number | null;
  satuan: Satuan;
  /** Keterangan tambahan, mis. sebab selisih yang memang diharapkan. */
  catatan?: string;
};

export type KelompokBanding = {
  kunci: string;
  judul: string;
  keterangan: string;
  baris: BarisBanding[];
};

export type StatusBanding = "cocok" | "selisih" | "belum";

export type PenilaianBanding = {
  status: StatusBanding;
  /** V2 dikurangi V1; null bila salah satu sisinya belum ada. */
  selisih: number | null;
  /**
   * Ke arah mana selisihnya.
   *
   * Dibedakan karena artinya berbeda: "kurang" berarti ada data lama
   * yang tidak sampai — kehilangan. "lebih" berarti ada yang masuk dua
   * kali, atau ada baris baru yang dibuat orang sesudah migrasi. Kedua-
   * duanya perlu dijelaskan, tetapi yang pertama tidak bisa ditunda.
   */
  arah: "kurang" | "lebih" | null;
  keterangan: string;
};

/**
 * Menilai satu baris pembanding.
 *
 * Yang belum terhitung sengaja tidak ditandai merah: menandai semua yang
 * belum diketahui sebagai masalah hanya membuat orang terbiasa
 * mengabaikan peringatan, dan peringatan yang diabaikan sama saja dengan
 * tidak ada.
 */
export function nilaiBanding(b: BarisBanding): PenilaianBanding {
  if (b.v1 === null && b.v2 === null) {
    return {
      status: "belum",
      selisih: null,
      arah: null,
      keterangan: "Belum terhitung di kedua sisi.",
    };
  }
  if (b.v1 === null) {
    return {
      status: "belum",
      selisih: null,
      arah: null,
      keterangan: "Angka V1 belum terbaca; unggah dulu ekspor sistem lama.",
    };
  }
  if (b.v2 === null) {
    return {
      status: "belum",
      selisih: null,
      arah: null,
      keterangan: "Angka V2 belum dihitung.",
    };
  }

  const selisih = b.v2 - b.v1;
  if (selisih === 0) {
    return { status: "cocok", selisih: 0, arah: null, keterangan: "Cocok." };
  }

  return {
    status: "selisih",
    selisih,
    arah: selisih > 0 ? "lebih" : "kurang",
    keterangan:
      selisih > 0
        ? `V2 lebih banyak ${Math.abs(selisih).toLocaleString("id-ID")}. Bisa jadi ada baris baru yang dibuat setelah migrasi — atau ada yang masuk dua kali.`
        : `V2 kurang ${Math.abs(selisih).toLocaleString("id-ID")}. Ada data lama yang belum pindah.`,
  };
}

/**
 * Warna penanda selisih.
 *
 * Kurang dan lebih sengaja tidak sewarna: yang kurang berarti data lama
 * hilang, dan itu tidak bisa ditunda. Yang lebih berarti ada yang
 * berlebih — perlu dijelaskan, tetapi tidak sama gawatnya.
 */
export function gayaBanding(nilai: PenilaianBanding): string {
  if (nilai.status === "cocok") return "bg-ok-fill text-ok-text";
  if (nilai.status === "belum") return "bg-muted text-muted-foreground";
  return nilai.arah === "kurang"
    ? "bg-danger-fill text-danger-text"
    : "bg-warn-fill text-warn-text";
}

export const LABEL_ARAH: Record<"kurang" | "lebih", string> = {
  kurang: "V2 kurang — ada data lama yang belum sampai",
  lebih: "V2 lebih — ada yang berlebih atau dibuat setelah migrasi",
};

/** Berapa baris yang benar-benar berselisih dalam satu kelompok. */
export function jumlahSelisih(kelompok: KelompokBanding[]) {
  return kelompok.reduce(
    (a, k) =>
      a + k.baris.filter((b) => nilaiBanding(b).status === "selisih").length,
    0,
  );
}

/** Berapa baris yang kedua sisinya sudah terhitung. */
export function jumlahTerhitung(kelompok: KelompokBanding[]) {
  return kelompok.reduce(
    (a, k) =>
      a + k.baris.filter((b) => nilaiBanding(b).status !== "belum").length,
    0,
  );
}

/**
 * Entitas yang memang belum ikut dipindahkan pada tahap ini.
 *
 * Disebut satu per satu di layar, bukan dibiarkan kosong: orang yang
 * mencari data sampelnya di V2 berhak menemukan jawabannya di sini
 * alih-alih menyimpulkan bahwa migrasinya rusak.
 */
export const ENTITAS_TAHAP_2: { kunci: string; label: string }[] = [
  // Kosong sejak 25 Sep 2026: seluruh kunci data lama sudah punya tempat
  // di V2 atau diputuskan tidak dibawa (catatan di 0167; seller diabaikan). Daftarnya dipertahankan
  // supaya layar banding tetap punya tempat bila ekspor lain muncul.
];

/**
 * Berapa entri yang menunggu di ekspor untuk tiap entitas tahap 2.
 *
 * Kuncinya belum dipetakan, jadi ia tidak punya nama baku — yang ada di
 * ekspor bisa `problems:all`, `problem:list`, atau apa pun. Dicocokkan
 * dari awalannya, dan yang tidak ketemu ditulis nol, bukan disembunyikan:
 * "tidak ada di ekspor" dan "ada tetapi belum dipindahkan" adalah dua
 * jawaban yang berbeda untuk orang yang mencari datanya.
 */
export function jumlahTahap2(
  kunciEkspor: { kunci: string; jumlah: number }[],
): Record<string, number> {
  const hasil: Record<string, number> = {};

  for (const e of ENTITAS_TAHAP_2) {
    hasil[e.kunci] = kunciEkspor
      .filter((k) => {
        const awal = k.kunci.split(":")[0].toLowerCase();
        return (
          awal === e.kunci || awal === `${e.kunci}s` || awal.startsWith(e.kunci)
        );
      })
      .reduce((a, k) => a + k.jumlah, 0);
  }

  return hasil;
}
