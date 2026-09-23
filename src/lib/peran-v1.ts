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

/** Divisi lama yang berarti bagian keuangan, bukan unit operasional. */
const DIVISI_KEUANGAN = new Set(["keuangan", "finance"]);

/**
 * Peran V2 dari sebutan lama, atau null bila tidak dikenali.
 *
 * `divisi` ikut dibaca untuk satu hal: orang di divisi keuangan adalah
 * Finance di V2, apa pun sebutan perannya di sistem lama. V2 tidak punya
 * unit keuangan, jadi "leader keuangan" tidak bisa menjadi Leader — ia
 * harus ditempatkan pada unit, dan unit itu tidak ada.
 */
export function peranV1(nilai: unknown, divisi?: unknown): Peran | null {
  if (
    typeof divisi === "string" &&
    DIVISI_KEUANGAN.has(divisi.trim().toLowerCase())
  ) {
    const peran =
      typeof nilai === "string" ? PERAN[nilai.trim().toLowerCase()] : null;
    if (peran !== "CEO" && peran !== "Manager") return "Finance";
  }
  if (typeof nilai !== "string") return null;
  const kunci = nilai.trim().toLowerCase().replace(/\s+/g, " ");
  return PERAN[kunci] ?? null;
}

/**
 * Nomor WhatsApp ke bentuk baku V2 (`+628…`, 0108), atau null bila
 * tidak bisa dibakukan dengan yakin.
 *
 * Sistem lama menyimpan nomor apa adanya: "089505622884",
 * "0812-3456-7890", kadang sudah "+62…". Nomor yang tidak jelas tidak
 * ditebak — kolomnya dibiarkan, karena nomor yang salah akan dipakai
 * mengirim pesan ke orang yang keliru.
 */
export function kontakV1(nilai: unknown): string | null {
  if (typeof nilai !== "string") return null;
  const digit = nilai.replace(/\D/g, "");
  if (digit === "") return null;

  let baku: string;
  if (digit.startsWith("62")) baku = `+${digit}`;
  else if (digit.startsWith("0")) baku = `+62${digit.slice(1)}`;
  else if (digit.startsWith("8")) baku = `+62${digit}`;
  else return null;

  return /^\+628[0-9]{8,12}$/.test(baku) ? baku : null;
}

/** Nama program V2 yang tersirat dari divisi lama, bila ada. */
export function programV1(divisi: unknown): string | null {
  if (typeof divisi !== "string") return null;
  return divisi.trim().toLowerCase() === "mabit" ? "Mabit Scholar" : null;
}

const UNIT: Record<string, string> = {
  affiliator: "affiliator",
  affiliate: "affiliator",
  "affiliator network": "affiliator",
  affiliasi: "affiliator",
  // Divisi K-Space lama yang sebenarnya: "internal" adalah affiliator
  // internal perusahaan, "mabit" adalah affiliator program Mabit Scholar
  // — keduanya unit Affiliator Network di V2 (programnya dibedakan).
  internal: "affiliator",
  mabit: "affiliator",
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
