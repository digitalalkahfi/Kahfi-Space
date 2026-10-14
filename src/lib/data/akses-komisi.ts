// Modul khusus server.
import "server-only";

import { cache } from "react";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { bolehLihatKomisiSemua, type KomisiTerlihat } from "@/lib/komisi";
import type {
  CakupanAksesKomisiDb,
  PotretAksesKomisi,
} from "@/lib/supabase/types";
import type { Pengguna } from "@/lib/types";

/**
 * Akun yang komisinya terlihat oleh pengguna ini (0212). Dipakai layar
 * untuk memutuskan kolom komisi mana yang digambar; angkanya sendiri
 * tetap hanya keluar dari fungsi database yang memeriksa hal yang sama.
 *
 * Mode demo tidak punya tabel akses: selain CEO/Manager tidak melihat
 * komisi sama sekali (bawaan "tidak ada").
 */
export const akunKomisiTerlihat = cache(
  async (pengguna: Pengguna): Promise<KomisiTerlihat> => {
    if (bolehLihatKomisiSemua(pengguna.role)) return "semua";
    if (modeData() === "demo") return new Set();

    const sb = await klienServer();
    const { data, error } = await sb.rpc("akun_komisi_terlihat");
    // Gagal membaca berarti tidak menggambar komisi — bukan sebaliknya.
    if (error) {
      console.error(`Gagal memuat akses komisi: ${error.message}`);
      return new Set();
    }
    return new Set((data ?? []).map((b) => b.account_id));
  },
);

export type AksesKomisiAnggota = {
  cakupan: CakupanAksesKomisiDb | null;
  /** Untuk cakupan "tertentu". */
  akunIds: string[];
  diberiOleh: string | null;
  diberiPada: string | null;
};

export type RiwayatAksesKomisi = {
  id: string;
  sebelum: PotretAksesKomisi;
  sesudah: PotretAksesKomisi;
  oleh: string;
  pada: string;
};

/**
 * Akses lihat komisi seseorang beserta riwayatnya — untuk kartu anggota.
 * Hanya CEO/Manager (RLS 0212); bagi yang lain null.
 */
export async function aksesKomisiAnggota(
  pengguna: Pengguna,
  userId: string,
): Promise<{
  akses: AksesKomisiAnggota;
  riwayat: RiwayatAksesKomisi[];
  akunAffiliator: { id: string; username: string; aktif: boolean }[];
} | null> {
  if (!bolehLihatKomisiSemua(pengguna.role)) return null;

  if (modeData() === "demo") {
    return {
      akses: { cakupan: null, akunIds: [], diberiOleh: null, diberiPada: null },
      riwayat: [],
      akunAffiliator: dataContoh.accounts
        .filter((a) => a.unit === "affiliator")
        .map((a) => ({ id: a.id, username: a.username, aktif: true })),
    };
  }

  const sb = await klienServer();
  const [akses, akun, riwayat, daftarAkun] = await Promise.all([
    sb
      .from("akses_komisi")
      .select("cakupan, diberi_pada, pemberi:diberi_oleh (nama)")
      .eq("user_id", userId)
      .maybeSingle(),
    sb.from("akses_komisi_akun").select("account_id").eq("user_id", userId),
    sb
      .from("riwayat_akses_komisi")
      .select("id, sebelum, sesudah, pada, pelaku:oleh (nama)")
      .eq("user_id", userId)
      .order("pada", { ascending: false })
      .limit(20),
    sb
      .from("accounts")
      .select("id, username, status, unit:units!inner (kode)")
      .eq("unit.kode", "affiliator")
      .order("username"),
  ]);
  const galat = akses.error ?? akun.error ?? riwayat.error ?? daftarAkun.error;
  if (galat) throw new Error(`Gagal memuat akses komisi: ${galat.message}`);

  const nama = (x: unknown) => (x as { nama: string } | null)?.nama ?? null;

  return {
    akses: {
      cakupan: akses.data?.cakupan ?? null,
      akunIds: (akun.data ?? []).map((a) => a.account_id),
      diberiOleh: nama(akses.data?.pemberi),
      diberiPada: akses.data?.diberi_pada ?? null,
    },
    riwayat: (riwayat.data ?? []).map((r) => ({
      id: r.id,
      sebelum: r.sebelum,
      sesudah: r.sesudah,
      oleh: nama(r.pelaku) ?? "—",
      pada: r.pada,
    })),
    akunAffiliator: (daftarAkun.data ?? []).map((a) => ({
      id: a.id,
      username: a.username,
      aktif: a.status === "aktif",
    })),
  };
}
