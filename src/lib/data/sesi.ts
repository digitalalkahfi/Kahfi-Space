// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { cache } from "react";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { kePengguna, personaContoh, penggunaContoh } from "@/lib/data/contoh";
import { saringLingkup } from "@/lib/lingkup";
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
        "id, nama, role, jabatan, unit_id, atasan_id, foto_url, units:unit_id (kode)",
      )
      .eq("id", user.id)
      .single();

    if (error || !data) return null;

    const unit = data.units as unknown as { kode: KodeUnit } | null;
    return {
      id: data.id,
      nama: data.nama,
      // Email diambil dari identitas masuknya, bukan kolom `users.email`:
      // kolom itu hanya terbaca lewat `kontak_orang` (0174/0175), dan
      // email yang dipakai untuk masuk memang yang ini.
      email: user.email ?? "",
      role: data.role as Peran,
      jabatan: data.jabatan,
      unitId: unit?.kode ?? null,
      fotoUrl: data.foto_url,
      inisial: inisialDari(data.nama),
      atasanId: data.atasan_id,
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
      "id, nama, role, jabatan, unit_id, atasan_id, foto_url, units:unit_id (kode)",
    )
    .eq("status", "aktif")
    .order("nama");

  if (error || !data) return [];

  return data.map((d) => {
    const unit = d.units as unknown as { kode: KodeUnit } | null;
    return {
      id: d.id,
      nama: d.nama,
      // Daftar ini dipakai untuk memilih orang (penerima tugas, pemegang
      // aset), bukan menghubunginya; email tidak ikut dimuat.
      email: "",
      role: d.role as Peran,
      jabatan: d.jabatan,
      unitId: unit?.kode ?? null,
      fotoUrl: d.foto_url,
      inisial: inisialDari(d.nama),
      atasanId: d.atasan_id,
    };
  });
}

export { kePengguna };

/**
 * Anggota yang boleh ditugasi oleh pengguna ini.
 * CEO & Manager menugasi siapa pun; yang lain hanya bawahannya lewat
 * garis pelaporan — cerminan policy `tasks_buat` dan `boleh_orang` (0173).
 */
export async function anggotaBisaDitugasi(
  pengguna: Pengguna,
): Promise<Pengguna[]> {
  const semua = await daftarAnggota();
  return saringLingkup(pengguna, semua).filter((a) => a.id !== pengguna.id);
}
