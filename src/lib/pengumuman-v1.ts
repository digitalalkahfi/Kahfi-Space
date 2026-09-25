/**
 * Pengumuman ekspor V1 → bentuk `announcements` V2 — modul murni.
 *
 * Sistem lama menyimpan satu teks panjang; V2 memisahkan slug, ringkasan,
 * dan isi per paragraf (0003). Yang tidak ada di sistem lama — target
 * peran/unit, penyematan — dibiarkan kosong: pengumuman lama memang untuk
 * semua orang.
 */
import { teksBersih } from "@/lib/teks-v1";

export type PengumumanV1 = {
  idLama: string;
  slug: string;
  judul: string;
  ringkasan: string;
  isi: string[];
  dibuatOleh: string | null;
  dibuatPada: string | null;
};

/** Emoji, tanda bintang markdown, dan spasi berlebih dibuang dari judul. */
export function judulPengumuman(nilai: unknown): string {
  const judul = teksBersih(nilai)
    .replace(/[*_`#]+/g, "")
    .replace(/[\p{Extended_Pictographic}️]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return judul.length >= 3 ? judul : `Pengumuman ${judul}`.trim().slice(0, 160);
}

/**
 * Slug dari judul, selalu diakhiri potongan id lamanya: dua pengumuman
 * berjudul sama tidak boleh saling menimpa, dan pengulangan migrasi harus
 * menemukan slug yang sama lagi.
 */
export function slugPengumuman(judul: string, idLama: string): string {
  const dasar = judul
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  const ekor =
    idLama
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(-6) || "lama";
  return `${dasar || "pengumuman"}-${ekor}`;
}

/** Isi dipecah per paragraf (baris kosong sebagai pemisah); tidak pernah kosong. */
export function paragrafPengumuman(nilai: unknown): string[] {
  const paragraf = teksBersih(nilai)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
  return paragraf.length > 0 ? paragraf : ["(Pengumuman lama tanpa isi.)"];
}

/** Ringkasan: baris bermakna pertama, tanpa hiasan markdown, maksimal 160. */
export function ringkasanPengumuman(nilai: unknown): string {
  const baris = teksBersih(nilai)
    .split("\n")
    .map((b) => b.replace(/[*_`#]+/g, "").trim())
    .find((b) => b !== "");
  return (baris ?? "").slice(0, 160);
}

export function bacaPengumuman(daftar: unknown[]): {
  siap: PengumumanV1[];
  tertahan: { idLama: string; pesan: string }[];
} {
  const siap: PengumumanV1[] = [];
  const tertahan: { idLama: string; pesan: string }[] = [];
  for (const p of daftar) {
    if (p === null || typeof p !== "object") continue;
    const b = p as Record<string, unknown>;
    const idLama = typeof b.id === "string" ? b.id : "";
    if (idLama === "") continue;
    const judul = judulPengumuman(b.title ?? b.judul);
    const isi = b.content ?? b.isi;
    if (teksBersih(isi) === "" && teksBersih(b.title ?? b.judul) === "") {
      tertahan.push({ idLama, pesan: "Pengumuman tanpa judul dan tanpa isi." });
      continue;
    }
    siap.push({
      idLama,
      slug: slugPengumuman(judul, idLama),
      judul,
      ringkasan: ringkasanPengumuman(isi),
      isi: paragrafPengumuman(isi),
      dibuatOleh: typeof b.authorId === "string" ? b.authorId : null,
      dibuatPada: typeof b.createdAt === "string" ? b.createdAt : null,
    });
  }
  return { siap, tertahan };
}
