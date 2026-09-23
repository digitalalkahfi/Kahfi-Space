import { bilangan, persen, rupiahRingkas } from "@/lib/format";

/**
 * Bentuk data untuk grafik — netral terhadap modul.
 *
 * Sebelumnya tipe-tipe ini tinggal di `grafik-finance.ts`, dan itu
 * masuk akal selama hanya Finance yang menggambar grafik. Sejak dasbor
 * Analitik GMV memakai `GrafikGaris` yang sama, komponen bersama di
 * `components/shared/` jadi harus mengimpor modul Finance untuk sekadar
 * tahu bentuk sebuah titik — arah ketergantungan yang terbalik.
 *
 * Isinya bentuk data dan hitungan sumbu yang murni — tidak ada React,
 * tidak ada akses data, jadi komponen server maupun klien sama-sama
 * boleh mengimpornya. `grafik-finance.ts` mengekspor ulang bentuk
 * lamanya supaya pemanggil lama tidak perlu ikut berubah.
 */

export type TitikGrafik = {
  label: string;
  nilai: number;
};

export type BagianKomposisi = {
  label: string;
  nilai: number;
  /** Kelas warna Tailwind untuk potongannya. */
  warna: string;
};

export type KolomKomposisi = {
  label: string;
  bagian: BagianKomposisi[];
  total: number;
};

/** Satuan sebuah garis; menentukan format label sumbunya. */
export type SatuanGrafik = "rupiah" | "angka" | "persen";

/**
 * Angka sesuai satuannya.
 *
 * `prefix: false` membuang "Rp" — dipakai di label sumbu, tempat
 * satuan yang diulang tiga kali bukan lagi informasi.
 */
export function teksSatuan(
  nilai: number,
  satuan: SatuanGrafik,
  { prefix = true } = {},
): string {
  if (satuan === "persen") return persen(nilai);
  if (satuan === "angka") return bilangan(nilai);
  return rupiahRingkas(nilai, { prefix });
}

/**
 * Satu garis pada grafik perbandingan.
 *
 * Warnanya dititipkan sebagai kelas Tailwind yang ditulis utuh oleh
 * pemanggil — bukan diturunkan lewat penggantian teks. Tailwind hanya
 * membangkitkan kelas yang benar-benar ada di kode sumber, jadi
 * `"stroke-x".replace("stroke-", "fill-")` menghasilkan kelas yang tidak
 * pernah dibuat, dan garisnya hitam tanpa ada yang salah di kode.
 */
export type GarisSeri = {
  kunci: string;
  label: string;
  /** Kelas `stroke-*` untuk garisnya. */
  warna: string;
  /** Kelas `bg-*` untuk titik dan penanda legendanya. */
  warnaLegenda: string;
  satuan: SatuanGrafik;
  titik: TitikGrafik[];
  /**
   * Digambar putus-putus dan lebih redup, mis. garis target.
   *
   * Bukan sekadar gaya: yang putus-putus adalah angka yang
   * direncanakan, bukan angka yang terjadi — keduanya tidak boleh
   * terlihat sama meyakinkannya.
   */
  putus?: boolean;
};

/* ------------------------------------------------------------------ *
 * Pembagian sumbu
 * ------------------------------------------------------------------ */

/**
 * Selisih besaran yang membuat garis kecil tidak terbaca lagi.
 *
 * Pada empat kali lipat, garis yang kecil masih menempati seperempat
 * bawah bingkai — masih kelihatan bentuknya. Lebih dari itu ia rata di
 * dasar grafik dan sama saja dengan tidak digambar.
 */
export const AMBANG_SUMBU_KEDUA = 4;

export type SisiSumbu = "kiri" | "kanan";

/**
 * Sumbu untuk tiap garis: kiri, atau kanan dengan skalanya sendiri.
 *
 * Sumbu kedua bukan hiasan dan bukan pilihan gaya — ia dipakai hanya
 * saat tanpa itu salah satu garis tidak akan terlihat sama sekali:
 *
 * - **Satuan berbeda tidak pernah berbagi sumbu.** Rupiah dan jumlah
 *   laporan pada satu skala menghasilkan angka yang tidak berarti apa
 *   pun.
 * - **Dua garis bersatuan sama** tetap berbagi sumbu selama besarannya
 *   sepadan — di situlah justru letak informasinya: lini yang dua kali
 *   lebih besar harus tergambar dua kali lebih tinggi. Sumbu terpisah
 *   baru dipakai bila selisihnya melewati `AMBANG_SUMBU_KEDUA`.
 * - **Tiga garis atau lebih** selalu satu sumbu. Dengan tiga skala yang
 *   berbeda, tidak ada lagi yang bisa dibandingkan — grafiknya cuma
 *   tiga gambar yang kebetulan ditumpuk.
 */
