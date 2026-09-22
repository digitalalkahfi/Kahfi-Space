/**
 * Pembacaan ekspor `kv_store` sistem lama — modul murni.
 *
 * Sistem lama menyimpan segalanya sebagai pasangan kunci-nilai dengan
 * bentuk `entitas:sisa-kunci`. Bentuknya tidak dijamin rapi, jadi setiap
 * fungsi di sini harus tahan terhadap kunci menyimpang dan nilai kosong.
 */

export type EntriKv = {
  key: string;
  value: unknown;
};

export type EksporKv = {
  sumber: string;
  dibuatPada: string;
  entri: EntriKv[];
};

export type RingkasKv = {
  entitas: string;
  jumlah: number;
  dikenali: boolean;
};

/** Entitas yang punya tempat di skema baru. */
export const ENTITAS_DIKENALI = [
  "user",
  "account",
  "goal",
  "report",
  "attendance",
  "task",
] as const;

export function entitasDari(key: string): string {
  const pisah = key.indexOf(":");
  if (pisah <= 0) return "(tanpa entitas)";
  return key.slice(0, pisah);
}

export function dikenali(entitas: string) {
  return (ENTITAS_DIKENALI as readonly string[]).includes(entitas);
}

/** Ringkasan jumlah entri per entitas, terbanyak lebih dulu. */
export function ringkasKv(entri: EntriKv[]): RingkasKv[] {
  const peta = new Map<string, number>();
  for (const e of entri) {
    const jenis = entitasDari(e.key);
    peta.set(jenis, (peta.get(jenis) ?? 0) + 1);
  }

  return [...peta.entries()]
    .map(([entitas, jumlah]) => ({
      entitas,
      jumlah,
      dikenali: dikenali(entitas),
    }))
    .sort((a, b) => b.jumlah - a.jumlah || a.entitas.localeCompare(b.entitas));
}

export type MasalahKv = {
  key: string;
  sebab: string;
};

/**
 * Kejanggalan yang bisa dilihat tanpa menyentuh database.
 *
 * Sengaja dikerjakan sebelum migrasi dijalankan: lebih murah menemukan
 * 300 entri bermasalah di layar daripada di tengah penulisan data.
 */
export function masalahKv(entri: EntriKv[]): MasalahKv[] {
  const hasil: MasalahKv[] = [];
  const terlihat = new Set<string>();

  for (const e of entri) {
    if (terlihat.has(e.key)) {
      hasil.push({ key: e.key, sebab: "Kunci muncul lebih dari sekali." });
    }
    terlihat.add(e.key);

    const jenis = entitasDari(e.key);
    if (jenis === "(tanpa entitas)") {
      hasil.push({
        key: e.key,
        sebab: "Kunci tidak memuat pemisah ':', entitasnya tak bisa ditentukan.",
      });
      continue;
    }

    if (!dikenali(jenis)) {
      hasil.push({
        key: e.key,
        sebab: `Entitas '${jenis}' tidak ada di skema baru.`,
      });
      continue;
    }

    if (e.value === null || e.value === undefined) {
      hasil.push({ key: e.key, sebab: "Nilainya kosong." });
      continue;
    }

    if (typeof e.value !== "object") {
      hasil.push({ key: e.key, sebab: "Nilainya bukan objek." });
    }
  }

  return hasil;
}
