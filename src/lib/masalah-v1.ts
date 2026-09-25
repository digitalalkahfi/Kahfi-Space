/**
 * Masalah (Kaizen) ekspor V1 → `problems` V2 — modul murni.
 *
 * V2 sudah meninggalkan analisis 5-Why sebagai tabel sendiri (0121): akar
 * masalah dan tindakannya hidup sebagai teks di `konteks` dan `solusi`.
 * Jadi 5-Why lama diringkas menjadi teks — baris yang cuma mengulang
 * ("beres" lima kali) tidak diulang.
 */
import { unitV1 } from "@/lib/peran-v1";
import { gabungBaris, potong, teksBersih } from "@/lib/teks-v1";

export type DampakMasalah = "rendah" | "sedang" | "tinggi";
export type StatusMasalah = "baru" | "diproses" | "selesai" | "ditutup";

export type MasalahV1 = {
  idLama: string;
  judul: string;
  konteks: string;
  unitKode: string | null;
  dampak: DampakMasalah;
  status: StatusMasalah;
  solusi: string;
  dilaporkanOleh: string | null;
  dibuatPada: string | null;
  diselesaikanOleh: string | null;
  diselesaikanPada: string | null;
};

export function dampakV1(nilai: unknown): DampakMasalah {
  const t = teksBersih(nilai).toLowerCase();
  if (["rendah", "low", "ringan"].includes(t)) return "rendah";
  if (["tinggi", "high", "kritis", "critical", "urgent"].includes(t))
    return "tinggi";
  return "sedang";
}

export function statusMasalahV1(nilai: unknown): StatusMasalah {
  const t = teksBersih(nilai).toLowerCase();
  if (["resolved", "selesai", "done"].includes(t)) return "selesai";
  if (["closed", "ditutup"].includes(t)) return "ditutup";
  if (
    ["in_progress", "progress", "diproses", "dianalisis", "ditindak"].includes(
      t,
    )
  ) {
    return "diproses";
  }
  return "baru";
}

const LABEL_WHY: Record<string, string> = {
  root: "Akar masalah",
  why1: "Mengapa 1",
  why2: "Mengapa 2",
  why3: "Mengapa 3",
  why4: "Mengapa 4",
  why5: "Mengapa 5",
};

/** Ringkasan 5-Why lama sebagai teks; jawaban yang berulang disebut sekali. */
export function ringkasWhy(nilai: unknown): string {
  if (nilai === null || typeof nilai !== "object") return "";
  const r = nilai as Record<string, unknown>;
  const baris: string[] = [];
  const sudah = new Set<string>();
  for (const [kunci, label] of Object.entries(LABEL_WHY)) {
    const teks = teksBersih(r[kunci]);
    if (teks === "" || sudah.has(teks.toLowerCase())) continue;
    sudah.add(teks.toLowerCase());
    baris.push(`${label}: ${teks}`);
  }
  return baris.join("\n");
}

export function bacaMasalah(daftar: unknown[]): {
  siap: MasalahV1[];
  tertahan: { idLama: string; pesan: string }[];
} {
  const siap: MasalahV1[] = [];
  const tertahan: { idLama: string; pesan: string }[] = [];
  for (const m of daftar) {
    if (m === null || typeof m !== "object") continue;
    const b = m as Record<string, unknown>;
    const idLama = typeof b.id === "string" ? b.id : "";
    if (idLama === "") continue;
    const judulMentah = teksBersih(b.title);
    if (judulMentah === "") {
      tertahan.push({ idLama, pesan: "Masalah tanpa judul." });
      continue;
    }
    const status = statusMasalahV1(b.status);
    const urgensi = teksBersih(b.urgency).toLowerCase();
    const akar = b.rootCause as Record<string, unknown> | null | undefined;
    const terkait = teksBersih(b.relatedType);

    let solusi = gabungBaris(
      teksBersih(akar?.corrective),
      teksBersih(akar?.preventive)
        ? `Pencegahan: ${teksBersih(akar?.preventive)}`
        : null,
    );
    if (status === "selesai" && solusi.length < 10) {
      solusi = gabungBaris(
        solusi,
        "Diselesaikan di sistem lama tanpa uraian solusi.",
      );
    }

    siap.push({
      idLama,
      judul: potong(
        judulMentah.length >= 10
          ? judulMentah
          : `${judulMentah} (masalah lama)`,
        160,
      ),
      konteks: potong(
        gabungBaris(
          teksBersih(b.description),
          terkait && terkait !== "umum" ? `Terkait: ${terkait}` : null,
          urgensi === "kritis" ? "Urgensi di sistem lama: kritis." : null,
          ringkasWhy(akar),
        ),
        2000,
      ),
      unitKode: unitV1(b.division),
      dampak: dampakV1(b.urgency),
      status,
      solusi: potong(solusi, 1000),
      dilaporkanOleh:
        typeof b.reportedById === "string" ? b.reportedById : null,
      dibuatPada: typeof b.createdAt === "string" ? b.createdAt : null,
      diselesaikanOleh:
        typeof b.resolvedById === "string" ? b.resolvedById : null,
      diselesaikanPada: typeof b.resolvedAt === "string" ? b.resolvedAt : null,
    });
  }
  return { siap, tertahan };
}