export function bagiSumbu(
  seri: { satuan: SatuanGrafik; titik: TitikGrafik[] }[],
): SisiSumbu[] {
  if (seri.length === 0) return [];
  const utama = seri[0].satuan;
  const sisi: SisiSumbu[] = seri.map((s) =>
    s.satuan === utama ? "kiri" : "kanan",
  );

  if (seri.length === 2 && sisi[1] === "kiri") {
    const puncak = seri.map((s) => Math.max(0, ...s.titik.map((t) => t.nilai)));
    const besar = Math.max(...puncak);
    const kecil = Math.min(...puncak);
    if (kecil <= 0 ? besar > 0 : besar / kecil >= AMBANG_SUMBU_KEDUA) {
      sisi[1] = "kanan";
    }
  }

  return sisi;
}

/* ------------------------------------------------------------------ *
 * Hitungan sumbu
 * ------------------------------------------------------------------ */

/** Langkah sumbu yang enak dibaca; kelipatan 1/1,5/2/…/10 × pangkat 10. */
const LANGKAH_RAPI = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/**
 * Pembulatan ke atas ke angka "bulat" terdekat.
 *
 * Sumbu yang berhenti persis di nilai tertinggi membuat garisnya
 * menempel ke tepi atas, dan labelnya jadi angka ganjil seperti
 * "Rp 34,17 Jt". Dibulatkan ke atas, garisnya punya ruang napas dan
 * labelnya bisa dibaca sekilas.
 */
export function puncakRapi(nilai: number): number {
  if (!Number.isFinite(nilai) || nilai <= 0) return 1;
  const pangkat = 10 ** Math.floor(Math.log10(nilai));
  const sisa = nilai / pangkat;
  const langkah = LANGKAH_RAPI.find((l) => sisa <= l + 1e-9) ?? 10;
  return langkah * pangkat;
}

export type SkalaGrafik = {
  min: number;
  max: number;
  /** Nilai garis bantu, dari atas ke bawah. */
  tanda: number[];
};

/**
 * Batas sumbu tegak untuk sekumpulan nilai.
 *
 * Selalu menyertakan nol: garis yang dimulai dari nilai terendahnya
 * sendiri membesar-besarkan naik-turun kecil sampai terlihat seperti
 * guncangan. Sisi bawah baru turun di bawah nol kalau memang ada nilai
 * negatif.
 */
export function skalaGrafik(nilai: number[]): SkalaGrafik {
  const atas = puncakRapi(Math.max(0, ...nilai));
  const terendah = Math.min(0, ...nilai);
  const bawah = terendah < 0 ? -puncakRapi(-terendah) : 0;
  return { min: bawah, max: atas, tanda: [atas, (atas + bawah) / 2, bawah] };
}

/**
 * Indeks titik yang diberi label pada sumbu mendatar.
 *
 * Tidak semua titik dapat label: 31 tanggal berjejer pada lebar ponsel
 * saling menimpa sampai tidak satu pun terbaca. Ujung kiri dan kanan
 * selalu dapat — itu dua label yang paling sering dicari orang.
 */
export function labelSumbuX(panjang: number, maks = 6): number[] {
  if (panjang <= 0) return [];
  if (panjang <= maks) return Array.from({ length: panjang }, (_, i) => i);

  const langkah = Math.ceil((panjang - 1) / (maks - 1));
  const indeks: number[] = [];
  for (let i = 0; i < panjang - 1; i += langkah) indeks.push(i);
  // Label terakhir dipaksa ke ujung kanan. Kalau jadi terlalu rapat
  // dengan label sebelumnya, yang sebelumnya yang mengalah.
  const sebelum = indeks.at(-1);
  if (sebelum !== undefined && panjang - 1 - sebelum < langkah / 2) {
    indeks.pop();
  }
  indeks.push(panjang - 1);
  return indeks;
}

/**
 * Gaya dua garis pembanding yang berbeda arti.
 *
 * TARGET adalah sasaran yang berubah tiap bulan mengikuti anak tangga
 * GRD; digambar tipis dan pekat, satu potong di atas tiap batang.
 * MINIMUM adalah lantai yang melekat pada level akun dan tidak berubah
 * sepanjang rentang; digambar tebal, putus-putus, berwarna peringatan,
 * melintang penuh.
 *
 * Keduanya dikunci di satu tempat supaya tidak pernah bertemu dalam
 * bentuk yang sama: dua garis mendatar yang mirip pada grafik-grafik
 * bertetangga adalah cara tercepat membuat orang salah membaca "sudah
 * lewat target" sebagai "sudah lewat minimum". `garis` dipakai pada
 * grafiknya, `swatch` pada legendanya — satu sumber, jadi contoh di
 * legenda tidak bisa melenceng dari garis yang sebenarnya.
 */
export const GAYA_GARIS_PEMBANDING = {
  target: {
    label: "Target harian",
    garis: "bg-foreground/45",
    swatch: "h-px w-3 bg-foreground/45",
  },
  minimum: {
    label: "Batas minimum",
    garis: "border-t-2 border-dashed border-warn-text/70",
    swatch: "h-0 w-4 border-t-2 border-dashed border-warn-text/70",
  },
} as const;
