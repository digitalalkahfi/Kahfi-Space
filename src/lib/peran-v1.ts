/**
 * Menyamakan sebutan peran dan unit sistem lama dengan yang di V2 —
 * modul murni.
 *
 * Sistem lama menulis peran dan divisi sebagai teks bebas: "admin",
 * "Team Leader", "AFFILIATOR". Menolak yang ejaannya berbeda berarti
 * menahan hampir seluruh orang; menerimanya apa adanya berarti menulis
 * peran yang tidak dikenali basis data. Jadi yang dikenali diterjemahkan,
 * dan yang tidak dikenali dikembalikan sebagai tidak tahu — bukan
 * ditebak menjadi Staff, karena peran menentukan siapa melihat apa.
 */
import type { Peran } from "@/lib/types";

const PERAN: Record<string, Peran> = {
  ceo: "CEO",
  owner: "CEO",
  founder: "CEO",
  manager: "Manager",
  manajer: "Manager",
  admin: "Manager",
  leader: "Leader",
  "team leader": "Leader",
  "co-leader": "Co-Leader",
  "co leader": "Co-Leader",
  coleader: "Co-Leader",
  wakil: "Co-Leader",
  staff: "Staff",
  staf: "Staff",
  anggota: "Staff",
  member: "Staff",
  finance: "Finance",
  keuangan: "Finance",
};

/** Peran V2 dari sebutan lama, atau null bila tidak dikenali. */
export function peranV1(nilai: unknown): Peran | null {
  if (typeof nilai !== "string") return null;
  const kunci = nilai.trim().toLowerCase().replace(/\s+/g, " ");
  return PERAN[kunci] ?? null;
}

const UNIT: Record<string, string> = {
  affiliator: "affiliator",
  affiliate: "affiliator",
  "affiliator network": "affiliator",
  affiliasi: "affiliator",
  mcn: "mcn",
  mmc: "mcn",
  "mcn (incl. mmc)": "mcn",
  tap: "tap",
  "tiktok agency partner": "tap",
  "brand ads": "tap",
};

/** Kode unit V2 dari sebutan divisi lama, atau null. */
export function unitV1(nilai: unknown): string | null {
  if (typeof nilai !== "string") return null;
  const kunci = nilai.trim().toLowerCase().replace(/\s+/g, " ");
  return UNIT[kunci] ?? null;
}

/** Status aktif dari penanda lama yang bentuknya bermacam-macam. */
export function statusV1(nilai: unknown): "aktif" | "nonaktif" {
  if (typeof nilai === "boolean") return nilai ? "aktif" : "nonaktif";
  if (typeof nilai === "string") {
    const teks = nilai.trim().toLowerCase();
    if (["false", "0", "nonaktif", "inactive", "resign"].includes(teks)) {
      return "nonaktif";
    }
  }
  // Tidak disebutkan berarti masih bekerja: menonaktifkan orang yang
  // sebenarnya aktif akan mengunci mereka dari sistem barunya sendiri.
  return "aktif";
}
