"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { gagal, type Hasil } from "@/lib/data/hasil";
import { sesiSaatIni } from "@/lib/data/sesi";
import { gantiSandiPengguna } from "@/lib/data/keamanan";
import { jalurAman } from "@/lib/rute";

/**
 * Masuk dengan email dan kata sandi.
 *
 * Pesan galatnya sengaja tidak membedakan "email tidak terdaftar" dari
 * "kata sandi salah" — perbedaan itu memberi tahu penebak bahwa sebuah
 * email terdaftar di sini.
 */
export async function masuk(
  _sebelumnya: Hasil | null,
  data: FormData,
): Promise<Hasil> {
  const email = String(data.get("email") ?? "").trim();
  const sandi = String(data.get("sandi") ?? "");
  const lanjut = jalurAman(String(data.get("lanjut") ?? ""));

  if (!email || !sandi) {
    return gagal("Email dan kata sandi wajib diisi.", "validasi");
  }
  if (modeData() === "demo") {
    return gagal(
      "Mode demo belum terhubung Supabase, jadi belum ada akun untuk masuk.",
      "demo",
    );
  }

  const sb = await klienServer();
  const { error } = await sb.auth.signInWithPassword({
    email,
    password: sandi,
  });

  if (error) {
    return gagal("Email atau kata sandi tidak cocok.", "izin");
  }

  revalidatePath("/", "layout");
  redirect(lanjut);
}

/** Keluar dan kembali ke halaman masuk. */
export async function keluar() {
  if (modeData() === "supabase") {
    const sb = await klienServer();
    await sb.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/masuk");
}

/**
 * Mengganti kata sandi sendiri.
 *
 * Aturannya tidak ditulis di sini — `gantiSandiPengguna()` yang sama
 * dipakai endpoint POST /api/keamanan/sandi. Dua salinan aturan ganti
 * sandi adalah cara paling mudah membuat salah satunya lupa memeriksa
 * sandi lama.
 */
export async function gantiSandi(
  lama: string,
  baru: string,
  ulang: string,
): Promise<Hasil> {
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const hasil = await gantiSandiPengguna(pengguna, lama, baru, ulang);
  if (hasil.ok) revalidatePath("/keamanan");
  return hasil;
}
