import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import {
  gabungPreferensi,
  preferensiAwal,
  type PreferensiNotifikasi,
} from "@/lib/preferensi-notifikasi";
import type { Pengguna } from "@/lib/types";

/**
 * Preferensi notifikasi pengguna yang sedang masuk.
 *
 * Yang belum pernah diatur mengikuti bawaan — bukan "tidak ada
 * preferensi". Membedakan keduanya hanya berguna bagi basis data;
 * bagi layar, orang yang belum pernah membuka halaman ini tetap punya
 * pengaturan yang berlaku, dan ia berhak melihatnya.
 */
export async function preferensiSaya(
  pengguna: Pengguna,
): Promise<PreferensiNotifikasi> {
  if (modeData() === "demo") {
    const tersimpan =
      "notification_preferences" in dataContoh
        ? (
            dataContoh.notification_preferences as {
              untuk: string;
              kategori: string;
              in_app: boolean;
              whatsapp: boolean;
            }[]
          )
            .filter((p) => p.untuk === pengguna.nama)
            .map((p) => ({
              kategori: p.kategori as PreferensiNotifikasi[number]["kategori"],
              inApp: p.in_app,
              whatsapp: p.whatsapp,
            }))
        : [];
    return gabungPreferensi(tersimpan);
  }

  // RPC `preferensi_notifikasi_berlaku` (migrasi 0115) sudah
  // menggabungkan yang tersimpan dengan bawaan. Dipakai alih-alih
  // membaca tabelnya lalu menggabung di sini: aturan penggabungan yang
  // ditulis dua kali akan melenceng begitu ada kategori baru.
  const sb = await klienServer();
  const { data, error } = await sb.rpc("preferensi_notifikasi_berlaku", {
    p_user: pengguna.id,
  });

  // Bawaan bukan tebakan: ia memang yang berlaku bila tidak ada yang
  // tersimpan. Halaman preferensi yang gagal dimuat lebih buruk
  // daripada halaman yang menampilkan keadaan sebenarnya.
  if (error) {
    console.error("Gagal memuat preferensi notifikasi:", error.message);
    return preferensiAwal();
  }

  return gabungPreferensi(
    (data as { kategori: string; in_app: boolean; whatsapp: boolean }[]).map(
      (p) => ({
        kategori: p.kategori as PreferensiNotifikasi[number]["kategori"],
        inApp: p.in_app,
        whatsapp: p.whatsapp,
      }),
    ),
  );
}
