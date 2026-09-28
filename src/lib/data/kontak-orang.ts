// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { klienServer } from "@/lib/supabase/server";

export type KontakOrang = {
  email: string;
  /** Nomor WhatsApp bentuk baku +62…; null bila belum diisi. */
  kontak: string | null;
  terverifikasiPada: string | null;
  optin: boolean;
};

/**
 * Email dan nomor WhatsApp, lewat satu pintu `kontak_orang` (0174).
 *
 * Kolom-kolom ini tidak dibaca langsung dari tabel `users`: nama dan
 * peran memang terbuka untuk semua orang, tetapi data kontak hanya untuk
 * dirinya, atasannya lewat garis pelaporan, dan CEO/Manager. Basis data
 * yang menyaring, jadi orang di luar cakupan tidak ikut dikembalikan.
 *
 * `ids` null berarti semua yang terlihat pemanggil.
 */
export async function kontakOrang(
  ids: readonly string[] | null,
): Promise<Map<string, KontakOrang>> {
  const peta = new Map<string, KontakOrang>();
  if (ids !== null && ids.length === 0) return peta;

  const sb = await klienServer();
  const { data, error } = await sb.rpc("kontak_orang", {
    p_ids: ids === null ? null : [...ids],
  });
  if (error) throw new Error(`Gagal memuat data kontak: ${error.message}`);

  for (const b of data ?? []) {
    peta.set(b.id, {
      email: b.email ?? "",
      kontak: b.kontak,
      terverifikasiPada: b.kontak_terverifikasi_pada,
      optin: b.whatsapp_optin,
    });
  }
  return peta;
}
