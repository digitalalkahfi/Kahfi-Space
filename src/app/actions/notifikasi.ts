"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";

/**
 * Menandai satu notifikasi sudah dibaca.
 *
 * Tidak ada jalan membatalkan — menandai dibaca adalah pernyataan "aku
 * sudah lihat", dan membatalkannya tidak mengembalikan apa pun yang
 * hilang. Karena itu tidak ada dialog konfirmasi: tindakan yang tidak
 * merusak apa pun sebaiknya tidak melatih orang menekan "ya".
 *
 * Cakupannya dibatasi RLS (`notifikasi_baca_milik_sendiri`, migrasi
 * 0111), bukan oleh `where user_id = …` yang ditulis di sini: dua pagar
 * yang seolah-olah setara membuat orang berhenti memeriksa yang benar.
 */
export async function tandaiDibaca(id: string): Promise<Hasil> {
  if (!id) return gagal("Notifikasi tidak dikenali.", "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  // Hanya yang belum dibaca yang disentuh: menandai ulang akan
  // memundurkan waktu bacanya tanpa alasan.
  const { error } = await sb
    .from("notifications")
    .update({ dibaca_pada: new Date().toISOString() })
    .eq("id", id)
    .is("dibaca_pada", null);

  if (error) return gagal(`Gagal menandai: ${error.message}`);

  await segarkanNotifikasi();
  return sukses(undefined);
}

/**
 * Menandai semua notifikasi sendiri sudah dibaca.
 *
 * Cakupannya nanti dibatasi RLS, bukan oleh `where user_id = …` yang
 * ditulis di sini: dua pagar yang seolah-olah setara membuat orang
 * berhenti memeriksa yang benar.
 */
export async function tandaiSemuaDibaca(): Promise<Hasil<{ jumlah: number }>> {
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { data, error } = await sb
    .from("notifications")
    .update({ dibaca_pada: new Date().toISOString() })
    .is("dibaca_pada", null)
    .select("id");

  if (error) return gagal(`Gagal menandai semua: ${error.message}`);

  const jumlah = data?.length ?? 0;
  await segarkanNotifikasi();
  return sukses(
    { jumlah },
    jumlah === 0
      ? "Tidak ada yang perlu ditandai."
      : `${jumlah} notifikasi ditandai sudah dibaca.`,
  );
}

/** Menyegarkan daftar dan lencananya setelah ada perubahan. */
export async function segarkanNotifikasi() {
  revalidatePath("/notifikasi");
  // Lencana lonceng ada di app-bar, jadi seluruh layout ikut disegarkan.
  revalidatePath("/", "layout");
}
