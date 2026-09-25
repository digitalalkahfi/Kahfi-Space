/**
 * Masukan (saran & bug) ekspor V1 → `feedback` V2 — modul murni.
 *
 * Sistem lama hanya punya pesan; V2 memisahkan judul (≥10 huruf) dan isi.
 * Judulnya diambil dari kalimat pertama pesan. Lampiran gambar lama tidak
 * punya kolom di V2 dan tetap tersimpan di penyimpanan sistem lama, jadi
 * tautannya ditulis di isi supaya masih bisa dibuka.
 */
import { gabungBaris, potong, teksBersih } from "@/lib/teks-v1";

export type JenisMasukan = "bug" | "saran" | "pertanyaan";
export type StatusMasukan =
  "baru" | "ditinjau" | "dikerjakan" | "selesai" | "ditolak";

export type KomentarV1 = {
  idLama: string;
  oleh: string | null;
  isi: string;
  pada: string | null;
};

export type MasukanV1 = {
  idLama: string;
  jenis: JenisMasukan;
  judul: string;
  isi: string;
  halaman: string;
  status: StatusMasukan;
  dilaporkanOleh: string | null;
  dibuatPada: string | null;
  komentar: KomentarV1[];
};

export function jenisMasukanV1(nilai: unknown): JenisMasukan {
  const t = teksBersih(nilai).toLowerCase();
  if (["bug", "galat", "error"].includes(t)) return "bug";
  if (["pertanyaan", "tanya", "question"].includes(t)) return "pertanyaan";
  return "saran";
}

export function statusMasukanV1(nilai: unknown): StatusMasukan {
  const t = teksBersih(nilai).toLowerCase();
  if (["selesai", "done", "resolved", "closed"].includes(t)) return "selesai";
  if (["ditolak", "rejected"].includes(t)) return "ditolak";
  if (["ditinjau", "reviewed"].includes(t)) return "ditinjau";
  return "baru";
}

/** Judul dari kalimat pertama pesan; V2 mewajibkan ≥10 huruf. */
export function judulMasukan(pesan: string): string {
  const kalimat = pesan.split(/(?<=[.!?])\s+|\n/)[0]?.trim() ?? "";
  const judul = potong(kalimat, 120);
  return judul.length >= 10
    ? judul
    : potong(`${judul} (masukan lama)`.trim(), 120);
}

export function bacaMasukan(daftar: unknown[]): {
  siap: MasukanV1[];
  tertahan: { idLama: string; pesan: string }[];
} {
  const siap: MasukanV1[] = [];
  const tertahan: { idLama: string; pesan: string }[] = [];
  for (const f of daftar) {
    if (f === null || typeof f !== "object") continue;
    const b = f as Record<string, unknown>;
    const idLama = typeof b.id === "string" ? b.id : "";
    if (idLama === "") continue;
    const pesan = teksBersih(b.message);
    if (pesan === "") {
      tertahan.push({ idLama, pesan: "Masukan tanpa pesan." });
      continue;
    }
    const jenisLama = teksBersih(b.type).toLowerCase();
    const jenis = jenisMasukanV1(jenisLama);
    const gambar = Array.isArray(b.images)
      ? b.images.filter((g): g is string => typeof g === "string" && g !== "")
      : [];

    const komentar: KomentarV1[] = [];
    for (const r of Array.isArray(b.replies) ? b.replies : []) {
      if (r === null || typeof r !== "object") continue;
      const k = r as Record<string, unknown>;
      const isi = teksBersih(k.text ?? k.message);
      const idKomentar = typeof k.id === "string" ? k.id : "";
      if (isi.length < 2 || idKomentar === "") continue;
      komentar.push({
        idLama: idKomentar,
        oleh: typeof k.userId === "string" ? k.userId : null,
        isi: potong(isi, 1000),
        pada: typeof k.createdAt === "string" ? k.createdAt : null,
      });
    }

    siap.push({
      idLama,
      jenis,
      judul: judulMasukan(pesan),
      isi: potong(
        gabungBaris(
          pesan,
          gambar.length > 0
            ? `Lampiran (penyimpanan sistem lama):\n${gambar.join("\n")}`
            : null,
          jenisLama && jenisLama !== jenis
            ? `Jenis di sistem lama: ${jenisLama}.`
            : null,
        ),
        2000,
      ),
      halaman: potong(teksBersih(b.page), 120),
      status: statusMasukanV1(b.status),
      dilaporkanOleh: typeof b.userId === "string" ? b.userId : null,
      dibuatPada: typeof b.createdAt === "string" ? b.createdAt : null,
      komentar,
    });
  }
  return { siap, tertahan };
}
