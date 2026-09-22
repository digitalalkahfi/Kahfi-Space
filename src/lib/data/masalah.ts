// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import type { DampakMasalah, Masalah, StatusMasalah } from "@/lib/masalah";
import type { KodeUnit, Pengguna } from "@/lib/types";

/** Menutup dan mengelola masalah adalah wewenang CEO/Manager. */
export function bolehKelolaMasalah(pengguna: Pengguna) {
  return pengguna.role === "CEO" || pengguna.role === "Manager";
}

function satu<T>(nilai: T | T[] | null | undefined): T | null {
  if (!nilai) return null;
  return Array.isArray(nilai) ? (nilai[0] ?? null) : nilai;
}

/** Laporan Kaizen yang terlihat pengguna, terbaru lebih dulu. */
export async function daftarMasalah(pengguna: Pengguna): Promise<Masalah[]> {
  if (modeData() === "demo") return masalahDemo(pengguna);

  const sb = await klienServer();
  const { data, error } = await sb
    .from("problems")
    .select(
      `id, judul, konteks, dampak, status, solusi, ditutup_alasan, created_at,
       unit:units (kode, nama),
       pelapor:users (nama)`,
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat masalah: ${error.message}`);

  return (data ?? []).map((m) => {
    const unit = satu(m.unit);
    return {
      id: m.id,
      judul: m.judul,
      konteks: m.konteks,
      unitKode: (unit?.kode as KodeUnit) ?? null,
      unitNama: unit?.nama ? unit.nama.split(" (")[0] : "Lintas unit",
      pelaporNama: satu(m.pelapor)?.nama ?? null,
      dampak: m.dampak as DampakMasalah,
      status: m.status as StatusMasalah,
      solusi: m.solusi,
      ditutupAlasan: m.ditutup_alasan,
      dibuatPada: m.created_at,
    };
  });
}

/** Satu laporan; dibaca dari daftar yang cakupannya sudah disaring. */
export async function masalahDariId(
  pengguna: Pengguna,
  id: string,
): Promise<Masalah | null> {
  const semua = await daftarMasalah(pengguna);
  return semua.find((m) => m.id === id) ?? null;
}

// ---------------------------------------------------------------------
// Mode demo — cakupan baca menirukan policy `problems_baca`.
// ---------------------------------------------------------------------
function masalahDemo(pengguna: Pengguna): Masalah[] {
  const { problems, units } = dataContoh;

  return problems
    .map((m, i) => {
      const unit = units.find((u) => u.kode === m.unit);
      return {
        id: `masalah-${i + 1}`,
        judul: m.judul,
        konteks: m.konteks,
        unitKode: (m.unit as KodeUnit) ?? null,
        unitNama: unit?.nama ? unit.nama.split(" (")[0] : "Lintas unit",
        pelaporNama: m.pelapor ?? null,
        dampak: m.dampak as DampakMasalah,
        status: m.status as StatusMasalah,
        solusi: m.solusi,
        ditutupAlasan: "",
        dibuatPada: `${dataContoh.tanggalAcuan}T09:00:00+07:00`,
      } satisfies Masalah;
    })
    .filter((m) => {
      if (
        pengguna.role === "CEO" ||
        pengguna.role === "Manager" ||
        pengguna.role === "Finance"
      ) {
        return true;
      }
      return m.unitKode === pengguna.unitId || m.pelaporNama === pengguna.nama;
    });
}

export type JejakMasalah = {
  id: string;
  dari: StatusMasalah | null;
  ke: StatusMasalah;
  olehNama: string | null;
  catatan: string;
  pada: string;
};

/**
 * Riwayat status sebuah masalah.
 *
 * Terbuka bagi siapa pun yang boleh melihat masalahnya — pelapor berhak
 * tahu apa yang terjadi pada masalah yang ia angkat, termasuk bila
 * ditutup tanpa ditindak (0086).
 */
export async function jejakMasalah(masalahId: string): Promise<JejakMasalah[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data, error } = await sb
    .from("problem_events")
    .select("id, dari, ke, catatan, pada, oleh:users (nama)")
    .eq("problem_id", masalahId)
    .order("pada", { ascending: false });

  if (error || !data) return [];

  return data.map((j) => ({
    id: j.id,
    dari: (j.dari as StatusMasalah | null) ?? null,
    ke: j.ke as StatusMasalah,
    olehNama: (j.oleh as unknown as { nama: string } | null)?.nama ?? null,
    catatan: j.catatan,
    pada: j.pada,
  }));
}
