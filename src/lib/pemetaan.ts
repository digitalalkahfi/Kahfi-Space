/**
 * Bentuk pemetaan medan lama ke kolom skema baru — modul murni.
 *
 * Isinya tipe dan penolong; daftar pemetaannya sendiri ada di
 * `src/lib/pemetaan-v1.ts`. Ditulis sebagai data, bukan kode bercabang,
 * supaya bisa ditampilkan apa adanya di layar dan disetujui orang
 * sebelum dijalankan — migrasi yang pemetaannya hanya hidup di dalam
 * kode tidak bisa ditinjau siapa pun kecuali yang menulisnya.
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
  /**
   * Benar bila beberapa medan lama sengaja digabung ke satu kolom.
   *
   * Formulir lama memakai judul pertanyaan sebagai nama medan, sehingga
   * jawaban bebas tersebar di beberapa nama yang berbeda-beda. Semuanya
   * digabung ke satu kolom catatan — bukan dipilih salah satu, karena
   * yang tidak terpilih akan hilang tanpa jejak.
   */
  gabung?: true;
};

export type PemetaanEntitas = {
  kunci: string;
  label: string;
  tabelBaru: string;
  baris: BarisPemetaan[];
  /** Medan lama yang sengaja tidak dipindahkan, beserta alasannya. */
  dibuang: { medanLama: string; alasan: string }[];
};

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
      [b.medanLama ?? "-", b.kolomBaru, b.ubahan, b.wajib ? "w" : "o"].join(
        ">",
      ),
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
