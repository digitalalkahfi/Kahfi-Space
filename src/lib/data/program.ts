// Modul khusus server.
import "server-only";

import { dataContoh } from "@/lib/data/contoh";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import type { KodeUnit, Pengguna } from "@/lib/types";

/** Satu program beserta berapa yang benar-benar memakainya. */
export type ProgramKelola = {
  id: string;
  nama: string;
  unitKode: KodeUnit | null;
  unitNama: string;
  aktif: boolean;
  /** Anggota aktif yang terdaftar di program ini. */
  jumlahAnggota: number;
  /** Akun affiliator aktif yang berjalan di program ini. */
  jumlahAkun: number;
};

/** Hanya CEO & Manager yang boleh menyetel program (RLS migrasi 0004). */
export function bolehKelolaProgram(pengguna: Pengguna) {
  return pengguna.role === "CEO" || pengguna.role === "Manager";
}

/**
 * Seluruh program, termasuk yang nonaktif.
 *
 * Beda dari `pilihanOrganisasi`, yang sengaja hanya memuat yang aktif
 * karena dipakai mengisi pilihan form. Halaman pengelolaan justru perlu
 * melihat yang nonaktif: itulah yang mungkin ingin dihidupkan lagi.
 */
export async function daftarProgram(
  pengguna: Pengguna,
): Promise<ProgramKelola[]> {
  void pengguna;

  if (modeData() === "demo") return programDemo();

  const sb = await klienServer();
  const [prog, anggota, akun] = await Promise.all([
    sb
      .from("programs")
      .select("id, nama, aktif, unit:units (kode, nama)")
      .order("nama"),
    sb.from("users").select("program_id").eq("status", "aktif"),
    sb.from("accounts").select("program_id").eq("status", "aktif"),
  ]);

  if (prog.error)
    throw new Error(`Gagal memuat program: ${prog.error.message}`);

  const cacah = (baris: { program_id: string | null }[] | null) => {
    const per = new Map<string, number>();
    for (const b of baris ?? []) {
      if (!b.program_id) continue;
      per.set(b.program_id, (per.get(b.program_id) ?? 0) + 1);
    }
    return per;
  };

  const perAnggota = cacah(anggota.data);
  const perAkun = cacah(akun.data);

  return (prog.data ?? []).map((p) => ({
    id: p.id,
    nama: p.nama,
    unitKode: (p.unit?.kode as KodeUnit) ?? null,
    unitNama: p.unit?.nama ? p.unit.nama.split(" (")[0] : "—",
    aktif: p.aktif,
    jumlahAnggota: perAnggota.get(p.id) ?? 0,
    jumlahAkun: perAkun.get(p.id) ?? 0,
  }));
}

/** Padanan tabel `programs` untuk mode demo, dari seed. */
function programDemo(): ProgramKelola[] {
  const { programs, units, users, accounts } = dataContoh;

  return programs
    .map((p) => {
      const unit = units.find((u) => u.kode === p.unit);
      return {
        id: p.id,
        nama: p.nama,
        unitKode: (p.unit as KodeUnit) ?? null,
        unitNama: unit?.nama ? unit.nama.split(" (")[0] : "—",
        aktif: p.aktif,
        jumlahAnggota: users.filter(
          (u) => (u as { program?: string }).program === p.nama,
        ).length,
        jumlahAkun: accounts.filter((a) => a.program === p.nama).length,
      } satisfies ProgramKelola;
    })
    .sort((x, y) => x.nama.localeCompare(y.nama));
}
