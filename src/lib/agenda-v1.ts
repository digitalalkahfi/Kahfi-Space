/**
 * Kalender dan jadwal ekspor V1 → `agenda` V2 — modul murni.
 *
 * Sistem lama punya dua tempat: `calendar:all` (rapat, agenda, piket) dan
 * `schedule:all` (piket grup lama). Sistem lama sendiri sudah menyalin
 * jadwal ke kalender (`migratedFromSchedule`), jadi jadwal yang salinannya
 * ada tidak dibawa dua kali — catatannya saja yang ditambahkan ke salinan
 * itu, karena salinan lama membuang catatannya.
 *
 * V2 tidak punya daftar peserta pada agenda; nama pesertanya masuk ke
 * keterangan supaya tidak hilang.
 */
import { keTanggal } from "@/lib/impor";
import { gabungBaris, jamV1, potong, teksBersih } from "@/lib/teks-v1";

export type JenisAgenda = "rapat" | "libur" | "pelatihan" | "lainnya";

export type AgendaV1 = {
  idLama: string;
  /** Kunci ekspor asalnya, untuk peta yang terpisah. */
  sumber: "calendar:all" | "schedule:all";
  judul: string;
  keterangan: string;
  jenis: JenisAgenda;
  tanggal: string;
  jamMulai: string | null;
  jamSelesai: string | null;
  lokasi: string;
  dibuatOleh: string | null;
  dibuatPada: string | null;
};

export function jenisAgendaV1(nilai: unknown): JenisAgenda {
  const t = teksBersih(nilai).toLowerCase();
  if (["meeting", "rapat"].includes(t)) return "rapat";
  if (["training", "pelatihan", "kelas"].includes(t)) return "pelatihan";
  if (["libur", "holiday", "cuti"].includes(t)) return "libur";
  return "lainnya";
}

const daftarNama = (nilai: unknown) =>
  Array.isArray(nilai)
    ? nilai.filter((n): n is string => typeof n === "string" && n.trim() !== "")
    : [];

export function bacaAgenda(isi: Record<string, unknown>): {
  siap: AgendaV1[];
  tertahan: { idLama: string; pesan: string }[];
} {
  const kalender = Array.isArray(isi["calendar:all"])
    ? isi["calendar:all"]
    : [];
  const jadwal = Array.isArray(isi["schedule:all"]) ? isi["schedule:all"] : [];
  const siap: AgendaV1[] = [];
  const tertahan: { idLama: string; pesan: string }[] = [];

  // Jadwal lama dikunci tanggal, jam, dan orangnya supaya salinannya di
  // kalender bisa ditemukan.
  const kunciJadwal = (b: Record<string, unknown>) =>
    `${keTanggal(b.date) ?? ""}|${jamV1(b.time) ?? ""}|${typeof b.adminId === "string" ? b.adminId : ""}`;
  const jadwalPerKunci = new Map<string, Record<string, unknown>>();
  for (const j of jadwal) {
    if (j !== null && typeof j === "object") {
      jadwalPerKunci.set(
        kunciJadwal(j as Record<string, unknown>),
        j as Record<string, unknown>,
      );
    }
  }
  const jadwalTersalin = new Set<string>();

  for (const k of kalender) {
    if (k === null || typeof k !== "object") continue;
    const b = k as Record<string, unknown>;
    const idLama = typeof b.id === "string" ? b.id : "";
    if (idLama === "") continue;
    const tanggal = keTanggal(b.date);
    if (!tanggal) {
      tertahan.push({
        idLama,
        pesan: `Tanggal '${String(b.date ?? "")}' tidak terbaca.`,
      });
      continue;
    }
    const judulMentah = teksBersih(b.title);
    const judul = judulMentah.length >= 3 ? judulMentah : `Agenda ${tanggal}`;
    const jamMulai = jamV1(b.time);
    const jamSelesaiMentah = jamV1(b.endTime);
    const jamSelesai =
      jamMulai && jamSelesaiMentah && jamSelesaiMentah > jamMulai
        ? jamSelesaiMentah
        : null;

    const pembuat = typeof b.createdById === "string" ? b.createdById : null;
    const peserta = daftarNama(b.attendeeNames);
    let catatanJadwal: string | null = null;
    if (b.migratedFromSchedule === true) {
      const asal = jadwalPerKunci.get(
        `${tanggal}|${jamMulai ?? ""}|${pembuat ?? ""}`,
      );
      if (asal) {
        jadwalTersalin.add(typeof asal.id === "string" ? asal.id : "");
        catatanJadwal = teksBersih(asal.notes);
      }
    }

    siap.push({
      idLama,
      sumber: "calendar:all",
      judul: potong(judul, 120),
      keterangan: potong(
        gabungBaris(
          teksBersih(b.description),
          catatanJadwal,
          peserta.length > 0 ? `Peserta: ${peserta.join(", ")}` : null,
        ),
        500,
      ),
      jenis: jenisAgendaV1(b.type),
      tanggal,
      jamMulai,
      jamSelesai,
      lokasi: potong(teksBersih(b.location), 120),
      dibuatOleh: pembuat,
      dibuatPada: typeof b.createdAt === "string" ? b.createdAt : null,
    });
  }

  // Jadwal yang tidak pernah disalin sistem lama dibawa sebagai agenda.
  for (const j of jadwal) {
    if (j === null || typeof j !== "object") continue;
    const b = j as Record<string, unknown>;
    const idLama = typeof b.id === "string" ? b.id : "";
    if (idLama === "" || jadwalTersalin.has(idLama)) continue;
    const tanggal = keTanggal(b.date);
    if (!tanggal) {
      tertahan.push({
        idLama,
        pesan: `Tanggal '${String(b.date ?? "")}' tidak terbaca.`,
      });
      continue;
    }
    const nama = teksBersih(b.adminName);
    siap.push({
      idLama,
      sumber: "schedule:all",
      judul: potong(
        `${jenisAgendaV1(b.type) === "lainnya" ? "Piket grup" : "Jadwal"}${nama ? ` — ${nama}` : ""}`,
        120,
      ),
      keterangan: potong(
        gabungBaris(
          teksBersih(b.notes),
          teksBersih(b.product) ? `Produk: ${teksBersih(b.product)}` : null,
        ),
        500,
      ),
      jenis: jenisAgendaV1(b.type),
      tanggal,
      jamMulai: jamV1(b.time),
      jamSelesai: null,
      lokasi: "",
      dibuatOleh:
        typeof b.creatorId === "string" && b.creatorId !== ""
          ? b.creatorId
          : typeof b.adminId === "string"
            ? b.adminId
            : null,
      dibuatPada: typeof b.createdAt === "string" ? b.createdAt : null,
    });
  }

  return { siap, tertahan };
}
