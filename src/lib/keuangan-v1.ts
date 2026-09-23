/**
 * Menyamakan sebutan arus kas sistem lama — modul murni.
 *
 * Kategori pengeluaran di V1 teks bebas; di V2 ia enum yang menentukan
 * bagaimana angkanya masuk laporan keuangan. Yang tidak punya padanan
 * tidak ditebak — ia masuk sebagai beban, jenis paling netral, dan
 * kategori aslinya ikut ditulis ke keterangan supaya tidak hilang.
 */

export type JenisKeluar =
  "beban" | "aset" | "direct_cost" | "creator_share" | "dividen";

const JENIS: Record<string, JenisKeluar> = {
  beban: "beban",
  expense: "beban",
  operasional: "beban",
  operational: "beban",
  gaji: "beban",
  payroll: "beban",
  aset: "aset",
  asset: "aset",
  inventaris: "aset",
  "direct cost": "direct_cost",
  direct_cost: "direct_cost",
  hpp: "direct_cost",
  cogs: "direct_cost",
  "creator share": "creator_share",
  creator_share: "creator_share",
  komisi: "creator_share",
  "bagi hasil": "creator_share",
  dividen: "dividen",
  dividend: "dividen",
  prive: "dividen",
};

/** Jenis pengeluaran V2 dari kategori lama; null bila tidak dikenali. */
export function jenisKeluarV1(nilai: unknown): JenisKeluar | null {
  if (typeof nilai !== "string") return null;
  const kunci = nilai.trim().toLowerCase().replace(/\s+/g, " ");
  return JENIS[kunci] ?? null;
}

/** Arah transaksi; apa pun selain penanda masuk dianggap keluar. */
export function arahV1(nilai: unknown): "masuk" | "keluar" {
  const teks = typeof nilai === "string" ? nilai.trim().toLowerCase() : "";
  // Sengaja hanya penanda masuk yang dikenali: salah menandai
  // pengeluaran sebagai pemasukan membuat saldo tampak lebih besar dari
  // yang sebenarnya, dan itu kesalahan yang paling mahal di sini.
  return ["in", "masuk", "income", "credit", "pemasukan"].includes(teks)
    ? "masuk"
    : "keluar";
}

/**
 * Keterangan transaksi, dengan kategori lama ikut ditulis bila jenisnya
 * tidak punya padanan.
 */
export function keteranganKas(
  keterangan: unknown,
  kategori: unknown,
  dikenali: boolean,
): string {
  const dasar =
    typeof keterangan === "string" && keterangan.trim() !== ""
      ? keterangan.trim()
      : "Transaksi dari K-Space lama";
  const kat =
    typeof kategori === "string" && kategori.trim() !== ""
      ? kategori.trim()
      : null;

  if (!kat || dikenali) return dasar.slice(0, 500);
  return `${dasar} (kategori lama: ${kat})`.slice(0, 500);
}
