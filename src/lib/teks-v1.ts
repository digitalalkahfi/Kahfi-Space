/** Alat kecil bersama untuk pembacaan teks ekspor V1 — modul murni. */

/** Teks apa adanya, dirapikan; bukan string → kosong. */
export function teksBersih(nilai: unknown): string {
  return typeof nilai === "string" ? nilai.replace(/\r\n/g, "\n").trim() : "";
}

/** Potong ke batas kolom V2 tanpa memutus di tengah kata bila bisa. */
export function potong(teks: string, batas: number): string {
  if (teks.length <= batas) return teks;
  const dipotong = teks.slice(0, batas);
  const spasi = dipotong.lastIndexOf(" ");
  return (spasi > batas * 0.6 ? dipotong.slice(0, spasi) : dipotong).trimEnd();
}

/** Gabungkan baris-baris keterangan, melewati yang kosong. */
export function gabungBaris(...baris: (string | null | undefined)[]): string {
  return baris
    .map((b) => (b ?? "").trim())
    .filter((b) => b !== "")
    .join("\n");
}

/** Jam "H:MM" atau "HH:MM" → "HH:MM"; selain itu null. */
export function jamV1(nilai: unknown): string | null {
  if (typeof nilai !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(nilai.trim());
  if (!m) return null;
  const jam = Number(m[1]);
  const menit = Number(m[2]);
  if (jam > 23 || menit > 59) return null;
  return `${String(jam).padStart(2, "0")}:${m[2]}`;
}

/** Tautan http(s) yang sah, atau null. */
export function tautanV1(nilai: unknown): string | null {
  if (typeof nilai !== "string") return null;
  const t = nilai.trim();
  return /^https?:\/\/[^\s]+$/.test(t) ? t : null;
}
