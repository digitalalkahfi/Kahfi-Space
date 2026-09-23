/**
 * Pembacaan ekspor K-Space lama — modul murni.
 *
 * Satu baris di sini sama dengan satu kunci tingkat atas ekspor
 * (`users:list`, `daily-reports:all`), persis seperti isi
 * `kv_store_lama`. Jadi "entitas" sebuah entri adalah kuncinya sendiri —
 * bukan potongan sebelum titik dua, seperti pada bentuk ekspor karangan
 * yang dipakai sebelum bentuk aslinya diketahui.
 *
 * Bentuknya tidak dijamin rapi, jadi setiap fungsi di sini harus tahan
 * terhadap kunci menyimpang dan nilai kosong.
 */
import { golonganKunci, KUNCI_DIKENAL } from "@/lib/ekspor-v1";

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

/** Kunci ekspor yang punya tempat di skema baru. */
export const ENTITAS_DIKENALI = KUNCI_DIKENAL.map((k) => k.kunci);

/**
 * Entitas sebuah entri: kuncinya sendiri.
 *
 * Kunci kosong tetap ditandai, karena entri tanpa kunci tidak bisa
 * dipetakan ke mana pun dan harus kelihatan di layar.
 */
export function entitasDari(key: string): string {
  return key.trim() === "" ? "(tanpa entitas)" : key;
}

export function dikenali(entitas: string) {
  return golonganKunci(entitas) === "dikenal";
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
      hasil.push({ key: e.key, sebab: "Entri tanpa kunci." });
      continue;
    }

    if (!dikenali(jenis)) {
      hasil.push({
        key: e.key,
        sebab: `Kunci '${jenis}' tidak dipetakan ke skema baru.`,
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
