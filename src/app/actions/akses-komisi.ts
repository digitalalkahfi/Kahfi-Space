"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import {
  bolehLihatKomisiSemua,
  labelAksesKomisi,
  PILIHAN_AKSES_KOMISI,
  type PilihanAksesKomisi,
} from "@/lib/komisi";

const HANYA_PENGELOLA =
  "Hanya CEO atau Manager yang boleh mengatur akses komisi.";

/**
 * Memberi, mengubah, atau mencabut akses lihat komisi seseorang (§4.5).
 *
 * Lewat `atur_akses_komisi` (0212), yang sekali lagi memeriksa
 * CEO/Manager aktif dan mencatat riwayatnya dalam transaksi yang sama.
 * Klien tidak punya hak menulis tabel aksesnya secara langsung.
 */
export async function aturAksesKomisi(
  userId: string,
  pilihan: PilihanAksesKomisi,
  akunIds: string[],
): Promise<Hasil> {
  if (!userId) return gagal("Anggota tidak dikenali.", "validasi");
  if (!PILIHAN_AKSES_KOMISI.some((p) => p.nilai === pilihan)) {
    return gagal("Pilihan akses tidak dikenali.", "validasi");
  }
  if (pilihan === "tertentu" && akunIds.length === 0) {
    return gagal('Pilih minimal satu akun untuk "akun tertentu".', "validasi");
  }

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehLihatKomisiSemua(pengguna.role))
    return gagal(HANYA_PENGELOLA, "izin");

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb.rpc("atur_akses_komisi", {
    p_user: userId,
    p_cakupan: pilihan === "tidak" ? null : pilihan,
    p_akun: pilihan === "tertentu" ? akunIds : null,
  });
  if (error) {
    return error.code === "42501"
      ? gagal(HANYA_PENGELOLA, "izin")
      : gagal(error.message, "validasi");
  }

  revalidatePath(`/tim/${userId}`);
  return sukses(
    undefined,
    pilihan === "tidak"
      ? "Akses lihat komisi dicabut."
      : `Akses lihat komisi: ${labelAksesKomisi(pilihan)}.`,
  );
}
