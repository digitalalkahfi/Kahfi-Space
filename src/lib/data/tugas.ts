// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import type {
  Prioritas,
  StatusTugas,
  ToDo,
  Tugas,
  Pengguna,
} from "@/lib/types";

const KOLOM = `
  id, tipe, judul, deskripsi, konteks, tenggat, prioritas, status, qc_status,
  qc_note, hasil_kerja, penerima_id, pembuat_id, goal_id, selesai_at,
  penerima:penerima_id (nama),
  pembuat:pembuat_id (nama),
  goal:goal_id (judul, periode)
`;

type BarisTugas = {
  id: string;
  penerima_id?: string;
  pembuat_id?: string;
  qc_note?: string;
  hasil_kerja?: string;
  selesai_at?: string | null;
  tipe: "pribadi" | "tiket" | "komitmen_mingguan";
  judul: string;
  deskripsi: string;
  konteks: string;
  tenggat: string | null;
  prioritas: Prioritas;
  status: StatusTugas | "revisi" | "dibatalkan";
  qc_status: "belum" | "lolos" | "revisi";
  penerima: { nama: string } | null;
  pembuat: { nama: string } | null;
  goal: { judul: string; periode: string } | null;
};

/** Nama pendek: "Rian Hidayat" → "Rian H." */
function namaPendek(nama: string) {
  const bagian = nama.trim().split(/\s+/);
  return bagian.length > 1 ? `${bagian[0]} ${bagian[1][0]}.` : bagian[0];
}

function keStatus(s: BarisTugas["status"]): StatusTugas {
  if (s === "revisi") return "berjalan";
  if (s === "dibatalkan") return "todo";
  return s;
}

function keTugas(b: BarisTugas): Tugas {
  return {
    id: b.id,
    tipe: b.tipe,
    judul: b.judul,
    deskripsi: b.deskripsi,
    penerima: namaPendek(b.penerima?.nama ?? "—"),
    penerimaLengkap: b.penerima?.nama ?? "—",
    pembuat: namaPendek(b.pembuat?.nama ?? "—"),
    tenggat: b.tenggat ?? "",
    prioritas: b.prioritas,
    status: keStatus(b.status),
    statusAsli: b.status,
    qcStatus: b.qc_status,
    qcNote: b.qc_note ?? "",
    hasilKerja: b.hasil_kerja ?? "",
    goalJudul: b.goal?.judul ?? null,
    goalPeriode: b.goal?.periode ?? null,
    selesaiPada: b.selesai_at ?? null,
    label: b.konteks || (b.tipe === "tiket" ? "Tiket" : "Komitmen"),
  };
}

function keToDo(b: BarisTugas): ToDo {
  return {
    id: b.id,
    judul: b.judul,
    konteks: b.konteks,
    jam: b.tenggat,
    prioritas: b.prioritas,
    selesai: b.status === "selesai",
    selesaiPada: b.selesai_at ?? null,
  };
}

// ---------------------------------------------------------------------
// Mode demo
// ---------------------------------------------------------------------
function tugasContoh(pengguna: Pengguna): BarisTugas[] {
  return dataContoh.tasks
    .filter((t) => {
      const lintas = pengguna.role === "CEO" || pengguna.role === "Manager";
      if (t.penerima === pengguna.nama || t.pembuat === pengguna.nama) {
        return true;
      }
      return lintas && t.tipe !== "pribadi";
    })
    .map((t, i) => ({
      id: `contoh-${i}`,
      qc_note: "",
      hasil_kerja: "",
      selesai_at:
        t.status === "selesai"
          ? `${dataContoh.tanggalAcuan}T16:40:00+07:00`
          : null,
      tipe: t.tipe as BarisTugas["tipe"],
      judul: t.judul,
      deskripsi: t.deskripsi,
      konteks: t.konteks,
      tenggat: t.tenggat ?? null,
      prioritas: t.prioritas as Prioritas,
      status: t.status as BarisTugas["status"],
      qc_status: t.qc as BarisTugas["qc_status"],
      penerima: { nama: t.penerima },
      pembuat: { nama: t.pembuat },
      goal: t.goal_unit
        ? {
            judul:
              dataContoh.goals.find(
                (g) => g.unit === t.goal_unit && g.level === "leader",
              )?.judul ?? "Goal unit",
            periode: "2024-Q4",
          }
        : null,
    }));
}

