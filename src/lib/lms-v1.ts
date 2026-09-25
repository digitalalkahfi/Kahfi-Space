/**
 * Portal belajar ekspor V1 → LMS V2 — modul murni.
 *
 * Bentuknya berbeda cukup jauh. Sistem lama: jalur → kursus → modul →
 * pelajaran (video/PDF), pendaftaran per jalur, kemajuan per pelajaran
 * (persen). V2 (0054–0091): kursus → modul (teks + durasi), pendaftaran
 * per kursus, kemajuan per modul (selesai/belum). Jadi:
 * - tiap pelajaran lama menjadi satu modul V2, isinya tautan video/PDF-nya;
 * - judul modul lama dan jalurnya disebut di ringkasan kursus;
 * - pendaftaran jalur menjadi pendaftaran tiap kursus di jalur itu;
 * - kemajuan yang sudah tuntas menjadi kemajuan modul; yang setengah jalan
 *   tidak punya padanan dan dicatat, bukan dibulatkan;
 * - berkas perpustakaan menjadi kursus satu modul.
 */
import { unitV1 } from "@/lib/peran-v1";
import { gabungBaris, potong, tautanV1, teksBersih } from "@/lib/teks-v1";

export type ModulV1 = {
  /** Id pelajaran lama (atau id berkas perpustakaan). */
  idLama: string;
  urutan: number;
  judul: string;
  isi: string;
  durasiMenit: number;
};

export type KursusV1 = {
  idLama: string;
  judul: string;
  ringkasan: string;
  kategori: string;
  aktif: boolean;
  unitKode: string | null;
  dibuatPada: string | null;
  modul: ModulV1[];
};

export type PendaftaranV1 = {
  /** `<id pendaftaran lama>#<id kursus lama>`. */
  idLama: string;
  kursusLama: string;
  userLama: string;
  dimulai: string | null;
  selesai: string | null;
  ditugaskanOleh: string | null;
};

export type KemajuanV1 = {
  idLama: string;
  kursusLama: string;
  modulLama: string;
  userLama: string;
  selesaiPada: string | null;
};

export type HasilLms = {
  kursus: KursusV1[];
  pendaftaran: PendaftaranV1[];
  kemajuan: KemajuanV1[];
  catatan: { idLama: string; pesan: string }[];
};

const larik = (isi: Record<string, unknown>, kunci: string) =>
  Array.isArray(isi[kunci]) ? (isi[kunci] as unknown[]) : [];

function durasi(nilai: unknown): number {
  const n = typeof nilai === "number" ? Math.round(nilai) : 10;
  return Math.min(600, Math.max(1, n || 10));
}

function isiPelajaran(l: Record<string, unknown>, badan: string): string {
  const jenis = teksBersih(l.type).toLowerCase();
  const video = tautanV1(l.videoUrl);
  const pdf = tautanV1(l.pdfUrl);
  const namaPdf = teksBersih(l.pdfName);
  return gabungBaris(
    video ? `Video: ${video}` : null,
    pdf ? `PDF: ${pdf}${namaPdf ? ` (${namaPdf})` : ""}` : null,
    !video && !pdf && jenis
      ? `Jenis pelajaran lama: ${jenis} (tautan tidak tercatat).`
      : null,
    badan,
  );
}

