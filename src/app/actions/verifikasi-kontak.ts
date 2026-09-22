"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { bolehKelolaAnggota } from "@/lib/data/anggota";

/**
 * Menandai nomor seseorang sudah dibuktikan miliknya.
 *
 * Dilakukan pengelola, bukan pemiliknya — verifikasi yang bisa
 * diberikan sendiri tidak memverifikasi apa pun, dan seluruh syarat
 * opt-in WhatsApp berdiri di atas kolom ini.
 *
 * Alurnya di dunia nyata: orangnya mengirim satu pesan dari nomor itu
 * ke nomor resmi perusahaan; pengelola melihat pesannya datang, lalu
 * menekan tombol ini. Tidak ada kode OTP — menambah satu lagi tidak
 * membuktikan lebih banyak daripada pesan yang benar-benar tiba.
 */
export async function verifikasiKontakAnggota(userId: string): Promise<Hasil> {
  if (!userId) return gagal("Anggota tidak dikenali.", "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAnggota(pengguna)) {
    return gagal(
      "Hanya CEO dan Manager yang bisa memverifikasi nomor.",
      "izin",
    );
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb.rpc("verifikasi_kontak", { p_user: userId });

  if (error) {
    return error.code === "42501"
      ? gagal("Hanya CEO dan Manager yang bisa memverifikasi nomor.", "izin")
      : gagal(`Gagal memverifikasi: ${error.message}`);
  }

  segarkan(userId);
  return sukses(
    undefined,
    "Nomor ditandai terverifikasi. Pemiliknya masih perlu menyetujui sendiri sebelum pesan dikirim.",
  );
}

/**
 * Mencabut verifikasi sebuah nomor.
 *
 * Persetujuannya ikut dicabut (fungsi `cabut_verifikasi_kontak`,
 * migrasi 0119): persetujuan atas nomor yang tidak lagi dipercaya tidak
 * boleh tetap berlaku.
 */
export async function cabutVerifikasiAnggota(userId: string): Promise<Hasil> {
  if (!userId) return gagal("Anggota tidak dikenali.", "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAnggota(pengguna)) {
    return gagal(
      "Hanya CEO dan Manager yang bisa mencabut verifikasi.",
      "izin",
    );
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb.rpc("cabut_verifikasi_kontak", {
    p_user: userId,
  });

  if (error) return gagal(`Gagal mencabut verifikasi: ${error.message}`);

  segarkan(userId);
  return sukses(
    undefined,
    "Verifikasi dicabut beserta persetujuan WhatsApp-nya.",
  );
}

function segarkan(userId: string) {
  revalidatePath(`/tim/${userId}`);
  revalidatePath("/tim");
  revalidatePath("/profil");
}
