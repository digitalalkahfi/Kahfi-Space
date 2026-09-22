"use client";

// Modul khusus browser (memakai Supabase Storage dari sisi klien).
import "client-only";

import { modeData } from "@/lib/supabase/config";
import { klienBrowser } from "@/lib/supabase/client";

const BUCKET = "selfie-absensi";

/** Sejalan dengan batas bucket di supabase/storage.sql. */
export const MAKS_BYTE = 3 * 1024 * 1024;
const TIPE_DIIZINKAN = ["image/jpeg", "image/png", "image/webp"];

export type HasilUnggah =
  { ok: true; path: string | null } | { ok: false; pesan: string };

/**
 * Unggah selfie absensi ke Supabase Storage.
 *
 * Path selalu diawali id pengguna (`<user_id>/<tanggal>-<tahap>.jpg`) karena
 * policy storage memeriksa kepemilikan dari folder pertama.
 *
 * Kegagalan unggah TIDAK membatalkan absensi: bukti utamanya titik lokasi,
 * dan menahan absensi karena kamera bermasalah justru merugikan staf lapangan.
 */
export async function unggahSelfie(
  blob: Blob,
  tanggal: string,
  tahap: "masuk" | "pulang",
): Promise<HasilUnggah> {
  if (blob.size === 0)
    return { ok: false, pesan: "Foto kosong, coba jepret ulang." };
  if (blob.size > MAKS_BYTE) {
    return {
      ok: false,
      pesan:
        "Ukuran foto melebihi 3 MB. Jepret ulang dengan pencahayaan cukup.",
    };
  }
  if (blob.type && !TIPE_DIIZINKAN.includes(blob.type)) {
    return { ok: false, pesan: "Format foto tidak didukung." };
  }

  if (modeData() === "demo") return { ok: true, path: null };

  try {
    const sb = klienBrowser();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user)
      return { ok: false, pesan: "Sesi berakhir, silakan masuk lagi." };

    const path = `${user.id}/${tanggal}-${tahap}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type || "image/jpeg",
      // Absen ulang di hari yang sama tidak terjadi (unik per tanggal),
      // jadi menimpa tidak perlu dan foto lama tetap jadi bukti.
      upsert: false,
    });

    if (error) {
      return {
        ok: false,
        pesan: "Foto gagal diunggah, tetapi absensi tetap bisa dikirim.",
      };
    }
    return { ok: true, path };
  } catch {
    return {
      ok: false,
      pesan: "Foto gagal diunggah, tetapi absensi tetap bisa dikirim.",
    };
  }
}
