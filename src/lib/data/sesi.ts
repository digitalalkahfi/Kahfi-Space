// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { cache } from "react";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { kePengguna, personaContoh, penggunaContoh } from "@/lib/data/contoh";
import type { KodeUnit, Peran, Pengguna } from "@/lib/types";

export const DAFTAR_PERAN: Peran[] = [
  "CEO",
  "Manager",
  "Leader",
  "Co-Leader",
  "Staff",
  "Finance",
];

export function peranValid(nilai: unknown): nilai is Peran {
  return typeof nilai === "string" && DAFTAR_PERAN.includes(nilai as Peran);
}

/**
 * Profil pengguna yang sedang login.
 *
 * Mode supabase: dibaca dari sesi Auth lalu dicocokkan ke tabel `users`.
 * Mode demo: persona sesuai `peranPratinjau` (default Manager).
 *
 * `cache` membuatnya dipanggil sekali per request walau dipakai banyak
 * komponen.
 */
export const sesiSaatIni = cache(
  async (peranPratinjau?: Peran): Promise<Pengguna | null> => {
    if (modeData() === "demo") {
      return personaContoh(peranPratinjau ?? "Manager");
    }

    const sb = await klienServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return null;

    const { data, error } = await sb
      .from("users")
      .select(
        "id, nama, email, role, jabatan, unit_id, foto_url, units:unit_id (kode)",
      )
      .eq("id", user.id)
      .single();

    if (error || !data) return null;

    const unit = data.units as unknown as { kode: KodeUnit } | null;
    return {
      id: data.id,
      nama: data.nama,
      email: data.email ?? "",
      role: data.role as Peran,
      jabatan: data.jabatan,
      unitId: unit?.kode ?? null,
      fotoUrl: data.foto_url,
      inisial: inisialDari(data.nama),
    };
  },
);

export function inisialDari(nama: string) {
  const bagian = nama.trim().split(/\s+/);
  if (bagian.length === 0) return "?";
  const depan = bagian[0][0] ?? "";
  const belakang = bagian.length > 1 ? (bagian.at(-1)?.[0] ?? "") : "";
  return (depan + belakang).toUpperCase();
}

/** Seluruh anggota tim — dipakai direktori & pemilih penerima tiket. */
export async function daftarAnggota(): Promise<Pengguna[]> {
  if (modeData() === "demo") return penggunaContoh();

  const sb = await klienServer();
  const { data, error } = await sb
    .from("users")
    .select(
      "id, nama, email, role, jabatan, unit_id, foto_url, units:unit_id (kode)",
    )
    .eq("status", "aktif")
    .order("nama");

  if (error || !data) return [];

  return data.map((d) => {
    const unit = d.units as unknown as { kode: KodeUnit } | null;
    return {
      id: d.id,
      nama: d.nama,
      email: d.email ?? "",
      role: d.role as Peran,
      jabatan: d.jabatan,
      unitId: unit?.kode ?? null,
      fotoUrl: d.foto_url,
      inisial: inisialDari(d.nama),
    };
  });
}

export { kePengguna };

/**
 * Anggota yang boleh ditugasi oleh pengguna ini.
 * CEO & Manager menugasi siapa pun; Leader/Co-Leader hanya unitnya atau
 * bawahan langsungnya — cerminan policy `tasks_buat`.
 */
export async function anggotaBisaDitugasi(
  pengguna: Pengguna,
): Promise<Pengguna[]> {
  const semua = await daftarAnggota();
  if (pengguna.role === "CEO" || pengguna.role === "Manager") {
    return semua.filter((a) => a.id !== pengguna.id);
  }

  if (pengguna.role === "Leader" || pengguna.role === "Co-Leader") {
    return semua.filter(
      (a) => a.id !== pengguna.id && a.unitId === pengguna.unitId,
    );
  }

  return [];
}
