import type { Peran } from "@/lib/types";

/**
 * Lingkup orang menurut struktur organisasi — padanan `boleh_orang()`
 * dan `bawahan_saya()` di basis data (migrasi 0173).
 *
 * Aturannya satu kalimat: setiap orang melihat dirinya sendiri dan
 * semua yang berada di bawahnya lewat garis pelaporan; CEO dan Manager
 * melihat seluruh organisasi. Modul ini dipakai di sisi aplikasi untuk
 * hal yang tidak bisa diserahkan ke RLS — direktori anggota (tabel
 * `users` terbaca semua orang demi nama) dan mode demo.
 */

export type OrangLingkup = {
  id: string;
  atasanId?: string | null;
};

/** Peran yang melihat seluruh organisasi — padanan `lintas_unit()`. */
export function lihatSemuaOrang(peran: Peran): boolean {
  return peran === "CEO" || peran === "Manager";
}

/** Id seluruh bawahan seseorang, langsung maupun lewat bawahannya. */
export function bawahanTransitif(
  semua: readonly OrangLingkup[],
  id: string,
): Set<string> {
  const anak = new Map<string, string[]>();
  for (const o of semua) {
    if (!o.atasanId) continue;
    const daftar = anak.get(o.atasanId) ?? [];
    daftar.push(o.id);
    anak.set(o.atasanId, daftar);
  }

  const hasil = new Set<string>();
  const antre = [id];
  while (antre.length > 0) {
    const kini = antre.pop() as string;
    for (const b of anak.get(kini) ?? []) {
      // Data lama bisa saja melingkar; yang sudah dikunjungi tidak diulang.
      if (b === id || hasil.has(b)) continue;
      hasil.add(b);
      antre.push(b);
    }
  }
  return hasil;
}

/**
 * Id orang-orang yang boleh dilihat pengguna ini: dirinya dan bawahannya,
 * atau semua bila ia lintas unit. `null` berarti tanpa batas.
 */
export function idTerlihat(
  pengguna: { id: string; role: Peran },
  semua: readonly OrangLingkup[],
): Set<string> | null {
  if (lihatSemuaOrang(pengguna.role)) return null;
  const hasil = bawahanTransitif(semua, pengguna.id);
  hasil.add(pengguna.id);
  return hasil;
}

/** Apakah pengguna boleh melihat data orang `targetId`. */
export function dalamLingkup(
  pengguna: { id: string; role: Peran },
  targetId: string,
  semua: readonly OrangLingkup[],
): boolean {
  const ids = idTerlihat(pengguna, semua);
  return ids === null || ids.has(targetId);
}

/** Saring daftar orang ke yang boleh dilihat pengguna ini. */
export function saringLingkup<T extends OrangLingkup>(
  pengguna: { id: string; role: Peran },
  semua: readonly T[],
): T[] {
  const ids = idTerlihat(pengguna, semua);
  return ids === null ? [...semua] : semua.filter((o) => ids.has(o.id));
}