async function ambilBaris(pengguna: Pengguna): Promise<BarisTugas[]> {
  if (modeData() === "demo") return tugasContoh(pengguna);

  const sb = await klienServer();
  const { data, error } = await sb
    .from("tasks")
    .select(KOLOM)
    .neq("status", "dibatalkan")
    .order("tenggat", { ascending: true, nullsFirst: false })
    .limit(200);

  if (error) throw new Error(`Gagal memuat tugas: ${error.message}`);
  return data as unknown as BarisTugas[];
}

/** To-do pribadi milik pengguna untuk hari berjalan. */
export async function ambilToDo(pengguna: Pengguna): Promise<ToDo[]> {
  const baris = await ambilBaris(pengguna);
  return baris
    .filter((b) => b.tipe === "pribadi" && b.penerima?.nama === pengguna.nama)
    .map(keToDo);
}

/**
 * Tiket & komitmen yang perlu perhatian: belum selesai, diurutkan dari
 * yang paling mendesak.
 */
export async function ambilTugasMendesak(
  pengguna: Pengguna,
  batas = 4,
): Promise<Tugas[]> {
  const baris = await ambilBaris(pengguna);
  const bobot: Record<Prioritas, number> = { tinggi: 0, sedang: 1, rendah: 2 };

  return baris
    .filter((b) => b.tipe !== "pribadi" && b.status !== "selesai")
    .sort((a, b) => {
      const p = bobot[a.prioritas] - bobot[b.prioritas];
      if (p !== 0) return p;
      return (a.tenggat ?? "9999").localeCompare(b.tenggat ?? "9999");
    })
    .slice(0, batas)
    .map(keTugas);
}

/** Semua tugas untuk halaman Tugas. */
export async function ambilSemuaTugas(pengguna: Pengguna): Promise<Tugas[]> {
  const baris = await ambilBaris(pengguna);
  return baris.map(keTugas);
}

/**
 * Riwayat to-do pribadi yang sudah selesai, terbaru dulu.
 * Dipakai untuk menengok kembali apa saja yang sudah dibereskan.
 */
export async function riwayatToDo(
  pengguna: Pengguna,
  batas = 50,
): Promise<ToDo[]> {
  const baris = await ambilBaris(pengguna);
  return baris
    .filter(
      (b) =>
        b.tipe === "pribadi" &&
        b.status === "selesai" &&
        b.penerima?.nama === pengguna.nama,
    )
    .sort((a, b) => (b.selesai_at ?? "").localeCompare(a.selesai_at ?? ""))
    .slice(0, batas)
    .map(keToDo);
}

/** Ringkasan penyelesaian to-do untuk kartu statistik. */
export async function ringkasToDo(pengguna: Pengguna) {
  const baris = await ambilBaris(pengguna);
  const milikSaya = baris.filter(
    (b) => b.tipe === "pribadi" && b.penerima?.nama === pengguna.nama,
  );
  const selesai = milikSaya.filter((b) => b.status === "selesai").length;

  return {
    total: milikSaya.length,
    selesai,
    belum: milikSaya.length - selesai,
    rasio: milikSaya.length > 0 ? (selesai / milikSaya.length) * 100 : 0,
  };
}

export type JejakQc = {
  id: string;
  hasil: "lolos" | "revisi";
  catatan: string;
  hasilKerja: string;
  diperiksaOleh: string;
  createdAt: string;
};

/**
 * Riwayat pemeriksaan sebuah tugas.
 * Menyimpan konteks tiap putaran revisi, bukan hanya catatan terakhir.
 */
export async function jejakQc(taskId: string): Promise<JejakQc[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data } = await sb
    .from("task_qc_log")
    .select(
      "id, hasil, catatan, hasil_kerja, created_at, users:diperiksa_oleh (nama)",
    )
    .eq("task_id", taskId)
    .order("created_at");

  return (data ?? []).map((r) => ({
    id: r.id,
    hasil: r.hasil as "lolos" | "revisi",
    catatan: r.catatan,
    hasilKerja: r.hasil_kerja,
    diperiksaOleh:
      (r.users as unknown as { nama: string } | null)?.nama ?? "Pemeriksa",
    createdAt: r.created_at,
  }));
}
