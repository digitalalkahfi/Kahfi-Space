/**
 * Rekap per kelompok data ekspor lama — modul murni.
 *
 * Menjawab tiga angka untuk tiap kelompok: berapa entri ada di ekspor,
 * berapa yang sudah bisa dipetakan, dan berapa yang masih butuh
 * keputusan orang. Angka ketiga itu yang menentukan kapan migrasi boleh
 * dijalankan — entri yang menunjuk orang tak dikenal tidak boleh
 * dipaksa masuk dengan penunjuk kosong, karena laporan tanpa pelapor
 * dan tugas tanpa penerima adalah data yang tampak utuh tetapi tidak
 * bisa dipakai.
 */
import type { PemetaanEntitas } from "@/lib/pemetaan";

/**
 * Medan yang isinya menunjuk orang di sistem lama.
 *
 * Semuanya memakai `users:list.id`; itulah satu-satunya jalan
 * menyambungkan data lama ke orang yang benar di V2.
 */
export const MEDAN_ORANG = [
  "userId",
  "authorId",
  "inputById",
  "assigneeId",
  "decidedById",
  "createdById",
  "checkedById",
  "picId",
  "coLeaderId",
  "leaderId",
] as const;

export type BarisRekapKelompok = {
  kunci: string;
  label: string;
  /** Entri yang ada di ekspor untuk kunci ini. */
  ekspor: number;
  /** Entri yang seluruh rujukan orangnya sudah ketemu. */
  terpetakan: number;
  /** Entri yang menunggu keputusan orang. */
  butuhKeputusan: number;
  /** Id orang lama yang tidak ada di users:list, tanpa kembar. */
  orangHilang: string[];
  /** Catatan yang sudah punya padanan di V2 (`migrasi_peta`). */
  dipindahkan: number;
};

function larik(isi: Record<string, unknown>, kunci: string) {
  const nilai = isi[kunci];
  if (Array.isArray(nilai)) return nilai as unknown[];
  // Kunci berisi satu objek pengaturan tetap terhitung satu entri.
  return nilai === null || nilai === undefined ? [] : [nilai];
}

/** Seluruh id orang yang dikenal ekspor. */
export function idOrangEkspor(isi: Record<string, unknown>): Set<string> {
  const id = new Set<string>();
  for (const o of larik(isi, "users:list")) {
    if (o !== null && typeof o === "object") {
      const nilai = (o as Record<string, unknown>).id;
      if (typeof nilai === "string" && nilai !== "") id.add(nilai);
    }
  }
  return id;
}

/** Rujukan orang pada satu entri yang tidak ada di daftar orang. */
export function orangTakDikenal(entri: unknown, dikenal: Set<string>) {
  if (entri === null || typeof entri !== "object" || Array.isArray(entri)) {
    return [];
  }

  const hilang: string[] = [];
  const objek = entri as Record<string, unknown>;
  for (const medan of MEDAN_ORANG) {
    const nilai = objek[medan];
    // Penunjuk kosong bukan penunjuk yang hilang: banyak entri lama
    // memang tidak punya atasan atau co-leader.
    if (typeof nilai !== "string" || nilai === "") continue;
    if (!dikenal.has(nilai)) hilang.push(nilai);
  }
  return hilang;
}

/** Rekap seluruh kelompok yang dipetakan, urut sesuai pemetaannya. */
export function rekapPemetaan(
  isi: Record<string, unknown>,
  kelompok: PemetaanEntitas[],
  /** Berapa catatan tiap kelompok yang sudah punya padanan di V2. */
  dipindahkan: Record<string, number> = {},
): BarisRekapKelompok[] {
  const dikenal = idOrangEkspor(isi);

  return kelompok.map((k) => {
    const entri = larik(isi, k.kunci);
    const hilang = new Set<string>();
    let butuh = 0;

    for (const e of entri) {
      const takDikenal = orangTakDikenal(e, dikenal);
      if (takDikenal.length === 0) continue;
      butuh += 1;
      for (const id of takDikenal) hilang.add(id);
    }

    return {
      kunci: k.kunci,
      label: k.label,
      ekspor: entri.length,
      terpetakan: entri.length - butuh,
      butuhKeputusan: butuh,
      orangHilang: [...hilang].sort(),
      dipindahkan: dipindahkan[k.kunci] ?? 0,
    };
  });
}

/** Menjumlahkan seluruh rekap menjadi satu baris. */
export function totalRekap(baris: BarisRekapKelompok[]) {
  const orang = new Set<string>();
  for (const b of baris) for (const id of b.orangHilang) orang.add(id);

  return {
    ekspor: baris.reduce((a, b) => a + b.ekspor, 0),
    terpetakan: baris.reduce((a, b) => a + b.terpetakan, 0),
    butuhKeputusan: baris.reduce((a, b) => a + b.butuhKeputusan, 0),
    dipindahkan: baris.reduce((a, b) => a + b.dipindahkan, 0),
    orangHilang: [...orang].sort(),
  };
}

export type OrangDitunggu = {
  idLama: string;
  nama: string;
  /** Kunci ekspor tempat id ini muncul. */
  kemunculan: string[];
  jumlah: number;
};

/**
 * Orang yang ditunjuk data lama tetapi tidak ada di `users:list`.
 *
 * Sumbernya bukan hanya daftar orang: sebuah laporan bisa menunjuk
 * `userId` yang sudah tidak ada di daftar, dan tugas bisa menunjuk
 * penerima yang tidak pernah terekspor. Yang seperti itu tidak akan
 * pernah ketemu lewat penautan otomatis — ia harus diputuskan orang,
 * dan untuk itu ia harus terlihat lebih dulu.
 */
export function orangDitunggu(
  isi: Record<string, unknown>,
  kelompok: { kunci: string }[],
): OrangDitunggu[] {
  const dikenal = idOrangEkspor(isi);
  const peta = new Map<string, OrangDitunggu>();

  for (const k of kelompok) {
    const nilai = isi[k.kunci];
    const daftar = Array.isArray(nilai)
      ? nilai
      : nilai === null || nilai === undefined
        ? []
        : [nilai];

    for (const entri of daftar) {
      for (const idLama of orangTakDikenal(entri, dikenal)) {
        const baris = peta.get(idLama) ?? {
          idLama,
          nama: "",
          kemunculan: [],
          jumlah: 0,
        };
        baris.jumlah += 1;
        if (!baris.kemunculan.includes(k.kunci)) {
          baris.kemunculan.push(k.kunci);
        }
        peta.set(idLama, baris);
      }
    }
  }

  return [...peta.values()].sort(
    (a, b) => b.jumlah - a.jumlah || a.idLama.localeCompare(b.idLama),
  );
}
