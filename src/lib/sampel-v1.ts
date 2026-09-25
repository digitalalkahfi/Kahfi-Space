/**
 * Sampel dan riwayat pindainya dari ekspor V1 → `samples`, `sample_events`,
 * `sample_scans` V2 — modul murni.
 *
 * V2 tidak membiarkan status sampel diubah langsung: setiap perpindahan
 * adalah kejadian (0049–0051). Jadi sampel lama masuk sebagai `tersedia`,
 * lalu penerimanya dicatat sebagai kejadian `dipegang` yang menggerakkan
 * statusnya — persis alur yang dipakai orang di V2.
 */
import { keTanggal } from "@/lib/impor";
import { gabungBaris, potong, tautanV1, teksBersih } from "@/lib/teks-v1";

export type SampelV1 = {
  idLama: string;
  kode: string;
  nama: string;
  kategori: string;
  catatan: string;
  linkProduk: string | null;
  /** Orang lama yang memegang sampel (penerima), bila ada. */
  pemegang: string | null;
  dibuatOleh: string | null;
  dibuatPada: string | null;
  tanggalDatang: string | null;
};

export type PindaiV1 = {
  idLama: string;
  kode: string;
  oleh: string | null;
  pada: string | null;
};

export function bacaSampel(isi: Record<string, unknown>): {
  sampel: SampelV1[];
  pindai: PindaiV1[];
  tertahan: { idLama: string; pesan: string }[];
} {
  const sampel: SampelV1[] = [];
  const pindai: PindaiV1[] = [];
  const tertahan: { idLama: string; pesan: string }[] = [];

  for (const s of Array.isArray(isi["sampel:all"]) ? isi["sampel:all"] : []) {
    if (s === null || typeof s !== "object") continue;
    const b = s as Record<string, unknown>;
    const idLama = typeof b.id === "string" ? b.id : "";
    const kode = teksBersih(b.kode ?? b.id).toUpperCase();
    const nama = teksBersih(b.nama ?? b.name);
    if (idLama === "" || kode === "") continue;
    if (nama.length < 3) {
      tertahan.push({
        idLama,
        pesan: `Nama sampel '${nama}' terlalu pendek (minimal 3 huruf).`,
      });
      continue;
    }
    const tautan = Array.isArray(b.linkProduk)
      ? (b.linkProduk.map(tautanV1).find((t): t is string => t !== null) ??
        null)
      : tautanV1(b.linkProduk);
    const penerima =
      typeof b.penerimaId === "string" && b.penerimaId !== ""
        ? b.penerimaId
        : null;
    const seller = teksBersih(b.sellerNama);
    sampel.push({
      idLama,
      kode: potong(kode, 30),
      nama: potong(nama, 120),
      kategori: potong(teksBersih(b.kategori), 60),
      catatan: potong(
        gabungBaris(
          teksBersih(b.catatan),
          seller ? `Penjual: ${seller}` : null,
          teksBersih(b.token) ? `Token lama: ${teksBersih(b.token)}` : null,
          keTanggal(b.tanggalDatang)
            ? `Datang: ${keTanggal(b.tanggalDatang)}`
            : null,
        ),
        300,
      ),
      linkProduk: tautan,
      pemegang: penerima,
      dibuatOleh: typeof b.createdById === "string" ? b.createdById : null,
      dibuatPada: typeof b.createdAt === "string" ? b.createdAt : null,
      tanggalDatang: keTanggal(b.tanggalDatang),
    });
  }

  for (const p of Array.isArray(isi["sampel-usage:all"])
    ? isi["sampel-usage:all"]
    : []) {
    if (p === null || typeof p !== "object") continue;
    const b = p as Record<string, unknown>;
    const idLama = typeof b.id === "string" ? b.id : "";
    const kode = teksBersih(b.sampelKode ?? b.sampelId).toUpperCase();
    if (idLama === "" || kode === "") continue;
    pindai.push({
      idLama,
      kode: potong(kode, 60),
      oleh: typeof b.userId === "string" ? b.userId : null,
      pada:
        typeof b.usedAt === "string"
          ? b.usedAt
          : typeof b.createdAt === "string"
            ? b.createdAt
            : null,
    });
  }

  return { sampel, pindai, tertahan };
}
