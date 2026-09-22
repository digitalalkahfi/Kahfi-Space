/**
 * Membuat kode QR sebagai SVG — modul murni, dijalankan di server.
 *
 * SVG dipilih supaya stikernya tetap tajam pada ukuran cetak berapa pun;
 * gambar raster kecil yang diperbesar sering gagal terbaca pemindai.
 */
import buatQr from "qrcode-generator";

export type PetaQr = {
  ukuran: number;
  /** Baris demi baris; true berarti modul gelap. */
  modul: boolean[][];
};

/**
 * Tingkat koreksi galat 'M' menahan sekitar 15% kerusakan — cukup untuk
 * stiker yang tergores atau terkena debu gudang, tanpa membuat polanya
 * terlalu rapat untuk dicetak kecil.
 */
export function petaQr(isi: string): PetaQr {
  const qr = buatQr(0, "M");
  qr.addData(isi);
  qr.make();

  const ukuran = qr.getModuleCount();
  const modul: boolean[][] = [];
  for (let baris = 0; baris < ukuran; baris++) {
    const isiBaris: boolean[] = [];
    for (let kolom = 0; kolom < ukuran; kolom++) {
      isiBaris.push(qr.isDark(baris, kolom));
    }
    modul.push(isiBaris);
  }

  return { ukuran, modul };
}

/**
 * Jalur SVG untuk seluruh modul gelap.
 *
 * Digabung menjadi satu `path` alih-alih ribuan `rect`: satu elemen jauh
 * lebih ringan dirender dan dicetak.
 */
export function jalurQr(peta: PetaQr): string {
  const bagian: string[] = [];
  for (let baris = 0; baris < peta.ukuran; baris++) {
    for (let kolom = 0; kolom < peta.ukuran; kolom++) {
      if (peta.modul[baris][kolom]) {
        bagian.push(`M${kolom} ${baris}h1v1h-1z`);
      }
    }
  }
  return bagian.join("");
}

/** Lebar tepi kosong wajib di sekeliling QR (4 modul, sesuai standar). */
export const TEPI_QR = 4;
