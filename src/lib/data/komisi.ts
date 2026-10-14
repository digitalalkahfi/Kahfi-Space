// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { bolehLihatKomisiSemua } from "@/lib/komisi";
import type { Pengguna } from "@/lib/types";

/** Komisi Affiliator satu hari, beserta kelengkapan laporannya. */
export type KomisiHarian = {
  tanggal: string;
  komisi: number;
  /** Laporan akun Affiliator hari itu. */
  laporan: number;
  /** Yang komisinya terisi (laporan sebelum komisi wajib boleh kosong). */
  berkomisi: number;
};

/**
 * Deret komisi Affiliator per hari — sumber kartu "Komisi Affiliator".
 *
 * Hanya untuk CEO/Manager: selain itu mengembalikan null TANPA memanggil
 * database, dan database sendiri menolak pemanggil lain
 * (`komisi_affiliator_harian`, 0210).
 */
export async function komisiAffiliatorHarian(
  pengguna: Pengguna,
  dari: string,
  sampai: string,
): Promise<KomisiHarian[] | null> {
  if (!bolehLihatKomisiSemua(pengguna.role)) return null;

  if (modeData() === "demo") {
    const affiliator = new Set(
      dataContoh.accounts
        .filter((a) => a.unit === "affiliator")
        .map((a) => a.username),
    );
    const per = new Map<string, KomisiHarian>();
    for (const l of dataContoh.daily_reports) {
      if (!l.akun || !affiliator.has(l.akun)) continue;
      if (l.tanggal < dari || l.tanggal > sampai) continue;
      const k = (l as { komisi?: number | null }).komisi ?? null;
      const ada = per.get(l.tanggal) ?? {
        tanggal: l.tanggal,
        komisi: 0,
        laporan: 0,
        berkomisi: 0,
      };
      ada.laporan += 1;
      if (k !== null) {
        ada.komisi += k;
        ada.berkomisi += 1;
      }
      per.set(l.tanggal, ada);
    }
    return [...per.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("komisi_affiliator_harian", {
    p_dari: dari,
    p_sampai: sampai,
  });
  if (error) throw new Error(`Gagal memuat komisi: ${error.message}`);
  return (data ?? []).map((b) => ({
    tanggal: b.tanggal,
    komisi: Number(b.komisi),
    laporan: b.laporan,
    berkomisi: b.berkomisi,
  }));
}
