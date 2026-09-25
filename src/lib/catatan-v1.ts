/**
 * Catatan ekspor V1 → `notes` V2 — modul murni.
 *
 * Catatan lama seluruhnya pribadi, dan begitu pula ia dibawa: milik
 * penulisnya, tidak dibagikan. Kategori lama dipetakan apa adanya; yang
 * "lainnya" tetapi judulnya catatan review harian (DRM) menjadi "rapat",
 * karena itulah isinya.
 */
import type { KategoriCatatan } from "@/lib/catatan";
import { potong, tautanV1, teksBersih } from "@/lib/teks-v1";

export type CatatanV1 = {
  idLama: string;
  judul: string;
  isi: string;
  kategori: KategoriCatatan;
  disematkan: boolean;
  lampiran: string[];
  pemilikLama: string | null;
  dibuatPada: string | null;
  diperbaruiPada: string | null;
};

export function kategoriCatatanV1(
  nilai: unknown,
  judul: string,
): KategoriCatatan {
  const t = teksBersih(nilai).toLowerCase();
  if (["dokumentasi", "docs"].includes(t)) return "dokumentasi";
  if (["sop", "prosedur", "template", "templat"].includes(t)) return "sop";
  if (["rapat", "meeting", "drm"].includes(t)) return "rapat";
  if (/^drm\b/i.test(judul)) return "rapat";
  return "lainnya";
}

export function bacaCatatan(daftar: unknown[]): {
  siap: CatatanV1[];
  tertahan: { idLama: string; pesan: string }[];
} {
  const siap: CatatanV1[] = [];
  const tertahan: { idLama: string; pesan: string }[] = [];
  for (const n of daftar) {
    if (n === null || typeof n !== "object") continue;
    const b = n as Record<string, unknown>;
    const idLama = typeof b.id === "string" ? b.id : "";
    if (idLama === "") continue;
    const judulMentah = teksBersih(b.title ?? b.judul);
    const isi = teksBersih(b.content ?? b.isi);
    if (judulMentah === "" && isi === "") {
      tertahan.push({ idLama, pesan: "Catatan tanpa judul dan tanpa isi." });
      continue;
    }
    const judul =
      judulMentah.length >= 3 ? judulMentah : potong(isi, 60) || "Catatan lama";

    const lampiran: string[] = [];
    for (const l of Array.isArray(b.attachments) ? b.attachments : []) {
      const src =
        l !== null && typeof l === "object"
          ? (l as Record<string, unknown>).src
          : l;
      const tautan = tautanV1(src);
      if (tautan) lampiran.push(tautan);
    }

    siap.push({
      idLama,
      judul: potong(judul, 160),
      isi: potong(isi, 20000),
      kategori: kategoriCatatanV1(b.category, judulMentah),
      disematkan: b.isPinned === true,
      lampiran: lampiran.slice(0, 10),
      pemilikLama: typeof b.authorId === "string" ? b.authorId : null,
      dibuatPada: typeof b.createdAt === "string" ? b.createdAt : null,
      diperbaruiPada: typeof b.updatedAt === "string" ? b.updatedAt : null,
    });
  }
  return { siap, tertahan };
}
