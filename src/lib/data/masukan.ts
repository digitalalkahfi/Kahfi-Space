// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import type {
  JenisMasukan,
  Keparahan,
  Masukan,
  StatusMasukan,
} from "@/lib/masukan";
import type { Pengguna } from "@/lib/types";

/** Menindaklanjuti masukan adalah wewenang CEO/Manager. */
export function bolehKelolaMasukan(pengguna: Pengguna) {
  return pengguna.role === "CEO" || pengguna.role === "Manager";
}

function satu<T>(nilai: T | T[] | null | undefined): T | null {
  if (!nilai) return null;
  return Array.isArray(nilai) ? (nilai[0] ?? null) : nilai;
}

/**
 * Seluruh masukan; terbuka bagi setiap anggota yang login.
 *
 * Menutup masukan orang lain membuat hal yang sama dilaporkan berulang
 * kali, dan pelapor tidak pernah tahu bahwa keluhannya sudah ditangani.
 */
/** Kolom yang dibutuhkan layar daftar maupun detail. */
const KOLOM_MASUKAN = `id, jenis, judul, isi, keparahan, halaman, status, alasan_tolak, created_at,
       pelapor:users!feedback_dilaporkan_oleh_fkey (id, nama),
       petugas:users!feedback_ditugaskan_ke_fkey (id, nama),
       dukungan:feedback_votes (user_id),
       komentar:feedback_comments (
         id, isi, created_at, oleh:users (nama)
       ),
       jejak:feedback_events (
         id, dari, ke, catatan, pada, oleh:users (nama)
       )`;

export async function daftarMasukan(pengguna: Pengguna): Promise<Masukan[]> {
  if (modeData() === "demo") return masukanDemo(pengguna);

  const sb = await klienServer();
  const { data, error } = await sb
    .from("feedback")
    .select(KOLOM_MASUKAN)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat masukan: ${error.message}`);

  return (data ?? []).map((m) => keMasukan(m, pengguna));
}

type BarisQuery = NonNullable<
  Awaited<ReturnType<typeof ambilBarisMasukan>>
>;

/** Bentuk satu baris masukan dari hasil query. */
function keMasukan(m: BarisQuery, pengguna: Pengguna): Masukan {
  return {
    id: m.id,
    jenis: m.jenis as JenisMasukan,
    judul: m.judul,
    isi: m.isi,
    keparahan: (m.keparahan as Keparahan) ?? null,
    halaman: m.halaman,
    status: m.status as StatusMasukan,
    alasanTolak: m.alasan_tolak,
    pelaporId: satu(m.pelapor)?.id ?? null,
    pelaporNama: satu(m.pelapor)?.nama ?? null,
    ditugaskanId: satu(m.petugas)?.id ?? null,
    ditugaskanNama: satu(m.petugas)?.nama ?? null,
    dukungan: (m.dukungan ?? []).length,
    sayaDukung: (m.dukungan ?? []).some((d) => d.user_id === pengguna.id),
    komentar: (m.komentar ?? [])
      .map((k) => ({
        id: k.id,
        olehNama: satu(k.oleh)?.nama ?? null,
        isi: k.isi,
        pada: k.created_at,
      }))
      .sort((a, b) => a.pada.localeCompare(b.pada)),
    jejak: (m.jejak ?? [])
      .map((j) => ({
        id: j.id,
        dari: (j.dari as StatusMasukan) ?? null,
        ke: j.ke as StatusMasukan,
        olehNama: satu(j.oleh)?.nama ?? null,
        catatan: j.catatan,
        pada: j.pada,
      }))
      .sort((a, b) => b.pada.localeCompare(a.pada)),
    dibuatPada: m.created_at,
  };
}

/** Satu baris mentah; dipakai juga untuk menurunkan tipenya. */
async function ambilBarisMasukan(id: string) {
  const sb = await klienServer();
  const { data } = await sb
    .from("feedback")
    .select(KOLOM_MASUKAN)
    .eq("id", id)
    .maybeSingle();

  return data;
}

/**
 * Satu masukan beserta komentar dan jejaknya.
 *
 * Diambil langsung, bukan dengan menyaring seluruh daftar: halaman detail
 * tidak perlu memuat setiap laporan beserta komentarnya hanya untuk
 * menampilkan satu. RLS tetap yang menentukan boleh-tidaknya terlihat.
 */
export async function masukanDariId(
  pengguna: Pengguna,
  id: string,
): Promise<Masukan | null> {
  if (modeData() === "demo") {
    return masukanDemo(pengguna).find((m) => m.id === id) ?? null;
  }

  const baris = await ambilBarisMasukan(id);
  return baris ? keMasukan(baris, pengguna) : null;
}

// ---------------------------------------------------------------------
// Mode demo
// ---------------------------------------------------------------------
function masukanDemo(pengguna: Pengguna): Masukan[] {
  return dataContoh.feedback.map((f, i) => ({
    id: `masukan-${i + 1}`,
    jenis: f.jenis as JenisMasukan,
    judul: f.judul,
    isi: f.isi,
    keparahan: (f.keparahan as Keparahan) ?? null,
    halaman: f.halaman,
    status: f.status as StatusMasukan,
    alasanTolak: f.alasan_tolak ?? "",
    pelaporId:
      dataContoh.users.find((u) => u.nama === f.pelapor)?.id ?? null,
    pelaporNama: f.pelapor,
    ditugaskanId: null,
    ditugaskanNama: null,
    dukungan: f.dukungan.length,
    sayaDukung: f.dukungan.includes(pengguna.nama),
    komentar: f.komentar.map((k, j) => ({
      id: `masukan-${i + 1}-komentar-${j + 1}`,
      olehNama: k.oleh,
      isi: k.isi,
      pada: `${dataContoh.tanggalAcuan}T11:00:00+07:00`,
    })),
    // Jejak status diturunkan dari statusnya sekarang: data contoh tidak
    // menyimpan riwayat, tetapi layar detail harus tetap memperlihatkan
    // bahwa perubahan status memang terekam.
    jejak: jejakDemo(f.status as StatusMasukan, i),
    dibuatPada: `${dataContoh.tanggalAcuan}T09:00:00+07:00`,
  }));
}

/** Rangkaian status yang wajar menuju sebuah status akhir. */
const ALUR_DEMO: Record<StatusMasukan, StatusMasukan[]> = {
  baru: [],
  ditinjau: ["ditinjau"],
  dikerjakan: ["ditinjau", "dikerjakan"],
  selesai: ["ditinjau", "dikerjakan", "selesai"],
  ditolak: ["ditinjau", "ditolak"],
};

function jejakDemo(status: StatusMasukan, urutanMasukan: number) {
  const alur = ALUR_DEMO[status];

  return alur
    .map((ke, j) => ({
      id: `masukan-${urutanMasukan + 1}-jejak-${j + 1}`,
      dari: (j === 0 ? "baru" : alur[j - 1]) as StatusMasukan,
      ke,
      olehNama: "Farhan Pratama",
      catatan: "",
      pada: `${dataContoh.tanggalAcuan}T${String(10 + j).padStart(2, "0")}:00:00+07:00`,
    }))
    .reverse();
}
