"use client";

// Modul khusus browser (memakai Supabase Storage dari sisi klien).
import "client-only";

import { modeData } from "@/lib/supabase/config";
import { klienBrowser } from "@/lib/supabase/client";
import { AVATAR_MAKS_BYTE, periksaBerkasAvatar } from "@/lib/profil";

const BUCKET = "foto-profil";

export type HasilUnggahFoto =
  { ok: true; url: string | null } | { ok: false; pesan: string };

/**
 * Unggah foto profil ke Supabase Storage.
 *
 * Diunggah dari browser, bukan lewat Server Action, karena berkas foto
 * tidak perlu singgah di server aplikasi sama sekali — dan kalaupun
 * dititipkan, Server Action punya batas ukuran badan permintaan yang
 * jauh lebih ketat daripada batas bucket.
 *
 * Path selalu `<user_id>/profil.<ext>`: satu berkas per orang, ditimpa
 * setiap kali diganti. Tidak ada gunanya menyimpan riwayat foto profil,
 * dan menumpuknya hanya membuat bucket membengkak diam-diam.
 */
export async function unggahFotoProfil(berkas: File): Promise<HasilUnggahFoto> {
  const cek = periksaBerkasAvatar(berkas);
  if (!cek.ok) return { ok: false, pesan: cek.pesan ?? "Berkas ditolak." };
  if (berkas.size > AVATAR_MAKS_BYTE) {
    return { ok: false, pesan: "Foto melebihi batas 2 MB." };
  }

  if (modeData() === "demo") return { ok: true, url: null };

  try {
    const sb = klienBrowser();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user)
      return { ok: false, pesan: "Sesi berakhir, silakan masuk lagi." };

    const ext = berkas.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const path = `${user.id}/profil.${ext}`;

    const { error } = await sb.storage.from(BUCKET).upload(path, berkas, {
      contentType: berkas.type,
      // Ganti foto berarti mengganti, bukan menambah.
      upsert: true,
    });
    if (error) {
      return { ok: false, pesan: "Foto gagal diunggah, coba lagi sebentar." };
    }

    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    // Penanda waktu memaksa browser mengambil ulang; tanpa itu foto lama
    // tetap terlihat karena URL-nya tidak berubah.
    return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
  } catch {
    return { ok: false, pesan: "Foto gagal diunggah, coba lagi sebentar." };
  }
}