export function bacaLms(isi: Record<string, unknown>): HasilLms {
  const catatan: { idLama: string; pesan: string }[] = [];
  const badan = new Map<string, string>();
  for (const b of larik(isi, "lms:lesson-bodies:all")) {
    if (b === null || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    if (typeof o.id === "string" && teksBersih(o.body) !== "")
      badan.set(o.id, teksBersih(o.body));
  }

  // Jalur: untuk ringkasan dan unit kursusnya, dan untuk pendaftaran.
  const jalurPerKursus = new Map<string, Record<string, unknown>>();
  const jalur = new Map<string, Record<string, unknown>>();
  for (const p of larik(isi, "lms:paths:all")) {
    if (p === null || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    if (typeof o.id !== "string") continue;
    jalur.set(o.id, o);
    for (const c of Array.isArray(o.courses) ? o.courses : []) {
      const id = (c as Record<string, unknown>)?.courseId;
      if (typeof id === "string" && !jalurPerKursus.has(id))
        jalurPerKursus.set(id, o);
    }
  }

  const kursus: KursusV1[] = [];
  const modulPerPelajaran = new Map<string, string>();
  for (const k of larik(isi, "lms:courses:all")) {
    if (k === null || typeof k !== "object") continue;
    const o = k as Record<string, unknown>;
    const idLama = typeof o.id === "string" ? o.id : "";
    const judulMentah = teksBersih(o.title);
    if (idLama === "" || judulMentah === "") continue;

    const p = jalurPerKursus.get(idLama);
    const divisi = Array.isArray(p?.targetDivisions)
      ? (p!.targetDivisions as unknown[])
          .map((d) => unitV1(d))
          .filter((d) => d !== null)
      : [];
    // Satu unit hanya bila seluruh sasaran jalurnya jatuh ke unit yang sama.
    const unitKode =
      divisi.length > 0 && new Set(divisi).size === 1 ? divisi[0] : null;

    const modul: ModulV1[] = [];
    const judulModulLama: string[] = [];
    for (const m of Array.isArray(o.modules) ? o.modules : []) {
      if (m === null || typeof m !== "object") continue;
      const mo = m as Record<string, unknown>;
      if (teksBersih(mo.title)) judulModulLama.push(teksBersih(mo.title));
      for (const l of Array.isArray(mo.lessons) ? mo.lessons : []) {
        if (l === null || typeof l !== "object") continue;
        const lo = l as Record<string, unknown>;
        const idPelajaran = typeof lo.id === "string" ? lo.id : "";
        const judulPelajaran = teksBersih(lo.title);
        if (idPelajaran === "" || judulPelajaran === "") continue;
        modul.push({
          idLama: idPelajaran,
          urutan: modul.length + 1,
          judul: potong(judulPelajaran, 160),
          isi: potong(isiPelajaran(lo, badan.get(idPelajaran) ?? ""), 4000),
          durasiMenit: durasi(lo.estimatedMinutes),
        });
        modulPerPelajaran.set(idPelajaran, idLama);
      }
    }
    if (modul.length === 0) {
      catatan.push({
        idLama,
        pesan: "Kursus tanpa pelajaran; tetap dibuat tanpa modul.",
      });
    }

    const prioritas = teksBersih(o.priority);
    const jabatan = Array.isArray(p?.targetJobTitles)
      ? (p!.targetJobTitles as unknown[]).filter(
          (j): j is string => typeof j === "string",
        )
      : [];
    kursus.push({
      idLama,
      judul: potong(
        judulMentah.length >= 5 ? judulMentah : `${judulMentah} (kursus lama)`,
        160,
      ),
      ringkasan: potong(
        gabungBaris(
          teksBersih(o.description),
          p
            ? `Jalur lama: ${teksBersih(p.title)}${typeof p.estimatedDays === "number" ? ` (${p.estimatedDays} hari)` : ""}`
            : null,
          judulModulLama.length > 0
            ? `Modul lama: ${judulModulLama.join("; ")}`
            : null,
          prioritas
            ? `Prioritas lama: ${prioritas}${typeof o.passingScore === "number" ? `, nilai lulus ${o.passingScore}` : ""}.`
            : null,
          jabatan.length > 0 ? `Untuk jabatan: ${jabatan.join(", ")}.` : null,
        ),
        400,
      ),
      kategori: potong(p ? teksBersih(p.title) : "", 60),
      aktif: teksBersih(o.status).toLowerCase() !== "archived",
      unitKode,
      dibuatPada: typeof o.createdAt === "string" ? o.createdAt : null,
      modul,
    });
  }

  // Berkas perpustakaan: kursus satu modul.
  for (const b of larik(isi, "lms:library:all")) {
    if (b === null || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const idLama = typeof o.id === "string" ? o.id : "";
    const judul = teksBersih(o.title);
    if (idLama === "" || judul === "") continue;
    kursus.push({
      idLama,
      judul: potong(`Perpustakaan: ${judul}`, 160),
      ringkasan: potong(teksBersih(o.description), 400),
      kategori: "Perpustakaan",
      aktif: teksBersih(o.status).toLowerCase() !== "archived",
      unitKode: null,
      dibuatPada: typeof o.createdAt === "string" ? o.createdAt : null,
      modul: [
        {
          idLama,
          urutan: 1,
          judul: potong(judul, 160),
          isi: potong(isiPelajaran(o, ""), 4000),
          durasiMenit: durasi(o.estimatedMinutes),
        },
      ],
    });
  }

  // Pendaftaran jalur → pendaftaran tiap kursus di jalur itu.
  const pendaftaran: PendaftaranV1[] = [];
  const terdaftar = new Set<string>();
  for (const e of larik(isi, "lms:enrollments:all")) {
    if (e === null || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const idLama = typeof o.id === "string" ? o.id : "";
    const userLama = typeof o.userId === "string" ? o.userId : "";
    const p = typeof o.pathId === "string" ? jalur.get(o.pathId) : undefined;
    if (idLama === "" || userLama === "") continue;
    if (!p) {
      catatan.push({
        idLama,
        pesan: `Jalurnya (${String(o.pathId ?? "")}) tidak ada di ekspor.`,
      });
      continue;
    }
    for (const c of Array.isArray(p.courses) ? p.courses : []) {
      const kursusLama = (c as Record<string, unknown>)?.courseId;
      if (typeof kursusLama !== "string") continue;
      pendaftaran.push({
        idLama: `${idLama}#${kursusLama}`,
        kursusLama,
        userLama,
        dimulai: typeof o.assignedAt === "string" ? o.assignedAt : null,
        selesai: typeof o.completedAt === "string" ? o.completedAt : null,
        ditugaskanOleh:
          typeof o.assignedById === "string" ? o.assignedById : null,
      });
      terdaftar.add(`${userLama}|${kursusLama}`);
    }
  }

  const kemajuan: KemajuanV1[] = [];
  for (const k of larik(isi, "lms:progress:all")) {
    if (k === null || typeof k !== "object") continue;
    const o = k as Record<string, unknown>;
    const idLama = typeof o.id === "string" ? o.id : "";
    const userLama = typeof o.userId === "string" ? o.userId : "";
    const modulLama = typeof o.lessonId === "string" ? o.lessonId : "";
    if (idLama === "" || userLama === "" || modulLama === "") continue;
    const kursusLama =
      typeof o.courseId === "string"
        ? o.courseId
        : (modulPerPelajaran.get(modulLama) ?? "");
    if (o.done !== true) {
      const persen =
        typeof o.percent === "number" ? `${o.percent}%` : "belum tuntas";
      catatan.push({
        idLama,
        pesan: `Kemajuan setengah jalan (${persen}) tidak punya padanan di V2 (modul hanya tuntas/belum); tidak ditulis.`,
      });
      continue;
    }
    if (!terdaftar.has(`${userLama}|${kursusLama}`)) {
      // Kemajuan tanpa pendaftaran: pendaftarannya dibuat dari kemajuan itu
      // sendiri, karena orangnya nyata-nyata mengikuti kursus itu.
      pendaftaran.push({
        idLama: `kemajuan:${idLama}`,
        kursusLama,
        userLama,
        dimulai: typeof o.updatedAt === "string" ? o.updatedAt : null,
        selesai: null,
        ditugaskanOleh: null,
      });
      terdaftar.add(`${userLama}|${kursusLama}`);
      catatan.push({
        idLama,
        pesan:
          "Kemajuan tanpa pendaftaran; pendaftarannya dibuat dari kemajuan ini.",
      });
    }
    kemajuan.push({
      idLama,
      kursusLama,
      modulLama,
      userLama,
      selesaiPada:
        typeof o.completedAt === "string"
          ? o.completedAt
          : typeof o.updatedAt === "string"
            ? o.updatedAt
            : null,
    });
  }

  return { kursus, pendaftaran, kemajuan, catatan };
}
